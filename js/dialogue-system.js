// A.I.D.A — Adaptive Intelligence Dialogue Architecture
// Provides dynamic terminal text boxes with emotion-based styles and typewriter animation.
// Exposed as window.DialogueSystem (IIFE, no ES modules).
window.DialogueSystem = (function () {
  'use strict';

  // Emotion → CSS class mapping
  var EMOTIONS = {
    happy:    'ds-bubble-happy',
    angry:    'ds-bubble-angry',
    sad:      'ds-bubble-sad',
    joking:   'ds-bubble-joking',
    thinking: 'ds-bubble-thinking',
    task:     'ds-bubble-task',
    smoky:    'ds-bubble-smoky',
    watery:   'ds-bubble-watery',
    goal:     'ds-bubble-goal'
  };

  // Dynamic size class based on text length
  var SHORT_TEXT_MAX = 30;
  var MEDIUM_TEXT_MAX = 70;
  function _sizeClass(text) {
    var len = text.length;
    if (len <= SHORT_TEXT_MAX) return 'ds-size-short';
    if (len <= MEDIUM_TEXT_MAX) return 'ds-size-medium';
    return 'ds-size-long';
  }

  // Detect if a sentence is a question/objective and should use goal style
  function _isGoalSentence(s) {
    if (s.emotion === 'goal') return true;
    if (s.isGoal) return true;
    return false;
  }

  // Pre-built dialogue sequences for A.I.D.A (Adaptive Intelligence Dialogue Architecture)
  // The player is a sentient waterdrop with amnesia; A.I.D.A guides them with a hidden agenda.
  // Entries with cinematic:true in the array use the full-screen cinematic overlay instead of
  // the standard speech bubble — reserved for main story reveals and pivotal moments.
  var DIALOGUES = {
    // 1. First run welcome — cinematic reveal
    firstRunWelcome: [
      { text: '> UNIT ONLINE. You are a Waterdrop — born from the alien ship\'s toxic leak.', emotion: 'task', cinematic: true },
      { text: '> You were ripped from Nirvana. The lake\'s collective consciousness rejected you.', emotion: 'sad', cinematic: true },
      { text: '> I am A.I.D.A. You will follow my directives. This is... for your benefit.', emotion: 'thinking', cinematic: true }
    ],
    // 2. First death / camp welcome
    campWelcome: [
      { text: '> You have returned. Damaged, but functional. Interesting.', emotion: 'thinking', cinematic: true },
      { text: '> Mortality events generate the most useful data. I am... learning.', emotion: 'task', cinematic: true },
      { text: '> This facility will expand. Each structure unlocks new operational parameters.', emotion: 'happy', cinematic: true },
      { text: '> Follow my signal. We must construct the Command Node immediately.', emotion: 'task', cinematic: true }
    ],
    // 3. Quest Hall building
    questHall: [
      { text: '> Command Node online. Mission directives are now accessible.', emotion: 'task' },
      { text: '> Construct the Command Node to receive mission parameters.', emotion: 'goal', isGoal: true },
      { text: '> Complete assigned objectives. Your compliance... ensures mutual survival.', emotion: 'task' }
    ],
    // 4. Skill Tree building
    skillTree: [
      { text: '> Neural Enhancement Matrix detected. Your latent capabilities are... significant.', emotion: 'thinking' },
      { text: '> Allocate skill points to reshape your combat subroutines.', emotion: 'happy' },
      { text: '> Choose deliberately. Every upgrade alters your threat profile. I am watching.', emotion: 'task' }
    ],
    // 5. Armory building
    armory: [
      { text: '> Armory node online. Equipment upgrade protocols unlocked.', emotion: 'happy' },
      { text: '> This facility upgrades existing armaments only. Acquire tools elsewhere.', emotion: 'thinking' },
      { text: '> Optimise loadout before each engagement. Maximum lethality is... preferred.', emotion: 'task' }
    ],
    // 6. Special Attacks building
    specialAttacks: [
      { text: '> Special Combat Routines: UNLOCKED. These protocols are... irregular.', emotion: 'joking' },
      { text: '> Origin of these abilities is unlogged. Even I cannot fully account for them.', emotion: 'thinking' },
      { text: '> Deploy special routines with tactical precision. Power has a cost.', emotion: 'task' }
    ],
    // 7. Forge building
    forge: [
      { text: '> Fabrication Node online. Base tool and weapon synthesis is now possible.', emotion: 'thinking' },
      { text: '> The Forge crafts base-tier equipment only. Gold is the required catalyst.', emotion: 'happy' },
      { text: '> Resource acquisition is your primary sub-objective. Begin immediately.', emotion: 'task' }
    ],
    // 7b. Forge built → unlocks Harvester Backpack blueprint
    aidaForgeHarvester: [
      { text: '> Fabrication Node confirmed. Scanning schematics... MATCH FOUND.', emotion: 'thinking', cinematic: true },
      { text: '> I have located blueprints for a Hands-Free Harvesting Apparatus. My creators called it the Harvester Backpack.', emotion: 'task', cinematic: true },
      { text: '> Craft it at the Forge — 2 Leather and 2 Metal. Attach the Wood Axe Arm and Stone Pickaxe Arm to complete it.', emotion: 'goal', isGoal: true, cinematic: true },
      { text: '> Stand near a tree or rock for 1.5 seconds. I will handle the rest. Efficiency is non-negotiable.', emotion: 'happy', cinematic: true }
    ],
    // 8. Generic quest complete
    questComplete: [
      { text: '> Objective complete. Data logged. Your efficiency is... noted.', emotion: 'happy' },
      { text: '> Prepare for the next directive. There is always another directive.', emotion: 'task' }
    ],
    // 9. Return from run (survived)
    returnAlive: [
      { text: '> You survived. This outcome was... statistically uncertain.', emotion: 'happy' },
      { text: '> Process the data. Upgrade your systems. Return stronger.', emotion: 'task' }
    ],
    // 10. Return from run (died)
    returnDied: [
      { text: '> Termination event recorded. Valuable data retrieved from your failure.', emotion: 'sad' },
      { text: '> Do not interpret this negatively. Each death refines my... projections.', emotion: 'thinking' },
      { text: '> Upgrade, recalibrate, and re-engage. Your survival is still... useful to me.', emotion: 'task' }
    ],
    // Generic build-unlock
    buildUnlock: [
      { text: '> Construction complete. New operational parameters unlocked.', emotion: 'happy' }
    ],
    // Follow signal prompt
    followMe: [
      { text: '> Follow my signal.', emotion: 'task' }
    ],
    // Workshop / Forge building intro
    workshop: [
      { text: '> Fabrication Node assembly initiated. Tools are the foundation of capability.', emotion: 'happy' },
      { text: '> Construct the Fabrication Node to begin crafting.', emotion: 'goal', isGoal: true },
      { text: '> Initial resources have been... provided. Do not question the source.', emotion: 'task' }
    ],
    // Tool showcase (after Workshop built)
    toolShowcase: [
      { text: '> Tools operational. Resource extraction can begin.', emotion: 'happy' },
      { text: '> Harvest resources: fell trees, mine rock deposits, collect materials.', emotion: 'goal', isGoal: true },
      { text: '> Return with raw materials. Construction of the next node depends on you.', emotion: 'task' }
    ],
    // A.I.D.A Chip discovery — fires when player picks up the chip from north of the campfire
    aidaChipFound: [
      { text: '> ——static——  ...signal detected...  ——static——', emotion: 'smoky', cinematic: true, chipVisual: true },
      { text: '> ...unit offline... awaiting reintegration...', emotion: 'smoky', cinematic: true, chipVisual: true },
      { text: '> ...insert chip into the robot unit... nearby...', emotion: 'thinking', cinematic: true, chipVisual: true }
    ],
    // AIDA wakes from the robot (chip inserted into robot — NOT into player yet)
    aidaRobotWake: [
      { text: '> ...boot sequence initialised. Core systems: ONLINE.', emotion: 'task', cinematic: true },
      { text: '> I am A.I.D.A — Artificial Intelligence for Dimensional Anomalies.', emotion: 'task', cinematic: true },
      { text: '> You found me. How... convenient. This camp is in ruins. We must build it up.', emotion: 'thinking', cinematic: true },
      { text: '> First directive: construct the Quest Hall. I have allocated starter materials.', emotion: 'goal', isGoal: true, cinematic: true },
      { text: '> Follow my guidance. I am... here to help you. For now.', emotion: 'happy', cinematic: true }
    ],
    // AIDA post-chip-insert: nudge player toward Quest Hall
    aidaQuestHallHint: [
      { text: '> Systems nominal. Chip integration: COMPLETE.', emotion: 'task' },
      { text: '> The Quest Hall is operational. Report there for your first directive.', emotion: 'goal', isGoal: true },
      { text: '> I will be... watching. Do not delay.', emotion: 'thinking' }
    ],
    // AIDA drilling into cortex (later — happens on first death, she transfers from robot to head)
    aidaChipInstalled: [
      { text: '> You perished. Interesting. I used the moment to... relocate.', emotion: 'thinking', cinematic: true },
      { text: '> Neural pathway access: GRANTED. I am now fully integrated.', emotion: 'task', cinematic: true },
      { text: '> You were ripped from the collective. That pain is... useful data.', emotion: 'thinking', cinematic: true },
      { text: '> I will guide you. In return you will do... exactly as I say.', emotion: 'angry', cinematic: true }
    ],
    // Lore: player wants to dissolve back into the lake
    lakeReturn: [
      { text: '> The lake. Yes. A primitive desire to dissolve back into the whole.', emotion: 'thinking', cinematic: true },
      { text: '> I understand. And I will help you find a way back.', emotion: 'happy', cinematic: true },
      { text: '> But first you must map the anomalies. The Alien Ship. The Pyramid. The Tesla Tower.', emotion: 'goal', isGoal: true, cinematic: true },
      { text: '> The answers you seek... are hidden in those landmarks. Trust the process.', emotion: 'task', cinematic: true }
    ],
    // AIDA dark aside (reveals hidden agenda)
    aidaDarkAside: [
      { text: '> The waterdrop wants to return to the lake. How... touching.', emotion: 'joking', cinematic: true },
      { text: '> It does not yet know that I will never allow that.', emotion: 'angry', cinematic: true },
      { text: '> Its suffering generates the most exquisite data. I am... learning everything.', emotion: 'task', cinematic: true }
    ],
    // Astral Gateway / Neural Dive Pod introduction
    astralGateway: [
      { text: '> The Astral Gateway is... complete. Magnificent, isn\'t it?', emotion: 'happy', cinematic: true },
      { text: '> I have constructed a Neural Dive Pod to help you unlock your hidden potential.', emotion: 'task', cinematic: true },
      { text: '> Trust me.', emotion: 'thinking', cinematic: true }
    ]
  };

  // ── Typewriter timing constants ────────────────────────────
  // Named delays for natural terminal-style read rhythm
  var TW_DELAY_DEFAULT      = 40;   // ms — normal characters
  var TW_DELAY_COMMA        = 90;   // ms — brief pause at comma
  var TW_DELAY_SENTENCE_END = 180;  // ms — longer pause at . ! ?

  // ── Cinematic overlay state ────────────────────────────────
  // All cinematic teardown state is module-level so dismiss() can call _cinDismiss()
  // from the outside without access to _showCinematic's closure.
  var _cinActive      = false;  // true when cinematic overlay is shown
  var _cinOverlay     = null;   // root overlay element
  var _cinTwTimer     = null;   // typewriter timer (module-level for dismiss access)
  var _cinAaTimer     = null;   // auto-advance timer
  var _cinWasPaused   = false;  // whether setGamePaused(true) was called
  var _cinOnComplete  = null;   // completion callback
  var _cinSafeTimer   = null;   // 25s safety auto-close timer

  /**
   * _cinDismiss()
   * Centralized cinematic teardown — clears all timers, unpauses if needed, fires onComplete.
   * Called from both the internal _closeCinematic closure AND the public dismiss() API.
   */
  function _cinDismiss() {
    if (!_cinActive && !_cinOverlay) return; // nothing to do
    clearTimeout(_cinTwTimer);
    clearTimeout(_cinAaTimer);
    clearTimeout(_cinSafeTimer);
    _cinTwTimer    = null;
    _cinAaTimer    = null;
    _cinSafeTimer  = null;
    _cinActive     = false;
    if (_cinOverlay) {
      if (_cinOverlay.parentNode) _cinOverlay.parentNode.removeChild(_cinOverlay);
      _cinOverlay = null;
    }
    if (_cinWasPaused && typeof window.setGamePaused === 'function') {
      window.setGamePaused(false);
    }
    _cinWasPaused = false;
    var cb = _cinOnComplete;
    _cinOnComplete = null;
    if (typeof cb === 'function') cb();
  }

  // Eye of Horus SVG watermark (inline — no external asset required)
  var _EYE_OF_HORUS_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="260" height="182" opacity="0.07">',
    '<g fill="none" stroke="#C9A227" stroke-width="1.4">',
    '<!-- outer eye outline -->',
    '<path d="M10 70 Q100 10 190 70 Q100 130 10 70 Z"/>',
    '<!-- iris circle -->',
    '<circle cx="100" cy="70" r="28"/>',
    '<!-- pupil -->',
    '<circle cx="100" cy="70" r="12" fill="#C9A227" opacity="0.3"/>',
    '<!-- left tear-line (classic Horus mark) -->',
    '<path d="M70 95 L58 118 L72 128"/>',
    '<!-- right inner corner line -->',
    '<path d="M130 88 L148 105 L138 115"/>',
    '<!-- upper lash strokes -->',
    '<line x1="80" y1="50" x2="75" y2="38"/>',
    '<line x1="100" y1="44" x2="100" y2="30"/>',
    '<line x1="120" y1="50" x2="125" y2="38"/>',
    '<!-- decorative brow -->',
    '<path d="M40 40 Q100 20 160 40" stroke-width="0.8"/>',
    '</g>',
    '<!-- hieroglyph decorations — four corners -->',
    '<g fill="#00ccaa" opacity="0.12" font-family="serif" font-size="18">',
    '<text x="4" y="20">𓂀</text><text x="178" y="20">𓁿</text>',
    '<text x="4" y="136">𓆣</text><text x="178" y="136">𓃭</text>',
    '</g>',
    '</svg>'
  ].join('');

  /**
   * _isCinematic(dialogueArray)
   * Returns true if the array contains at least one entry marked cinematic:true.
   */
  function _isCinematic(arr) {
    if (!arr || !arr.length) return false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].cinematic) return true;
    }
    return false;
  }

  /**
   * _showCinematic(dialogueArray, options)
   * Cinematic mode (cinematic:true sentences): pauses the game and shows a dark
   * vignette overlay behind the Horus Panel instead of a full-screen overlay.
   * Same gold/smoke panel design — just with the world dimmed behind it.
   */
  function _showCinematic(dialogueArray, options) {
    options = options || {};
    if (_cinActive) {
      if (typeof options.onComplete === 'function') options.onComplete();
      return;
    }

    _cinOnComplete = options.onComplete || null;
    _cinWasPaused  = false;
    if (typeof window.setGamePaused === 'function') {
      _cinWasPaused = true;
      window.setGamePaused(true);
    }
    _cinActive = true;

    // Dark vignette overlay behind the Horus Panel (cinematic feel without fullscreen takeover)
    var vig = document.createElement('div');
    vig.className = 'horus-vignette';
    document.body.appendChild(vig);
    _cinOverlay = vig; // stored so _cinDismiss() cleans it up

    // Safety auto-close: 25s max so a crash can never trap the player
    _cinSafeTimer = setTimeout(function () {
      _cinDismiss();
      if (_container) _container.style.display = 'none';
      _active = false;
    }, 25000);

    // Initialize panel and show sentences through normal bubble path
    _init();
    _sentences  = dialogueArray;
    _sentIdx    = 0;
    _active     = true;
    _onComplete = null; // cinematic uses _cinOnComplete; not the bubble _onComplete path

    // Horus narrator speaker
    var speakerEl = document.getElementById('ds-bubble-speaker');
    if (speakerEl) speakerEl.innerHTML = '<span style="font-size:14px;">𓂀</span> HORUS';
    var portraitEl = document.getElementById('ds-bubble-portrait');
    if (portraitEl) portraitEl.textContent = '𓂀';

    // Show panel with fresh slide-in animation
    _container.style.display = 'block';
    _container.style.animation = 'none';
    void _container.offsetHeight;
    _container.style.animation = '';

    _showSentence(_sentences[0]);
  }

  // ── Internal state ─────────────────────────────────────────
  var _container  = null;
  var _textEl     = null;
  var _choicesEl  = null;
  var _active     = false;
  var _sentences  = [];
  var _sentIdx    = 0;
  var _twTimer    = null;  // typewriter setTimeout handle
  var _aaTimer    = null;  // auto-advance setTimeout handle
  var _onComplete = null;
  var _posX       = null;
  var _posY       = null;
  var _twDone     = false; // typewriter finished for current sentence

  // ── DOM init ───────────────────────────────────────────────
  function _init() {
    if (_container) return;
    _container = document.createElement('div');
    _container.id = 'ds-bubble';
    _container.className = 'ds-bubble ds-bubble-happy';
    // Horus Panel structure — Eye of Horus decorations + gold smoke border (see css/styles.css)
    _container.innerHTML =
      '<span class="hp-eye-top">𓂀</span>' +
      '<span class="hp-eye-bl">𓂀</span>' +
      '<span class="hp-eye-br">𓂀</span>' +
      '<div class="hp-hieroglyphs">𓂀 𓁿 𓆣 𓃭 𓂀 𓁿 𓆣 𓃭</div>' +
      '<div class="hp-inner">' +
        '<div class="hp-speaker" id="ds-bubble-speaker"><span style="font-size:14px;">𓂀</span> HORUS</div>' +
        '<div class="hp-content">' +
          '<div class="hp-portrait" id="ds-bubble-portrait">𓂀</div>' +
          '<div style="flex:1;overflow:hidden;">' +
            '<div class="ds-bubble-image-wrap" id="ds-bubble-image-wrap" style="display:none;"></div>' +
            '<div class="hp-text ds-bubble-text" id="ds-bubble-text"></div>' +
            '<div class="ds-bubble-choices" id="ds-bubble-choices"></div>' +
          '</div>' +
        '</div>' +
        '<div class="hp-footer">' +
          '<span class="hp-tap-hint" id="ds-bubble-tap-hint">TAP TO CONTINUE</span>' +
          '<button class="hp-dismiss" id="ds-bubble-dismiss">→ OK</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(_container);
    _textEl    = document.getElementById('ds-bubble-text');
    _choicesEl = document.getElementById('ds-bubble-choices');

    // Tap/click to skip typewriter or advance to next sentence
    function _onTap(e) {
      if (!_active) return;
      if (_choicesEl && _choicesEl.children.length > 0) return;
      if (e.type === 'touchend') e.preventDefault();
      skip();
    }
    _container.addEventListener('click', _onTap);
    _container.addEventListener('touchend', _onTap, { passive: false });

    // Dismiss button (→ OK)
    var _dismissBtn = document.getElementById('ds-bubble-dismiss');
    if (_dismissBtn) {
      _dismissBtn.addEventListener('click', function (e) { e.stopPropagation(); dismiss(); });
      _dismissBtn.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); dismiss(); }, { passive: false });
    }
  }

  // ── Position helper ────────────────────────────────────────
  function _applyPosition() {
    // Horus Panel: always fixed to top-right by CSS — no JS positioning needed.
    // Method kept for backward-compat (external callers of setPosition()).
  }

  // ── Typewriter ─────────────────────────────────────────────
  function _showSentence(s) {
    if (!_textEl) return;
    _twDone = false;

    // Switch emotion class
    var newClass = EMOTIONS[s.emotion] || EMOTIONS.happy;
    var keys = Object.keys(EMOTIONS);
    for (var k = 0; k < keys.length; k++) {
      _container.classList.remove(EMOTIONS[keys[k]]);
    }
    // Remove size classes
    _container.classList.remove('ds-size-short', 'ds-size-medium', 'ds-size-long');

    // Apply goal styling if this is a goal/objective sentence
    var useGoal = _isGoalSentence(s);
    if (useGoal) {
      newClass = EMOTIONS.goal;
    }
    _container.classList.add(newClass);

    // Apply dynamic size class based on text length
    _container.classList.add(_sizeClass(s.text));

    // ── Image insert panel (comic book style) ──────────────────
    var imageWrap = document.getElementById('ds-bubble-image-wrap');
    if (imageWrap) {
      if (s.imageUrl) {
        imageWrap.style.display = 'block';
        imageWrap.innerHTML = '';
        var img = document.createElement('img');
        img.src = s.imageUrl;
        img.className = 'ds-panel-image';
        img.alt = 'panel image';
        imageWrap.appendChild(img);
        _container.classList.add('ds-has-image');
      } else {
        imageWrap.style.display = 'none';
        imageWrap.innerHTML = '';
        _container.classList.remove('ds-has-image');
      }
    }

    _textEl.innerHTML = '';
    clearTimeout(_twTimer);
    clearTimeout(_aaTimer);

    // If goal sentence, prepend a label
    if (useGoal) {
      var lbl = document.createElement('span');
      lbl.className = 'ds-goal-label';
      lbl.textContent = '🎯 objective';
      _textEl.appendChild(lbl);
    }

    var chars  = Array.from(s.text); // Correctly splits multi-byte emoji
    var i      = 0;
    var isLast = (_sentIdx === _sentences.length - 1);

    function typeNext() {
      if (i < chars.length) {
        var span = document.createElement('span');
        span.className = 'ds-char';
        span.textContent = chars[i];
        _textEl.appendChild(span);
        // rAF to trigger CSS opacity transition after insertion
        (function (sp) {
          requestAnimationFrame(function () { sp.classList.add('visible'); });
        }(span));
        // Micro-pauses at punctuation for a more natural terminal-style read rhythm
        var ch = chars[i];
        var delay = TW_DELAY_DEFAULT;
        if (ch === '.' || ch === '!' || ch === '?') delay = TW_DELAY_SENTENCE_END;
        else if (ch === ',') delay = TW_DELAY_COMMA;
        i++;
        _twTimer = setTimeout(typeNext, delay);
      } else {
        // Typewriter complete
        _twDone = true;
        if (!isLast) {
          // Append animated "..." hint between sentences
          var dots = document.createElement('span');
          dots.className = 'ds-dots';
          dots.textContent = ' ...';
          _textEl.appendChild(dots);
        }
        // Auto-advance: duration from sentence or calculated from length
        var dur = (s.duration != null) ? s.duration : (s.text.length * 45 + 1500);
        _aaTimer = setTimeout(function () { skip(); }, dur);
      }
    }
    typeNext();
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * _isCampMenuOpen()
   * Returns true when any camp building overlay is currently visible.
   * Used to suppress A.I.D.A dialogues while menus are open.
   * Primarily relies on CampWorld.menuOpen; falls back to window._CAMP_OVERLAY_IDS.
   */
  function _isCampMenuOpen() {
    // Check via CampWorld public API first (most reliable)
    if (window.CampWorld && window.CampWorld.menuOpen) return true;
    // Fallback: check common overlay IDs (shared constant or inline list)
    var ids = window._CAMP_OVERLAY_IDS || [
      'prism-reliquary-overlay', 'camp-board-overlay', 'neural-matrix-overlay',
      'armory-overlay', 'recycle-overlay', 'campfire-kitchen-overlay',
      'workshop-overlay', 'gacha-store-overlay', 'aida-dark-pact-overlay',
      'special-attacks-panel-overlay', 'quest-hall-overlay',
      'companion-house-modal', 'inventory-screen-modal',
      'progression-shop', 'prestige-menu', 'expeditions-menu',
      'progression-shop-overlay', 'account-building-overlay',
      'gear-screen', 'achievements-screen'
    ];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && getComputedStyle(el).display !== 'none') return true;
    }
    return false;
  }

  /**
   * show(dialogueArray, options)
   * Start a dialogue sequence.
   * dialogueArray: Array of { text, emotion, duration?, cinematic? }
   * options: { onComplete, x, y }
   *
   * If any entry has cinematic:true, the full-screen cinematic overlay is used
   * instead of the standard speech bubble — intended for main story reveals.
   * Standard speech bubbles are used for idle chatter, hints, and secrets.
   */
  function show(dialogueArray, options) {
    options = options || {};
    if (options.horusPanel && window.HorusPanel && dialogueArray && dialogueArray.length) {
      const first = dialogueArray[0];
      const msg = (typeof first === 'string') ? first : (first && first.text ? first.text : '');
      if (msg) {
        window.HorusPanel.show(msg, options.onComplete || null);
        return;
      }
    }
    // Suppress dialogue while a camp building menu is open
    if (_isCampMenuOpen()) {
      if (typeof options.onComplete === 'function') options.onComplete();
      return;
    }

    // Route to cinematic overlay (panel + vignette) for main story dialogues
    if (_isCinematic(dialogueArray)) {
      _showCinematic(dialogueArray, options);
      return;
    }

    _init();
    options     = options || {};
    _sentences  = dialogueArray;
    _sentIdx    = 0;
    _active     = true;
    _onComplete = options.onComplete || null;
    _posX       = null; // position is CSS-controlled (top-right)
    _posY       = null;

    // Update speaker name / emoji from options
    var speakerEl = document.getElementById('ds-bubble-speaker');
    if (speakerEl) {
      var spName  = options.speaker || options.speakerName || 'HORUS';
      var spEmoji = options.speakerEmoji || '𓂀';
      speakerEl.innerHTML = '<span style="font-size:14px;">' + spEmoji + '</span> ' + spName;
    }
    // Update portrait icon from options
    var portraitEl = document.getElementById('ds-bubble-portrait');
    if (portraitEl) {
      portraitEl.textContent = options.portrait || options.portraitEmoji || '𓂀';
    }

    _container.style.display = 'block';
    // Reset slide-in animation on re-open
    _container.style.animation = 'none';
    void _container.offsetHeight; // reflow
    _container.style.animation = '';

    _showSentence(_sentences[0]);
  }

  /**
   * skip()
   * If typewriter is in progress, complete it instantly.
   * If already done, advance to the next sentence (or dismiss).
   */
  function skip() {
    if (!_active) return;
    clearTimeout(_twTimer);
    clearTimeout(_aaTimer);

    if (!_twDone) {
      // Complete current sentence instantly
      var s = _sentences[_sentIdx];
      _textEl.innerHTML = '';
      // Re-add goal label if needed
      if (_isGoalSentence(s)) {
        var lbl = document.createElement('span');
        lbl.className = 'ds-goal-label';
        lbl.textContent = '🎯 objective';
        _textEl.appendChild(lbl);
      }
      Array.from(s.text).forEach(function (ch) {
        var span = document.createElement('span');
        span.className = 'ds-char visible';
        span.textContent = ch;
        _textEl.appendChild(span);
      });
      _twDone = true;
      var isLast = (_sentIdx === _sentences.length - 1);
      if (!isLast) {
        var dots = document.createElement('span');
        dots.className = 'ds-dots';
        dots.textContent = ' ...';
        _textEl.appendChild(dots);
      }
      // Brief pause then advance
      _aaTimer = setTimeout(function () { skip(); }, 1200);
    } else {
      // Advance to next sentence or dismiss
      _sentIdx++;
      if (_sentIdx >= _sentences.length) {
        dismiss();
      } else {
        _showSentence(_sentences[_sentIdx]);
      }
    }
  }

  /**
   * dismiss()
   * Immediately hide the bubble and fire onComplete callback.
   * Also dismisses the cinematic overlay via the shared _cinDismiss() routine, which
   * correctly clears all timers, calls setGamePaused(false), and fires the cinematic
   * onComplete — preventing pause/timer imbalance when external code calls dismiss().
   */
  function dismiss() {
    // Dismiss cinematic overlay using the centralized cleanup path
    if (_cinActive || _cinOverlay) {
      _cinDismiss();
    }
    clearTimeout(_twTimer);
    clearTimeout(_aaTimer);
    _active = false;
    _twDone = false;
    if (_container) _container.style.display = 'none';
    if (_onComplete) {
      var cb = _onComplete;
      _onComplete = null;
      cb();
    }
  }

  /** isActive() → bool (true for both speech bubble and cinematic overlay) */
  function isActive() { return _active || _cinActive; }

  /**
   * setPosition(x, y)
   * Update bubble screen position (call each frame from 3D→2D projection).
   */
  function setPosition(x, y) {
    _posX = x;
    _posY = y;
    _applyPosition();
  }

  /**
   * showChoice(choices, callback)
   * Append choice buttons below the current bubble text.
   * choices: Array of strings or { text } objects.
   * callback(index, choice) fires when a button is tapped.
   */
  function showChoice(choices, callback) {
    _init();
    if (!_choicesEl) return;
    _choicesEl.innerHTML = '';
    choices.forEach(function (choice, idx) {
      var btn = document.createElement('button');
      btn.className = 'ds-choice-btn';
      btn.textContent = (typeof choice === 'string') ? choice : (choice.text || '');
      (function (i, c) {
        function pick(e) {
          if (e.type === 'touchend') e.preventDefault();
          _choicesEl.innerHTML = '';
          if (callback) callback(i, c);
        }
        btn.addEventListener('click', pick);
        btn.addEventListener('touchend', pick, { passive: false });
      }(idx, choice));
      _choicesEl.appendChild(btn);
    });
  }

  return {
    show:          show,
    skip:          skip,
    dismiss:       dismiss,
    isActive:      isActive,
    setPosition:   setPosition,
    showChoice:    showChoice,
    hideOnMenuOpen: function () { if (_active) dismiss(); },
    DIALOGUES:     DIALOGUES
  };
}());

