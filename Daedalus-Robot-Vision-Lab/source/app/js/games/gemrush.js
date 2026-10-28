/* gemrush.js — Gem Rush: write the shortest robot program that collects every gem. */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art;

  var LEVELS = [
    { name: 'Straight line', par: 2, rows: ['......', '.>***.', '......'], hint: 'Try Repeat ×3 with one Forward inside.' },
    { name: 'First corner', par: 5, rows: ['>**.', '...*', '...*'], hint: 'Go along the top, turn right, go down.' },
    { name: 'The square', par: 4, rows: ['>****', '*...*', '*...*', '*...*', '*****'], hint: 'A repeat inside a repeat: 4 × (4 × Forward, Turn right).' },
    { name: 'Staircase', par: 5, rows: ['>*..', '.**.', '..**', '...*'], hint: 'One step = Forward, Right, Forward, Left. Repeat it.' },
    { name: 'Around the wall', par: 10, rows: ['>*#*', '.*#*', '.***'], hint: 'Down, across, then back up the other side.' },
    { name: 'Two lanes', par: 7, rows: ['>*****', '******'], hint: 'Out along one lane, U-turn, back along the other.' },
    { name: 'The plus', par: 8, rows: ['..*..', '..*..', '**^**', '..*..', '..*..'], hint: 'Visit one arm, come back to the centre, turn — 4 times.' },
    { name: 'Mow the lawn', par: 11, rows: ['>*****', '******', '******', '******'], hint: 'Two rows per loop: across, down, back, down.' }
  ];
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  var CH = { '^': 0, '>': 1, 'v': 2, '<': 3 };
  var LABEL = { fwd: 'Forward', left: 'Turn left', right: 'Turn right', rep: 'Repeat' };
  var ICON = { fwd: 'arrowUp', left: 'turnLeft', right: 'turnRight', rep: 'repeat' };

  function parse(lv) {
    var g = { w: lv.rows[0].length, h: lv.rows.length, walls: {}, gems: {}, start: null };
    lv.rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) { var c = r[x]; if (c === '#') g.walls[x + ',' + y] = 1; else if (c === '*') g.gems[x + ',' + y] = 1; else if (c in CH) g.start = { x: x, y: y, d: CH[c] }; } });
    return g;
  }
  function countChips(list) { var n = 0; list.forEach(function (it) { n++; if (it.t === 'rep') n += countChips(it.body); }); return n; }
  function flatten(list, out) {
    out = out || [];
    list.forEach(function (it) { if (it.t === 'rep') { for (var i = 0; i < it.n; i++) flatten(it.body, out); } else out.push(it); });
    return out;
  }
  /* pure simulation (used for checks and tests) */
  function simulate(lv, prog) {
    var g = parse(lv), x = g.start.x, y = g.start.y, d = g.start.d, left = Object.keys(g.gems).length, got = {}, steps = flatten(prog);
    for (var i = 0; i < steps.length && i < 500; i++) {
      var s = steps[i];
      if (s.t === 'left') d = (d + 3) % 4; else if (s.t === 'right') d = (d + 1) % 4;
      else { var nx = x + DIRS[d][0], ny = y + DIRS[d][1]; if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h || g.walls[nx + ',' + ny]) return { ok: false, crash: true, left: left }; x = nx; y = ny; if (g.gems[x + ',' + y] && !got[x + ',' + y]) { got[x + ',' + y] = 1; left--; if (!left) return { ok: true, left: 0, steps: i + 1 }; } }
    }
    return { ok: left === 0, left: left };
  }

  function create(host, ctx) {
    var U = D.arcade.util;
    var stars = D.store.get('arcade.gemrush.stars', {});
    var li = 0, lv, g, prog = [], selected = null, running = false, timers = [], robot, collected, cell = 50, raf = 0, activeId = null, mood = null;
    var uid = 0;

    var play = D.el('div', { class: 'ar-play' });
    var stage = D.el('div', { class: 'ar-stagewrap' }), canvas = D.el('canvas'); stage.appendChild(canvas);
    var banner = D.el('div', { class: 'ar-banner hidden' }); stage.appendChild(banner);
    var lvTag = D.el('div', { class: 'stage-overlay' }); stage.appendChild(lvTag);
    var side = D.el('div', { class: 'ar-side' });
    play.appendChild(stage); play.appendChild(side); host.appendChild(play);

    var p1 = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Levels' })));
    var b1 = D.el('div', { class: 'panel-body' }); p1.appendChild(b1); side.appendChild(p1);
    var levelsEl = D.el('div', { class: 'g-gemrush-levels' }); b1.appendChild(levelsEl);
    var p2 = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Program' }), D.el('span', { class: 'chip', id: '' })));
    var chipCount = p2.querySelector('.chip');
    var b2 = D.el('div', { class: 'panel-body' }); p2.appendChild(b2); side.appendChild(p2);
    var palette = D.el('div', { class: 'g-gemrush-palette' }); b2.appendChild(palette);
    ['fwd', 'left', 'right', 'rep'].forEach(function (t) {
      palette.appendChild(D.el('button', { class: 'g-gemrush-chip ' + t, html: D.icon(ICON[t]) + LABEL[t] + (t === 'rep' ? ' ×N' : ''), onclick: function () { add(t); } }));
    });
    var progEl = D.el('div', { class: 'g-gemrush-prog' }); b2.appendChild(progEl);
    var hintEl = D.el('div', { class: 'small faint' }); b2.appendChild(hintEl);
    var btnRun = D.el('button', { class: 'btn go', html: D.icon('play') + 'Run', onclick: run });
    b2.appendChild(D.el('div', { class: 'row' }, btnRun,
      D.el('button', { class: 'btn sm', html: D.icon('reset') + 'Reset', onclick: function () { stop(); place(); } }),
      D.el('button', { class: 'btn sm danger', html: D.icon('trash') + 'Clear', onclick: function () { stop(); prog = []; selected = null; renderProg(); place(); } })));

    function renderLevels() {
      levelsEl.innerHTML = '';
      LEVELS.forEach(function (L, i) {
        var s = stars[i] || 0;
        var bt = D.el('button', { class: 'btn' + (i === li ? ' active' : ''), html: (i + 1) + '<small>' + '★★★'.slice(0, s) + '<span style="opacity:.3">' + '★★★'.slice(0, 3 - s) + '</span></small>', title: L.name, onclick: function () { loadLevel(i); } });
        levelsEl.appendChild(bt);
      });
    }
    function loadLevel(i) {
      stop(); li = i; lv = LEVELS[i]; g = parse(lv); prog = []; selected = null;
      hintEl.innerHTML = D.icon('sparkle').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"') + ' Hint: ' + D.esc(lv.hint);
      renderLevels(); renderProg(); layout(); place();
      D.audit.log('arcade', 'Gem Rush level', (i + 1) + ' · ' + lv.name);
    }
    function place() {
      robot = { x: g.start.x, y: g.start.y, d: g.start.d, fx: g.start.x, fy: g.start.y, a: g.start.d * 90, fa: g.start.d * 90, t: 1 };
      collected = {}; mood = null; banner.classList.add('hidden'); activeId = null; renderProg(); updateTag();
    }
    function updateTag() {
      var total = Object.keys(g.gems).length, got = Object.keys(collected).length;
      lvTag.innerHTML = '<span class="chip accent">Level ' + (li + 1) + ' · ' + D.esc(lv.name) + '</span><span class="chip amber">' + D.icon('gem') + got + '/' + total + ' gems</span><span class="chip">Par ' + lv.par + ' blocks</span>';
      D.$$('.chip svg', lvTag).forEach(function (s) { s.style.width = '13px'; s.style.height = '13px'; });
    }

    function findList(id, list) {
      list = list || prog;
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; if (list[i].t === 'rep') { var r = findList(id, list[i].body); if (r) return r; } }
      return null;
    }
    function depth(id, list, dpt) {
      list = list || prog; dpt = dpt || 0;
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) return dpt; if (list[i].t === 'rep') { var r = depth(id, list[i].body, dpt + 1); if (r >= 0) return r; } }
      return -1;
    }
    function add(t) {
      if (running) return;
      var item = { id: ++uid, t: t };
      if (t === 'rep') { item.n = 2; item.body = []; }
      var target = selected ? findList(selected) : null;
      if (target && t === 'rep' && depth(selected) >= 1) { D.ui.toast('Repeats can be nested two levels deep.', 'warn'); return; }
      (target ? target.body : prog).push(item);
      if (t === 'rep') selected = item.id;
      D.sound.click(); renderProg(); place();
    }
    function remove(id, list) {
      list = list || prog;
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) { list.splice(i, 1); return true; } if (list[i].t === 'rep' && remove(id, list[i].body)) return true; }
      return false;
    }
    function renderList(list, el) {
      list.forEach(function (it) {
        if (it.t === 'rep') {
          var blk = D.el('div', { class: 'g-gemrush-rep' + (selected === it.id ? ' sel' : '') + (activeId === it.id ? ' active' : '') });
          var inp = D.el('input', { type: 'number', min: 1, max: 9, value: it.n });
          inp.addEventListener('click', function (e) { e.stopPropagation(); });
          inp.addEventListener('change', function () { it.n = D.clamp(parseInt(inp.value, 10) || 1, 1, 9); inp.value = it.n; place(); });
          var head = D.el('div', { class: 'head' }, D.iconEl('repeat'), D.el('span', { text: 'Repeat' }), inp, D.el('span', { text: '×' }), D.el('span', { class: 'spacer' }),
            D.el('button', { class: 'btn xs ' + (selected === it.id ? 'active' : 'ghost'), title: 'Add the next blocks inside this repeat', html: selected === it.id ? '● here' : '+ in', onclick: function (e) { e.stopPropagation(); selected = selected === it.id ? null : it.id; renderProg(); } }),
            D.el('button', { class: 'btn xs ghost', html: '×', title: 'Remove', onclick: function (e) { e.stopPropagation(); if (running) return; remove(it.id); if (selected === it.id) selected = null; renderProg(); place(); } }));
          head.querySelector('svg').style.cssText = 'width:14px;height:14px';
          blk.appendChild(head);
          var inner = D.el('div', { class: 'inner' });
          if (!it.body.length) inner.appendChild(D.el('span', { class: 'small faint', text: selected === it.id ? 'Click blocks above to fill me' : 'empty' }));
          renderList(it.body, inner);
          blk.appendChild(inner);
          blk.addEventListener('click', function () { selected = selected === it.id ? null : it.id; renderProg(); });
          el.appendChild(blk);
        } else {
          var chip = D.el('button', { class: 'g-gemrush-chip ' + it.t + (activeId === it.id ? ' active' : ''), html: D.icon(ICON[it.t]) + LABEL[it.t] + '<span class="x">×</span>', title: 'Click to remove' });
          chip.addEventListener('click', function (e) { e.stopPropagation(); if (running) return; remove(it.id); renderProg(); place(); });
          el.appendChild(chip);
        }
      });
    }
    function renderProg() {
      progEl.innerHTML = '';
      if (!prog.length) progEl.appendChild(D.el('span', { class: 'small faint', text: 'Click the blocks above to build a program.' }));
      renderList(prog, progEl);
      var n = countChips(prog);
      chipCount.textContent = n + ' block' + (n === 1 ? '' : 's') + ' · par ' + (lv ? lv.par : '');
      chipCount.className = 'chip ' + (lv && n && n <= lv.par ? 'green' : '');
    }
    function stop() { timers.forEach(clearTimeout); timers = []; running = false; btnRun.disabled = false; activeId = null; }

    function run() {
      if (running) return;
      if (!prog.length) { D.ui.toast('Add some blocks first.', 'warn'); return; }
      place(); running = true; btnRun.disabled = true;
      var steps = flatten(prog), i = 0;
      D.audit.log('arcade', 'Gem Rush run', 'Level ' + (li + 1) + ' · ' + countChips(prog) + ' blocks');
      function next() {
        if (!running) return;
        if (i >= steps.length || i > 400) return end(false);
        var s = steps[i++]; activeId = s.id; renderProg();
        robot.fx = robot.x; robot.fy = robot.y; robot.fa = robot.a; robot.t = 0;
        if (s.t === 'left') { robot.d = (robot.d + 3) % 4; robot.a -= 90; D.sound.beep(600, .04, 'triangle'); }
        else if (s.t === 'right') { robot.d = (robot.d + 1) % 4; robot.a += 90; D.sound.beep(700, .04, 'triangle'); }
        else {
          var nx = robot.x + DIRS[robot.d][0], ny = robot.y + DIRS[robot.d][1];
          if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h || g.walls[nx + ',' + ny]) { mood = 'hurt'; D.sound.bump(); return end(false, true); }
          robot.x = nx; robot.y = ny; D.sound.move();
        }
        timers.push(setTimeout(function () {
          var k = robot.x + ',' + robot.y;
          if (g.gems[k] && !collected[k]) { collected[k] = 1; D.sound.beep(1200, .06, 'sine'); updateTag(); if (Object.keys(collected).length === Object.keys(g.gems).length) return end(true); }
          next();
        }, 260));
      }
      next();
    }
    function end(ok, crash) {
      running = false; btnRun.disabled = false; activeId = null; renderProg();
      var n = countChips(prog);
      banner.innerHTML = '';
      if (ok) {
        mood = 'happy';
        var s = n <= lv.par ? 3 : n <= lv.par + 2 ? 2 : 1;
        var prev = stars[li] || 0;
        if (s > prev) { stars[li] = s; D.store.set('arcade.gemrush.stars', stars); }
        var total = 0; for (var k in stars) total += stars[k];
        D.sound.win();
        ctx.reportScore(total * 100, total + ' stars over ' + LEVELS.length + ' levels');
        D.audit.log('arcade', 'Gem Rush solved', 'Level ' + (li + 1) + ' with ' + n + ' blocks (par ' + lv.par + ') · ' + s + '★', 'success');
        banner.appendChild(D.el('h2', { text: '★★★'.slice(0, s) + '☆☆☆'.slice(0, 3 - s) }));
        banner.appendChild(D.el('p', { html: 'All gems collected with <b>' + n + '</b> blocks (par ' + lv.par + ').' + (s < 3 ? ' Can you do it in ' + lv.par + '?' : ' Perfect program!') }));
        var row = D.el('div', { class: 'row' });
        row.appendChild(D.el('button', { class: 'btn', text: 'Improve', onclick: function () { place(); } }));
        if (li < LEVELS.length - 1) row.appendChild(D.el('button', { class: 'btn primary', html: 'Next level' + D.icon('arrowRight'), onclick: function () { loadLevel(li + 1); } }));
        banner.appendChild(row);
        renderLevels();
      } else {
        D.sound.bad();
        banner.appendChild(D.el('h2', { text: crash ? 'Bonk!' : 'Gems left behind' }));
        banner.appendChild(D.el('p', { text: crash ? 'The robot drove into a wall or off the board.' : (Object.keys(g.gems).length - Object.keys(collected).length) + ' gem(s) were not collected.' }));
        banner.appendChild(D.el('button', { class: 'btn primary', html: D.icon('reset') + 'Try again', onclick: function () { place(); } }));
      }
      banner.classList.remove('hidden');
    }

    function layout() {
      if (!g) return;
      var r = stage.getBoundingClientRect();
      cell = Math.floor(Math.min((r.width - 40) / g.w, (r.height - 90) / g.h, 96));
      U.fit(canvas, cell * g.w, cell * g.h);
    }
    function draw() {
      raf = requestAnimationFrame(draw);
      if (!g) return;
      var c = canvas.getContext('2d'), C = U.colors();
      c.clearRect(0, 0, cell * g.w, cell * g.h);
      for (var y = 0; y < g.h; y++) for (var x = 0; x < g.w; x++) {
        var k = x + ',' + y;
        if (g.walls[k]) { c.fillStyle = C.wall; U.rr(c, x * cell + 1, y * cell + 1, cell - 2, cell - 2, 6); c.fill(); c.fillStyle = C.wallTop; U.rr(c, x * cell + 3, y * cell + 3, cell - 6, cell - 9, 5); c.fill(); continue; }
        c.fillStyle = C.floor; U.rr(c, x * cell + 1, y * cell + 1, cell - 2, cell - 2, 6); c.fill(); c.strokeStyle = C.line; c.stroke();
        if (g.gems[k] && !collected[k]) {
          var cx = x * cell + cell / 2, cy = y * cell + cell / 2 + Math.sin(performance.now() / 300 + x + y) * 2, s = cell * .22;
          c.fillStyle = C.violet; c.beginPath(); c.moveTo(cx, cy - s); c.lineTo(cx + s, cy - s * .2); c.lineTo(cx, cy + s * 1.1); c.lineTo(cx - s, cy - s * .2); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(cx, cy - s); c.lineTo(cx + s * .4, cy - s * .2); c.lineTo(cx - s * .4, cy - s * .2); c.closePath(); c.fill();
        }
      }
      robot.t = Math.min(1, robot.t + 0.09);
      var e = robot.t < 1 ? 1 - Math.pow(1 - robot.t, 3) : 1;
      var rx = D.lerp(robot.fx, robot.x, e), ry = D.lerp(robot.fy, robot.y, e), ra = D.lerp(robot.fa, robot.a, e);
      U.bot(c, rx * cell + cell / 2, ry * cell + cell / 2, cell * .78, (ra - 90) * Math.PI / 180, C.accent, mood);
    }

    var ro = new ResizeObserver(function () { layout(); }); ro.observe(stage);
    loadLevel(0); raf = requestAnimationFrame(draw);
    return {
      destroy: function () { stop(); cancelAnimationFrame(raf); ro.disconnect(); },
      _test: {
        setProgram: function (p) { stop(); prog = JSON.parse(JSON.stringify(p)); (function idify(l) { l.forEach(function (it) { it.id = ++uid; if (it.body) idify(it.body); }); })(prog); renderProg(); place(); },
        run: run, load: loadLevel, state: function () { return { running: running, collected: Object.keys(collected).length, total: Object.keys(g.gems).length, level: li, banner: !banner.classList.contains('hidden'), title: banner.querySelector('h2') && banner.querySelector('h2').textContent }; }
      }
    };
  }

  var g = A.wrap;
  D.arcade.register({
    id: 'gemrush', title: 'Gem Rush', tagline: 'A coding puzzle: write the shortest program that collects every gem. 8 levels, 3 stars each.',
    icon: 'gem', color: '--amber', cv: null, controls: 'Mouse',
    guide: {
      howto: [
        { title: 'Look at the board', text: 'The robot starts on its tile facing the direction of its nose. Purple gems must all be collected.', svg: g(A.grid(25, 34, 5, 2, 20) + A.bot(35, 44, 15, 0) + '<path d="M70 38l6 6-6 8-6-8z" fill="var(--violet)"/><path d="M90 38l6 6-6 8-6-8z" fill="var(--violet)"/>') },
        { title: 'Click blocks', text: 'Click <b>Forward</b>, <b>Turn left</b>, <b>Turn right</b> to add them to the program. Click a block in the program to remove it.', svg: g(A.card(14, 24, 58, '↑ Forward', '#0ea5c6') + A.card(78, 24, 58, '↷ Turn right', '#db2777') + A.arrow(75, 48, 75, 64) + A.card(30, 70, 90, '↑ Forward ×', '#0ea5c6')) },
        { title: 'Use Repeat', text: 'Add <b>Repeat</b>, set how many times, then click blocks while it says “adding here” to put them inside. Repeats can contain a repeat.', svg: g('<rect x="20" y="22" width="110" height="60" rx="8" fill="rgba(217,119,6,.15)" stroke="var(--amber)"/>' + A.text(28, 38, '⟳ Repeat 4 times', 9, 'var(--amber)', 700) + A.card(28, 48, 60, '↑ Forward', '#0ea5c6')) },
        { title: 'Run it', text: 'Press <b>Run</b>. The block being executed glows while the robot moves. Hitting a wall stops the run.', svg: g(A.btn(45, 40, 60, '▶ Run', true) + A.cursor(85, 50)) },
        { title: 'Earn stars', text: '★★★ when your program uses no more blocks than par, ★★ within par+2, ★ otherwise. Every block — including Repeat — counts as one.', svg: g(A.text(36, 62, '★★★', 30, 'var(--amber)', 700)) }
      ],
      tips: 'Look for patterns: anything you would write twice can probably become a Repeat.',
      about: {
        hero: '<svg viewBox="0 0 560 150"><rect width="560" height="150" fill="var(--bg-2)"/><g transform="translate(30 25)"><rect width="200" height="100" rx="10" fill="rgba(217,119,6,.15)" stroke="var(--amber)"/><text x="12" y="24" font-size="13" font-weight="700" fill="var(--amber)">⟳ Repeat 4</text><rect x="12" y="34" width="110" height="24" rx="6" fill="#0ea5c6"/><text x="22" y="51" font-size="12" fill="#fff" font-weight="600">↑ Forward ×4</text><rect x="12" y="64" width="110" height="24" rx="6" fill="#db2777"/><text x="22" y="81" font-size="12" fill="#fff" font-weight="600">↷ Turn right</text></g><path d="M250 75h60" stroke="var(--accent)" stroke-width="3" stroke-dasharray="6 4"/>' + (function () { var s = ''; for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) s += '<rect x="' + (330 + x * 28) + '" y="' + (20 + y * 28) + '" width="26" height="26" rx="4" fill="var(--grid-floor)" stroke="var(--grid-line)"/>'; return s; })() + '<rect x="330" y="20" width="110" height="110" rx="4" fill="none" stroke="var(--violet)" stroke-width="3"/></svg>',
        intro: 'Gem Rush teaches the core idea of programming a robot: break a route into instructions, then compress repeated patterns with loops. Fewer blocks means a more elegant program.',
        facts: [['8', 'levels'], ['24', 'stars'], ['2', 'loop depth']],
        sections: [
          { title: 'Why “par”?', html: '<p>Par is the smallest number of blocks we found. Matching it means you spotted every repeating pattern — the same skill that makes real robot code shorter and easier to maintain.</p>' },
          { title: 'Scoring', html: '<p>Your Arcade score is 100 × the total stars you hold across all levels. Stars are kept between sessions.</p>' }
        ]
      }
    },
    create: create
  });
  D.arcade._gemrush = { LEVELS: LEVELS, simulate: simulate };
})(window);
