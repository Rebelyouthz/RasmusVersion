// js/horus-system.js
// Sections 2, 8, 9, 10: Unified Horus narrator messages, quest billboard, resource
// milestone toasts, combo building bonus, sparkle bursts, streak fire, daily ticker.
// All Horus Panel shows go through window.HorusSystem.say(text, opts).

(function () {
  'use strict';

  // ── Horus Panel narrator ────────────────────────────────────────────────
  /**
   * HorusSystem.say(text, opts)
   * Show a narrator Horus Panel message (non-cinematic).
   * opts.key  — saveData flag key to prevent re-showing (e.g. '_horusTip_intro')
   * opts.icon — portrait emoji (defaults to 𓂀)
   * opts.once — if true, only show if saveData flag not yet set
   * opts.delay — ms before showing (default 0)
   * opts.cinematic — if true, pause game (cinematic mode)
   */
  function say(text, opts) {
    opts = opts || {};
    var SD = (typeof saveData !== 'undefined') ? saveData : null;

    // One-shot guard
    if (opts.once && opts.key && SD) {
      if (SD[opts.key]) return;
      SD[opts.key] = true;
      if (typeof saveSaveData === 'function') saveSaveData();
    }

    var sentences = typeof text === 'string'
      ? [{ text: text, emotion: 'goal', cinematic: !!opts.cinematic }]
      : text;

    var DS = window.DialogueSystem;
    if (!DS) return;

    var showOpts = {
      speaker: opts.speaker || 'HORUS',
      speakerEmoji: opts.speakerEmoji || '𓂀',
      portrait: opts.icon || opts.portrait || '𓂀',
      onComplete: opts.onComplete || null
    };

    if (opts.delay && opts.delay > 0) {
      setTimeout(function () { DS.show(sentences, showOpts); }, opts.delay);
    } else {
      DS.show(sentences, showOpts);
    }
  }

  // ── Quest Hall "ready to claim" billboard ───────────────────────────────
  var _qrbEl = null;
  var _qrbRafId = null;

  function _ensureQRBillboard() {
    if (_qrbEl) return _qrbEl;
    _qrbEl = document.createElement('div');
    _qrbEl.id = 'quest-ready-billboard';
    _qrbEl.textContent = '!';
    document.body.appendChild(_qrbEl);
    return _qrbEl;
  }

  function _getQuestHallScreenPos() {
    // Try to project Quest Hall 3D position to screen via CampWorld
    if (window.CampWorld && window.CampWorld.projectWorldToScreen) {
      return window.CampWorld.projectWorldToScreen(0, 0, 0); // QH is near origin
    }
    return null;
  }

  function updateQuestBillboard(isReady) {
    var el = _ensureQRBillboard();
    if (!isReady) {
      el.classList.remove('qrb-active');
      return;
    }
    el.classList.add('qrb-active');
    // Position the billboard over the Quest Hall.
    // Prefer CampWorld.getQuestHallScreenPos() if available; fall back to the
    // module-local _getQuestHallScreenPos() which uses CampWorld.projectWorldToScreen.
    var pos = null;
    if (window.CampWorld && window.CampWorld.getQuestHallScreenPos) {
      pos = window.CampWorld.getQuestHallScreenPos();
    }
    if (!pos) {
      pos = _getQuestHallScreenPos();
    }
    if (pos) {
      el.style.left = pos.x + 'px';
      el.style.top  = (pos.y - 50) + 'px';
    }
  }

  // ── Building objective billboard ("BUILD ME" / "ENTER ME") ─────────────
  var _billboards = {}; // buildingId → DOM element

  function showBuildingBillboard(buildingId, label) {
    if (_billboards[buildingId]) return;
    var el = document.createElement('div');
    el.className = 'camp-obj-billboard';
    el.dataset.buildingId = buildingId;
    el.textContent = label || '🔨 BUILD ME';
    document.body.appendChild(el);
    el.classList.add('cob-active');
    _billboards[buildingId] = el;
  }

  function hideBuildingBillboard(buildingId) {
    var el = _billboards[buildingId];
    if (el) {
      el.classList.remove('cob-active');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        delete _billboards[buildingId];
      }, 400);
    }
  }

  // Update all billboard positions (call from camp render loop)
  function updateBillboardPositions() {
    if (!window.CampWorld || !window.CampWorld.getBuildingScreenPos) return;
    Object.keys(_billboards).forEach(function (id) {
      var el = _billboards[id];
      var pos = window.CampWorld.getBuildingScreenPos(id);
      if (pos) {
        el.style.left = pos.x + 'px';
        el.style.top  = (pos.y - 70) + 'px';
      }
    });
  }

  // ── Resource milestone toasts ────────────────────────────────────────────
  var _milestonesShown = {};

  function checkResourceMilestone(resource, amount) {
    var milestones = [100, 500, 1000];
    var icons = { gold: '💰', wood: '🪵', stone: '🪨' };
    milestones.forEach(function (m) {
      var key = resource + '_' + m;
      if (amount >= m && !_milestonesShown[key]) {
        _milestonesShown[key] = true;
        _showMilestoneToast((icons[resource] || '💎') + ' ' + m + ' ' + resource.charAt(0).toUpperCase() + resource.slice(1) + ' milestone!');
      }
    });
  }

  function _showMilestoneToast(text) {
    var el = document.createElement('div');
    el.className = 'milestone-toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () {
      el.classList.add('mt-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
    }, 2000);
  }

  // ── Combo Building Bonus ─────────────────────────────────────────────────
  var _lastBuildTime = 0;
  var _comboBuildCount = 0;

  function onBuildingBuilt(buildingId, screenX, screenY) {
    var now = Date.now();
    if (now - _lastBuildTime < 60000) {
      _comboBuildCount++;
      if (_comboBuildCount >= 2) {
        // Give +50 gold bonus
        if (typeof saveData !== 'undefined' && saveData) {
          saveData.gold = (saveData.gold || 0) + 50;
          if (typeof saveSaveData === 'function') saveSaveData();
          if (typeof showStatChange === 'function') showStatChange('+50 Gold Combo Bonus!');
          // Refresh gold UI so displayed amount stays in sync
          if (typeof updateHUD === 'function') updateHUD();
          else if (typeof updateGoldDisplays === 'function') updateGoldDisplays();
        }
        say('⚡ BUILDING SPREE! +50 bonus gold!', { delay: 400 });
        spawnCoinBurst(screenX || window.innerWidth / 2, screenY || window.innerHeight / 2);
        _comboBuildCount = 0; // reset after bonus
      }
    } else {
      _comboBuildCount = 1;
    }
    _lastBuildTime = now;

    // First-build sparkle
    spawnBuildingSparkle(screenX || window.innerWidth / 2, screenY || window.innerHeight / 2);
  }

  // ── Coin burst particles ──────────────────────────────────────────────────
  function spawnCoinBurst(cx, cy) {
    for (var i = 0; i < 10; i++) {
      (function (idx) {
        var el = document.createElement('div');
        el.className = 'coin-burst';
        var angle = (idx / 10) * Math.PI * 2;
        var dist  = 60 + Math.random() * 60;
        el.style.left = cx + 'px';
        el.style.top  = cy + 'px';
        el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        el.style.animationDelay = (idx * 0.05) + 's';
        el.textContent = '💰';
        document.body.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
      })(i);
    }
  }

  // ── Building sparkle burst ────────────────────────────────────────────────
  function spawnBuildingSparkle(cx, cy) {
    var sparkles = ['✨', '⭐', '🌟', '💫', '✦', '★'];
    for (var i = 0; i < 12; i++) {
      (function (idx) {
        var el = document.createElement('div');
        el.className = 'building-sparkle';
        var angle = (idx / 12) * Math.PI * 2 + Math.random() * 0.3;
        var dist  = 50 + Math.random() * 80;
        el.style.left = cx + 'px';
        el.style.top  = cy + 'px';
        el.style.setProperty('--sdx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--sdy', Math.sin(angle) * dist + 'px');
        el.style.animationDelay = (idx * 0.08) + 's';
        el.textContent = sparkles[idx % sparkles.length];
        document.body.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1400);
      })(i);
    }
  }

  // ── Rank-up screen flash ──────────────────────────────────────────────────
  function showRankUpFlash(rankName) {
    var el = document.getElementById('rank-up-flash-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rank-up-flash-overlay';
      document.body.appendChild(el);
    }
    el.classList.remove('ruf-active');
    void el.offsetHeight;
    el.classList.add('ruf-active');
    setTimeout(function () { el.classList.remove('ruf-active'); }, 1600);

    say('👑 RANK UP! You are now ' + (rankName || 'a higher rank') + '. New power unlocked.', { delay: 200 });
  }

  // ── Daily challenge ticker ────────────────────────────────────────────────
  function updateDailyTicker() {
    var ticker = document.getElementById('daily-challenge-ticker');
    if (!ticker) {
      ticker = document.createElement('div');
      ticker.id = 'daily-challenge-ticker';
      document.body.appendChild(ticker);
      ticker.addEventListener('click', function () {
        // Open Quest Hall challenges tab
        if (window.CampWorld && window.CampWorld.openQuestHallTab) {
          window.CampWorld.openQuestHallTab('challenges');
        }
      });
    }
    // Find first incomplete daily challenge
    var SD = (typeof saveData !== 'undefined') ? saveData : null;
    if (!SD || !window.IDLE_CHALLENGES) {
      ticker.classList.remove('dct-active');
      return;
    }
    // Try to find an active challenge
    var challenges = window.IDLE_CHALLENGES || [];
    for (var i = 0; i < challenges.length; i++) {
      var ch = challenges[i];
      var progress = SD.challengeProgress && SD.challengeProgress[ch.id];
      if (progress != null && progress < ch.goal) {
        ticker.textContent = '📋 Challenge: ' + ch.name + ' — ' + progress + '/' + ch.goal;
        ticker.classList.add('dct-active');
        return;
      }
    }
    ticker.classList.remove('dct-active');
  }

  // ── Streak fire icon ──────────────────────────────────────────────────────
  function updateStreakFire(streak, nameEl) {
    if (!nameEl) return;
    // Remove existing fire
    var existing = nameEl.querySelectorAll('.streak-fire');
    existing.forEach(function (e) { e.parentNode.removeChild(e); });

    if (streak >= 7) {
      var fire = document.createElement('span');
      fire.className = 'streak-fire';
      fire.textContent = '👑🔥';
      nameEl.appendChild(fire);
    } else if (streak >= 5) {
      var fire = document.createElement('span');
      fire.className = 'streak-fire';
      fire.textContent = '🔥🔥';
      nameEl.appendChild(fire);
    } else if (streak >= 3) {
      var fire = document.createElement('span');
      fire.className = 'streak-fire';
      fire.textContent = '🔥';
      nameEl.appendChild(fire);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.HorusSystem = {
    say: say,
    updateQuestBillboard: updateQuestBillboard,
    showBuildingBillboard: showBuildingBillboard,
    hideBuildingBillboard: hideBuildingBillboard,
    updateBillboardPositions: updateBillboardPositions,
    checkResourceMilestone: checkResourceMilestone,
    onBuildingBuilt: onBuildingBuilt,
    spawnCoinBurst: spawnCoinBurst,
    spawnBuildingSparkle: spawnBuildingSparkle,
    showRankUpFlash: showRankUpFlash,
    updateDailyTicker: updateDailyTicker,
    updateStreakFire: updateStreakFire
  };

})();
