// js/welcome-ui.js — Annunaki-themed Welcome Screen Overlay for Sandbox 2.0
// Three-panel layout: Left (7-Day Track) | Center (New Player Quests) | Right (Welcome Spin)
// Auto-shows on first visit; can be reopened via window.WelcomeUI.show()

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  var STORAGE_KEY  = 'wds_welcomeShown';
  var SPINS_KEY    = 'wds_welcomeSpins';
  var NAME_KEY     = 'wds_playerName';

  var NEW_PLAYER_QUESTS = [
    { id: 'npq_build_hall',   icon: '🏛️', label: 'Build the Quest Hall',   desc: 'Construct the Quest Hall in your camp.' },
    { id: 'npq_wave3',        icon: '🌊', label: 'Survive Wave 3',          desc: 'Endure three full enemy waves.' },
    { id: 'npq_kills10',      icon: '💀', label: 'Defeat 10 Enemies',       desc: 'Slay 10 enemies across any run.' },
    { id: 'npq_first_weapon', icon: '⚔️',  label: 'Unlock a Starting Weapon', desc: 'Equip a weapon from the armory.' },
    { id: 'npq_fountain',     icon: '⛲', label: 'Click the Fountain',      desc: 'Interact with the camp fountain.' }
  ];

  var WELCOME_SPIN_PRIZES = [
    { label: '💰 200 Gold',    gold: 200,  gems: 0,  weight: 30 },
    { label: '💎 5 Gems',      gold: 0,    gems: 5,  weight: 25 },
    { label: '💰 500 Gold',    gold: 500,  gems: 0,  weight: 20 },
    { label: '💎 15 Gems',     gold: 0,    gems: 15, weight: 15 },
    { label: '🏆 1000 Gold',   gold: 1000, gems: 0,  weight: 7  },
    { label: '✨ 50 Gems',     gold: 0,    gems: 50, weight: 3  }
  ];

  // ── CSS (injected once) ──────────────────────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('welcome-ui-style')) return;
    var s = document.createElement('style');
    s.id = 'welcome-ui-style';
    s.textContent = [
      '@keyframes wuFadeIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}',
      '@keyframes wuSpinWheel{from{transform:rotate(0deg)}to{transform:rotate(var(--spin-deg))}}',
      '@keyframes wuGlow{0%,100%{box-shadow:0 0 14px #00eeffaa}50%{box-shadow:0 0 32px #00eeffdd,0 0 64px #00eeff44}}',
      '@keyframes wuQuestComplete{from{background:rgba(0,255,100,0.15)}to{background:transparent}}',
      '#welcome-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:9000;',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;',
        'font-family:"Bangers",cursive;color:#fff;overflow-y:auto;}',
      '#welcome-overlay .wu-title{font-size:clamp(1.5em,4vw,2.8em);letter-spacing:4px;',
        'color:#FFD700;text-shadow:0 0 20px #FFD700aa,2px 2px 0 #000;margin-bottom:18px;',
        'text-align:center;}',
      '#welcome-overlay .wu-panels{display:flex;gap:16px;max-width:1100px;width:96vw;',
        'flex-wrap:wrap;justify-content:center;align-items:flex-start;}',
      '#welcome-overlay .wu-panel{background:linear-gradient(160deg,#12122a,#0a0a1a);',
        'border:2px solid rgba(0,238,255,0.25);border-radius:14px;padding:18px 14px;',
        'flex:1 1 280px;max-width:340px;min-width:240px;}',
      '#welcome-overlay .wu-panel-title{font-size:1.1em;letter-spacing:2px;',
        'color:#00eeff;text-shadow:0 0 10px #00eeff88;margin-bottom:12px;text-align:center;}',
      '#welcome-overlay .wu-day-card{border-radius:8px;padding:6px 4px;text-align:center;',
        'border:1px solid rgba(255,255,255,0.1);margin-bottom:4px;font-size:0.78em;}',
      '#welcome-overlay .wu-day-card.epic{border-color:#FFD700;',
        'background:linear-gradient(135deg,#1a0a2e,#2a0040);',
        'box-shadow:0 0 12px #FFD70066;}',
      '#welcome-overlay .wu-quest-item{display:flex;align-items:center;gap:8px;',
        'padding:8px 6px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);',
        'margin-bottom:6px;cursor:default;transition:background .2s;}',
      '#welcome-overlay .wu-quest-item.done{opacity:0.5;',
        'animation:wuQuestComplete 0.6s ease-out;}',
      '#welcome-overlay .wu-spin-canvas{display:block;margin:0 auto 12px;',
        'border-radius:50%;border:3px solid #FFD700;',
        'box-shadow:0 0 20px #FFD70066;cursor:pointer;}',
      '#welcome-overlay .wu-spin-btn{display:block;margin:0 auto;padding:10px 28px;',
        'font-family:"Bangers",cursive;font-size:1.15em;letter-spacing:2px;',
        'background:linear-gradient(to bottom,#FFD700cc,#FF8C00aa);',
        'border:2px solid #FFD700;border-radius:10px;color:#000;cursor:pointer;',
        'box-shadow:0 0 12px #FFD70066,2px 2px 0 #000;transition:transform .15s;}',
      '#welcome-overlay .wu-spin-btn:active{transform:scale(0.94);}',
      '#welcome-overlay .wu-spin-btn:disabled{opacity:0.4;cursor:default;}',
      '#welcome-overlay .wu-bottom{display:flex;gap:12px;align-items:center;',
        'flex-wrap:wrap;justify-content:center;margin-top:20px;width:96vw;max-width:800px;}',
      '#welcome-overlay #wu-name-input{background:rgba(0,0,0,0.5);border:2px solid #00eeff;',
        'border-radius:8px;padding:10px 14px;color:#fff;font-size:1em;',
        'font-family:Arial,sans-serif;width:220px;outline:none;}',
      '#welcome-overlay #wu-enter-btn{padding:12px 36px;font-family:"Bangers",cursive;',
        'font-size:1.5em;letter-spacing:3px;background:linear-gradient(to bottom,#FFD700,#FF8C00);',
        'border:3px solid #FFD700;border-radius:12px;color:#000;cursor:pointer;',
        'box-shadow:0 0 24px #FFD700aa,3px 3px 0 #000;animation:wuGlow 2s ease-in-out infinite;',
        'transition:transform .15s;}',
      '#welcome-overlay #wu-enter-btn:active{transform:scale(0.93);}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Helper: weighted random spin result ──────────────────────────────────
  function _spinResult() {
    var total = WELCOME_SPIN_PRIZES.reduce(function(s, p) { return s + p.weight; }, 0);
    var roll  = Math.random() * total;
    var acc   = 0;
    for (var i = 0; i < WELCOME_SPIN_PRIZES.length; i++) {
      acc += WELCOME_SPIN_PRIZES[i].weight;
      if (roll < acc) return { prize: WELCOME_SPIN_PRIZES[i], idx: i };
    }
    return { prize: WELCOME_SPIN_PRIZES[0], idx: 0 };
  }

  // Shared AudioContext — reused across all spin wins to avoid browser AudioContext limits
  var _spinWinAudioCtx = null;
  function _getSpinWinAudioCtx() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!_spinWinAudioCtx) _spinWinAudioCtx = new Ctor();
    if (_spinWinAudioCtx.state === 'suspended' && _spinWinAudioCtx.resume) {
      _spinWinAudioCtx.resume().catch(function() {});
    }
    return _spinWinAudioCtx;
  }

  // ── Helper: play a simple win sound ─────────────────────────────────────
  function _playSpinWin() {
    try {
      var ctx = _getSpinWinAudioCtx();
      if (!ctx) return;
      var g = ctx.createGain();
      var startAt = ctx.currentTime;
      var lastStop = startAt;
      g.gain.setValueAtTime(0.4, startAt);
      g.gain.exponentialRampToValueAtTime(0.001, startAt + 1.0);
      g.connect(ctx.destination);
      [523, 659, 784, 1047].forEach(function(f, i) {
        var o = ctx.createOscillator();
        var noteStart = startAt + i * 0.12;
        var noteStop  = noteStart + 0.3;
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g);
        o.start(noteStart);
        o.stop(noteStop);
        if (noteStop > lastStop) lastStop = noteStop;
      });
      setTimeout(function() { try { g.disconnect(); } catch(e) {} },
        Math.ceil((lastStop - startAt) * 1000) + 100);
    } catch(e) {}
  }

  // ── Build Left Panel (7-Day Track) ───────────────────────────────────────
  function _buildDayPanel() {
    var div = document.createElement('div');
    div.className = 'wu-panel';
    div.innerHTML = '<div class="wu-panel-title">🗓️ WEEKLY REWARD TRACK</div>';

    var rewards = window.GameDailies ? window.GameDailies.DAILY_LOGIN_REWARDS : [];
    var streak  = 0;
    try {
      var sd = window.getSaveData ? window.getSaveData() : null;
      if (sd && sd.dailies) streak = sd.dailies.loginStreak || 0;
    } catch(e) {}

    var colors = ['#aaaaaa','#55cc55','#44aaff','#aa44ff','#ffaa00','#ff7700','#FFD700'];
    rewards.forEach(function(r, i) {
      var dayNum  = i + 1;
      var claimed = streak > 0 && dayNum <= (streak % 7 || (streak > 0 ? 7 : 0));
      var isEpic  = r.isEpic || dayNum === 7;
      var c       = colors[i] || '#FFD700';
      var card    = document.createElement('div');
      card.className = 'wu-day-card' + (isEpic ? ' epic' : '');
      card.style.borderColor = c;
      card.innerHTML = '<span style="font-size:1.3em">' + (claimed ? '✅' : r.icon) + '</span> '
        + '<b style="color:' + c + '">Day ' + dayNum + '</b>'
        + '<span style="color:#ccc;font-size:0.85em;margin-left:4px;">' + (r.gold ? '+' + r.gold + 'g' : '') + (r.gems ? ' +' + r.gems + '💎' : '') + '</span>';
      div.appendChild(card);
    });

    if (!rewards.length) {
      div.innerHTML += '<div style="color:#aaa;font-size:0.85em;font-family:Arial,sans-serif;">Daily Rewards not loaded.</div>';
    }
    return div;
  }

  // ── Build Center Panel (New Player Quests) ───────────────────────────────
  function _buildQuestPanel(onQuestComplete) {
    var div = document.createElement('div');
    div.className = 'wu-panel';
    div.innerHTML = '<div class="wu-panel-title">📜 NEW PLAYER QUESTS</div>'
      + '<div style="color:#aaa;font-family:Arial,sans-serif;font-size:11px;margin-bottom:10px;text-align:center;">Complete quests to earn Welcome Spins!</div>';

    var completedIds = {};
    try {
      var raw = localStorage.getItem('wds_npqCompleted');
      if (raw) completedIds = JSON.parse(raw);
    } catch(e) {}

    var spinsLabel = document.createElement('div');
    spinsLabel.style.cssText = 'text-align:center;color:#FFD700;font-size:1em;margin-bottom:10px;';
    var spinsCount = parseInt(localStorage.getItem(SPINS_KEY) || '0', 10);
    spinsLabel.textContent = '🎰 Welcome Spins available: ' + spinsCount;
    div.appendChild(spinsLabel);

    NEW_PLAYER_QUESTS.forEach(function(q) {
      var done = !!completedIds[q.id];
      var item = document.createElement('div');
      item.className = 'wu-quest-item' + (done ? ' done' : '');
      item.innerHTML = '<span style="font-size:1.4em">' + q.icon + '</span>'
        + '<div style="flex:1">'
        + '<div style="font-size:0.9em;color:' + (done ? '#2ecc71' : '#eee') + '">' + q.label + '</div>'
        + '<div style="font-size:0.75em;color:#888;font-family:Arial,sans-serif">' + q.desc + '</div>'
        + '</div>'
        + (done ? '<span style="color:#2ecc71;font-size:1.1em">✔</span>' : '<span style="color:#444;font-size:0.8em;font-family:Arial,sans-serif">+1 spin</span>');

      // Quests are completed by real in-game events via window.WelcomeUI.completeQuest(id).
      // No click-to-complete path to prevent exploit farming of spins.
      div.appendChild(item);
    });

    return div;
  }

  // ── Build Right Panel (Welcome Spin Roulette) ────────────────────────────
  function _buildSpinPanel() {
    var div = document.createElement('div');
    div.className = 'wu-panel';
    div.innerHTML = '<div class="wu-panel-title">🎰 WELCOME SPIN</div>'
      + '<div style="color:#aaa;font-family:Arial,sans-serif;font-size:11px;margin-bottom:10px;text-align:center;">Earn spins by completing New Player Quests!</div>';

    var spinsLeft = parseInt(localStorage.getItem(SPINS_KEY) || '0', 10);

    // Canvas wheel
    var canvas = document.createElement('canvas');
    canvas.width  = 200;
    canvas.height = 200;
    canvas.className = 'wu-spin-canvas';
    div.appendChild(canvas);

    // Result label
    var resultLabel = document.createElement('div');
    resultLabel.style.cssText = 'text-align:center;min-height:26px;font-size:1em;color:#FFD700;margin-bottom:8px;font-family:Arial,sans-serif;';
    div.appendChild(resultLabel);

    // Spin button
    var spinBtn = document.createElement('button');
    spinBtn.className = 'wu-spin-btn';
    spinBtn.textContent = spinsLeft > 0 ? '🎰 SPIN (' + spinsLeft + ' left)' : '🎰 No Spins';
    if (spinsLeft <= 0) spinBtn.disabled = true;
    div.appendChild(spinBtn);

    // Spins counter ref
    var spinsCountEl = document.createElement('div');
    spinsCountEl.style.cssText = 'text-align:center;color:#aaa;font-size:0.8em;margin-top:6px;font-family:Arial,sans-serif;';
    div.appendChild(spinsCountEl);

    // Draw the wheel
    var segCount = WELCOME_SPIN_PRIZES.length;
    var segAngle = (Math.PI * 2) / segCount;
    var wheelColors = ['#1a0a3e','#0a1a3e','#0a3e1a','#3e1a0a','#3e0a1a','#1a3e0a'];
    var currentAngle = 0;
    var isSpinning   = false;

    function _drawWheel(rotationOffset) {
      var ctx = canvas.getContext('2d');
      var cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 4;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < segCount; i++) {
        var start = rotationOffset + i * segAngle;
        var end   = start + segAngle;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Label
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + segAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(WELCOME_SPIN_PRIZES[i].label, r - 6, 4);
        ctx.restore();
      }
      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pointer
      ctx.beginPath();
      ctx.moveTo(cx + r + 2, cy);
      ctx.lineTo(cx + r - 12, cy - 8);
      ctx.lineTo(cx + r - 12, cy + 8);
      ctx.closePath();
      ctx.fillStyle = '#FF4444';
      ctx.fill();
    }

    _drawWheel(currentAngle);

    spinBtn.onclick = function() {
      if (isSpinning) return;
      var spins = parseInt(localStorage.getItem(SPINS_KEY) || '0', 10);
      if (spins <= 0) { spinBtn.disabled = true; return; }

      isSpinning = true;
      spinBtn.disabled = true;
      resultLabel.textContent = '';

      var result    = _spinResult();
      var extraRots = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
      var landAngle = -(result.idx * segAngle + segAngle / 2); // land pointer on this segment
      var totalAngle = extraRots * Math.PI * 2 + landAngle;
      var duration  = 3500; // ms
      var startTime = null;

      function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }

      function _animate(ts) {
        if (!startTime) startTime = ts;
        var elapsed = ts - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased    = _easeOut(progress);
        _drawWheel(currentAngle + eased * totalAngle);
        if (progress < 1) {
          requestAnimationFrame(_animate);
        } else {
          currentAngle = (currentAngle + totalAngle) % (Math.PI * 2);
          isSpinning = false;
          _playSpinWin();

          // Grant reward
          var prize = result.prize;
          try {
            var sd = window.getSaveData ? window.getSaveData() : null;
            if (sd) {
              if (prize.gold) sd.gold = (sd.gold || 0) + prize.gold;
              if (prize.gems) sd.gems = (sd.gems || 0) + prize.gems;
              if (window.saveSaveData) window.saveSaveData();
            }
          } catch(e) {}

          // Deduct spin
          var newSpins = Math.max(0, spins - 1);
          localStorage.setItem(SPINS_KEY, newSpins);
          resultLabel.textContent = '🎉 ' + prize.label + ' won!';
          spinBtn.textContent = newSpins > 0 ? '🎰 SPIN (' + newSpins + ' left)' : '🎰 No Spins';
          if (newSpins <= 0) spinBtn.disabled = true;
          else spinBtn.disabled = false;
        }
      }
      requestAnimationFrame(_animate);
    };

    // Expose so quest panel can update spin count display
    div._updateSpinsDisplay = function() {
      var s = parseInt(localStorage.getItem(SPINS_KEY) || '0', 10);
      spinBtn.textContent = s > 0 ? '🎰 SPIN (' + s + ' left)' : '🎰 No Spins';
      spinBtn.disabled = (s <= 0);
    };

    return div;
  }

  // ── Main show function ────────────────────────────────────────────────────
  function show() {
    if (document.getElementById('welcome-overlay')) return; // already open
    _injectCSS();

    var overlay = document.createElement('div');
    overlay.id = 'welcome-overlay';

    var title = document.createElement('div');
    title.className = 'wu-title';
    title.innerHTML = '⚡ WELCOME TO SANDBOX 2.0 ⚡';
    overlay.appendChild(title);

    var sub = document.createElement('div');
    sub.style.cssText = 'color:#aaa;font-family:Arial,sans-serif;font-size:13px;margin-bottom:20px;text-align:center;letter-spacing:1px;';
    sub.textContent = 'A N N U N A K I   C O M M A N D   C E N T E R';
    overlay.appendChild(sub);

    var panels = document.createElement('div');
    panels.className = 'wu-panels';

    var spinPanel = _buildSpinPanel();
    panels.appendChild(_buildDayPanel());
    panels.appendChild(_buildQuestPanel(function(newSpinCount) {
      // Update spin panel when a quest is completed
      if (typeof spinPanel._updateSpinsDisplay === 'function') spinPanel._updateSpinsDisplay();
    }));
    panels.appendChild(spinPanel);
    overlay.appendChild(panels);

    // Bottom bar: name input + ENTER CAMP button
    var bottom = document.createElement('div');
    bottom.className = 'wu-bottom';

    var nameLbl = document.createElement('label');
    nameLbl.style.cssText = 'color:#aaa;font-family:Arial,sans-serif;font-size:13px;';
    nameLbl.textContent = 'Player Name:';
    bottom.appendChild(nameLbl);

    var nameInput = document.createElement('input');
    nameInput.id = 'wu-name-input';
    nameInput.type = 'text';
    nameInput.maxLength = 24;
    nameInput.placeholder = 'Enter your name...';
    nameInput.value = localStorage.getItem(NAME_KEY) || '';
    bottom.appendChild(nameInput);

    var enterBtn = document.createElement('button');
    enterBtn.id = 'wu-enter-btn';
    enterBtn.textContent = '⚡ ENTER CAMP ⚡';
    enterBtn.onclick = function() {
      var name = nameInput.value.trim() || 'UNIT-001';
      localStorage.setItem(NAME_KEY, name);
      localStorage.setItem(STORAGE_KEY, '1');
      // Persist player name to save data if available
      try {
        var sd = window.getSaveData ? window.getSaveData() : null;
        if (sd) {
          sd.playerName = name;
          if (window.saveSaveData) window.saveSaveData();
        }
      } catch(e) {}
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s';
      setTimeout(function() { overlay.remove(); }, 420);
      if (window._firstEverLoginDailyPrompt && window.HorusPanel && typeof window.HorusPanel.show === 'function') {
        window._firstEverLoginDailyPrompt = false;
        setTimeout(function() {
          window.HorusPanel.show('Day 1 streak started! Return tomorrow for Day 2.\n7 days in a row unlocks legendary loot. 🔥');
        }, 480);
      }
    };
    bottom.appendChild(enterBtn);
    overlay.appendChild(bottom);

    document.body.appendChild(overlay);
  }

  // ── Auto-show on first visit ──────────────────────────────────────────────
  function _isOnCampPage() {
    var p = window.location.pathname;
    return p === '/' || p.endsWith('/') || /index\.html$/i.test(p);
  }

  function _autoShow() {
    // Show only on index.html (the Camp); skip on all other pages (sandbox, etc.)
    if (!_isOnCampPage()) return;

    // Section 5: On EVERY game start, check if daily login reward is available
    setTimeout(function() {
      if (window._pendingWelcomeOverlay) {
        window._pendingWelcomeOverlay = false;
        show();
        return;
      }
      if (window.GameDailies && window.SaveSystem) {
        var sd = window.SaveSystem.load ? window.SaveSystem.load() : null;
        if (!sd && typeof loadSaveData === 'function') sd = loadSaveData();
        if (sd) {
          var dailies = sd.dailies || {};
          var lastLogin = dailies.lastLoginDate || 0;
          var now = Date.now();
          var sameDay = lastLogin > 0 && (function() {
            var d1 = new Date(lastLogin), d2 = new Date(now);
            return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
          })();
          if (!sameDay) {
            // Daily reward available — show Horus Panel message first if first-ever login
            var isFirstEver = !lastLogin;
            if (isFirstEver && window.HorusSystem) {
              window.HorusSystem.say(
                'Every day you return, you will be rewarded.\nClaim your daily reward now — and come back tomorrow for more!',
                { delay: 400 }
              );
            }
            // Auto-show welcome overlay after 1.2s
            setTimeout(function() {
              if (window.WelcomeUI) window.WelcomeUI.show();
            }, isFirstEver ? 2600 : 1200);
            return;
          }
        }
      }

      // Original behaviour: show on first visit only
      if (localStorage.getItem(STORAGE_KEY)) return;
      setTimeout(show, 800);
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoShow);
  } else {
    _autoShow();
  }

  // Public API
  // ── completeQuest(id) — called by real game events to mark a quest done and grant a spin
  function completeQuest(id) {
    var completedIds = {};
    try {
      var raw = localStorage.getItem('wds_npqCompleted');
      if (raw) completedIds = JSON.parse(raw);
    } catch(e) {}
    if (completedIds[id]) return; // already completed
    completedIds[id] = true;
    try { localStorage.setItem('wds_npqCompleted', JSON.stringify(completedIds)); } catch(e) {}
    // Grant one Welcome Spin
    var newSpins = 0;
    try { newSpins = parseInt(localStorage.getItem(SPINS_KEY) || '0', 10) + 1; } catch(e) { newSpins = 1; }
    try { localStorage.setItem(SPINS_KEY, newSpins); } catch(e) {}
    // If welcome overlay is open, refresh its quest + spin panels
    var overlay = document.getElementById('welcome-overlay');
    if (overlay) {
      var spinsEl = overlay.querySelector('[data-wu-spins]');
      if (spinsEl) spinsEl.textContent = '🎰 Welcome Spins available: ' + newSpins;
      var questEl = overlay.querySelector('[data-wu-quest="' + id + '"]');
      if (questEl) {
        questEl.classList.add('done');
        var checkEl = questEl.querySelector('.wu-quest-check');
        if (checkEl) checkEl.textContent = '✔';
      }
    }
  }

  window.WelcomeUI = {
    show:             show,
    completeQuest:    completeQuest,
    checkAndAutoShow: _autoShow,
    NEW_PLAYER_QUESTS: NEW_PLAYER_QUESTS,
    SPIN_PRIZES:   WELCOME_SPIN_PRIZES
  };

})();
