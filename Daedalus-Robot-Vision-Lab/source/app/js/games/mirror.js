/* mirror.js — Mirror Me: copy the robot's expression with your own face. */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art;
  var ROUNDS = 10, ROUND_MS = 9000, HOLD_MS = 800;

  function create(host, ctx) {
    var U = D.arcade.util;
    var pool = D.EMOTION_KEYS.filter(function (k) { return k !== 'neutral'; });
    var round = 0, target = null, score = 0, hits = 0, roundStart = 0, holdStart = 0, phase = 'idle', camOK = false, practice = false, raf = 0, off = null, lastFace = null, cooldown = 0;

    var play = D.el('div', { class: 'ar-play' });
    var stage = D.el('div', { class: 'ar-stagewrap' });
    var faceBox = D.el('div', { class: 'g-mirror-face' }); stage.appendChild(faceBox);
    var pill = D.el('div', { class: 'g-mirror-target hidden' }); stage.appendChild(pill);
    var count = D.el('div', { class: 'g-mirror-count' }); stage.appendChild(count);
    var banner = D.el('div', { class: 'ar-banner' }); stage.appendChild(banner);
    var side = D.el('div', { class: 'ar-side' });
    play.appendChild(stage); play.appendChild(side); host.appendChild(play);
    var face = new D.RobotFace(faceBox, { name: 'ECHO' });

    var p = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Your face' })));
    var b = D.el('div', { class: 'panel-body' }); p.appendChild(b); side.appendChild(p);
    var cam = U.cameraBox(); b.appendChild(cam.el);
    var det = D.el('div', { class: 'row small' }); b.appendChild(det);
    b.appendChild(D.el('div', { class: 'small muted', text: 'Match strength (pass the line and hold)' }));
    var meter = D.el('div', { class: 'ar-meter', html: '<i style="width:0%"></i><b></b>' }); b.appendChild(meter);
    var stats = D.el('div', { class: 'ar-stats' }); b.appendChild(stats);
    var pp = D.el('div', { class: 'panel hidden' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Practice without camera' })));
    var pb = D.el('div', { class: 'panel-body' }); pp.appendChild(pb); side.appendChild(pp);
    pb.appendChild(D.el('div', { class: 'small muted', text: 'Which expression is the robot making? Click it.' }));
    var pick = D.el('div', { class: 'g-mirror-pick' }); pb.appendChild(pick);
    pool.forEach(function (k) {
      pick.appendChild(D.el('button', { class: 'btn', title: D.EXPRESSIONS[k].label, text: D.EXPRESSIONS[k].emoji, onclick: function () { if (phase === 'round' && practice) { if (k === target) success(); else { D.sound.bump(); D.ui.toast('Not quite — look at the eyes and mouth.', 'warn', 1500); } } } }));
    });

    function updateStats() {
      stats.innerHTML = '<div class="stat"><div class="k">Round</div><div class="v">' + Math.min(round, ROUNDS) + '/' + ROUNDS + '</div></div><div class="stat"><div class="k">Matched</div><div class="v">' + hits + '</div></div><div class="stat"><div class="k">Score</div><div class="v">' + score + '</div></div>';
    }
    function showBanner(t, msg, btns) {
      banner.innerHTML = ''; banner.appendChild(D.el('h2', { text: t })); banner.appendChild(D.el('p', { html: msg }));
      var row = D.el('div', { class: 'row' }); btns.forEach(function (x) { row.appendChild(x); }); banner.appendChild(row);
      banner.classList.remove('hidden');
    }
    function intro() {
      phase = 'idle'; pill.classList.add('hidden'); count.textContent = '';
      face.setExpression('happy');
      showBanner('Mirror Me', 'Echo will pull a face. Copy it with your own face and <b>hold it</b> until the meter fills. ' + ROUNDS + ' rounds.', [
        D.el('button', { class: 'btn primary lg', html: D.icon('camera') + 'Start with camera', onclick: function () { begin(false); } }),
        D.el('button', { class: 'btn lg', html: D.icon('hand') + 'Practice (no camera)', onclick: function () { begin(true); } })
      ]);
    }
    function begin(noCam) {
      practice = noCam; round = 0; score = 0; hits = 0;
      pp.classList.toggle('hidden', !practice);
      banner.classList.add('hidden');
      if (practice) { cam.note.textContent = 'Practice mode — camera off'; D.vision.stop('game-mirror'); nextRound(); return; }
      cam.note.textContent = 'Starting camera…';
      D.vision.attach(cam.video);
      D.vision.start('game-mirror', 'face').then(function () { camOK = true; cam.note.textContent = ''; nextRound(); }).catch(function (e) {
        camOK = false; cam.note.textContent = e.message;
        showBanner('Camera unavailable', D.esc(e.message) + '<br>You can still play the practice version.', [D.el('button', { class: 'btn primary', html: D.icon('hand') + 'Practice (no camera)', onclick: function () { begin(true); } })]);
      });
      D.audit.log('arcade', 'Mirror Me started', practice ? 'practice' : 'camera');
    }
    function nextRound() {
      round++;
      if (round > ROUNDS) return finish();
      var prev = target;
      do { target = pool[Math.floor(Math.random() * pool.length)]; } while (target === prev);
      face.setExpression(target); face.say(D.EXPRESSIONS[target].line, 2200);
      pill.innerHTML = '<span class="em">' + D.EXPRESSIONS[target].emoji + '</span>Make it: ' + D.EXPRESSIONS[target].label;
      pill.style.borderColor = D.EXPRESSIONS[target].color;
      pill.classList.remove('hidden');
      phase = 'round'; roundStart = performance.now(); holdStart = 0;
      updateStats();
    }
    function success() {
      var left = Math.max(0, ROUND_MS - (performance.now() - roundStart));
      var pts = 100 + Math.round(left / 100);
      score += pts; hits++; D.sound.good();
      face.say('Match! +' + pts, 1200);
      D.audit.log('arcade', 'Mirror Me match', D.EXPRESSIONS[target].label + ' +' + pts, 'success');
      phase = 'cool'; cooldown = performance.now();
      updateStats();
    }
    function miss() {
      D.sound.bad(); face.say('Time! That was ' + D.EXPRESSIONS[target].label + '.', 1400);
      phase = 'cool'; cooldown = performance.now();
    }
    function finish() {
      phase = 'done'; pill.classList.add('hidden'); count.textContent = '';
      face.setExpression(hits >= 7 ? 'excited' : hits >= 4 ? 'happy' : 'sad');
      ctx.reportScore(score, hits + '/' + ROUNDS + ' matched' + (practice ? ' · practice' : ''));
      showBanner(hits >= 7 ? 'Expression master!' : 'Game over', 'You matched <b>' + hits + '</b> of ' + ROUNDS + ' expressions. Score <b>' + score + '</b>.', [
        D.el('button', { class: 'btn primary', html: D.icon('reset') + 'Play again', onclick: function () { begin(practice); } }),
        D.el('button', { class: 'btn', text: 'Menu', onclick: intro })
      ]);
    }

    off = D.vision.on(function (f) {
      if (!f.face && f.mode !== 'face') return;
      lastFace = f.face;
      D.vision.drawOverlay(cam.canvas, f);
    });

    function loop() {
      raf = requestAnimationFrame(loop);
      var now = performance.now();
      var f = lastFace;
      if (f && f.emotion) {
        var e = f.emotion;
        det.innerHTML = 'You look: <b>' + D.EXPRESSIONS[e.key].emoji + ' ' + D.EXPRESSIONS[e.key].label + '</b> <span class="faint">(' + Math.round(e.conf * 100) + '%)</span>';
      } else if (!practice) det.innerHTML = '<span class="faint">' + (camOK ? 'Looking for your face…' : '') + '</span>';
      else det.innerHTML = '';
      if (phase === 'round') {
        var left = ROUND_MS - (now - roundStart);
        count.textContent = Math.max(0, Math.ceil(left / 1000));
        var strength = 0;
        if (!practice && f && f.emotion) {
          strength = f.emotion.probs[target] || 0;
          if (f.emotion.key === target) strength = Math.max(strength, 0.6);
        }
        var ok = strength >= 0.55;
        if (ok) { if (!holdStart) holdStart = now; } else holdStart = 0;
        var holdK = holdStart ? Math.min(1, (now - holdStart) / HOLD_MS) : 0;
        meter.querySelector('i').style.width = Math.round(Math.min(1, strength) * 100) + '%';
        meter.querySelector('i').style.background = holdK > 0 ? 'linear-gradient(90deg, var(--green), var(--green))' : '';
        if (holdK >= 1) success();
        else if (left <= 0) miss();
      } else if (phase === 'cool') {
        count.textContent = '';
        if (now - cooldown > 1300) nextRound();
      }
    }
    var offTheme = D.bus.on('theme', function () {});
    updateStats(); intro(); loop();

    return {
      destroy: function () { cancelAnimationFrame(raf); if (off) off(); offTheme(); face.destroy(); D.vision.stop('game-mirror'); },
      _test: { begin: begin, state: function () { return { phase: phase, round: round, target: target, score: score, hits: hits }; }, pickCorrect: function () { if (phase === 'round') success(); } }
    };
  }

  var g = A.wrap;
  D.arcade.register({
    id: 'mirror', title: 'Mirror Me', tagline: 'Echo pulls a face — you copy it. Computer vision reads your expression live.',
    icon: 'face', color: '--violet', cv: 'face', controls: 'Your face',
    guide: {
      howto: [
        { title: 'Face the camera', text: 'Sit about an arm’s length away in good light. Only the <b>face model</b> runs in this game.', svg: g('<rect x="35" y="15" width="80" height="60" rx="8" fill="#000"/>' + A.face(75, 46, 20, 'neutral') + A.text(42, 92, 'good light · centred', 9)) },
        { title: 'See the target', text: 'Echo shows an expression and a label like <b>“Make it: Surprised”</b>.', svg: g(A.face(75, 56, 26, 'surprised') + '<rect x="30" y="8" width="90" height="18" rx="9" fill="var(--surface)" stroke="var(--line-2)"/>' + A.text(42, 21, '😲 Make it: Surprised', 8.5, 'var(--text)', 700)) },
        { title: 'Copy and hold', text: 'Make the same expression. When the match meter passes the line, <b>hold it for a moment</b> to score.', svg: g('<rect x="20" y="44" width="110" height="12" rx="6" fill="var(--surface-3)"/><rect x="20" y="44" width="80" height="12" rx="6" fill="var(--green)"/><rect x="80" y="40" width="2" height="20" fill="var(--text)"/>' + A.text(20, 34, 'match strength', 9)) },
        { title: 'Beat the clock', text: 'Each round lasts ' + (ROUND_MS / 1000) + ' seconds. Faster matches earn bonus points. 10 rounds per game.', svg: g('<circle cx="75" cy="52" r="30" fill="none" stroke="var(--accent)" stroke-width="5" stroke-dasharray="140 60"/>' + A.text(66, 59, '7', 20, 'var(--accent)', 700)) },
        { title: 'No camera?', text: 'Choose <b>Practice</b>: recognise the robot’s face and click the matching emoji instead.', svg: g(A.btn(30, 40, 90, 'Practice (no camera)')) }
      ],
      tips: 'Exaggerate! Big eyebrows and a wide mouth are easier for the model. Calibrate your neutral face in Echo for better accuracy.',
      about: {
        hero: '<svg viewBox="0 0 560 150"><rect width="560" height="150" fill="var(--bg-2)"/><g transform="translate(40 20)"><rect width="150" height="110" rx="12" fill="#000"/><circle cx="75" cy="55" r="34" fill="none" stroke="var(--accent)" stroke-dasharray="3 3"/></g><path d="M210 75h70" stroke="var(--accent)" stroke-width="3" stroke-dasharray="6 4"/><g transform="translate(300 25)"><rect width="110" height="100" rx="12" fill="var(--surface)" stroke="var(--line)"/><text x="12" y="30" font-size="11" fill="var(--text-2)">52 blendshapes</text><text x="12" y="52" font-size="11" fill="var(--text-2)">→ 9 expressions</text><text x="12" y="74" font-size="11" fill="var(--green)">score: 0.82</text></g><path d="M420 75h40" stroke="var(--accent)" stroke-width="3"/><circle cx="500" cy="75" r="30" fill="var(--violet)" opacity=".3"/><text x="487" y="84" font-size="26">😄</text></svg>',
        intro: 'Mirror Me turns facial-expression recognition into a game. MediaPipe’s Face Landmarker tracks 478 points on your face and estimates 52 “blendshape” muscle movements, which Daedalus combines into nine expressions.',
        facts: [['478', 'face landmarks'], ['52', 'blendshapes'], ['9', 'expressions']],
        sections: [
          { title: 'How a match is decided', html: '<p>Every frame the classifier gives a probability for each expression. When the target’s probability stays above the line for 0.8 s, the round is yours.</p>' },
          { title: 'Privacy', html: '<p>Video frames are processed in memory on this computer and are never saved or sent anywhere. Only the result (e.g. “Happy · 0.82”) is used.</p>' },
          { title: 'Scoring', html: '<p>100 points per match plus a speed bonus of 1 point for every 100 ms left on the clock.</p>' }
        ]
      }
    },
    create: create
  });
})(window);
