/* arcade.js — the Arcade hub. Games register themselves with D.arcade.register(def).
   def = { id, title, tagline, icon, color ('--pink'), cv: null|'face'|'hands', controls,
           guide: { howto:[{title,text,svg}], tips, about:{hero,intro,facts,sections} },
           create(host, ctx) → { destroy() } }
   ctx = { id, reportScore(score, detail), best(), toast(msg, kind) }
*/
(function (global) {
  'use strict';
  var D = global.D;
  var games = [], byId = {};
  var page = null, hubEl = null, gridEl = null, viewEl = null, active = null;

  function bestOf(id) { var v = D.store.get('arcade.best.' + id, null); return typeof v === 'number' ? v : null; }

  D.arcade = {
    register: function (def) {
      if (!def || !def.id) return;
      if (byId[def.id]) games = games.filter(function (g) { return g.id !== def.id; });
      byId[def.id] = def; games.push(def);
      var g = def.guide || {};
      D.guide.register('game-' + def.id, { title: def.title, icon: def.icon || 'arcade', howto: g.howto || [], tips: g.tips, about: g.about || {} });
      if (gridEl) renderGrid();
    },
    list: function () { return games.slice(); },
    get: function (id) { return byId[id]; },
    best: bestOf,
    play: function (id) { D.router.go('arcade', id); },
    current: function () { return active ? active.def.id : null; },
    instance: function () { return active ? active.inst : null; },
    close: function () { close(); }
  };

  /* Shared helpers for games */
  D.arcade.util = {
    /* size a canvas for crisp drawing; returns 2D context scaled to CSS pixels */
    fit: function (canvas, w, h) {
      var r = global.devicePixelRatio || 1;
      canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      var c = canvas.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0); return c;
    },
    colors: function () {
      var v = D.cssVar;
      return { floor: v('--grid-floor'), line: v('--grid-line'), wall: v('--grid-wall'), wallTop: v('--grid-wall-top'), accent: v('--accent'),
        text: v('--text'), text2: v('--text-2'), text3: v('--text-3'), surface: v('--surface'), surface2: v('--surface-2'), surface3: v('--surface-3'),
        bg: v('--bg-2'), green: v('--green'), red: v('--red'), amber: v('--amber'), violet: v('--violet'), pink: v('--pink'), blue: v('--blue'), lineStrong: v('--line-2') };
    },
    rr: function (c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); },
    /* Argus-style robot sprite; angle in radians (0 = facing right/east) */
    bot: function (c, x, y, s, angle, color, mood) {
      var U = D.arcade.util;
      c.save(); c.translate(x, y); c.rotate(angle || 0);
      c.fillStyle = 'rgba(0,0,0,.25)'; U.rr(c, -s * .46 + 2, -s * .46 + 3, s * .92, s * .92, s * .22); c.fill();
      c.fillStyle = '#334155'; U.rr(c, -s * .42, -s * .5, s * .7, s * .16, s * .06); c.fill(); U.rr(c, -s * .42, s * .34, s * .7, s * .16, s * .06); c.fill();
      c.fillStyle = color || '#22d3ee'; U.rr(c, -s * .4, -s * .4, s * .8, s * .8, s * .2); c.fill();
      c.fillStyle = '#06101a'; U.rr(c, -s * .08, -s * .3, s * .38, s * .6, s * .12); c.fill();
      var eyeC = mood === 'hurt' ? '#f87171' : mood === 'happy' ? '#34d399' : '#e0f7ff';
      c.fillStyle = eyeC;
      if (mood === 'happy') { c.lineWidth = s * .06; c.strokeStyle = eyeC; c.beginPath(); c.arc(s * .12, -s * .12, s * .07, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(s * .12, s * .12, s * .07, Math.PI, 0); c.stroke(); }
      else { c.beginPath(); c.arc(s * .13, -s * .12, s * .065, 0, 7); c.fill(); c.beginPath(); c.arc(s * .13, s * .12, s * .065, 0, 7); c.fill(); }
      c.fillStyle = '#fff'; c.globalAlpha = .7; c.beginPath(); c.arc(s * .44, 0, s * .05, 0, 7); c.fill(); c.globalAlpha = 1;
      c.restore();
    },
    /* camera preview block shared by vision games */
    cameraBox: function () {
      var box = D.el('div', { class: 'ar-camera' });
      var v = D.el('video', { autoplay: true, muted: true, playsinline: true });
      var cv = D.el('canvas');
      var note = D.el('div', { class: 'ar-camnote', text: 'Camera off' });
      box.appendChild(v); box.appendChild(cv); box.appendChild(note);
      return { el: box, video: v, canvas: cv, note: note };
    }
  };

  function makeCtx(def) {
    return {
      id: def.id,
      best: function () { return bestOf(def.id); },
      toast: function (m, k) { D.ui.toast(m, k); },
      reportScore: function (score, detail) {
        score = Math.round(score || 0);
        var prev = bestOf(def.id);
        var isBest = prev == null || score > prev;
        if (isBest) D.store.set('arcade.best.' + def.id, score);
        D.audit.log('arcade', 'Score', def.title + ': ' + score + (detail ? ' · ' + detail : '') + (isBest ? ' (new best)' : ''), isBest ? 'success' : 'info', { game: def.id, score: score });
        if (isBest && score > 0) { D.ui.toast('New best in ' + D.esc(def.title) + ': <b>' + score + '</b>', 'good'); D.sound.win(); }
        updateBest();
        return isBest;
      }
    };
  }

  function cvChip(def) {
    if (def.cv === 'face') return '<span class="chip violet">' + D.icon('face') + 'Face vision</span>';
    if (def.cv === 'hands') return '<span class="chip accent">' + D.icon('hand') + 'Hand vision</span>';
    return '';
  }

  function art(def) {
    var c = 'var(' + (def.color || '--accent') + ')';
    return '<svg viewBox="0 0 200 110"><defs><radialGradient id="arg_' + def.id + '" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="' + c + '" stop-opacity=".35"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="200" height="110" fill="url(#arg_' + def.id + ')"/>' +
      '<g opacity=".25" stroke="' + c + '">' + (function () { var s = ''; for (var i = 0; i < 10; i++) s += '<path d="M' + (i * 22) + ' 0V110"/>'; for (var j = 0; j < 6; j++) s += '<path d="M0 ' + (j * 22) + 'H200"/>'; return s; })() + '</g>' +
      '<g transform="translate(100 55) scale(2.6) translate(-12 -12)" stroke="' + c + '" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + D.icon(def.icon || 'arcade').replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g></svg>';
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    games.forEach(function (def) {
      var b = bestOf(def.id);
      var card = D.el('div', { class: 'card ar-card', style: { '--ar-c': 'var(' + (def.color || '--accent') + ')' } });
      card.appendChild(D.el('div', { class: 'ar-art', html: art(def) }));
      card.appendChild(D.el('div', { class: 'ar-title' }, D.el('h3', { text: def.title }), D.el('span', { class: 'ar-best mono', html: D.icon('trophy') + (b == null ? '—' : b) })));
      card.appendChild(D.el('p', { class: 'ar-tag', text: def.tagline || '' }));
      card.appendChild(D.el('div', { class: 'row wrap ar-chips', html: cvChip(def) + (def.controls ? '<span class="chip">' + (def.cv ? '' : D.icon('keyboard')) + D.esc(def.controls) + '</span>' : '') }));
      var actions = D.el('div', { class: 'row ar-actions' });
      actions.appendChild(D.el('button', { class: 'btn primary sm', html: D.icon('play') + 'Play', onclick: function () { open(def.id); } }));
      actions.appendChild(D.el('span', { class: 'spacer' }));
      actions.appendChild(D.el('button', { class: 'btn sm ghost', title: 'How to play', html: D.icon('book'), onclick: function () { D.guide.open('game-' + def.id, 'howto'); } }));
      actions.appendChild(D.el('button', { class: 'btn sm ghost', title: 'About', html: D.icon('info'), onclick: function () { D.guide.open('game-' + def.id, 'about'); } }));
      card.appendChild(actions);
      card.querySelector('.ar-art').addEventListener('click', function () { open(def.id); });
      gridEl.appendChild(card);
    });
    var tag = page && page.querySelector('.page-head h1 small');
    if (tag) tag.textContent = games.length + ' robot games';
  }

  var bestEl = null;
  function updateBest() {
    if (bestEl && active) { var b = bestOf(active.def.id); bestEl.innerHTML = D.icon('trophy') + 'Best ' + (b == null ? '—' : b); }
  }

  function close() {
    if (!active) return;
    var a = active; active = null;
    try { a.inst && a.inst.destroy && a.inst.destroy(); } catch (e) { console.error(e); }
    if (a.def.cv) { try { D.vision.stop('game-' + a.def.id); } catch (e) {} }
    D.audit.log('arcade', 'Left game', a.def.title + ' · played ' + D.fmtDur(Date.now() - a.t0));
    viewEl.innerHTML = ''; viewEl.classList.add('hidden'); hubEl.classList.remove('hidden');
    renderGrid();
  }

  function open(id) {
    var def = byId[id]; if (!def) return;
    if (active) close();
    hubEl.classList.add('hidden'); viewEl.classList.remove('hidden'); viewEl.innerHTML = '';
    var bar = D.el('div', { class: 'ar-bar' });
    bar.appendChild(D.el('button', { class: 'btn sm', html: D.icon('arrowLeft') + 'Arcade', onclick: function () { D.sound.click(); close(); } }));
    bar.appendChild(D.el('div', { class: 'ar-bar-title', html: '<span class="ar-dot" style="background:var(' + (def.color || '--accent') + ')"></span><h2>' + D.esc(def.title) + '</h2>' + cvChip(def) }));
    bar.appendChild(D.el('span', { class: 'spacer' }));
    bestEl = D.el('span', { class: 'chip amber ar-bestchip' });
    bar.appendChild(bestEl);
    bar.appendChild(D.el('button', { class: 'btn sm', html: D.icon('book') + 'How to play', onclick: function () { D.guide.open('game-' + def.id, 'howto'); } }));
    bar.appendChild(D.el('button', { class: 'btn sm', html: D.icon('info') + 'About', onclick: function () { D.guide.open('game-' + def.id, 'about'); } }));
    viewEl.appendChild(bar);
    var host = D.el('div', { class: 'ar-host g-' + def.id });
    viewEl.appendChild(host);
    active = { def: def, t0: Date.now(), inst: null };
    updateBest();
    D.audit.log('arcade', 'Started game', def.title);
    try { active.inst = def.create(host, makeCtx(def)); }
    catch (e) { console.error(e); host.innerHTML = '<div class="empty">' + D.icon('info') + '<div>Could not start this game: ' + D.esc(e.message) + '</div></div>'; }
  }

  D.guide.register('arcade', {
    title: 'Arcade', badge: D.avatar('arcade'),
    howto: [
      { title: 'Pick a game', text: 'Every card is one robot game. Chips tell you whether it uses <b>face vision</b>, <b>hand vision</b> or just mouse and keys.', svg: D.guide.art.wrap('<rect x="12" y="16" width="58" height="72" rx="8" fill="var(--surface-3)" stroke="var(--line-2)"/><rect x="80" y="16" width="58" height="72" rx="8" fill="var(--surface-3)" stroke="var(--accent)"/>' + D.guide.art.btn(88, 66, 42, 'Play', true) + D.guide.art.cursor(112, 74)) },
      { title: 'Read the guide first', text: 'Each game has its own <b>How to play</b> and <b>About</b> page — open them from the card or from the bar at the top of the game.', svg: D.guide.art.wrap(D.guide.art.btn(14, 30, 58, 'How to play') + D.guide.art.btn(80, 30, 52, 'About') + D.guide.art.text(16, 70, 'Illustrated steps + concepts', 9, 'var(--text-2)')) },
      { title: 'Allow the camera', text: 'Vision games ask for your camera. Everything runs offline on this computer — no image ever leaves it. No camera? Every vision game has a click / keyboard fallback.', svg: D.guide.art.wrap('<rect x="40" y="22" width="70" height="52" rx="10" fill="var(--surface-3)" stroke="var(--line-2)"/><circle cx="75" cy="48" r="14" fill="none" stroke="var(--accent)" stroke-width="3"/><circle cx="75" cy="48" r="5" fill="var(--accent)"/>' + D.guide.art.text(42, 92, 'processed locally', 9)) },
      { title: 'Beat your best', text: 'Scores are saved per game and every result lands in the <b>Audit log</b>, so you can review your progress later.', svg: D.guide.art.wrap('<path d="M55 20h40v24a20 20 0 01-40 0z" fill="var(--amber)" opacity=".85"/><path d="M75 64v12M60 84h30" stroke="var(--amber)" stroke-width="4"/>') }
    ],
    tips: 'Press <kbd>Esc</kbd> to close a guide. Leaving a game always switches the camera off.',
    about: {
      hero: '<svg viewBox="0 0 560 150"><rect width="560" height="150" fill="var(--bg-2)"/>' + ['--pink', '--accent', '--violet', '--amber', '--green', '--blue', '--orange'].map(function (c, i) { return '<rect x="' + (18 + i * 77) + '" y="30" width="66" height="90" rx="12" fill="var(' + c + ')" opacity=".18" stroke="var(' + c + ')"/><circle cx="' + (51 + i * 77) + '" cy="75" r="14" fill="var(' + c + ')"/>'; }).join('') + '</svg>',
      intro: 'The Arcade turns every idea in Daedalus into a short game: path planning, logic, computer vision and gesture control. Each one is a playful way to practise a real robotics concept.',
      facts: [['7', 'games'], ['2', 'vision modes'], ['100%', 'offline']],
      sections: [
        { title: 'What you practise', html: '<ul><li><b>Mine Sweeper Bot</b> — logical deduction and path finding.</li><li><b>Gem Rush</b> — writing the shortest robot program.</li><li><b>Mirror Me</b> — facial expression recognition.</li><li><b>Gesture Simon / Gesture Pilot</b> — hand-gesture control.</li><li><b>Snake Bot</b> — reflexes, with optional hand steering.</li><li><b>Labyrinth Race</b> — you versus a maze-solving algorithm.</li></ul>' },
        { title: 'Scores', html: '<p>Higher is always better. Best scores are stored locally per game; the Audit log keeps a history of every run.</p>' }
      ]
    }
  });

  D.router.register('arcade', {
    title: 'Arcade', icon: 'arcade',
    mount: function (el) {
      page = el;
      el.appendChild(D.ui.pageHead({ title: 'Arcade', tag: games.length + ' robot games', badge: D.avatar('arcade'), sub: 'Short games that teach path planning, logic and computer vision.', guide: 'arcade' }));
      var body = D.el('div', { class: 'page-body ar-body' });
      hubEl = D.el('div', { class: 'ar-hub' });
      hubEl.appendChild(D.el('div', { class: 'callout ar-intro', html: D.icon('sparkle') + '<div><b>Pick a game.</b> Vision games use your camera locally — every one of them also has a mouse or keyboard fallback.</div>' }));
      gridEl = D.el('div', { class: 'ar-grid' });
      hubEl.appendChild(gridEl);
      viewEl = D.el('div', { class: 'ar-view hidden' });
      body.appendChild(hubEl); body.appendChild(viewEl);
      el.appendChild(body);
      renderGrid();
    },
    show: function (id) { if (id && byId[id]) open(id); },
    hide: function () { close(); }
  });
})(window);