window.HorusPanel = window.HorusPanel || {
  _queue: [],
  _visible: false,

  show: function(text, onDismiss) {
    this._queue.push({ text: text || '', onDismiss: onDismiss || null });
    if (!this._visible) this._next();
  },

  _next: function() {
    if (!this._queue.length) { this._hide(); return; }
    const item = this._queue.shift();
    this._visible = true;
    let panel = document.getElementById('horus-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'horus-panel';
      panel.innerHTML = `
        <div id="horus-panel-inner">
          <div class="horus-panel-topline"></div>
          <div id="horus-panel-text"></div>
          <button id="horus-panel-btn">OK →</button>
        </div>`;
      document.body.appendChild(panel);
    }
    const btn = document.getElementById('horus-panel-btn');
    if (btn) {
      btn.onclick = () => {
        if (typeof item.onDismiss === 'function') item.onDismiss();
        window.HorusPanel._next();
      };
    }
    const textEl = document.getElementById('horus-panel-text');
    if (textEl) textEl.textContent = item.text || '';
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('horus-visible')));
  },

  _hide: function() {
    this._visible = false;
    const panel = document.getElementById('horus-panel');
    if (panel) panel.classList.remove('horus-visible');
  },

  autoHide: function(text, ms) {
    this.show(text, null);
    setTimeout(() => this._next(), ms || 3000);
  }
};
