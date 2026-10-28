/* snake.js — Snake Bot: a robot head pulling a cargo train. Keys or hand pointing. */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art;
  var COLS = 24, ROWS = 16;
  var LEVELS = { slow: { label: 'Cruise', ms: 170 }, normal: { label: 'Normal', ms: 120 }, fast: { label: 'Turbo', ms: 80 } };
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function create(host, ctx) {
    var U = D.arcade.util;
    var level = 'normal', snake, dir, nextDir, food, score, alive, started, timer = 0, raf = 0, hands = false, offVision = null, cellPx = 24, lastHand = null, eaten = 0, t0 = 0;
    var play = D.el('div', { class: 'ar-play' });
    var stage = D.el('div', { class: 'ar-stagewrap' }), canvas = D.el('canvas'); stage.appendChild(canvas);
    var banner = D.el('div', { class: 'ar-banner' }); stage.appendChild(banner);
    var side = D.el('div', { class: 'ar-side' });
    play.appendChild(stage); play.appendChild(side); host.appendChild(play);

    var p = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Controls' })));
    var b = D.el('div', { class: 'panel-body' }); p.appendChild(b); side.appendChild(p);
    var stats = D.el('div', { class: 'ar-stats' }); b.appendChild(stats);
    b.appendChild(D.el('div', { class: 'field' }, D.el('label', { text: 'Speed' }), D.ui.seg(Object.keys(LEVELS).map(function (k) { return [k, LEVELS[k].label]; }), level, function (v) { level = v; if (started && alive) restartTimer(); }, 'full')));
    var sw = D.ui.switchEl(false, function (on) { setHands(on); });
    b.appendChild(D.el('div', { class: 'row' }, sw, D.el('div', { class: 'grow' }, D.el('b', { text: 'Hand steering' }), D.el('div', { class: 'small faint', text: 'Point your index finger up / down / left / right' }))));
    var cam = U.cameraBox(); cam.el.classList.add('hidden'); b.appendChild(cam.el);
    var handInfo = D.el('div', { class: 'small muted hidden' }); b.appendChild(handInfo);
    b.appendChild(D.el('div', { class: 'ar-kbd-hint', html: '<kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Space</kbd> start / pause' }));

    function reset() {
      var cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
      snake = [[cx, cy], [cx - 1, cy], [cx - 2, cy]]; dir = 'right'; nextDir = 'right'; score = 0; eaten = 0; alive = true; started = false;
      placeFood(); updateStats(); draw();
      showBanner('Snake Bot', 'Steer the robot to the energy cells. Don’t hit the walls or your own cargo!', 'Start');
    }
    function placeFood() {
      var free = [];
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) if (!snake.some(function (s) { return s[0] === x && s[1] === y; })) free.push([x, y]);
      food = free[Math.floor(Math.random() * free.length)];
    }
    function showBanner(t, msg, btn) {
      banner.innerHTML = ''; banner.appendChild(D.el('h2', { text: t })); banner.appendChild(D.el('p', { text: msg }));
      banner.appendChild(D.el('button', { class: 'btn primary lg', html: D.icon('play') + btn, onclick: start }));
      banner.classList.remove('hidden');
    }
    function start() {
      if (!alive) reset();
      banner.classList.add('hidden'); started = true; t0 = t0 || Date.now();
      D.audit.log('arcade', 'Snake Bot run', 'Speed ' + LEVELS[level].label + (hands ? ' · hand steering' : ' · keyboard'));
      restartTimer();
    }
    function pause() { clearInterval(timer); timer = 0; showBanner('Paused', 'Take a breath.', 'Resume'); }
    function restartTimer() { clearInterval(timer); timer = setInterval(tick, LEVELS[level].ms); }
    function setDir(d) {
      if (!d || !DIRS[d]) return;
      var cur = DIRS[dir], nd = DIRS[d];
      if (cur[0] + nd[0] === 0 && cur[1] + nd[1] === 0) return;   // no reversing
      nextDir = d;
    }
    function tick() {
      dir = nextDir;
      var h = snake[0], d = DIRS[dir], nx = h[0] + d[0], ny = h[1] + d[1];
      var hitSelf = snake.slice(0, -1).some(function (s) { return s[0] === nx && s[1] === ny; });
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || hitSelf) return die();
      snake.unshift([nx, ny]);
      if (nx === food[0] && ny === food[1]) { eaten++; score += 10 + (level === 'fast' ? 10 : level === 'normal' ? 5 : 0); D.sound.good(); placeFood(); }
      else snake.pop();
      updateStats();
    }
    function die() {
      alive = false; clearInterval(timer); timer = 0; D.sound.bump(); D.sound.bad();
      ctx.reportScore(score, eaten + ' cells · ' + LEVELS[level].label + (hands ? ' · hands' : '')); updateStats();
      showBanner('Crash!', 'Score ' + score + ' — ' + eaten + ' energy cells collected.', 'Play again');
      t0 = 0;
    }
    function updateStats() {
      stats.innerHTML = '<div class="stat"><div class="k">Score</div><div class="v">' + score + '</div></div><div class="stat"><div class="k">Length</div><div class="v">' + snake.length + '</div></div><div class="stat"><div class="k">Best</div><div class="v">' + (ctx.best() == null ? '—' : ctx.best()) + '</div></div>';
    }
    function layout() {
      var r = stage.getBoundingClientRect();
      cellPx = Math.floor(Math.min((r.width - 24) / COLS, (r.height - 24) / ROWS));
      U.fit(canvas, cellPx * COLS, cellPx * ROWS);
    }
    function draw() {
      var c = canvas.getContext('2d'), C = U.colors(), W = cellPx * COLS, H = cellPx * ROWS;
      c.fillStyle = C.floor; c.fillRect(0, 0, W, H);
      c.strokeStyle = C.line; c.lineWidth = 1;
      for (var x = 0; x <= COLS; x++) { c.beginPath(); c.moveTo(x * cellPx + .5, 0); c.lineTo(x * cellPx + .5, H); c.stroke(); }
      for (var y = 0; y <= ROWS; y++) { c.beginPath(); c.moveTo(0, y * cellPx + .5); c.lineTo(W, y * cellPx + .5); c.stroke(); }
      if (food) {
        var t = performance.now() / 300, fx = food[0] * cellPx + cellPx / 2, fy = food[1] * cellPx + cellPx / 2;
        c.fillStyle = C.amber; c.globalAlpha = .25 + Math.sin(t) * .1; c.beginPath(); c.arc(fx, fy, cellPx * .48, 0, 7); c.fill(); c.globalAlpha = 1;
        c.beginPath(); c.moveTo(fx + cellPx * .05, fy - cellPx * .32); c.lineTo(fx - cellPx * .2, fy + cellPx * .04); c.lineTo(fx, fy + cellPx * .04); c.lineTo(fx - cellPx * .06, fy + cellPx * .32); c.lineTo(fx + cellPx * .2, fy - cellPx * .06); c.lineTo(fx, fy - cellPx * .06); c.closePath(); c.fill();
      }
      for (var i = snake.length - 1; i >= 1; i--) {
        var s = snake[i], k = 1 - i / (snake.length + 4);
        c.fillStyle = C.violet; c.globalAlpha = .45 + k * .55;
        U.rr(c, s[0] * cellPx + 3, s[1] * cellPx + 3, cellPx - 6, cellPx - 6, cellPx * .25); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(s[0] * cellPx + cellPx * .3, s[1] * cellPx + cellPx * .45, cellPx * .4, 2);
      }
      var hd = snake[0], ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
      U.bot(c, hd[0] * cellPx + cellPx / 2, hd[1] * cellPx + cellPx / 2, cellPx * 1.05, ang, C.accent, alive ? (started ? null : null) : 'hurt');
    }
    function loop() { raf = requestAnimationFrame(loop); draw(); }

    function onKey(e) {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      var m = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }[k];
      if (m) { e.preventDefault(); setDir(m); if (!started || !timer) { if (alive) start(); } }
      if (k === ' ') { e.preventDefault(); if (timer) pause(); else start(); }
    }
    document.addEventListener('keydown', onKey);

    function setHands(on) {
      hands = on;
      cam.el.classList.toggle('hidden', !on); handInfo.classList.toggle('hidden', !on);
      if (on) {
        D.vision.attach(cam.video);
        cam.note.textContent = 'Starting camera…';
        D.vision.start('game-snake', 'hands').then(function () { cam.note.textContent = ''; }).catch(function (e) {
          cam.note.textContent = e.message; handInfo.textContent = 'Hand steering unavailable — keyboard still works.';
        });
        if (!offVision) offVision = D.vision.on(function (f) {
          D.vision.drawOverlay(cam.canvas, f);
          var h = f.hands && f.hands[0];
          var d = h && h.pointDir;
          handInfo.innerHTML = h ? 'Hand: <b>' + (h.info ? h.info.label : '…') + '</b>' + (d ? ' · pointing <b>' + d + '</b>' : '') : 'Show one hand to the camera';
          if (d && d !== lastHand) setDir(d);
          lastHand = d;
        });
        D.audit.log('arcade', 'Snake Bot hand steering', 'Enabled');
      } else {
        if (offVision) { offVision(); offVision = null; }
        D.vision.stop('game-snake');
      }
    }

    var ro = new ResizeObserver(function () { layout(); draw(); }); ro.observe(stage);
    reset(); layout(); loop();

    return {
      destroy: function () {
        clearInterval(timer); cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey);
        if (offVision) offVision(); D.vision.stop('game-snake');
      },
      _test: { start: start, setDir: setDir, state: function () { return { head: snake[0].slice(), len: snake.length, alive: alive, score: score, dir: dir }; }, tick: function () { tick(); } }
    };
  }

  var g = A.wrap;
  D.arcade.register({
    id: 'snake', title: 'Snake Bot', tagline: 'Classic snake with a robot at the head. Steer with arrow keys — or by pointing your finger.',
    icon: 'snake', color: '--violet', cv: null, controls: 'Keys · optional hands',
    guide: {
      howto: [
        { title: 'Press Start', text: 'The robot starts moving right on its own. Press <kbd>Space</kbd> any time to pause.', svg: g(A.btn(45, 40, 60, 'Start', true) + A.cursor(85, 50)) },
        { title: 'Steer', text: 'Use the arrow keys or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. The robot cannot reverse straight into itself.', svg: g('<rect x="62" y="20" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><rect x="30" y="48" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><rect x="62" y="48" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><rect x="94" y="48" width="26" height="22" rx="5" fill="var(--accent)"/>' + A.text(70, 35, '▲', 10, 'var(--text)') + A.text(38, 63, '◀', 10, 'var(--text)') + A.text(70, 63, '▼', 10, 'var(--text)') + A.text(102, 63, '▶', 10, '#fff')) },
        { title: 'Collect energy', text: 'Each yellow energy cell adds a cargo wagon. Faster speeds give more points per cell.', svg: g(A.grid(20, 22, 6, 3, 18) + '<rect x="24" y="44" width="12" height="12" rx="3" fill="var(--violet)" opacity=".6"/><rect x="42" y="44" width="12" height="12" rx="3" fill="var(--violet)"/>' + A.bot(66, 50, 14, 0) + '<circle cx="104" cy="50" r="6" fill="var(--amber)"/>') },
        { title: 'Hands-free mode', text: 'Turn on <b>Hand steering</b> and point your index finger up, down, left or right. Great as an accessibility option.', svg: g('<path d="M60 80V50a5 5 0 0110 0v-22a5 5 0 0110 0v40" stroke="var(--accent)" stroke-width="3" fill="none" stroke-linecap="round"/>' + A.arrow(75, 22, 75, 8) + A.text(92, 30, 'up', 10, 'var(--text)', 700)) },
        { title: 'Avoid crashes', text: 'Hitting a wall or your own cargo ends the run and records your score.', svg: g('<rect x="20" y="20" width="110" height="64" rx="4" fill="none" stroke="var(--red)" stroke-width="3"/>' + A.bot(118, 52, 16, 0) + A.text(54, 56, 'CRASH', 14, 'var(--red)', 700)) }
      ],
      tips: 'Plan a few cells ahead and use the edges to make long loops.',
      about: {
        hero: '<svg viewBox="0 0 560 150"><rect width="560" height="150" fill="var(--bg-2)"/>' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { return '<rect x="' + (110 + i * 40) + '" y="58" width="32" height="32" rx="9" fill="var(--violet)" opacity="' + (0.3 + i * 0.1) + '"/>'; }).join('') + '<rect x="390" y="52" width="44" height="44" rx="10" fill="var(--accent)"/><circle cx="420" cy="66" r="4" fill="#fff"/><circle cx="420" cy="82" r="4" fill="#fff"/><circle cx="480" cy="74" r="10" fill="var(--amber)"/></svg>',
        intro: 'Snake is a lesson in planning under growing constraints: every success makes the robot longer and the free space smaller — like a real robot towing cargo through a warehouse.',
        facts: [['24×16', 'arena'], ['3', 'speeds'], ['4', 'hand directions']],
        sections: [
          { title: 'Hand steering', html: '<p>The camera finds 21 landmarks on your hand. The direction from the base of your index finger to its tip becomes up, down, left or right. Only the hand model runs — your face is never analysed in this mode.</p>' },
          { title: 'Scoring', html: '<p>Cruise: 10 per cell · Normal: 15 · Turbo: 20. Your best score is saved and every run is in the Audit log.</p>' }
        ]
      }
    },
    create: create
  });
})(window);
