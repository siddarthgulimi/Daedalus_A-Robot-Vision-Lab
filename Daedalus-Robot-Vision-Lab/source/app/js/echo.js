/* echo.js — ECHO · Vision robot
   The camera watches either your FACE or your HANDS (never both — chosen with the big slider).
   FACE  → 52 facial blendshapes → (a) mirrored live onto the robot's eyes, brows, mouth & head pose
                                 → (b) classified into 9 expressions (happy, sad, angry, surprised,
                                       thinking, confused, excited, eager, neutral)
   HANDS → 21 hand landmarks → finger states → 11 gestures → mapped (customisable) to expressions */
(function (global) {
  'use strict';
  var D = global.D;

  var S = {
    mode: D.store.get('echo.mode', 'face'), mirror: D.store.get('echo.mirror', true), cam: false,
    expr: 'neutral', exprSince: performance.now(), stats: {}, gestureStats: {}, sessionStart: 0,
    map: Object.assign({}, defaultMap(), D.store.get('echo.gestureMap', {})), timeline: [], lastGesture: null
  };
  var els = {}, face, unsub = null, stab = null, smooth = {}, lastSwitch = 0, lastNoHand = 0, tlTimer = 0;

  function defaultMap() { var m = {}; D.vision.GESTURE_ORDER.forEach(function (g) { m[g] = D.vision.GESTURES[g].expr; }); return m; }

  function mount(root) {
    root.appendChild(D.ui.pageHead({
      title: 'Echo', tag: 'Vision robot', badge: D.avatar('echo'), guide: 'echo',
      sub: 'Echo copies your face or reacts to your hand gestures — all computer vision, running offline on this computer.'
    }));
    var body = D.el('div', { class: 'page-body fill' });
    root.appendChild(body);
    var grid = D.el('div', { class: 'ec-grid' });
    body.appendChild(grid);

    /* ---------- left: camera + controls ---------- */
    var left = D.el('div', { class: 'ec-col' });
    els.slider = D.el('div', { class: 'mode-slider', dataset: { mode: S.mode }, role: 'switch', tabindex: '0', title: 'Choose what the camera scans' },
      D.el('div', { class: 'knob' }),
      D.el('div', { class: 'opt face', html: D.icon('face') + 'FACE' }),
      D.el('div', { class: 'opt hands', html: D.icon('hand') + 'HANDS' }));
    els.slider.addEventListener('click', function (e) {
      var r = els.slider.getBoundingClientRect();
      setMode(e.clientX - r.left < r.width / 2 ? 'face' : 'hands');
    });
    els.slider.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') setMode('face'); if (e.key === 'ArrowRight') setMode('hands'); if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setMode(S.mode === 'face' ? 'hands' : 'face'); } });
    var sliderCard = D.el('div', { class: 'panel ec-slider-card' },
      D.el('div', { class: 'row', style: { marginBottom: '8px' } }, D.el('span', { class: 'eyebrow', text: 'What should I scan?' })),
      els.slider,
      els.modeNote = D.el('p', { class: 'small muted', style: { margin: '8px 2px 0' } }));
    left.appendChild(sliderCard);

    var camCard = D.el('div', { class: 'panel ec-cam-card' });
    els.camBox = D.el('div', { class: 'ec-cam' });
    els.video = D.el('video', { autoplay: true, muted: true, playsinline: true });
    els.overlay = D.el('canvas', { class: 'ec-ov' });
    els.camOff = D.el('div', { class: 'ec-camoff', html: D.icon('cameraOff') + '<b>Camera is off</b><span>Press <b>Start camera</b>. Video never leaves this computer.</span>' });
    els.camBox.appendChild(els.video); els.camBox.appendChild(els.overlay); els.camBox.appendChild(els.camOff);
    els.hud = D.el('div', { class: 'ec-hud' });
    els.camBox.appendChild(els.hud);
    camCard.appendChild(els.camBox);
    var camBar = D.el('div', { class: 'ec-cam-bar' });
    els.camBtn = D.el('button', { class: 'btn primary', html: D.icon('camera') + 'Start camera', onclick: toggleCamera });
    camBar.appendChild(els.camBtn);
    els.calBtn = D.el('button', { class: 'btn sm', html: D.icon('target') + 'Calibrate', title: 'Keep a relaxed, neutral face and click — Echo learns your resting face for better accuracy', onclick: calibrate });
    camBar.appendChild(els.calBtn);
    camCard.appendChild(camBar);
    var opts = D.el('div', { class: 'ec-opts' });
    els.mirrorSw = D.ui.switchEl(S.mirror, function (v) { S.mirror = v; D.store.set('echo.mirror', v); if (!v) face.setMirror(null); D.audit.log('echo', 'Mirror motion ' + (v ? 'on' : 'off'), ''); });
    els.mirrorRow = D.el('label', { class: 'row small', title: 'Copy your eye blinks, brows, mouth and head tilt live' }, els.mirrorSw, D.el('span', { text: 'Mirror my facial motion' }));
    opts.appendChild(els.mirrorRow);
    var lmSw = D.ui.switchEl(D.settings.get('showLandmarks') !== false, function (v) { D.settings.set('showLandmarks', v); });
    opts.appendChild(D.el('label', { class: 'row small' }, lmSw, D.el('span', { text: 'Show tracking points' })));
    camCard.appendChild(opts);
    left.appendChild(camCard);
    grid.appendChild(left);

    /* ---------- center: robot ---------- */
    var center = D.el('div', { class: 'panel ec-robot' });
    var rh = D.el('div', { class: 'ec-robot-head' });
    els.exprChip = D.el('div', { class: 'ec-expr' });
    rh.appendChild(els.exprChip);
    rh.appendChild(D.el('div', { class: 'spacer' }));
    els.srcChip = D.el('span', { class: 'chip', text: 'manual' });
    rh.appendChild(els.srcChip);
    center.appendChild(rh);
    els.faceHost = D.el('div', { class: 'ec-face' });
    center.appendChild(els.faceHost);
    els.line = D.el('div', { class: 'ec-line' });
    center.appendChild(els.line);
    els.tl = D.el('div', { class: 'ec-timeline', title: 'Last 60 seconds of expressions' });
    center.appendChild(els.tl);
    var lib = D.el('div', { class: 'ec-lib' });
    ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'confused', 'excited', 'eager', 'love', 'sleepy'].forEach(function (k) {
      var X = D.EXPRESSIONS[k];
      lib.appendChild(D.el('button', { class: 'ec-libbtn', style: { '--ec': X.color }, title: 'Preview ' + X.label, html: '<span>' + X.emoji + '</span>' + X.label, onclick: function () { manual(k); } }));
    });
    center.appendChild(lib);
    grid.appendChild(center);

    /* ---------- right: analysis ---------- */
    var right = D.el('div', { class: 'panel ec-analysis' });
    els.anaHead = D.el('div', { class: 'panel-head' });
    right.appendChild(els.anaHead);
    els.ana = D.el('div', { class: 'ec-ana-body' });
    right.appendChild(els.ana);
    grid.appendChild(right);

    face = new D.RobotFace(els.faceHost, { name: 'ECHO' });
    D.vision.attach(els.video);
    applyMode(true);
    setExpr('neutral', 'manual', true);
    D.bus.on('vision-status', onStatus);
    D.bus.on('settings', function (e) { if (e.key === 'showLandmarks' && !e.value) els.overlay.getContext('2d').clearRect(0, 0, 9999, 9999); });
  }

  function show() { tlTimer = setInterval(renderTimeline, 1000); renderTimeline(); }
  function hide() {
    clearInterval(tlTimer);
    if (S.cam) stopCamera();
  }

  /* ---------------------------------------------------------------- mode */
  function setMode(m) {
    if (m === S.mode) return;
    S.mode = m; D.store.set('echo.mode', m);
    els.slider.dataset.mode = m;
    D.sound.beep(m === 'face' ? 620 : 820, 0.06, 'sine', 0.05);
    D.audit.log('echo', 'Scan mode → ' + (m === 'face' ? 'Face' : 'Hands'), m === 'face' ? 'Only the face model runs now' : 'Only the hand model runs now');
    applyMode();
    if (S.cam) D.vision.setMode(m).catch(function (e) { D.ui.toast(e.message, 'bad'); });
    face.setMirror(null); stab = new D.vision.GestureStabilizer();
    els.overlay.getContext('2d').clearRect(0, 0, 9999, 9999);
  }
  function applyMode() {
    var fm = S.mode === 'face';
    els.modeNote.innerHTML = fm ? 'Scanning <b>only your face</b>. Hands are ignored. Echo mirrors you and reads your expression.' : 'Scanning <b>only your hands</b>. Your face is ignored. Each gesture sets Echo’s expression.';
    els.mirrorRow.style.display = fm ? '' : 'none';
    els.calBtn.style.display = fm ? '' : 'none';
    els.anaHead.innerHTML = '<span class="eyebrow">' + (fm ? 'Expression analysis' : 'Gesture chart') + '</span>' + (fm ? '<span class="chip small" id="ecCal">' + (D.vision.isCalibrated() ? 'calibrated' : 'not calibrated') + '</span>' : '<button class="btn xs ghost" id="ecResetMap">Reset mapping</button>');
    var rb = D.$('#ecResetMap', els.anaHead);
    if (rb) rb.onclick = function () { S.map = defaultMap(); D.store.set('echo.gestureMap', {}); renderAnalysis(); D.audit.log('echo', 'Reset gesture mapping', ''); };
    renderAnalysis();
  }

  /* ---------------------------------------------------------------- camera */
  function toggleCamera() { if (S.cam) stopCamera(); else startCamera(); }
  function startCamera() {
    els.camBtn.disabled = true; els.camBtn.innerHTML = D.icon('camera') + 'Starting…';
    D.vision.start('echo', S.mode).then(function () {
      S.cam = true; S.sessionStart = Date.now(); S.stats = {}; S.gestureStats = {};
      els.camBtn.disabled = false; els.camBtn.className = 'btn danger'; els.camBtn.innerHTML = D.icon('cameraOff') + 'Stop camera';
      els.camOff.classList.add('hidden');
      D.vision.attach(els.video);
      stab = new D.vision.GestureStabilizer();
      unsub = D.vision.on(onFrame);
      D.audit.log('echo', 'Camera started', 'Mode: ' + S.mode, 'success');
      if (S.mode === 'face' && !D.vision.isCalibrated()) D.ui.toast('Tip: relax your face and press <b>Calibrate</b> for the most accurate expressions.', '', 5000);
    }).catch(function (e) {
      els.camBtn.disabled = false; els.camBtn.className = 'btn primary'; els.camBtn.innerHTML = D.icon('camera') + 'Start camera';
      els.camOff.classList.remove('hidden');
      els.camOff.innerHTML = D.icon('cameraOff') + '<b>' + D.esc(e.message) + '</b><span>You can still explore: click the expression buttons under the robot, or the gesture chart.</span>';
      D.audit.log('echo', 'Camera failed', e.message, 'error');
      D.ui.toast(e.message, 'bad', 5000);
    });
  }
  function stopCamera() {
    if (unsub) unsub(); unsub = null;
    D.vision.stop('echo');
    S.cam = false;
    els.camBtn.className = 'btn primary'; els.camBtn.innerHTML = D.icon('camera') + 'Start camera';
    els.camOff.classList.remove('hidden');
    els.camOff.innerHTML = D.icon('cameraOff') + '<b>Camera is off</b><span>Press <b>Start camera</b>. Video never leaves this computer.</span>';
    els.hud.innerHTML = '';
    face.setMirror(null);
    els.overlay.getContext('2d').clearRect(0, 0, 9999, 9999);
    logSession();
  }
  function onStatus(s) {
    if (!els.hud) return;
    if (s.status === 'loading') els.hud.innerHTML = '<span class="chip amber"><span class="dot pulse"></span>' + D.esc(s.msg) + '</span>';
  }
  function logSession() {
    if (!S.sessionStart) return;
    accumulate();
    var dur = Date.now() - S.sessionStart;
    var dist = {}, total = 0;
    for (var k in S.stats) total += S.stats[k];
    for (var k2 in S.stats) dist[k2] = Math.round(S.stats[k2] / Math.max(1, total) * 100);
    var top = Object.keys(S.stats).sort(function (a, b) { return S.stats[b] - S.stats[a]; })[0];
    D.audit.log('echo', 'Vision session summary', D.fmtDur(dur) + ' · mostly ' + (top ? D.EXPRESSIONS[top].label : '—') + ' · gestures: ' + Object.keys(S.gestureStats).length, 'info', { duration: dur, expressions: S.stats, gestures: S.gestureStats, mode: S.mode });
    S.sessionStart = 0;
  }
  function calibrate() {
    if (!S.cam || S.mode !== 'face') { D.ui.toast('Start the camera in FACE mode first.', 'warn'); return; }
    if (D.vision.calibrate()) {
      D.ui.toast('Calibrated! Echo now measures expressions relative to your neutral face.', 'good');
      var c = D.$('#ecCal'); if (c) { c.textContent = 'calibrated'; c.className = 'chip small green'; }
    } else D.ui.toast('No face found — look at the camera and try again.', 'warn');
  }

  /* ---------------------------------------------------------------- frames */
  function onFrame(f) {
    if (D.router.current() !== 'echo') return;
    D.vision.drawOverlay(els.overlay, f);
    if (f.mode === 'face') {
      var fi = f.face;
      if (!fi) { els.hud.innerHTML = '<span class="chip amber">' + D.icon('face') + 'No face — look at the camera</span>'; if (performance.now() - lastNoHand > 4000) setExpr('sleepy', 'no face'); return; }
      lastNoHand = performance.now();
      els.hud.innerHTML = '<span class="chip green"><span class="dot pulse"></span>Face locked · ' + Math.round(f.fps) + ' fps</span>';
      /* smooth probabilities */
      var p = fi.emotion.probs;
      D.EMOTION_KEYS.forEach(function (k) { smooth[k] = smooth[k] == null ? p[k] : smooth[k] * 0.7 + p[k] * 0.3; });
      var best = 'neutral', bv = -1;
      D.EMOTION_KEYS.forEach(function (k) { if (smooth[k] > bv) { bv = smooth[k]; best = k; } });
      var now = performance.now();
      if (best !== S.expr && (smooth[best] - (smooth[S.expr] || 0) > 0.08) && now - lastSwitch > 300) { lastSwitch = now; setExpr(best, 'face'); }
      if (S.mirror) face.setMirror(fi.mirror); else face.setMirror(null);
      updateFaceAnalysis(fi);
    } else {
      var h = f.hands[0];
      if (!h) {
        els.hud.innerHTML = '<span class="chip amber">' + D.icon('hand') + 'Show a hand to the camera</span>';
        stab.push(null);
        if (performance.now() - lastNoHand > 6000 && S.expr !== 'sleepy') setExpr('sleepy', 'no hand');
        updateHandAnalysis(null);
        return;
      }
      lastNoHand = performance.now();
      els.hud.innerHTML = '<span class="chip green"><span class="dot pulse"></span>' + (f.hands.length > 1 ? '2 hands' : (h.side || '') + ' hand') + ' · ' + Math.round(f.fps) + ' fps</span>';
      var r = stab.push(h.gesture);
      if (r.changed && r.key) {
        var ex = S.map[r.key] || 'neutral';
        setExpr(ex, 'gesture');
        S.gestureStats[r.key] = (S.gestureStats[r.key] || 0) + 1;
        D.sound.beep(760, 0.05, 'sine', 0.04);
        D.audit.log('echo', 'Gesture recognised', D.vision.GESTURES[r.key].emoji + ' ' + D.vision.GESTURES[r.key].label + ' → ' + D.EXPRESSIONS[ex].label, 'info', { gesture: r.key, expr: ex });
      }
      updateHandAnalysis(h);
    }
  }

  function accumulate() {
    var now = performance.now();
    if (S.cam) S.stats[S.expr] = (S.stats[S.expr] || 0) + (now - S.exprSince);
    S.exprSince = now;
  }
  function setExpr(k, src, quiet) {
    accumulate();
    var prev = S.expr;
    S.expr = k;
    face.setExpression(k);
    var X = D.EXPRESSIONS[k];
    els.exprChip.innerHTML = '<span class="em">' + X.emoji + '</span><div><div class="eyebrow">Echo feels</div><b style="color:' + X.color + '">' + X.label + '</b></div>';
    els.line.textContent = '“' + X.line + '”';
    els.srcChip.textContent = src === 'face' ? 'from your face' : src === 'gesture' ? 'from your gesture' : src === 'no face' || src === 'no hand' ? 'idle' : 'manual preview';
    els.srcChip.className = 'chip ' + (src === 'face' ? 'violet' : src === 'gesture' ? 'accent' : '');
    S.timeline.push({ t: Date.now(), k: k });
    if (S.timeline.length > 400) S.timeline.shift();
    if (!quiet && prev !== k && src === 'face') {
      /* log meaningful expression changes only (avoid flooding) */
      clearTimeout(setExpr._t);
      setExpr._t = setTimeout(function () { if (S.expr === k) D.audit.log('echo', 'Expression detected', X.emoji + ' ' + X.label, 'info', { expr: k }); }, 1200);
    }
    renderTimeline();
  }
  function manual(k) {
    if (S.cam && S.mode === 'face' && S.mirror) face.setMirror(null);
    setExpr(k, 'manual');
    face.say(D.EXPRESSIONS[k].line, 2200);
    D.audit.log('echo', 'Previewed expression', D.EXPRESSIONS[k].label);
  }

  /* ---------------------------------------------------------------- analysis panels */
  function renderAnalysis() {
    var b = els.ana; b.innerHTML = '';
    if (S.mode === 'face') {
      b.appendChild(D.el('div', { class: 'ec-sub', text: 'How confident Echo is about each expression' }));
      els.bars = D.el('div', { class: 'bars' });
      D.EMOTION_KEYS.forEach(function (k) {
        var X = D.EXPRESSIONS[k];
        var row = D.el('div', { class: 'bar-row', dataset: { k: k } },
          D.el('span', { class: 'lbl', html: X.emoji + ' ' + X.label }),
          D.el('div', { class: 'track' }, D.el('div', { class: 'fill', style: { width: '0%', background: X.color } })),
          D.el('span', { class: 'num', text: '0%' }));
        els.bars.appendChild(row);
      });
      b.appendChild(els.bars);
      b.appendChild(D.el('div', { class: 'ec-sub', style: { marginTop: '16px' }, text: 'Facial signals (what the camera measures)' }));
      els.sig = D.el('div', { class: 'ec-signals' });
      [['smile', 'Smile'], ['frown', 'Frown'], ['brows', 'Brows up'], ['browDown', 'Brows down'], ['jaw', 'Mouth open'], ['eyes', 'Eyes wide'], ['blink', 'Blink'], ['tilt', 'Head tilt']].forEach(function (s) {
        els.sig.appendChild(D.el('div', { class: 'ec-sig', dataset: { k: s[0] } }, D.el('span', { text: s[1] }), D.el('div', { class: 'ec-sig-bar' }, D.el('i')), D.el('b', { text: '–' })));
      });
      b.appendChild(els.sig);
      b.appendChild(D.el('div', { class: 'callout', style: { marginTop: '14px' }, html: D.icon('info') + '<div>Try: big smile → <b>Happy</b>, smile + open mouth → <b>Excited</b>, raise brows + open mouth → <b>Surprised</b>, frown → <b>Sad</b>, lower brows → <b>Angry</b>, one brow up / tilt head → <b>Confused</b>, look up + purse lips → <b>Thinking</b>, lean in + raise brows → <b>Eager</b>.</div>' }));
    } else {
      els.gBig = D.el('div', { class: 'ec-gbig', html: '<span class="em">🖐️</span><div><div class="eyebrow">Detected gesture</div><b>—</b></div>' });
      b.appendChild(els.gBig);
      els.fingers = D.el('div', { class: 'ec-fingers' });
      ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach(function (f) { els.fingers.appendChild(D.el('div', { class: 'ec-finger', dataset: { f: f } }, D.el('i'), D.el('span', { text: f }))); });
      b.appendChild(els.fingers);
      b.appendChild(D.el('div', { class: 'ec-sub', style: { marginTop: '12px' }, text: 'Gesture → expression chart · click a card to try it, change the dropdown to remap' }));
      var chart = D.el('div', { class: 'ec-chart' });
      D.vision.GESTURE_ORDER.forEach(function (g) {
        var G = D.vision.GESTURES[g];
        var sel = D.el('select', { class: 'ec-map' });
        Object.keys(D.EXPRESSIONS).forEach(function (k) { sel.appendChild(D.el('option', { value: k, text: D.EXPRESSIONS[k].emoji + ' ' + D.EXPRESSIONS[k].label })); });
        sel.value = S.map[g];
        sel.onclick = function (e) { e.stopPropagation(); };
        sel.onchange = function () {
          S.map[g] = sel.value; var custom = {}; for (var k in S.map) if (S.map[k] !== D.vision.GESTURES[k].expr) custom[k] = S.map[k];
          D.store.set('echo.gestureMap', custom);
          D.audit.log('echo', 'Remapped gesture', G.label + ' → ' + D.EXPRESSIONS[sel.value].label);
        };
        var card = D.el('div', { class: 'ec-gcard', dataset: { g: g }, title: G.hint },
          D.el('div', { class: 'em', text: G.emoji }),
          D.el('div', { class: 'gl' }, D.el('b', { text: G.label }), D.el('small', { text: G.hint })),
          sel);
        card.onclick = function () { setExpr(S.map[g], 'manual'); face.say(G.emoji + ' → ' + D.EXPRESSIONS[S.map[g]].label, 1800); D.audit.log('echo', 'Tried gesture from chart', G.label); };
        chart.appendChild(card);
      });
      b.appendChild(chart);
    }
  }
  function updateFaceAnalysis(fi) {
    if (!els.bars) return;
    var best = S.expr;
    D.$$('.bar-row', els.bars).forEach(function (row) {
      var k = row.dataset.k, v = smooth[k] || 0;
      row.querySelector('.fill').style.width = (v * 100).toFixed(1) + '%';
      row.querySelector('.num').textContent = Math.round(v * 100) + '%';
      row.classList.toggle('top', k === best);
    });
    var b = fi.blend;
    var sig = {
      smile: (b.mouthSmileLeft + b.mouthSmileRight) / 2, frown: (b.mouthFrownLeft + b.mouthFrownRight) / 2,
      brows: Math.max(b.browInnerUp, (b.browOuterUpLeft + b.browOuterUpRight) / 2), browDown: (b.browDownLeft + b.browDownRight) / 2,
      jaw: b.jawOpen, eyes: (b.eyeWideLeft + b.eyeWideRight) / 2, blink: (b.eyeBlinkLeft + b.eyeBlinkRight) / 2, tilt: Math.min(1, Math.abs(fi.pose.roll) / 25)
    };
    D.$$('.ec-sig', els.sig).forEach(function (r) { var v = D.clamp(sig[r.dataset.k] || 0, 0, 1); r.querySelector('i').style.width = (v * 100) + '%'; r.querySelector('b').textContent = Math.round(v * 100); });
  }
  function updateHandAnalysis(h) {
    if (!els.gBig) return;
    if (!h) { els.gBig.innerHTML = '<span class="em">🖐️</span><div><div class="eyebrow">Detected gesture</div><b class="faint">no hand</b></div>'; D.$$('.ec-finger', els.fingers).forEach(function (x) { x.classList.remove('on'); }); D.$$('.ec-gcard.live').forEach(function (x) { x.classList.remove('live'); }); return; }
    var G = h.info;
    els.gBig.innerHTML = '<span class="em">' + (G ? G.emoji : '✋') + '</span><div><div class="eyebrow">Detected gesture · ' + h.count + ' finger' + (h.count === 1 ? '' : 's') + ' up</div><b>' + (G ? G.label + ' → ' + D.EXPRESSIONS[S.map[h.gesture]].label : 'Unknown shape') + '</b></div>';
    D.$$('.ec-finger', els.fingers).forEach(function (x) { x.classList.toggle('on', !!h.fingers[x.dataset.f]); });
    D.$$('.ec-gcard', els.ana).forEach(function (x) { x.classList.toggle('live', x.dataset.g === h.gesture); });
  }
  function renderTimeline() {
    if (!els.tl) return;
    var now = Date.now(), span = 60000, segs = [];
    var tl = S.timeline.filter(function (e, i) { var next = S.timeline[i + 1]; return !next || next.t > now - span; });
    tl.forEach(function (e, i) {
      var a = Math.max(e.t, now - span), b = i + 1 < tl.length ? tl[i + 1].t : now;
      if (b <= a) return;
      segs.push('<i style="left:' + ((a - (now - span)) / span * 100) + '%;width:' + ((b - a) / span * 100) + '%;background:' + D.EXPRESSIONS[e.k].color + '" title="' + D.EXPRESSIONS[e.k].label + '"></i>');
    });
    els.tl.innerHTML = segs.join('') + '<span class="l">60s ago</span><span class="r">now</span>';
  }

  D.router.register('echo', { title: 'Echo · Vision Robot', icon: 'echo', mount: mount, show: show, hide: hide });
  global.addEventListener('beforeunload', function () { if (S.cam) logSession(); });
})(window);
