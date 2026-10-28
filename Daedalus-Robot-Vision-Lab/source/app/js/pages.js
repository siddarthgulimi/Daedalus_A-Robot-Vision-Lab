/* pages.js — Home, Help center and Settings. */
(function (global) {
  'use strict';
  var D = global.D;

  /* ================================================================ HOME */
  var homeFace = null, homeEls = {};
  function mountHome(root) {
    root.appendChild(D.ui.pageHead({ title: 'Home', icon: 'home', sub: 'Your robot vision lab — pick a robot to start.', guide: 'home' }));
    var body = D.el('div', { class: 'page-body' });
    root.appendChild(body);

    var hero = D.el('div', { class: 'home-hero' });
    var name = D.settings.get('playerName');
    var hc = D.el('div', { class: 'hero-card' },
      D.el('div', { class: 'eyebrow', text: 'Daedalus · Robot Vision Lab' }),
      D.el('h1', { html: (name ? 'Welcome back, ' + D.esc(name) + '.<br>' : '') + 'Robots that <span>see you</span>,<br>think, and move.' }),
      D.el('p', { class: 'muted', style: { maxWidth: '520px', fontSize: '14.5px' }, html: 'Teach <b>Argus</b> a route with command cards, let <b>Echo</b> copy your face and react to your hand gestures through the camera, and watch <b>Theseus</b> escape circular and hexagonal mazes.' }));
    var cta = D.el('div', { class: 'row wrap', style: { marginTop: '18px' } },
      D.el('button', { class: 'btn primary lg', html: D.icon('echo') + 'Try computer vision', onclick: function () { D.router.go('echo'); } }),
      D.el('button', { class: 'btn lg', html: D.icon('argus') + 'Start a mission', onclick: function () { D.router.go('argus'); } }),
      D.el('button', { class: 'btn ghost lg', html: D.icon('reset') + 'Replay Boot Camp', onclick: function () { D.tutorial.start(true); } }));
    hc.appendChild(cta);
    hero.appendChild(hc);
    var hf = D.el('div', { class: 'hero-face' });
    homeEls.faceBox = D.el('div', { style: { width: '78%', height: '100%', padding: '18px 0' } });
    hf.appendChild(homeEls.faceBox);
    homeEls.moods = D.el('div', { class: 'home-moods' });
    ['happy', 'surprised', 'thinking', 'love', 'excited'].forEach(function (k) {
      homeEls.moods.appendChild(D.el('button', { class: 'ec-libbtn', style: { '--ec': D.EXPRESSIONS[k].color }, html: '<span>' + D.EXPRESSIONS[k].emoji + '</span>', title: D.EXPRESSIONS[k].label, onclick: function () { homeFace.setExpression(k); homeFace.say(D.EXPRESSIONS[k].line, 2000); } }));
    });
    hf.appendChild(homeEls.moods);
    hero.appendChild(hf);
    body.appendChild(hero);

    var cards = D.el('div', { class: 'robot-cards' });
    [
      { id: 'argus', name: 'Argus', tag: 'Path studio', color: '--accent', text: 'Program a route with big numbered command cards. The grid previews every card’s path before you run it. 5 missions + free play.', art: argusArt() },
      { id: 'echo', name: 'Echo', tag: 'Vision robot', color: '--violet', text: 'Computer vision: Echo mirrors your face and reads 9 expressions — or switch the slider to HANDS and control it with 11 gestures.', art: '<div style="width:110px;height:110px">' + D.avatar('echo') + '</div>' },
      { id: 'theseus', name: 'Theseus', tag: 'Maze lab', color: '--amber', text: 'Generate square, circular and hex mazes, move the start and goal, break walls, add mud — then race 7 search algorithms.', art: mazeArt() },
      { id: 'arcade', name: 'Arcade', tag: '7 games', color: '--pink', text: 'Mine Sweeper Bot, Snake Bot, Mirror Me, Gesture Simon, Gesture Pilot, Gem Rush and Labyrinth Race.', art: '<div style="width:110px;height:110px">' + D.avatar('arcade') + '</div>' }
    ].forEach(function (r) {
      var c = D.el('div', { class: 'card hover robot-card', onclick: function () { D.router.go(r.id); } },
        D.el('div', { class: 'art', html: r.art }),
        D.el('h3', { html: r.name + ' <span class="chip" style="color:var(' + r.color + ')">' + r.tag + '</span>' }),
        D.el('p', { html: r.text }),
        D.el('div', { class: 'row', style: { marginTop: 'auto' } }, D.el('span', { class: 'spacer' }), D.el('span', { class: 'small', style: { color: 'var(' + r.color + ')', fontWeight: 600 }, html: 'Open →' })));
      cards.appendChild(c);
    });
    body.appendChild(cards);

    var lower = D.el('div', { class: 'home-lower' });
    homeEls.stats = D.el('div', { class: 'grid-4' });
    lower.appendChild(homeEls.stats);
    var act = D.el('div', { class: 'panel' });
    act.appendChild(D.el('div', { class: 'panel-head', html: '<span class="eyebrow">Recent activity</span><button class="btn xs ghost" onclick="D.router.go(\'audit\')">Open audit log →</button>' }));
    homeEls.recent = D.el('div', { class: 'home-recent' });
    act.appendChild(homeEls.recent);
    lower.appendChild(act);
    body.appendChild(lower);

    homeFace = new D.RobotFace(homeEls.faceBox, { name: 'ECHO' });
    homeFace.setExpression('happy');
    root.addEventListener('mousemove', function (e) {
      var r = homeEls.faceBox.getBoundingClientRect();
      homeFace.lookAt(D.clamp((e.clientX - (r.left + r.width / 2)) / 500, -1, 1), D.clamp((e.clientY - (r.top + r.height / 2)) / 400, -1, 1));
    });
    D.bus.on('audit', function () { if (D.router.current() === 'home') renderHomeData(); });
  }
  function argusArt() {
    var s = '<svg viewBox="0 0 160 110">';
    for (var y = 0; y < 5; y++) for (var x = 0; x < 8; x++) s += '<rect x="' + (8 + x * 18) + '" y="' + (8 + y * 19) + '" width="17" height="18" rx="2" fill="' + ((x === 3 && y > 0 && y < 4) ? 'var(--grid-wall)' : 'var(--grid-floor)') + '" stroke="var(--grid-line)"/>';
    s += '<path d="M17 36 H53 V93 H125 V36" stroke="#22d3ee" stroke-width="3" stroke-dasharray="5 4" fill="none"/>';
    s += D.guide.art.bot(17, 36, 14, 90) + D.guide.art.flag(125, 38);
    return s + '</svg>';
  }
  function mazeArt() {
    var s = '<svg viewBox="0 0 110 110"><g fill="none" stroke="var(--grid-wall)" stroke-width="3" stroke-linecap="round">';
    s += '<circle cx="55" cy="55" r="48"/><path d="M55 7 A48 48 0 0 1 103 55" stroke="var(--bg-2)" stroke-width="5"/>';
    s += '<path d="M55 21 A34 34 0 1 1 21 55"/><path d="M55 35 A20 20 0 1 0 75 55"/><path d="M55 7v14M89 55h14M55 75v14M21 55h-14" />';
    s += '</g><path d="M96 34 A46 46 0 0 1 55 101 A40 40 0 0 1 16 60 A28 28 0 0 1 55 28 A13 13 0 0 1 66 55" stroke="var(--amber)" stroke-width="2.5" fill="none" stroke-dasharray="4 3"/><circle cx="55" cy="55" r="5" fill="var(--green)"/></svg>';
    return s;
  }
  function renderHomeData() {
    var all = D.audit.all(), today = new Date().toDateString();
    var todayN = all.filter(function (e) { return new Date(e.t).toDateString() === today; }).length;
    var stars = D.store.get('argus.missions', {}), starN = 0; for (var k in stars) starN += stars[k];
    var visions = all.filter(function (e) { return e.a === 'Vision session summary'; }).length;
    var mazes = all.filter(function (e) { return e.m === 'theseus' && /solv|Solv/.test(e.a); }).length;
    var games = all.filter(function (e) { return e.m === 'arcade' && e.a === 'Score'; }).length;
    homeEls.stats.innerHTML = '';
    [[todayN, 'actions today', 'audit'], [starN + ' / 15', 'mission stars', 'star'], [visions, 'camera sessions', 'camera'], [mazes + games, 'mazes solved + games', 'trophy']].forEach(function (s) {
      homeEls.stats.appendChild(D.el('div', { class: 'stat' }, D.el('div', { class: 'row' }, D.el('div', { class: 'k grow', text: s[1] }), D.el('span', { class: 'faint', html: D.icon(s[2]), style: { width: '18px', height: '18px', display: 'inline-flex' } })), D.el('div', { class: 'v', text: String(s[0]) })));
    });
    var recent = all.slice(-7).reverse();
    homeEls.recent.innerHTML = recent.length ? '' : '<div class="empty small">No activity yet.</div>';
    recent.forEach(function (e) {
      var m = D.audit.MODULES[e.m] || D.audit.MODULES.app;
      homeEls.recent.appendChild(D.el('div', { class: 'home-ev' }, D.el('i', { style: { background: 'var(' + m.color + ')' } }), D.el('span', { class: 'grow', html: '<b>' + D.esc(e.a) + '</b> <span class="faint">' + D.esc(e.d).slice(0, 70) + '</span>' }), D.el('span', { class: 'faint small', text: new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })));
    });
  }
  D.router.register('home', { title: 'Home', icon: 'home', mount: mountHome, show: renderHomeData });

  /* ================================================================ HELP */
  function mountHelp(root) {
    root.appendChild(D.ui.pageHead({ title: 'Help center', icon: 'help', sub: 'Every guide in one place, plus answers to common questions.', guide: 'help' }));
    var body = D.el('div', { class: 'page-body' });
    root.appendChild(body);
    var boot = D.el('div', { class: 'hero-card', style: { marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '18px' } },
      D.el('div', { style: { width: '80px', height: '80px', flex: 'none' }, html: D.avatar('echo') }),
      D.el('div', { class: 'grow' }, D.el('div', { class: 'eyebrow', text: 'Boot Camp' }), D.el('h2', { text: 'The 7-step interactive tutorial' }), D.el('p', { class: 'muted', style: { margin: '4px 0 0' }, text: 'Placing cards, moving the goal, the FACE / HANDS slider, gestures, mazes and themes — in about five minutes.' })),
      D.el('button', { class: 'btn primary lg', html: D.icon('play') + 'Replay Boot Camp', onclick: function () { D.tutorial.start(true); } }));
    body.appendChild(boot);
    body.appendChild(D.el('h3', { text: 'All guides', style: { margin: '6px 0 12px' } }));
    var grid = D.el('div', { class: 'help-grid' });
    body.appendChild(grid);
    body.appendChild(D.el('h3', { text: 'Frequently asked questions', style: { margin: '24px 0 12px' } }));
    var faq = D.el('div', { class: 'faq' });
    [
      ['The camera does not start.', 'Close other apps that may be using the webcam (Teams, Zoom, the Windows Camera app). In Windows Settings → Privacy &amp; security → Camera, allow desktop apps to use the camera. If you have several cameras, choose one in <b>Settings</b>.'],
      ['Expressions are detected wrongly.', 'Face the camera with even light and press <b>Calibrate</b> in Echo while keeping a relaxed face. You can also raise or lower <b>Expression sensitivity</b> in Settings.'],
      ['My hand gesture is not recognised.', 'Keep the whole hand in view, palm facing the camera, about an arm’s length away. Hold the gesture still for half a second. The finger diagram in Echo shows which fingers the camera thinks are up.'],
      ['Does any video leave my computer?', 'No. The AI models are bundled with the app and run offline. Video frames are analysed and immediately discarded.'],
      ['Why can’t I edit the map in a mission?', 'Mission maps are fixed so stars are fair. Switch Argus to <b>Free play</b> to move the start, the goal, walls and gems.'],
      ['How do I make a circular maze?', 'Open Theseus, choose <b>Circular</b> in the Shape selector and press Generate. Circular mazes are solved from the outer rim to the centre by default — you can move both points.'],
      ['Where is my data stored?', 'Settings, progress, scores and the audit log are stored locally in the app’s profile folder. Use the Audit log’s export buttons to keep a copy.'],
      ['How do I uninstall?', 'Windows Settings → Apps → Installed apps → Daedalus → Uninstall.']
    ].forEach(function (q) {
      var d = D.el('details', { class: 'faq-item' }, D.el('summary', { html: q[0] }), D.el('p', { class: 'muted', html: q[1] }));
      faq.appendChild(d);
    });
    body.appendChild(faq);
    body.appendChild(D.el('h3', { text: 'Keyboard shortcuts', style: { margin: '24px 0 12px' } }));
    body.appendChild(D.el('div', { class: 'panel panel-body', html: '<div class="kv"><dt><kbd>F1</kbd></dt><dd>Open the guide for the current screen</dd><dt><kbd>F11</kbd></dt><dd>Full screen</dd><dt><kbd>↑ ← → ↓</kbd> / <kbd>WASD</kbd></dt><dd>Argus: drive and record cards · Games: move</dd><dt><kbd>Space</kbd></dt><dd>Argus: run / pause</dd><dt><kbd>Backspace</kbd></dt><dd>Argus: remove the last card</dd><dt><kbd>Esc</kbd></dt><dd>Close a guide or dialog</dd></div>' }));
    body.appendChild(D.el('p', { class: 'faint small', style: { marginTop: '18px' }, html: D.APP_FULL + ' · version ' + D.VERSION + ' · Computer vision by Google MediaPipe (Apache 2.0), running offline.' }));
    mountHelp.grid = grid;
  }
  function showHelp() {
    var grid = mountHelp.grid; grid.innerHTML = '';
    var order = ['home', 'argus', 'echo', 'theseus', 'arcade'];
    var list = D.guide.list().sort(function (a, b) {
      var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 50 : ia) - (ib < 0 ? 50 : ib);
    });
    list.forEach(function (g) {
      grid.appendChild(D.el('div', { class: 'card help-card' },
        D.el('div', { class: 'row' }, D.el('div', { class: 'help-badge', html: g.badge || D.icon(g.icon || 'book') }), D.el('b', { class: 'grow', text: g.title })),
        D.el('div', { class: 'small faint', text: (g.howto || []).length + ' illustrated steps' }),
        D.el('div', { class: 'row' },
          D.el('button', { class: 'btn sm', html: D.icon('book') + 'How to use', onclick: function () { D.guide.open(g.id, 'howto'); } }),
          D.el('button', { class: 'btn sm ghost', html: D.icon('info') + 'About', onclick: function () { D.guide.open(g.id, 'about'); } }))));
    });
  }
  D.router.register('help', { title: 'Help center', icon: 'help', mount: mountHelp, show: showHelp });

  /* ================================================================ SETTINGS */
  function mountSettings(root) {
    root.appendChild(D.ui.pageHead({ title: 'Settings', icon: 'settings', sub: 'Appearance, camera & vision, sound and data.', guide: 'settings' }));
    var body = D.el('div', { class: 'page-body' });
    root.appendChild(body);
    var wrap = D.el('div', { class: 'set-wrap' });
    body.appendChild(wrap);

    function section(title, icon, desc) {
      var s = D.el('div', { class: 'panel set-sec' });
      s.appendChild(D.el('div', { class: 'panel-head', html: D.icon(icon) + '<h3>' + title + '</h3>' + (desc ? '<span class="small faint" style="margin-left:auto">' + desc + '</span>' : '') }));
      var b = D.el('div', { class: 'panel-body set-body' }); s.appendChild(b); wrap.appendChild(s); return b;
    }
    function row(label, hint, control) {
      return D.el('div', { class: 'set-row' }, D.el('div', { class: 'grow' }, D.el('b', { text: label }), hint ? D.el('div', { class: 'small faint', html: hint }) : null), control);
    }

    /* Appearance */
    var ap = section('Appearance', 'sun');
    var themes = D.el('div', { class: 'theme-picks' });
    [['light', 'Light', 'White and bright'], ['dark', 'Dark', 'Deep navy'], ['black', 'Black', 'Pure black (OLED)'], ['system', 'System', 'Follow Windows']].forEach(function (t) {
      var b = D.el('button', { class: 'theme-pick' + (D.settings.get('theme') === t[0] ? ' on' : ''), dataset: { t: t[0] } },
        D.el('div', { class: 'tp-prev tp-' + t[0], html: '<i></i><i></i><i></i>' }), D.el('b', { text: t[1] }), D.el('span', { class: 'small faint', text: t[2] }));
      b.onclick = function () { D.settings.set('theme', t[0]); };
      themes.appendChild(b);
    });
    D.bus.on('settings', function (e) { if (e.key === 'theme') D.$$('.theme-pick', themes).forEach(function (x) { x.classList.toggle('on', x.dataset.t === e.value); }); });
    ap.appendChild(themes);
    var sw = D.el('div', { class: 'row' });
    Object.keys(D.theme.ACCENTS).forEach(function (a) {
      var b = D.el('button', { class: 'swatch' + (D.settings.get('accent') === a ? ' on' : ''), title: a, style: { background: D.theme.ACCENTS[a].dark[0] } });
      b.onclick = function () { D.settings.set('accent', a); D.$$('.swatch', sw).forEach(function (x) { x.classList.toggle('on', x === b); }); };
      sw.appendChild(b);
    });
    ap.appendChild(row('Accent colour', 'Used for buttons, paths and highlights.', sw));
    ap.appendChild(row('Reduce motion', 'Turn off most animations.', D.ui.switchEl(D.settings.get('reduceMotion'), function (v) { D.settings.set('reduceMotion', v); })));
    var nm = D.el('input', { class: 'input', value: D.settings.get('playerName') || '', placeholder: 'Your name', style: { width: '200px' } });
    nm.onchange = function () { D.settings.set('playerName', nm.value.trim()); };
    ap.appendChild(row('Your name', 'Shown on Home and on reports.', nm));

    /* Camera */
    var cv = section('Camera & computer vision', 'camera', 'Everything runs offline');
    var camSel = D.el('select', { class: 'input', style: { width: '260px' } });
    camSel.appendChild(D.el('option', { value: '', text: 'Default camera' }));
    camSel.onchange = function () { D.settings.set('cameraId', camSel.value); };
    var refresh = D.el('button', { class: 'btn sm', html: D.icon('reset') + 'Find cameras', onclick: function () { loadCams(camSel, true); } });
    cv.appendChild(row('Camera', 'Pick which webcam to use. Click “Find cameras” if yours is missing.', D.el('div', { class: 'row' }, camSel, refresh)));
    loadCams(camSel, false);
    cv.appendChild(row('Processing', 'GPU is faster; switch to CPU if the camera view freezes. Takes effect after restarting the app.', D.ui.seg([['GPU', 'GPU'], ['CPU', 'CPU']], D.settings.get('cvDelegate'), function (v) { D.settings.set('cvDelegate', v); })));
    cv.appendChild(row('Show tracking points', 'Draw the face mesh / hand skeleton over the video.', D.ui.switchEl(D.settings.get('showLandmarks') !== false, function (v) { D.settings.set('showLandmarks', v); })));
    var sens = D.el('input', { type: 'range', min: 0.6, max: 1.8, step: 0.1, value: D.settings.get('sensitivity') || 1, style: { width: '200px' } });
    var sensV = D.el('b', { class: 'mono', text: (+sens.value).toFixed(1) + '×' });
    sens.oninput = function () { sensV.textContent = (+sens.value).toFixed(1) + '×'; };
    sens.onchange = function () { D.settings.set('sensitivity', +sens.value); };
    cv.appendChild(row('Expression sensitivity', 'Higher = Echo reacts to smaller facial movements.', D.el('div', { class: 'row' }, sens, sensV)));
    var hold = D.el('input', { type: 'range', min: 150, max: 900, step: 50, value: D.settings.get('holdMs') || 350, style: { width: '200px' } });
    var holdV = D.el('b', { class: 'mono', text: hold.value + ' ms' });
    hold.oninput = function () { holdV.textContent = hold.value + ' ms'; };
    hold.onchange = function () { D.settings.set('holdMs', +hold.value); };
    cv.appendChild(row('Gesture hold time', 'How long a hand gesture must be held before it counts.', D.el('div', { class: 'row' }, hold, holdV)));
    cv.appendChild(row('Face calibration', 'Forget the neutral-face baseline captured in Echo.', D.el('button', { class: 'btn sm', html: D.icon('reset') + 'Reset calibration', onclick: function () { D.vision.clearCalibration(); D.ui.toast('Calibration cleared.', 'good'); D.audit.log('settings', 'Reset face calibration', ''); } })));

    /* Sound */
    var sd = section('Sound', 'volume');
    sd.appendChild(row('Robot sounds', 'Short beeps for moves, bumps and wins.', D.ui.switchEl(D.settings.get('sound'), function (v) { D.settings.set('sound', v); if (v) D.sound.good(); })));

    /* Data */
    var dt = section('Tutorial & data', 'layers');
    dt.appendChild(row('Boot Camp tutorial', 'Replay the interactive 7-step tutorial.', D.el('button', { class: 'btn sm primary', html: D.icon('play') + 'Replay', onclick: function () { D.tutorial.start(true); } })));
    dt.appendChild(row('Reset all progress', 'Clears missions, scores, saved maps, settings and the audit log. The tutorial will run again.', D.el('button', { class: 'btn sm danger', html: D.icon('trash') + 'Reset everything', onclick: function () {
      D.ui.confirm('Reset everything?', 'This deletes all progress, scores, saved worlds, settings and the audit log on this computer. It cannot be undone.', 'Reset', true).then(function (ok) {
        if (!ok) return; D.store.clearAll(); location.reload();
      });
    } })));
    var info = D.el('div', { class: 'small faint', style: { marginTop: '6px' }, html: D.APP_FULL + ' · v' + D.VERSION });
    dt.appendChild(info);
    if (global.desktop && global.desktop.info) global.desktop.info().then(function (i) { info.innerHTML += ' · Electron ' + i.electron + ' · ' + i.platform + '<br>Data folder: <span class="mono">' + D.esc(i.userData) + '</span>'; });
  }
  function loadCams(sel, ask) {
    var p = Promise.resolve();
    if (ask && navigator.mediaDevices) p = navigator.mediaDevices.getUserMedia({ video: true }).then(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); }).catch(function () {});
    p.then(D.vision.listCameras).then(function (cams) {
      var cur = D.settings.get('cameraId');
      sel.innerHTML = ''; sel.appendChild(D.el('option', { value: '', text: 'Default camera' }));
      cams.forEach(function (c, i) { sel.appendChild(D.el('option', { value: c.deviceId, text: c.label || ('Camera ' + (i + 1)) })); });
      sel.value = cur || '';
      if (ask) D.ui.toast(cams.length + ' camera' + (cams.length === 1 ? '' : 's') + ' found.', cams.length ? 'good' : 'warn');
    });
  }
  D.router.register('settings', { title: 'Settings', icon: 'settings', mount: mountSettings });
})(window);
