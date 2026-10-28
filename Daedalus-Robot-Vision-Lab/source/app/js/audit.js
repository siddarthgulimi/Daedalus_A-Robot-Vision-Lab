/* audit.js — Audit log page: history of every action + analytics + report export. */
(function (global) {
  'use strict';
  var D = global.D;
  var els = {}, F = { q: '', m: '', l: '', range: 'all', session: '' }, limit = 200;

  function mount(root) {
    var extra = D.el('div', { class: 'row' },
      D.el('button', { class: 'btn sm', html: D.icon('download') + 'CSV', onclick: exportCSV }),
      D.el('button', { class: 'btn sm', html: D.icon('download') + 'JSON', onclick: exportJSON }),
      D.el('button', { class: 'btn sm', html: D.icon('download') + 'HTML report', onclick: exportHTML }),
      D.el('button', { class: 'btn sm primary', html: D.icon('print') + (global.desktop ? 'Save PDF' : 'Print'), onclick: exportPDF }));
    root.appendChild(D.ui.pageHead({ title: 'Audit log', tag: 'History & reports', icon: 'audit', sub: 'Every action across Daedalus, with analytics you can export.', guide: 'audit', extra: extra }));
    var body = D.el('div', { class: 'page-body' });
    root.appendChild(body);
    els.stats = D.el('div', { class: 'au-grid' }); body.appendChild(els.stats);
    var charts = D.el('div', { class: 'au-charts' });
    els.cAct = chartPanel(charts, 'Activity · last 14 days');
    els.cMod = chartPanel(charts, 'Actions by module');
    els.cEmo = chartPanel(charts, 'Expression mix (Echo)');
    body.appendChild(charts);
    var charts2 = D.el('div', { class: 'grid-2 au-wide', style: { marginBottom: '16px' } });
    els.cMis = chartPanel(charts2, 'Argus missions');
    els.cGame = chartPanel(charts2, 'Arcade best scores');
    body.appendChild(charts2);

    var tbl = D.el('div', { class: 'panel' });
    var f = D.el('div', { class: 'au-filters' });
    var q = D.el('input', { class: 'input', placeholder: 'Search actions and details…', style: { width: '240px' } });
    q.oninput = function () { F.q = q.value.toLowerCase(); limit = 200; renderTable(); };
    f.appendChild(D.el('span', { class: 'faint', html: D.icon('search'), style: { width: '18px', height: '18px', display: 'inline-flex' } })); f.appendChild(q);
    var ms = D.el('select', { class: 'input' }); ms.appendChild(D.el('option', { value: '', text: 'All modules' }));
    Object.keys(D.audit.MODULES).forEach(function (k) { ms.appendChild(D.el('option', { value: k, text: D.audit.MODULES[k].label })); });
    ms.onchange = function () { F.m = ms.value; renderAll(); }; f.appendChild(ms);
    var ls = D.el('select', { class: 'input' });
    [['', 'All levels'], ['info', 'Info'], ['success', 'Success'], ['warn', 'Warning'], ['error', 'Error']].forEach(function (o) { ls.appendChild(D.el('option', { value: o[0], text: o[1] })); });
    ls.onchange = function () { F.l = ls.value; renderAll(); }; f.appendChild(ls);
    var rs = D.el('select', { class: 'input' });
    [['all', 'All time'], ['session', 'This session'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']].forEach(function (o) { rs.appendChild(D.el('option', { value: o[0], text: o[1] })); });
    rs.onchange = function () { F.range = rs.value; renderAll(); }; f.appendChild(rs);
    f.appendChild(D.el('span', { class: 'spacer' }));
    els.count = D.el('span', { class: 'chip' }); f.appendChild(els.count);
    f.appendChild(D.el('button', { class: 'btn sm danger', html: D.icon('trash') + 'Clear log', onclick: function () {
      D.ui.confirm('Clear the audit log?', 'All ' + D.audit.all().length + ' events will be deleted from this computer. Export first if you want a copy.', 'Clear log', true).then(function (ok) {
        if (!ok) return; var n = D.audit.all().length; D.audit.clear(); D.audit.log('audit', 'Cleared audit log', n + ' events removed', 'warn'); renderAll();
      });
    } }));
    tbl.appendChild(f);
    els.tableWrap = D.el('div', { class: 'au-table-wrap' });
    tbl.appendChild(els.tableWrap);
    body.appendChild(tbl);
    D.bus.on('audit', function () { if (D.router.current() === 'audit') { clearTimeout(mount._t); mount._t = setTimeout(renderAll, 300); } });
  }
  function chartPanel(host, title) {
    var p = D.el('div', { class: 'panel' }, D.el('div', { class: 'panel-head', html: '<span class="eyebrow">' + title + '</span>' }));
    var b = D.el('div', { class: 'panel-body' }); p.appendChild(b); host.appendChild(p); return b;
  }

  function filtered(ignoreModule) {
    var now = Date.now(), dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    return D.audit.all().filter(function (e) {
      if (!ignoreModule && F.m && e.m !== F.m) return false;
      if (F.l && e.l !== F.l) return false;
      if (F.range === 'session' && e.s !== D.audit.session) return false;
      if (F.range === 'today' && e.t < dayStart.getTime()) return false;
      if ((F.range === '7' || F.range === '30') && e.t < now - (+F.range) * 864e5) return false;
      if (F.q && (e.a + ' ' + e.d + ' ' + e.m).toLowerCase().indexOf(F.q) < 0) return false;
      return true;
    });
  }

  function renderAll() { renderStats(); renderCharts(); renderTable(); }
  function renderStats() {
    var list = filtered(), sessions = {}, warn = 0, succ = 0;
    list.forEach(function (e) { sessions[e.s] = 1; if (e.l === 'warn' || e.l === 'error') warn++; if (e.l === 'success') succ++; });
    var first = list[0], span = first ? D.fmtDur(Date.now() - first.t) : '—';
    els.stats.innerHTML = '';
    [['Events', list.length, 'in the current filter'], ['Sessions', Object.keys(sessions).length, 'app launches'], ['Successes', succ, 'missions, goals, calibrations…'], ['Warnings & errors', warn, first ? 'history spans ' + span : 'no history yet']].forEach(function (s) {
      els.stats.appendChild(D.el('div', { class: 'stat' }, D.el('div', { class: 'k', text: s[0] }), D.el('div', { class: 'v', text: String(s[1]) }), D.el('div', { class: 'd', text: s[2] })));
    });
  }
  function dayBuckets(list, days) {
    var out = [], base = new Date(); base.setHours(0, 0, 0, 0);
    for (var i = days - 1; i >= 0; i--) { var d0 = base.getTime() - i * 864e5; out.push({ t: d0, n: 0 }); }
    list.forEach(function (e) { for (var i = out.length - 1; i >= 0; i--) if (e.t >= out[i].t) { out[i].n++; break; } });
    return out;
  }
  function moduleCounts(list) { var c = {}; list.forEach(function (e) { c[e.m] = (c[e.m] || 0) + 1; }); return c; }
  function exprMix(list) {
    var mix = {};
    list.forEach(function (e) {
      if (e.a === 'Vision session summary' && e.x && e.x.expressions) for (var k in e.x.expressions) mix[k] = (mix[k] || 0) + e.x.expressions[k] / 1000;
    });
    if (!Object.keys(mix).length) list.forEach(function (e) { if (e.a === 'Expression detected' && e.x && e.x.expr) mix[e.x.expr] = (mix[e.x.expr] || 0) + 1; });
    return mix;
  }
  function renderCharts() {
    var list = filtered();
    /* activity */
    var b = dayBuckets(list, 14), mx = Math.max.apply(null, b.map(function (x) { return x.n; }).concat(1));
    els.cAct.innerHTML = '<div class="au-spark">' + b.map(function (x) { return '<div style="height:' + (x.n / mx * 100) + '%" data-l="' + new Date(x.t).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ': ' + x.n + '"></div>'; }).join('') + '</div><div class="au-axis"><span>' + new Date(b[0].t).toLocaleDateString([], { month: 'short', day: 'numeric' }) + '</span><span>today</span></div>';
    /* by module */
    var mc = moduleCounts(filtered(true)), keys = Object.keys(mc).sort(function (a, c) { return mc[c] - mc[a]; }), mm = Math.max.apply(null, keys.map(function (k) { return mc[k]; }).concat(1));
    els.cMod.innerHTML = keys.length ? '<div class="bars">' + keys.map(function (k) { var M = D.audit.MODULES[k] || { label: k, color: '--accent' }; return '<div class="bar-row"><span class="lbl">' + M.label + '</span><div class="track"><div class="fill" style="width:' + (mc[k] / mm * 100) + '%;background:var(' + M.color + ')"></div></div><span class="num">' + mc[k] + '</span></div>'; }).join('') + '</div>' : '<div class="empty small">No events</div>';
    /* expression donut */
    var mix = exprMix(D.audit.all()), mk = Object.keys(mix).sort(function (a, c) { return mix[c] - mix[a]; }), tot = mk.reduce(function (s, k) { return s + mix[k]; }, 0);
    if (!tot) els.cEmo.innerHTML = '<div class="empty small">' + D.icon('camera') + '<br>Start the camera in Echo to collect expression data.</div>';
    else {
      var a0 = 0, arcs = '';
      mk.forEach(function (k) {
        var frac = mix[k] / tot, a1 = a0 + frac * Math.PI * 2, large = frac > 0.5 ? 1 : 0;
        var r = 52, x0 = 60 + r * Math.sin(a0), y0 = 60 - r * Math.cos(a0), x1 = 60 + r * Math.sin(a1), y1 = 60 - r * Math.cos(a1);
        arcs += frac >= 0.999 ? '<circle cx="60" cy="60" r="52" fill="none" stroke="' + D.EXPRESSIONS[k].color + '" stroke-width="18"/>' : '<path d="M' + x0 + ' ' + y0 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x1 + ' ' + y1 + '" fill="none" stroke="' + D.EXPRESSIONS[k].color + '" stroke-width="18"/>';
        a0 = a1;
      });
      els.cEmo.innerHTML = '<div class="donut-wrap"><svg viewBox="0 0 120 120" width="130">' + arcs + '<text x="60" y="58" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="15" fill="var(--text)">' + D.EXPRESSIONS[mk[0]].emoji + '</text><text x="60" y="76" text-anchor="middle" font-size="9" fill="var(--text-2)">' + D.EXPRESSIONS[mk[0]].label + '</text></svg><div class="donut-legend">' + mk.slice(0, 7).map(function (k) { return '<span><i style="background:' + D.EXPRESSIONS[k].color + '"></i>' + D.EXPRESSIONS[k].label + ' <b>' + Math.round(mix[k] / tot * 100) + '%</b></span>'; }).join('') + '</div></div>';
    }
    /* missions */
    var prog = D.store.get('argus.missions', {});
    var ms = (D.argus ? D.argus.MISSIONS : []);
    els.cMis.innerHTML = '<div class="bars">' + ms.map(function (m, i) { var s = prog[m.id] || 0; return '<div class="bar-row"><span class="lbl">' + (i + 1) + '. ' + m.title + '</span><div class="track"><div class="fill" style="width:' + (s / 3 * 100) + '%;background:var(--amber)"></div></div><span class="num">' + (s ? '★'.repeat(s) : '—') + '</span></div>'; }).join('') + '</div>';
    /* games */
    var games = D.arcade && D.arcade.list ? D.arcade.list() : [];
    els.cGame.innerHTML = games.length ? '<div class="bars">' + games.map(function (g) { var v = D.store.get('arcade.best.' + g.id, null); return '<div class="bar-row"><span class="lbl">' + g.title + '</span><div class="track"><div class="fill" style="width:' + (v != null ? 100 : 0) + '%;background:var(' + (g.color || '--pink') + ')"></div></div><span class="num">' + (v != null ? v : '—') + '</span></div>'; }).join('') + '</div>' : '<div class="empty small">No games</div>';
  }
  function renderTable() {
    var list = filtered().reverse();
    els.count.textContent = list.length + ' event' + (list.length === 1 ? '' : 's');
    if (!list.length) { els.tableWrap.innerHTML = '<div class="empty">' + D.icon('audit') + '<div>No events match these filters.</div></div>'; return; }
    var rows = list.slice(0, limit).map(function (e) {
      var M = D.audit.MODULES[e.m] || { label: e.m, color: '--accent' };
      return '<tr><td class="au-time">' + new Date(e.t).toLocaleString() + '</td><td><span class="au-mod"><i style="background:var(' + M.color + ')"></i>' + M.label + '</span></td><td><b>' + D.esc(e.a) + '</b></td><td class="muted">' + D.esc(e.d) + '</td><td><span class="au-lvl ' + e.l + '">' + e.l + '</span></td><td class="faint mono">' + e.s.slice(-5) + '</td></tr>';
    }).join('');
    els.tableWrap.innerHTML = '<table class="table"><thead><tr><th>Time</th><th>Module</th><th>Action</th><th>Details</th><th>Level</th><th>Session</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      (list.length > limit ? '<div class="center" style="padding:12px"><button class="btn sm" id="auMore">Show ' + Math.min(200, list.length - limit) + ' more</button></div>' : '');
    var more = D.$('#auMore', els.tableWrap); if (more) more.onclick = function () { limit += 200; renderTable(); };
  }

  /* ---------------------------------------------------------------- exports */
  function stamp() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); }
  function exportCSV() {
    var list = filtered();
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var csv = ['timestamp,session,module,action,details,level'].concat(list.map(function (e) { return [new Date(e.t).toISOString(), e.s, e.m, e.a, e.d, e.l].map(q).join(','); })).join('\r\n');
    D.ui.download('daedalus-audit_' + stamp() + '.csv', '﻿' + csv, 'text/csv');
    D.audit.log('audit', 'Exported CSV', list.length + ' events');
  }
  function exportJSON() {
    var list = filtered();
    D.ui.download('daedalus-audit_' + stamp() + '.json', JSON.stringify({ app: D.APP_FULL, version: D.VERSION, exported: new Date().toISOString(), filters: F, events: list }, null, 2), 'application/json');
    D.audit.log('audit', 'Exported JSON', list.length + ' events');
  }
  function reportHTML(standalone) {
    var list = filtered(), mc = moduleCounts(list), mixAll = exprMix(D.audit.all());
    var name = D.settings.get('playerName');
    var css = 'body{font-family:Segoe UI,Inter,Arial,sans-serif;color:#0f1726;margin:32px;background:#fff}h1{font-size:24px;margin:0}h2{font-size:16px;margin:26px 0 10px;border-bottom:2px solid #0891b2;padding-bottom:4px}.sub{color:#4a5872;margin:4px 0 18px}.kpis{display:flex;gap:12px}.kpi{flex:1;border:1px solid #dce3ee;border-radius:10px;padding:10px 14px}.kpi b{display:block;font-size:22px}.kpi span{color:#4a5872;font-size:12px}table{width:100%;border-collapse:collapse;font-size:11.5px}th{text-align:left;background:#eef2f8;padding:6px 8px}td{padding:5px 8px;border-bottom:1px solid #e6ebf3;vertical-align:top}.bar{display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0}.bar i{display:block;height:9px;border-radius:5px;background:#0891b2}.bar span{width:120px}.lvl-warn{color:#b45309}.lvl-error{color:#dc2626}.lvl-success{color:#059669}';
    var mm = Math.max.apply(null, Object.keys(mc).map(function (k) { return mc[k]; }).concat(1));
    var mixT = Object.keys(mixAll).reduce(function (s, k) { return s + mixAll[k]; }, 0);
    var prog = D.store.get('argus.missions', {});
    var h = '<h1>Daedalus — Activity report</h1><div class="sub">' + (name ? D.esc(name) + ' · ' : '') + 'Generated ' + new Date().toLocaleString() + ' · ' + list.length + ' events · filter: ' + (F.m || 'all modules') + ', ' + F.range + '</div>';
    var sess = {}; list.forEach(function (e) { sess[e.s] = 1; });
    var stars = 0; for (var k in prog) stars += prog[k];
    h += '<div class="kpis"><div class="kpi"><b>' + list.length + '</b><span>events</span></div><div class="kpi"><b>' + Object.keys(sess).length + '</b><span>sessions</span></div><div class="kpi"><b>' + stars + ' / 15</b><span>mission stars</span></div><div class="kpi"><b>' + list.filter(function (e) { return e.l === 'error' || e.l === 'warn'; }).length + '</b><span>warnings & errors</span></div></div>';
    h += '<h2>Activity by module</h2>' + Object.keys(mc).map(function (k) { return '<div class="bar"><span>' + (D.audit.MODULES[k] || { label: k }).label + '</span><i style="width:' + (mc[k] / mm * 300) + 'px"></i>' + mc[k] + '</div>'; }).join('');
    if (mixT) h += '<h2>Expression mix (Echo camera sessions)</h2>' + Object.keys(mixAll).sort(function (a, b) { return mixAll[b] - mixAll[a]; }).map(function (k) { return '<div class="bar"><span>' + D.EXPRESSIONS[k].emoji + ' ' + D.EXPRESSIONS[k].label + '</span><i style="width:' + (mixAll[k] / mixT * 300) + 'px;background:' + D.EXPRESSIONS[k].color + '"></i>' + Math.round(mixAll[k] / mixT * 100) + '%</div>'; }).join('');
    if (D.argus) h += '<h2>Argus missions</h2>' + D.argus.MISSIONS.map(function (m, i) { return '<div class="bar"><span>' + (i + 1) + '. ' + m.title + '</span>' + (prog[m.id] ? '★'.repeat(prog[m.id]) : 'not completed') + '</div>'; }).join('');
    if (D.arcade && D.arcade.list) h += '<h2>Arcade best scores</h2>' + D.arcade.list().map(function (g) { var v = D.store.get('arcade.best.' + g.id, null); return '<div class="bar"><span>' + g.title + '</span>' + (v != null ? v : '—') + '</div>'; }).join('');
    h += '<h2>Event log</h2><table><thead><tr><th>Time</th><th>Module</th><th>Action</th><th>Details</th><th>Level</th></tr></thead><tbody>' + list.slice().reverse().slice(0, 1500).map(function (e) { return '<tr><td>' + new Date(e.t).toLocaleString() + '</td><td>' + (D.audit.MODULES[e.m] || { label: e.m }).label + '</td><td>' + D.esc(e.a) + '</td><td>' + D.esc(e.d) + '</td><td class="lvl-' + e.l + '">' + e.l + '</td></tr>'; }).join('') + '</tbody></table>';
    if (standalone) return '<!doctype html><html><head><meta charset="utf-8"><title>Daedalus report</title><style>' + css + '</style></head><body>' + h + '</body></html>';
    return { css: css, body: h };
  }
  function exportHTML() {
    D.ui.download('daedalus-report_' + stamp() + '.html', reportHTML(true), 'text/html');
    D.audit.log('audit', 'Exported HTML report', filtered().length + ' events');
  }
  function exportPDF() {
    var r = reportHTML(false);
    var holder = D.el('div', { id: 'printReport', html: '<style>' + r.css.replace(/body\{/, '#printReport{') + '@media print{body>*:not(#printReport){display:none!important}#printReport{display:block!important}} #printReport{display:none}</style>' + r.body });
    document.body.appendChild(holder);
    var done = function () { holder.remove(); D.audit.log('audit', 'Exported PDF report', filtered().length + ' events'); };
    if (global.desktop && global.desktop.savePDF) {
      global.desktop.savePDF('daedalus-report_' + stamp() + '.pdf').then(function (res) { if (res && res.ok) D.ui.toast('Saved PDF to ' + D.esc(res.path), 'good'); done(); }).catch(function () { done(); });
    } else { global.print(); setTimeout(done, 500); }
  }

  D.router.register('audit', { title: 'Audit log', icon: 'audit', mount: mount, show: function () { limit = 200; renderAll(); } });
  D.auditReport = { html: reportHTML };
})(window);
