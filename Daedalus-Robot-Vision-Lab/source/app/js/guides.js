/* guides.js — "How to use" + "About" content for Home, Argus, Echo, Audit log, Settings and Help.
   (Theseus, the Arcade and every game register their own guides next to their code.) */
(function (global) {
  'use strict';
  var D = global.D, A = D.guide.art, W = A.wrap;

  /* ---------- small reusable pictures ---------- */
  function seg2(a, b, on) {
    return '<g transform="translate(25,40)"><rect width="100" height="24" rx="8" fill="var(--surface-3)" stroke="var(--line-2)"/>' +
      '<rect x="' + (on ? 52 : 2) + '" y="2" width="46" height="20" rx="6" fill="var(--accent)"/>' +
      '<text x="25" y="15.5" text-anchor="middle" font-size="8.5" font-weight="700" fill="' + (on ? 'var(--text-2)' : 'var(--accent-ink)') + '">' + a + '</text>' +
      '<text x="75" y="15.5" text-anchor="middle" font-size="8.5" font-weight="700" fill="' + (on ? 'var(--accent-ink)' : 'var(--text-2)') + '">' + b + '</text></g>';
  }
  function camFrame(inner) {
    return '<rect x="30" y="14" width="90" height="70" rx="8" fill="#03070d" stroke="var(--line-2)"/>' + inner +
      '<circle cx="40" cy="22" r="3" fill="var(--red)"/>';
  }
  function faceDots(cx, cy) {
    var o = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="18" ry="23" fill="none" stroke="var(--accent)" stroke-width="1.3"/>';
    for (var i = 0; i < 26; i++) { var a = i / 26 * Math.PI * 2; o += '<circle cx="' + (cx + Math.cos(a) * 15 * (0.6 + (i % 3) * 0.2)) + '" cy="' + (cy + Math.sin(a) * 19 * (0.6 + (i % 2) * 0.3)) + '" r="1" fill="var(--accent)"/>'; }
    return o + '<path d="M' + (cx - 7) + ' ' + (cy + 9) + 'q7 6 14 0" stroke="var(--accent)" fill="none" stroke-width="1.5"/>';
  }
  function handPic(cx, cy, fingers) {
    var f = fingers || [1, 1, 1, 1, 1], o = '<g transform="translate(' + cx + ',' + cy + ')" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" fill="none">';
    o += '<path d="M-10 14 q-4 -10 0 -16 h20 q4 6 0 16z" fill="var(--surface-3)"/>';
    var xs = [-12, -6, 0, 6, 11], L = [8, 14, 16, 14, 11];
    for (var i = 0; i < 5; i++) {
      var len = f[i] ? L[i] : 4;
      if (i === 0) o += '<path d="M-10 4 l' + (f[0] ? -8 : -3) + ' ' + (f[0] ? -6 : -1) + '"/>';
      else o += '<path d="M' + xs[i] + ' -2 v' + (-len) + '"/>';
    }
    return o + '</g>';
  }

  /* ================================================================ HOME */
  D.guide.register('home', {
    title: 'Welcome to Daedalus', badge: D.icon('home'),
    howto: [
      { title: 'Pick a robot from the left', text: 'Each robot teaches one idea: <b>Argus</b> plans paths, <b>Echo</b> reads your face and hands, <b>Theseus</b> solves mazes.', svg: W('<rect x="8" y="10" width="40" height="84" rx="6" fill="var(--surface-3)"/>' + [0, 1, 2].map(function (i) { return '<rect x="13" y="' + (22 + i * 20) + '" width="30" height="12" rx="4" fill="' + (i === 0 ? 'var(--accent)' : 'var(--line-2)') + '"/>'; }).join('') + A.cursor(36, 28) + '<rect x="56" y="10" width="86" height="84" rx="6" fill="var(--surface-2)" stroke="var(--line)"/>' + A.face(99, 52, 22, 'happy')) },
      { title: 'Open “How to use” or “About”', text: 'Every screen has these two buttons in its header. How-to shows the steps with pictures; About explains the idea behind it.', svg: W(A.btn(20, 44, 52, 'How to use', true) + A.btn(78, 44, 52, 'About') + A.cursor(50, 52)) },
      { title: 'Play in the Arcade', text: 'Seven mini-games use the same robots — Mine Sweeper Bot, Snake Bot, Mirror Me, Gesture Simon, Gesture Pilot, Gem Rush and Labyrinth Race.', svg: W('<rect x="25" y="30" width="100" height="46" rx="23" fill="var(--surface-3)" stroke="var(--line-2)"/><path d="M48 46v14M41 53h14" stroke="var(--pink)" stroke-width="3" stroke-linecap="round"/><circle cx="96" cy="47" r="4" fill="var(--accent)"/><circle cx="106" cy="56" r="4" fill="var(--amber)"/><circle cx="88" cy="58" r="4" fill="var(--green)"/>') },
      { title: 'Review everything in the Audit log', text: 'Every action — missions, camera sessions, mazes, scores — is recorded. Export it as CSV, JSON or a printable report.', svg: W('<rect x="30" y="12" width="90" height="80" rx="6" fill="var(--surface-2)" stroke="var(--line-2)"/>' + [0, 1, 2, 3, 4].map(function (i) { return '<rect x="40" y="' + (24 + i * 13) + '" width="' + (60 - i * 6) + '" height="6" rx="3" fill="var(--line-2)"/><circle cx="108" cy="' + (27 + i * 13) + '" r="3" fill="' + ['var(--accent)', 'var(--violet)', 'var(--amber)', 'var(--green)', 'var(--pink)'][i] + '"/>'; }).join('')) },
      { title: 'Choose your theme', text: 'Light, Dark, Black or System — use the switch at the bottom of the sidebar or Settings.', svg: W(seg2('Light', 'Dark', true) + A.cursor(100, 55)) }
    ],
    tips: 'Press <kbd>F1</kbd> on any screen to open its guide.',
    about: {
      hero: '<svg viewBox="0 0 560 170" font-family="Inter">' + [['argus', 'Argus', 'Path planning', '--accent'], ['echo', 'Echo', 'Computer vision', '--violet'], ['theseus', 'Theseus', 'Mazes & search', '--amber']].map(function (r, i) {
        var x = 20 + i * 180;
        return '<g transform="translate(' + x + ',14)"><rect width="160" height="140" rx="16" fill="var(--surface-2)" stroke="var(--line)"/><g transform="translate(50,14) scale(.94)">' + D.avatar(r[0]).replace('<svg viewBox="0 0 64 64">', '<svg width="64" height="64" viewBox="0 0 64 64">') + '</g><text x="80" y="104" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="17" fill="var(--text)">' + r[1] + '</text><text x="80" y="124" text-anchor="middle" font-size="12" fill="var(' + r[3] + ')">' + r[2] + '</text></g>';
      }).join('') + '</svg>',
      intro: '<b>Daedalus</b> — named after the legendary inventor who built the Labyrinth and moving statues — is a desktop lab for exploring how robots <b>see</b>, <b>think</b> and <b>move</b>. Computer vision is the heart of it: Echo watches your face and hands through the webcam and reacts in real time.',
      facts: [['3', 'robots'], ['7', 'arcade games'], ['100%', 'offline']],
      sections: [
        { title: 'The three robots', html: '<ul><li><b>Argus</b> (the many-eyed watchman) — program a route with command cards and see the predicted path before it runs.</li><li><b>Echo</b> (the nymph who repeats) — mirrors your facial expression or reacts to hand gestures.</li><li><b>Theseus</b> (who escaped the Labyrinth) — builds square, circular and hexagonal mazes and solves them with classic search algorithms.</li></ul>' },
        { title: 'Privacy', html: '<p>The camera image is processed on this computer by bundled MediaPipe models. Nothing is uploaded, nothing is recorded — only the text events you see in the Audit log are stored, and you can clear them at any time.</p>' }
      ]
    }
  });

  /* ================================================================ ARGUS */
  var trackSvg = function (hi) {
    return W('<rect x="8" y="8" width="58" height="88" rx="7" fill="var(--surface-2)" stroke="var(--line)"/>' +
      '<g transform="translate(13,16)"><circle cx="5" cy="7" r="5" fill="#22d3ee"/>' + A.card(13, -2, 40, 'Fwd 3', '#38bdf8') + '</g>' +
      '<g transform="translate(13,40)"><circle cx="5" cy="7" r="5" fill="#a78bfa"/>' + A.card(13, -2, 40, 'Right', '#a78bfa') + '</g>' +
      '<g transform="translate(13,64)"><circle cx="5" cy="7" r="5" fill="#f472b6"/>' + A.card(13, -2, 40, 'Fwd 2', '#38bdf8') + '</g>' +
      A.grid(74, 14, 5, 5, 14) +
      '<path d="M81 21 H123" stroke="#22d3ee" stroke-width="3" stroke-dasharray="4 3"/><path d="M123 21 V49" stroke="#f472b6" stroke-width="3" stroke-dasharray="4 3"/>' +
      '<circle cx="123" cy="21" r="5" fill="#22d3ee"/><text x="123" y="24" text-anchor="middle" font-size="7" font-weight="700" fill="#04121a">1</text>' +
      '<circle cx="123" cy="49" r="5" fill="#f472b6"/><text x="123" y="52" text-anchor="middle" font-size="7" font-weight="700" fill="#04121a">3</text>' +
      A.bot(81, 21, 10, 90) + A.flag(123, 50));
  };
  D.guide.register('argus', {
    title: 'Argus · Path Studio', badge: D.avatar('argus'),
    howto: [
      { title: 'Choose Missions or Free play', text: 'Missions teach one skill at a time (5 levels with stars). Free play lets you edit the whole world.', svg: W(seg2('Missions', 'Free play', false) + A.cursor(55, 56)) },
      { title: 'Drag a card into the track', text: 'Grab a card from the <b>Command deck</b> and drop it in the <b>Program track</b>. Too fiddly? Just <b>click</b> a card — it is added at the end.', svg: W(A.card(10, 20, 54, 'Forward', '#38bdf8') + '<rect x="84" y="14" width="58" height="76" rx="7" fill="none" stroke="var(--accent)" stroke-dasharray="4 3"/>' + A.card(90, 44, 46, 'Forward', '#38bdf8') + A.arrow(66, 30, 88, 46) + A.cursor(112, 50)) },
      { title: 'Set the number with − / +', text: 'Forward, Back, Repeat and Wait have a small counter. Each Forward step moves one square.', svg: W('<rect x="16" y="38" width="118" height="28" rx="7" fill="var(--surface)" stroke="#38bdf8"/><rect x="16" y="38" width="5" height="28" fill="#38bdf8"/><text x="30" y="56" font-size="10" font-weight="700" fill="var(--text)">Forward</text><rect x="78" y="43" width="48" height="18" rx="5" fill="var(--surface-3)"/><text x="86" y="56" font-size="10" fill="var(--text-2)">−</text><text x="102" y="56" font-size="10" font-weight="700" fill="var(--text)">3</text><text x="116" y="56" font-size="10" fill="var(--text-2)">+</text>' + A.cursor(118, 54)) },
      { title: 'Read the dashed preview', text: 'Before running, the grid shows a dashed line for <b>every card</b>. The coloured number on the grid matches the number on the card — hover a card to light up its part of the route.', svg: trackSvg() },
      { title: 'Run, Step or Pause', text: 'Press <b>Run</b> (or <kbd>Space</kbd>). The card being executed glows while the robot moves, so you always know which card is doing what. <b>Step</b> runs one action at a time.', svg: W(A.btn(14, 20, 40, '▶ Run', true) + A.btn(58, 20, 36, 'Step') + A.btn(98, 20, 38, 'Reset') + '<rect x="14" y="52" width="122" height="22" rx="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/><rect x="14" y="52" width="5" height="22" fill="#38bdf8"/><text x="26" y="66" font-size="9" font-weight="700" fill="var(--text)">Forward 3  ← running</text>') },
      { title: 'Move the start and the goal', text: 'In Free play use the tools above the grid: <b>Robot</b> (click a cell; click the robot to rotate it), <b>Goal</b>, <b>Wall</b> (drag to paint), <b>Gem</b>, <b>Erase</b>.', svg: W(A.grid(25, 14, 6, 4, 16) + A.bot(33, 22, 11, 90) + A.flag(113, 70) + A.arrow(113, 70, 81, 38, 'var(--green)') + A.flag(81, 38) + A.cursor(84, 42)) },
      { title: 'Drive & record', text: 'Use the arrow pad (or arrow keys / WASD). Each move is <b>written as a card</b> for you. Turn on <b>Hands-free</b> to drive by pointing your finger at the camera: ☝ forward, 👈 👉 turn, 👇 back, 👍 run, ✋ pause.', svg: W('<g transform="translate(20,24)"><rect x="18" y="0" width="16" height="16" rx="4" fill="var(--accent)"/><rect x="0" y="18" width="16" height="16" rx="4" fill="var(--surface-3)"/><rect x="18" y="18" width="16" height="16" rx="4" fill="var(--surface-3)"/><rect x="36" y="18" width="16" height="16" rx="4" fill="var(--surface-3)"/></g>' + A.arrow(76, 44, 92, 44) + A.card(96, 36, 46, 'Fwd 1', '#38bdf8') + handPic(46, 82, [0, 1, 0, 0, 0])) },
      { title: 'Loops and sensors', text: '<b>Repeat</b> and <b>Until goal</b> hold cards inside them. <b>If</b> checks a sensor (wall ahead, gem here…) and runs the “then” or “otherwise” slot. Drop cards into the slots — or click a slot so new cards go inside it.', svg: W('<rect x="16" y="12" width="118" height="80" rx="8" fill="var(--surface)" stroke="#fbbf24"/><rect x="16" y="12" width="5" height="80" fill="#fbbf24"/><text x="28" y="27" font-size="9" font-weight="700" fill="var(--text)">Until goal</text><rect x="30" y="34" width="98" height="52" rx="6" fill="var(--surface-2)" stroke="#34d399"/><text x="38" y="47" font-size="8.5" font-weight="700" fill="var(--text)">If wall ahead</text>' + A.card(44, 52, 56, 'Turn right', '#a78bfa') + A.card(44, 70, 50, 'Forward', '#38bdf8')) }
    ],
    tips: 'Keyboard: <kbd>↑</kbd><kbd>←</kbd><kbd>→</kbd><kbd>↓</kbd> drive &amp; record · <kbd>Space</kbd> run/pause · <kbd>Backspace</kbd> remove last card.',
    about: {
      hero: '<svg viewBox="0 0 560 170" font-family="Inter">' +
        '<g transform="translate(16,20)"><rect width="140" height="130" rx="14" fill="var(--surface-2)" stroke="var(--line)"/><text x="14" y="24" font-size="11" font-weight="700" fill="var(--text-2)">1 · CARDS</text>' + ['Forward 3', 'Turn right', 'Repeat 2×'].map(function (t, i) { return '<rect x="14" y="' + (36 + i * 28) + '" width="112" height="22" rx="6" fill="' + ['#38bdf8', '#a78bfa', '#fbbf24'][i] + '"/><text x="24" y="' + (51 + i * 28) + '" font-size="11" font-weight="700" fill="#06131c">' + t + '</text>'; }).join('') + '</g>' +
        '<path d="M164 85 h40" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#ha)"/>' +
        '<g transform="translate(210,20)"><rect width="140" height="130" rx="14" fill="var(--surface-2)" stroke="var(--line)"/><text x="14" y="24" font-size="11" font-weight="700" fill="var(--text-2)">2 · INTERPRETER</text><text x="14" y="52" font-family="JetBrains Mono" font-size="10" fill="var(--text)">for each card:</text><text x="24" y="70" font-family="JetBrains Mono" font-size="10" fill="var(--accent)">sense()</text><text x="24" y="88" font-family="JetBrains Mono" font-size="10" fill="var(--accent)">act()</text><text x="24" y="106" font-family="JetBrains Mono" font-size="10" fill="var(--violet)">yield step</text></g>' +
        '<path d="M358 85 h40" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#ha)"/>' +
        '<g transform="translate(404,20)"><rect width="140" height="130" rx="14" fill="var(--surface-2)" stroke="var(--line)"/><text x="14" y="24" font-size="11" font-weight="700" fill="var(--text-2)">3 · ROBOT</text>' + A.grid(14, 34, 6, 5, 18).replace('<g transform="translate(14,34)">', '<g transform="translate(16,34)">') + '<path d="M25 43 H97 V97" stroke="#22d3ee" stroke-width="3" stroke-dasharray="5 4" fill="none"/>' + A.bot(25, 43, 14, 90) + A.flag(97, 100) + '</g>' +
        '<defs><marker id="ha" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="var(--accent)"/></marker></defs></svg>',
      intro: '<b>Argus</b> replaces the old Scratch-style block editor with large, numbered <b>command cards</b>. The big change is <b>sync</b>: every card owns a colour and a number, and the grid draws a dashed preview of exactly where each card will take the robot — so the left and right of the screen always tell the same story.',
      facts: [['10', 'card types'], ['5', 'missions + free play'], ['6', 'sensors']],
      sections: [
        { title: 'How the preview works', html: '<p>Every time you change the program, Argus silently runs it in a <b>simulation</b> first (a “dry run”). That produces the list of moves you see as the dashed path, the ghost robot at the end, and the message “reaches the goal in N moves”. When you press Run, the same interpreter drives the real robot step by step.</p>' },
        { title: 'Cards', html: '<ul><li><b>Move</b> — Forward n, Back up n</li><li><b>Turn</b> — Turn left, Turn right, U-turn</li><li><b>Loops</b> — Repeat n times, Until goal</li><li><b>Sense</b> — If (wall ahead / path clear / wall left / wall right / on a gem / at goal) … otherwise …</li><li><b>Feel</b> — change the robot’s face, Wait</li></ul>' },
        { title: 'Missions', html: '<ol style="margin:0;padding-left:18px"><li>First steps — placing a card</li><li>Turn the corner — turning</li><li>Loop patrol — loops</li><li>Smart sensor — conditions</li><li>Gem collector — planning</li></ol><p>Stars depend on how few cards you use. Mission maps are fixed; Free play lets you change the start, the goal and the world.</p>' },
        { title: 'Auto-plan', html: '<p>Auto-plan runs a <b>breadth-first search</b> over every (position, heading) the robot could be in, finds the shortest sequence of moves, then compresses it into cards. It is a great way to check your own route — and a challenge to beat with loops.</p>' }
      ]
    }
  });

  /* ================================================================ ECHO */
  D.guide.register('echo', {
    title: 'Echo · Vision Robot', badge: D.avatar('echo'),
    howto: [
      { title: 'Slide to FACE or HANDS', text: 'The big slider decides what the camera scans. In <b>FACE</b> mode only your face is tracked; in <b>HANDS</b> mode only your hands. They never mix — so each mode stays crisp.', svg: W(seg2('FACE', 'HANDS', false) + A.arrow(60, 80, 98, 80) + A.cursor(100, 56)) },
      { title: 'Start the camera', text: 'Press <b>Start camera</b>. The video is analysed on this computer only — nothing is uploaded or recorded.', svg: W(camFrame(faceDots(75, 50)) + A.btn(46, 88, 58, 'Start camera', true)) },
      { title: 'Calibrate your neutral face', text: 'Relax your face, look at the camera and press <b>Calibrate</b>. Echo then measures every expression relative to <i>your</i> resting face, which makes it much more accurate.', svg: W(camFrame(faceDots(75, 50)) + '<circle cx="75" cy="50" r="30" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="4 3"/>' + A.text(52, 98, 'neutral = 0', 9, 'var(--green)', 700)) },
      { title: 'Make an expression', text: 'Smile, frown, raise your brows, look up and think… Echo shows a confidence bar for each of the 9 expressions and switches its face to the strongest one.', svg: W(A.face(40, 52, 22, 'happy') + A.arrow(66, 52, 86, 52) + '<g transform="translate(92,30)">' + [0.9, 0.3, 0.15, 0.1].map(function (v, i) { return '<rect x="0" y="' + i * 12 + '" width="48" height="6" rx="3" fill="var(--surface-3)"/><rect x="0" y="' + i * 12 + '" width="' + 48 * v + '" height="6" rx="3" fill="' + ['var(--green)', 'var(--amber)', 'var(--violet)', 'var(--red)'][i] + '"/>'; }).join('') + '</g>') },
      { title: 'Mirror my facial motion', text: 'With <b>Mirror</b> on, Echo copies your blinks, eyebrows, mouth and head tilt live — like a robotic mirror. Turn it off to see only the classified expression.', svg: W(faceDots(42, 52) + '<path d="M70 52h12" stroke="var(--accent)" stroke-width="2" stroke-dasharray="3 2"/>' + A.face(110, 52, 24, 'surprised')) },
      { title: 'Switch to HANDS and gesture', text: 'Show one hand. Echo counts which fingers are up and recognises 11 gestures — 👍 👎 ✊ ✋ ☝️ ✌️ 🤟 👌 🤙 🤘 and three fingers. Hold a gesture steady for a moment.', svg: W(camFrame(handPic(75, 56, [1, 0, 0, 0, 0]) + '<text x="62" y="30" font-size="9" fill="#fff" font-weight="700">👍 Thumbs up</text>')) },
      { title: 'Use the gesture chart', text: 'The chart on the right lists every gesture and the expression it triggers. <b>Click</b> a card to preview it on the robot; change the dropdown to <b>remap</b> it.', svg: W([0, 1, 2, 3].map(function (i) { return '<g transform="translate(16,' + (12 + i * 21) + ')"><rect width="118" height="17" rx="5" fill="var(--surface-2)" stroke="' + (i === 1 ? 'var(--accent)' : 'var(--line)') + '"/><text x="6" y="12" font-size="10">' + ['👍', '✌️', '✊', '🤟'][i] + '</text><text x="22" y="12" font-size="8" fill="var(--text)">' + ['Thumbs up', 'Victory', 'Fist', 'Love'][i] + '</text><rect x="74" y="3" width="40" height="11" rx="3" fill="var(--surface-3)"/><text x="78" y="11" font-size="7" fill="var(--text-2)">' + ['Happy', 'Excited', 'Angry', 'Love'][i] + ' ▾</text></g>'; }).join('')) },
      { title: 'No camera? Explore anyway', text: 'Click the expression buttons under the robot or the gesture chart to see every face Echo can make.', svg: W(A.face(75, 46, 26, 'happy') + A.btn(22, 82, 34, '😄') + A.btn(58, 82, 34, '😢') + A.btn(94, 82, 34, '😲')) }
    ],
    tips: 'Good light on your face and a plain background make tracking far more stable. Hand gestures work best 40–80 cm from the camera.',
    about: {
      hero: '<svg viewBox="0 0 560 200" font-family="Inter">' +
        '<g transform="translate(10,40)"><rect width="100" height="80" rx="10" fill="#03070d" stroke="var(--line-2)"/>' + faceDots(50, 40).replace(/var\(--accent\)/g, '#22d3ee') + '<text x="50" y="100" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-2)">Camera</text></g>' +
        '<path d="M116 80h22" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#hb)"/>' +
        '<g transform="translate(144,30)"><rect width="120" height="100" rx="12" fill="var(--surface-2)" stroke="var(--line)"/><text x="60" y="26" text-anchor="middle" font-family="Space Grotesk" font-size="22" font-weight="700" fill="var(--accent)">478</text><text x="60" y="44" text-anchor="middle" font-size="10" fill="var(--text-2)">face landmarks</text><text x="60" y="72" text-anchor="middle" font-family="Space Grotesk" font-size="22" font-weight="700" fill="var(--violet)">21</text><text x="60" y="90" text-anchor="middle" font-size="10" fill="var(--text-2)">hand landmarks</text></g>' +
        '<path d="M270 80h22" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#hb)"/>' +
        '<g transform="translate(298,30)"><rect width="120" height="100" rx="12" fill="var(--surface-2)" stroke="var(--line)"/><text x="60" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-2)">FEATURES</text>' + ['smile', 'brows', 'jaw', 'fingers'].map(function (t, i) { return '<text x="12" y="' + (42 + i * 16) + '" font-size="9.5" fill="var(--text-2)">' + t + '</text><rect x="58" y="' + (35 + i * 16) + '" width="50" height="6" rx="3" fill="var(--surface-3)"/><rect x="58" y="' + (35 + i * 16) + '" width="' + [44, 20, 30, 36][i] + '" height="6" rx="3" fill="' + ['var(--green)', 'var(--amber)', 'var(--violet)', 'var(--accent)'][i] + '"/>'; }).join('') + '</g>' +
        '<path d="M424 80h22" stroke="var(--accent)" stroke-width="2.5" marker-end="url(#hb)"/>' +
        '<g transform="translate(458,26)">' + D.avatar('echo').replace('<svg viewBox="0 0 64 64">', '<svg width="92" height="92" viewBox="0 0 64 64">') + '<text x="46" y="122" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-2)">Echo reacts</text></g>' +
        '<text x="280" y="180" text-anchor="middle" font-size="11" fill="var(--text-3)">All four stages run on your computer, about 30 times per second.</text>' +
        '<defs><marker id="hb" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="var(--accent)"/></marker></defs></svg>',
      intro: 'Echo is the <b>computer-vision</b> robot. A bundled Google MediaPipe model finds <b>478 points</b> on your face and turns them into <b>52 “blendshapes”</b> — numbers for things like “left mouth corner smiling” or “inner brows raised”. Echo uses them two ways: it <b>mirrors</b> them directly onto its own face, and it <b>classifies</b> them into an expression.',
      facts: [['9', 'face expressions'], ['11', 'hand gestures'], ['~30', 'frames / second']],
      sections: [
        { title: 'How expressions are recognised', html: '<ul><li><b>Happy</b> — mouth corners up, cheeks raised</li><li><b>Excited</b> — smile + open mouth + wide eyes</li><li><b>Surprised</b> — jaw open, eyes wide, brows high, no smile</li><li><b>Sad</b> — mouth corners down, inner brows up</li><li><b>Angry</b> — brows pulled down, nose wrinkle, lips pressed</li><li><b>Thinking</b> — eyes up or to the side, lips pursed or pushed sideways</li><li><b>Confused</b> — one eyebrow higher than the other, tilted head</li><li><b>Eager</b> — brows raised, eyes wide, slight smile, leaning in</li><li><b>Neutral</b> — none of the above is strong</li></ul><p>Each rule produces a score; the scores are turned into percentages (softmax) and smoothed over time so the robot does not flicker.</p>' },
        { title: 'How gestures are recognised', html: '<p>The hand model finds 21 joints. For each finger Echo checks whether the tip is further from the wrist than the middle joint and whether the finger is straight — that gives five on/off fingers. Patterns of fingers (plus thumb direction and thumb–index pinch) become gestures. A gesture must be held steady for about a third of a second before it counts.</p>' },
        { title: 'Accessibility', html: '<p>Hand gestures are an extra way to use Daedalus without a mouse: drive Argus hands-free, play Gesture Simon and Gesture Pilot, or steer Snake Bot by pointing.</p>' },
        { title: 'Privacy', html: '<p>Everything runs offline inside the app. Frames are analysed and immediately discarded; only short text events (e.g. “Expression detected: Happy”) go into your local audit log.</p>' }
      ]
    }
  });

  /* ================================================================ AUDIT */
  D.guide.register('audit', {
    title: 'Audit log & reports', badge: D.icon('audit'),
    howto: [
      { title: 'Everything is recorded', text: 'Missions, runs, camera sessions, expressions, gestures, mazes, game scores and settings changes are logged automatically with a time and a module.', svg: W([0, 1, 2, 3].map(function (i) { return '<g transform="translate(14,' + (14 + i * 20) + ')"><circle cx="5" cy="6" r="4" fill="' + ['var(--accent)', 'var(--violet)', 'var(--amber)', 'var(--pink)'][i] + '"/><rect x="14" y="2" width="' + (100 - i * 10) + '" height="8" rx="4" fill="var(--line-2)"/></g>'; }).join('')) },
      { title: 'Filter and search', text: 'Narrow the table by module, level, date or free text. The charts above it update to match.', svg: W('<rect x="16" y="20" width="118" height="20" rx="6" fill="var(--surface-2)" stroke="var(--line-2)"/><circle cx="28" cy="30" r="4" fill="none" stroke="var(--text-2)"/><text x="38" y="33" font-size="9" fill="var(--text-2)">mission…</text>' + A.btn(16, 50, 34, 'Argus', true) + A.btn(54, 50, 34, 'Echo') + A.btn(92, 50, 42, 'Theseus')) },
      { title: 'Read the charts', text: 'See activity per module, your expression mix from camera sessions, mission stars and best game scores.', svg: W('<path d="M20 86V20M20 86h112" stroke="var(--line-2)"/>' + [30, 50, 22, 60, 40].map(function (h, i) { return '<rect x="' + (30 + i * 20) + '" y="' + (86 - h) + '" width="12" height="' + h + '" rx="3" fill="' + ['var(--accent)', 'var(--violet)', 'var(--amber)', 'var(--pink)', 'var(--green)'][i] + '"/>'; }).join('')) },
      { title: 'Export the report', text: 'Download CSV (for Excel), JSON (raw data) or an HTML report. In the desktop app you can also save the report straight to PDF.', svg: W(A.btn(16, 30, 36, 'CSV') + A.btn(57, 30, 36, 'JSON') + A.btn(98, 30, 36, 'PDF', true) + '<path d="M75 60v24M66 76l9 9 9-9" stroke="var(--accent)" stroke-width="2.5" fill="none"/>') }
    ],
    about: {
      intro: 'The audit log is your project history: a timeline of every meaningful action across the whole app, stored locally on this computer (up to the last 5,000 events). Each event has a time, a session id, a module, an action, details and a level (info, success, warning, error).',
      facts: [['5,000', 'events kept'], ['8', 'modules tracked'], ['4', 'export formats']],
      sections: [
        { title: 'Sessions', html: '<p>Each time the app starts a new session id is created, so you can see what happened in one sitting.</p>' },
        { title: 'Clearing', html: '<p>“Clear log” removes all events (it asks first). Exports are a good way to keep a copy.</p>' }
      ]
    }
  });

  /* ================================================================ SETTINGS & HELP */
  D.guide.register('settings', {
    title: 'Settings', badge: D.icon('settings'),
    howto: [
      { title: 'Theme', text: 'Light, Dark, Black (pure black for OLED screens) or System (follows Windows).', svg: W(seg2('Light', 'Dark', true)) },
      { title: 'Accent colour', text: 'Pick the highlight colour used for buttons, paths and glows.', svg: W(['#22d3ee', '#a78bfa', '#a3e635', '#fb923c', '#f472b6'].map(function (c, i) { return '<circle cx="' + (31 + i * 22) + '" cy="52" r="9" fill="' + c + '"' + (i === 0 ? ' stroke="var(--text)" stroke-width="2.5"' : '') + '/>'; }).join('')) },
      { title: 'Camera & vision', text: 'Choose which webcam to use, GPU or CPU processing, gesture hold time and expression sensitivity.', svg: W(camFrame(faceDots(75, 50))) },
      { title: 'Replay Boot Camp', text: 'Run the interactive tutorial again at any time.', svg: W(A.btn(40, 44, 70, 'Replay tutorial', true)) }
    ],
    about: { intro: 'Settings are saved on this computer and apply immediately.' }
  });
  D.guide.register('help', {
    title: 'Help center', badge: D.icon('help'),
    howto: [
      { title: 'Browse all guides', text: 'Every robot, game and tool has a How-to and an About page — all listed in the Help center.', svg: W(A.btn(20, 30, 50, 'How to use', true) + A.btn(80, 30, 50, 'About') + A.btn(20, 56, 50, 'How to use', true) + A.btn(80, 56, 50, 'About')) },
      { title: 'Troubleshoot the camera', text: 'If the camera does not start, close other apps using it (Teams, Zoom), check Windows camera privacy settings and pick the right camera in Settings.', svg: W(camFrame('<path d="M60 40l30 30M90 40l-30 30" stroke="var(--red)" stroke-width="3"/>')) }
    ],
    about: { intro: 'The Help center collects every guide and answers common questions.' }
  });
})(window);
