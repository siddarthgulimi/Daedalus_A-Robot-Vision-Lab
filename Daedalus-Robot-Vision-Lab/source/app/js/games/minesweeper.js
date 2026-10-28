/* minesweeper.js — Mine Sweeper Bot: a robot walks the board and reveals cells. */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art;

  var SIZES = { easy: { w: 9, h: 9, m: 10, label: '9×9' }, medium: { w: 12, h: 12, m: 24, label: '12×12' }, hard: { w: 16, h: 16, m: 40, label: '16×16' } };
  var NUMC = ['', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#64748b'];

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  /* ------------------------------------------------------------- board model */
  function Board(w, h, m, seed) {
    this.w = w; this.h = h; this.m = m; this.seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    this.cells = []; for (var i = 0; i < w * h; i++) this.cells.push({ mine: false, n: 0, open: false, flag: false });
    this.placed = false; this.dead = false; this.won = false; this.opened = 0; this.boom = -1;
  }
  Board.prototype.idx = function (x, y) { return y * this.w + x; };
  Board.prototype.inb = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; };
  Board.prototype.nb = function (x, y) {
    var r = [];
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && this.inb(x + dx, y + dy)) r.push([x + dx, y + dy]);
    return r;
  };
  Board.prototype.place = function (sx, sy) {
    var R = rng(this.seed), self = this, free = [];
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (Math.abs(x - sx) > 1 || Math.abs(y - sy) > 1) free.push([x, y]);
    for (var k = 0; k < this.m && free.length; k++) { var j = Math.floor(R() * free.length); var c = free.splice(j, 1)[0]; this.cells[this.idx(c[0], c[1])].mine = true; }
    for (y = 0; y < this.h; y++) for (x = 0; x < this.w; x++) {
      this.cells[this.idx(x, y)].n = this.nb(x, y).filter(function (p) { return self.cells[self.idx(p[0], p[1])].mine; }).length;
    }
    this.placed = true;
  };
  Board.prototype.reveal = function (x, y) {
    if (!this.placed) this.place(x, y);
    var c = this.cells[this.idx(x, y)];
    if (c.open || c.flag) return [];
    if (c.mine) { c.open = true; this.dead = true; this.boom = this.idx(x, y); return [[x, y]]; }
    var out = [], stack = [[x, y]], self = this;
    while (stack.length) {
      var p = stack.pop(), cc = this.cells[this.idx(p[0], p[1])];
      if (cc.open || cc.flag) continue;
      cc.open = true; this.opened++; out.push(p);
      if (cc.n === 0) this.nb(p[0], p[1]).forEach(function (q) { if (!self.cells[self.idx(q[0], q[1])].open) stack.push(q); });
    }
    if (this.opened === this.w * this.h - this.m) this.won = true;
    return out;
  };
  Board.prototype.flags = function () { return this.cells.filter(function (c) { return c.flag; }).length; };

  /* ------------------------------------------------------------- logical solver */
  function nm(x, y) { return '(' + (x + 1) + ',' + (y + 1) + ')'; }
  function solveStep(b) {
    if (!b.placed) { var cx = Math.floor(b.w / 2), cy = Math.floor(b.h / 2); return { type: 'reveal', x: cx, y: cy, kind: 'safe', reason: nm(cx, cy) + ' — first move is always safe, so I start in the centre.' }; }
    var cons = [];
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      var c = b.cells[b.idx(x, y)];
      if (!c.open || c.n === 0) continue;
      var hid = [], fl = 0;
      b.nb(x, y).forEach(function (p) { var q = b.cells[b.idx(p[0], p[1])]; if (q.flag) fl++; else if (!q.open) hid.push(b.idx(p[0], p[1])); });
      if (hid.length) cons.push({ x: x, y: y, r: c.n - fl, set: hid, n: c.n });
    }
    function xy(i) { return [i % b.w, Math.floor(i / b.w)]; }
    /* single-cell rule */
    for (var i = 0; i < cons.length; i++) {
      var k = cons[i];
      if (k.r === 0) { var p = xy(k.set[0]); return { type: 'reveal', x: p[0], y: p[1], kind: 'safe', from: [k.x, k.y], reason: nm(p[0], p[1]) + ' is safe: ' + nm(k.x, k.y) + ' shows ' + k.n + ' and already has ' + k.n + ' flag' + (k.n > 1 ? 's' : '') + ' around it.' }; }
      if (k.r === k.set.length) { var q = xy(k.set[0]); return { type: 'flag', x: q[0], y: q[1], kind: 'mine', from: [k.x, k.y], reason: nm(q[0], q[1]) + ' is a mine: ' + nm(k.x, k.y) + ' needs ' + k.r + ' more mine' + (k.r > 1 ? 's' : '') + ' and has exactly ' + k.set.length + ' hidden neighbour' + (k.set.length > 1 ? 's' : '') + '.' }; }
    }
    /* subset rule */
    for (i = 0; i < cons.length; i++) for (var j = 0; j < cons.length; j++) {
      if (i === j) continue;
      var A1 = cons[i], B1 = cons[j];
      if (A1.set.length >= B1.set.length) continue;
      if (!A1.set.every(function (v) { return B1.set.indexOf(v) >= 0; })) continue;
      var diff = B1.set.filter(function (v) { return A1.set.indexOf(v) < 0; });
      var rem = B1.r - A1.r;
      if (rem === 0) { var s = xy(diff[0]); return { type: 'reveal', x: s[0], y: s[1], kind: 'safe', from: [B1.x, B1.y], reason: nm(s[0], s[1]) + ' is safe: all ' + B1.r + ' mine(s) of ' + nm(B1.x, B1.y) + ' must sit in the cells it shares with ' + nm(A1.x, A1.y) + '.' }; }
      if (rem === diff.length) { var t = xy(diff[0]); return { type: 'flag', x: t[0], y: t[1], kind: 'mine', from: [B1.x, B1.y], reason: nm(t[0], t[1]) + ' is a mine: ' + nm(B1.x, B1.y) + ' needs ' + rem + ' more mine(s) outside the cells shared with ' + nm(A1.x, A1.y) + '.' }; }
    }
    /* guess: lowest estimated probability */
    var prob = {}, hiddenAll = [];
    b.cells.forEach(function (c, ix) { if (!c.open && !c.flag) hiddenAll.push(ix); });
    cons.forEach(function (k) { var pr = k.r / k.set.length; k.set.forEach(function (v) { prob[v] = Math.max(prob[v] || 0, pr); }); });
    var frontier = Object.keys(prob).length;
    var restCells = hiddenAll.length - frontier;
    var minesLeft = b.m - b.flags();
    var estFront = 0; for (var kk in prob) estFront += prob[kk];
    var restP = restCells > 0 ? D.clamp((minesLeft - estFront) / restCells, 0.01, 1) : 1;
    var best = null, bp = 2;
    hiddenAll.forEach(function (v) {
      var pv = v in prob ? prob[v] : restP;
      var p2 = xy(v), corner = (p2[0] === 0 || p2[0] === b.w - 1) && (p2[1] === 0 || p2[1] === b.h - 1);
      var score = pv - (corner ? 0.001 : 0);
      if (score < bp) { bp = score; best = v; }
    });
    if (best == null) return null;
    var g = xy(best);
    return { type: 'reveal', x: g[0], y: g[1], kind: 'guess', reason: 'No certain move left — guessing ' + nm(g[0], g[1]) + ' (≈' + Math.round(Math.min(bp, 1) * 100) + '% mine risk, the lowest on the board).' };
  }

  /* ------------------------------------------------------------- game */
  function create(host, ctx) {
    var U = D.arcade.util;
    var size = 'easy', mode = 'user', board, robot, anim = null, queue = [], running = false, speed = 6, t0 = 0, tEnd = 0, raf = 0, timer = 0, lastAction = null, logs = [], hover = null, stepsWalked = 0, logicalMoves = 0, guesses = 0;
    var cell = 32, ox = 0, oy = 0, cw = 400, ch = 400;

    var play = D.el('div', { class: 'ar-play' });
    var stage = D.el('div', { class: 'ar-stagewrap' });
    var canvas = D.el('canvas'); stage.appendChild(canvas);
    var banner = D.el('div', { class: 'ar-banner hidden' }); stage.appendChild(banner);
    var side = D.el('div', { class: 'ar-side' });
    play.appendChild(stage); play.appendChild(side); host.appendChild(play);

    var p1 = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Mission' })));
    var b1 = D.el('div', { class: 'panel-body' }); p1.appendChild(b1); side.appendChild(p1);
    b1.appendChild(D.el('div', { class: 'field' }, D.el('label', { text: 'Who plays' }), D.ui.seg([['user', 'You', 'hand'], ['auto', 'Auto-solve', 'robot']], mode, function (v) { mode = v; running = false; refreshControls(); D.audit.log('arcade', 'Mine Sweeper mode', v === 'auto' ? 'Auto-solve' : 'You command'); }, 'full')));
    b1.appendChild(D.el('div', { class: 'field' }, D.el('label', { text: 'Board' }), D.ui.seg(Object.keys(SIZES).map(function (k) { return [k, SIZES[k].label, null, SIZES[k].m + ' mines']; }), size, function (v) { size = v; newGame(); }, 'full')));
    var stats = D.el('div', { class: 'ar-stats' }); b1.appendChild(stats);
    var autoRow = D.el('div', { class: 'col' });
    var btnRun = D.el('button', { class: 'btn primary sm', html: D.icon('play') + 'Run', onclick: function () { running = !running; if (running && board.won || board.dead) running = false; refreshControls(); } });
    var btnStep = D.el('button', { class: 'btn sm', html: D.icon('step') + 'Step', onclick: function () { if (!anim && !queue.length) autoStep(); } });
    var spd = D.el('input', { type: 'range', min: 1, max: 12, value: speed, class: 'grow' }); spd.oninput = function () { speed = +spd.value; };
    autoRow.appendChild(D.el('div', { class: 'row' }, btnRun, btnStep, D.el('span', { class: 'small faint', text: 'Speed' }), spd));
    b1.appendChild(autoRow);
    b1.appendChild(D.el('div', { class: 'row' }, D.el('button', { class: 'btn sm', html: D.icon('reset') + 'New board', onclick: function () { newGame(); } }), D.el('span', { class: 'ar-kbd-hint', html: 'Right-click = flag' })));

    var p2 = D.el('div', { class: 'panel grow', style: { display: 'flex', flexDirection: 'column', minHeight: '0' } }, D.el('div', { class: 'panel-head' }, D.el('span', { class: 'eyebrow', text: 'Robot reasoning' })));
    var logEl = D.el('div', { class: 'ar-log', style: { margin: '12px', flex: '1', maxHeight: 'none' } }); p2.appendChild(logEl); side.appendChild(p2);

    function refreshControls() {
      autoRow.style.display = mode === 'auto' ? '' : 'none';
      btnRun.innerHTML = running ? D.icon('pause') + 'Pause' : D.icon('play') + 'Run';
      btnRun.classList.toggle('primary', !running);
    }
    function log(text, kind) { logs.push({ t: text, k: kind }); if (logs.length > 120) logs.shift(); logEl.innerHTML = logs.slice().reverse().map(function (l) { return '<div class="' + (l.k || '') + '">' + D.esc(l.t) + '</div>'; }).join(''); }

    function newGame(seed) {
      var s = SIZES[size];
      board = new Board(s.w, s.h, s.m, seed);
      robot = { x: -0.9, y: -0.9, a: Math.PI / 4, mood: null };
      anim = null; queue = []; running = false; t0 = 0; tEnd = 0; lastAction = null; logs = []; stepsWalked = 0; logicalMoves = 0; guesses = 0;
      logEl.innerHTML = '<div>Docked and ready. ' + (mode === 'auto' ? 'Press Run or Step.' : 'Click any cell to send me there.') + '</div>';
      banner.classList.add('hidden');
      refreshControls(); layout(); draw(); updateStats();
    }

    function layout() {
      var r = stage.getBoundingClientRect();
      var W = Math.max(200, r.width - 28), H = Math.max(200, r.height - 28);
      cell = Math.floor(Math.min(W / (board.w + 1.2), H / (board.h + 1.2)));
      cw = cell * (board.w + 1.2); ch = cell * (board.h + 1.2);
      ox = cell * 0.9; oy = cell * 0.9;
      U.fit(canvas, cw, ch);
    }

    function updateStats() {
      var secs = t0 ? Math.floor(((tEnd || Date.now()) - t0) / 1000) : 0;
      var pct = Math.round(board.opened / (board.w * board.h - board.m) * 100);
      stats.innerHTML = '<div class="stat"><div class="k">Mines left</div><div class="v">' + (board.m - board.flags()) + '</div></div><div class="stat"><div class="k">Time</div><div class="v">' + secs + 's</div></div><div class="stat"><div class="k">Cleared</div><div class="v">' + pct + '%</div></div>';
    }

    /* path over open cells, otherwise hop */
    function pathTo(tx, ty) {
      var sx = Math.round(robot.x), sy = Math.round(robot.y);
      if (!board.inb(sx, sy)) return null;
      var prev = {}, start = board.idx(sx, sy), goal = board.idx(tx, ty), q = [start]; prev[start] = -1;
      while (q.length) {
        var v = q.shift(); if (v === goal) break;
        var x = v % board.w, y = Math.floor(v / board.w);
        [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (d) {
          var nx = x + d[0], ny = y + d[1]; if (!board.inb(nx, ny)) return;
          var ni = board.idx(nx, ny); if (ni in prev) return;
          var c = board.cells[ni];
          if (ni !== goal && !c.open) return;
          prev[ni] = v; q.push(ni);
        });
      }
      if (!(goal in prev)) return null;
      var path = [], cur = goal; while (cur !== -1) { path.unshift([cur % board.w, Math.floor(cur / board.w)]); cur = prev[cur]; }
      return path.slice(1);
    }

    function command(act) {
      if (board.dead || board.won) return;
      var c = board.cells[board.idx(act.x, act.y)];
      if (act.type === 'flag') {
        c.flag = !c.flag; D.sound.beep(c.flag ? 980 : 600, 0.05, 'triangle');
        lastAction = act; if (act.reason) log(act.reason, 'mine');
        updateStats(); draw(); return;
      }
      if (c.open || c.flag) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(updateStats, 500); }
      var path = pathTo(act.x, act.y);
      lastAction = act;
      if (act.reason) log(act.reason, act.kind);
      if (act.kind === 'guess') guesses++; else if (act.reason) logicalMoves++;
      if (path && path.length) anim = { type: 'walk', path: path, i: 0, from: { x: robot.x, y: robot.y }, t: 0, act: act };
      else anim = { type: 'hop', from: { x: robot.x, y: robot.y }, to: { x: act.x, y: act.y }, t: 0, act: act };
    }

    function arrive(act) {
      var opened = board.reveal(act.x, act.y);
      if (board.dead) {
        robot.mood = 'hurt'; D.sound.bump(); D.sound.bad(); tEnd = Date.now(); clearInterval(timer); running = false; refreshControls();
        log('BOOM — ' + nm(act.x, act.y) + ' was a mine.', 'mine');
        board.cells.forEach(function (c) { if (c.mine) c.open = true; });
        D.audit.log('arcade', 'Mine Sweeper lost', SIZES[size].label + ' · ' + (mode === 'auto' ? 'auto-solve' : 'player') + ' · ' + Math.round(board.opened / (board.w * board.h - board.m) * 100) + '% cleared', 'warn');
        showBanner('Boom!', mode === 'auto' ? 'The robot had to guess and lost. Logic moves: ' + logicalMoves + ', guesses: ' + guesses + '.' : 'That was a mine. Try again — think before you click!');
      } else {
        D.sound.move();
        if (opened.length > 1) log('Sensor sweep opened ' + opened.length + ' cells.', '');
        if (board.won) {
          robot.mood = 'happy'; tEnd = Date.now(); clearInterval(timer); running = false; refreshControls(); D.sound.win();
          board.cells.forEach(function (c) { if (c.mine) c.flag = true; });
          var secs = Math.max(1, Math.round((tEnd - t0) / 1000));
          var s = SIZES[size];
          if (mode === 'user') {
            var score = Math.max(50, s.w * s.h * 10 + s.m * 50 - secs * 3);
            ctx.reportScore(score, s.label + ' in ' + secs + 's');
            showBanner('Board cleared!', 'You guided the robot through ' + s.label + ' in ' + secs + 's. Score ' + score + '.');
          } else {
            D.audit.log('arcade', 'Mine Sweeper auto-solved', s.label + ' in ' + secs + 's · ' + logicalMoves + ' logic moves, ' + guesses + ' guesses', 'success');
            showBanner('Solved by logic!', 'Logic moves: ' + logicalMoves + ' · guesses: ' + guesses + ' · ' + stepsWalked + ' cells walked.');
          }
        }
      }
      updateStats();
    }

    function showBanner(t, p) {
      banner.innerHTML = '';
      banner.appendChild(D.el('h2', { text: t })); banner.appendChild(D.el('p', { text: p }));
      banner.appendChild(D.el('button', { class: 'btn primary', html: D.icon('reset') + 'New board', onclick: function () { newGame(); } }));
      banner.classList.remove('hidden');
    }

    function autoStep() {
      if (board.dead || board.won) return false;
      var act = solveStep(board);
      if (!act) return false;
      command(act);
      return true;
    }

    var last = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (anim) {
        var v = speed * 1.6;
        if (anim.type === 'walk') {
          var tgt = anim.path[anim.i];
          anim.t += dt * v;
          var f = Math.min(1, anim.t);
          robot.x = D.lerp(anim.from.x, tgt[0], f); robot.y = D.lerp(anim.from.y, tgt[1], f);
          robot.a = Math.atan2(tgt[1] - anim.from.y, tgt[0] - anim.from.x);
          if (f >= 1) { stepsWalked++; anim.i++; anim.from = { x: tgt[0], y: tgt[1] }; anim.t = 0; if (anim.i >= anim.path.length) { var a1 = anim.act; anim = null; arrive(a1); } }
        } else {
          anim.t += dt * v * 0.45;
          var g = Math.min(1, anim.t);
          robot.x = D.lerp(anim.from.x, anim.to.x, g); robot.y = D.lerp(anim.from.y, anim.to.y, g);
          robot.hop = Math.sin(g * Math.PI);
          robot.a = Math.atan2(anim.to.y - anim.from.y, anim.to.x - anim.from.x) || robot.a;
          if (g >= 1) { robot.hop = 0; var a2 = anim.act; anim = null; arrive(a2); }
        }
      } else if (mode === 'auto' && running) {
        if (!autoStep()) { running = false; refreshControls(); }
      }
      draw();
    }

    function draw() {
      var c = canvas.getContext('2d'), C = U.colors();
      c.clearRect(0, 0, cw, ch);
      /* dock */
      c.fillStyle = C.surface3; U.rr(c, 2, 2, cell * 0.8, cell * 0.8, 6); c.fill();
      c.fillStyle = C.text3; c.font = '600 ' + Math.max(8, cell * 0.22) + 'px JetBrains Mono'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DOCK', 2 + cell * 0.4, 2 + cell * 0.4);
      for (var y = 0; y < board.h; y++) for (var x = 0; x < board.w; x++) {
        var cc = board.cells[board.idx(x, y)], px = ox + x * cell, py = oy + y * cell, s = cell - 2;
        if (cc.open) {
          c.fillStyle = board.boom === board.idx(x, y) ? C.red : C.floor; U.rr(c, px, py, s, s, 4); c.fill();
          c.strokeStyle = C.line; c.lineWidth = 1; c.stroke();
          if (cc.mine) {
            c.fillStyle = board.boom === board.idx(x, y) ? '#fff' : C.red;
            c.beginPath(); c.arc(px + s / 2, py + s / 2, s * 0.22, 0, 7); c.fill();
            for (var k = 0; k < 8; k++) { var an = k * Math.PI / 4; c.fillRect(px + s / 2 + Math.cos(an) * s * .28 - 1.5, py + s / 2 + Math.sin(an) * s * .28 - 1.5, 3, 3); }
          } else if (cc.n) {
            c.fillStyle = NUMC[cc.n]; c.font = '700 ' + Math.round(s * 0.55) + 'px Space Grotesk'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(cc.n, px + s / 2, py + s / 2 + 1);
          }
        } else {
          c.fillStyle = C.wall; U.rr(c, px, py, s, s, 5); c.fill();
          c.fillStyle = C.wallTop; U.rr(c, px + 2, py + 2, s - 4, s - 6, 4); c.fill();
          if (hover && hover[0] === x && hover[1] === y && mode === 'user') { c.fillStyle = 'rgba(255,255,255,.18)'; U.rr(c, px, py, s, s, 5); c.fill(); }
          if (cc.flag) {
            c.strokeStyle = '#0f172a'; c.lineWidth = Math.max(1.5, s * 0.06); c.beginPath(); c.moveTo(px + s * .38, py + s * .78); c.lineTo(px + s * .38, py + s * .2); c.stroke();
            c.fillStyle = C.red; c.beginPath(); c.moveTo(px + s * .38, py + s * .2); c.lineTo(px + s * .75, py + s * .34); c.lineTo(px + s * .38, py + s * .5); c.fill();
          }
        }
      }
      /* reasoning highlight */
      if (lastAction && !board.dead && !board.won) {
        var col = lastAction.kind === 'mine' ? C.red : lastAction.kind === 'guess' ? C.amber : C.green;
        c.strokeStyle = col; c.lineWidth = 2.5;
        U.rr(c, ox + lastAction.x * cell - 1, oy + lastAction.y * cell - 1, cell, cell, 6); c.stroke();
        if (lastAction.from) { c.setLineDash([4, 3]); U.rr(c, ox + lastAction.from[0] * cell - 1, oy + lastAction.from[1] * cell - 1, cell, cell, 6); c.stroke(); c.setLineDash([]); }
      }
      /* robot */
      var rx = ox + robot.x * cell + (cell - 2) / 2, ry = oy + robot.y * cell + (cell - 2) / 2 - (robot.hop || 0) * cell * 0.9;
      if (robot.hop) { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(ox + robot.x * cell + (cell - 2) / 2, oy + robot.y * cell + (cell - 2) / 2 + cell * .3, cell * .3 * (1 - robot.hop * .4), cell * .1, 0, 0, 7); c.fill(); }
      U.bot(c, rx, ry, cell * 0.78, robot.a, C.accent, robot.mood);
    }

    function cellAt(e) {
      var r = canvas.getBoundingClientRect();
      var x = Math.floor((e.clientX - r.left - ox) / cell), y = Math.floor((e.clientY - r.top - oy) / cell);
      return board.inb(x, y) ? [x, y] : null;
    }
    canvas.addEventListener('mousemove', function (e) { hover = cellAt(e); canvas.style.cursor = hover && mode === 'user' ? 'pointer' : 'default'; });
    canvas.addEventListener('mouseleave', function () { hover = null; });
    canvas.addEventListener('click', function (e) {
      if (mode !== 'user' || anim) return;
      var p = cellAt(e); if (!p) return;
      command({ type: 'reveal', x: p[0], y: p[1], kind: 'user', reason: 'Driving to ' + nm(p[0], p[1]) + '…' });
    });
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault(); if (mode !== 'user') return;
      var p = cellAt(e); if (!p) return;
      var c = board.cells[board.idx(p[0], p[1])]; if (c.open) return;
      command({ type: 'flag', x: p[0], y: p[1], kind: 'mine' });
    });
    var ro = new ResizeObserver(function () { layout(); draw(); }); ro.observe(stage);
    var offTheme = D.bus.on('theme', draw);

    newGame();
    raf = requestAnimationFrame(frame);

    return {
      destroy: function () { cancelAnimationFrame(raf); clearInterval(timer); ro.disconnect(); offTheme(); },
      /* test hooks */
      _test: {
        newGame: function (seed, sz, md) { if (sz) size = sz; if (md) mode = md; newGame(seed); refreshControls(); },
        run: function () { running = true; speed = 12; refreshControls(); },
        state: function () { return { dead: board.dead, won: board.won, opened: board.opened, logical: logicalMoves, guesses: guesses, running: running, busy: !!anim }; },
        solveStep: function () { return solveStep(board); }
      }
    };
  }

  /* ------------------------------------------------------------- registration */
  var g = function (inner) { return A.wrap(inner); };
  function miniBoard(cells) {
    var s = ''; for (var y = 0; y < 4; y++) for (var x = 0; x < 6; x++) {
      var v = cells[y * 6 + x], px = 22 + x * 18, py = 14 + y * 18;
      if (v === 'h') s += '<rect x="' + px + '" y="' + py + '" width="16" height="16" rx="3" fill="var(--grid-wall-top)"/>';
      else if (v === 'f') s += '<rect x="' + px + '" y="' + py + '" width="16" height="16" rx="3" fill="var(--grid-wall-top)"/><path d="M' + (px + 6) + ' ' + (py + 13) + 'V' + (py + 3) + 'l7 3-7 3" fill="var(--red)" stroke="#0f172a" stroke-width="1"/>';
      else s += '<rect x="' + px + '" y="' + py + '" width="16" height="16" rx="3" fill="var(--grid-floor)" stroke="var(--grid-line)"/>' + (v ? '<text x="' + (px + 8) + '" y="' + (py + 12) + '" text-anchor="middle" font-weight="700" font-size="10" fill="' + NUMC[v] + '">' + v + '</text>' : '');
    }
    return s;
  }
  D.arcade.register({
    id: 'minesweeper', title: 'Mine Sweeper Bot', tagline: 'Send the robot across a minefield — or watch it solve the board with pure logic.',
    icon: 'bomb', color: '--red', cv: null, controls: 'Mouse',
    guide: {
      howto: [
        { title: 'Choose who plays', text: '<b>You command</b>: you pick cells and the robot drives there. <b>Auto-solve</b>: the robot reasons on its own and explains every move.', svg: g(A.btn(14, 20, 58, 'You command', true) + A.btn(78, 20, 58, 'Auto-solve') + A.bot(75, 70, 22, 0)) },
        { title: 'Click a cell', text: 'The robot drives over cells it already knows are safe, then reveals your target. The first cell is always safe.', svg: g(miniBoard([0, 0, 1, 'h', 'h', 'h', 0, 0, 1, 'h', 'h', 'h', 0, 1, 2, 'h', 'h', 'h', 0, 1, 'h', 'h', 'h', 'h']) + A.bot(31, 23, 12, 0) + A.cursor(84, 46)) },
        { title: 'Read the numbers', text: 'A number tells how many of the 8 surrounding cells hide a mine. <b>Right-click</b> a cell you are sure about to plant a flag.', svg: g(miniBoard([0, 1, 'f', 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0])) },
        { title: 'Watch the reasoning', text: 'In Auto-solve, the log explains each step: <span style="color:var(--green)">safe</span>, <span style="color:var(--red)">mine</span> or <span style="color:var(--amber)">guess</span>. Use <b>Step</b> to go one move at a time.', svg: g('<rect x="14" y="14" width="122" height="76" rx="8" fill="var(--bg-2)" stroke="var(--line)"/>' + A.text(22, 32, '(3,4) is safe: …', 8.5, 'var(--green)') + A.text(22, 50, '(5,2) is a mine: …', 8.5, 'var(--red)') + A.text(22, 68, 'guessing (1,9) ≈12%', 8.5, 'var(--amber)')) },
        { title: 'Clear the board', text: 'Reveal every safe cell to win. Faster clears on bigger boards earn higher scores (scores only count in <b>You command</b> mode).', svg: g('<path d="M55 20h40v24a20 20 0 01-40 0z" fill="var(--amber)" opacity=".85"/><path d="M75 64v12M60 84h30" stroke="var(--amber)" stroke-width="4"/>') }
      ],
      tips: 'Stuck? Switch to <b>Auto-solve</b> and press <b>Step</b> — the robot shows you the next logical move and why.',
      about: {
        hero: '<svg viewBox="0 0 560 160"><rect width="560" height="160" fill="var(--bg-2)"/>' + (function () { var s = ''; for (var y = 0; y < 5; y++) for (var x = 0; x < 9; x++) { var open = x < 4 || (x < 6 && y > 1); s += '<rect x="' + (20 + x * 28) + '" y="' + (12 + y * 28) + '" width="26" height="26" rx="5" fill="' + (open ? 'var(--grid-floor)' : 'var(--grid-wall-top)') + '" stroke="var(--grid-line)"/>'; } return s; })() +
          '<g transform="translate(300 30)"><rect width="240" height="100" rx="12" fill="var(--surface)" stroke="var(--line)"/><text x="14" y="28" font-size="13" font-weight="700" fill="var(--text)">Constraint logic</text><text x="14" y="52" font-size="11" fill="var(--green)">needs 0 more → all neighbours safe</text><text x="14" y="70" font-size="11" fill="var(--red)">needs k, k hidden → all mines</text><text x="14" y="88" font-size="11" fill="var(--amber)">subset A ⊂ B → compare leftovers</text></g></svg>',
        intro: 'Mine Sweeper is a classic constraint-satisfaction puzzle. Here a mobile robot must also physically travel to each cell — so it plans a path across ground it already knows is safe, just like a real demining robot would.',
        facts: [['3', 'board sizes'], ['2', 'logic rules'], ['BFS', 'path planner']],
        sections: [
          { title: 'Single-cell rule', html: '<p>If a number already has that many flags around it, every other hidden neighbour is safe. If it needs exactly as many mines as it has hidden neighbours, they are all mines.</p>' },
          { title: 'Subset rule', html: '<p>When the hidden neighbours of cell A are a subset of those of cell B, the mines B needs beyond A must sit in the cells only B touches. That often proves safe cells the single rule cannot.</p>' },
          { title: 'When logic runs out', html: '<p>The robot estimates each cell’s mine risk and picks the lowest — a calculated guess. The log marks these in amber so you can see when luck was involved.</p>' },
          { title: 'Path planning', html: '<p>Breadth-first search finds the shortest route over revealed cells (8 directions). If the target is not connected, the robot hops over — real robots would use a drone or an arm for that.</p>' }
        ]
      }
    },
    create: create
  });
  D.arcade._minesweeper = { Board: Board, solveStep: solveStep };
})(window);
