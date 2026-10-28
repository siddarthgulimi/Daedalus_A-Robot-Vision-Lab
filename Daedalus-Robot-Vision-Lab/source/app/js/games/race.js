/* games/race.js — Labyrinth Race: you vs Theseus on the same maze. */
(function (global) {
  'use strict';
  var D = global.D;
  if (!D.arcade || !D.Maze) return;
  var M = D.Maze, art = D.guide.art;

  var LEVELS = {
    easy:   { label: 'Easy',   cols: 11, rows: 8,  solver: 'wall',    ms: 560, loops: 0,    mult: 1 },
    normal: { label: 'Normal', cols: 14, rows: 9,  solver: 'tremaux', ms: 400, loops: 0.15, mult: 1.5 },
    hard:   { label: 'Hard',   cols: 17, rows: 11, solver: 'astar',   ms: 300, loops: 0.25, mult: 2.2 }
  };

  D.arcade.register({
    id: 'race', title: 'Labyrinth Race', tagline: 'Out-run Theseus through a fresh maze. He has a strategy — you have reflexes.',
    icon: 'theseus', color: '--amber', cv: null, controls: 'Arrow keys / WASD',
    guide: {
      howto: [
        { title: 'Choose a difficulty', text: '<b>Easy</b>: Theseus feels the walls with his left hand. <b>Normal</b>: he explores and backtracks. <b>Hard</b>: he knows the map (A*) — be quick!',
          svg: art.wrap(art.btn(14, 40, 38, 'Easy') + art.btn(56, 40, 40, 'Normal', true) + art.btn(100, 40, 36, 'Hard')) },
        { title: 'Wait for the countdown', text: 'Both of you start in the top-left corner. After <b>3 · 2 · 1</b> the race begins.',
          svg: art.wrap('<text x="75" y="66" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="46" fill="var(--accent)">3</text>') },
        { title: 'Drive with the keys', text: 'Use the <b>arrow keys</b> or <b>W A S D</b>. You can only move through open passages.',
          svg: art.wrap('<g font-size="10" font-weight="700" fill="var(--text)"><rect x="62" y="22" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><text x="75" y="37" text-anchor="middle">↑</text><rect x="32" y="48" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><text x="45" y="63" text-anchor="middle">←</text><rect x="62" y="48" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><text x="75" y="63" text-anchor="middle">↓</text><rect x="92" y="48" width="26" height="22" rx="5" fill="var(--surface-3)" stroke="var(--line-2)"/><text x="105" y="63" text-anchor="middle">→</text></g>') },
        { title: 'Reach the flag first', text: 'Get to the red flag in the bottom-right before Theseus. Faster wins on harder levels score more.',
          svg: art.wrap(art.grid(20, 18, 6, 4, 17) + art.flag(112, 78) + '<circle cx="96" cy="76" r="6" fill="var(--accent)"/>' + art.bot(60, 42, 11)) }
      ],
      about: {
        intro: 'A head-to-head race that shows the difference between <b>human intuition</b> and <b>robot strategy</b>. Each difficulty gives Theseus a different maze-solving algorithm from the Maze Lab.',
        facts: [['3', 'difficulty levels'], ['3', 'robot strategies'], ['∞', 'fresh mazes']],
        sections: [
          { title: 'Who is faster?', html: '<p>A map-less wall follower may wander the whole maze; an A* planner drives straight to the exit. You can see the whole maze — but you have to read it fast.</p>' },
          { title: 'Scoring', html: '<p>Win to score: <b>1000 − 20 per second</b> (minimum 50), multiplied by the difficulty (×1, ×1.5, ×2.2). Losing scores 0. Your best score is saved.</p>' }
        ]
      }
    },

    create: function (host, ctx) {
      var level = D.store.get('race.level', 'normal');
      var maze, view, start, goal, player, botWalk, botI, botTimer = null, clock = null, t0 = 0, state = 'idle', trail;
      var root = D.el('div', { class: 'race' });
      var stage = D.el('div', { class: 'stage race-stage' });
      var canvas = D.el('canvas');
      var overlay = D.el('div', { class: 'race-over hidden' });
      stage.appendChild(canvas); stage.appendChild(overlay);
      var side = D.el('div', { class: 'race-side' });
      var seg = D.ui.seg([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], level, function (v) { level = v; D.store.set('race.level', v); newRound(); }, 'full');
      var timerEl = D.el('div', { class: 'race-timer', text: '00.0' });
      var youEl = D.el('b', { text: '0' }), botEl = D.el('b', { text: '0' });
      var bestEl = D.el('b', { class: 'mono' });
      var startBtn = D.el('button', { class: 'btn primary lg', html: D.icon('play') + 'Start race', onclick: function () { countdown(); } });
      side.appendChild(D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-body col' },
        D.el('div', { class: 'eyebrow', text: 'Difficulty' }), seg,
        D.el('div', { class: 'small faint', html: '' }),
        timerEl,
        D.el('div', { class: 'race-vs' },
          D.el('div', { class: 'who', style: { borderColor: 'var(--accent)' } }, D.el('span', { text: 'YOU · steps' }), youEl),
          D.el('div', { class: 'faint mono', text: 'VS' }),
          D.el('div', { class: 'who', style: { borderColor: 'var(--amber)' } }, D.el('span', { text: 'THESEUS' }), botEl)),
        startBtn,
        D.el('div', { class: 'row small muted' }, D.el('span', { text: 'Best score' }), D.el('span', { class: 'spacer' }), bestEl)
      )));
      var lvlInfo = D.el('div', { class: 'callout', html: '' });
      side.appendChild(lvlInfo);
      side.appendChild(D.el('div', { class: 'small faint', html: 'Controls: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>' }));
      root.appendChild(stage); root.appendChild(side);
      host.appendChild(root);

      function showBest() { var b = ctx.best(); bestEl.textContent = b == null ? '—' : b; }
      function stopTimers() { clearInterval(botTimer); clearInterval(clock); botTimer = clock = null; }

      function newRound() {
        stopTimers(); state = 'idle';
        var L = LEVELS[level];
        maze = M.create({ shape: 'square', cols: L.cols, rows: L.rows });
        M.generate(maze, 'backtracker', (Math.random() * 1e9) | 0);
        M.braid(maze, L.loops, (Math.random() * 1e9) | 0);
        start = 0; goal = maze.cells.length - 1; player = start; trail = [start];
        if (!view) view = new D.MazeView(canvas, maze, { padding: 16 });
        else view.setMaze(maze);
        view.playerPos = null;
        view.set({ start: start, goal: goal, path: null, visited: null, trail: trail, resetRobot: true });
        view.setPlayer(start);
        var res = M.solve(maze, start, goal, L.solver);
        botWalk = res.walk; botI = 0;
        youEl.textContent = '0'; botEl.textContent = '0'; timerEl.textContent = '00.0';
        lvlInfo.innerHTML = D.icon('theseus') + '<div><b>' + L.label + ':</b> Theseus uses ' + M.SOLVERS.filter(function (s) { return s.id === L.solver; })[0].label + ' and moves every ' + L.ms + ' ms.</div>';
        overlay.classList.add('hidden');
        startBtn.disabled = false;
        showBest();
      }

      function countdown() {
        if (state !== 'idle') { newRound(); }
        state = 'count'; startBtn.disabled = true;
        var n = 3;
        overlay.classList.remove('hidden');
        overlay.innerHTML = '<div class="race-count">3</div>';
        D.sound.beep(440, 0.12, 'square', 0.05);
        var cd = setInterval(function () {
          n--;
          if (n > 0) { overlay.innerHTML = '<div class="race-count">' + n + '</div>'; D.sound.beep(440, 0.12, 'square', 0.05); }
          else { clearInterval(cd); overlay.classList.add('hidden'); go(); }
        }, 750);
        cleanup.push(function () { clearInterval(cd); });
      }

      function go() {
        if (state !== 'count') return;
        state = 'race'; t0 = performance.now();
        D.sound.beep(880, 0.25, 'square', 0.06);
        var L = LEVELS[level];
        clock = setInterval(function () { timerEl.textContent = ((performance.now() - t0) / 1000).toFixed(1).padStart(4, '0'); }, 100);
        botTimer = setInterval(function () {
          if (state !== 'race') return;
          botI = Math.min(botI + 1, botWalk.length - 1);
          view.setRobot(botWalk[botI]);
          botEl.textContent = botI;
          if (botWalk[botI] === goal) end(false);
        }, L.ms);
        D.audit.log('arcade', 'Labyrinth Race started', LEVELS[level].label + ' · ' + maze.cols + '×' + maze.rows);
      }

      function end(win) {
        if (state !== 'race') return;
        state = 'over'; stopTimers();
        var secs = (performance.now() - t0) / 1000;
        var L = LEVELS[level];
        var score = win ? Math.round(Math.max(50, 1000 - secs * 20) * L.mult) : 0;
        var best = ctx.best();
        ctx.reportScore(score, (win ? 'Won' : 'Lost') + ' on ' + L.label + ' in ' + secs.toFixed(1) + 's · ' + (trail.length - 1) + ' steps');
        if (win) D.sound.win(); else D.sound.bad();
        if (!win) view.set({ path: M.solve(maze, start, goal, 'bfs').path });
        overlay.classList.remove('hidden');
        overlay.innerHTML = '';
        var box = D.el('div', { class: 'box' },
          D.el('div', { class: 'eyebrow', text: win ? 'Victory' : 'Theseus wins' }),
          D.el('h2', { text: win ? 'You escaped first!' : 'Out-planned!' }),
          D.el('p', { class: 'muted', html: win ? 'Time <b>' + secs.toFixed(1) + 's</b> · score <b>' + score + '</b>' + (best == null || score > best ? '<br>🏆 New best score!' : '') : 'Theseus reached the flag in ' + secs.toFixed(1) + 's. The amber line shows the shortest route.' }),
          D.el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } },
            D.el('button', { class: 'btn primary', html: D.icon('reset') + 'New maze', onclick: function () { newRound(); } }),
            D.el('button', { class: 'btn', html: D.icon('play') + 'Race again', onclick: function () { newRound(); countdown(); } })));
        overlay.appendChild(box);
        showBest();
      }

      var DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };
      function onKey(e) {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        var d = DIRS[e.key]; if (!d) return;
        e.preventDefault();
        if (state !== 'race') return;
        var c = maze.cells[player], nc = c.col + d[0], nr = c.row + d[1];
        if (nc < 0 || nr < 0 || nc >= maze.cols || nr >= maze.rows) { D.sound.bump(); return; }
        var n = nr * maze.cols + nc;
        if (!M.linked(maze, player, n)) { D.sound.bump(); return; }
        player = n; trail.push(n);
        view.setPlayer(n); view.s.trail = trail;
        youEl.textContent = trail.length - 1;
        D.sound.move();
        if (player === goal) end(true);
      }
      document.addEventListener('keydown', onKey);
      var cleanup = [];

      newRound();
      return {
        destroy: function () {
          stopTimers(); cleanup.forEach(function (f) { f(); });
          document.removeEventListener('keydown', onKey);
          if (view) view.destroy();
          root.remove();
        }
      };
    }
  });
})(window);
