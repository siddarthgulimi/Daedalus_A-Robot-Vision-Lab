/* theseus.js — THESEUS · Maze Lab
   Build square, circular or hexagonal mazes, carve / demolish walls, move the start and the goal,
   add constraints (mud, battery, fog of war) and watch Theseus solve it with different algorithms. */
(function (global) {
  'use strict';
  var D = global.D, M = D.Maze;

  var SIZE_RANGE = { square: [6, 40], hex: [6, 34], circle: [4, 16] };
  var DEFAULT_CFG = {
    shape: 'square', size: { square: 16, hex: 14, circle: 8 }, algo: 'backtracker', seed: 1234, braid: 0,
    solver: 'astar', mudCost: 4, budgetOn: false, budget: 120, fog: false, speed: 6, animate: true
  };
  var cfg, maze, start, goal, view, tool = 'start', run = null, timer = null, animTimer = null, busy = false;
  var ui = {};

  function loadCfg() {
    var s = D.store.get('theseus.cfg', {});
    cfg = Object.assign({}, DEFAULT_CFG, s);
    cfg.size = Object.assign({}, DEFAULT_CFG.size, s.size || {});
  }
  function saveCfg() { D.store.set('theseus.cfg', cfg); }

  function dims() {
    var n = cfg.size[cfg.shape];
    if (cfg.shape === 'circle') return { shape: 'circle', rings: n };
    if (cfg.shape === 'hex') return { shape: 'hex', cols: n, rows: Math.max(4, Math.round(n * 0.8)) };
    return { shape: 'square', cols: n, rows: Math.max(4, Math.round(n / 1.45)) };
  }
  function sizeLabel() {
    var d = dims();
    return d.shape === 'circle' ? d.rings + ' rings' : d.cols + ' × ' + d.rows;
  }

  /* ------------------------------------------------------------ helpers */
  function field(label, control, hint) {
    return D.el('div', { class: 'field' }, D.el('label', { html: label }), control, hint ? D.el('div', { class: 'small faint', html: hint }) : null);
  }
  function select(options, value, onChange) {
    var s = D.el('select', { class: 'input' });
    options.forEach(function (o) { var op = D.el('option', { value: o.id, text: o.label }); if (o.id === value) op.selected = true; s.appendChild(op); });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  function range(min, max, val, onInput, step) {
    var r = D.el('input', { type: 'range', min: min, max: max, value: val, step: step || 1, class: 'grow' });
    r.addEventListener('input', function () { onInput(Number(r.value)); });
    return r;
  }
  function panel(title, eyebrow, body, extra) {
    return D.el('div', { class: 'panel' },
      D.el('div', { class: 'panel-head' }, D.el('h3', { text: title }), D.el('span', { class: 'spacer' }), D.el('span', { class: 'th-eyebrow', text: eyebrow }), extra || null),
      D.el('div', { class: 'panel-body th-pbody' }, body));
  }
  function speedMs() { return Math.round(420 * Math.pow(0.66, cfg.speed - 1)) + 8; }
  function solverInfo(id) { return M.SOLVERS.filter(function (s) { return s.id === id; })[0]; }
  function effectiveSolver() {
    var s = solverInfo(cfg.solver);
    return cfg.fog && s.global ? 'tremaux' : cfg.solver;
  }

  /* ------------------------------------------------------------ build / generate */
  function buildMaze(animate) {
    stopRun(true);
    clearTimeout(animTimer); setBusy(false);
    maze = M.create(dims());
    var order = M.generate(maze, cfg.algo, cfg.seed);
    var extra = M.braid(maze, cfg.braid / 100, cfg.seed + 1);
    var d = M.defaults(maze); start = d.start; goal = d.goal;
    if (view) view.setMaze(maze);
    view.set({ start: start, goal: goal, path: null, visited: null, fog: null, trail: null, flashes: [], resetRobot: true });
    ui.sizeVal.textContent = sizeLabel();
    if (animate && cfg.animate) carveAnimation(order.concat(extra));
    else afterChange();
    D.audit.log('theseus', 'Generated maze', sizeLabel() + ' ' + shapeName() + ' · ' + genName() + ' · seed ' + cfg.seed + (cfg.braid ? ' · loops ' + cfg.braid + '%' : ''), 'info',
      { shape: cfg.shape, algo: cfg.algo, seed: cfg.seed, braid: cfg.braid, cells: maze.cells.length });
    saveCfg();
  }
  function shapeName() { return { square: 'square', circle: 'circular', hex: 'hexagonal' }[cfg.shape]; }
  function genName() { return M.GENERATORS.filter(function (g) { return g.id === cfg.algo; })[0].label; }

  function carveAnimation(order) {
    clearTimeout(animTimer);
    M.clearLinks(maze);
    setBusy(true);
    var i = 0, batch = Math.max(1, Math.round(order.length / 110));
    (function step() {
      if (!view || view.dead) return;
      for (var k = 0; k < batch && i < order.length; k++, i++) M.link(maze, order[i][0], order[i][1]);
      view.set({ hover: order[Math.min(i, order.length) - 1] ? order[Math.min(i, order.length) - 1][1] : -1 });
      if (i % (batch * 6) === 0) D.sound.beep(300 + (i / order.length) * 600, 0.02, 'triangle', 0.02);
      if (i < order.length) animTimer = setTimeout(step, 14);
      else { view.set({ hover: -1 }); setBusy(false); afterChange(); D.sound.good(); }
    })();
  }

  function demolish() {
    if (busy) return;
    stopRun(true);
    var walls = [];
    maze.cells.forEach(function (c) { c.nb.forEach(function (n) { if (n > c.id && !M.linked(maze, c.id, n)) walls.push([c.id, n]); }); });
    if (!walls.length) { D.ui.toast('No walls left to knock down!', 'warn'); return; }
    var r = M.rng((Math.random() * 1e9) | 0);
    for (var i = walls.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = walls[i]; walls[i] = walls[j]; walls[j] = t; }
    var n = Math.min(60, Math.max(3, Math.round(walls.length * 0.1)));
    var hit = walls.slice(0, n), k = 0;
    setBusy(true);
    (function boom() {
      if (!view || view.dead) return;
      var w = hit[k++];
      M.link(maze, w[0], w[1]);
      view.s.flashes.push({ a: w[0], b: w[1], t: performance.now() });
      if (k % 2 === 0) D.sound.bump();
      if (k < hit.length) animTimer = setTimeout(boom, Math.max(20, 900 / hit.length));
      else { setBusy(false); afterChange(); }
    })();
    D.audit.log('theseus', 'Demolished walls', n + ' walls knocked out — the maze now has more routes', 'warn', { walls: n });
  }

  function setBusy(b) {
    busy = b;
    D.$$('[data-busy]', ui.root).forEach(function (x) { x.disabled = b; });
  }

  /* ------------------------------------------------------------ analysis */
  function afterChange() {
    view.set({ path: null, visited: null, trail: null, fog: null });
    var a = M.analyze(maze, start, goal, cfg.mudCost);
    ui.mstats.innerHTML = '';
    [['Cells', a.cells], ['Dead ends', a.deadEnds], ['Junctions', a.junctions], ['Loops', a.loops],
      ['Shortest route', a.reachable ? a.shortestLen + ' steps' : '—'], ['Distinct shortest', a.reachable ? (a.shortestPaths > 9999 ? '9999+' : a.shortestPaths) : '—']]
      .forEach(function (p) { ui.mstats.appendChild(D.el('div', { class: 'th-mini' }, D.el('span', { text: p[0] }), D.el('b', { text: String(p[1]) }))); });
    ui.unreach.classList.toggle('hidden', a.reachable);
    ui.chipCells.innerHTML = D.icon(cfg.shape === 'circle' ? 'circle' : cfg.shape === 'hex' ? 'hex' : 'grid') + sizeLabel() + ' · ' + a.cells + ' cells';
    ui.chipRoutes.textContent = a.reachable ? (a.shortestPaths > 1 || a.loops ? 'Multiple routes' : 'Single route') : 'No route';
    ui.chipRoutes.className = 'chip ' + (a.reachable ? (a.loops ? 'violet' : 'accent') : 'red');
    clearResult();
    return a;
  }

  /* ------------------------------------------------------------ solving */
  function prepareRun() {
    var algo = effectiveSolver();
    var res = M.solve(maze, start, goal, algo, { mudCost: cfg.mudCost });
    var walk = res.walk.length ? res.walk : [start];
    var budgetCut = false;
    if (cfg.budgetOn && walk.length - 1 > cfg.budget) { walk = walk.slice(0, cfg.budget + 1); budgetCut = true; }
    run = { res: res, algo: algo, walk: walk, budgetCut: budgetCut, phase: cfg.fog ? 'walk' : 'explore', i: 0, fog: cfg.fog ? {} : null, t0: performance.now() };
    view.set({ path: null, trail: [start], visited: cfg.fog ? [] : res.visitedOrder, visitedUpto: 0, fog: run.fog });
    view.setRobot(start, true);
    if (run.fog) reveal(start);
    ui.status.textContent = solverInfo(algo).short + (algo !== cfg.solver ? ' (fog forces a map-less robot)' : '') + ' · ' + (run.phase === 'explore' ? 'thinking…' : 'driving…');
  }
  function reveal(id) {
    run.fog[id] = 1;
    M.linksOf(maze, id).forEach(function (n) { run.fog[n] = 1; });
    view.s.fog = run.fog;
  }
  function tick() {
    if (!run) prepareRun();
    if (run.phase === 'explore') {
      var batch = Math.max(1, Math.round(run.res.visitedOrder.length / 70));
      view.s.visitedUpto += batch; view.render();
      if (view.s.visitedUpto % (batch * 4) < batch) D.sound.beep(700, 0.015, 'sine', 0.015);
      if (view.s.visitedUpto >= run.res.visitedOrder.length) { view.s.visitedUpto = Infinity; run.phase = 'walk'; ui.status.textContent = solverInfo(run.algo).short + ' · driving…'; }
      return;
    }
    if (run.phase === 'walk') {
      run.i++;
      if (run.i >= run.walk.length) { finishRun(); return; }
      var id = run.walk[run.i];
      view.setRobot(id);
      if (run.fog) { reveal(id); view.s.visited = Object.keys(run.fog).map(Number); }
      view.s.trail = run.walk.slice(0, run.i + 1);
      D.sound.move();
      ui.liveSteps.textContent = run.i;
      if (cfg.budgetOn) ui.battery.style.width = Math.max(0, 100 - run.i / cfg.budget * 100) + '%';
    }
  }
  function finishRun() {
    pause();
    var r = run.res, ok = r.found && !run.budgetCut;
    run.phase = 'done';
    if (ok) view.set({ path: r.path });
    var a = M.analyze(maze, start, goal, cfg.mudCost);
    var robotCost = costOf(run.walk);
    var eff = ok && robotCost ? Math.round(a.optimalCost / robotCost * 100) : 0;
    showResult({
      ok: ok, algo: run.algo, steps: run.walk.length - 1, cost: costOf(run.walk), explored: run.fog ? Object.keys(run.fog).length : r.explored,
      pathLen: ok ? r.path.length - 1 : 0, eff: eff, budgetCut: run.budgetCut, optimal: a.optimalCost
    });
    if (ok) { D.sound.win(); ui.status.textContent = 'Goal reached!'; }
    else { D.sound.bad(); ui.status.textContent = run.budgetCut ? 'Battery empty before the goal' : 'No route found'; }
    D.audit.log('theseus', ok ? 'Solved maze' : 'Solve failed', solverInfo(run.algo).label + ' · ' + (run.walk.length - 1) + ' moves · cost ' + costOf(run.walk) + ' · explored ' + r.explored + (ok ? ' · efficiency ' + eff + '%' : run.budgetCut ? ' · battery depleted' : ''),
      ok ? 'success' : 'warn', { solver: run.algo, steps: run.walk.length - 1, explored: r.explored, efficiency: eff, fog: cfg.fog, budget: cfg.budgetOn ? cfg.budget : null });
  }
  function costOf(walk) { var s = 0; for (var i = 1; i < walk.length; i++) s += maze.mud[walk[i]] ? cfg.mudCost : 1; return s; }

  function play() {
    if (busy) return;
    if (!M.reachable(maze, start, goal)) { D.ui.toast('The goal cannot be reached. Open a wall or move the start / goal.', 'warn'); return; }
    if (run && run.phase === 'done') run = null;
    if (!run) prepareRun();
    clearInterval(timer); timer = setInterval(tick, speedMs());
    ui.play.classList.add('hidden'); ui.pause.classList.remove('hidden');
    D.audit.log('theseus', 'Run started', solverInfo(effectiveSolver()).label + (cfg.fog ? ' · fog of war' : '') + (cfg.budgetOn ? ' · battery ' + cfg.budget : ''));
  }
  function pause() { clearInterval(timer); timer = null; if (ui.play) { ui.play.classList.remove('hidden'); ui.pause.classList.add('hidden'); } }
  function step() { if (busy) return; pause(); if (run && run.phase === 'done') run = null; tick(); }
  function stopRun(silent) {
    pause(); run = null;
    if (view) { view.set({ path: null, visited: null, trail: null, fog: null }); view.setRobot(start, true); }
    if (ui.status) ui.status.textContent = 'Ready';
    if (ui.liveSteps) ui.liveSteps.textContent = '0';
    if (ui.battery) ui.battery.style.width = '100%';
    if (!silent) clearResult();
  }
  function clearResult() { if (ui.result) { ui.result.innerHTML = '<div class="small faint">Press <b>Run</b> to watch Theseus think, then drive.</div>'; } }
  function showResult(o) {
    ui.result.innerHTML = '';
    var head = D.el('div', { class: 'callout ' + (o.ok ? '' : 'warn'), html: D.icon(o.ok ? 'check' : 'info') + '<div><b>' + (o.ok ? 'Goal reached' : o.budgetCut ? 'Battery ran out' : 'No route') + '</b> · ' + solverInfo(o.algo).short + '</div>' });
    ui.result.appendChild(head);
    var g = D.el('div', { class: 'th-stats' });
    [['Moves driven', o.steps], ['Route length', o.pathLen || '—'], ['Cost', o.cost], ['Cells explored', o.explored], ['Optimal cost', o.optimal], ['Efficiency', o.ok ? o.eff + '%' : '—']]
      .forEach(function (p) { g.appendChild(D.el('div', { class: 'th-mini' }, D.el('span', { text: p[0] }), D.el('b', { text: String(p[1]) }))); });
    ui.result.appendChild(g);
  }

  /* ------------------------------------------------------------ compare */
  function compare() {
    if (!M.reachable(maze, start, goal)) { D.ui.toast('Goal is unreachable — nothing to compare.', 'warn'); return; }
    var rows = M.SOLVERS.map(function (s) {
      var r = M.solve(maze, start, goal, s.id, { mudCost: cfg.mudCost });
      var walk = r.walk.length ? r.walk : [];
      var cost = costOf(walk), budgetFail = cfg.budgetOn && walk.length - 1 > cfg.budget;
      return { s: s, r: r, steps: walk.length - 1, cost: cost, ok: r.found && !budgetFail, budgetFail: budgetFail };
    });
    var a = M.analyze(maze, start, goal, cfg.mudCost);
    var maxE = Math.max.apply(null, rows.map(function (x) { return x.r.explored; })) || 1;
    var maxC = Math.max.apply(null, rows.map(function (x) { return x.cost; })) || 1;
    var best = rows.filter(function (x) { return x.ok; }).sort(function (p, q) { return p.cost - q.cost || p.r.explored - q.r.explored; })[0];
    var tbl = '<table class="table"><thead><tr><th>Solver</th><th>Result</th><th>Moves</th><th>Cost</th><th>Explored</th><th>Efficiency</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var eff = x.ok && x.cost ? Math.round(a.optimalCost / x.cost * 100) : 0;
        return '<tr><td><b>' + x.s.short + '</b><div class="small faint">' + (x.s.global ? 'knows the map' : 'no map, drives & explores') + '</div></td><td>' +
          (x.ok ? '<span class="chip green">reached</span>' : '<span class="chip red">' + (x.budgetFail ? 'battery' : 'failed') + '</span>') + '</td><td>' + x.steps + '</td><td>' + x.cost + '</td><td>' + x.r.explored + '</td><td>' + (x.ok ? eff + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
    function bars(title, key, max, color) {
      return '<div><div class="th-cmp-title">' + title + '</div><div class="bars">' + rows.map(function (x) {
        var v = key === 'cost' ? x.cost : x.r.explored;
        return '<div class="bar-row"><span class="lbl">' + x.s.short + '</span><div class="track"><div class="fill" style="width:' + (v / max * 100).toFixed(1) + '%;background:var(' + color + ')"></div></div><span class="num">' + v + '</span></div>';
      }).join('') + '</div></div>';
    }
    var html = '<p class="muted">Same maze, same start and goal' + (Object.keys(maze.mud).length ? ', mud costs ' + cfg.mudCost + '×' : '') + (cfg.budgetOn ? ', battery ' + cfg.budget + ' moves' : '') + '. Lower is better.</p>' +
      (best ? '<div class="callout" style="margin:10px 0">' + D.icon('trophy') + '<div><b>' + best.s.label + '</b> wins: cheapest route with ' + best.r.explored + ' cells explored.</div></div>' : '') +
      '<div class="th-cmp-wrap">' + tbl + '</div><div class="grid-2" style="margin-top:14px">' + bars('Cells explored (thinking effort)', 'explored', maxE, '--accent') + bars('Route cost (driving effort)', 'cost', maxC, '--amber') + '</div>';
    D.ui.modal(html, { title: 'Solver showdown', width: 760, actions: [{ label: 'Close', kind: 'primary' }] });
    D.audit.log('theseus', 'Compared solvers', rows.length + ' solvers · winner ' + (best ? best.s.short : 'none'), 'info',
      { results: rows.map(function (x) { return { solver: x.s.id, ok: x.ok, moves: x.steps, cost: x.cost, explored: x.r.explored }; }) });
  }

  /* ------------------------------------------------------------ canvas editing */
  function bindCanvas(canvas) {
    var dragFrom = -1, painted = 0, toggled = 0, down = false;
    canvas.addEventListener('pointermove', function (e) {
      var id = view.hitTest(e.clientX, e.clientY);
      if (view.s.hover !== id) view.set({ hover: id });
      if (!down || busy || id < 0) return;
      if (tool === 'wall' && dragFrom >= 0 && id !== dragFrom) {
        if (M.toggle(maze, dragFrom, id)) { toggled++; D.sound.click(); }
        dragFrom = id;
        if (run) stopRun(true);
        view.render();
      } else if (tool === 'mud' || tool === 'erase') paint(id);
    });
    canvas.addEventListener('pointerleave', function () { view.set({ hover: -1 }); });
    canvas.addEventListener('pointerdown', function (e) {
      if (busy) return;
      var id = view.hitTest(e.clientX, e.clientY); if (id < 0) return;
      down = true; canvas.setPointerCapture(e.pointerId);
      if (tool === 'start' || tool === 'goal') {
        if ((tool === 'start' && id === goal) || (tool === 'goal' && id === start)) { D.ui.toast('Start and goal must be different cells.', 'warn'); return; }
        if (tool === 'start') start = id; else goal = id;
        stopRun(true);
        view.set({ start: start, goal: goal, resetRobot: true });
        var a = afterChange();
        D.sound.click();
        D.audit.log('theseus', tool === 'start' ? 'Moved start' : 'Moved goal', 'Cell #' + id + (a.reachable ? ' · shortest route ' + a.shortestLen + ' steps' : ' · unreachable'));
      } else if (tool === 'wall') { dragFrom = id; toggled = 0; }
      else { painted = 0; paint(id); }
    });
    canvas.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (tool === 'wall' && toggled) { afterChange(); D.audit.log('theseus', 'Edited walls', toggled + ' passage(s) toggled by hand'); }
      if ((tool === 'mud' || tool === 'erase') && painted) { afterChange(); D.audit.log('theseus', tool === 'mud' ? 'Painted mud' : 'Erased mud', painted + ' cell(s)'); }
      dragFrom = -1;
    });
    function paint(id) {
      var has = !!maze.mud[id];
      if (tool === 'mud' && !has) { maze.mud[id] = true; painted++; }
      else if (tool === 'erase' && has) { delete maze.mud[id]; painted++; }
      else return;
      if (run) stopRun(true);
      view.render();
    }
  }

  /* ------------------------------------------------------------ page */
  function mount(el) {
    loadCfg();
    ui.root = el;
    el.appendChild(D.ui.pageHead({ title: 'Theseus', tag: 'Maze lab', badge: D.avatar('theseus'),
      sub: 'Generate square, circular or hex mazes · move start & goal · add constraints · compare how robots solve them', guide: 'theseus' }));
    var body = D.el('div', { class: 'page-body fill' });
    var layout = D.el('div', { class: 'th-layout' });
    body.appendChild(layout); el.appendChild(body);

    /* ---- left: build ---- */
    var left = D.el('div', { class: 'th-col' });
    var shapeSeg = D.ui.seg([['square', 'Square', 'grid'], ['circle', 'Circle', 'circle'], ['hex', 'Hex', 'hex']], cfg.shape, function (v) {
      cfg.shape = v; var rg = SIZE_RANGE[v]; ui.size.min = rg[0]; ui.size.max = rg[1]; ui.size.value = cfg.size[v]; buildMaze(true);
    }, 'full');
    ui.sizeVal = D.el('b', { class: 'mono', text: '' });
    var rg = SIZE_RANGE[cfg.shape];
    ui.size = range(rg[0], rg[1], cfg.size[cfg.shape], function (v) { cfg.size[cfg.shape] = v; ui.sizeVal.textContent = sizeLabel(); });
    ui.size.addEventListener('change', function () { buildMaze(false); });
    var gen = select(M.GENERATORS, cfg.algo, function (v) { cfg.algo = v; genDesc.textContent = M.GENERATORS.filter(function (g) { return g.id === v; })[0].desc; buildMaze(true); });
    var genDesc = D.el('div', { class: 'small faint', text: M.GENERATORS.filter(function (g) { return g.id === cfg.algo; })[0].desc });
    var seed = D.el('input', { class: 'input grow mono', type: 'number', value: cfg.seed });
    seed.addEventListener('change', function () { cfg.seed = Number(seed.value) || 1; buildMaze(true); });
    var dice = D.el('button', { class: 'btn icon', title: 'New random seed', html: D.icon('dice'), 'data-busy': 1, onclick: function () { cfg.seed = (Math.random() * 99999) | 0; seed.value = cfg.seed; buildMaze(true); } });
    var animSw = D.ui.switchEl(cfg.animate, function (v) { cfg.animate = v; saveCfg(); });
    ui.braidVal = D.el('b', { class: 'mono', text: cfg.braid + '%' });
    var braid = range(0, 100, cfg.braid, function (v) { cfg.braid = v; ui.braidVal.textContent = v + '%'; });
    braid.addEventListener('change', function () { buildMaze(false); });

    left.appendChild(panel('Build the maze', 'Construct', D.el('div', { class: 'col' },
      field('Shape', shapeSeg),
      field('<span class="row">Size<span class="spacer"></span></span>', D.el('div', { class: 'row' }, ui.size, ui.sizeVal)),
      field('Generator', gen, null), genDesc,
      field('Seed (same seed = same maze)', D.el('div', { class: 'row' }, seed, dice)),
      D.el('label', { class: 'row small' }, animSw, D.el('span', { text: 'Animate carving' })),
      D.el('button', { class: 'btn primary', 'data-busy': 1, html: D.icon('wand') + 'Generate maze', onclick: function () { buildMaze(true); } }),
      field('Loops · multiple routes', D.el('div', { class: 'row' }, braid, ui.braidVal), '0% = perfect maze (exactly one route). Higher = dead ends opened into loops.')
    )));

    var tools = D.el('div', { class: 'th-tools' });
    [['start', 'Start', 'robot'], ['goal', 'Goal', 'flag'], ['wall', 'Wall', 'hammer'], ['mud', 'Mud', 'mud'], ['erase', 'Clean', 'eraser']].forEach(function (t) {
      var b = D.el('button', { class: 'th-tool' + (t[0] === tool ? ' on' : ''), html: D.icon(t[2]) + '<span>' + t[1] + '</span>', title: t[1] });
      b.addEventListener('click', function () { tool = t[0]; D.$$('.th-tool', tools).forEach(function (x) { x.classList.toggle('on', x === b); }); toolHint.innerHTML = TOOL_HINT[tool]; D.sound.click(); });
      tools.appendChild(b);
    });
    var TOOL_HINT = {
      start: 'Click a cell to place <b>Theseus’ start</b>.', goal: 'Click a cell to move the <b>goal flag</b>.',
      wall: '<b>Drag</b> from a cell into its neighbour to open or close the wall between them.',
      mud: 'Drag over cells to add <b>mud</b> (slow, costs more to cross).', erase: 'Drag over mud to clean it up.'
    };
    var toolHint = D.el('div', { class: 'small muted', html: TOOL_HINT[tool] });
    left.appendChild(panel('Edit & destroy', 'Tools', D.el('div', { class: 'col' }, tools, toolHint,
      D.el('div', { class: 'row' },
        D.el('button', { class: 'btn danger grow', 'data-busy': 1, html: D.icon('bomb') + 'Demolish', title: 'Knock out ~10% of the walls', onclick: demolish }),
        D.el('button', { class: 'btn grow', 'data-busy': 1, html: D.icon('reset') + 'Rebuild', title: 'Rebuild from the seed', onclick: function () { buildMaze(true); D.audit.log('theseus', 'Rebuilt maze', 'Restored from seed ' + cfg.seed); } })
      ))));
    layout.appendChild(left);

    /* ---- centre: stage ---- */
    var center = D.el('div', { class: 'th-center' });
    var stage = D.el('div', { class: 'stage th-stage' });
    var canvas = D.el('canvas');
    stage.appendChild(canvas);
    ui.chipCells = D.el('span', { class: 'chip' });
    ui.chipRoutes = D.el('span', { class: 'chip accent' });
    ui.status = D.el('span', { class: 'chip', text: 'Ready' });
    stage.appendChild(D.el('div', { class: 'stage-overlay' }, ui.chipCells, ui.chipRoutes));
    stage.appendChild(D.el('div', { class: 'th-status' }, ui.status));
    ui.unreach = D.el('div', { class: 'callout warn th-unreach hidden', html: D.icon('info') + '<div><b>The goal cannot be reached.</b> Use the <b>Wall</b> tool to open a passage, or move the start / goal.</div>' });
    stage.appendChild(ui.unreach);
    center.appendChild(stage);
    center.appendChild(D.el('div', { class: 'th-legend', html:
      '<span><i style="background:var(--green)"></i>Start</span><span><i style="background:var(--red)"></i>Goal</span><span><i style="background:rgba(180,120,60,.7)"></i>Mud</span>' +
      '<span><i style="background:var(--accent);opacity:.5"></i>Explored</span><span><i style="background:var(--amber)"></i>Route</span><span><i style="background:var(--violet)"></i>Frontier</span>' }));
    layout.appendChild(center);

    /* ---- right: solve ---- */
    var right = D.el('div', { class: 'th-col' });
    var solverDesc = D.el('div', { class: 'small faint', text: solverInfo(cfg.solver).desc });
    var solverSel = select(M.SOLVERS, cfg.solver, function (v) { cfg.solver = v; solverDesc.textContent = solverInfo(v).desc; saveCfg(); stopRun(); D.audit.log('theseus', 'Chose solver', solverInfo(v).label); });
    ui.play = D.el('button', { class: 'btn go grow', 'data-busy': 1, html: D.icon('play') + 'Run', onclick: play });
    ui.pause = D.el('button', { class: 'btn grow hidden', html: D.icon('pause') + 'Pause', onclick: pause });
    var speedVal = D.el('b', { class: 'mono', text: cfg.speed });
    var speed = range(1, 10, cfg.speed, function (v) { cfg.speed = v; speedVal.textContent = v; saveCfg(); if (timer && run) { clearInterval(timer); timer = setInterval(tick, speedMs()); } });
    ui.liveSteps = D.el('b', { class: 'mono', text: '0' });
    right.appendChild(panel('Solve it', 'Robot brain', D.el('div', { class: 'col' },
      field('Algorithm', solverSel), solverDesc,
      D.el('div', { class: 'row' }, ui.play, ui.pause,
        D.el('button', { class: 'btn icon', title: 'Step', 'data-busy': 1, html: D.icon('step'), onclick: step }),
        D.el('button', { class: 'btn icon', title: 'Reset robot', html: D.icon('reset'), onclick: function () { stopRun(); } })),
      field('Speed', D.el('div', { class: 'row' }, speed, speedVal)),
      D.el('div', { class: 'row small muted' }, D.el('span', { text: 'Moves so far' }), D.el('span', { class: 'spacer' }), ui.liveSteps)
    )));

    var budgetVal = D.el('b', { class: 'mono', text: cfg.budget });
    var budget = range(10, 400, cfg.budget, function (v) { cfg.budget = v; budgetVal.textContent = v; saveCfg(); }, 5);
    ui.battery = D.el('i');
    var mudVal = D.el('b', { class: 'mono', text: cfg.mudCost + '×' });
    var mud = range(1, 9, cfg.mudCost, function (v) { cfg.mudCost = v; mudVal.textContent = v + '×'; saveCfg(); });
    mud.addEventListener('change', function () { afterChange(); });
    right.appendChild(panel('Constraints', 'Work under limits', D.el('div', { class: 'col' },
      D.el('label', { class: 'row small' }, D.ui.switchEl(cfg.budgetOn, function (v) { cfg.budgetOn = v; saveCfg(); stopRun(); D.audit.log('theseus', 'Battery limit ' + (v ? 'on' : 'off'), v ? cfg.budget + ' moves' : ''); }), D.el('span', { html: '<b>Battery</b> · max moves' }), D.el('span', { class: 'spacer' }), budgetVal),
      budget, D.el('div', { class: 'th-batt' }, ui.battery),
      field('<span class="row">Mud cost<span class="spacer"></span></span>', D.el('div', { class: 'row' }, mud, mudVal), 'Dijkstra & A* route around expensive mud; BFS ignores it.'),
      D.el('label', { class: 'row small' }, D.ui.switchEl(cfg.fog, function (v) { cfg.fog = v; saveCfg(); stopRun(); D.audit.log('theseus', 'Fog of war ' + (v ? 'on' : 'off')); }), D.el('span', { html: '<b>Fog of war</b> · robot has no map' }))
    )));

    ui.result = D.el('div', { class: 'col' });
    ui.mstats = D.el('div', { class: 'th-stats' });
    right.appendChild(panel('Analysis', 'Readout', D.el('div', { class: 'col' }, ui.result,
      D.el('div', { class: 'th-sub', text: 'Maze structure' }), ui.mstats,
      D.el('button', { class: 'btn', 'data-busy': 1, html: D.icon('chart') + 'Compare all solvers', onclick: compare }))));
    layout.appendChild(right);

    view = new D.MazeView(canvas, M.create(dims()), { padding: 20 });
    bindCanvas(canvas);
    buildMaze(false);
  }

  D.router.register('theseus', {
    title: 'Theseus · Maze Lab', icon: 'theseus', mount: mount,
    show: function () { if (view) view.render(); },
    hide: function () { pause(); }
  });

  /* ------------------------------------------------------------ guide */
  var art = D.guide.art;
  function mini(walls) { return '<g stroke="var(--grid-wall-top)" stroke-width="2.4" stroke-linecap="round" fill="none">' + walls + '</g>'; }
  D.guide.register('theseus', {
    title: 'Theseus · Maze Lab', badge: D.avatar('theseus'),
    howto: [
      { title: 'Pick a shape', text: 'Choose <b>Square</b>, <b>Circle</b> or <b>Hex</b>. Circular mazes have rings around a centre goal; hex cells have six neighbours.',
        svg: art.wrap('<rect x="14" y="30" width="34" height="34" fill="var(--grid-floor)" stroke="var(--grid-wall-top)" stroke-width="2"/><circle cx="75" cy="47" r="19" fill="var(--grid-floor)" stroke="var(--accent)" stroke-width="2.4"/><circle cx="75" cy="47" r="9" fill="none" stroke="var(--grid-wall-top)" stroke-width="2"/><path d="M118 28l16 9v19l-16 9-16-9V37z" fill="var(--grid-floor)" stroke="var(--grid-wall-top)" stroke-width="2"/>' + art.text(17, 82, 'Square') + art.text(64, 82, 'Circle', 9, 'var(--accent)', 700) + art.text(108, 82, 'Hex')) },
      { title: 'Generate', text: 'Choose a <b>generator</b> and press <b>Generate maze</b>. Watch the corridors being carved. The same <b>seed</b> always rebuilds the same maze.',
        svg: art.wrap('<rect x="20" y="16" width="70" height="70" fill="var(--grid-floor)"/>' + mini('<path d="M20 16h70v70H20zM20 40h24M66 16v24M44 62h24v24M44 40v22"/>') + art.btn(98, 44, 46, 'Generate', true) + art.cursor(128, 54)) },
      { title: 'Move start & goal', text: 'Pick the <b>Start</b> or <b>Goal</b> tool, then click any cell. If the goal becomes unreachable, a warning tells you.',
        svg: art.wrap(art.grid(22, 18, 5, 4, 17) + '<circle cx="30.5" cy="26.5" r="6" fill="none" stroke="var(--green)" stroke-width="2"/>' + art.flag(108, 76) + art.arrow(40, 30, 100, 70, 'var(--text-3)') + art.cursor(110, 80)) },
      { title: 'Build or destroy walls', text: 'With the <b>Wall</b> tool, <b>drag</b> from one cell into the next to open or close the wall between them. <b>Demolish</b> blasts ~10% of walls at once.',
        svg: art.wrap('<rect x="22" y="26" width="48" height="48" fill="var(--grid-floor)"/><rect x="70" y="26" width="48" height="48" fill="var(--grid-floor)"/>' + mini('<path d="M70 26v16M70 58v16"/>') + '<circle cx="70" cy="50" r="9" fill="var(--amber)" opacity=".6"/>' + art.arrow(46, 50, 94, 50, 'var(--accent)') + art.text(28, 92, 'drag across the wall')) },
      { title: 'Add constraints', text: 'Paint <b>mud</b> (costly cells), set a <b>battery</b> move limit, or switch on <b>fog of war</b> so the robot has no map and must explore.',
        svg: art.wrap(art.grid(20, 22, 6, 3, 18) + '<rect x="56" y="22" width="34" height="16" fill="rgba(180,120,60,.6)"/><rect x="20" y="58" width="108" height="10" rx="4" fill="var(--surface-3)"/><rect x="20" y="58" width="40" height="10" rx="4" fill="var(--green)"/>' + art.text(20, 86, 'mud · battery · fog')) },
      { title: 'Pick a solver & run', text: 'Choose an algorithm and press <b>Run</b>. First the <b>blue heatmap</b> shows what it explored, then Theseus drives the route.',
        svg: art.wrap(art.grid(16, 16, 6, 4, 17) + '<rect x="16" y="16" width="50" height="67" fill="var(--accent)" opacity=".25"/><path d="M24 24H58V58H92V75" stroke="var(--amber)" stroke-width="4" fill="none" stroke-linecap="round"/>' + art.bot(92, 75, 11) + art.btn(122, 40, 24, 'Run', true)) },
      { title: 'Read the analysis', text: 'See moves, cost, cells explored and <b>efficiency</b> (optimal cost ÷ your cost). Structure stats count dead ends, junctions and loops.',
        svg: art.wrap('<rect x="16" y="16" width="56" height="30" rx="6" fill="var(--surface-3)"/>' + art.text(22, 28, 'Efficiency', 8) + art.text(22, 41, '94%', 12, 'var(--accent)', 700) + '<rect x="78" y="16" width="56" height="30" rx="6" fill="var(--surface-3)"/>' + art.text(84, 28, 'Explored', 8) + art.text(84, 41, '57', 12, 'var(--text)', 700) + '<rect x="16" y="54" width="118" height="30" rx="6" fill="var(--surface-3)"/>' + art.text(22, 66, 'Dead ends 12 · Loops 3', 8)) },
      { title: 'Compare all solvers', text: 'Press <b>Compare all solvers</b> for a showdown table with bars: who thought least, who drove least, who won.',
        svg: art.wrap('<rect x="20" y="22" width="90" height="9" rx="4" fill="var(--accent)"/><rect x="20" y="38" width="54" height="9" rx="4" fill="var(--accent)"/><rect x="20" y="54" width="110" height="9" rx="4" fill="var(--accent)"/><rect x="20" y="70" width="36" height="9" rx="4" fill="var(--amber)"/>' + art.text(60, 77, '★ winner', 8, 'var(--amber)', 700)) }
    ],
    tips: 'Try a <b>circular</b> maze with <b>Loops 40%</b>, paint mud on the shortest corridor, then compare BFS (ignores mud) with Dijkstra (avoids it). Then switch on fog of war and watch a map-less robot struggle.',
    about: {
      hero: '<svg viewBox="0 0 560 170" font-family="Inter" font-size="11">' +
        '<defs><marker id="tha" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="var(--accent)"/></marker></defs>' +
        '<g transform="translate(14,22)"><rect width="110" height="110" fill="var(--grid-floor)" stroke="var(--grid-wall-top)" stroke-width="2.5"/>' +
        '<path d="M0 37h55M73 0v55M37 37v37M37 74h55M92 55v55M18 92h37" stroke="var(--grid-wall-top)" stroke-width="2.5"/><text x="30" y="132" fill="var(--text-2)">1 · Maze</text></g>' +
        '<path d="M134 77h36" stroke="var(--accent)" stroke-width="2" marker-end="url(#tha)"/>' +
        '<g transform="translate(180,22)"><g stroke="var(--text-3)" stroke-width="2" fill="none">' +
        '<path d="M18 18L55 18L92 18M18 18L18 55L18 92M55 55L92 55L92 92M55 55L55 92L92 92"/></g>' +
        '<g fill="var(--accent)"><circle cx="18" cy="18" r="6"/><circle cx="55" cy="18" r="6"/><circle cx="92" cy="18" r="6"/><circle cx="18" cy="55" r="6"/><circle cx="18" cy="92" r="6"/><circle cx="55" cy="55" r="6"/><circle cx="92" cy="55" r="6"/><circle cx="55" cy="92" r="6"/><circle cx="92" cy="92" r="6"/></g>' +
        '<text x="22" y="132" fill="var(--text-2)">2 · Graph of cells</text></g>' +
        '<path d="M300 77h36" stroke="var(--accent)" stroke-width="2" marker-end="url(#tha)"/>' +
        '<g transform="translate(346,40)"><rect width="84" height="74" rx="12" fill="var(--surface-3)" stroke="var(--line-2)"/><text x="42" y="30" text-anchor="middle" font-weight="700" fill="var(--text)">Solver</text><text x="42" y="48" text-anchor="middle" fill="var(--text-3)" font-size="9.5">BFS · A* · Dijkstra</text><text x="42" y="61" text-anchor="middle" fill="var(--text-3)" font-size="9.5">wall · Trémaux</text><text x="10" y="114" fill="var(--text-2)">3 · Search</text></g>' +
        '<path d="M438 77h30" stroke="var(--accent)" stroke-width="2" marker-end="url(#tha)"/>' +
        '<g transform="translate(476,22)"><rect width="70" height="110" fill="var(--grid-floor)" stroke="var(--grid-wall-top)" stroke-width="2"/><path d="M14 14V56H56V96" stroke="var(--amber)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="14" r="6" fill="var(--green)"/><circle cx="56" cy="96" r="6" fill="var(--red)"/><text x="8" y="132" fill="var(--text-2)">4 · Route</text></g></svg>',
      intro: 'Theseus is named after the hero who found his way out of the Labyrinth. This lab shows how a robot plans a route <b>under constraints</b>: walls, expensive terrain, a limited battery, or no map at all.',
      facts: [['3', 'maze shapes'], ['5', 'generators'], ['7', 'solving strategies']],
      sections: [
        { title: 'A maze is a graph', html: '<p>Every cell is a <b>node</b>; every open passage is an <b>edge</b>. That is why the same algorithms work on square, circular and hexagonal mazes — only the drawing changes. A <b>perfect</b> maze has exactly one route between any two cells (a tree). Adding <b>loops</b> creates multiple routes, which is where smart solvers shine.</p>' },
        { title: 'Generators', html: '<ul><li><b>Recursive backtracker</b> — long, twisty corridors.</li><li><b>Prim’s</b> — grows like a crystal, many short dead ends.</li><li><b>Kruskal’s</b> — merges random regions.</li><li><b>Wilson’s</b> — unbiased loop-erased random walks.</li><li><b>Hunt-and-kill</b> — walks until stuck, then hunts for a new start.</li></ul>' },
        { title: 'Solvers', html: '<ul><li><b>BFS</b> finds the fewest steps. <b>DFS</b> finds <i>a</i> route.</li><li><b>Dijkstra</b> finds the cheapest route when cells cost differently (mud).</li><li><b>A*</b> adds a straight-line guess so it explores less.</li><li><b>Greedy</b> chases the goal and can be fooled.</li><li><b>Wall follower</b> and <b>Trémaux</b> are robots with <i>no map</i>: they must physically drive and back-track.</li></ul>' },
        { title: 'Constraints', html: '<p><b>Mud</b> multiplies the cost of a cell. A <b>battery</b> limits how many moves the robot can drive — explorers often run out. <b>Fog of war</b> hides the maze, forcing a map-less strategy. <b>Efficiency</b> = optimal cost ÷ the cost the robot actually paid.</p>' },
        { title: 'Circular mazes', html: '<p>A polar (theta) maze is made of rings. Each outer ring is split into more cells so the cells stay roughly the same size — the cell count doubles every few rings. The default goal sits in the centre, the start on the rim.</p>' }
      ]
    }
  });
})(window);
