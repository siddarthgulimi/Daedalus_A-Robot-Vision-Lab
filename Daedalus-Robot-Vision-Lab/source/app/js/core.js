/* core.js — shared foundation for every module.
   Exposes the global namespace `D`:
     D.el(tag, attrs, ...children)   tiny DOM builder
     D.icon(name)                    inline SVG icon string
     D.store                         JSON localStorage wrapper
     D.settings                      persisted user settings + change events
     D.audit                         audit log (every meaningful action)
     D.theme                         light / dark / black / system
     D.ui                            toast, modal, confirm, download
     D.router                        page registration + navigation
     D.guide                         "How to use" + "About" drawer for every feature
     D.sound                         tiny synth beeps (robotic feedback)
     D.bus                           global event bus
*/
(function (global) {
  'use strict';
  var D = global.D = global.D || {};
  D.APP_NAME = 'Daedalus';
  D.APP_FULL = 'Daedalus — Robot Vision Lab';
  D.VERSION = '2.0.0';

  /* ------------------------------------------------------------ DOM */
  D.el = function (tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') { for (var sk in v) { if (sk.slice(0, 2) === '--') node.style.setProperty(sk, v[sk]); else node.style[sk] = v[sk]; } }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  };
  function append(node, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(node, x); }); return; }
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  D.html = function (str) { var t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstElementChild; };
  D.$ = function (sel, root) { return (root || document).querySelector(sel); };
  D.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  D.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  D.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  D.lerp = function (a, b, t) { return a + (b - a) * t; };
  D.cssVar = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  D.uid = function (p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9); };
  D.fmtTime = function (ts) { var d = new Date(ts); return d.toLocaleString(); };
  D.fmtDur = function (ms) { var s = Math.round(ms / 1000); if (s < 60) return s + 's'; var m = Math.floor(s / 60); return m + 'm ' + (s % 60) + 's'; };

  /* ------------------------------------------------------------ Icons (stroke icons, 24px grid) */
  var P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    argus: '<rect x="4" y="7" width="16" height="12" rx="3"/><circle cx="9" cy="13" r="1.6"/><circle cx="15" cy="13" r="1.6"/><path d="M12 7V3.5"/><circle cx="12" cy="3" r="1"/><path d="M2 12v3M22 12v3"/>',
    echo: '<circle cx="12" cy="12" r="9"/><path d="M8.5 10v.5M15.5 10v.5"/><path d="M8 15c1.2 1.3 2.5 2 4 2s2.8-.7 4-2"/>',
    theseus: '<path d="M3 3h18v18H3z"/><path d="M7 3v8h4M15 7v6h6M7 15v6M11 15h4v6"/>',
    arcade: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
    audit: '<path d="M8 3h8l4 4v14H4V3h4"/><path d="M8 11h8M8 15h8M8 7h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 4"/><path d="M12 17v.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    step: '<path d="M5 5v14l9-7z" fill="currentColor"/><path d="M18 5v14"/>',
    reset: '<path d="M4 12a8 8 0 108-8 8.4 8.4 0 00-6 2.6L4 9"/><path d="M4 4v5h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 015.5 3H20v15H5.5A1.5 1.5 0 004 19.5z"/><path d="M4 19.5A1.5 1.5 0 005.5 21H20"/><path d="M8 7h8M8 11h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    camera: '<path d="M3 8a2 2 0 012-2h2.5L9 4h6l1.5 2H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    cameraOff: '<path d="M3 3l18 18"/><path d="M9 4h6l1.5 2H19a2 2 0 012 2v9M17 20H5a2 2 0 01-2-2V8a2 2 0 012-2h1"/><path d="M10 10a3.5 3.5 0 004.9 4.9"/>',
    face: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/>',
    hand: '<path d="M7 11V6.5a1.5 1.5 0 013 0V11M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V12M16 11.5V8.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-4.8-2.4L4 14.5a1.6 1.6 0 012.5-2L7 13"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 000-18z" fill="currentColor"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v5M15 10v5M9 15v4"/>',
    eraser: '<path d="M16 3l5 5-11 11H5l-2-2z"/><path d="M9 9l6 6M5 19h15"/>',
    gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M12 21L9 9M12 21l3-12"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><circle cx="9.5" cy="13" r="1.3"/><circle cx="14.5" cy="13" r="1.3"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/>',
    wand: '<path d="M4 20L16 8M14 4v2M20 10h-2M18 6l-1.5 1.5M13 9l2 2"/><path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5z"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 000-6H9a3 3 0 010-6h6.5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    circle: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v4M21 12h-4M12 17v4"/>',
    hex: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/>',
    bomb: '<circle cx="11" cy="14" r="7"/><path d="M15.5 8.5L18 6M18 6l2-2M17 3l1 1M21 7l-1-1"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9 21v-4h6v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    turnLeft: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 016 6v5"/>',
    turnRight: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 00-6 6v5"/>',
    uturn: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9a5 5 0 010 10h-3"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-11.2 7.5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    wait: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    rotate: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 5v6h-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-8M20 16v-3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    mud: '<path d="M3 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/><path d="M3 12c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4M6 10v4M10 10v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    hammer: '<path d="M14 6l4 4M3 21l9-9M12.5 4.5l7 7-2 2-7-7z"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/>',
    snake: '<path d="M4 18c3 0 3-4 6-4s3 4 6 4 4-3 4-6-2-6-6-6H9"/><circle cx="7" cy="6" r="2"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>'
  };
  D.icon = function (name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  };
  D.iconEl = function (name, cls) { return D.html(D.icon(name, cls)); };

  /* ------------------------------------------------------------ Event bus */
  var handlers = {};
  D.bus = {
    on: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return function () { D.bus.off(ev, fn); }; },
    off: function (ev, fn) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); },
    emit: function (ev, data) { (handlers[ev] || []).slice().forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }
  };

  /* ------------------------------------------------------------ Storage */
  var PREFIX = 'daedalus.';
  D.store = {
    get: function (k, def) {
      try { var v = localStorage.getItem(PREFIX + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set: function (k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    remove: function (k) { try { localStorage.removeItem(PREFIX + k); } catch (e) {} },
    clearAll: function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); }); } catch (e) {} }
  };

  /* ------------------------------------------------------------ Settings */
  var DEFAULT_SETTINGS = {
    theme: 'system', accent: 'cyan', sound: true, reduceMotion: false,
    cameraId: '', mirrorVideo: true, cvDelegate: 'GPU', showLandmarks: true,
    sensitivity: 1.0, holdMs: 350, playerName: ''
  };
  var settings = Object.assign({}, DEFAULT_SETTINGS, D.store.get('settings', {}));
  D.settings = {
    get: function (k) { return k ? settings[k] : Object.assign({}, settings); },
    set: function (k, v, silent) {
      var old = settings[k]; settings[k] = v; D.store.set('settings', settings);
      D.bus.emit('settings', { key: k, value: v, old: old });
      if (!silent && old !== v) D.audit.log('settings', 'Changed setting', k + ': ' + JSON.stringify(old) + ' → ' + JSON.stringify(v));
    },
    reset: function () { settings = Object.assign({}, DEFAULT_SETTINGS); D.store.set('settings', settings); D.bus.emit('settings', {}); }
  };

  /* ------------------------------------------------------------ Audit log */
  var MAX_AUDIT = 5000;
  var auditList = D.store.get('audit', []);
  var sessionId = 'S' + Date.now().toString(36).toUpperCase();
  var saveTimer = null;
  function persistAudit() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { D.store.set('audit', auditList); }, 250);
  }
  D.audit = {
    MODULES: {
      app: { label: 'App', color: '--text-2' }, argus: { label: 'Argus', color: '--accent' },
      echo: { label: 'Echo', color: '--violet' }, theseus: { label: 'Theseus', color: '--amber' },
      arcade: { label: 'Arcade', color: '--pink' }, tutorial: { label: 'Boot Camp', color: '--green' },
      settings: { label: 'Settings', color: '--blue' }, audit: { label: 'Audit', color: '--orange' }
    },
    session: sessionId,
    /* level: info | success | warn | error ; data: optional structured payload for reports */
    log: function (module, action, detail, level, data) {
      var entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), s: sessionId, m: module || 'app', a: action, d: detail || '', l: level || 'info' };
      if (data) entry.x = data;
      auditList.push(entry);
      if (auditList.length > MAX_AUDIT) auditList.splice(0, auditList.length - MAX_AUDIT);
      persistAudit();
      D.bus.emit('audit', entry);
      return entry;
    },
    all: function () { return auditList.slice(); },
    clear: function () { auditList = []; D.store.set('audit', auditList); D.bus.emit('audit', null); },
    flush: function () { clearTimeout(saveTimer); D.store.set('audit', auditList); }
  };
  global.addEventListener('beforeunload', function () { D.audit.flush(); });

  /* ------------------------------------------------------------ Theme */
  var ACCENTS = {
    cyan:   { dark: ['#22d3ee', '#0ea5c6', '#04212a', 'rgba(34,211,238,.14)'], light: ['#0891b2', '#0e7490', '#fff', 'rgba(8,145,178,.10)'] },
    violet: { dark: ['#a78bfa', '#8b5cf6', '#160b33', 'rgba(167,139,250,.16)'], light: ['#7c3aed', '#6d28d9', '#fff', 'rgba(124,58,237,.10)'] },
    lime:   { dark: ['#a3e635', '#84cc16', '#1a2605', 'rgba(163,230,53,.14)'], light: ['#4d7c0f', '#3f6212', '#fff', 'rgba(77,124,15,.10)'] },
    orange: { dark: ['#fb923c', '#f97316', '#2b1203', 'rgba(251,146,60,.15)'], light: ['#ea580c', '#c2410c', '#fff', 'rgba(234,88,12,.10)'] },
    pink:   { dark: ['#f472b6', '#ec4899', '#2d0819', 'rgba(244,114,182,.15)'], light: ['#db2777', '#be185d', '#fff', 'rgba(219,39,119,.10)'] }
  };
  var mq = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;
  D.theme = {
    ACCENTS: ACCENTS,
    resolved: function () {
      var t = settings.theme;
      if (t === 'system') return mq && !mq.matches ? 'light' : 'dark';
      return t;
    },
    apply: function () {
      var r = D.theme.resolved();
      var root = document.documentElement;
      root.setAttribute('data-theme', r);
      var a = ACCENTS[settings.accent] || ACCENTS.cyan;
      var set = r === 'light' ? a.light : a.dark;
      root.style.setProperty('--accent', set[0]); root.style.setProperty('--accent-2', set[1]);
      root.style.setProperty('--accent-ink', set[2]); root.style.setProperty('--accent-soft', set[3]);
      root.classList.toggle('reduce-motion', !!settings.reduceMotion);
      D.bus.emit('theme', r);
    }
  };
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (settings.theme === 'system') D.theme.apply(); });
  D.bus.on('settings', function (e) { if (!e.key || e.key === 'theme' || e.key === 'accent' || e.key === 'reduceMotion') D.theme.apply(); });

  /* ------------------------------------------------------------ UI helpers */
  D.ui = {};
  D.ui.toast = function (msg, kind, ms) {
    var host = D.$('.toasts');
    if (!host) { host = D.el('div', { class: 'toasts' }); document.body.appendChild(host); }
    var ic = { good: 'check', bad: 'x', warn: 'info' }[kind] || 'sparkle';
    var t = D.el('div', { class: 'toast ' + (kind || ''), html: D.icon(ic) + '<div>' + msg + '</div>' });
    t.querySelector('svg').style.cssText = 'width:18px;height:18px;flex:none;color:var(--' + ({ good: 'green', bad: 'red', warn: 'amber' }[kind] || 'accent') + ')';
    host.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || 3200);
  };
  /* modal(content, {title, actions:[{label, kind, onClick, close}], dismissable}) → {close} */
  D.ui.modal = function (content, opts) {
    opts = opts || {};
    var wrap = D.el('div', { class: 'modal-wrap' });
    var box = D.el('div', { class: 'modal' });
    if (opts.width) box.style.width = 'min(' + opts.width + 'px, 94vw)';
    if (opts.title) box.appendChild(D.el('h2', { style: { marginBottom: '12px' }, html: opts.title }));
    box.appendChild(typeof content === 'string' ? D.el('div', { html: content }) : content);
    var api = { close: function () { wrap.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); }, box: box };
    if (opts.actions) {
      var row = D.el('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '18px' } });
      opts.actions.forEach(function (a) {
        row.appendChild(D.el('button', { class: 'btn ' + (a.kind || ''), html: a.label, onclick: function () { var keep = a.onClick && a.onClick(api) === false; if (!keep && a.close !== false) api.close(); } }));
      });
      box.appendChild(row);
    }
    wrap.appendChild(box);
    function onKey(e) { if (e.key === 'Escape' && opts.dismissable !== false) api.close(); }
    document.addEventListener('keydown', onKey);
    if (opts.dismissable !== false) wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) api.close(); });
    document.body.appendChild(wrap);
    return api;
  };
  D.ui.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (res) {
      var done = false;
      D.ui.modal('<p class="muted">' + text + '</p>', {
        title: title, onClose: function () { if (!done) res(false); },
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: okLabel || 'OK', kind: danger ? 'danger' : 'primary', onClick: function () { done = true; res(true); } }]
      });
    });
  };
  D.ui.download = function (name, content, mime) {
    if (global.desktop && global.desktop.saveFile) {
      var ext = name.split('.').pop();
      return global.desktop.saveFile(name, content, [{ name: ext.toUpperCase(), extensions: [ext] }]).then(function (r) {
        if (r && r.ok) D.ui.toast('Saved to ' + D.esc(r.path), 'good');
        return r;
      });
    }
    var blob = new Blob([content], { type: mime || 'text/plain' });
    var a = D.el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    D.ui.toast('Downloaded ' + D.esc(name), 'good');
    return Promise.resolve({ ok: true });
  };
  /* Segmented control helper: seg(options [[value,label,icon]], value, onChange) */
  D.ui.seg = function (options, value, onChange, cls) {
    var s = D.el('div', { class: 'seg ' + (cls || '') });
    options.forEach(function (o) {
      var b = D.el('button', { class: o[0] === value ? 'on' : '', dataset: { v: o[0] }, html: (o[2] ? D.icon(o[2]) : '') + (o[1] || ''), title: o[3] || '' });
      b.addEventListener('click', function () { D.$$('button', s).forEach(function (x) { x.classList.toggle('on', x === b); }); onChange(o[0]); });
      s.appendChild(b);
    });
    s.setValue = function (v) { D.$$('button', s).forEach(function (x) { x.classList.toggle('on', x.dataset.v === String(v)); }); };
    return s;
  };
  D.ui.switchEl = function (checked, onChange) {
    var lab = D.el('label', { class: 'switch' });
    var inp = D.el('input', { type: 'checkbox' }); inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    lab.appendChild(inp); lab.appendChild(D.el('span'));
    lab.input = inp;
    return lab;
  };
  /* Standard page header with How-to / About buttons */
  D.ui.pageHead = function (o) {
    var head = D.el('div', { class: 'page-head' });
    head.appendChild(D.el('div', { class: 'robot-badge', html: o.badge || D.icon(o.icon || 'robot') }));
    var t = D.el('div', { class: 'grow' });
    t.appendChild(D.el('h1', { html: o.title + (o.tag ? ' <small>' + o.tag + '</small>' : '') }));
    if (o.sub) t.appendChild(D.el('div', { class: 'sub', html: o.sub }));
    head.appendChild(t);
    var actions = D.el('div', { class: 'row actions' });
    if (o.extra) actions.appendChild(o.extra);
    if (o.guide) {
      actions.appendChild(D.el('button', { class: 'btn sm', html: D.icon('book') + 'How to use', onclick: function () { D.guide.open(o.guide, 'howto'); } }));
      actions.appendChild(D.el('button', { class: 'btn sm', html: D.icon('info') + 'About', onclick: function () { D.guide.open(o.guide, 'about'); } }));
    }
    head.appendChild(actions);
    return head;
  };

  /* ------------------------------------------------------------ Router */
  var pages = {}, current = null;
  D.router = {
    /* def: { title, icon, mount(el) → called once, show(), hide() } */
    register: function (id, def) { pages[id] = def; },
    current: function () { return current; },
    go: function (id, arg) {
      if (!pages[id]) return;
      if (current && current !== id) {
        var prev = pages[current];
        if (prev.hide) try { prev.hide(); } catch (e) { console.error(e); }
        var pe = D.$('#page-' + current); if (pe) pe.classList.remove('active');
      }
      var def = pages[id];
      var el = D.$('#page-' + id);
      if (!el) { el = D.el('section', { class: 'page', id: 'page-' + id }); D.$('.main').appendChild(el); }
      if (!def._mounted) { def._mounted = true; try { def.mount(el); } catch (e) { console.error(e); D.ui.toast('Could not open ' + id + ': ' + e.message, 'bad'); } }
      el.classList.add('active');
      D.$$('.nav-item').forEach(function (n) { n.classList.toggle('active', n.dataset.page === id); });
      var changed = current !== id;
      current = id;
      if (def.show) try { def.show(arg); } catch (e) { console.error(e); }
      if (changed) { D.audit.log('app', 'Opened page', def.title || id); D.bus.emit('page', id); }
      D.store.set('lastPage', id);
    }
  };

  /* ------------------------------------------------------------ Sound */
  var actx = null;
  function ctx() { if (!actx) { try { actx = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) {} } return actx; }
  D.sound = {
    beep: function (freq, dur, type, vol) {
      if (!settings.sound) return;
      var c = ctx(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.value = freq || 660;
      g.gain.value = 0; g.gain.linearRampToValueAtTime((vol || 0.05), c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.08));
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + (dur || 0.08) + 0.02);
    },
    seq: function (notes, gap) { var t = 0; notes.forEach(function (n) { setTimeout(function () { D.sound.beep(n[0], n[1], n[2]); }, t); t += gap || 90; }); },
    click: function () { D.sound.beep(880, 0.03, 'square', 0.025); },
    move: function () { D.sound.beep(520, 0.04, 'triangle', 0.04); },
    bump: function () { D.sound.beep(140, 0.15, 'sawtooth', 0.06); },
    good: function () { D.sound.seq([[660, .07], [880, .07], [1320, .12]], 80); },
    win: function () { D.sound.seq([[523, .08], [659, .08], [784, .08], [1047, .2]], 100); },
    bad: function () { D.sound.seq([[300, .1, 'sawtooth'], [200, .18, 'sawtooth']], 120); }
  };

  /* ------------------------------------------------------------ Guide drawer */
  var guides = {};
  D.guide = {
    register: function (id, g) { guides[id] = g; },
    get: function (id) { return guides[id]; },
    list: function () { return Object.keys(guides).map(function (k) { return Object.assign({ id: k }, guides[k]); }); },
    /* g = { title, icon, howto: [{title, text, svg}], about: { hero: svg, intro, facts:[[v,label]], sections:[{title, html}] } } */
    open: function (id, tab) {
      var g = guides[id]; if (!g) return;
      var scrim = D.$('#guideScrim'), drawer = D.$('#guideDrawer');
      var head = D.$('.drawer-head', drawer), body = D.$('.drawer-body', drawer);
      head.innerHTML = '';
      var top = D.el('div', { class: 'row' },
        D.el('div', { class: 'robot-badge', style: { width: '40px', height: '40px', borderRadius: '11px', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--line)' }, html: g.badge || D.icon(g.icon || 'book') }),
        D.el('div', { class: 'grow' }, D.el('div', { class: 'eyebrow', text: 'Guide' }), D.el('h2', { text: g.title })),
        D.el('button', { class: 'btn icon ghost', html: D.icon('x'), title: 'Close', onclick: D.guide.close }));
      head.appendChild(top);
      var tabs = D.el('div', { class: 'tabs' });
      var bH = D.el('button', { html: D.icon('book') + 'How to use' }), bA = D.el('button', { html: D.icon('info') + 'About' });
      tabs.appendChild(bH); tabs.appendChild(bA); head.appendChild(tabs);
      function show(which) {
        bH.classList.toggle('on', which === 'howto'); bA.classList.toggle('on', which === 'about');
        body.innerHTML = ''; body.scrollTop = 0;
        if (which === 'howto') {
          (g.howto || []).forEach(function (s, i) {
            body.appendChild(D.el('div', { class: 'guide-step' },
              D.el('div', { class: 'ill', html: s.svg || D.guide.art.blank() }),
              D.el('div', {}, D.el('div', { class: 'num', text: 'STEP ' + String(i + 1).padStart(2, '0') }), D.el('h4', { text: s.title }), D.el('p', { html: s.text }))));
          });
          if (g.tips) body.appendChild(D.el('div', { class: 'callout', html: D.icon('sparkle') + '<div>' + g.tips + '</div>' }));
        } else {
          var a = g.about || {};
          if (a.hero) body.appendChild(D.el('div', { class: 'about-hero', html: a.hero }));
          if (a.intro) body.appendChild(D.el('p', { class: 'muted', style: { fontSize: '14.5px' }, html: a.intro }));
          if (a.facts) {
            var fg = D.el('div', { class: 'fact-grid' });
            a.facts.forEach(function (f) { fg.appendChild(D.el('div', { class: 'fact', html: '<b>' + f[0] + '</b><span>' + f[1] + '</span>' })); });
            body.appendChild(fg);
          }
          (a.sections || []).forEach(function (s) { body.appendChild(D.el('div', { class: 'about-sec' }, D.el('h4', { text: s.title }), D.el('div', { html: s.html }))); });
        }
      }
      bH.onclick = function () { show('howto'); }; bA.onclick = function () { show('about'); };
      show(tab || 'howto');
      scrim.classList.add('open'); drawer.classList.add('open');
      D.audit.log('app', 'Opened guide', g.title + ' · ' + (tab === 'about' ? 'About' : 'How to use'));
    },
    close: function () { D.$('#guideScrim').classList.remove('open'); D.$('#guideDrawer').classList.remove('open'); }
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') D.guide.close(); });

  /* Small illustration kit for guide steps (150×104 viewBox) */
  var A = 'stroke="var(--accent)"', T2 = 'fill="var(--text-2)"';
  D.guide.art = {
    wrap: function (inner) { return '<svg viewBox="0 0 150 104" font-family="Inter" font-size="9">' + inner + '</svg>'; },
    blank: function () { return D.guide.art.wrap('<rect x="20" y="20" width="110" height="64" rx="8" fill="var(--surface-3)"/>'); },
    card: function (x, y, w, label, color, icon) {
      return '<g transform="translate(' + x + ',' + y + ')"><rect width="' + w + '" height="18" rx="5" fill="' + color + '"/><text x="7" y="12.5" fill="#fff" font-weight="600" font-size="8.5">' + label + '</text></g>';
    },
    cursor: function (x, y) { return '<path transform="translate(' + x + ',' + y + ')" d="M0 0l0 13 3.5-3 2.5 5.5 2-1-2.5-5.2 4.5-.3z" fill="var(--text)" stroke="var(--bg)" stroke-width="1"/>'; },
    grid: function (x, y, cols, rows, s) {
      var o = '<g transform="translate(' + x + ',' + y + ')">';
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) o += '<rect x="' + c * s + '" y="' + r * s + '" width="' + (s - 1.5) + '" height="' + (s - 1.5) + '" rx="1.5" fill="var(--grid-floor)" stroke="var(--grid-line)"/>';
      return o + '</g>';
    },
    bot: function (x, y, s, rot) { s = s || 12; return '<g transform="translate(' + x + ',' + y + ') rotate(' + (rot || 0) + ')"><rect x="' + (-s / 2) + '" y="' + (-s / 2) + '" width="' + s + '" height="' + s + '" rx="' + s / 4 + '" fill="var(--accent)"/><circle cx="' + (-s / 5) + '" cy="' + (-s / 8) + '" r="' + s / 9 + '" fill="#fff"/><circle cx="' + (s / 5) + '" cy="' + (-s / 8) + '" r="' + s / 9 + '" fill="#fff"/><path d="M' + (s / 2) + ' 0l' + s / 4 + ' 0" ' + A + ' stroke-width="2"/></g>'; },
    flag: function (x, y) { return '<g transform="translate(' + x + ',' + y + ')"><path d="M0 8V-6" stroke="var(--text)" stroke-width="1.4"/><path d="M0 -6h8l-2 3 2 3H0z" fill="var(--green)"/></g>'; },
    text: function (x, y, s, size, color, weight) { return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 9) + '" fill="' + (color || 'var(--text-2)') + '" font-weight="' + (weight || 500) + '">' + s + '</text>'; },
    arrow: function (x1, y1, x2, y2, color) { return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="' + (color || 'var(--accent)') + '" stroke-width="1.6" stroke-dasharray="3 2" marker-end="url(#ah)"/><defs><marker id="ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6z" fill="' + (color || 'var(--accent)') + '"/></marker></defs>'; },
    btn: function (x, y, w, label, primary) { return '<g transform="translate(' + x + ',' + y + ')"><rect width="' + w + '" height="16" rx="5" fill="' + (primary ? 'var(--accent)' : 'var(--surface-3)') + '" stroke="var(--line-2)"/><text x="' + w / 2 + '" y="11" text-anchor="middle" font-size="8" font-weight="600" fill="' + (primary ? 'var(--accent-ink)' : 'var(--text)') + '">' + label + '</text></g>'; },
    face: function (x, y, r, mood) {
      var m = { happy: 'M-6 3q6 6 12 0', sad: 'M-6 6q6 -5 12 0', neutral: 'M-6 4h12', surprised: '', angry: 'M-6 5q6 -3 12 0' }[mood || 'happy'];
      var mouth = mood === 'surprised' ? '<ellipse cx="0" cy="5" rx="3" ry="4" fill="var(--accent)"/>' : '<path d="' + m + '" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round"/>';
      var brows = mood === 'angry' ? '<path d="M-10 -9l6 3M10 -9l-6 3" stroke="var(--accent)" stroke-width="2"/>' : mood === 'sad' ? '<path d="M-10 -6l6 -3M10 -6l-6 -3" stroke="var(--accent)" stroke-width="2"/>' : '';
      return '<g transform="translate(' + x + ',' + y + ')"><rect x="' + (-r) + '" y="' + (-r * .85) + '" width="' + 2 * r + '" height="' + 1.7 * r + '" rx="' + r * .4 + '" fill="var(--surface-3)" stroke="var(--line-2)"/><rect x="-9" y="-5" width="5" height="' + (mood === 'surprised' ? 8 : 6) + '" rx="2" fill="var(--accent)"/><rect x="4" y="-5" width="5" height="' + (mood === 'surprised' ? 8 : 6) + '" rx="2" fill="var(--accent)"/>' + brows + mouth + '</g>';
    }
  };

  /* Expression catalog shared by Echo, games and the tutorial */
  D.EXPRESSIONS = {
    neutral:   { label: 'Neutral',   emoji: '😐', color: '#60a5fa', line: 'Calm and listening.' },
    happy:     { label: 'Happy',     emoji: '😄', color: '#34d399', line: 'That makes my circuits glow!' },
    sad:       { label: 'Sad',       emoji: '😢', color: '#818cf8', line: 'My servos feel heavy…' },
    angry:     { label: 'Angry',     emoji: '😠', color: '#f87171', line: 'Overvoltage detected!' },
    surprised: { label: 'Surprised', emoji: '😲', color: '#fbbf24', line: 'Whoa — did not compute!' },
    thinking:  { label: 'Thinking',  emoji: '🤔', color: '#22d3ee', line: 'Processing… hmm…' },
    confused:  { label: 'Confused',  emoji: '😕', color: '#fb923c', line: 'Error 404: meaning not found?' },
    excited:   { label: 'Excited',   emoji: '🤩', color: '#f472b6', line: 'Let’s GO! Full power!' },
    eager:     { label: 'Eager',     emoji: '😃', color: '#a3e635', line: 'Ready! Give me a task!' },
    love:      { label: 'Love',      emoji: '🥰', color: '#fb7185', line: 'Affection protocol engaged.' },
    sleepy:    { label: 'Sleepy',    emoji: '😴', color: '#94a3b8', line: 'Low power mode… zzz' }
  };
  D.EMOTION_KEYS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'confused', 'excited', 'eager'];

})(window);
