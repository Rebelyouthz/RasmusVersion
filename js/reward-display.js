// js/reward-display.js — Section 6: Unified Reward Display System
// window.RewardDisplay.show({ title, rewards[], rarity, source })
// All reward popups (quests, achievements, dailies, slot, run-end) go through this.

(function () {
  'use strict';

  var _queue  = [];
  var _active = false;
  var _panel  = null;

  // ── Build the panel DOM (once) ────────────────────────────────────────
  function _ensurePanel() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'reward-display-panel';
    document.body.appendChild(_panel);
  }

  // ── Show one entry from the queue ─────────────────────────────────────
  function _showNext() {
    if (_active || _queue.length === 0) return;
    _active = true;
    var entry = _queue.shift();
    _render(entry);
  }

  function _render(entry) {
    _ensurePanel();
    var rarity   = entry.rarity  || 'common';
    var title    = entry.title   || 'REWARD!';
    var rewards  = entry.rewards || [];

    // Build inner HTML
    _panel.innerHTML =
      '<span class="hp-eye-top" style="font-size:14px;">𓂀</span>' +
      '<div class="rd-title rd-' + rarity + '">' + title + '</div>' +
      '<div class="rd-items" id="rd-items-list"></div>' +
      '<div class="rd-footer">' +
        '<button class="rd-close-btn" id="rd-close-btn">→ CLAIM</button>' +
      '</div>';

    _panel.classList.remove('rd-sliding-out');
    _panel.classList.add('rd-visible');

    // Animate reward items in one by one
    var itemsEl = document.getElementById('rd-items-list');
    rewards.forEach(function (r, idx) {
      var item = document.createElement('div');
      item.className = 'rd-item';
      item.innerHTML =
        '<span class="rd-item-icon">' + (r.icon || '🎁') + '</span>' +
        '<span style="flex:1;">' + (r.label || '') + '</span>' +
        '<span class="rd-item-amount">' + (r.amount != null ? '+' + r.amount : '') + '</span>';
      itemsEl.appendChild(item);
      setTimeout(function () { item.classList.add('rd-item-visible'); }, 200 + idx * 220);
    });

    // Big flash after all items appear
    var flashDelay = 200 + rewards.length * 220 + 200;
    setTimeout(function () {
      _panel.classList.add('rd-flash');
      setTimeout(function () { _panel.classList.remove('rd-flash'); }, 1200);
    }, flashDelay);

    // Close button
    var closeBtn = document.getElementById('rd-close-btn');
    if (closeBtn) {
      function _close() {
        _panel.classList.remove('rd-visible');
        _panel.classList.add('rd-sliding-out');
        setTimeout(function () {
          _panel.classList.remove('rd-sliding-out');
          _active = false;
          // Small gap between successive rewards
          setTimeout(_showNext, 500);
        }, 420);
      }
      closeBtn.addEventListener('click', _close);
      closeBtn.addEventListener('touchend', function (e) { e.preventDefault(); _close(); }, { passive: false });
    }

    // Auto-dismiss after max 8s so the UI doesn't get stuck
    setTimeout(function () {
      var btn = document.getElementById('rd-close-btn');
      if (btn && _active) btn.click();
    }, 8000);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  /**
   * RewardDisplay.show(opts)
   * opts = {
   *   title:   string  (e.g. "QUEST COMPLETE!")
   *   rewards: [{icon, label, amount}]
   *   rarity:  'common'|'rare'|'epic'|'legendary'
   *   source:  string  (informational, e.g. 'quest', 'achievement')
   * }
   */
  function show(opts) {
    if (!opts) return;
    _queue.push(opts);
    _showNext();
  }

  window.RewardDisplay = { show: show };

})();
