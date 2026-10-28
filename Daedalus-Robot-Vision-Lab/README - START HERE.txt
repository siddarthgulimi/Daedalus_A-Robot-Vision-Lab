=====================================================================
  DAEDALUS — ROBOT VISION LAB   ·   version 2.0.0
  (the new version of "RoboForge Lite")
=====================================================================

WHAT'S IN THIS ZIP
------------------
  Daedalus-Setup-2.0.0.exe   ← double-click this to install (Windows 10/11, 64-bit)
  README - START HERE.txt    ← this file
  SHA256.txt                 ← checksum of the installer
  source\                    ← full source code (to change or rebuild the app)


INSTALL (2 minutes)
-------------------
  1. Unzip this folder anywhere (e.g. your Desktop).
  2. Double-click  Daedalus-Setup-2.0.0.exe
  3. If Windows shows "Windows protected your PC" (SmartScreen):
       click  More info  →  Run anyway.
     (This appears because the installer is not code-signed with a paid certificate.
      It is safe to run.)
  4. Accept the licence, choose a folder (or keep the default), click Install.
  5. Launch "Daedalus Robot Vision Lab" from the Desktop or the Start menu.

  No internet connection is needed — the computer-vision models are inside the app.
  Uninstall any time: Windows Settings → Apps → Installed apps → Daedalus → Uninstall.


FIRST RUN: BOOT CAMP (mandatory tutorial)
-----------------------------------------
  The first time the app opens, a 7-step interactive "Boot Camp" starts.
  It cannot be skipped; each step has a small task that unlocks "Next":
    1. Meet the robots          — wake up Argus, Echo and Theseus
    2. Place your first card    — drag a Forward card, set the number, run
    3. Move the goal            — click to move the flag, Auto-plan, run
    4. Face or hands?           — use the FACE / HANDS slider
    5. Gestures change faces    — try 3 gestures on the robot
    6. Build & solve a maze     — generate, then watch A* solve it
    7. Make it yours            — pick Light / Dark / Black / System theme
  Replay it any time from Help center or Settings.


THE THREE ROBOTS
----------------
  ARGUS · Path Studio  (the advanced replacement for the old Scratch-style editor)
    • Big numbered command cards: Forward, Back, Turn left/right, U-turn,
      Repeat, Until goal, If <sensor> … otherwise …, Feel, Wait.
    • Drag a card into the track or simply click it.
    • LIVE PREVIEW: the grid shows a dashed path for every card BEFORE you run.
      The coloured number on the grid = the number on the card. Hover a card
      to highlight exactly its part of the route. While running, the active
      card glows — the program and the robot are always in sync.
    • Change the START and the GOAL (Free play): Robot / Goal / Wall / Gem / Erase tools.
    • Drive & record: arrow keys (or the pad) drive the robot and write the cards for you.
    • Hands-free driving (accessibility): point ☝ forward, 👈/👉 turn, 👇 back,
      👍 run, ✋ pause.
    • Auto-plan: the robot computes the shortest route (breadth-first search).
    • 5 default missions (with 1–3 stars): First steps · Turn the corner ·
      Loop patrol · Smart sensor · Gem collector.  Plus Free play.

  ECHO · Vision Robot  (computer vision — the heart of the project)
    • The big FACE ⟷ HANDS slider decides what the camera scans.
      FACE mode runs only the face model; HANDS mode runs only the hand model.
    • FACE: Echo mirrors your blinks, eyebrows, mouth and head tilt live, and
      recognises 9 expressions: Happy, Sad, Angry, Surprised, Thinking,
      Confused, Excited, Eager, Neutral (with live confidence bars).
      Press "Calibrate" with a relaxed face for best accuracy.
    • HANDS: 11 gestures change Echo's expression (remappable in the chart):

          GESTURE            DEFAULT EXPRESSION
          👍 Thumbs up        Happy
          👎 Thumbs down      Sad
          ✊ Fist             Angry
          ✋ Open palm        Neutral
          ☝️ Point            Thinking
          ✌️ Victory          Excited
          🤟 I love you       Love
          👌 OK               Eager
          🤙 Call me          Confused
          3️⃣ Three fingers    Surprised
          🤘 Rock on          Excited

  THESEUS · Maze Lab
    • Square, CIRCULAR and hexagonal mazes.
    • 5 generators (Recursive backtracker, Prim, Kruskal, Wilson, Hunt-and-kill),
      a "loops" slider for multiple routes, Demolish / Rebuild.
    • Move the start and goal, toggle walls by dragging between cells, paint mud.
    • 7 solvers: BFS, DFS, A*, Dijkstra, Greedy, Wall follower, Trémaux.
    • Constraints: battery (move budget), mud cost, fog of war.
    • Analysis + "Compare all solvers" table.


ARCADE (7 games)
----------------
  Mine Sweeper Bot (robot walks the board; auto-solve with explained logic) ·
  Snake Bot (keys or hand pointing) · Mirror Me (copy Echo's face) ·
  Gesture Simon (repeat hand-sign sequences) · Gesture Pilot (steer by pointing) ·
  Gem Rush (8 coding puzzles) · Labyrinth Race (you vs Theseus).


AUDIT LOG & REPORTS
-------------------
  Every action (missions, runs, camera sessions, expressions, gestures, mazes,
  scores, settings) is recorded. Filter by module / level / date / text.
  Export CSV, JSON, an HTML report, or save a PDF report.


HELP EVERYWHERE
---------------
  Every screen and every game has "How to use" (illustrated steps) and
  "About" (explained with diagrams). Press F1 on any screen.
  Themes: Light, Dark, Black, System — bottom of the sidebar or Settings.


CAMERA TROUBLESHOOTING
----------------------
  • Close other apps using the webcam (Teams, Zoom, Camera app).
  • Windows Settings → Privacy & security → Camera → allow desktop apps.
  • Several cameras? Pick one in Settings → Camera & computer vision.
  • If the video freezes, switch Processing from GPU to CPU in Settings and restart.
  • Good, even light on your face gives the best expression accuracy.


PRIVACY
-------
  All computer vision runs offline on your computer (Google MediaPipe models
  bundled inside the app). No image is uploaded or saved.


REBUILDING FROM SOURCE (developers)
-----------------------------------
  Requirements: Node.js 18+ on Windows.
    cd source
    npm install
    npm start              ← run the app in development
    npm run dist           ← creates dist\Daedalus-Setup-2.0.0.exe
  The whole UI is plain HTML/CSS/JavaScript in  source\app\  (no build step).
    app\js\argus.js      Argus path studio      app\js\echo.js     Echo vision robot
    app\js\vision.js     camera + MediaPipe     app\js\robotface.js animated robot face
    app\js\maze.js       maze engine            app\js\theseus.js  maze lab page
    app\js\arcade.js     arcade hub             app\js\games\*     the 7 games
    app\js\tutorial.js   Boot Camp              app\js\audit.js    audit log + reports
    app\js\guides.js     how-to / about pages   app\js\core.js     shared UI, themes, storage
  To rename the app, change "productName" in source\package.json and D.APP_NAME in app\js\core.js.
