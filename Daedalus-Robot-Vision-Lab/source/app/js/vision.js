/* vision.js — the computer-vision engine (MediaPipe Tasks, fully offline).
   One camera, one model at a time — FACE or HANDS — so each mode stays crisp and fast.

   D.vision.start(owner, mode)   open camera + model; mode = 'face' | 'hands'
   D.vision.setMode(mode)        switch which model runs (the other is not evaluated at all)
   D.vision.stop(owner)          release (camera closes when nobody needs it)
   D.vision.on(fn)               fn(frame) every processed frame → returns unsubscribe
   D.vision.attach(videoEl)      show the live camera in any <video>
   D.vision.drawOverlay(canvas, frame, mirrored)
   D.vision.calibrate()          capture the user's neutral face as a baseline

   frame = { mode, ts, fps, face: FaceInfo|null, hands: HandInfo[] }
*/
(function (global) {
  'use strict';
  var D = global.D;

  var BASE = new URL('.', document.baseURI).href;
  var BUNDLE = BASE + 'vendor/mediapipe/vision_bundle.mjs';
  var WASM = BASE + 'vendor/mediapipe/wasm';
  var MODELS = { face: BASE + 'models/face_landmarker.task', hands: BASE + 'models/hand_landmarker.task' };

  var mp = null, fileset = null, landmarkers = {}, stream = null, video = null;
  var listeners = [], owner = null, mode = 'face', running = false, rafId = 0, lastTs = -1;
  var fpsAvg = 0, lastFrameT = 0, status = 'idle', statusMsg = '';
  var calib = D.store.get('cv.calibration', null);
  var faceWidthAvg = 0;

  function setStatus(s, msg) { status = s; statusMsg = msg || ''; D.bus.emit('vision-status', { status: s, msg: msg || '', mode: mode }); }

  function loadBundle() {
    if (mp) return Promise.resolve(mp);
    return import(BUNDLE).then(function (m) { mp = m; return m; });
  }
  function getFileset() {
    if (fileset) return Promise.resolve(fileset);
    return loadBundle().then(function (m) { return m.FilesetResolver.forVisionTasks(WASM); }).then(function (f) { fileset = f; return f; });
  }
  function createLandmarker(which, delegate) {
    return getFileset().then(function (fs) {
      if (which === 'face') {
        return mp.FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: MODELS.face, delegate: delegate },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5
        });
      }
      return mp.HandLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: MODELS.hands, delegate: delegate },
        runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
      });
    });
  }
  function getLandmarker(which) {
    if (landmarkers[which]) return Promise.resolve(landmarkers[which]);
    var pref = D.settings.get('cvDelegate') || 'GPU';
    return createLandmarker(which, pref).catch(function (e) {
      console.warn('GPU delegate failed, falling back to CPU', e);
      return createLandmarker(which, 'CPU');
    }).then(function (lm) { landmarkers[which] = lm; return lm; });
  }

  function openCamera() {
    if (stream) return Promise.resolve(stream);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('Camera API not available'));
    var camId = D.settings.get('cameraId');
    var constraints = { audio: false, video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' } };
    if (camId) constraints.video.deviceId = { exact: camId };
    return navigator.mediaDevices.getUserMedia(constraints).catch(function (e) {
      if (camId) { constraints.video.deviceId = undefined; return navigator.mediaDevices.getUserMedia(constraints); }
      throw e;
    }).then(function (s) {
      stream = s;
      if (!video) { video = document.createElement('video'); video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); }
      video.srcObject = s;
      return video.play().then(function () { return s; });
    });
  }
  function closeCamera() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    if (video) video.srcObject = null;
    D.$$('video[data-vision]').forEach(function (v) { v.srcObject = null; });
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (!video || video.readyState < 2) return;
    var lm = landmarkers[mode]; if (!lm) return;
    var now = performance.now();
    if (now - lastFrameT < 1000 / 32) return;           // ~30 fps cap
    if (video.currentTime === lastTs) return;
    lastTs = video.currentTime;
    var dt = now - lastFrameT; lastFrameT = now;
    fpsAvg = fpsAvg ? fpsAvg * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
    var res;
    try { res = lm.detectForVideo(video, now); } catch (e) { console.error(e); return; }
    var frame = { mode: mode, ts: now, fps: fpsAvg, face: null, hands: [], vw: video.videoWidth, vh: video.videoHeight };
    if (mode === 'face') frame.face = analyzeFace(res, video.videoWidth / video.videoHeight);
    else frame.hands = analyzeHands(res, video.videoWidth / video.videoHeight);
    D.vision.last = frame;
    listeners.slice().forEach(function (fn) { try { fn(frame); } catch (e) { console.error(e); } });
  }

  /* ================================================================ FACE */
  function bsMap(res) {
    var m = {};
    if (res.faceBlendshapes && res.faceBlendshapes[0]) res.faceBlendshapes[0].categories.forEach(function (c) { m[c.categoryName] = c.score; });
    return m;
  }
  function avg(a, b) { return (a + b) / 2; }

  function analyzeFace(res, aspect) {
    if (!res.faceLandmarks || !res.faceLandmarks.length) return null;
    var lm = res.faceLandmarks[0];
    var raw = bsMap(res);
    var b = calibrated(raw);
    /* head pose from landmarks, in mirrored display coordinates */
    function P(i) { return { x: (1 - lm[i].x) * aspect, y: lm[i].y }; }
    var eL = P(263), eR = P(33), nose = P(1), cL = P(454), cR = P(234), chin = P(152), fore = P(10);
    var roll = Math.atan2(eR.y - eL.y, eR.x - eL.x) * 180 / Math.PI;
    var faceW = Math.hypot(cR.x - cL.x, cR.y - cL.y);
    var midX = (cL.x + cR.x) / 2;
    var yaw = D.clamp((nose.x - midX) / faceW * 2.2, -1, 1) * 18;
    var faceH = Math.hypot(chin.x - fore.x, chin.y - fore.y);
    var eyeMidY = (eL.y + eR.y) / 2;
    var pitch = D.clamp(((nose.y - eyeMidY) / faceH - 0.24) * 6, -1, 1) * 14;
    faceWidthAvg = faceWidthAvg ? faceWidthAvg * 0.995 + faceW * 0.005 : faceW;
    var lean = D.clamp((faceW / faceWidthAvg - 1) * 6, 0, 1);

    var emo = classifyEmotion(b, { roll: roll, lean: lean });
    var mirror = {
      eyeOpenL: D.clamp(1.05 - raw.eyeBlinkLeft * 1.25 + raw.eyeWideLeft * 0.6, 0.05, 1.35),
      eyeOpenR: D.clamp(1.05 - raw.eyeBlinkRight * 1.25 + raw.eyeWideRight * 0.6, 0.05, 1.35),
      browL: D.clamp(raw.browOuterUpLeft * 1.6 + raw.browInnerUp * 0.8 - raw.browDownLeft * 1.6, -1.2, 1.4),
      browR: D.clamp(raw.browOuterUpRight * 1.6 + raw.browInnerUp * 0.8 - raw.browDownRight * 1.6, -1.2, 1.4),
      smile: D.clamp(avg(raw.mouthSmileLeft, raw.mouthSmileRight) * 1.3 - avg(raw.mouthFrownLeft, raw.mouthFrownRight) * 1.6, -1, 1),
      open: D.clamp(raw.jawOpen * 1.5, 0, 1),
      mWidth: D.clamp(1 + avg(raw.mouthStretchLeft, raw.mouthStretchRight) * 0.8 + avg(raw.mouthSmileLeft, raw.mouthSmileRight) * 0.3 - raw.mouthPucker * 0.7 - raw.mouthFunnel * 0.4, 0.45, 1.45),
      skew: D.clamp((raw.mouthLeft - raw.mouthRight) * 1.6, -1, 1),
      squint: D.clamp(avg(raw.eyeSquintLeft, raw.eyeSquintRight) * 0.5 + avg(raw.cheekSquintLeft, raw.cheekSquintRight) * 0.9, 0, 1),
      gazeX: D.clamp((raw.eyeLookOutLeft - raw.eyeLookInLeft + raw.eyeLookInRight - raw.eyeLookOutRight) * -0.9, -1, 1),
      gazeY: D.clamp((avg(raw.eyeLookDownLeft, raw.eyeLookDownRight) - avg(raw.eyeLookUpLeft, raw.eyeLookUpRight)) * 1.4, -1, 1),
      yaw: yaw, pitch: pitch, roll: D.clamp(roll, -30, 30),
      slant: 0, browTilt: D.clamp(avg(raw.browDownLeft, raw.browDownRight) * 1.4 - raw.browInnerUp * 0.9, -1, 1), browY: 0
    };
    return { landmarks: lm, blend: raw, features: b, emotion: emo, mirror: mirror, pose: { yaw: yaw, pitch: pitch, roll: roll }, lean: lean };
  }

  function calibrated(raw) {
    var out = {}, s = D.settings.get('sensitivity') || 1;
    for (var k in raw) {
      var base = calib && calib[k] != null ? calib[k] : 0;
      var v = (raw[k] - base) / Math.max(0.15, 1 - base);
      out[k] = D.clamp(v * s, 0, 1);
    }
    return out;
  }

  /* Interpretable expression scores from blendshapes (+ pose cues). */
  function classifyEmotion(b, extra) {
    var g = function (k) { return b[k] || 0; };
    var smile = avg(g('mouthSmileLeft'), g('mouthSmileRight'));
    var frown = avg(g('mouthFrownLeft'), g('mouthFrownRight'));
    var browDown = avg(g('browDownLeft'), g('browDownRight'));
    var browInner = g('browInnerUp');
    var browOuter = avg(g('browOuterUpLeft'), g('browOuterUpRight'));
    var jaw = g('jawOpen');
    var wide = avg(g('eyeWideLeft'), g('eyeWideRight'));
    var squint = avg(g('eyeSquintLeft'), g('eyeSquintRight'));
    var cheek = avg(g('cheekSquintLeft'), g('cheekSquintRight'));
    var press = avg(g('mouthPressLeft'), g('mouthPressRight'));
    var sneer = avg(g('noseSneerLeft'), g('noseSneerRight'));
    var pucker = g('mouthPucker');
    var lookUp = avg(g('eyeLookUpLeft'), g('eyeLookUpRight'));
    var lookDown = avg(g('eyeLookDownLeft'), g('eyeLookDownRight'));
    var lookSide = Math.max(avg(g('eyeLookOutLeft'), g('eyeLookInRight')), avg(g('eyeLookInLeft'), g('eyeLookOutRight')));
    var mouthSide = Math.max(g('mouthLeft'), g('mouthRight'));
    var browAsym = Math.abs(g('browOuterUpLeft') - g('browOuterUpRight')) + Math.abs(g('browDownLeft') - g('browDownRight'));
    var shrug = g('mouthShrugLower'), rollLow = g('mouthRollLower');
    var tilt = D.clamp((Math.abs(extra.roll) - 6) / 14, 0, 1);
    var lean = extra.lean || 0;

    var s = {
      neutral: 0.32,
      happy: 1.35 * smile + 0.3 * cheek - 0.7 * Math.max(0, jaw - 0.3) - 0.6 * frown,
      excited: smile > 0.25 ? 0.7 * smile + 1.3 * jaw + 0.5 * wide + 0.3 * browOuter - 0.35 : -1,
      surprised: 1.0 * jaw + 0.9 * wide + 0.7 * browOuter + 0.4 * browInner - 1.3 * smile - 0.25,
      sad: 1.3 * frown + 0.8 * browInner * (1 - browOuter) + 0.45 * shrug + 0.35 * lookDown - 1.1 * smile - 0.12,
      angry: 1.35 * browDown + 0.6 * sneer + 0.45 * press + 0.3 * squint - 0.9 * smile - 0.15,
      thinking: 0.9 * lookUp + 0.55 * lookSide + 0.6 * mouthSide + 0.5 * pucker + 0.35 * press + 0.3 * rollLow - 0.7 * smile - 0.7 * jaw - 0.18,
      confused: 1.5 * browAsym + 0.7 * tilt + 0.35 * mouthSide + 0.3 * browDown * browInner - 0.7 * smile - 0.2,
      eager: 0.6 * browOuter + 0.5 * wide + 0.5 * Math.min(smile, 0.6) + 0.9 * lean - 0.9 * jaw - 0.22
    };
    /* softmax → probabilities */
    var keys = D.EMOTION_KEYS, mx = -1e9, sum = 0, p = {};
    keys.forEach(function (k) { mx = Math.max(mx, s[k]); });
    keys.forEach(function (k) { p[k] = Math.exp((s[k] - mx) * 7); sum += p[k]; });
    var best = 'neutral', bv = 0;
    keys.forEach(function (k) { p[k] /= sum; if (p[k] > bv) { bv = p[k]; best = k; } });
    return { key: best, conf: bv, probs: p, scores: s };
  }

  /* ================================================================ HANDS */
  var GESTURES = {
    thumbs_up:   { label: 'Thumbs up',   emoji: '👍', expr: 'happy',     hint: 'Fist with the thumb pointing up' },
    thumbs_down: { label: 'Thumbs down', emoji: '👎', expr: 'sad',       hint: 'Fist with the thumb pointing down' },
    fist:        { label: 'Fist',        emoji: '✊', expr: 'angry',     hint: 'All fingers closed' },
    open_palm:   { label: 'Open palm',   emoji: '✋', expr: 'neutral',   hint: 'All five fingers spread' },
    point:       { label: 'Point',       emoji: '☝️', expr: 'thinking',  hint: 'Only the index finger out' },
    victory:     { label: 'Victory',     emoji: '✌️', expr: 'excited',   hint: 'Index + middle finger in a V' },
    love:        { label: 'I love you',  emoji: '🤟', expr: 'love',      hint: 'Thumb, index and pinky out' },
    ok:          { label: 'OK',          emoji: '👌', expr: 'eager',     hint: 'Thumb and index touch, others up' },
    call:        { label: 'Call me',     emoji: '🤙', expr: 'confused',  hint: 'Only thumb and pinky out' },
    three:       { label: 'Three',       emoji: '🤟', expr: 'surprised', hint: 'Index, middle and ring finger up' },
    rock:        { label: 'Rock on',     emoji: '🤘', expr: 'excited',   hint: 'Index + pinky out, thumb tucked' }
  };
  GESTURES.three.emoji = '3️⃣';
  var ORDER = ['thumbs_up', 'thumbs_down', 'fist', 'open_palm', 'point', 'victory', 'love', 'ok', 'call', 'three', 'rock'];

  function analyzeHands(res, aspect) {
    var out = [];
    (res.landmarks || []).forEach(function (lm, i) {
      var hd = res.handednesses && res.handednesses[i] && res.handednesses[i][0];
      out.push(classifyHand(lm, aspect, hd ? hd.categoryName : ''));
    });
    return out;
  }
  function classifyHand(lm, aspect, side) {
    function P(i) { return { x: (1 - lm[i].x) * aspect, y: lm[i].y }; }   // mirrored display coords
    function d(a, b) { var p = P(a), q = P(b); return Math.hypot(p.x - q.x, p.y - q.y); }
    var palm = d(0, 9) || 0.001;
    function ext(tip, pip, mcp) {
      var r = d(0, tip) / Math.max(d(0, pip), 0.0001);
      var straight = d(mcp, tip) / (d(mcp, pip) + d(pip, tip) + 1e-6);   // 1 when perfectly straight
      return r > 1.1 && straight > 0.8;
    }
    var f = {
      index: ext(8, 6, 5), middle: ext(12, 10, 9), ring: ext(16, 14, 13), pinky: ext(20, 18, 17)
    };
    f.thumb = d(4, 17) > d(3, 17) * 1.04 && d(4, 5) / palm > 0.42 && d(4, 9) / palm > 0.55;
    var pinch = d(4, 8) / palm < 0.32;
    var n4 = (f.index ? 1 : 0) + (f.middle ? 1 : 0) + (f.ring ? 1 : 0) + (f.pinky ? 1 : 0);
    var key = null;
    var tv = (P(4).y - P(2).y) / palm;     // thumb vertical direction (negative = up)
    if (pinch && f.middle && f.ring && f.pinky) key = 'ok';
    else if (n4 === 0) {
      if (f.thumb && tv < -0.35) key = 'thumbs_up';
      else if (f.thumb && tv > 0.35) key = 'thumbs_down';
      else key = 'fist';
    }
    else if (n4 === 4) key = 'open_palm';
    else if (f.index && !f.middle && !f.ring && !f.pinky) key = 'point';
    else if (f.index && f.middle && !f.ring && !f.pinky) key = 'victory';
    else if (f.index && f.pinky && !f.middle && !f.ring) key = f.thumb ? 'love' : 'rock';
    else if (f.pinky && !f.index && !f.middle && !f.ring) key = f.thumb ? 'call' : null;
    else if (f.index && f.middle && f.ring && !f.pinky) key = 'three';

    /* pointing direction of the index finger (used for driving robots) */
    var a = P(5), t = P(8), dx = t.x - a.x, dy = t.y - a.y, len = Math.hypot(dx, dy) / palm;
    var dir = null;
    if (f.index && len > 0.45) {
      if (Math.abs(dx) > Math.abs(dy) * 1.1) dir = dx > 0 ? 'right' : 'left';
      else if (Math.abs(dy) > Math.abs(dx) * 1.1) dir = dy > 0 ? 'down' : 'up';
    }
    var cx = 0, cy = 0; lm.forEach(function (p) { cx += 1 - p.x; cy += p.y; }); cx /= lm.length; cy /= lm.length;
    return { landmarks: lm, side: side, fingers: f, pinch: pinch, count: n4 + (f.thumb ? 1 : 0), gesture: key, info: key ? GESTURES[key] : null, pointDir: dir, center: { x: cx, y: cy } };
  }

  /* ================================================================ Public API */
  D.vision = {
    GESTURES: GESTURES, GESTURE_ORDER: ORDER,
    get status() { return status; }, get statusMsg() { return statusMsg; },
    get mode() { return mode; }, get running() { return running; },
    last: null,
    supported: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
    start: function (who, m) {
      owner = who || 'app';
      if (m) mode = m;
      setStatus('loading', 'Opening camera…');
      return openCamera().then(function () {
        setStatus('loading', 'Loading ' + (mode === 'face' ? 'face' : 'hand') + ' model…');
        return getLandmarker(mode);
      }).then(function () {
        running = true; lastTs = -1; cancelAnimationFrame(rafId); loop();
        D.$$('video[data-vision]').forEach(function (v) { if (v.srcObject !== stream) { v.srcObject = stream; v.play().catch(function () {}); } });
        setStatus('running', mode === 'face' ? 'Scanning face' : 'Scanning hands');
        return true;
      }).catch(function (e) {
        console.error(e);
        running = false; closeCamera();
        var msg = e && e.name === 'NotAllowedError' ? 'Camera permission was denied.' :
          e && e.name === 'NotFoundError' ? 'No camera found on this computer.' :
          e && e.name === 'NotReadableError' ? 'The camera is busy in another app.' : 'Could not start vision: ' + (e && e.message || e);
        setStatus('error', msg);
        throw new Error(msg);
      });
    },
    setMode: function (m) {
      if (m === mode) return Promise.resolve();
      mode = m;
      if (!running) { D.bus.emit('vision-status', { status: status, msg: statusMsg, mode: mode }); return Promise.resolve(); }
      setStatus('loading', 'Loading ' + (m === 'face' ? 'face' : 'hand') + ' model…');
      return getLandmarker(m).then(function () { setStatus('running', m === 'face' ? 'Scanning face' : 'Scanning hands'); });
    },
    stop: function (who) {
      if (who && owner && who !== owner) return;
      running = false; cancelAnimationFrame(rafId); closeCamera(); owner = null;
      setStatus('idle', 'Camera off');
    },
    owner: function () { return owner; },
    on: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
    attach: function (v) {
      v.setAttribute('data-vision', '1'); v.muted = true; v.playsInline = true;
      if (stream) { v.srcObject = stream; v.play().catch(function () {}); }
    },
    listCameras: function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve([]);
      return navigator.mediaDevices.enumerateDevices().then(function (ds) { return ds.filter(function (d) { return d.kind === 'videoinput'; }); });
    },
    preload: function (m) { return getLandmarker(m || 'face'); },
    calibrate: function () {
      var f = D.vision.last && D.vision.last.face;
      if (!f) return false;
      calib = Object.assign({}, f.blend);
      D.store.set('cv.calibration', calib);
      D.audit.log('echo', 'Calibrated neutral face', 'Baseline captured from ' + Object.keys(calib).length + ' blendshapes', 'success');
      return true;
    },
    clearCalibration: function () { calib = null; D.store.remove('cv.calibration'); },
    isCalibrated: function () { return !!calib; },
    classifyEmotion: classifyEmotion,
    classifyHand: classifyHand,
    /* Draw landmarks over the (mirrored) preview */
    drawOverlay: function (canvas, frame, opts) {
      opts = opts || {};
      var ctx = canvas.getContext('2d');
      var w = canvas.width = canvas.clientWidth * (global.devicePixelRatio || 1);
      var h = canvas.height = canvas.clientHeight * (global.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
      if (!frame || D.settings.get('showLandmarks') === false) return;
      /* object-fit: cover mapping */
      var vw = frame.vw || 16, vh = frame.vh || 9;
      var sc = Math.max(w / vw, h / vh), ox = (w - vw * sc) / 2, oy = (h - vh * sc) / 2;
      function X(p) { return ox + (1 - p.x) * vw * sc; }
      function Y(p) { return oy + p.y * vh * sc; }
      var accent = D.cssVar('--accent') || '#22d3ee';
      if (frame.face && mp) {
        var lm = frame.face.landmarks;
        ctx.lineWidth = 1.5 * (global.devicePixelRatio || 1);
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.9;
        var C = mp.FaceLandmarker.FACE_LANDMARKS_CONTOURS || [];
        ctx.beginPath();
        C.forEach(function (c) { var a = lm[c.start], b = lm[c.end]; ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); });
        ctx.stroke();
        ctx.fillStyle = accent; ctx.globalAlpha = 0.35;
        for (var i = 0; i < lm.length; i += 4) { ctx.fillRect(X(lm[i]) - 1, Y(lm[i]) - 1, 2, 2); }
        ctx.globalAlpha = 1;
      }
      (frame.hands || []).forEach(function (hnd) {
        var L = hnd.landmarks;
        var conns = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
        ctx.lineWidth = 3 * (global.devicePixelRatio || 1); ctx.strokeStyle = accent; ctx.lineCap = 'round';
        ctx.beginPath(); conns.forEach(function (c) { ctx.moveTo(X(L[c[0]]), Y(L[c[0]])); ctx.lineTo(X(L[c[1]]), Y(L[c[1]])); }); ctx.stroke();
        L.forEach(function (p, i) {
          ctx.beginPath(); ctx.arc(X(p), Y(p), (i % 4 === 0 && i ? 6 : 4) * (global.devicePixelRatio || 1), 0, 7);
          ctx.fillStyle = i % 4 === 0 && i ? '#f472b6' : '#fff'; ctx.fill();
        });
        if (hnd.info) {
          var top = L.reduce(function (m, p) { return p.y < m.y ? p : m; }, L[0]);
          ctx.font = 'bold ' + (16 * (global.devicePixelRatio || 1)) + 'px Inter, sans-serif';
          var label = hnd.info.label;
          var tw = ctx.measureText(label).width + 16 * (global.devicePixelRatio || 1);
          var lx = X(top) - tw / 2, ly = Y(top) - 40 * (global.devicePixelRatio || 1);
          ctx.fillStyle = 'rgba(5,10,18,.8)'; ctx.fillRect(lx, ly, tw, 26 * (global.devicePixelRatio || 1));
          ctx.fillStyle = '#fff'; ctx.fillText(label, lx + 8 * (global.devicePixelRatio || 1), ly + 18 * (global.devicePixelRatio || 1));
        }
      });
    }
  };

  /* Debounced gesture helper: reports a gesture only once it is held steady. */
  D.vision.GestureStabilizer = function (holdMs) {
    this.hold = holdMs || D.settings.get('holdMs') || 350;
    this.cand = null; this.since = 0; this.stable = null;
  };
  D.vision.GestureStabilizer.prototype.push = function (key, now) {
    now = now || performance.now();
    if (key !== this.cand) { this.cand = key; this.since = now; }
    if (now - this.since >= this.hold && this.stable !== this.cand) { this.stable = this.cand; return { changed: true, key: this.stable }; }
    return { changed: false, key: this.stable };
  };
})(window);
