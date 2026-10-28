/* tutorial.js — "Boot Camp": the mandatory first-run tutorial.
   Seven short, hands-on steps. Each step has a small task; "Next" unlocks only when
   the task is done, and there is no skip / close on the first run. */
(function (global) {
  'use strict';
  var D = global.D;
  var KEY = 'tutorialDone';

  var wrap = null, idx = 0, done = {}, replay = false, cleanup = [];

  var STEPS = [
    { id: 'welcome', title: 'Meet your robots', render: stepWelcome },
    { id: 'card', title: 'Place your first card', render: stepCard },
    { id: 'goal', title: 'Move the goal', render: stepGoal },
    { id: 'slider', title: 'Face or hands?', render: stepSlider },
    { id: 'gestures', title: 'Gestures change faces', render: stepGestures },
    { id: 'maze', title: 'Build & solve a maze', render: stepMaze },
    { id: 'finish', title: 'Make it yours', render: stepFinish }
  ];

  function ensure() { if (!D.store.get(KEY, false)) start(false); }

  function start(isReplay) {
    if (wrap) return;
    replay = !!isReplay; idx = 0; done = {};
    D.guide.close();
    wrap = D.el('div', { class: 'tut-wrap' });
    document.body.appendChild(wrap);
    document.addEventListener('keydown', blockKeys, true);
    D.audit.log('tutorial', replay ? 'Boot Camp replay started' : 'Boot Camp started', 'First-run tutorial');
    render();
  }
  function blockKeys(e) {
    if (!wrap) return;
    if (e.key === 'Escape' && !replay) { e.stopPropagation(); e.preventDefault(); D.ui.toast('Boot Camp is required on first run — it only takes a few minutes!', 'warn'); }
  }
  function finish() {
    D.store.set(KEY, true);
    D.audit.log('tutorial', 'Boot Camp completed', 'All 7 steps', 'success');
    teardown();
    D.sound.win();
    certificate();
  }
  function exitReplay() { D.audit.log('tutorial', 'Boot Camp replay closed', 'at step ' + (idx + 1)); teardown(); }
  function teardown() {
    runCleanup();
    document.removeEventListener('keydown', blockKeys, true);
    if (wrap) wrap.remove(); wrap = null;
  }
  function runCleanup() { cleanup.forEach(function (f) { try { f(); } catch (e) {} }); cleanup = []; }
  function complete(id) {
    if (done[id]) return;
    done[id] = true; D.sound.good();
    D.audit.log('tutorial', 'Completed step', STEPS[idx].title, 'success');
    var nb = D.$('.tut-next', wrap); if (nb) { nb.disabled = false; nb.classList.add('pulse'); }
    var st = D.$('.tut-taskstate', wrap); if (st) { st.className = 'tut-taskstate ok'; st.innerHTML = D.icon('check') + 'Task complete — press Next'; }
  }

  function render() {
    runCleanup();
    wrap.innerHTML = '';
    var s = STEPS[idx];
    var box = D.el('div', { class: 'tut-box' });
    var head = D.el('div', { class: 'tut-head' });
    head.appendChild(D.el('div', { class: 'tut-brand', html: '<span class="eyebrow">Boot Camp · step ' + (idx + 1) + ' of ' + STEPS.length + '</span><h2>' + s.title + '</h2>' }));
    var dots = D.el('div', { class: 'tut-dots' });
    STEPS.forEach(function (x, i) { dots.appendChild(D.el('i', { class: (i < idx || done[x.id] ? 'done' : '') + (i === idx ? ' on' : ''), title: x.title })); });
    head.appendChild(dots);
    if (replay) head.appendChild(D.el('button', { class: 'btn sm ghost', html: D.icon('x') + 'Exit', onclick: exitReplay }));
    box.appendChild(head);
    var bar = D.el('div', { class: 'tut-progress' }, D.el('i', { style: { width: ((idx + (done[s.id] ? 1 : 0)) / STEPS.length * 100) + '%' } }));
    box.appendChild(bar);
    var body = D.el('div', { class: 'tut-body' });
    box.appendChild(body);
    var foot = D.el('div', { class: 'tut-foot' });
    foot.appendChild(D.el('button', { class: 'btn ghost', html: D.icon('arrowLeft') + 'Back', disabled: idx === 0, onclick: function () { idx--; render(); } }));
    foot.appendChild(D.el('div', { class: 'tut-taskstate' + (done[s.id] ? ' ok' : ''), html: done[s.id] ? D.icon('check') + 'Task complete — press Next' : D.icon('target') + 'Complete the task to continue' }));
    var next = D.el('button', { class: 'btn primary tut-next', html: (idx === STEPS.length - 1 ? 'Finish Boot Camp' : 'Next') + D.icon('arrowRight'), disabled: !done[s.id] });
    next.onclick = function () { if (!done[s.id]) return; if (idx === STEPS.length - 1) finish(); else { idx++; render(); } };
    foot.appendChild(next);
    box.appendChild(foot);
    wrap.appendChild(box);
    s.render(body, function () { complete(s.id); });
  }

  /* helper: a two-column step (explanation | interactive area) */
  function split(body, explain, task) {
    var g = D.el('div', { class: 'tut-split' });
    var l = D.el('div', { class: 'tut-explain', html: explain });
    var r = D.el('div', { class: 'tut-play' });
    if (task) l.appendChild(D.el('div', { class: 'tut-task', html: D.icon('target') + '<div><b>Your task</b><br>' + task + '</div>' }));
    g.appendChild(l); g.appendChild(r); body.appendChild(g);
    return r;
  }

  /* ================================================================ 1 · Welcome */
  function stepWelcome(body, ok) {
    body.appendChild(D.el('p', { class: 'tut-lead', html: 'Welcome to <b>Daedalus</b>, a robot lab where machines <b>see</b> you through the camera, <b>plan</b> paths and <b>solve</b> mazes. Three robots live here. <b>Click each robot to wake it up.</b>' }));
    var row = D.el('div', { class: 'tut-robots' });
    var woke = {};
    [['argus', 'Argus', 'I follow the command cards you give me. You will always see my planned path before I move.', '--accent'],
     ['echo', 'Echo', 'I use computer vision! I copy your facial expressions — or react to your hand gestures.', '--violet'],
     ['theseus', 'Theseus', 'I build mazes — square, circular, hexagonal — and find my way out with search algorithms.', '--amber']].forEach(function (r) {
      var c = D.el('button', { class: 'tut-robot', style: { '--rc': 'var(' + r[3] + ')' } },
        D.el('div', { class: 'av', html: D.avatar(r[0]) }), D.el('b', { text: r[1] }), D.el('p', { class: 'zz', text: 'zzz… click to wake' }));
      c.onclick = function () {
        if (woke[r[0]]) return;
        woke[r[0]] = true; c.classList.add('awake'); c.querySelector('.zz').textContent = '“' + r[2] + '”';
        D.sound.seq([[500, .05], [800, .08]], 70);
        if (Object.keys(woke).length === 3) ok();
      };
      row.appendChild(c);
    });
    body.appendChild(row);
    body.appendChild(D.el('div', { class: 'tut-note', html: D.icon('info') + '<span>Boot Camp takes about 5 minutes. You can replay it any time from <b>Help center</b> or <b>Settings</b>.</span>' }));
  }

  /* ================================================================ 2 · Place a card (mini Argus) */
  function miniArgus(host, world, opts) {
    var A = D.argus;
    var prog = [];
    var box = D.el('div', { class: 'tut-argus' });
    var pal = D.el('div', { class: 'tut-pal' });
    (opts.palette || ['fwd']).forEach(function (t) {
      var T = A.TYPES[t];
      var p = D.el('div', { class: 'ag-pcard', draggable: 'true', style: { '--cc': t === 'fwd' ? '#38bdf8' : '#a78bfa' }, html: '<span class="ic">' + D.icon(T.icon) + '</span><span class="lb">' + T.label + '</span><span class="add">' + D.icon('plus') + '</span>' });
      p.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', t); });
      p.onclick = function () { add(t); };
      pal.appendChild(p);
    });
    var track = D.el('div', { class: 'tut-track' });
    track.addEventListener('dragover', function (e) { e.preventDefault(); track.classList.add('over'); });
    track.addEventListener('dragleave', function () { track.classList.remove('over'); });
    track.addEventListener('drop', function (e) { e.preventDefault(); track.classList.remove('over'); var t = e.dataTransfer.getData('text/plain'); if (A.TYPES[t]) add(t); });
    var left = D.el('div', { class: 'tut-aleft' }, D.el('div', { class: 'eyebrow', text: 'Deck' }), pal, D.el('div', { class: 'eyebrow', text: 'Track', style: { marginTop: '8px' } }), track);
    var stg = D.el('div', { class: 'stage tut-astage' });
    var cv = D.el('canvas'); stg.appendChild(cv);
    var ctrls = D.el('div', { class: 'row', style: { marginTop: '8px' } });
    var runB = D.el('button', { class: 'btn go', html: D.icon('play') + 'Run', onclick: run });
    ctrls.appendChild(runB);
    if (opts.autoplan) ctrls.appendChild(D.el('button', { class: 'btn', html: D.icon('wand') + 'Auto-plan', onclick: function () { prog = A.autoPlan(world, false) || []; renderTrack(); D.sound.click(); } }));
    ctrls.appendChild(D.el('button', { class: 'btn ghost', html: D.icon('trash') + 'Clear', onclick: function () { prog = []; renderTrack(); } }));
    var status = D.el('span', { class: 'small muted', style: { marginLeft: '6px' } });
    ctrls.appendChild(status);
    var right = D.el('div', { class: 'tut-aright' }, stg, ctrls);
    box.appendChild(left); box.appendChild(right);
    host.appendChild(box);

    var stage = new A.Stage(cv);
    var running = false, raf = 0, preview = null;
    function resetBot() { stage.robot.x = world.start.x; stage.robot.y = world.start.y; stage.robot.a = world.start.dir * 90; stage.robot.expr = 'neutral'; stage.trail = []; }
    function add(t) { if (running) return; var last = prog[prog.length - 1]; if (t === 'fwd' && last && last.type === 'fwd' && last.n < 9) last.n++; else prog.push(A.newCard(t)); D.sound.click(); renderTrack(); }
    function renderTrack() {
      preview = A.simulate(prog, world);
      track.innerHTML = '';
      if (!prog.length) track.appendChild(D.el('div', { class: 'tut-drop', html: 'Drop cards here' }));
      prog.forEach(function (c, i) {
        var T = A.TYPES[c.type];
        var el = D.el('div', { class: 'ag-card', style: { '--cc': c.type === 'fwd' ? '#38bdf8' : '#a78bfa' } });
        var h = D.el('div', { class: 'ag-chead' });
        h.appendChild(D.el('span', { class: 'ag-num', style: { background: ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c'][i % 6] }, text: String(i + 1) }));
        h.appendChild(D.el('span', { class: 'ic', html: D.icon(T.icon) }));
        h.appendChild(D.el('span', { class: 'lb', text: T.label }));
        if (T.num) {
          var stp = D.el('span', { class: 'ag-step' },
            D.el('button', { text: '−', onclick: function () { if (c.n > 1) { c.n--; renderTrack(); } } }), D.el('b', { text: String(c.n) }),
            D.el('button', { text: '+', onclick: function () { if (c.n < 9) { c.n++; renderTrack(); } } }));
          h.appendChild(stp);
        }
        h.appendChild(D.el('button', { class: 'ag-x', html: D.icon('x'), onclick: function () { prog.splice(i, 1); renderTrack(); } }));
        el.appendChild(h); track.appendChild(el);
      });
      var st = preview.state, atGoal = st.x === world.goal.x && st.y === world.goal.y;
      status.innerHTML = !prog.length ? 'Add a card…' : atGoal ? '<span style="color:var(--green)">Preview reaches the flag ✓ — press Run</span>' : 'Preview ends ' + (Math.abs(st.x - world.goal.x) + Math.abs(st.y - world.goal.y)) + ' cells from the flag';
      if (!running) resetBot();
      if (opts.onChange) opts.onChange(prog);
    }
    function draw() {
      var order = prog.map(function (c) { return c.id; });
      stage.draw(world, preview, { showPreview: prog.length > 0, colorOf: function (id) { return ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c'][Math.max(0, order.indexOf(id)) % 6]; }, order: order, running: running, hoverCell: null });
      raf = requestAnimationFrame(draw);
    }
    function run() {
      if (running || !prog.length) return;
      running = true; resetBot();
      var ev = preview.events.slice(), i = 0;
      (function nextE() {
        if (i >= ev.length) {
          running = false;
          var st = preview.state;
          if (st.x === world.goal.x && st.y === world.goal.y) { stage.robot.expr = 'happy'; D.sound.win(); opts.onGoal && opts.onGoal(); }
          else { stage.robot.expr = 'confused'; D.ui.toast('Not quite — look at the dashed preview line and adjust the number.', 'warn'); }
          return;
        }
        var e = ev[i++], from = { x: stage.robot.x, y: stage.robot.y, a: stage.robot.a }, da = ((e.dir * 90 - from.a) % 360 + 540) % 360 - 180, t0 = performance.now();
        if (e.kind === 'move') D.sound.move(); if (e.kind === 'bump') D.sound.bump();
        (function anim() {
          var k = Math.min(1, (performance.now() - t0) / 260);
          stage.robot.x = D.lerp(from.x, e.x, k); stage.robot.y = D.lerp(from.y, e.y, k); stage.robot.a = from.a + da * k;
          if (k < 1) requestAnimationFrame(anim); else { if (e.kind === 'move') stage.trail.push({ x: e.x, y: e.y }); nextE(); }
        })();
      })();
    }
    renderTrack(); draw();
    cleanup.push(function () { cancelAnimationFrame(raf); });
    return { canvas: cv, stage: stage, world: world, refresh: renderTrack, setWorld: function (w) { world = w; renderTrack(); } };
  }

  function stepCard(body, ok) {
    var play = split(body,
      '<p>Robots follow <b>programs</b> — a list of instructions. In Argus you build programs from <b>command cards</b>.</p>' +
      '<ul class="tut-list"><li><b>Drag</b> a card from the Deck into the Track — or just <b>click</b> it.</li><li>Use <b>− / +</b> on a card to change how many steps it takes.</li><li>The <b>dashed line</b> on the grid previews where the robot will go. Its coloured number matches the card number.</li></ul>',
      'Get the robot to the green flag: add the <b>Forward</b> card, set it to the right number, then press <b>Run</b>.');
    var w = D.argus.parseMap(['#######', '#S...G#', '#######'], 1);
    miniArgus(play, w, { palette: ['fwd', 'left', 'right'], onGoal: ok });
  }

  /* ================================================================ 3 · Move the goal */
  function stepGoal(body, ok) {
    var moved = false;
    var play = split(body,
      '<p>You decide where the robot <b>starts</b> and where its <b>goal</b> is. In Argus free play you can move both, paint walls and drop gems.</p>' +
      '<p><b>Auto-plan</b> lets the robot work out the route itself using a <i>breadth-first search</i> — it writes the cards for you.</p>',
      '<b>Click any empty cell</b> on the grid to move the flag there. Then press <b>Auto-plan</b> and <b>Run</b>.');
    var w = D.argus.parseMap(['#########', '#S......#', '#.##.##.#', '#......G#', '#########'], 1);
    var mini = miniArgus(play, w, { palette: ['fwd', 'left', 'right'], autoplan: true, onGoal: function () { if (moved) ok(); else D.ui.toast('Nice! Now move the flag to a new cell and do it again.', 'warn'); } });
    mini.canvas.style.cursor = 'pointer';
    mini.canvas.addEventListener('mousedown', function (e) {
      var c = mini.stage.cellAt(w, e.clientX, e.clientY);
      if (!c || w.walls[c.x + ',' + c.y] || (c.x === w.start.x && c.y === w.start.y)) return;
      w.goal = { x: c.x, y: c.y }; moved = true; D.sound.click(); mini.refresh();
    });
  }

  /* ================================================================ 4 · Face / Hands slider */
  function stepSlider(body, ok) {
    var seen = { face: false, hands: false }, mode = 'face';
    var play = split(body,
      '<p><b>Echo</b> is the computer-vision robot. One camera can see your face <i>and</i> your hands — so Daedalus asks you to choose with this slider:</p>' +
      '<div class="tut-compare"><div><b>' + D.icon('face') + ' FACE</b><span>Scans only your face. Echo copies your expression: happy, sad, angry, surprised, thinking, confused, excited, eager.</span></div><div><b>' + D.icon('hand') + ' HANDS</b><span>Scans only your hands. Each gesture (👍 ✌️ ✊ 🤟 …) switches Echo’s face. Also used to drive robots hands-free.</span></div></div>',
      'Slide the switch to <b>HANDS</b>, then back to <b>FACE</b>.');
    var sl = D.el('div', { class: 'mode-slider', dataset: { mode: 'face' } }, D.el('div', { class: 'knob' }), D.el('div', { class: 'opt face', html: D.icon('face') + 'FACE' }), D.el('div', { class: 'opt hands', html: D.icon('hand') + 'HANDS' }));
    var illus = D.el('div', { class: 'tut-scan' });
    function paint() {
      illus.innerHTML = mode === 'face'
        ? '<svg viewBox="0 0 220 140"><rect x="10" y="10" width="200" height="120" rx="12" fill="#03070d"/><ellipse cx="110" cy="66" rx="34" ry="42" fill="none" stroke="#22d3ee" stroke-width="2"/>' + dots(110, 66) + '<path d="M96 84q14 12 28 0" stroke="#22d3ee" stroke-width="2.5" fill="none"/><g opacity=".25"><path d="M168 118 v-30 M176 118 v-36 M184 118 v-32" stroke="#888" stroke-width="5" stroke-linecap="round"/></g><text x="20" y="30" font-size="11" fill="#22d3ee" font-family="Inter" font-weight="700">FACE MESH · 478 pts</text><text x="150" y="128" font-size="9" fill="#666" font-family="Inter">hand ignored</text></svg>'
        : '<svg viewBox="0 0 220 140"><rect x="10" y="10" width="200" height="120" rx="12" fill="#03070d"/><g opacity=".25"><ellipse cx="80" cy="66" rx="30" ry="38" fill="none" stroke="#888" stroke-width="2"/></g><g stroke="#f472b6" stroke-width="3" stroke-linecap="round"><path d="M150 118 L150 92 M150 92 L136 70 M150 92 L146 60 M150 92 L158 58 M150 92 L168 64 M150 92 L174 80"/></g><g fill="#fff"><circle cx="136" cy="70" r="3"/><circle cx="146" cy="60" r="3"/><circle cx="158" cy="58" r="3"/><circle cx="168" cy="64" r="3"/><circle cx="174" cy="80" r="3"/><circle cx="150" cy="92" r="3"/></g><text x="20" y="30" font-size="11" fill="#f472b6" font-family="Inter" font-weight="700">HAND SKELETON · 21 pts</text><text x="56" y="128" font-size="9" fill="#666" font-family="Inter">face ignored</text></svg>';
    }
    function dots(cx, cy) { var o = ''; for (var i = 0; i < 40; i++) { var a = i * 2.4, r = 6 + (i * 37 % 30); o += '<circle cx="' + (cx + Math.cos(a) * r * 0.9) + '" cy="' + (cy + Math.sin(a) * r * 1.1) + '" r="1.2" fill="#22d3ee"/>'; } return o; }
    sl.onclick = function (e) {
      var r = sl.getBoundingClientRect(); mode = e.clientX - r.left < r.width / 2 ? 'face' : 'hands';
      sl.dataset.mode = mode; paint(); D.sound.beep(mode === 'face' ? 620 : 820, 0.06, 'sine', 0.05);
      if (mode === 'hands') seen.hands = true; else if (seen.hands) seen.face = true;
      if (seen.hands && seen.face) ok();
    };
    paint();
    play.appendChild(sl); play.appendChild(illus);
    var cam = D.el('div', { class: 'tut-note', html: D.icon('lock') + '<span>Your camera image is analysed on this computer only. Nothing is uploaded or recorded.</span>' });
    play.appendChild(cam);
  }

  /* ================================================================ 5 · Gestures change faces */
  function stepGestures(body, ok) {
    var tried = {};
    var play = split(body,
      '<p>In HANDS mode, every gesture is mapped to an expression. This <b>gesture chart</b> is also in Echo, where you can test it with your real hand and even remap it.</p><p>In FACE mode Echo reads your real expression instead — try it after Boot Camp!</p>',
      'Click <b>three different gestures</b> and watch the robot’s face change.');
    var g = D.el('div', { class: 'tut-gest' });
    var fh = D.el('div', { class: 'tut-face' });
    g.appendChild(fh);
    var chart = D.el('div', { class: 'tut-chart' });
    ['thumbs_up', 'thumbs_down', 'fist', 'victory', 'point', 'love', 'ok', 'call'].forEach(function (k) {
      var G = D.vision.GESTURES[k], X = D.EXPRESSIONS[G.expr];
      var b = D.el('button', { class: 'tut-gbtn', html: '<span class="em">' + G.emoji + '</span><b>' + G.label + '</b><small>→ ' + X.emoji + ' ' + X.label + '</small>' });
      b.onclick = function () {
        face.setExpression(G.expr); face.say(X.line, 1800); tried[k] = 1; b.classList.add('on');
        D.sound.beep(760, 0.05, 'sine', 0.04);
        if (Object.keys(tried).length >= 3) ok();
      };
      chart.appendChild(b);
    });
    g.appendChild(chart);
    play.appendChild(g);
    var face = new D.RobotFace(fh, { name: 'ECHO' });
    cleanup.push(function () { face.destroy(); });
  }

  /* ================================================================ 6 · Maze */
  function stepMaze(body, ok) {
    var generated = false, shape = 'square';
    var play = split(body,
      '<p><b>Theseus</b> lives in mazes. A maze is really a <b>graph</b>: cells are nodes, open passages are edges. Search algorithms like <b>A*</b> explore that graph to find the shortest way out.</p><p>In the full Maze Lab you can make square, <b>circular</b> and hexagonal mazes, move the start and goal, break walls, add mud and compare 7 algorithms.</p>',
      'Press <b>Generate</b> to build a maze, then <b>Solve</b> to watch Theseus explore it and find the exit.');
    var bar = D.el('div', { class: 'row', style: { marginBottom: '8px' } });
    var seg = D.ui.seg([['square', 'Square', 'grid'], ['circle', 'Circular', 'circle']], 'square', function (v) { shape = v; gen(); });
    bar.appendChild(seg);
    bar.appendChild(D.el('button', { class: 'btn', html: D.icon('dice') + 'Generate', onclick: gen }));
    var solveB = D.el('button', { class: 'btn primary', html: D.icon('route') + 'Solve', onclick: solve });
    bar.appendChild(solveB);
    play.appendChild(bar);
    var stg = D.el('div', { class: 'stage tut-mstage' });
    var cv = D.el('canvas'); stg.appendChild(cv); play.appendChild(stg);
    var info = D.el('div', { class: 'small muted', style: { marginTop: '6px' }, text: 'Green = start · flag = goal' });
    play.appendChild(info);
    var m, view, ends, busy = false;
    function gen() {
      if (busy) return;
      m = shape === 'circle' ? D.Maze.create({ shape: 'circle', rings: 6 }) : D.Maze.create({ shape: 'square', cols: 12, rows: 7 });
      D.Maze.generate(m, 'backtracker', Math.floor(Math.random() * 1e9));
      ends = D.Maze.defaults(m);
      if (!view) { view = new D.MazeView(cv, m, { padding: 12 }); cleanup.push(function () { view.stop(); if (view.destroy) view.destroy(); }); } else view.setMaze(m);
      view.set({ start: ends.start, goal: ends.goal, path: null, visited: null, resetRobot: true });
      view.setRobot(ends.start, true);
      generated = true; D.sound.click();
      info.textContent = m.cells.length + ' cells generated with the recursive backtracker. Now press Solve!';
    }
    function solve() {
      if (!generated) { D.ui.toast('Generate a maze first.', 'warn'); return; }
      if (busy) return; busy = true;
      var r = D.Maze.solve(m, ends.start, ends.goal, 'astar');
      view.setRobot(ends.start, true);
      view.set({ path: null, visited: null });
      view.animateVisited(r.visitedOrder, 12).then(function () {
        view.set({ path: r.path });
        return view.animatePath(r.path, 70);
      }).then(function () {
        busy = false; D.sound.win();
        info.innerHTML = 'A* explored <b>' + r.explored + '</b> cells and found a route of <b>' + (r.path.length - 1) + '</b> steps.';
        ok();
      });
    }
    setTimeout(gen, 30);
  }

  /* ================================================================ 7 · Finish */
  function stepFinish(body, ok) {
    var play = split(body,
      '<p>Almost done! A few things to remember:</p>' +
      '<ul class="tut-list"><li>Every screen has <b>How to use</b> and <b>About</b> buttons with illustrated guides (or press <kbd>F1</kbd>).</li><li>The <b>Audit log</b> records everything you do — missions, camera sessions, mazes and game scores — and exports CSV, JSON or a PDF report.</li><li>The <b>Arcade</b> has 7 games, including Mine Sweeper Bot, Mirror Me and Gesture Simon.</li></ul>',
      'Pick your theme. You can change it any time at the bottom of the sidebar.');
    var picks = D.el('div', { class: 'theme-picks', style: { borderBottom: 0 } });
    [['light', 'Light'], ['dark', 'Dark'], ['black', 'Black'], ['system', 'System']].forEach(function (t) {
      var b = D.el('button', { class: 'theme-pick', dataset: { t: t[0] } }, D.el('div', { class: 'tp-prev tp-' + t[0], html: '<i></i><i></i><i></i>' }), D.el('b', { text: t[1] }));
      b.onclick = function () { D.settings.set('theme', t[0]); D.$$('.theme-pick', picks).forEach(function (x) { x.classList.toggle('on', x === b); }); ok(); };
      picks.appendChild(b);
    });
    play.appendChild(picks);
    var nm = D.el('input', { class: 'input', placeholder: 'Your name (optional)', value: D.settings.get('playerName') || '', style: { width: '100%', marginTop: '10px' } });
    nm.onchange = function () { D.settings.set('playerName', nm.value.trim()); };
    play.appendChild(nm);
  }

  function certificate() {
    var name = D.settings.get('playerName');
    var c = D.el('div', { class: 'tut-cert' },
      D.el('div', { class: 'tut-cert-face' }),
      D.el('div', { class: 'eyebrow', text: 'Certificate of completion' }),
      D.el('h2', { html: (name ? D.esc(name) + ' is' : 'You are') + ' now a certified<br>robot operator!' }),
      D.el('p', { class: 'muted', text: 'Boot Camp complete · ' + new Date().toLocaleDateString() }));
    var m = D.ui.modal(c, { actions: [{ label: 'Explore Echo (camera)', kind: '', onClick: function () { D.router.go('echo'); } }, { label: 'Start Argus missions', kind: 'primary', onClick: function () { D.router.go('argus'); } }] });
    var f = new D.RobotFace(D.$('.tut-cert-face', m.box), { name: 'ECHO' }); f.setExpression('excited');
    confetti();
  }
  function confetti() {
    var cv = D.el('canvas', { style: { position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 300 } });
    document.body.appendChild(cv);
    var g = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
    var cols = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'];
    var P = []; for (var i = 0; i < 160; i++) P.push({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4, r: Math.random() * 6, c: cols[i % 5], a: Math.random() * 6 });
    var t0 = performance.now();
    (function f() {
      g.clearRect(0, 0, cv.width, cv.height);
      P.forEach(function (p) { p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.a += 0.2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-4, -2, 8, 4 + p.r); g.restore(); });
      if (performance.now() - t0 < 3200) requestAnimationFrame(f); else cv.remove();
    })();
  }

  D.tutorial = { ensure: ensure, start: start, isDone: function () { return !!D.store.get(KEY, false); } };
})(window);
