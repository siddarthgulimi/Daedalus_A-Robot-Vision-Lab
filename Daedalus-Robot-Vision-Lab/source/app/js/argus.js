/* argus.js — ARGUS · Path Studio
   A friendlier take on block programming: big "command cards" in a numbered track,
   a live ghost-path preview drawn on the grid with the same numbers and colours as the
   cards, synced highlighting while running, editable start / goal / walls / gems,
   a drive pad that records cards as you drive (keyboard or hand gestures), an
   auto-planner, and five guided missions + free play. */
(function (global) {
  'use strict';
  var D = global.D;

  /* ================================================================ Card catalogue */
  var CAT = {
    move:  { label: 'Move',  color: '#38bdf8' },
    turn:  { label: 'Turn',  color: '#a78bfa' },
    loop:  { label: 'Loops', color: '#fbbf24' },
    sense: { label: 'Sense', color: '#34d399' },
    fun:   { label: 'Feel',  color: '#f472b6' }
  };
  var TYPES = {
    fwd:    { cat: 'move',  label: 'Forward',  icon: 'arrowUp',   num: { min: 1, max: 9, def: 1, unit: 'step' }, desc: 'Drive forward. If a wall is in the way the robot bumps and stays put.' },
    back:   { cat: 'move',  label: 'Back up',  icon: 'arrowDown', num: { min: 1, max: 9, def: 1, unit: 'step' }, desc: 'Reverse without turning around.' },
    left:   { cat: 'turn',  label: 'Turn left',  icon: 'turnLeft',  desc: 'Rotate 90° to the left on the spot.' },
    right:  { cat: 'turn',  label: 'Turn right', icon: 'turnRight', desc: 'Rotate 90° to the right on the spot.' },
    uturn:  { cat: 'turn',  label: 'U-turn',     icon: 'uturn',     desc: 'Spin 180° and face the other way.' },
    repeat: { cat: 'loop',  label: 'Repeat',     icon: 'repeat', num: { min: 2, max: 12, def: 3, unit: 'times' }, body: true, desc: 'Run the cards inside several times.' },
    until:  { cat: 'loop',  label: 'Until goal', icon: 'target', body: true, desc: 'Keep running the cards inside until the robot stands on the goal flag.' },
    ifc:    { cat: 'sense', label: 'If',         icon: 'branch', cond: true, body: true, alt: true, desc: 'Look with the sensors. Run the first slot if true, the “otherwise” slot if not.' },
    emote:  { cat: 'fun',   label: 'Feel',       icon: 'face',   expr: true, desc: 'Change the robot’s face — great for celebrating at the goal.' },
    wait:   { cat: 'fun',   label: 'Wait',       icon: 'wait',   num: { min: 1, max: 5, def: 1, unit: 'beat' }, desc: 'Pause for a moment.' }
  };
  var CONDS = [['wallAhead', 'wall ahead'], ['clearAhead', 'path ahead is clear'], ['wallLeft', 'wall on the left'], ['wallRight', 'wall on the right'], ['onGem', 'standing on a gem'], ['atGoal', 'at the goal']];
  var FEELS = ['happy', 'excited', 'thinking', 'surprised', 'sad', 'angry', 'love', 'confused'];
  var PATH_COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#60a5fa', '#f87171', '#a3e635', '#e879f9'];
  var DIRS = [{ dx: 0, dy: -1, n: 'North' }, { dx: 1, dy: 0, n: 'East' }, { dx: 0, dy: 1, n: 'South' }, { dx: -1, dy: 0, n: 'West' }];
  var STEP_LIMIT = 600;

  /* ================================================================ Worlds */
  function parseMap(rows, dir) {
    var w = { cols: rows[0].length, rows: rows.length, walls: {}, gems: {}, start: { x: 1, y: 1, dir: dir == null ? 1 : dir }, goal: { x: 2, y: 1 } };
    rows.forEach(function (r, y) {
      for (var x = 0; x < r.length; x++) {
        var c = r[x];
        if (c === '#') w.walls[x + ',' + y] = 1;
        else if (c === '*') w.gems[x + ',' + y] = 1;
        else if (c === 'S') { w.start.x = x; w.start.y = y; }
        else if (c === 'G') { w.goal = { x: x, y: y }; }
        else if (c === 'B') { w.start.x = x; w.start.y = y; w.goal = { x: x, y: y }; }
      }
    });
    return w;
  }
  function blankWorld(cols, rows) {
    var w = { cols: cols, rows: rows, walls: {}, gems: {}, start: { x: 1, y: Math.floor(rows / 2), dir: 1 }, goal: { x: cols - 2, y: Math.floor(rows / 2) } };
    for (var x = 0; x < cols; x++) { w.walls[x + ',0'] = 1; w.walls[x + ',' + (rows - 1)] = 1; }
    for (var y = 0; y < rows; y++) { w.walls['0,' + y] = 1; w.walls[(cols - 1) + ',' + y] = 1; }
    return w;
  }
  function cloneWorld(w) { return JSON.parse(JSON.stringify(w)); }
  function defaultFree() {
    return parseMap([
      '##############',
      '#S.....#.....#',
      '#.####.#.###.#',
      '#....#...#*..#',
      '####.#####.###',
      '#*...#.......#',
      '#.##...###.#.#',
      '#....#..*..#G#',
      '##############'
    ], 1);
  }

  var MISSIONS = [
    { id: 'm1', title: 'First steps', icon: 'arrowUp', skill: 'Placing a card',
      brief: 'Drag the <b>Forward</b> card into the track and set it to the right number of steps so Argus reaches the flag.',
      hint: 'Count the squares between Argus and the flag. One <b>Forward</b> card with the number 5 is enough!',
      allow: ['fwd'], par: 1, needGems: false,
      map: ['########', '#......#', '#S....G#', '#......#', '########'], dir: 1 },
    { id: 'm2', title: 'Turn the corner', icon: 'turnRight', skill: 'Turning',
      brief: 'The corridor bends twice. Mix <b>Forward</b> and <b>Turn</b> cards to follow it.',
      hint: 'Forward 3 → Turn right → Forward 4 → Turn left → Forward 2.',
      allow: ['fwd', 'left', 'right'], par: 5, needGems: false,
      map: ['########', '#S...###', '####.###', '####.###', '####.###', '####..G#', '########'], dir: 1 },
    { id: 'm3', title: 'Loop patrol', icon: 'repeat', skill: 'Loops',
      brief: 'Collect all 4 gems around the block and come back to the flag. The route repeats itself — use a <b>Repeat</b> card!',
      hint: 'Repeat 4 times: [ Forward 4, Turn right ]. Only 3 cards!',
      allow: ['fwd', 'left', 'right', 'repeat'], par: 3, needGems: true,
      map: ['#######', '#B.*..#', '#.###.#', '#*###*#', '#.###.#', '#..*..#', '#######'], dir: 1 },
    { id: 'm4', title: 'Smart sensor', icon: 'branch', skill: 'Sensing + conditions',
      brief: 'A spiral! Instead of counting every step, let Argus <b>look</b>: keep going <b>until the goal</b>, turning whenever a wall is ahead.',
      hint: 'Until goal: [ If wall ahead → Turn right, otherwise → Forward 1 ]. Four cards solve any spiral like this.',
      allow: ['fwd', 'left', 'right', 'until', 'ifc'], par: 4, needGems: false,
      map: ['#########', '#S......#', '#######.#', '#.....#.#', '#.###.#.#', '#.#G..#.#', '#.#####.#', '#.......#', '#########'], dir: 1 },
    { id: 'm5', title: 'Gem collector', icon: 'gem', skill: 'Planning a route',
      brief: 'Grab every gem, then park on the flag. Plan the shortest route you can — or press <b>Auto-plan</b> to see the robot’s own idea and try to beat it.',
      hint: 'Use the drive pad to “record” the route, then tidy repeated parts into a Repeat card.',
      allow: null, par: 0, needGems: true,
      map: ['##########', '#S..#....#', '#.#.#.##*#', '#*#...#..#', '#.###.#.##', '#...*...G#', '##########'], dir: 1 }
  ];

  /* ================================================================ Program model */
  var idSeq = 0;
  function newCard(type) {
    var T = TYPES[type], c = { id: 'c' + (++idSeq) + Math.random().toString(36).slice(2, 5), type: type };
    if (T.num) c.n = T.num.def;
    if (T.body) c.body = [];
    if (T.alt) c.alt = [];
    if (T.cond) c.cond = 'wallAhead';
    if (T.expr) c.expr = 'happy';
    return c;
  }
  function walk(list, fn, parent) { list.forEach(function (c, i) { fn(c, list, i, parent); if (c.body) walk(c.body, fn, c); if (c.alt) walk(c.alt, fn, c); }); }
  function findCard(prog, id) { var r = null; walk(prog, function (c, list, i) { if (c.id === id) r = { card: c, list: list, index: i }; }); return r; }
  function countCards(prog) { var n = 0; walk(prog, function () { n++; }); return n; }
  function cardText(c) {
    var T = TYPES[c.type];
    if (c.type === 'fwd' || c.type === 'back') return T.label + ' ' + c.n;
    if (c.type === 'repeat') return 'Repeat ' + c.n + ' times';
    if (c.type === 'ifc') return 'If ' + condLabel(c.cond);
    if (c.type === 'emote') return 'Feel ' + D.EXPRESSIONS[c.expr].label.toLowerCase();
    if (c.type === 'wait') return 'Wait ' + c.n;
    return T.label;
  }
  function condLabel(k) { for (var i = 0; i < CONDS.length; i++) if (CONDS[i][0] === k) return CONDS[i][1]; return k; }
  function toText(prog, ind) {
    ind = ind || '';
    var out = [];
    prog.forEach(function (c, i) {
      out.push(ind + (ind ? '' : (i + 1) + '. ') + cardText(c) + (c.body ? ':' : ''));
      if (c.body) { out.push(toText(c.body, ind + '    ') || ind + '    (empty)'); }
      if (c.alt) { out.push(ind + '  otherwise:'); out.push(toText(c.alt, ind + '    ') || ind + '    (empty)'); }
    });
    return out.join('\n');
  }

  /* ================================================================ Interpreter (generator) */
  function blocked(w, x, y) { return x < 0 || y < 0 || x >= w.cols || y >= w.rows || !!w.walls[x + ',' + y]; }
  function makeState(w) { return { x: w.start.x, y: w.start.y, dir: w.start.dir, got: {}, gemCount: 0, bumps: 0, moves: 0, expr: 'neutral' }; }
  function cond(w, st, k) {
    var d = DIRS[st.dir], l = DIRS[(st.dir + 3) % 4], r = DIRS[(st.dir + 1) % 4];
    switch (k) {
      case 'wallAhead': return blocked(w, st.x + d.dx, st.y + d.dy);
      case 'clearAhead': return !blocked(w, st.x + d.dx, st.y + d.dy);
      case 'wallLeft': return blocked(w, st.x + l.dx, st.y + l.dy);
      case 'wallRight': return blocked(w, st.x + r.dx, st.y + r.dy);
      case 'onGem': return !!w.gems[st.x + ',' + st.y];
      case 'atGoal': return st.x === w.goal.x && st.y === w.goal.y;
    }
    return false;
  }
  function* run(list, w, st, ctx, stack) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i], stk = stack.concat(c.id);
      if (ctx.steps >= STEP_LIMIT) { ctx.limit = true; return; }
      switch (c.type) {
        case 'fwd': case 'back':
          for (var k = 0; k < c.n; k++) {
            var d = DIRS[c.type === 'fwd' ? st.dir : (st.dir + 2) % 4], nx = st.x + d.dx, ny = st.y + d.dy;
            ctx.steps++;
            if (blocked(w, nx, ny)) { st.bumps++; yield { card: c.id, stack: stk, kind: 'bump', x: st.x, y: st.y, dir: st.dir, tx: nx, ty: ny }; }
            else {
              st.x = nx; st.y = ny; st.moves++;
              var key = nx + ',' + ny, gem = false;
              if (w.gems[key] && !st.got[key]) { st.got[key] = 1; st.gemCount++; gem = true; }
              yield { card: c.id, stack: stk, kind: 'move', x: nx, y: ny, dir: st.dir, gem: gem };
            }
            if (ctx.steps >= STEP_LIMIT) { ctx.limit = true; return; }
          }
          break;
        case 'left': case 'right': case 'uturn':
          st.dir = (st.dir + (c.type === 'left' ? 3 : c.type === 'right' ? 1 : 2)) % 4; ctx.steps++;
          yield { card: c.id, stack: stk, kind: 'turn', x: st.x, y: st.y, dir: st.dir, turn: c.type };
          break;
        case 'repeat':
          for (var r = 0; r < c.n; r++) { yield* run(c.body, w, st, ctx, stk); if (ctx.limit) return; }
          break;
        case 'until':
          var guard = 0;
          while (!cond(w, st, 'atGoal')) {
            var before = ctx.steps;
            yield* run(c.body, w, st, ctx, stk);
            if (ctx.limit) return;
            if (ctx.steps === before && ++guard > 2) { ctx.stuck = true; break; }
          }
          break;
        case 'ifc':
          var v = cond(w, st, c.cond); ctx.steps++;
          yield { card: c.id, stack: stk, kind: 'check', x: st.x, y: st.y, dir: st.dir, result: v };
          yield* run(v ? c.body : c.alt, w, st, ctx, stk);
          break;
        case 'emote':
          st.expr = c.expr; ctx.steps++;
          yield { card: c.id, stack: stk, kind: 'emote', x: st.x, y: st.y, dir: st.dir, expr: c.expr };
          break;
        case 'wait':
          ctx.steps++;
          yield { card: c.id, stack: stk, kind: 'wait', x: st.x, y: st.y, dir: st.dir, n: c.n };
          break;
      }
    }
  }
  function simulate(prog, w) {
    var st = makeState(w), ctx = { steps: 0 }, events = [];
    var g = run(prog, w, st, ctx, []), r;
    while (!(r = g.next()).done) events.push(r.value);
    return { events: events, state: st, limit: !!ctx.limit, stuck: !!ctx.stuck };
  }

  /* ================================================================ Auto-planner (BFS over x,y,dir) */
  function planRoute(w, from, to) {
    var key = function (s) { return s.x + ',' + s.y + ',' + s.dir; };
    var q = [from], prev = {}; prev[key(from)] = null;
    while (q.length) {
      var s = q.shift();
      if (s.x === to.x && s.y === to.y) {
        var acts = [], k = key(s);
        while (prev[k]) { acts.unshift(prev[k].a); k = prev[k].k; }
        return { acts: acts, end: s };
      }
      var d = DIRS[s.dir];
      var nexts = [['F', { x: s.x + d.dx, y: s.y + d.dy, dir: s.dir }], ['L', { x: s.x, y: s.y, dir: (s.dir + 3) % 4 }], ['R', { x: s.x, y: s.y, dir: (s.dir + 1) % 4 }]];
      nexts.forEach(function (n) {
        var ns = n[1];
        if (n[0] === 'F' && blocked(w, ns.x, ns.y)) return;
        var nk = key(ns);
        if (nk in prev) return;
        prev[nk] = { k: key(s), a: n[0] }; q.push(ns);
      });
    }
    return null;
  }
  function autoPlan(w, needGems) {
    var cur = { x: w.start.x, y: w.start.y, dir: w.start.dir }, acts = [];
    var gems = Object.keys(w.gems).map(function (k) { var p = k.split(','); return { x: +p[0], y: +p[1] }; });
    if (needGems !== false) {
      while (gems.length) {
        var best = null, bi = -1;
        gems.forEach(function (g, i) { var p = planRoute(w, cur, g); if (p && (!best || p.acts.length < best.acts.length)) { best = p; bi = i; } });
        if (!best) break;
        acts = acts.concat(best.acts); cur = best.end; gems.splice(bi, 1);
      }
    }
    var last = planRoute(w, cur, w.goal);
    if (!last) return null;
    acts = acts.concat(last.acts);
    /* compress into cards */
    var prog = [];
    acts.forEach(function (a) {
      var tail = prog[prog.length - 1];
      if (a === 'F') { if (tail && tail.type === 'fwd' && tail.n < 9) tail.n++; else { var c = newCard('fwd'); c.n = 1; prog.push(c); } }
      else {
        var t = a === 'L' ? 'left' : 'right';
        if (tail && tail.type === t) { tail.type = 'uturn'; } else prog.push(newCard(t));
      }
    });
    return prog;
  }

  /* ================================================================ Renderer */
  function Stage(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.robot = { x: 1, y: 1, a: 90, expr: 'neutral', bump: 0 };
    this.hover = null; this.active = null; this.trail = []; this.flash = [];
  }
  Stage.prototype.layout = function (w) {
    var dpr = global.devicePixelRatio || 1;
    var cw = this.c.clientWidth, ch = this.c.clientHeight;
    if (!cw || !ch) return false;
    if (this.c.width !== Math.round(cw * dpr) || this.c.height !== Math.round(ch * dpr)) { this.c.width = Math.round(cw * dpr); this.c.height = Math.round(ch * dpr); }
    var s = Math.floor(Math.min((cw - 24) / w.cols, (ch - 24) / w.rows));
    this.s = Math.max(12, s); this.dpr = dpr;
    this.ox = Math.floor((cw - this.s * w.cols) / 2); this.oy = Math.floor((ch - this.s * w.rows) / 2);
    return true;
  };
  Stage.prototype.cellAt = function (w, clientX, clientY) {
    var r = this.c.getBoundingClientRect();
    var x = Math.floor((clientX - r.left - this.ox) / this.s), y = Math.floor((clientY - r.top - this.oy) / this.s);
    if (x < 0 || y < 0 || x >= w.cols || y >= w.rows) return null;
    return { x: x, y: y };
  };
  Stage.prototype.draw = function (w, preview, opts) {
    if (!this.layout(w)) return;
    var g = this.ctx, s = this.s, ox = this.ox, oy = this.oy, self = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.c.width, this.c.height);
    var floor = D.cssVar('--grid-floor'), line = D.cssVar('--grid-line'), wall = D.cssVar('--grid-wall'), wallTop = D.cssVar('--grid-wall-top');
    var accent = D.cssVar('--accent'), green = D.cssVar('--green'), text = D.cssVar('--text'), violet = D.cssVar('--violet');
    function X(x) { return ox + x * s; } function Y(y) { return oy + y * s; }
    function CX(x) { return ox + x * s + s / 2; } function CY(y) { return oy + y * s + s / 2; }
    /* floor + walls */
    for (var y = 0; y < w.rows; y++) for (var x = 0; x < w.cols; x++) {
      if (w.walls[x + ',' + y]) {
        g.fillStyle = wall; rr(g, X(x) + 1, Y(y) + 1, s - 2, s - 2, s * 0.14); g.fill();
        g.fillStyle = wallTop; rr(g, X(x) + 1, Y(y) + 1, s - 2, s * 0.32, s * 0.14); g.fill();
      } else {
        g.fillStyle = floor; g.fillRect(X(x), Y(y), s, s);
        g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(X(x) + 0.5, Y(y) + 0.5, s - 1, s - 1);
      }
    }
    /* hover cell when editing */
    if (opts.hoverCell) { g.fillStyle = accent; g.globalAlpha = 0.18; g.fillRect(X(opts.hoverCell.x), Y(opts.hoverCell.y), s, s); g.globalAlpha = 1; }
    /* start pad */
    g.strokeStyle = accent; g.setLineDash([4, 3]); g.lineWidth = 2;
    rr(g, X(w.start.x) + 4, Y(w.start.y) + 4, s - 8, s - 8, s * 0.2); g.stroke(); g.setLineDash([]);
    /* goal */
    var gx = CX(w.goal.x), gy = CY(w.goal.y);
    g.fillStyle = green; g.globalAlpha = 0.18; rr(g, X(w.goal.x) + 3, Y(w.goal.y) + 3, s - 6, s - 6, s * 0.2); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = text; g.lineWidth = Math.max(2, s * 0.05); g.beginPath(); g.moveTo(gx - s * 0.15, gy + s * 0.3); g.lineTo(gx - s * 0.15, gy - s * 0.32); g.stroke();
    g.fillStyle = green; g.beginPath(); g.moveTo(gx - s * 0.15, gy - s * 0.32); g.lineTo(gx + s * 0.28, gy - s * 0.2); g.lineTo(gx - s * 0.15, gy - s * 0.06); g.fill();
    /* gems */
    var t = performance.now() / 1000;
    Object.keys(w.gems).forEach(function (k) {
      if (opts.got && opts.got[k]) return;
      var p = k.split(','), cx = CX(+p[0]), cy = CY(+p[1]) + Math.sin(t * 3 + (+p[0])) * s * 0.04, r = s * 0.24;
      g.fillStyle = violet; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy - r * 0.2); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy - r * 0.2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.45, cy - r * 0.2); g.lineTo(cx, cy - r * 0.05); g.lineTo(cx - r * 0.45, cy - r * 0.2); g.fill();
    });
    /* ghost path preview: one colour per top-level card */
    if (preview && opts.showPreview) {
      var px = w.start.x, py = w.start.y;
      preview.events.forEach(function (e) {
        var top = e.stack[0], col = opts.colorOf(top), hi = (self.hover && e.stack.indexOf(self.hover) >= 0);
        if (e.kind === 'move') {
          g.strokeStyle = col; g.globalAlpha = hi ? 1 : (self.hover ? 0.25 : 0.75);
          g.lineWidth = hi ? Math.max(5, s * 0.16) : Math.max(3, s * 0.09); g.lineCap = 'round';
          g.setLineDash(hi ? [] : [s * 0.18, s * 0.14]);
          g.beginPath(); g.moveTo(CX(px), CY(py)); g.lineTo(CX(e.x), CY(e.y)); g.stroke(); g.setLineDash([]);
          px = e.x; py = e.y;
        } else if (e.kind === 'bump') {
          g.globalAlpha = 1; g.strokeStyle = D.cssVar('--red'); g.lineWidth = 3;
          var bx = (CX(e.x) + CX(e.tx)) / 2, by = (CY(e.y) + CY(e.ty)) / 2, q = s * 0.14;
          g.beginPath(); g.moveTo(bx - q, by - q); g.lineTo(bx + q, by + q); g.moveTo(bx + q, by - q); g.lineTo(bx - q, by + q); g.stroke();
        }
        g.globalAlpha = 1;
      });
      /* numbered markers at the end of each top-level card */
      var lastPos = {}, moved = {};
      preview.events.forEach(function (e) { lastPos[e.stack[0]] = e; if (e.kind === 'move' || e.kind === 'bump') moved[e.stack[0]] = 1; });
      var seen = {};
      opts.order.forEach(function (id, i) {
        var e = lastPos[id]; if (!e || (!moved[id] && self.hover !== id)) return;
        var key = e.x + ',' + e.y, off = (seen[key] = (seen[key] || 0) + 1) - 1;
        var mx = CX(e.x) + s * 0.3 - off * s * 0.22, my = CY(e.y) - s * 0.3;
        var hi = self.hover === id;
        g.fillStyle = opts.colorOf(id); g.beginPath(); g.arc(mx, my, Math.max(8, s * (hi ? 0.2 : 0.16)), 0, 7); g.fill();
        g.fillStyle = '#04121a'; g.font = '700 ' + Math.max(9, s * 0.17) + 'px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(i + 1), mx, my + 0.5);
      });
      /* ghost robot at the predicted end */
      if (preview.events.length && !opts.running) {
        var fs = preview.state;
        g.globalAlpha = 0.28; drawBot(g, CX(fs.x), CY(fs.y), s, fs.dir * 90, accent, 'neutral'); g.globalAlpha = 1;
      }
    }
    /* executed trail */
    if (this.trail.length > 1) {
      g.strokeStyle = accent; g.lineWidth = Math.max(2, s * 0.06); g.globalAlpha = 0.5; g.beginPath();
      this.trail.forEach(function (p, i) { if (i) g.lineTo(CX(p.x), CY(p.y)); else g.moveTo(CX(p.x), CY(p.y)); }); g.stroke(); g.globalAlpha = 1;
    }
    /* sparkle flashes (gem pickups) */
    this.flash = this.flash.filter(function (f) { return t - f.t < 0.6; });
    this.flash.forEach(function (f) {
      var k = (t - f.t) / 0.6; g.strokeStyle = violet; g.globalAlpha = 1 - k; g.lineWidth = 3;
      g.beginPath(); g.arc(CX(f.x), CY(f.y), s * (0.2 + k * 0.6), 0, 7); g.stroke(); g.globalAlpha = 1;
    });
    /* robot */
    var R = this.robot, shake = R.bump > 0 ? Math.sin(t * 60) * s * 0.05 * R.bump : 0;
    drawBot(g, CX(R.x) + shake, CY(R.y), s, R.a, accent, R.expr);
    if (opts.checkBubble) {
      var cb = opts.checkBubble;
      g.font = '600 ' + Math.max(11, s * 0.22) + 'px Inter'; var label = cb.text, tw = g.measureText(label).width + 16;
      var bx2 = CX(R.x) - tw / 2, by2 = CY(R.y) - s * 0.95;
      g.fillStyle = cb.ok ? green : D.cssVar('--amber'); rr(g, bx2, by2, tw, s * 0.36 + 6, 8); g.fill();
      g.fillStyle = '#04121a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, CX(R.x), by2 + (s * 0.36 + 6) / 2);
    }
  };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drawBot(g, cx, cy, s, angle, accent, expr) {
    var b = s * 0.74, col = (D.EXPRESSIONS[expr] && expr !== 'neutral') ? D.EXPRESSIONS[expr].color : accent;
    g.save(); g.translate(cx, cy); g.rotate(angle * Math.PI / 180);
    /* wheels */
    g.fillStyle = '#1e293b'; rr(g, -b / 2 - s * 0.06, -b * 0.36, s * 0.1, b * 0.72, 3); g.fill(); rr(g, b / 2 - s * 0.04, -b * 0.36, s * 0.1, b * 0.72, 3); g.fill();
    /* body */
    g.fillStyle = D.cssVar('--surface-3'); g.strokeStyle = col; g.lineWidth = Math.max(2, s * 0.05);
    rr(g, -b / 2, -b / 2, b, b, b * 0.28); g.fill(); g.stroke();
    /* visor facing "up" (= heading) */
    g.fillStyle = '#06101a'; rr(g, -b * 0.36, -b * 0.4, b * 0.72, b * 0.34, b * 0.12); g.fill();
    g.fillStyle = col;
    var eh = expr === 'happy' || expr === 'love' ? b * 0.07 : b * 0.13;
    rr(g, -b * 0.25, -b * 0.3, b * 0.14, eh, 2); g.fill(); rr(g, b * 0.11, -b * 0.3, b * 0.14, eh, 2); g.fill();
    /* heading arrow */
    g.beginPath(); g.moveTo(0, -b / 2 - s * 0.16); g.lineTo(s * 0.1, -b / 2 - s * 0.03); g.lineTo(-s * 0.1, -b / 2 - s * 0.03); g.closePath(); g.fill();
    /* antenna */
    g.beginPath(); g.arc(0, b * 0.18, b * 0.09, 0, 7); g.fill();
    g.restore();
  }

  /* ================================================================ Page */
  var S = {
    mode: 'missions', mission: null, world: null, prog: [], selected: null, tool: 'robot',
    speed: D.store.get('argus.speed', 3), running: false, paused: false, gen: null, st: null,
    preview: null, showPreview: true, view: 'cards'
  };
  var els = {}, stage, raf = 0, anim = null, hoverCell = null, checkBubble = null, handsOn = false, unsubVision = null, stab = null;
  var progress = D.store.get('argus.missions', {});

  function mount(root) {
    root.appendChild(D.ui.pageHead({
      title: 'Argus', tag: 'Path studio', badge: D.avatar('argus'), guide: 'argus',
      sub: 'Build a route with command cards — the dashed line on the grid shows exactly where each numbered card will take the robot.',
      extra: (els.modeSeg = D.ui.seg([['missions', 'Missions', 'flag'], ['free', 'Free play', 'grid']], 'missions', setMode))
    }));
    var body = D.el('div', { class: 'page-body fill' });
    root.appendChild(body);
    var grid = D.el('div', { class: 'ag-grid' });
    body.appendChild(grid);

    /* --- deck (palette) --- */
    var deck = D.el('div', { class: 'panel ag-deck' });
    deck.appendChild(D.el('div', { class: 'panel-head', html: '<span class="eyebrow">Command deck</span><span class="chip small" title="Drag a card into the track — or just click it">drag or click</span>' }));
    els.palette = D.el('div', { class: 'ag-palette' });
    deck.appendChild(els.palette);
    els.trash = D.el('div', { class: 'ag-trash', html: D.icon('trash') + '<span>Drop here to remove</span>' });
    deck.appendChild(els.trash);
    grid.appendChild(deck);

    /* --- program track --- */
    var track = D.el('div', { class: 'panel ag-track' });
    var th = D.el('div', { class: 'panel-head' });
    th.appendChild(D.el('span', { class: 'eyebrow', text: 'Program track' }));
    els.count = D.el('span', { class: 'chip', text: '0 cards' });
    th.appendChild(els.count);
    th.appendChild(D.ui.seg([['cards', '', 'layers', 'Cards'], ['text', '', 'code', 'Read as text']], 'cards', function (v) { S.view = v; renderProgram(); }));
    track.appendChild(th);
    els.missionBox = D.el('div', { class: 'ag-mission' });
    track.appendChild(els.missionBox);
    els.prog = D.el('div', { class: 'ag-prog' });
    track.appendChild(els.prog);
    var tb = D.el('div', { class: 'ag-track-foot' });
    tb.appendChild(D.el('button', { class: 'btn sm', html: D.icon('wand') + 'Auto-plan', title: 'Let Argus compute a route and write the cards for you', onclick: doAutoPlan }));
    tb.appendChild(D.el('button', { class: 'btn sm ghost danger', html: D.icon('trash') + 'Clear', onclick: function () { if (!S.prog.length) return; S.prog = []; S.selected = null; changed('Cleared program'); } }));
    track.appendChild(tb);
    grid.appendChild(track);

    /* --- stage --- */
    var sp = D.el('div', { class: 'panel ag-stage-panel' });
    var bar = D.el('div', { class: 'ag-toolbar' });
    els.run = D.el('button', { class: 'btn go', html: D.icon('play') + 'Run' });
    els.run.onclick = startRun;
    els.step = D.el('button', { class: 'btn', html: D.icon('step') + 'Step', title: 'Run one action at a time', onclick: stepOnce });
    els.stop = D.el('button', { class: 'btn', html: D.icon('reset') + 'Reset', onclick: function () { resetRun(true); } });
    bar.appendChild(els.run); bar.appendChild(els.step); bar.appendChild(els.stop);
    var sp2 = D.el('label', { class: 'row small muted ag-speed' }, 'Speed ');
    var spd = D.el('input', { type: 'range', min: 1, max: 5, value: S.speed });
    spd.oninput = function () { S.speed = +spd.value; D.store.set('argus.speed', S.speed); };
    sp2.appendChild(spd); bar.appendChild(sp2);
    bar.appendChild(D.el('div', { class: 'spacer' }));
    var pv = D.ui.switchEl(true, function (v) { S.showPreview = v; });
    bar.appendChild(D.el('label', { class: 'row small muted', title: 'Show where the program will go before you run it' }, pv, 'Path preview'));
    sp.appendChild(bar);

    els.tools = D.el('div', { class: 'ag-tools' });
    els.toolSeg = D.ui.seg([['robot', 'Robot', 'robot', 'Click a cell to move the robot start. Click the robot to rotate it.'], ['goal', 'Goal', 'flag', 'Click a cell to move the goal flag'], ['wall', 'Wall', 'wall', 'Click / drag to draw walls'], ['gem', 'Gem', 'gem', 'Click to drop or remove a gem'], ['erase', 'Erase', 'eraser', 'Click / drag to clear cells']], 'robot', function (v) { S.tool = v; });
    els.tools.appendChild(els.toolSeg);
    els.sizeSel = D.el('select', { class: 'input', style: { height: '32px' }, title: 'Grid size' });
    [['8x6', '8 × 6'], ['10x7', '10 × 7'], ['14x9', '14 × 9'], ['18x11', '18 × 11'], ['22x13', '22 × 13']].forEach(function (o) { els.sizeSel.appendChild(D.el('option', { value: o[0], text: o[1] })); });
    els.sizeSel.value = '14x9';
    els.sizeSel.onchange = function () { var p = els.sizeSel.value.split('x'); setWorld(blankWorld(+p[0], +p[1])); D.audit.log('argus', 'Resized grid', els.sizeSel.value); };
    els.tools.appendChild(els.sizeSel);
    els.tools.appendChild(D.el('button', { class: 'btn sm', html: D.icon('dice') + 'Random', title: 'Scatter random walls & gems', onclick: randomWorld }));
    els.tools.appendChild(D.el('button', { class: 'btn sm ghost', html: D.icon('reset'), title: 'Default map', onclick: function () { setWorld(defaultFree()); } }));
    sp.appendChild(els.tools);

    var stg = D.el('div', { class: 'stage ag-stage' });
    els.canvas = D.el('canvas');
    stg.appendChild(els.canvas);
    els.overlay = D.el('div', { class: 'stage-overlay' });
    stg.appendChild(els.overlay);
    /* drive pad */
    els.pad = buildPad();
    stg.appendChild(els.pad);
    sp.appendChild(stg);
    els.status = D.el('div', { class: 'ag-status' });
    sp.appendChild(els.status);
    grid.appendChild(sp);

    stage = new Stage(els.canvas);
    buildPalette();
    wireCanvas();
    wireDnD();
    document.addEventListener('keydown', onKey);
    D.bus.on('theme', function () { draw(); });
    global.addEventListener('resize', function () { draw(); });

    var saved = D.store.get('argus.free', null);
    S.freeWorld = saved && saved.world ? saved.world : defaultFree();
    S.freeProg = saved && saved.prog ? saved.prog : [];
    S.mode = D.store.get('argus.mode', 'missions');
    els.modeSeg.setValue(S.mode);
    if (S.mode === 'missions') openMission(D.store.get('argus.lastMission', 'm1')); else enterFree();
  }

  function show() { loop(); }
  function hide() {
    cancelAnimationFrame(raf); raf = 0; pauseRun();
    if (handsOn) toggleHands(false);
  }
  function loop() {
    cancelAnimationFrame(raf);
    (function frame() { stepAnim(); draw(); raf = requestAnimationFrame(frame); })();
  }

  /* ---------------------------------------------------------------- modes & missions */
  function setMode(m) {
    if (S.mode === m) return;
    resetRun(false);
    if (S.mode === 'free') { S.freeWorld = S.world; S.freeProg = S.prog; saveFree(); }
    S.mode = m; D.store.set('argus.mode', m);
    if (m === 'missions') openMission(D.store.get('argus.lastMission', 'm1')); else enterFree();
    D.audit.log('argus', 'Switched mode', m === 'free' ? 'Free play' : 'Missions');
  }
  function enterFree() {
    S.mission = null;
    els.tools.classList.remove('locked');
    setWorld(S.freeWorld, true);
    S.prog = S.freeProg || [];
    renderMission(); buildPalette(); changed();
  }
  function openMission(id) {
    var m = MISSIONS.filter(function (x) { return x.id === id; })[0] || MISSIONS[0];
    S.mission = m; D.store.set('argus.lastMission', m.id);
    var w = parseMap(m.map, m.dir);
    if (!m.par) { var p = autoPlan(w, m.needGems); m.par = p ? countCards(p) : 8; }
    els.tools.classList.add('locked');
    setWorld(w, true);
    S.prog = D.store.get('argus.prog.' + m.id, []);
    renderMission(); buildPalette(); changed();
    D.audit.log('argus', 'Opened mission', m.title);
  }
  function renderMission() {
    var box = els.missionBox; box.innerHTML = '';
    if (!S.mission) {
      box.appendChild(D.el('div', { class: 'ag-free-note', html: D.icon('sparkle') + '<div><b>Free play.</b> Paint the world with the tools above the grid, move the robot and the flag anywhere, then build any program you like.</div>' }));
      return;
    }
    var row = D.el('div', { class: 'ag-mission-tabs' });
    MISSIONS.forEach(function (m, i) {
      var stars = progress[m.id] || 0;
      var b = D.el('button', { class: 'ag-mtab' + (m === S.mission ? ' on' : '') + (stars ? ' done' : ''), title: m.title,
        html: '<span class="n">' + (i + 1) + '</span><span class="st">' + (stars ? '★'.repeat(stars) : '') + '</span>' });
      b.onclick = function () { saveMissionProg(); resetRun(false); openMission(m.id); };
      row.appendChild(b);
    });
    box.appendChild(row);
    var m = S.mission;
    var brief;
    var collapse = D.el('button', { class: 'btn xs ghost icon ag-collapse', title: 'Show / hide the mission brief', html: D.icon('arrowUp'), onclick: function () { var mi = !brief.classList.contains('min'); brief.classList.toggle('min', mi); D.store.set('argus.briefMin', mi); } });
    box.appendChild(brief = D.el('div', { class: 'ag-brief' + (D.store.get('argus.briefMin', false) ? ' min' : '') },
      D.el('div', { class: 'row' }, D.el('span', { class: 'ag-micon', html: D.icon(m.icon) }), D.el('div', { class: 'grow' }, D.el('div', { class: 'eyebrow', text: 'Mission ' + (MISSIONS.indexOf(m) + 1) + ' · ' + m.skill }), D.el('h3', { text: m.title })), collapse),
      D.el('p', { html: m.brief }),
      D.el('div', { class: 'row small' }, D.el('span', { class: 'chip amber', html: '★★★ in ' + m.par + ' card' + (m.par > 1 ? 's' : '') }), m.needGems ? D.el('span', { class: 'chip violet', html: D.icon('gem') + ' collect all gems' }) : null,
        D.el('button', { class: 'btn xs ghost', html: D.icon('help') + 'Hint', onclick: function () { D.ui.modal('<p>' + m.hint + '</p>', { title: 'Hint · ' + m.title, actions: [{ label: 'Got it', kind: 'primary' }] }); D.audit.log('argus', 'Viewed hint', m.title); } }))
    ));
  }
  function saveMissionProg() { if (S.mission) D.store.set('argus.prog.' + S.mission.id, S.prog); }
  function saveFree() { if (S.mode === 'free') D.store.set('argus.free', { world: S.world, prog: S.prog }); }

  function setWorld(w, silent) {
    S.world = cloneWorld(w);
    var key = w.cols + 'x' + w.rows;
    if (els.sizeSel) { if (!Array.prototype.some.call(els.sizeSel.options, function (o) { return o.value === key; })) els.sizeSel.appendChild(D.el('option', { value: key, text: w.cols + ' × ' + w.rows })); els.sizeSel.value = key; }
    resetRun(false);
    changed(silent ? null : 'World changed');
  }
  function randomWorld() {
    var w = blankWorld(S.world.cols, S.world.rows);
    for (var y = 1; y < w.rows - 1; y++) for (var x = 1; x < w.cols - 1; x++) if (Math.random() < 0.2) w.walls[x + ',' + y] = 1;
    w.start = { x: 1, y: 1, dir: 1 }; w.goal = { x: w.cols - 2, y: w.rows - 2 };
    delete w.walls['1,1']; delete w.walls[(w.cols - 2) + ',' + (w.rows - 2)];
    for (var i = 0; i < 3; i++) { var gx = 1 + Math.floor(Math.random() * (w.cols - 2)), gy = 1 + Math.floor(Math.random() * (w.rows - 2)); if (!w.walls[gx + ',' + gy]) w.gems[gx + ',' + gy] = 1; }
    if (!planRoute(w, w.start, w.goal)) return randomWorld();
    setWorld(w); D.audit.log('argus', 'Generated random world', w.cols + '×' + w.rows);
  }

  /* ---------------------------------------------------------------- palette */
  function buildPalette() {
    var p = els.palette; p.innerHTML = '';
    var allow = S.mission && S.mission.allow;
    Object.keys(CAT).forEach(function (ck) {
      var types = Object.keys(TYPES).filter(function (t) { return TYPES[t].cat === ck; });
      var grp = D.el('div', { class: 'ag-pgroup' });
      grp.appendChild(D.el('div', { class: 'ag-plabel', html: '<i style="background:' + CAT[ck].color + '"></i>' + CAT[ck].label }));
      types.forEach(function (t) {
        var T = TYPES[t], locked = allow && allow.indexOf(t) < 0;
        var it = D.el('div', { class: 'ag-pcard' + (locked ? ' locked' : ''), draggable: locked ? 'false' : 'true', title: locked ? 'Not needed in this mission' : T.desc, style: { '--cc': CAT[ck].color },
          html: '<span class="ic">' + D.icon(T.icon) + '</span><span class="lb">' + T.label + '</span>' + (locked ? D.icon('lock', 'lk') : '<span class="add">' + D.icon('plus') + '</span>') });
        it.dataset.type = t;
        if (!locked) {
          it.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', 'new:' + t); e.dataTransfer.effectAllowed = 'copy'; document.body.classList.add('ag-dragging'); });
          it.addEventListener('dragend', function () { document.body.classList.remove('ag-dragging'); clearDrop(); });
          it.addEventListener('click', function () { addCard(t); });
        }
        grp.appendChild(it);
      });
      p.appendChild(grp);
    });
  }
  function addCard(type, intoList) {
    if (S.running) resetRun(false);
    var c = newCard(type), target = intoList || selectedList();
    target.push(c);
    D.sound.click();
    changed('Added card: ' + TYPES[type].label);
    flashCard(c.id);
    return c;
  }
  function selectedList() {
    if (S.selected) {
      var f = findCard(S.prog, S.selected.id);
      if (f && f.card[S.selected.slot]) return f.card[S.selected.slot];
    }
    return S.prog;
  }

  /* ---------------------------------------------------------------- program rendering */
  var order = [];
  function colorOf(id) { var i = order.indexOf(id); return PATH_COLORS[(i < 0 ? 0 : i) % PATH_COLORS.length]; }
  function renderProgram() {
    var host = els.prog; host.innerHTML = '';
    order = S.prog.map(function (c) { return c.id; });
    els.count.textContent = countCards(S.prog) + ' card' + (countCards(S.prog) === 1 ? '' : 's');
    if (S.view === 'text') {
      host.appendChild(D.el('pre', { class: 'ag-text', text: S.prog.length ? toText(S.prog) : '(no cards yet)' }));
      return;
    }
    if (!S.prog.length) {
      host.appendChild(D.el('div', { class: 'ag-empty', dataset: { list: 'root' }, html:
        '<svg viewBox="0 0 120 70"><rect x="8" y="10" width="104" height="24" rx="7" fill="none" stroke="var(--line-2)" stroke-dasharray="5 4"/><rect x="18" y="16" width="50" height="12" rx="4" fill="#38bdf8" opacity=".7"/><path d="M60 60 L70 42" stroke="var(--accent)" stroke-width="2" marker-end="url(#ae)"/><defs><marker id="ae" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6z" fill="var(--accent)"/></marker></defs></svg>' +
        '<b>Your track is empty</b><span>Drag a card from the deck — or click one — to add it here.</span>' }));
      return;
    }
    host.appendChild(renderList(S.prog, 'root', 0));
  }
  function renderList(list, listKey, depth) {
    var ul = D.el('div', { class: 'ag-list' + (depth ? ' nested' : ''), dataset: { list: listKey } });
    list.forEach(function (c, i) { ul.appendChild(renderCard(c, depth ? null : i, depth)); });
    if (depth && !list.length) ul.appendChild(D.el('div', { class: 'ag-slot-empty', text: 'drop cards here' }));
    return ul;
  }
  function renderCard(c, idx, depth) {
    var T = TYPES[c.type], col = CAT[T.cat].color;
    var card = D.el('div', { class: 'ag-card', draggable: 'true', dataset: { id: c.id }, style: { '--cc': col } });
    var head = D.el('div', { class: 'ag-chead' });
    if (idx != null) head.appendChild(D.el('span', { class: 'ag-num', style: { background: colorOf(c.id) }, text: String(idx + 1) }));
    head.appendChild(D.el('span', { class: 'ic', html: D.icon(T.icon) }));
    head.appendChild(D.el('span', { class: 'lb', text: T.label }));
    if (T.num) head.appendChild(stepper(c, T.num, depth > 0));
    if (T.cond) {
      var sel = D.el('select', { class: 'ag-sel' });
      CONDS.forEach(function (o) { sel.appendChild(D.el('option', { value: o[0], text: o[1] })); });
      sel.value = c.cond; sel.onchange = function () { c.cond = sel.value; changed('Changed condition'); };
      sel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      head.appendChild(sel);
    }
    if (T.expr) {
      var es = D.el('select', { class: 'ag-sel' });
      FEELS.forEach(function (k) { es.appendChild(D.el('option', { value: k, text: D.EXPRESSIONS[k].emoji + ' ' + D.EXPRESSIONS[k].label })); });
      es.value = c.expr; es.onchange = function () { c.expr = es.value; changed('Changed feeling'); };
      head.appendChild(es);
    }
    head.appendChild(D.el('button', { class: 'ag-x', title: 'Remove card', html: D.icon('x'), onclick: function (e) { e.stopPropagation(); removeCard(c.id); } }));
    card.appendChild(head);
    if (T.body) {
      var slotB = D.el('div', { class: 'ag-slot' + (S.selected && S.selected.id === c.id && S.selected.slot === 'body' ? ' sel' : '') });
      slotB.appendChild(D.el('div', { class: 'ag-slot-label', text: c.type === 'ifc' ? 'then' : 'do' }));
      slotB.appendChild(renderList(c.body, c.id + ':body', depth + 1));
      slotB.addEventListener('click', function (e) { if (e.target.closest('.ag-card') !== card) return; e.stopPropagation(); toggleSelect(c.id, 'body'); });
      card.appendChild(slotB);
    }
    if (T.alt) {
      var slotA = D.el('div', { class: 'ag-slot alt' + (S.selected && S.selected.id === c.id && S.selected.slot === 'alt' ? ' sel' : '') });
      slotA.appendChild(D.el('div', { class: 'ag-slot-label', text: 'otherwise' }));
      slotA.appendChild(renderList(c.alt, c.id + ':alt', depth + 1));
      slotA.addEventListener('click', function (e) { if (e.target.closest('.ag-card') !== card) return; e.stopPropagation(); toggleSelect(c.id, 'alt'); });
      card.appendChild(slotA);
    }
    card.addEventListener('mouseenter', function (e) { e.stopPropagation(); stage.hover = topId(c.id); });
    card.addEventListener('mouseleave', function () { stage.hover = null; });
    card.addEventListener('dragstart', function (e) { e.stopPropagation(); e.dataTransfer.setData('text/plain', 'move:' + c.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); document.body.classList.add('ag-dragging'); });
    card.addEventListener('dragend', function () { card.classList.remove('dragging'); document.body.classList.remove('ag-dragging'); clearDrop(); });
    return card;
  }
  function topId(id) {
    for (var i = 0; i < S.prog.length; i++) { var hit = false; walk([S.prog[i]], function (c) { if (c.id === id) hit = true; }); if (hit) return S.prog[i].id; }
    return id;
  }
  function stepper(c, spec, compact) {
    var w = D.el('span', { class: 'ag-step' });
    var minus = D.el('button', { text: '−', onclick: function (e) { e.stopPropagation(); if (c.n > spec.min) { c.n--; changed(); } } });
    var val = D.el('b', { text: String(c.n) });
    var plus = D.el('button', { text: '+', onclick: function (e) { e.stopPropagation(); if (c.n < spec.max) { c.n++; changed(); } } });
    w.appendChild(minus); w.appendChild(val); w.appendChild(plus);
    if (!compact) w.appendChild(D.el('small', { text: spec.unit + (c.n === 1 ? '' : 's') }));
    w.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    return w;
  }
  function toggleSelect(id, slot) {
    if (S.selected && S.selected.id === id && S.selected.slot === slot) S.selected = null; else S.selected = { id: id, slot: slot };
    renderProgram();
    if (S.selected) D.ui.toast('New cards now go <b>inside</b> this slot. Click it again to go back to the main track.', '', 2400);
  }
  function removeCard(id) {
    var f = findCard(S.prog, id); if (!f) return;
    f.list.splice(f.index, 1);
    if (S.selected && S.selected.id === id) S.selected = null;
    if (S.running) resetRun(false);
    D.sound.beep(300, 0.05, 'triangle', 0.04);
    changed('Removed card: ' + TYPES[f.card.type].label);
  }
  function flashCard(id) {
    setTimeout(function () { var el = els.prog.querySelector('[data-id="' + id + '"]'); if (el) { el.classList.add('flash'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 20);
  }

  /* ---------------------------------------------------------------- drag & drop into lists */
  var dropMarker = null;
  function clearDrop() { if (dropMarker) dropMarker.remove(); dropMarker = null; D.$$('.ag-list.over, .ag-empty.over').forEach(function (x) { x.classList.remove('over'); }); }
  function listFromKey(key) {
    if (key === 'root') return S.prog;
    var p = key.split(':'), f = findCard(S.prog, p[0]);
    return f ? f.card[p[1]] : null;
  }
  function wireDnD() {
    els.prog.addEventListener('dragover', function (e) {
      e.preventDefault();
      var listEl = e.target.closest('[data-list]') || els.prog.querySelector('[data-list="root"]');
      if (!listEl) return;
      clearDrop(); listEl.classList.add('over');
      if (listEl.classList.contains('ag-empty')) return;
      var kids = Array.prototype.filter.call(listEl.children, function (k) { return k.classList.contains('ag-card'); });
      var idx = kids.length;
      for (var i = 0; i < kids.length; i++) { var r = kids[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = i; break; } }
      dropMarker = D.el('div', { class: 'ag-drop' });
      if (idx < kids.length) listEl.insertBefore(dropMarker, kids[idx]); else listEl.appendChild(dropMarker);
      listEl.dataset.dropIndex = idx;
    });
    els.prog.addEventListener('dragleave', function (e) { if (!els.prog.contains(e.relatedTarget)) clearDrop(); });
    els.prog.addEventListener('drop', function (e) {
      e.preventDefault();
      var data = e.dataTransfer.getData('text/plain');
      var listEl = e.target.closest('[data-list]') || els.prog.querySelector('[data-list="root"]');
      var key = listEl ? listEl.dataset.list : 'root', idx = listEl && listEl.dataset.dropIndex != null ? +listEl.dataset.dropIndex : Infinity;
      clearDrop(); document.body.classList.remove('ag-dragging');
      var target = listFromKey(key); if (!target) return;
      if (data.indexOf('new:') === 0) {
        var c = newCard(data.slice(4)); target.splice(Math.min(idx, target.length), 0, c); D.sound.click();
        changed('Added card: ' + TYPES[c.type].label); flashCard(c.id);
      } else if (data.indexOf('move:') === 0) {
        var id = data.slice(5), f = findCard(S.prog, id); if (!f) return;
        var inside = false; walk([f.card], function (x) { if (x.body === target || x.alt === target) inside = true; });
        if (inside) return;                         // can't drop a loop into itself
        f.list.splice(f.index, 1);
        if (f.list === target && f.index < idx) idx--;
        target.splice(Math.min(idx, target.length), 0, f.card);
        changed('Moved card: ' + TYPES[f.card.type].label); flashCard(id);
      }
      if (S.running) resetRun(false);
    });
    els.trash.addEventListener('dragover', function (e) { e.preventDefault(); els.trash.classList.add('over'); });
    els.trash.addEventListener('dragleave', function () { els.trash.classList.remove('over'); });
    els.trash.addEventListener('drop', function (e) {
      e.preventDefault(); els.trash.classList.remove('over'); document.body.classList.remove('ag-dragging');
      var data = e.dataTransfer.getData('text/plain'); if (data.indexOf('move:') === 0) removeCard(data.slice(5));
    });
  }

  /* ---------------------------------------------------------------- change pipeline */
  function changed(logMsg) {
    S.preview = simulate(S.prog, S.world);
    renderProgram();
    renderStatus();
    if (!S.running) { stage.robot.x = S.world.start.x; stage.robot.y = S.world.start.y; stage.robot.a = S.world.start.dir * 90; stage.trail = []; }
    if (S.mission) saveMissionProg(); else saveFree();
    if (logMsg) D.audit.log('argus', logMsg, (S.mission ? S.mission.title : 'Free play') + ' · ' + countCards(S.prog) + ' cards');
  }
  function renderStatus(runInfo) {
    var p = S.preview, w = S.world, st = p.state;
    var gemsTotal = Object.keys(w.gems).length;
    var atGoal = st.x === w.goal.x && st.y === w.goal.y;
    var ok = atGoal && (!(S.mission ? S.mission.needGems : false) || st.gemCount === gemsTotal);
    var dist = Math.abs(st.x - w.goal.x) + Math.abs(st.y - w.goal.y);
    var html = '';
    if (!S.prog.length) html = '<span class="chip">' + D.icon('info') + 'Add cards to see a preview</span>';
    else if (p.limit) html = '<span class="chip red">' + D.icon('x') + 'Program runs too long (' + STEP_LIMIT + '+ actions) — check your loops</span>';
    else if (ok) html = '<span class="chip green">' + D.icon('check') + 'Preview: reaches the goal in ' + st.moves + ' moves</span>';
    else if (atGoal) html = '<span class="chip amber">' + D.icon('gem') + 'Reaches the flag but misses ' + (gemsTotal - st.gemCount) + ' gem(s)</span>';
    else html = '<span class="chip amber">' + D.icon('route') + 'Preview: ends ' + dist + ' cell' + (dist === 1 ? '' : 's') + ' away from the goal</span>';
    var live = S.st || makeState(w);
    html += '<span class="spacer"></span>' +
      '<span class="ag-meter" title="Moves">' + D.icon('route') + '<b>' + live.moves + '</b></span>' +
      '<span class="ag-meter" title="Bumps">' + D.icon('bolt') + '<b>' + live.bumps + '</b></span>' +
      (gemsTotal ? '<span class="ag-meter" title="Gems">' + D.icon('gem') + '<b>' + live.gemCount + '/' + gemsTotal + '</b></span>' : '') +
      '<span class="ag-meter" title="Heading">' + D.icon('rotate') + '<b>' + DIRS[live.dir].n + '</b></span>';
    els.status.innerHTML = html;
  }

  /* ---------------------------------------------------------------- running */
  function dur() { return [0, 520, 360, 240, 140, 70][S.speed] || 240; }
  function startRun() {
    if (!S.prog.length) { D.ui.toast('Add some cards first — drag one from the deck.', 'warn'); return; }
    resetRun(false);
    S.st = makeState(S.world); S.gen = run(S.prog, S.world, S.st, { steps: 0 }, []); S.running = true; S.paused = false;
    S.runStart = performance.now();
    stage.trail = [{ x: S.st.x, y: S.st.y }];
    els.run.innerHTML = D.icon('pause') + 'Pause'; els.run.onclick = pauseRun;
    D.audit.log('argus', 'Ran program', (S.mission ? S.mission.title : 'Free play') + ' · ' + countCards(S.prog) + ' cards');
    nextEvent();
  }
  function pauseRun() {
    if (!S.running) return;
    S.paused = true;
    els.run.innerHTML = D.icon('play') + 'Resume'; els.run.onclick = resume;
  }
  function resume() { if (!S.running) return startRun(); S.paused = false; els.run.innerHTML = D.icon('pause') + 'Pause'; els.run.onclick = pauseRun; if (!anim) nextEvent(); }
  function stepOnce() {
    if (!S.running) { startRun(); pauseRun(); return; }
    S.paused = true; els.run.innerHTML = D.icon('play') + 'Resume'; els.run.onclick = resume;
    if (!anim) nextEvent(true);
  }
  function resetRun(log) {
    S.running = false; S.paused = false; S.gen = null; S.st = null; anim = null; checkBubble = null;
    if (els.run) { els.run.innerHTML = D.icon('play') + 'Run'; els.run.onclick = startRun; }
    D.$$('.ag-card.active, .ag-card.ran').forEach(function (x) { x.classList.remove('active', 'ran'); });
    if (stage && S.world) { stage.robot.x = S.world.start.x; stage.robot.y = S.world.start.y; stage.robot.a = S.world.start.dir * 90; stage.robot.expr = 'neutral'; stage.trail = []; }
    if (els.status && S.preview) renderStatus();
    if (log) D.audit.log('argus', 'Reset robot', '');
  }
  function nextEvent(single) {
    if (!S.gen) return;
    var r = S.gen.next();
    if (r.done) return finishRun();
    var e = r.value;
    D.$$('.ag-card.active').forEach(function (x) { x.classList.remove('active'); });
    e.stack.forEach(function (id) { var el = els.prog.querySelector('[data-id="' + id + '"]'); if (el) el.classList.add('active', 'ran'); });
    var R = stage.robot;
    var from = { x: R.x, y: R.y, a: R.a };
    var toA = e.dir * 90;
    var da = ((toA - from.a) % 360 + 540) % 360 - 180;
    anim = { e: e, t0: performance.now(), d: e.kind === 'wait' ? dur() * e.n * 1.5 : e.kind === 'check' || e.kind === 'emote' ? dur() * 1.3 : dur(), from: from, to: { x: e.x, y: e.y, a: from.a + da }, single: single };
    if (e.kind === 'move') { D.sound.move(); if (e.gem) { stage.flash.push({ x: e.x, y: e.y, t: performance.now() / 1000 }); D.sound.good(); } }
    if (e.kind === 'bump') { D.sound.bump(); R.bump = 1; R.expr = 'surprised'; }
    if (e.kind === 'turn') D.sound.beep(700, 0.03, 'sine', 0.03);
    if (e.kind === 'check') { checkBubble = { text: condLabel(findCard(S.prog, e.card).card.cond) + '? ' + (e.result ? 'YES' : 'no'), ok: e.result }; D.sound.beep(e.result ? 990 : 440, 0.05, 'sine', 0.04); }
    if (e.kind === 'emote') R.expr = e.expr;
  }
  function stepAnim() {
    if (!anim) return;
    var k = Math.min(1, (performance.now() - anim.t0) / anim.d), R = stage.robot;
    var ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    R.x = D.lerp(anim.from.x, anim.to.x, ease); R.y = D.lerp(anim.from.y, anim.to.y, ease); R.a = D.lerp(anim.from.a, anim.to.a, ease);
    if (R.bump > 0) R.bump = Math.max(0, 1 - k);
    if (k >= 1) {
      var e = anim.e; var single = anim.single; anim = null;
      R.x = e.x; R.y = e.y; R.a = e.dir * 90;
      if (e.kind === 'move') stage.trail.push({ x: e.x, y: e.y });
      if (e.kind === 'bump' && R.expr === 'surprised') R.expr = 'neutral';
      if (e.kind === 'check') checkBubble = null;
      renderStatus();
      if (S.running && !S.paused && !single) nextEvent();
    }
  }
  function finishRun() {
    var st = S.st, w = S.world;
    S.running = false; S.gen = null;
    els.run.innerHTML = D.icon('reset') + 'Run again'; els.run.onclick = startRun;
    D.$$('.ag-card.active').forEach(function (x) { x.classList.remove('active'); });
    var gemsTotal = Object.keys(w.gems).length;
    var atGoal = st.x === w.goal.x && st.y === w.goal.y;
    var needGems = S.mission ? S.mission.needGems : false;
    var ok = atGoal && (!needGems || st.gemCount === gemsTotal);
    var detail = st.moves + ' moves, ' + st.bumps + ' bumps' + (gemsTotal ? ', ' + st.gemCount + '/' + gemsTotal + ' gems' : '');
    if (ok) {
      stage.robot.expr = 'happy'; D.sound.win();
      if (S.mission) {
        var cards = countCards(S.prog), m = S.mission, stars = cards <= m.par ? 3 : cards <= m.par + 2 ? 2 : 1;
        var prev = progress[m.id] || 0; progress[m.id] = Math.max(prev, stars); D.store.set('argus.missions', progress);
        D.audit.log('argus', 'Mission complete', m.title + ' · ' + '★'.repeat(stars) + ' · ' + cards + ' cards · ' + detail, 'success', { mission: m.id, stars: stars, cards: cards });
        renderMission();
        celebrate(m, stars, cards);
      } else {
        D.audit.log('argus', 'Reached goal', detail, 'success');
        D.ui.toast('Goal reached! ' + detail, 'good');
      }
    } else {
      stage.robot.expr = st.bumps ? 'confused' : 'thinking';
      var why = atGoal ? 'Reached the flag but missed ' + (gemsTotal - st.gemCount) + ' gem(s).' : 'Stopped ' + (Math.abs(st.x - w.goal.x) + Math.abs(st.y - w.goal.y)) + ' cells from the goal.';
      D.ui.toast(why + ' Watch the dashed preview line and adjust the cards.', 'warn', 4200);
      D.audit.log('argus', 'Run ended short of goal', why + ' ' + detail, 'warn');
    }
    renderStatus();
  }
  function celebrate(m, stars, cards) {
    var idx = MISSIONS.indexOf(m), next = MISSIONS[idx + 1];
    var host = D.el('div', { class: 'ag-win' });
    host.appendChild(D.el('div', { class: 'ag-stars', html: [1, 2, 3].map(function (i) { return '<span class="' + (i <= stars ? 'on' : '') + '">★</span>'; }).join('') }));
    host.appendChild(D.el('p', { class: 'muted', html: 'You solved <b>' + m.title + '</b> with <b>' + cards + '</b> card' + (cards > 1 ? 's' : '') + '. ' + (stars < 3 ? 'Three stars need ' + m.par + ' card' + (m.par > 1 ? 's' : '') + ' or fewer — can you shorten it?' : 'Perfect — that is the shortest program!') }));
    D.ui.modal(host, {
      title: 'Mission complete!', actions: [
        { label: 'Stay here', kind: 'ghost' },
        next ? { label: 'Next mission →', kind: 'primary', onClick: function () { openMission(next.id); } } : { label: 'Try free play →', kind: 'primary', onClick: function () { els.modeSeg.setValue('free'); setMode('free'); } }
      ]
    });
  }

  function doAutoPlan() {
    var p = autoPlan(S.world, S.mission ? S.mission.needGems : true);
    if (!p) { D.ui.toast('No route exists — the goal is walled in.', 'bad'); return; }
    if (S.mission && S.mission.allow) {
      var bad = p.some(function (c) { return S.mission.allow.indexOf(c.type) < 0; });
      if (bad) p = p.map(function (c) { if (c.type === 'uturn') { var a = newCard('right'), b = newCard('right'); return [a, b]; } return c; }).reduce(function (a, b) { return a.concat(b); }, []);
    }
    resetRun(false);
    S.prog = p; S.selected = null;
    changed('Auto-planned route');
    D.ui.toast('Argus planned ' + countCards(p) + ' cards using a breadth-first search. Can you make it shorter with loops?', 'good', 4200);
  }

  /* ---------------------------------------------------------------- drive pad (+ hands-free) */
  function buildPad() {
    var pad = D.el('div', { class: 'ag-pad' });
    var title = D.el('button', { class: 'ag-pad-title', title: 'Show / hide the drive pad', html: D.icon('keyboard') + '<span>Drive &amp; record</span>' + D.icon('arrowUp', 'chev') });
    title.onclick = function () { var mi = !pad.classList.contains('min'); pad.classList.toggle('min', mi); D.store.set('argus.padMin', mi); };
    if (D.store.get('argus.padMin', true)) pad.classList.add('min');
    pad.appendChild(title);
    var g = D.el('div', { class: 'ag-pad-grid' });
    function b(icon, act, title, cls) { var x = D.el('button', { class: 'btn icon ' + (cls || ''), html: D.icon(icon), title: title, onclick: function () { drive(act); } }); g.appendChild(x); return x; }
    g.appendChild(D.el('span')); b('arrowUp', 'fwd', 'Forward (↑ / W)'); g.appendChild(D.el('span'));
    b('turnLeft', 'left', 'Turn left (← / A)'); b('arrowDown', 'back', 'Back (↓ / S)'); b('turnRight', 'right', 'Turn right (→ / D)');
    pad.appendChild(g);
    els.handsBtn = D.el('button', { class: 'btn sm', html: D.icon('hand') + 'Hands-free', title: 'Drive by pointing your finger at the camera', onclick: function () { toggleHands(!handsOn); } });
    pad.appendChild(els.handsBtn);
    els.handsBox = D.el('div', { class: 'ag-hands hidden' });
    els.handsVideo = D.el('video', { autoplay: true, muted: true, playsinline: true });
    els.handsBox.appendChild(els.handsVideo);
    els.handsLabel = D.el('div', { class: 'ag-hands-label', text: 'Point ☝ up / ← / → / ↓ · 👍 run · ✋ stop' });
    els.handsBox.appendChild(els.handsLabel);
    pad.appendChild(els.handsBox);
    return pad;
  }
  function drive(act) {
    if (S.running) resetRun(false);
    /* simulate current end state then append (merging forwards) */
    var last = S.prog[S.prog.length - 1];
    if (act === 'fwd' && last && last.type === 'fwd' && last.n < 9) last.n++;
    else if (act === 'back' && last && last.type === 'back' && last.n < 9) last.n++;
    else {
      if (S.mission && S.mission.allow && S.mission.allow.indexOf(act) < 0) { D.ui.toast('That card is not available in this mission.', 'warn'); return; }
      var c = newCard(act); if (c.n) c.n = 1; S.prog.push(c);
    }
    changed();
    /* move the live robot to the new predicted end so driving feels direct */
    var st = S.preview.state; stage.robot.x = st.x; stage.robot.y = st.y; stage.robot.a = st.dir * 90;
    var lastE = S.preview.events[S.preview.events.length - 1];
    if (lastE && lastE.kind === 'bump') { D.sound.bump(); stage.robot.bump = 1; } else D.sound.move();
    D.audit.log('argus', 'Drove robot', act + ' (recorded as a card)');
  }
  function onKey(e) {
    if (D.router.current() !== 'argus' || D.$('.modal-wrap') || D.$('.tut-wrap')) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    var map = { ArrowUp: 'fwd', w: 'fwd', W: 'fwd', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'back', s: 'back', S: 'back' };
    if (map[e.key]) { e.preventDefault(); drive(map[e.key]); }
    else if (e.key === ' ') { e.preventDefault(); if (S.running && !S.paused) pauseRun(); else if (S.running) resume(); else startRun(); }
    else if (e.key === 'Backspace' && S.prog.length) { e.preventDefault(); removeCard(S.prog[S.prog.length - 1].id); }
  }
  function toggleHands(on) {
    handsOn = on;
    els.handsBtn.classList.toggle('active', on);
    els.handsBox.classList.toggle('hidden', !on);
    if (on) {
      els.pad.classList.remove('min');
      stab = new D.vision.GestureStabilizer(450);
      D.vision.attach(els.handsVideo);
      D.vision.start('argus', 'hands').then(function () {
        D.audit.log('argus', 'Hands-free driving on', 'Camera hand tracking');
        D.vision.attach(els.handsVideo);
      }).catch(function (err) { D.ui.toast(err.message, 'bad'); toggleHands(false); });
      unsubVision = D.vision.on(function (f) {
        if (f.mode !== 'hands') return;
        var h = f.hands[0], key = null;
        if (h) key = h.gesture === 'point' || (h.fingers.index && !h.fingers.middle && h.pointDir) ? 'dir:' + h.pointDir : h.gesture;
        var r = stab.push(key);
        els.handsLabel.textContent = h ? (h.pointDir && key && key.indexOf('dir:') === 0 ? 'Pointing ' + h.pointDir : (h.info ? h.info.emoji + ' ' + h.info.label : 'hand seen')) : 'No hand — point ☝ to drive';
        if (!r.changed || !r.key) return;
        var k = r.key;
        if (k === 'dir:up') drive('fwd'); else if (k === 'dir:left') drive('left'); else if (k === 'dir:right') drive('right'); else if (k === 'dir:down') drive('back');
        else if (k === 'thumbs_up') startRun(); else if (k === 'open_palm') { if (S.running) pauseRun(); }
        /* allow repeating the same direction: re-arm after it fires */
        if (k.indexOf('dir:') === 0) stab.stable = null, stab.since = performance.now() + 250;
      });
    } else {
      if (unsubVision) unsubVision(); unsubVision = null;
      D.vision.stop('argus');
      D.audit.log('argus', 'Hands-free driving off', '');
    }
  }

  /* ---------------------------------------------------------------- canvas editing */
  function wireCanvas() {
    var painting = false, paintVal = null;
    els.canvas.addEventListener('mousemove', function (e) {
      hoverCell = (!S.mission) ? stage.cellAt(S.world, e.clientX, e.clientY) : null;
      if (painting && hoverCell) paint(hoverCell, paintVal);
    });
    els.canvas.addEventListener('mouseleave', function () { hoverCell = null; painting = false; });
    global.addEventListener('mouseup', function () { if (painting) { painting = false; changed('Edited world (' + S.tool + ')'); } });
    els.canvas.addEventListener('mousedown', function (e) {
      if (S.mission) { D.ui.toast('Missions use a fixed map. Switch to <b>Free play</b> to edit the world.', 'warn'); return; }
      var c = stage.cellAt(S.world, e.clientX, e.clientY); if (!c) return;
      var w = S.world, k = c.x + ',' + c.y;
      if (S.running) resetRun(false);
      if (S.tool === 'robot') {
        if (c.x === w.start.x && c.y === w.start.y) { w.start.dir = (w.start.dir + 1) % 4; changed('Rotated start → ' + DIRS[w.start.dir].n); }
        else if (!w.walls[k]) { w.start.x = c.x; w.start.y = c.y; changed('Moved start to ' + k); }
        return;
      }
      if (S.tool === 'goal') { if (!w.walls[k]) { w.goal = { x: c.x, y: c.y }; changed('Moved goal to ' + k); } return; }
      if (S.tool === 'gem') { if (!w.walls[k]) { if (w.gems[k]) delete w.gems[k]; else w.gems[k] = 1; changed('Toggled gem at ' + k); } return; }
      painting = true; paintVal = S.tool === 'wall' ? (w.walls[k] ? 0 : 1) : 0;
      paint(c, paintVal);
    });
  }
  function paint(c, val) {
    var w = S.world, k = c.x + ',' + c.y;
    if ((c.x === w.start.x && c.y === w.start.y) || (c.x === w.goal.x && c.y === w.goal.y)) return;
    if (val) { w.walls[k] = 1; delete w.gems[k]; } else { delete w.walls[k]; if (S.tool === 'erase') delete w.gems[k]; }
    S.preview = simulate(S.prog, S.world);
  }

  function draw() {
    if (!stage || !S.world || D.router.current() !== 'argus') return;
    stage.draw(S.world, S.preview, {
      showPreview: S.showPreview && S.prog.length > 0, colorOf: colorOf, order: order,
      running: S.running, hoverCell: hoverCell, got: S.st ? S.st.got : null, checkBubble: checkBubble
    });
  }

  /* ================================================================ Register */
  D.router.register('argus', { title: 'Argus · Path Studio', icon: 'argus', mount: mount, show: show, hide: hide });

  /* Expose the engine for the tutorial & tests */
  D.argus = {
    TYPES: TYPES, MISSIONS: MISSIONS, parseMap: parseMap, newCard: newCard, simulate: simulate, autoPlan: autoPlan,
    Stage: Stage, run: run, makeState: makeState, countCards: countCards, toText: toText, drawBot: drawBot,
    _state: S, _drive: drive, _start: startRun, _open: openMission, _setMode: function (m) { els.modeSeg.setValue(m); setMode(m); }, _add: addCard
  };
})(window);
