/* maze.js — topology-agnostic maze engine + canvas view.

   ─── MODEL ──────────────────────────────────────────────────────────────
   var m = D.Maze.create({ shape: 'square'|'circle'|'hex', cols, rows, rings })
       m.cells[i] = { id, row, col, cx, cy, nb:[ids], links:{id:true}, sides:[...] }
       m.mud      = { id:true }   cells that cost extra to cross
       m.W, m.H   layout size in cell units
   D.Maze.link(m, a, b) / unlink(m, a, b) / linked(m, a, b) / toggle(m, a, b)
   D.Maze.adjacent(m, a, b)          → bool (neighbours in the grid)
   D.Maze.clearLinks(m)
   D.Maze.generate(m, algo, seed)    algo: backtracker | prim | kruskal | wilson | huntkill
                                      → array of [a,b] links in carve order (for animation)
   D.Maze.braid(m, pct, seed)        remove pct (0..1) of dead ends → loops / multiple routes
   D.Maze.solve(m, start, goal, algo, opts)
       algo: bfs | dfs | astar | dijkstra | greedy | wall | tremaux
       opts: { mudCost: 4 }
       → { found, path:[ids], walk:[ids], visitedOrder:[ids], explored, cost, steps, ms, algo }
         `path` = route from start to goal, `walk` = what a robot physically drives
         (equal to path for global planners; includes backtracking for wall/tremaux).
   D.Maze.analyze(m, start, goal)    → { cells, links, deadEnds, junctions, loops, reachable, shortestPaths, shortestLen, optimalCost }
   D.Maze.reachable(m, a, b), D.Maze.defaults(m) → { start, goal }
   D.Maze.GENERATORS / D.Maze.SOLVERS   [{id, label, desc}]
   D.Maze.rng(seed)                  seeded random() function

   ─── VIEW ───────────────────────────────────────────────────────────────
   var v = new D.MazeView(canvas, m, { padding: 18, robot: 'theseus' })
   v.set({ start, goal, path, visited, visitedUpto, fog, flashes, hover, player, trail })
   v.setMaze(m)          v.render()          v.hitTest(clientX, clientY) → cell id | -1
   v.setRobot(id, instant)                    robot glides to a cell centre
   v.animatePath(path, msPerStep, onStep)     → Promise (resolves at the end / on stop)
   v.animateVisited(order, msPerStep)         → Promise
   v.stop()             v.destroy()
*/
(function (global) {
  'use strict';
  var D = global.D;
  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------ RNG */
  function rng(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(arr, r) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  /* ------------------------------------------------------------ Topologies */
  function cell(id, row, col) { return { id: id, row: row, col: col, cx: 0, cy: 0, nb: [], links: {}, sides: [] }; }

  function buildSquare(cols, rows) {
    var m = { shape: 'square', cols: cols, rows: rows, cells: [], W: cols, H: rows };
    var id = function (c, r) { return (c < 0 || r < 0 || c >= cols || r >= rows) ? null : r * cols + c; };
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ce = cell(r * cols + c, r, c);
      ce.cx = c + 0.5; ce.cy = r + 0.5;
      ce.sides = [
        { nb: id(c, r - 1), t: 'l', x1: c, y1: r, x2: c + 1, y2: r },
        { nb: id(c + 1, r), t: 'l', x1: c + 1, y1: r, x2: c + 1, y2: r + 1 },
        { nb: id(c, r + 1), t: 'l', x1: c, y1: r + 1, x2: c + 1, y2: r + 1 },
        { nb: id(c - 1, r), t: 'l', x1: c, y1: r, x2: c, y2: r + 1 }
      ];
      ce.poly = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]];
      m.cells.push(ce);
    }
    finishNeighbours(m);
    return m;
  }

  function buildHex(cols, rows) {
    var R = 1 / Math.sqrt(3), w = 1;     // pointy-top hexes, width 1
    var m = { shape: 'hex', cols: cols, rows: rows, cells: [], W: cols * w + w / 2, H: rows * 1.5 * R + R / 2 };
    var id = function (c, r) { return (c < 0 || r < 0 || c >= cols || r >= rows) ? null : r * cols + c; };
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ce = cell(r * cols + c, r, c);
      ce.cx = (c + 0.5 * (r & 1)) * w + w / 2; ce.cy = r * 1.5 * R + R;
      var v = [];
      for (var k = 0; k < 6; k++) { var a = (60 * k - 30) * Math.PI / 180; v.push([ce.cx + R * Math.cos(a), ce.cy + R * Math.sin(a)]); }
      var odd = r & 1;
      /* sides: E, SE, SW, W, NW, NE  (vertex k → k+1) */
      var nbs = [
        id(c + 1, r),
        odd ? id(c + 1, r + 1) : id(c, r + 1),
        odd ? id(c, r + 1) : id(c - 1, r + 1),
        id(c - 1, r),
        odd ? id(c, r - 1) : id(c - 1, r - 1),
        odd ? id(c + 1, r - 1) : id(c, r - 1)
      ];
      for (k = 0; k < 6; k++) { var p = v[k], q = v[(k + 1) % 6]; ce.sides.push({ nb: nbs[k], t: 'l', x1: p[0], y1: p[1], x2: q[0], y2: q[1] }); }
      ce.poly = v;
      m.cells.push(ce);
    }
    finishNeighbours(m);
    return m;
  }

  function buildCircle(rings) {
    rings = Math.max(2, rings);
    var m = { shape: 'circle', rings: rings, cells: [], ringStart: [], ringCount: [], W: rings * 2, H: rings * 2 };
    var C = rings;      // centre offset
    var counts = [1];
    for (var r = 1; r < rings; r++) {
      var circ = TAU * r, est = circ / counts[r - 1], ratio = Math.max(1, Math.round(est));
      counts.push(counts[r - 1] * ratio);
    }
    var idx = 0;
    for (r = 0; r < rings; r++) {
      m.ringStart.push(idx); m.ringCount.push(counts[r]);
      for (var i = 0; i < counts[r]; i++) {
        var ce = cell(idx++, r, i);
        if (r === 0) { ce.cx = C; ce.cy = C; }
        else {
          var th = TAU / counts[r], mid = (i + 0.5) * th, rad = r + 0.5;
          ce.cx = C + rad * Math.cos(mid); ce.cy = C + rad * Math.sin(mid);
          ce.a1 = i * th; ce.a2 = (i + 1) * th;
        }
        m.cells.push(ce);
      }
    }
    var cid = function (r, i) { var n = counts[r]; return m.ringStart[r] + ((i % n) + n) % n; };
    for (r = 1; r < rings; r++) {
      var n = counts[r], ratioIn = n / counts[r - 1];
      for (i = 0; i < n; i++) {
        var c2 = m.cells[cid(r, i)];
        var parent = r === 1 ? 0 : cid(r - 1, Math.floor(i / ratioIn));
        c2.parent = parent;
        c2.sides.push({ nb: parent, t: 'a', r: r, a1: c2.a1, a2: c2.a2 });
        if (n > 1) {
          c2.sides.push({ nb: cid(r, i + 1), t: 'rad', a: c2.a2, r1: r, r2: r + 1 });
          c2.sides.push({ nb: cid(r, i - 1), t: 'rad', a: c2.a1, r1: r, r2: r + 1 });
        }
        if (r === rings - 1) c2.sides.push({ nb: null, t: 'a', r: r + 1, a1: c2.a1, a2: c2.a2 });
      }
    }
    /* outward sides (parent → children) */
    for (r = 1; r < rings; r++) for (i = 0; i < counts[r]; i++) {
      var ch = m.cells[cid(r, i)], p = m.cells[ch.parent];
      p.sides.push({ nb: ch.id, t: 'a', r: r, a1: ch.a1, a2: ch.a2 });
    }
    m.C = C;
    finishNeighbours(m);
    return m;
  }

  function finishNeighbours(m) {
    m.cells.forEach(function (c) {
      var seen = {};
      c.sides.forEach(function (s) { if (s.nb != null && !seen[s.nb]) { seen[s.nb] = 1; c.nb.push(s.nb); } });
    });
    m.mud = {};
    /* largest centre-to-centre step, used to keep the A* heuristic admissible */
    var dmax = 0;
    m.cells.forEach(function (c) { c.nb.forEach(function (n) { var o = m.cells[n]; dmax = Math.max(dmax, Math.hypot(o.cx - c.cx, o.cy - c.cy)); }); });
    m.dmax = dmax || 1;
  }

  function create(o) {
    o = o || {};
    var shape = o.shape || 'square';
    if (shape === 'circle') return buildCircle(o.rings || 8);
    if (shape === 'hex') return buildHex(o.cols || 12, o.rows || 9);
    return buildSquare(o.cols || 12, o.rows || 8);
  }

  /* ------------------------------------------------------------ Links */
  function link(m, a, b) { m.cells[a].links[b] = true; m.cells[b].links[a] = true; }
  function unlink(m, a, b) { delete m.cells[a].links[b]; delete m.cells[b].links[a]; }
  function linked(m, a, b) { return !!m.cells[a].links[b]; }
  function adjacent(m, a, b) { return a !== b && m.cells[a] && m.cells[a].nb.indexOf(b) >= 0; }
  function toggle(m, a, b) { if (!adjacent(m, a, b)) return false; if (linked(m, a, b)) unlink(m, a, b); else link(m, a, b); return true; }
  function clearLinks(m) { m.cells.forEach(function (c) { c.links = {}; }); }
  function linksOf(m, a) { return Object.keys(m.cells[a].links).map(Number); }
  function degree(m, a) { return Object.keys(m.cells[a].links).length; }

  /* ------------------------------------------------------------ Generators */
  var GENERATORS = [
    { id: 'backtracker', label: 'Recursive backtracker', desc: 'Long winding corridors, few dead ends. A depth-first random walk that backs up when stuck.' },
    { id: 'prim', label: "Prim's algorithm", desc: 'Grows outward from one cell like a crystal. Many short dead ends, bushy look.' },
    { id: 'kruskal', label: "Kruskal's algorithm", desc: 'Joins random walls between separate regions until everything is connected.' },
    { id: 'wilson', label: "Wilson's algorithm", desc: 'Loop-erased random walks. Perfectly unbiased: every possible maze is equally likely.' },
    { id: 'huntkill', label: 'Hunt-and-kill', desc: 'Random walk; when stuck, hunts for an unvisited cell next to the maze and continues.' }
  ];

  function generate(m, algo, seed) {
    clearLinks(m);
    var r = rng(seed == null ? (Math.random() * 1e9) | 0 : seed);
    var N = m.cells.length, order = [];
    var carve = function (a, b) { link(m, a, b); order.push([a, b]); };
    var visited = new Array(N).fill(false);
    var start = Math.floor(r() * N);

    if (algo === 'prim') {
      visited[start] = true;
      var frontier = m.cells[start].nb.map(function (n) { return [start, n]; });
      while (frontier.length) {
        var k = Math.floor(r() * frontier.length), e = frontier[k];
        frontier[k] = frontier[frontier.length - 1]; frontier.pop();
        if (visited[e[1]]) continue;
        visited[e[1]] = true; carve(e[0], e[1]);
        m.cells[e[1]].nb.forEach(function (n) { if (!visited[n]) frontier.push([e[1], n]); });
      }
    } else if (algo === 'kruskal') {
      var parent = []; for (var i = 0; i < N; i++) parent.push(i);
      var find = function (x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      var edges = [];
      m.cells.forEach(function (c) { c.nb.forEach(function (n) { if (n > c.id) edges.push([c.id, n]); }); });
      shuffle(edges, r).forEach(function (e) { var a = find(e[0]), b = find(e[1]); if (a !== b) { parent[a] = b; carve(e[0], e[1]); } });
    } else if (algo === 'wilson') {
      var inMaze = visited; inMaze[start] = true; var remaining = N - 1;
      var cellsLeft = shuffle(m.cells.map(function (c) { return c.id; }), r);
      var ci = 0;
      while (remaining > 0) {
        while (inMaze[cellsLeft[ci]]) ci++;
        var cur = cellsLeft[ci], path = [cur], pos = {}; pos[cur] = 0;
        while (!inMaze[cur]) {
          cur = pick(m.cells[cur].nb, r);
          if (pos[cur] != null) { var cut = pos[cur]; for (var q = cut + 1; q < path.length; q++) delete pos[path[q]]; path.length = cut + 1; }
          else { pos[cur] = path.length; path.push(cur); }
        }
        for (var p = 0; p < path.length - 1; p++) { carve(path[p], path[p + 1]); inMaze[path[p]] = true; remaining--; }
      }
    } else if (algo === 'huntkill') {
      var cur2 = start; visited[cur2] = true;
      while (cur2 != null) {
        var un = m.cells[cur2].nb.filter(function (n) { return !visited[n]; });
        if (un.length) { var nx = pick(un, r); carve(cur2, nx); visited[nx] = true; cur2 = nx; }
        else {
          cur2 = null;
          for (var h = 0; h < N && cur2 == null; h++) {
            if (visited[h]) continue;
            var vn = m.cells[h].nb.filter(function (n) { return visited[n]; });
            if (vn.length) { carve(h, pick(vn, r)); visited[h] = true; cur2 = h; }
          }
        }
      }
    } else {   /* recursive backtracker */
      var stack = [start]; visited[start] = true;
      while (stack.length) {
        var top = stack[stack.length - 1];
        var opts = m.cells[top].nb.filter(function (n) { return !visited[n]; });
        if (!opts.length) { stack.pop(); continue; }
        var n2 = pick(opts, r); carve(top, n2); visited[n2] = true; stack.push(n2);
      }
    }
    m.algo = algo; m.seed = seed;
    return order;
  }

  /* Remove a share of dead ends → loops and multiple solutions. Returns added links. */
  function braid(m, pct, seed) {
    var r = rng(seed == null ? 7 : seed), added = [];
    if (!pct) return added;
    var ends = shuffle(m.cells.filter(function (c) { return degree(m, c.id) === 1; }).map(function (c) { return c.id; }), r);
    ends.forEach(function (id) {
      if (degree(m, id) !== 1 || r() > pct) return;
      var cand = m.cells[id].nb.filter(function (n) { return !linked(m, id, n); });
      if (!cand.length) return;
      var best = cand.filter(function (n) { return degree(m, n) === 1; });
      var t = pick(best.length ? best : cand, r);
      link(m, id, t); added.push([id, t]);
    });
    return added;
  }

  /* ------------------------------------------------------------ Solvers */
  var SOLVERS = [
    { id: 'bfs', label: 'Breadth-first search', short: 'BFS', desc: 'Explores in rings of equal distance. Always finds the fewest-steps route.', global: true },
    { id: 'dfs', label: 'Depth-first search', short: 'DFS', desc: 'Dives down one corridor until it ends. Finds a route, rarely the shortest.', global: true },
    { id: 'astar', label: 'A* (A-star)', short: 'A*', desc: 'Dijkstra plus a straight-line guess to the goal. Optimal and focused.', global: true },
    { id: 'dijkstra', label: "Dijkstra's algorithm", short: 'Dijkstra', desc: 'Cheapest route when cells cost different amounts (mud!).', global: true },
    { id: 'greedy', label: 'Greedy best-first', short: 'Greedy', desc: 'Always heads to whatever looks closest. Fast but can be fooled.', global: true },
    { id: 'wall', label: 'Left-hand wall follower', short: 'Wall', desc: 'A robot with no map keeps its left hand on the wall. Works in perfect mazes.', global: false },
    { id: 'tremaux', label: 'Trémaux explorer', short: 'Trémaux', desc: 'A robot with no map marks corridors and backtracks from dead ends. Always succeeds.', global: false }
  ];

  function stepCost(m, id, mudCost) { return m.mud[id] ? (mudCost || 4) : 1; }
  function h(m, a, b) { var A = m.cells[a], B = m.cells[b]; return Math.hypot(A.cx - B.cx, A.cy - B.cy) / m.dmax; }
  function rebuild(prev, goal) { var p = [], c = goal; while (c != null && c !== -1) { p.push(c); c = prev[c]; } return p.reverse(); }
  function pathCost(m, path, mudCost) { var s = 0; for (var i = 1; i < path.length; i++) s += stepCost(m, path[i], mudCost); return s; }

  /* minimal binary heap keyed on .k */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (x) { var a = this.a; a.push(x); var i = a.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (a[p].k <= a[i].k) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; } };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, s = i; if (l < a.length && a[l].k < a[s].k) s = l; if (r < a.length && a[r].k < a[s].k) s = r; if (s === i) break; var t = a[s]; a[s] = a[i]; a[i] = t; i = s; } }
    return top;
  };
  Heap.prototype.size = function () { return this.a.length; };

  function solve(m, start, goal, algo, opts) {
    opts = opts || {};
    var mc = opts.mudCost || 4, t0 = performance.now();
    var N = m.cells.length, prev = new Array(N).fill(-1), seen = new Array(N).fill(false), order = [];
    var res = { algo: algo, found: false, path: [], walk: [], visitedOrder: order };
    if (start == null || goal == null || start < 0 || goal < 0) return finish();

    if (algo === 'bfs') {
      var q = [start], qi = 0; seen[start] = true;
      while (qi < q.length) {
        var c = q[qi++]; order.push(c);
        if (c === goal) { res.found = true; break; }
        linksOf(m, c).forEach(function (n) { if (!seen[n]) { seen[n] = true; prev[n] = c; q.push(n); } });
      }
    } else if (algo === 'dfs') {
      var st = [[start, -1]];
      while (st.length) {
        var top0 = st.pop(), d = top0[0];
        if (seen[d]) continue; seen[d] = true; prev[d] = top0[1]; order.push(d);
        if (d === goal) { res.found = true; break; }
        linksOf(m, d).forEach(function (n) { if (!seen[n]) st.push([n, d]); });
      }
    } else if (algo === 'astar' || algo === 'dijkstra' || algo === 'greedy') {
      var g = new Array(N).fill(Infinity), hp = new Heap(); g[start] = 0;
      var key = function (n) { return algo === 'dijkstra' ? g[n] : algo === 'greedy' ? h(m, n, goal) : g[n] + h(m, n, goal); };
      hp.push({ k: key(start), id: start });
      while (hp.size()) {
        var e = hp.pop(), u = e.id;
        if (seen[u]) continue; seen[u] = true; order.push(u);
        if (u === goal) { res.found = true; break; }
        linksOf(m, u).forEach(function (n) {
          if (seen[n]) return;
          var ng = g[u] + (algo === 'greedy' ? 1 : stepCost(m, n, mc));
          if (ng < g[n]) { g[n] = ng; prev[n] = u; hp.push({ k: key(n), id: n }); }
        });
      }
    } else if (algo === 'wall') {
      /* left-hand rule, works on any topology by comparing turn angles */
      var cur = start, heading = 0, walk = [start], limit = N * 6 + 10, vis = {}; vis[start] = 1; order.push(start);
      var ls = linksOf(m, start);
      if (ls.length) heading = ang(m, start, ls[0]) + Math.PI;     // pretend we came in with the wall on our left
      while (cur !== goal && walk.length < limit) {
        var opt = linksOf(m, cur); if (!opt.length) break;
        var best = null, bt = Infinity;
        opt.forEach(function (n) {
          var turn = norm(ang(m, cur, n) - heading);
          if (turn <= -Math.PI + 1e-6) turn = Math.PI;               // straight back = last resort
          if (turn < bt) { bt = turn; best = n; }
        });
        heading = ang(m, cur, best); cur = best; walk.push(cur);
        if (!vis[cur]) { vis[cur] = 1; order.push(cur); }
      }
      res.found = cur === goal; res.walk = walk;
      res.path = res.found ? simplify(walk) : [];
      return finish(true);
    } else if (algo === 'tremaux') {
      /* physical depth-first exploration: walk forward to unmarked cells, back up from dead ends */
      var stack = [start], walk2 = [start], mark = {}; mark[start] = 1; order.push(start);
      while (stack.length) {
        var top = stack[stack.length - 1];
        if (top === goal) { res.found = true; break; }
        var un = linksOf(m, top).filter(function (n) { return !mark[n]; });
        if (un.length) {
          un.sort(function (a, b) { return h(m, a, goal) - h(m, b, goal); });   // marks hint: prefer corridors that face the exit
          var nx = un[0]; mark[nx] = 1; order.push(nx); stack.push(nx); walk2.push(nx);
        } else { stack.pop(); if (stack.length) walk2.push(stack[stack.length - 1]); }
      }
      res.walk = walk2; res.path = res.found ? stack.slice() : [];
      return finish(true);
    }
    if (res.found) { res.path = rebuild(prev, goal); res.walk = res.path.slice(); }
    return finish();

    function finish() {
      res.ms = performance.now() - t0;
      res.explored = order.length;
      res.cost = pathCost(m, res.walk.length ? res.walk : res.path, mc);
      res.steps = Math.max(0, (res.walk.length || 1) - 1);
      return res;
    }
  }
  function ang(m, a, b) { var A = m.cells[a], B = m.cells[b]; return Math.atan2(B.cy - A.cy, B.cx - A.cx); }
  function norm(x) { while (x <= -Math.PI) x += TAU; while (x > Math.PI) x -= TAU; return x; }
  /* drop back-and-forth loops from a walked route → simple path */
  function simplify(walk) { var out = [], pos = {}; walk.forEach(function (c) { if (pos[c] != null) { var k = pos[c]; for (var i = k + 1; i < out.length; i++) delete pos[out[i]]; out.length = k + 1; } else { pos[c] = out.length; out.push(c); } }); return out; }

  /* ------------------------------------------------------------ Analysis */
  function reachable(m, a, b) {
    if (a == null || b == null) return false;
    var seen = {}, q = [a]; seen[a] = 1;
    while (q.length) { var c = q.shift(); if (c === b) return true; linksOf(m, c).forEach(function (n) { if (!seen[n]) { seen[n] = 1; q.push(n); } }); }
    return false;
  }
  function analyze(m, start, goal, mudCost) {
    var links = 0, dead = 0, junc = 0;
    m.cells.forEach(function (c) { var d = degree(m, c.id); links += d; if (d === 1) dead++; if (d >= 3) junc++; });
    links /= 2;
    /* components for loop count */
    var comp = 0, seen = {};
    m.cells.forEach(function (c) {
      if (seen[c.id]) return; comp++; var q = [c.id]; seen[c.id] = 1;
      while (q.length) { var x = q.pop(); linksOf(m, x).forEach(function (n) { if (!seen[n]) { seen[n] = 1; q.push(n); } }); }
    });
    var out = { cells: m.cells.length, links: links, deadEnds: dead, junctions: junc, loops: Math.max(0, links - (m.cells.length - comp)), components: comp, reachable: false, shortestPaths: 0, shortestLen: 0, optimalCost: 0 };
    if (start != null && goal != null && start >= 0 && goal >= 0) {
      var dist = {}, cnt = {}, q2 = [start], qi = 0; dist[start] = 0; cnt[start] = 1;
      while (qi < q2.length) {
        var c = q2[qi++];
        linksOf(m, c).forEach(function (n) {
          if (dist[n] == null) { dist[n] = dist[c] + 1; cnt[n] = cnt[c]; q2.push(n); }
          else if (dist[n] === dist[c] + 1) cnt[n] = Math.min(1e9, cnt[n] + cnt[c]);
        });
      }
      if (dist[goal] != null) {
        out.reachable = true; out.shortestLen = dist[goal]; out.shortestPaths = cnt[goal];
        out.optimalCost = solve(m, start, goal, 'dijkstra', { mudCost: mudCost }).cost;
      }
    }
    return out;
  }
  function defaults(m) {
    if (m.shape === 'circle') return { start: m.ringStart[m.rings - 1], goal: 0 };
    return { start: 0, goal: m.cells.length - 1 };
  }

  D.Maze = {
    create: create, link: link, unlink: unlink, linked: linked, toggle: toggle, adjacent: adjacent, clearLinks: clearLinks,
    linksOf: linksOf, degree: degree, generate: generate, braid: braid, solve: solve, analyze: analyze,
    reachable: reachable, defaults: defaults, simplify: simplify, rng: rng, GENERATORS: GENERATORS, SOLVERS: SOLVERS
  };

  /* ================================================================ VIEW */
  function MazeView(canvas, maze, opts) {
    this.canvas = canvas; this.m = maze; this.o = Object.assign({ padding: 18, robot: 'theseus' }, opts || {});
    this.s = { start: null, goal: null, path: null, visited: null, visitedUpto: Infinity, fog: null, flashes: [], hover: -1, player: null, trail: null, showRobot: true };
    this.robot = null;            // {x, y, tx, ty, ang}
    this.playerPos = null;
    this.timers = []; this.dead = false;
    var self = this;
    this.offTheme = D.bus.on('theme', function () { self.render(); });
    if (global.ResizeObserver) { this.ro = new ResizeObserver(function () { self.render(); }); this.ro.observe(canvas); }
    this.raf = requestAnimationFrame(function loop() { if (self.dead) return; self.anim(); self.raf = requestAnimationFrame(loop); });
    this.render();
  }
  MazeView.prototype.setMaze = function (m) { this.m = m; this.robot = null; this.playerPos = null; this.render(); };
  MazeView.prototype.set = function (o) {
    Object.assign(this.s, o);
    if (o.start != null && (!this.robot || o.resetRobot)) this.setRobot(o.start, true);
    if (o.player != null && !this.playerPos) { var p = this.m.cells[o.player]; this.playerPos = { x: p.cx, y: p.cy, tx: p.cx, ty: p.cy }; }
    this.render();
  };
  MazeView.prototype.setRobot = function (id, instant) {
    if (id == null || id < 0 || !this.m.cells[id]) { this.robot = null; return; }
    var c = this.m.cells[id];
    if (!this.robot || instant) this.robot = { x: c.cx, y: c.cy, tx: c.cx, ty: c.cy, ang: this.robot ? this.robot.ang : 0, cell: id };
    else {
      if (Math.hypot(c.cx - this.robot.tx, c.cy - this.robot.ty) > 0.01) this.robot.ang = Math.atan2(c.cy - this.robot.ty, c.cx - this.robot.tx);
      this.robot.tx = c.cx; this.robot.ty = c.cy; this.robot.cell = id;
    }
    this.render();
  };
  MazeView.prototype.setPlayer = function (id) {
    var c = this.m.cells[id]; this.s.player = id;
    if (!this.playerPos) this.playerPos = { x: c.cx, y: c.cy };
    this.playerPos.tx = c.cx; this.playerPos.ty = c.cy;
    this.render();
  };
  MazeView.prototype.anim = function () {
    if (!this.canvas.offsetParent) return;      // hidden page → no work
    var moved = false;
    [this.robot, this.playerPos].forEach(function (r) {
      if (!r || r.tx == null) return;
      var dx = r.tx - r.x, dy = r.ty - r.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.002) { r.x += dx * 0.3; r.y += dy * 0.3; moved = true; } else { r.x = r.tx; r.y = r.ty; }
    });
    var now = performance.now();
    if (this.s.flashes && this.s.flashes.length) { this.s.flashes = this.s.flashes.filter(function (f) { return now - f.t < 900; }); moved = true; }
    if (moved || this.s.goal != null) this.render(now);
  };

  MazeView.prototype.geom = function () {
    var cv = this.canvas, dpr = global.devicePixelRatio || 1;
    var cw = cv.clientWidth || 600, ch = cv.clientHeight || 400;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    var p = this.o.padding;
    var sc = Math.min((cw - 2 * p) / this.m.W, (ch - 2 * p) / this.m.H);
    return { dpr: dpr, sc: sc, ox: (cw - this.m.W * sc) / 2, oy: (ch - this.m.H * sc) / 2, cw: cw, ch: ch };
  };
  MazeView.prototype.hitTest = function (clientX, clientY) {
    var r = this.canvas.getBoundingClientRect(), g = this.geom();
    var x = (clientX - r.left - g.ox) / g.sc, y = (clientY - r.top - g.oy) / g.sc, m = this.m;
    if (m.shape === 'square') {
      var c = Math.floor(x), rr = Math.floor(y);
      return (c < 0 || rr < 0 || c >= m.cols || rr >= m.rows) ? -1 : rr * m.cols + c;
    }
    if (m.shape === 'circle') {
      var dx = x - m.C, dy = y - m.C, rad = Math.hypot(dx, dy), ring = Math.floor(rad);
      if (ring >= m.rings) return -1;
      if (ring === 0) return 0;
      var a = Math.atan2(dy, dx); if (a < 0) a += TAU;
      return m.ringStart[ring] + Math.min(m.ringCount[ring] - 1, Math.floor(a / (TAU / m.ringCount[ring])));
    }
    var best = -1, bd = 0.6;
    m.cells.forEach(function (ce) { var d = Math.hypot(ce.cx - x, ce.cy - y); if (d < bd) { bd = d; best = ce.id; } });
    return best;
  };

  /* trace a cell's shape as a canvas path (in unit coords; caller sets transform) */
  MazeView.prototype.cellPath = function (ctx, c) {
    var m = this.m;
    ctx.beginPath();
    if (m.shape === 'circle') {
      if (c.row === 0) { ctx.arc(m.C, m.C, 1, 0, TAU); return; }
      ctx.arc(m.C, m.C, c.row + 1, c.a1, c.a2); ctx.arc(m.C, m.C, c.row, c.a2, c.a1, true); ctx.closePath(); return;
    }
    c.poly.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath();
  };

  MazeView.prototype.render = function (now) {
    if (this.dead) return;
    var ctx = this.canvas.getContext('2d'), g = this.geom(), m = this.m, s = this.s, self = this;
    now = now || performance.now();
    var col = {
      floor: D.cssVar('--grid-floor') || '#0f1724', wall: D.cssVar('--grid-wall-top') || '#50678a', line: D.cssVar('--grid-line') || '#1d2a3d',
      accent: D.cssVar('--accent') || '#22d3ee', green: D.cssVar('--green') || '#34d399', amber: D.cssVar('--amber') || '#fbbf24',
      red: D.cssVar('--red') || '#f87171', bg: D.cssVar('--bg-2') || '#0f1520', violet: D.cssVar('--violet') || '#a78bfa', text: D.cssVar('--text') || '#fff'
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(g.dpr * g.sc, 0, 0, g.dpr * g.sc, g.dpr * g.ox, g.dpr * g.oy);
    var px = 1 / g.sc;   // one CSS pixel in unit coords

    /* floor */
    ctx.fillStyle = col.floor;
    if (m.shape === 'square') ctx.fillRect(0, 0, m.W, m.H);
    else if (m.shape === 'circle') { ctx.beginPath(); ctx.arc(m.C, m.C, m.rings, 0, TAU); ctx.fill(); }
    else m.cells.forEach(function (c) { self.cellPath(ctx, c); ctx.fill(); });

    /* mud */
    Object.keys(m.mud).forEach(function (k) {
      var c = m.cells[k]; if (!c) return;
      self.cellPath(ctx, c); ctx.fillStyle = 'rgba(180,120,60,.45)'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,40,.7)'; ctx.lineWidth = 1.4 * px;
      ctx.beginPath();
      for (var w = -1; w <= 1; w++) { var y0 = c.cy + w * 0.2; ctx.moveTo(c.cx - 0.25, y0); ctx.quadraticCurveTo(c.cx - 0.12, y0 - 0.08, c.cx, y0); ctx.quadraticCurveTo(c.cx + 0.12, y0 + 0.08, c.cx + 0.25, y0); }
      ctx.stroke();
    });

    /* visited heatmap */
    if (s.visited && s.visited.length) {
      var n = Math.min(s.visited.length, s.visitedUpto == null ? Infinity : s.visitedUpto);
      ctx.fillStyle = col.accent;
      for (var i = 0; i < n; i++) {
        var c = m.cells[s.visited[i]]; if (!c) continue;
        ctx.globalAlpha = 0.12 + 0.28 * (1 - i / Math.max(1, s.visited.length));
        self.cellPath(ctx, c); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (n < s.visited.length && n > 0) {   /* frontier glow */
        var fc = m.cells[s.visited[n - 1]]; ctx.fillStyle = col.violet; ctx.globalAlpha = 0.6; self.cellPath(ctx, fc); ctx.fill(); ctx.globalAlpha = 1;
      }
    }


    /* hover */
    if (s.hover != null && s.hover >= 0 && m.cells[s.hover]) { ctx.fillStyle = col.accent; ctx.globalAlpha = 0.18; self.cellPath(ctx, m.cells[s.hover]); ctx.fill(); ctx.globalAlpha = 1; }

    /* trail (player) */
    if (s.trail && s.trail.length > 1) this.polyline(ctx, s.trail, col.accent, 0.14, 0.35);

    /* solution path */
    if (s.path && s.path.length > 1) this.polyline(ctx, s.path, col.amber, Math.max(0.12, 3 * px), 0.95, false);

    /* walls */
    ctx.strokeStyle = col.wall; ctx.lineCap = 'round';
    ctx.lineWidth = Math.min(Math.max(2 * px, 0.09), 5 * px);
    ctx.beginPath();
    m.cells.forEach(function (c) {
      c.sides.forEach(function (sd) {
        if (sd.nb != null && (sd.nb < c.id || c.links[sd.nb])) return;
        self.side(ctx, sd);
      });
    });
    ctx.stroke();

    /* fog of war: hide cells (and their walls) the robot has not seen yet */
    if (s.fog) {
      ctx.fillStyle = D.cssVar('--surface-2') || '#192334';
      m.cells.forEach(function (c) { if (!s.fog[c.id]) { self.cellPath(ctx, c); ctx.fill(); ctx.lineWidth = 1.2 * px; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); } });
      ctx.fillStyle = col.text; ctx.globalAlpha = 0.08;
      m.cells.forEach(function (c) { if (!s.fog[c.id] && (c.id % 7 === 0)) { ctx.beginPath(); ctx.arc(c.cx, c.cy, 0.06, 0, TAU); ctx.fill(); } });
      ctx.globalAlpha = 1;
    }

    /* demolition flashes */
    if (s.flashes && s.flashes.length) {
      s.flashes.forEach(function (f) {
        var a = m.cells[f.a], b = m.cells[f.b]; if (!a || !b) return;
        var k = 1 - (now - f.t) / 900; if (k <= 0) return;
        var mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
        ctx.globalAlpha = k; ctx.fillStyle = col.amber;
        ctx.beginPath(); ctx.arc(mx, my, 0.15 + (1 - k) * 0.45, 0, TAU); ctx.fill();
        ctx.strokeStyle = col.red; ctx.lineWidth = 2 * px;
        for (var q = 0; q < 6; q++) { var an = q * TAU / 6 + f.t; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(an) * (0.2 + (1 - k) * 0.6), my + Math.sin(an) * (0.2 + (1 - k) * 0.6)); ctx.stroke(); }
        ctx.globalAlpha = 1;
      });
    }

    /* start & goal markers */
    var pulse = 0.5 + 0.5 * Math.sin(now / 300);
    if (s.start != null && m.cells[s.start]) {
      var st = m.cells[s.start];
      ctx.fillStyle = col.green; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(st.cx, st.cy, 0.42, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = col.green; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(st.cx, st.cy, 0.34, 0, TAU); ctx.stroke();
    }
    if (s.goal != null && m.cells[s.goal]) {
      var gl = m.cells[s.goal];
      ctx.strokeStyle = col.red; ctx.lineWidth = 2 * px;
      ctx.globalAlpha = 0.35 + 0.4 * pulse; ctx.beginPath(); ctx.arc(gl.cx, gl.cy, 0.3 + 0.12 * pulse, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      /* flag */
      ctx.strokeStyle = col.text; ctx.lineWidth = Math.max(1.5 * px, 0.05);
      ctx.beginPath(); ctx.moveTo(gl.cx - 0.12, gl.cy + 0.28); ctx.lineTo(gl.cx - 0.12, gl.cy - 0.3); ctx.stroke();
      ctx.fillStyle = col.red; ctx.beginPath(); ctx.moveTo(gl.cx - 0.12, gl.cy - 0.3); ctx.lineTo(gl.cx + 0.26, gl.cy - 0.19); ctx.lineTo(gl.cx - 0.12, gl.cy - 0.06); ctx.closePath(); ctx.fill();
    }

    /* player sprite (race) */
    if (this.playerPos && s.player != null) this.drawBot(ctx, this.playerPos.x, this.playerPos.y, 0, col.accent, 'player', px);
    /* Theseus robot */
    if (this.robot && s.showRobot !== false) this.drawBot(ctx, this.robot.x, this.robot.y, this.robot.ang, col.amber, this.o.robot, px);
  };

  MazeView.prototype.side = function (ctx, sd) {
    var m = this.m;
    if (sd.t === 'l') { ctx.moveTo(sd.x1, sd.y1); ctx.lineTo(sd.x2, sd.y2); }
    else if (sd.t === 'a') { ctx.moveTo(m.C + sd.r * Math.cos(sd.a1), m.C + sd.r * Math.sin(sd.a1)); ctx.arc(m.C, m.C, sd.r, sd.a1, sd.a2); }
    else if (sd.t === 'rad') { ctx.moveTo(m.C + sd.r1 * Math.cos(sd.a), m.C + sd.r1 * Math.sin(sd.a)); ctx.lineTo(m.C + sd.r2 * Math.cos(sd.a), m.C + sd.r2 * Math.sin(sd.a)); }
  };

  MazeView.prototype.polyline = function (ctx, ids, color, width, alpha, dots) {
    var m = this.m;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = alpha;
    ctx.beginPath();
    ids.forEach(function (id, i) { var c = m.cells[id]; if (!c) return; if (i) ctx.lineTo(c.cx, c.cy); else ctx.moveTo(c.cx, c.cy); });
    ctx.stroke();
    if (dots) { ctx.fillStyle = color; ids.forEach(function (id) { var c = m.cells[id]; if (c) { ctx.beginPath(); ctx.arc(c.cx, c.cy, width * 0.75, 0, TAU); ctx.fill(); } }); }
    ctx.globalAlpha = 1;
  };

  /* little robot sprites in unit coords (≈ 0.7 cell wide) */
  MazeView.prototype.drawBot = function (ctx, x, y, ang, color, kind, px) {
    var sz = 0.36;
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = color; ctx.shadowBlur = 12 * px * (this.geom().sc / 10);
    if (kind === 'player') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, sz * 0.9, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#06101a'; ctx.beginPath(); ctx.ellipse(0, -0.02, sz * 0.62, sz * 0.32, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-0.1, -0.02, 0.055, 0, TAU); ctx.arc(0.1, -0.02, 0.055, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    /* Theseus: amber helmet with horns, faces travel direction via its visor */
    ctx.rotate(ang + Math.PI / 2);
    ctx.strokeStyle = color; ctx.lineWidth = 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-sz * 0.75, -sz * 0.3); ctx.lineTo(-sz * 1.1, -sz * 0.85); ctx.moveTo(sz * 0.75, -sz * 0.3); ctx.lineTo(sz * 1.1, -sz * 0.85); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(-sz * 0.8, sz * 0.7); ctx.lineTo(-sz * 0.8, -sz * 0.1); ctx.quadraticCurveTo(0, -sz * 1.2, sz * 0.8, -sz * 0.1); ctx.lineTo(sz * 0.8, sz * 0.7); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1205'; ctx.fillRect(-sz * 0.55, -sz * 0.15, sz * 1.1, sz * 0.4);
    ctx.fillStyle = '#fff6d6'; ctx.fillRect(-sz * 0.45, -sz * 0.07, sz * 0.3, sz * 0.22); ctx.fillRect(sz * 0.15, -sz * 0.07, sz * 0.3, sz * 0.22);
    ctx.restore();
  };

  MazeView.prototype.animatePath = function (path, ms, onStep) {
    var self = this; this.stop();
    return new Promise(function (resolve) {
      if (!path || !path.length) return resolve(false);
      self.setRobot(path[0], true);
      var i = 0;
      self._resolve = resolve;
      (function next() {
        i++;
        if (i >= path.length || self.dead) { self._resolve = null; return resolve(true); }
        self.setRobot(path[i]); if (onStep) onStep(path[i], i);
        self.timers.push(setTimeout(next, ms || 120));
      })();
    });
  };
  MazeView.prototype.animateVisited = function (order, ms) {
    var self = this; this.stop();
    return new Promise(function (resolve) {
      self.s.visited = order; self.s.visitedUpto = 0; self._resolve = resolve;
      var batch = Math.max(1, Math.round(order.length / 90));
      (function next() {
        self.s.visitedUpto += batch; self.render();
        if (self.s.visitedUpto >= order.length || self.dead) { self.s.visitedUpto = Infinity; self._resolve = null; self.render(); return resolve(true); }
        self.timers.push(setTimeout(next, ms || 16));
      })();
    });
  };
  MazeView.prototype.stop = function () {
    this.timers.forEach(clearTimeout); this.timers = [];
    if (this._resolve) { var r = this._resolve; this._resolve = null; r(false); }
  };
  MazeView.prototype.destroy = function () {
    this.stop(); this.dead = true; cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect(); if (this.offTheme) this.offTheme();
  };
  D.MazeView = MazeView;
})(window);
