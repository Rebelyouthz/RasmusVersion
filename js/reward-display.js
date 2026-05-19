// js/reward-display.js — Section 6: Unified Reward Display System
// window.RewardDisplay.show({ title, rewards[], rarity, source })
// All reward popups (quests, achievements, dailies, slot, run-end) go through this.

(function () {
  'use strict';

  var _queue  = [];
  var _active = false;
  var _panel  = null;
  var _autoDismissTimer = null; // cleared on manual close to avoid premature dismissal

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

    // Build panel using safe DOM manipulation (prevents XSS)
    _panel.innerHTML = '';

    var eyeEl = document.createElement('span');
    eyeEl.className = 'hp-eye-top';
    eyeEl.style.fontSize = '14px';
    eyeEl.textContent = '𓂀';
    _panel.appendChild(eyeEl);

    var titleEl = document.createElement('div');
    titleEl.className = 'rd-title rd-' + rarity;
    titleEl.textContent = title;
    _panel.appendChild(titleEl);

    var itemsEl = document.createElement('div');
    itemsEl.className = 'rd-items';
    itemsEl.id = 'rd-items-list';
    _panel.appendChild(itemsEl);

    var footerEl = document.createElement('div');
    footerEl.className = 'rd-footer';
    var closeBtnEl = document.createElement('button');
    closeBtnEl.className = 'rd-close-btn';
    closeBtnEl.id = 'rd-close-btn';
    closeBtnEl.textContent = '→ CLAIM';
    footerEl.appendChild(closeBtnEl);
    _panel.appendChild(footerEl);

    _panel.classList.remove('rd-sliding-out');
    _panel.classList.add('rd-visible');

    // Animate reward items in one by one
    rewards.forEach(function (r, idx) {
      var item = document.createElement('div');
      item.className = 'rd-item';

      var iconEl = document.createElement('span');
      iconEl.className = 'rd-item-icon';
      iconEl.textContent = r.icon || '🎁';
      item.appendChild(iconEl);

      var labelEl = document.createElement('span');
      labelEl.style.flex = '1';
      labelEl.textContent = r.label || '';
      item.appendChild(labelEl);

      var amountEl = document.createElement('span');
      amountEl.className = 'rd-item-amount';
      amountEl.textContent = r.amount != null ? '+' + r.amount : '';
      item.appendChild(amountEl);

      itemsEl.appendChild(item);
      setTimeout(function () { item.classList.add('rd-item-visible'); }, 200 + idx * 220);
    });

    // Big flash after all items appear
    var flashDelay = 200 + rewards.length * 220 + 200;
    setTimeout(function () {
      _panel.classList.add('rd-flash');
      setTimeout(function () { _panel.classList.remove('rd-flash'); }, 1200);
    }, flashDelay);

    // Close handler: add rd-sliding-out FIRST, then remove rd-visible after animation
    function _close() {
      if (_autoDismissTimer) { clearTimeout(_autoDismissTimer); _autoDismissTimer = null; }
      _panel.classList.add('rd-sliding-out');
      // Remove rd-visible only after the slide-out animation completes so the panel stays rendered
      setTimeout(function () {
        _panel.classList.remove('rd-visible', 'rd-sliding-out');
        _active = false;
        // Small gap between successive rewards
        setTimeout(_showNext, 500);
      }, 420);
    }

    closeBtnEl.addEventListener('click', _close);
    closeBtnEl.addEventListener('touchend', function (e) { e.preventDefault(); _close(); }, { passive: false });

    // Auto-dismiss after max 8s so the UI doesn't get stuck.
    // Timer is tracked so a manual close can clear it before it fires on the next panel.
    _autoDismissTimer = setTimeout(function () {
      _autoDismissTimer = null;
      if (_active) _close();
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
