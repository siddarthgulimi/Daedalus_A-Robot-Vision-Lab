/* robotface.js — the expressive robot head used by Echo, the arcade and the tutorial.
   new D.RobotFace(container, { name, compact })
     .setExpression(key)              snap toward one of D.EXPRESSIONS
     .setMirror(params | null)        live facial dynamics from the camera (overrides geometry)
     .lookAt(nx, ny)                  gaze in -1..1
     .say(text)                       speech bubble
     .destroy()
*/
(function (global) {
  'use strict';
  var D = global.D;
  var NS = 'http://www.w3.org/2000/svg';

  /* Geometry targets for every expression. */
  var PRESET = {
    neutral:   { eyeOpenL: 1, eyeOpenR: 1, squint: 0, slant: 0, browY: 0, browTilt: 0, smile: 0.1, open: 0, mWidth: 1, skew: 0, blush: 0, roll: 0, gazeY: 0 },
    happy:     { eyeOpenL: 0.9, eyeOpenR: 0.9, squint: 0.85, slant: 0, browY: 0.35, browTilt: 0, smile: 1, open: 0.25, mWidth: 1.15, skew: 0, blush: 0.6, roll: 0, gazeY: 0 },
    sad:       { eyeOpenL: 0.7, eyeOpenR: 0.7, squint: 0, slant: -0.8, browY: 0.1, browTilt: -0.9, smile: -0.85, open: 0.05, mWidth: 0.8, skew: 0, blush: 0, roll: -4, gazeY: 0.5 },
    angry:     { eyeOpenL: 0.75, eyeOpenR: 0.75, squint: 0, slant: 0.9, browY: -0.5, browTilt: 1, smile: -0.5, open: 0.15, mWidth: 0.9, skew: 0, blush: 0, roll: 0, gazeY: 0 },
    surprised: { eyeOpenL: 1.3, eyeOpenR: 1.3, squint: 0, slant: 0, browY: 1, browTilt: -0.2, smile: 0, open: 0.9, mWidth: 0.55, skew: 0, blush: 0, roll: 0, gazeY: 0 },
    thinking:  { eyeOpenL: 0.85, eyeOpenR: 0.6, squint: 0, slant: 0.15, browY: 0.2, browTilt: 0.3, smile: -0.05, open: 0, mWidth: 0.65, skew: 0.75, blush: 0, roll: 7, gazeY: -0.85, gazeX: 0.6 },
    confused:  { eyeOpenL: 1.1, eyeOpenR: 0.7, squint: 0, slant: 0, browY: 0.4, browTilt: 0, browAsym: 1, smile: -0.25, open: 0.1, mWidth: 0.85, skew: -0.6, blush: 0, roll: -9, gazeY: 0 },
    excited:   { eyeOpenL: 1.2, eyeOpenR: 1.2, squint: 0.2, slant: 0, browY: 0.85, browTilt: 0, smile: 1, open: 0.85, mWidth: 1.25, skew: 0, blush: 0.5, roll: 0, gazeY: 0 },
    eager:     { eyeOpenL: 1.15, eyeOpenR: 1.15, squint: 0.15, slant: -0.1, browY: 0.7, browTilt: -0.2, smile: 0.6, open: 0.1, mWidth: 1.05, skew: 0, blush: 0.2, roll: 3, gazeY: -0.1 },
    love:      { eyeOpenL: 0.9, eyeOpenR: 0.9, squint: 0.7, slant: 0, browY: 0.4, browTilt: -0.2, smile: 0.85, open: 0.1, mWidth: 1, skew: 0, blush: 1, roll: 4, gazeY: 0 },
    sleepy:    { eyeOpenL: 0.12, eyeOpenR: 0.12, squint: 0, slant: -0.2, browY: -0.1, browTilt: -0.2, smile: 0, open: 0.15, mWidth: 0.6, skew: 0, blush: 0, roll: -6, gazeY: 0.4 }
  };
  var KEYS = ['eyeOpenL', 'eyeOpenR', 'squint', 'slant', 'browY', 'browTilt', 'browAsym', 'smile', 'open', 'mWidth', 'skew', 'blush', 'roll', 'gazeX', 'gazeY', 'yaw', 'pitch', 'browL', 'browR'];

  function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgbStr(c) { return 'rgb(' + c.map(function (v) { return Math.round(v); }).join(',') + ')'; }

  function RobotFace(container, opts) {
    opts = opts || {};
    this.opts = opts;
    this.container = container;
    this.expr = 'neutral';
    this.mirror = null;
    this.cur = Object.assign({ gazeX: 0, gazeY: 0, yaw: 0, pitch: 0, browAsym: 0, browL: 0, browR: 0 }, PRESET.neutral);
    this.target = Object.assign({}, this.cur);
    this.color = hexToRgb(D.EXPRESSIONS.neutral.color);
    this.targetColor = this.color.slice();
    this.blink = 0; this.nextBlink = performance.now() + 2500;
    this.lookX = 0; this.lookY = 0;
    this.t0 = performance.now();
    this.build();
    var self = this;
    this.raf = requestAnimationFrame(function loop(t) { self.tick(t); self.raf = requestAnimationFrame(loop); });
  }

  RobotFace.prototype.build = function () {
    var id = 'rf' + Math.random().toString(36).slice(2, 7);
    this.id = id;
    var name = this.opts.name || 'ECHO';
    var svg =
      '<svg viewBox="0 0 400 380" xmlns="' + NS + '" class="robot-face-svg">' +
      '<defs>' +
      '<linearGradient id="' + id + 'shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--surface-3)"/><stop offset="1" style="stop-color:var(--surface)"/></linearGradient>' +
      '<radialGradient id="' + id + 'visor" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#0d1a2a"/><stop offset="1" stop-color="#03070d"/></radialGradient>' +
      '<filter id="' + id + 'glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<clipPath id="' + id + 'clip"><rect x="78" y="104" width="244" height="186" rx="44"/></clipPath>' +
      '</defs>' +
      '<g class="rf-root">' +
      '<ellipse cx="200" cy="362" rx="120" ry="10" fill="var(--text-3)" opacity=".15" class="rf-shadow"/>' +
      '<g class="rf-head">' +
      /* antenna */
      '<path class="rf-ant" d="M200 62 L200 26" stroke="var(--line-2)" stroke-width="6" stroke-linecap="round"/>' +
      '<circle class="rf-led" cx="200" cy="20" r="11" filter="url(#' + id + 'glow)"/>' +
      /* ears */
      '<rect x="22" y="150" width="34" height="90" rx="14" fill="url(#' + id + 'shell)" stroke="var(--line-2)" stroke-width="2"/>' +
      '<rect x="344" y="150" width="34" height="90" rx="14" fill="url(#' + id + 'shell)" stroke="var(--line-2)" stroke-width="2"/>' +
      '<rect class="rf-earled" x="31" y="180" width="16" height="30" rx="6" opacity=".9"/>' +
      '<rect class="rf-earled" x="353" y="180" width="16" height="30" rx="6" opacity=".9"/>' +
      /* shell */
      '<rect x="50" y="62" width="300" height="270" rx="70" fill="url(#' + id + 'shell)" stroke="var(--line-2)" stroke-width="2.5"/>' +
      '<path d="M90 76 Q200 58 310 76" stroke="var(--text-3)" stroke-opacity=".25" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      /* visor */
      '<rect x="74" y="100" width="252" height="194" rx="48" fill="url(#' + id + 'visor)" stroke="var(--line-2)" stroke-width="3"/>' +
      '<g clip-path="url(#' + id + 'clip)"><g class="rf-features" filter="url(#' + id + 'glow)">' +
      '<path class="rf-browL" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<path class="rf-browR" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<path class="rf-eyeL" stroke-width="6" stroke-linejoin="round"/>' +
      '<path class="rf-eyeR" stroke-width="6" stroke-linejoin="round"/>' +
      '<circle class="rf-glintL" r="6" fill="#fff" opacity=".85"/>' +
      '<circle class="rf-glintR" r="6" fill="#fff" opacity=".85"/>' +
      '<ellipse class="rf-blushL" rx="20" ry="9" fill="#fb7185"/>' +
      '<ellipse class="rf-blushR" rx="20" ry="9" fill="#fb7185"/>' +
      '<path class="rf-mouth" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</g>' +
      '<rect x="74" y="100" width="252" height="194" fill="url(#' + id + 'scan)" opacity=".5"/>' +
      '</g>' +
      '<path d="M100 118 Q130 106 170 108" stroke="#fff" stroke-opacity=".12" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      /* chin plate */
      '<rect x="160" y="304" width="80" height="14" rx="7" fill="var(--surface-2)" stroke="var(--line-2)"/>' +
      '<text x="200" y="314.5" text-anchor="middle" font-family="JetBrains Mono" font-size="9" letter-spacing="2" fill="var(--text-3)">' + name + '</text>' +
      /* accessories */
      '<g class="rf-acc">' +
      '<g class="acc-question"><text x="318" y="92" font-family="Space Grotesk" font-weight="700" font-size="64" fill="#fb923c">?</text></g>' +
      '<g class="acc-dots"><circle cx="300" cy="66" r="7" fill="#22d3ee"/><circle cx="324" cy="48" r="10" fill="#22d3ee"/><circle cx="354" cy="26" r="14" fill="#22d3ee"/></g>' +
      '<g class="acc-tear"><path d="M128 214 q-9 16 0 22 q9 -6 0 -22z" fill="#60a5fa"/></g>' +
      '<g class="acc-steam"><path d="M66 70 q-12 -14 0 -26 q12 -12 0 -26" stroke="#f87171" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M334 70 q12 -14 0 -26 q-12 -12 0 -26" stroke="#f87171" stroke-width="6" fill="none" stroke-linecap="round"/></g>' +
      '<g class="acc-spark"><path d="M50 60 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z" fill="#fbbf24"/><path d="M346 50 l5 11 11 5 -11 5 -5 11 -5 -11 -11 -5 11 -5z" fill="#f472b6"/><path d="M360 250 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill="#22d3ee"/></g>' +
      '<g class="acc-bang"><text x="330" y="100" font-family="Space Grotesk" font-weight="700" font-size="70" fill="#fbbf24">!</text></g>' +
      '<g class="acc-heart"><path d="M330 70 c-10 -18 -34 -6 -22 12 l22 20 22 -20 c12 -18 -12 -30 -22 -12z" fill="#fb7185"/><path d="M60 100 c-6 -11 -20 -4 -13 7 l13 12 13 -12 c7 -11 -7 -18 -13 -7z" fill="#f472b6"/></g>' +
      '<g class="acc-zzz"><text x="300" y="80" font-family="Space Grotesk" font-weight="700" font-size="34" fill="#94a3b8">z</text><text x="326" y="54" font-family="Space Grotesk" font-weight="700" font-size="26" fill="#94a3b8">z</text><text x="346" y="34" font-family="Space Grotesk" font-weight="700" font-size="18" fill="#94a3b8">z</text></g>' +
      '<g class="acc-bolt"><path d="M332 44 l-16 30 h14 l-10 26 26 -36 h-14 l10 -20z" fill="#a3e635"/></g>' +
      '</g>' +
      '</g></g>' +
      '<defs><pattern id="' + id + 'scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".04"/></pattern></defs>' +
      '</svg>';
    var host = D.el('div', { class: 'face-host', html: svg });
    this.bubble = D.el('div', { class: 'rf-bubble' });
    host.appendChild(this.bubble);
    host.style.position = 'relative';
    this.container.appendChild(host);
    this.host = host;
    var q = function (c) { return host.querySelector('.' + c); };
    this.n = {
      root: q('rf-root'), head: q('rf-head'), features: q('rf-features'), led: q('rf-led'), ears: host.querySelectorAll('.rf-earled'),
      eyeL: q('rf-eyeL'), eyeR: q('rf-eyeR'), browL: q('rf-browL'), browR: q('rf-browR'), mouth: q('rf-mouth'),
      glintL: q('rf-glintL'), glintR: q('rf-glintR'), blushL: q('rf-blushL'), blushR: q('rf-blushR'), shadow: q('rf-shadow'),
      acc: {
        confused: q('acc-question'), thinking: q('acc-dots'), sad: q('acc-tear'), angry: q('acc-steam'), excited: q('acc-spark'),
        surprised: q('acc-bang'), love: q('acc-heart'), sleepy: q('acc-zzz'), eager: q('acc-bolt')
      }
    };
    this.accOp = {};
    for (var k in this.n.acc) { this.accOp[k] = 0; this.n.acc[k].style.opacity = 0; }
  };

  RobotFace.prototype.setExpression = function (key, instant) {
    if (!PRESET[key]) key = 'neutral';
    this.expr = key;
    var p = PRESET[key];
    var t = this.target;
    KEYS.forEach(function (k) { if (k in p) t[k] = p[k]; else if (k === 'gazeX' || k === 'browAsym' || k === 'yaw' || k === 'pitch') t[k] = 0; });
    this.targetColor = hexToRgb((D.EXPRESSIONS[key] || D.EXPRESSIONS.neutral).color);
    if (instant) { Object.assign(this.cur, t); this.color = this.targetColor.slice(); }
  };
  RobotFace.prototype.getExpression = function () { return this.expr; };

  /* Mirror params from the camera (all optional):
     eyeOpenL, eyeOpenR (0..1.3), browL, browR (-1..1), smile (-1..1), open (0..1), mWidth, skew, yaw, pitch, roll (deg), gazeX, gazeY */
  RobotFace.prototype.setMirror = function (params) { this.mirror = params; };
  RobotFace.prototype.lookAt = function (x, y) { this.lookX = x; this.lookY = y; };

  RobotFace.prototype.say = function (text, ms) {
    var b = this.bubble;
    if (!text) { b.classList.remove('show'); return; }
    b.textContent = text; b.classList.add('show');
    clearTimeout(this._sayT);
    this._sayT = setTimeout(function () { b.classList.remove('show'); }, ms || 2600);
  };

  RobotFace.prototype.tick = function (now) {
    var c = this.cur, t = Object.assign({}, this.target);
    var m = this.mirror;
    if (m) {
      for (var k in m) if (m[k] != null && !isNaN(m[k])) t[k] = m[k];
    } else {
      t.gazeX = (t.gazeX || 0) * 0.6 + this.lookX * 0.6;
      t.gazeY = (t.gazeY || 0) * 0.6 + this.lookY * 0.5;
      t.yaw = this.lookX * 10; t.pitch = this.lookY * 6;
    }
    var rate = m ? 0.45 : 0.16;
    KEYS.forEach(function (k) { c[k] = D.lerp(c[k] || 0, t[k] || 0, rate); });
    for (var i = 0; i < 3; i++) this.color[i] = D.lerp(this.color[i], this.targetColor[i], 0.12);

    /* automatic blinking when not mirroring */
    var blinkK = 1;
    if (!m && this.expr !== 'sleepy') {
      if (now > this.nextBlink) { this.blink = 1; this.nextBlink = now + 2200 + Math.random() * 3200; }
      if (this.blink > 0) { this.blink = Math.max(0, this.blink - 0.16); blinkK = 1 - Math.sin(this.blink * Math.PI) * 0.95; }
    }
    var tt = (now - this.t0) / 1000;
    var col = rgbStr(this.color);
    var n = this.n;

    /* head pose */
    var bob = this.opts.still ? 0 : Math.sin(tt * 1.6) * 3;
    var excitedBounce = (this.expr === 'excited' && !m) ? Math.abs(Math.sin(tt * 8)) * -8 : 0;
    var angryShake = (this.expr === 'angry' && !m) ? Math.sin(tt * 40) * 1.2 : 0;
    n.head.setAttribute('transform', 'translate(' + (c.yaw * 1.6 + angryShake) + ',' + (bob + excitedBounce + c.pitch * 1.2) + ') rotate(' + c.roll + ' 200 200)');
    n.shadow.setAttribute('rx', 120 - (bob + excitedBounce) * 1.5);
    n.features.setAttribute('transform', 'translate(' + (c.yaw * 1.8) + ',' + (c.pitch * 1.6) + ')');

    /* eyes */
    var self = this;
    function eye(cx, open, slantSign, glint, which) {
      var w = 58, h = 62 * Math.max(0.05, open * blinkK);
      var cy = 182;
      var sl = c.slant * 16 * slantSign;          // positive slant → inner corner lower (angry)
      var top = cy - h / 2, bot = cy + h / 2;
      var xl = cx - w / 2, xr = cx + w / 2;
      var tl = top + (slantSign > 0 ? -sl : sl) * 0.5, tr = top + (slantSign > 0 ? sl : -sl) * 0.5;
      tl = Math.min(tl, bot - 4); tr = Math.min(tr, bot - 4);
      var sq = D.clamp(c.squint, 0, 1) * h * 0.95;
      var d = 'M' + xl + ' ' + (tl + 10) + ' Q' + xl + ' ' + tl + ' ' + (xl + 10) + ' ' + tl +
        ' L' + (xr - 10) + ' ' + tr + ' Q' + xr + ' ' + tr + ' ' + xr + ' ' + (tr + 10) +
        ' L' + xr + ' ' + (bot - 6) + ' Q' + cx + ' ' + (bot - sq * 1.6) + ' ' + xl + ' ' + (bot - 6) + ' Z';
      var el = which === 'L' ? n.eyeL : n.eyeR;
      el.setAttribute('d', d); el.setAttribute('fill', col); el.setAttribute('stroke', col);
      var gx = cx + D.clamp(c.gazeX, -1, 1) * 12 - 10, gy = cy - h * 0.18 + D.clamp(c.gazeY, -1, 1) * 10;
      glint.setAttribute('cx', gx); glint.setAttribute('cy', gy);
      glint.setAttribute('opacity', h > 18 && sq < h * 0.5 ? 0.85 : 0);
      return top;
    }
    var topL = eye(146, c.eyeOpenL, 1, n.glintL, 'L');
    var topR = eye(254, c.eyeOpenR, -1, n.glintR, 'R');

    /* brows: browY raises, browTilt rotates (positive = inner end down = angry) */
    function brow(cx, side, topY, extra) {
      var y = Math.min(topY - 14, 150) - (c.browY + extra) * 14;
      var tilt = c.browTilt * 12;
      var inner = side === 'L' ? cx + 26 : cx - 26, outer = side === 'L' ? cx - 26 : cx + 26;
      var yi = y + tilt, yo = y - tilt * 0.4;
      return 'M' + outer + ' ' + yo + ' Q' + cx + ' ' + (Math.min(yi, yo) - 6) + ' ' + inner + ' ' + yi;
    }
    var asym = c.browAsym * 0.9;
    n.browL.setAttribute('d', brow(146, 'L', topL, (c.browL || 0) + asym));
    n.browR.setAttribute('d', brow(254, 'R', topR, (c.browR || 0) - asym * 0.6));
    n.browL.setAttribute('stroke', col); n.browR.setAttribute('stroke', col);

    /* mouth */
    var mw = 78 * D.clamp(c.mWidth, 0.4, 1.5), mx = 200 + c.skew * 22, my = 252;
    var s = D.clamp(c.smile, -1, 1), o = D.clamp(c.open, 0, 1);
    var cornerY = my - s * 16 + Math.abs(c.skew) * 0;
    var lY = cornerY + c.skew * 8, rY = cornerY - c.skew * 8;
    var upper = my + s * 6 - o * 4;
    var lower = my + s * 22 + o * 46;
    var dm = 'M' + (mx - mw / 2) + ' ' + lY + ' Q' + mx + ' ' + upper + ' ' + (mx + mw / 2) + ' ' + rY + ' Q' + mx + ' ' + lower + ' ' + (mx - mw / 2) + ' ' + lY + ' Z';
    n.mouth.setAttribute('d', dm);
    n.mouth.setAttribute('stroke', col);
    n.mouth.setAttribute('fill', o > 0.08 || s > 0.4 ? col : 'none');
    n.mouth.setAttribute('fill-opacity', o > 0.08 ? 0.35 + o * 0.4 : 0.5);

    /* blush */
    var bl = D.clamp(c.blush, 0, 1);
    n.blushL.setAttribute('cx', 116); n.blushL.setAttribute('cy', 232); n.blushL.setAttribute('opacity', bl * 0.55);
    n.blushR.setAttribute('cx', 284); n.blushR.setAttribute('cy', 232); n.blushR.setAttribute('opacity', bl * 0.55);

    /* LED + ear lights */
    var pulse = 0.6 + Math.sin(tt * (this.expr === 'excited' || this.expr === 'angry' ? 9 : 2.4)) * 0.4;
    n.led.setAttribute('fill', col); n.led.setAttribute('opacity', 0.55 + pulse * 0.45);
    for (var e = 0; e < n.ears.length; e++) { n.ears[e].setAttribute('fill', col); n.ears[e].setAttribute('opacity', 0.35 + pulse * 0.5); }

    /* accessories fade */
    for (var a in n.acc) {
      var want = a === this.expr ? 1 : 0;
      this.accOp[a] = D.lerp(this.accOp[a], want, 0.15);
      var g = n.acc[a];
      g.style.opacity = this.accOp[a].toFixed(3);
      if (this.accOp[a] > 0.01) {
        var anim = '';
        if (a === 'thinking') anim = 'translate(0,' + Math.sin(tt * 3) * 3 + ')';
        else if (a === 'sad') anim = 'translate(0,' + ((tt * 40) % 60) + ')';
        else if (a === 'excited' || a === 'love') anim = 'translate(0,' + Math.sin(tt * 4) * 5 + ')';
        else if (a === 'sleepy') anim = 'translate(' + Math.sin(tt * 2) * 4 + ',' + Math.sin(tt * 1.3) * 4 + ')';
        else if (a === 'angry') anim = 'translate(0,' + Math.sin(tt * 10) * 3 + ')';
        else if (a === 'surprised' || a === 'confused' || a === 'eager') anim = 'translate(0,' + Math.sin(tt * 5) * 3 + ')';
        g.setAttribute('transform', anim);
      }
    }
  };

  RobotFace.prototype.destroy = function () { cancelAnimationFrame(this.raf); this.host.remove(); };
  RobotFace.PRESET = PRESET;
  D.RobotFace = RobotFace;

  /* Small static SVG avatars for cards, badges and guides */
  D.avatar = function (kind, mood) {
    var col = 'var(--accent)';
    if (kind === 'argus') {
      return '<svg viewBox="0 0 64 64"><rect x="12" y="22" width="40" height="30" rx="9" fill="var(--surface-3)" stroke="var(--line-2)" stroke-width="2"/><rect x="17" y="27" width="30" height="16" rx="6" fill="#06101a"/><circle cx="25" cy="35" r="3.4" fill="' + col + '"/><circle cx="39" cy="35" r="3.4" fill="' + col + '"/><circle cx="32" cy="35" r="1.6" fill="' + col + '" opacity=".6"/><path d="M32 22v-8" stroke="var(--line-2)" stroke-width="2.5"/><circle cx="32" cy="12" r="3.5" fill="' + col + '"/><rect x="8" y="46" width="12" height="10" rx="3" fill="var(--line-2)"/><rect x="44" y="46" width="12" height="10" rx="3" fill="var(--line-2)"/></svg>';
    }
    if (kind === 'theseus') {
      return '<svg viewBox="0 0 64 64"><path d="M14 30 Q32 6 50 30 V48 Q32 56 14 48z" fill="var(--surface-3)" stroke="var(--line-2)" stroke-width="2"/><path d="M14 30 L6 22 M50 30 L58 22" stroke="var(--amber)" stroke-width="3" stroke-linecap="round"/><rect x="20" y="32" width="24" height="10" rx="5" fill="#06101a"/><rect x="23" y="35" width="7" height="4" rx="2" fill="var(--amber)"/><rect x="34" y="35" width="7" height="4" rx="2" fill="var(--amber)"/><path d="M32 8v6" stroke="var(--amber)" stroke-width="2"/></svg>';
    }
    if (kind === 'arcade') {
      return '<svg viewBox="0 0 64 64"><rect x="8" y="20" width="48" height="28" rx="14" fill="var(--surface-3)" stroke="var(--line-2)" stroke-width="2"/><path d="M20 29v10M15 34h10" stroke="var(--pink)" stroke-width="3" stroke-linecap="round"/><circle cx="41" cy="31" r="3" fill="var(--accent)"/><circle cx="47" cy="37" r="3" fill="var(--amber)"/><circle cx="35" cy="37" r="3" fill="var(--green)"/></svg>';
    }
    /* echo */
    return '<svg viewBox="0 0 64 64"><rect x="10" y="14" width="44" height="40" rx="14" fill="var(--surface-3)" stroke="var(--line-2)" stroke-width="2"/><rect x="15" y="20" width="34" height="27" rx="9" fill="#06101a"/><rect x="21" y="26" width="7" height="8" rx="2.5" fill="var(--violet)"/><rect x="36" y="26" width="7" height="8" rx="2.5" fill="var(--violet)"/><path d="M24 39q8 6 16 0" stroke="var(--violet)" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M32 14V7" stroke="var(--line-2)" stroke-width="2.5"/><circle cx="32" cy="6" r="3" fill="var(--violet)"/></svg>';
  };
})(window);
