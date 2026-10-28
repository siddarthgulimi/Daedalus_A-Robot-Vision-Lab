/* pilot.js — Gesture Pilot: steer a robot through a course by pointing your finger. */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art;

  var TRACKS = {
    loop: { label: 'Loop', map: [
      '####################',
      '#S.....#......2....#',
      '#.####.#.####.####.#',
      '#.#....#....#....#.#',
      '#.#.######..####.#.#',
      '#1#......#.......#.#',
      '#.######.#.#####.#3#',
      '#........#.#.....#.#',
      '#.########.#.#####.#',
      '#.....5....#....4..#',
      '####################'] },
    zigzag: { label: 'Zig-zag', map: [
      '####################',
      '#S..#.....#.....#..#',
      '#...#..#..#..#..#..#',
      '#...#..#..#..#..#..#',
      '#.1....#.2...#..3..#',
      '#......#.....#.....#',
      '######.#######.###.#',
      '#4.....#.....#.....#',
      '#..##.....#.....#.5#',
      '#..##.....#.....#..#',
      '####################'] }
  };
  var DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

  function create(host, ctx) {
    var U = D.arcade.util;
    var trackKey = 'loop', grid, W, H, start, cps, nextCp, robot, wish, moving, boost, t0, tEnd, raf = 0, off = null, camOK = false, stab = new D.vision.GestureStabilizer(200), cell = 30, bumps = 0, running = false, ghost = [];

    var play = D.el('div', { class: 'ar-play' });
    var stage = D.el('div', { class: 'ar-stagewrap' }), canvas = D.el('canvas'); stage.appendChild(canvas);
    var banner = D.el('div', { class: 'ar-banner' }); stage.appendChild(banner);
    var side = D.el('div', { class: 'ar-side' });
    play.appendChild(stage); play.appendChild(side); host.appendChild(play);
    var p = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Pilot' })));
    var b = D.el('div', { class: 'panel-body' }); p.appendChild(b); side.appendChild(p);
    var cam = U.cameraBox(); b.appendChild(cam.el);
    var det = D.el('div', { class: 'small' }); b.appendChild(det);
    var stats = D.el('div', { class: 'ar-stats' }); b.appendChild(stats);
    b.appendChild(D.el('div', { class: 'field' }, D.el('label', { text: 'Course' }), D.ui.seg(Object.keys(TRACKS).map(function (k) { return [k, TRACKS[k].label]; }), trackKey, function (v) { trackKey = v; load(); intro(); }, 'full')));
    b.appendChild(D.el('div', { class: 'callout', html: D.icon('hand') + '<div>☝️ <b>Point</b> up/down/left/right to steer · ✋ <b>open palm</b> = stop · ✊ <b>fist</b> = boost. Keys: arrows, <kbd>Space</kbd> stop, <kbd>Shift</kbd> boost.</div>' }));

    function load() {
      var m = TRACKS[trackKey].map; H = m.length; W = m[0].length; grid = []; cps = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var ch = m[y][x];
        grid.push(ch === '#' ? 1 : 0);
        if (ch === 'S') start = { x: x, y: y };
        if (/[1-9]/.test(ch)) cps[+ch - 1] = { x: x, y: y, n: +ch };
      }
      robot = { x: start.x, y: start.y, fx: start.x, fy: start.y, dir: 'right', t: 1 };
      wish = 'right'; moving = false; boost = false; nextCp = 0; t0 = 0; tEnd = 0; bumps = 0; running = false; ghost = [];
      layout(); updateStats();
    }
    function wall(x, y) { return x < 0 || y < 0 || x >= W || y >= H || grid[y * W + x] === 1; }
    function layout() {
      var r = stage.getBoundingClientRect();
      cell = Math.floor(Math.min((r.width - 24) / W, (r.height - 24) / H));
      U.fit(canvas, cell * W, cell * H);
    }
    function secs() { return t0 ? ((tEnd || performance.now()) - t0) / 1000 : 0; }
    function updateStats() {
      stats.innerHTML = '<div class="stat"><div class="k">Time</div><div class="v">' + secs().toFixed(1) + '</div></div><div class="stat"><div class="k">Checkpoint</div><div class="v">' + Math.min(nextCp, cps.length) + '/' + cps.length + '</div></div><div class="stat"><div class="k">Bumps</div><div class="v">' + bumps + '</div></div>';
    }
    function showBanner(t, msg, btns) {
      banner.innerHTML = ''; banner.appendChild(D.el('h2', { text: t })); banner.appendChild(D.el('p', { html: msg }));
      var row = D.el('div', { class: 'row' }); btns.forEach(function (x) { row.appendChild(x); }); banner.appendChild(row);
      banner.classList.remove('hidden');
    }
    function intro() {
      showBanner('Gesture Pilot', 'Fly the robot through checkpoints <b>1 → ' + cps.length + '</b> in order, as fast as you can.', [
        D.el('button', { class: 'btn primary lg', html: D.icon('camera') + 'Start with hands', onclick: function () { startCam(); } }),
        D.el('button', { class: 'btn lg', html: D.icon('keyboard') + 'Use keyboard', onclick: function () { go(); } })
      ]);
    }
    function startCam() {
      banner.classList.add('hidden'); cam.note.textContent = 'Starting camera…';
      D.vision.attach(cam.video);
      D.vision.start('game-pilot', 'hands').then(function () { camOK = true; cam.note.textContent = ''; go(); }).catch(function (e) {
        cam.note.textContent = e.message;
        showBanner('Camera unavailable', D.esc(e.message) + '<br>Use the arrow keys instead.', [D.el('button', { class: 'btn primary', text: 'Use keyboard', onclick: go })]);
      });
    }
    function go() {
      load(); banner.classList.add('hidden'); running = true; moving = true; t0 = performance.now();
      D.audit.log('arcade', 'Gesture Pilot lap started', TRACKS[trackKey].label + (camOK ? ' · hands' : ' · keyboard'));
    }
    function steer(d) { if (DIRV[d]) { wish = d; moving = true; } }

    var last = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (running && moving) {
        var spd = boost ? 7 : 4;
        robot.t += dt * spd;
        if (robot.t >= 1) {
          robot.fx = robot.x; robot.fy = robot.y;
          ghost.push([robot.x, robot.y]); if (ghost.length > 30) ghost.shift();
          var c = cps[nextCp];
          if (c && c.x === robot.x && c.y === robot.y) {
            nextCp++; D.sound.good();
            if (nextCp >= cps.length) finish();
          }
          var dir = wish && !wall(robot.x + DIRV[wish][0], robot.y + DIRV[wish][1]) ? wish : robot.dir;
          var nx = robot.x + DIRV[dir][0], ny = robot.y + DIRV[dir][1];
          if (wall(nx, ny)) { if (moving) { bumps++; D.sound.bump(); } moving = false; robot.t = 1; }
          else { robot.dir = dir; robot.x = nx; robot.y = ny; robot.t = 0; }
        }
      }
      if (running) updateStats();
      draw();
    }
    function finish() {
      running = false; tEnd = performance.now();
      var s = secs(), score = Math.max(100, Math.round(3000 - s * 40 - bumps * 25));
      D.sound.win();
      ctx.reportScore(score, TRACKS[trackKey].label + ' in ' + s.toFixed(1) + 's · ' + bumps + ' bumps' + (camOK ? ' · hands' : ' · keys'));
      showBanner('Lap complete!', 'Time <b>' + s.toFixed(1) + ' s</b> · ' + bumps + ' bumps · score <b>' + score + '</b>', [
        D.el('button', { class: 'btn primary', html: D.icon('reset') + 'Fly again', onclick: go }), D.el('button', { class: 'btn', text: 'Menu', onclick: function () { load(); intro(); } })
      ]);
    }
    function draw() {
      var c = canvas.getContext('2d'), C = U.colors();
      c.fillStyle = C.floor; c.fillRect(0, 0, cell * W, cell * H);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        if (grid[y * W + x]) { c.fillStyle = C.wall; c.fillRect(x * cell, y * cell, cell, cell); c.fillStyle = C.wallTop; c.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 5); }
        else { c.strokeStyle = C.line; c.strokeRect(x * cell + .5, y * cell + .5, cell - 1, cell - 1); }
      }
      c.fillStyle = C.accent; c.globalAlpha = .18;
      ghost.forEach(function (g2, i) { c.globalAlpha = .04 + i / ghost.length * .2; c.fillRect(g2[0] * cell + cell * .3, g2[1] * cell + cell * .3, cell * .4, cell * .4); });
      c.globalAlpha = 1;
      c.fillStyle = C.green; c.globalAlpha = .25; c.fillRect(start.x * cell, start.y * cell, cell, cell); c.globalAlpha = 1;
      cps.forEach(function (cp, i) {
        var done = i < nextCp, isNext = i === nextCp, cx = cp.x * cell + cell / 2, cy = cp.y * cell + cell / 2;
        c.beginPath(); c.arc(cx, cy, cell * (isNext ? .42 + Math.sin(performance.now() / 200) * .04 : .36), 0, 7);
        c.fillStyle = done ? C.green : isNext ? C.amber : C.surface3; c.fill();
        c.fillStyle = done || isNext ? '#0b1220' : C.text2; c.font = '700 ' + Math.round(cell * .42) + 'px Space Grotesk'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(done ? '✓' : cp.n, cx, cy + 1);
      });
      var k = Math.min(1, robot.t), rx = D.lerp(robot.fx, robot.x, k), ry = D.lerp(robot.fy, robot.y, k);
      if (boost && moving) { c.fillStyle = C.amber; c.globalAlpha = .35; c.beginPath(); c.arc(rx * cell + cell / 2, ry * cell + cell / 2, cell * .6, 0, 7); c.fill(); c.globalAlpha = 1; }
      U.bot(c, rx * cell + cell / 2, ry * cell + cell / 2, cell * .9, ANG[robot.dir], C.accent, moving ? null : 'hurt');
      if (wish && running) {
        var wx = robot.x + DIRV[wish][0], wy = robot.y + DIRV[wish][1];
        c.strokeStyle = C.accent; c.setLineDash([3, 3]); c.strokeRect(wx * cell + 3, wy * cell + 3, cell - 6, cell - 6); c.setLineDash([]);
      }
    }

    function onKey(e) {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      var m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (m) { e.preventDefault(); if (!running && banner.classList.contains('hidden') === false) return; steer(m); }
      if (e.key === ' ') { e.preventDefault(); moving = false; }
      if (e.key === 'Shift') boost = true;
    }
    function onKeyUp(e) { if (e.key === 'Shift') boost = false; }
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp);

    off = D.vision.on(function (f) {
      if (f.mode !== 'hands') return;
      D.vision.drawOverlay(cam.canvas, f);
      var h = f.hands[0];
      var key = !h ? null : h.gesture === 'open_palm' ? 'stop' : h.gesture === 'fist' ? 'boost' : h.pointDir ? 'p_' + h.pointDir : null;
      det.innerHTML = h ? 'Command: <b>' + (key === 'stop' ? '✋ stop' : key === 'boost' ? '✊ boost' : h.pointDir ? '☝️ ' + h.pointDir : '…') + '</b>' : '<span class="faint">Show one hand…</span>';
      var r = stab.push(key, f.ts);
      if (!running) return;
      if (r.key === 'stop') moving = false;
      else if (r.key === 'boost') { boost = true; moving = true; }
      else if (r.key && r.key.indexOf('p_') === 0) { boost = false; steer(r.key.slice(2)); }
      else boost = false;
    });

    var ro = new ResizeObserver(function () { layout(); draw(); }); ro.observe(stage);
    load(); intro(); raf = requestAnimationFrame(frame);
    return {
      destroy: function () { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); if (off) off(); D.vision.stop('game-pilot'); },
      _test: { go: go, steer: steer, state: function () { return { x: robot.x, y: robot.y, nextCp: nextCp, running: running, moving: moving, bumps: bumps }; } }
    };
  }

  var g = A.wrap;
  D.arcade.register({
    id: 'pilot', title: 'Gesture Pilot', tagline: 'Point your finger to steer a robot through a checkpoint course. Open palm stops, fist boosts.',
    icon: 'route', color: '--green', cv: 'hands', controls: 'Hand pointing · or arrows',
    guide: {
      howto: [
        { title: 'Raise one hand', text: 'Hold your hand up in view of the camera. The hand skeleton appears on the preview when it is tracked.', svg: g('<rect x="35" y="15" width="80" height="60" rx="8" fill="#000"/><text x="62" y="56" font-size="26">✋</text>') },
        { title: 'Point to steer', text: 'Point your index finger <b>up, down, left or right</b>. The dashed box shows where the robot will turn next.', svg: g(A.grid(20, 20, 6, 4, 16) + A.bot(52, 52, 13, 0) + '<rect x="68" y="44" width="14" height="14" fill="none" stroke="var(--accent)" stroke-dasharray="2 2"/><text x="105" y="62" font-size="22">👉</text>') },
        { title: 'Stop & boost', text: '✋ <b>Open palm</b> stops the robot. ✊ <b>Fist</b> gives a speed boost — careful near walls!', svg: g('<text x="22" y="62" font-size="30">✋</text>' + A.text(20, 86, 'stop', 10, 'var(--text)', 700) + '<text x="92" y="62" font-size="30">✊</text>' + A.text(88, 86, 'boost', 10, 'var(--amber)', 700)) },
        { title: 'Hit the checkpoints', text: 'Drive through numbered checkpoints in order. The next one pulses amber; finished ones turn green.', svg: g('<circle cx="40" cy="52" r="13" fill="var(--green)"/>' + A.text(35, 57, '✓', 12, '#0b1220', 700) + '<circle cx="80" cy="52" r="15" fill="var(--amber)"/>' + A.text(76, 57, '2', 13, '#0b1220', 700) + '<circle cx="118" cy="52" r="12" fill="var(--surface-3)"/>' + A.text(114, 57, '3', 12, 'var(--text-2)', 700)) },
        { title: 'Beat your time', text: 'Score = 3000 − 40×seconds − 25×bumps. No camera? Use the arrow keys, <kbd>Space</kbd> and <kbd>Shift</kbd>.', svg: g('<circle cx="75" cy="52" r="30" fill="none" stroke="var(--green)" stroke-width="5" stroke-dasharray="150 40"/>' + A.text(58, 58, '24.1s', 13, 'var(--green)', 700)) }
      ],
      tips: 'Point early: the robot turns at the next cell where your direction is open, so you can “queue” a turn before a junction.',
      about: {
        hero: '<svg viewBox="0 0 560 150"><rect width="560" height="150" fill="var(--bg-2)"/><text x="40" y="100" font-size="70">☝️</text><path d="M150 75h80" stroke="var(--accent)" stroke-width="3" stroke-dasharray="6 4"/><g transform="translate(250 20)"><rect width="270" height="110" rx="12" fill="var(--surface)" stroke="var(--line)"/><text x="16" y="32" font-size="12" fill="var(--text)" font-weight="700">index MCP → tip vector</text><text x="16" y="56" font-size="11" fill="var(--text-2)">|dx| &gt; |dy| → left / right</text><text x="16" y="76" font-size="11" fill="var(--text-2)">|dy| &gt; |dx| → up / down</text><text x="16" y="96" font-size="11" fill="var(--green)">held 0.2 s → command</text></g></svg>',
        intro: 'Gesture Pilot shows how a robot can be teleoperated with nothing but a webcam. The direction of your index finger becomes a steering command — a hands-free, touch-free control method that is also useful as an accessibility feature.',
        facts: [['4', 'directions'], ['2', 'courses'], ['0.2 s', 'command hold']],
        sections: [
          { title: 'From finger to command', html: '<p>The camera finds 21 hand joints. The vector from the base knuckle of your index finger to its tip decides the direction; open palm and fist are recognised from which fingers are extended.</p>' },
          { title: 'Grid driving', html: '<p>The robot drives cell by cell. At every cell centre it turns to your requested direction if that cell is free, otherwise it keeps going — until a wall stops it.</p>' }
        ]
      }
    },
    create: create
  });
})(window);
