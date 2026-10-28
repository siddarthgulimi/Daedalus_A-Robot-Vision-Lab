/* simon.js — Gesture Simon: repeat the robot's gesture sequence with your hand. */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art;
  var SET = ['thumbs_up', 'open_palm', 'fist', 'victory', 'point', 'love'];

  function create(host, ctx) {
    var U = D.arcade.util, G = D.vision.GESTURES;
    var seq = [], pos = 0, phase = 'idle', level = 0, timers = [], off = null, stab = new D.vision.GestureStabilizer(450), camOK = false, raf = 0;

    var play = D.el('div', { class: 'ar-play' });
    var stage = D.el('div', { class: 'ar-stagewrap g-simon-stage' });
    var faceBox = D.el('div', { class: 'g-simon-face' }); stage.appendChild(faceBox);
    var big = D.el('div', { class: 'g-simon-big' }); stage.appendChild(big);
    var status = D.el('div', { class: 'chip accent', text: 'Ready' }); stage.appendChild(status);
    var seqEl = D.el('div', { class: 'g-simon-seq' }); stage.appendChild(seqEl);
    var banner = D.el('div', { class: 'ar-banner' }); stage.appendChild(banner);
    var side = D.el('div', { class: 'ar-side' });
    play.appendChild(stage); play.appendChild(side); host.appendChild(play);
    var face = new D.RobotFace(faceBox, { name: 'SIMON' });

    var p = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Your hand' })));
    var b = D.el('div', { class: 'panel-body' }); p.appendChild(b); side.appendChild(p);
    var cam = U.cameraBox(); b.appendChild(cam.el);
    var det = D.el('div', { class: 'small' }); b.appendChild(det);
    var stats = D.el('div', { class: 'ar-stats' }); b.appendChild(stats);
    var pp = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Or click' })));
    var pb = D.el('div', { class: 'panel-body' }); pp.appendChild(pb); side.appendChild(pp);
    var pad = D.el('div', { class: 'g-simon-pad' }); pb.appendChild(pad);
    SET.forEach(function (k) { pad.appendChild(D.el('button', { class: 'btn', html: G[k].emoji + '<small>' + G[k].label + '</small>', onclick: function () { input(k); } })); });
    pb.appendChild(D.el('div', { class: 'ar-kbd-hint', text: 'Repeating the same gesture twice? Drop your hand briefly between them.' }));

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function updateStats() {
      stats.innerHTML = '<div class="stat"><div class="k">Level</div><div class="v">' + level + '</div></div><div class="stat"><div class="k">Step</div><div class="v">' + (phase === 'input' ? pos + '/' + seq.length : '—') + '</div></div><div class="stat"><div class="k">Best</div><div class="v">' + (ctx.best() == null ? '—' : ctx.best()) + '</div></div>';
    }
    function renderSeq(lit, results) {
      seqEl.innerHTML = '';
      seq.forEach(function (k, i) {
        var cls = 'g-simon-tile';
        if (phase === 'input') { cls += i < pos ? ' ok' : ' hid'; }
        if (i === lit) cls += ' lit';
        if (results && results[i]) cls += ' ' + results[i];
        seqEl.appendChild(D.el('div', { class: cls, text: G[k].emoji, title: G[k].label }));
      });
    }
    function showBanner(t, msg, btns) {
      banner.innerHTML = ''; banner.appendChild(D.el('h2', { text: t })); banner.appendChild(D.el('p', { html: msg }));
      var row = D.el('div', { class: 'row' }); btns.forEach(function (x) { row.appendChild(x); }); banner.appendChild(row);
      banner.classList.remove('hidden');
    }
    function intro() {
      face.setExpression('eager');
      showBanner('Gesture Simon', 'Watch the robot’s sequence of hand signs, then repeat it with your hand. Each level adds one more sign.', [
        D.el('button', { class: 'btn primary lg', html: D.icon('camera') + 'Start with camera', onclick: function () { startCam(); } }),
        D.el('button', { class: 'btn lg', html: D.icon('hand') + 'Play by clicking', onclick: function () { newGame(); } })
      ]);
    }
    function startCam() {
      banner.classList.add('hidden');
      cam.note.textContent = 'Starting camera…';
      D.vision.attach(cam.video);
      D.vision.start('game-simon', 'hands').then(function () { camOK = true; cam.note.textContent = ''; newGame(); }).catch(function (e) {
        cam.note.textContent = e.message;
        showBanner('Camera unavailable', D.esc(e.message) + '<br>You can still play by clicking the gesture buttons.', [D.el('button', { class: 'btn primary', text: 'Play by clicking', onclick: newGame })]);
      });
    }
    function newGame() {
      banner.classList.add('hidden'); clearTimers();
      seq = []; level = 0;
      D.audit.log('arcade', 'Gesture Simon started', camOK ? 'camera' : 'click');
      nextLevel();
    }
    function nextLevel() {
      level++; seq.push(SET[Math.floor(Math.random() * SET.length)]);
      pos = 0; phase = 'show'; updateStats();
      status.textContent = 'Watch…'; status.className = 'chip amber';
      face.setExpression('thinking');
      var step = Math.max(520, 950 - level * 40);
      seq.forEach(function (k, i) {
        later(function () {
          renderSeq(i); big.textContent = G[k].emoji; face.setExpression(G[k].expr); D.sound.beep(440 + SET.indexOf(k) * 90, 0.12, 'triangle');
        }, 600 + i * step);
        later(function () { big.textContent = ''; renderSeq(-1); }, 600 + i * step + step * 0.75);
      });
      later(function () {
        phase = 'input'; pos = 0; renderSeq(-1); updateStats();
        status.textContent = 'Your turn — ' + seq.length + ' sign' + (seq.length > 1 ? 's' : ''); status.className = 'chip green';
        face.setExpression('eager');
      }, 600 + seq.length * step);
    }
    function input(k) {
      if (phase !== 'input') return;
      big.textContent = G[k].emoji;
      if (k === seq[pos]) {
        pos++; D.sound.beep(440 + SET.indexOf(k) * 90, 0.1, 'triangle'); face.setExpression(G[k].expr);
        renderSeq(pos - 1); updateStats();
        if (pos >= seq.length) {
          phase = 'between'; status.textContent = 'Correct!'; face.setExpression('happy'); D.sound.good();
          later(function () { big.textContent = ''; nextLevel(); }, 1100);
        }
      } else {
        phase = 'over'; D.sound.bad(); face.setExpression('sad');
        var res = {}; res[pos] = 'bad'; renderSeq(-1, res);
        seqEl.querySelectorAll('.g-simon-tile').forEach(function (t) { t.classList.remove('hid'); });
        var done = level - 1, score = done * 100;
        ctx.reportScore(score, 'Level ' + done + ' completed' + (camOK ? ' · hands' : ' · clicks'));
        showBanner('Sequence broken', 'You showed ' + G[k].emoji + ' but Simon wanted ' + G[seq[pos]].emoji + '. You cleared <b>' + done + '</b> level' + (done === 1 ? '' : 's') + ' — score <b>' + score + '</b>.', [
          D.el('button', { class: 'btn primary', html: D.icon('reset') + 'Play again', onclick: newGame }),
          D.el('button', { class: 'btn', text: 'Menu', onclick: intro })
        ]);
      }
    }

    off = D.vision.on(function (f) {
      if (f.mode !== 'hands') return;
      D.vision.drawOverlay(cam.canvas, f);
      var h = f.hands[0];
      det.innerHTML = h ? 'Seeing: <b>' + (h.info ? h.info.emoji + ' ' + h.info.label : 'unknown sign') + '</b>' : '<span class="faint">Show one hand…</span>';
      var key = h && SET.indexOf(h.gesture) >= 0 ? h.gesture : null;
      var r = stab.push(key, f.ts);
      if (r.changed && r.key) input(r.key);
    });

    updateStats(); intro();
    return {
      destroy: function () { clearTimers(); cancelAnimationFrame(raf); if (off) off(); face.destroy(); D.vision.stop('game-simon'); },
      _test: { newGame: newGame, input: input, state: function () { return { phase: phase, seq: seq.slice(), pos: pos, level: level }; } }
    };
  }

  var g = A.wrap;
  function hand(x, y, s) { return '<text x="' + x + '" y="' + y + '" font-size="' + (s || 22) + '">'; }
  D.arcade.register({
    id: 'simon', title: 'Gesture Simon', tagline: 'A memory game played with hand signs. Watch the sequence, then sign it back.',
    icon: 'hand', color: '--accent', cv: 'hands', controls: 'Your hand · or click',
    guide: {
      howto: [
        { title: 'Show your hand', text: 'Hold one hand up, palm facing the camera, about 40–60 cm away. Only the <b>hand model</b> runs.', svg: g('<rect x="35" y="15" width="80" height="60" rx="8" fill="#000"/>' + hand(62, 56, 26) + '✋</text>' + A.text(40, 92, 'one hand · good light', 9)) },
        { title: 'Watch the sequence', text: 'Simon lights up a row of signs one by one. Remember the order!', svg: g(['👍', '✊', '✌️'].map(function (e, i) { return '<rect x="' + (22 + i * 38) + '" y="34" width="32" height="32" rx="8" fill="' + (i === 1 ? 'var(--accent-soft)' : 'var(--surface-3)') + '" stroke="' + (i === 1 ? 'var(--accent)' : 'var(--line-2)') + '"/>' + hand(27 + i * 38, 58, 20) + e + '</text>'; }).join('')) },
        { title: 'Sign it back', text: 'Make each sign in the same order. A sign counts once you hold it steady for about half a second.', svg: g(hand(30, 64, 30) + '👍</text>' + A.arrow(70, 52, 96, 52) + '<rect x="100" y="38" width="30" height="30" rx="8" fill="rgba(52,211,153,.2)" stroke="var(--green)"/>' + A.text(108, 58, '✓', 14, 'var(--green)', 700)) },
        { title: 'Repeat signs', text: 'If the same sign appears twice in a row, lower your hand briefly between them.', svg: g(hand(20, 62, 24) + '✊</text>' + A.text(56, 56, '↓ drop ↑', 10, 'var(--text-2)', 600) + hand(110, 62, 24) + '✊</text>') },
        { title: 'No camera?', text: 'Click the gesture buttons in the side panel instead — same game, same scores.', svg: g(A.btn(20, 40, 52, '👍 Thumbs') + A.btn(78, 40, 52, '✊ Fist')) }
      ],
      tips: 'Signs used: 👍 thumbs up · ✋ open palm · ✊ fist · ✌️ victory · ☝️ point · 🤟 I love you.',
      about: {
        hero: '<svg viewBox="0 0 560 150"><rect width="560" height="150" fill="var(--bg-2)"/>' + ['👍', '✋', '✊', '✌️', '☝️', '🤟'].map(function (e, i) { return '<rect x="' + (40 + i * 82) + '" y="40" width="66" height="66" rx="16" fill="var(--surface)" stroke="' + (i === 2 ? 'var(--accent)' : 'var(--line)') + '"/><text x="' + (52 + i * 82) + '" y="86" font-size="38">' + e + '</text>'; }).join('') + '</svg>',
        intro: 'Gesture Simon trains both your memory and the robot’s hand-sign recognition. The hand landmarker finds 21 joints per hand; Daedalus checks which fingers are extended and where the thumb points to name the sign.',
        facts: [['21', 'hand joints'], ['6', 'signs used'], ['0.45 s', 'hold to confirm']],
        sections: [
          { title: 'Why “hold steady”?', html: '<p>Hands move fast and blur. A stabiliser only accepts a sign after it has been recognised continuously for a short time, which filters out flickers between signs.</p>' },
          { title: 'Accessibility', html: '<p>The same gesture engine lets people control Daedalus without a mouse — see Echo’s gesture chart and Argus’ hands-free driving.</p>' },
          { title: 'Scoring', html: '<p>100 points per completed level.</p>' }
        ]
      }
    },
    create: create
  });
})(window);
