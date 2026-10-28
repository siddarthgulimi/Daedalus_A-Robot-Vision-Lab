/* app.js — boot: navigation, quick theme switch, camera status, first-run Boot Camp. */
(function (global) {
  'use strict';
  var D = global.D;

  var NAV = {
    home:     { label: 'Home', icon: 'home' },
    argus:    { label: 'Argus', icon: 'argus', tag: 'PATH' },
    echo:     { label: 'Echo', icon: 'echo', tag: 'VISION' },
    theseus:  { label: 'Theseus', icon: 'theseus', tag: 'MAZE' },
    arcade:   { label: 'Arcade', icon: 'arcade', tag: '7' },
    audit:    { label: 'Audit log', icon: 'audit' },
    help:     { label: 'Help center', icon: 'help' },
    settings: { label: 'Settings', icon: 'settings' }
  };

  function buildNav() {
    D.$$('.nav-item').forEach(function (b) {
      var n = NAV[b.dataset.page]; if (!n) return;
      b.innerHTML = D.icon(n.icon) + '<span>' + n.label + '</span>' + (n.tag ? '<span class="nav-tag">' + n.tag + '</span>' : '');
      b.addEventListener('click', function () { D.sound.click(); D.router.go(b.dataset.page); });
    });
    var qt = D.$('#themeQuick');
    var seg = D.ui.seg([['light', '', 'sun', 'Light'], ['dark', '', 'moon', 'Dark'], ['black', '', 'contrast', 'Black'], ['system', '', 'monitor', 'System']],
      D.settings.get('theme'), function (v) { D.settings.set('theme', v); }, 'full');
    qt.appendChild(seg);
    D.bus.on('settings', function (e) { if (e.key === 'theme') seg.setValue(e.value); });
  }

  function camChip() {
    var host = D.$('#camStatus');
    function render(s) {
      var st = s.status;
      var cls = st === 'running' ? 'green' : st === 'loading' ? 'amber' : st === 'error' ? 'red' : '';
      var txt = st === 'running' ? (s.mode === 'face' ? 'Camera · face scan' : 'Camera · hand scan') : st === 'loading' ? 'Starting vision…' : st === 'error' ? 'Camera error' : 'Camera off';
      host.innerHTML = '<span class="chip ' + cls + '" title="' + D.esc(s.msg || '') + '"><span class="dot ' + (st === 'running' ? 'pulse' : '') + '"></span>' + txt + '</span>';
    }
    render({ status: 'idle' });
    D.bus.on('vision-status', render);
  }

  function keyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'F1') { e.preventDefault(); var p = D.router.current(); if (D.guide.get(p)) D.guide.open(p, 'howto'); }
      if (e.key === 'F11' && global.desktop) { e.preventDefault(); global.desktop.toggleFullscreen(); }
    });
  }

  function boot() {
    D.theme.apply();
    buildNav();
    camChip();
    keyboard();
    var count = D.store.get('launches', 0) + 1; D.store.set('launches', count);
    D.audit.log('app', 'App started', 'Session ' + D.audit.session + ' · launch #' + count + (global.desktop ? ' · desktop' : ' · browser'));
    var start = D.store.get('lastPage', 'home');
    if (!document.getElementById('page-' + start) && !NAV[start]) start = 'home';
    D.router.go(NAV[start] ? start : 'home');
    if (D.tutorial) D.tutorial.ensure();
  }

  global.addEventListener('error', function (e) { if (D.audit) D.audit.log('app', 'Runtime error', (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno, 'error'); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
