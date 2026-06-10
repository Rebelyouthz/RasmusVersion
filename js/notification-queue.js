// js/notification-queue.js — Unified notification queue
// All gameplay notifications (rank-up, level-up, achievement, challenge,
// quest, building reward, resource pickup) MUST be routed through
// window.NotificationQueue.enqueue({...}). The queue ensures:
//   • Only one notification on screen at a time
//   • Notifications wait for any open menu/modal/tutorial/Aida-text to close
//   • 1.0 second gap between notifications for readability
//   • Confetti burst on reward types

(function () {
  const queue = [];
  let busy = false;
  let pollHandle = null;

  function _isBlocked() {
    try {
      const modals = document.querySelectorAll('.modal, #upgrade-modal, #pause-modal, #building-modal');
      for (const m of modals) {
        const s = window.getComputedStyle(m).display;
        if (s !== 'none') return 'modal';
      }
      if (document.querySelector('.menu.active, .menu.open, .menu-open')) return 'menu';
      const tut = document.querySelector('#tutorial-overlay, .tutorial-overlay');
      if (tut && !tut.classList.contains('hidden') && window.getComputedStyle(tut).display !== 'none') return 'tutorial';
      const aida = document.querySelector('#aida-quest-text, .aida-panel, #horus-panel');
      if (aida && window.getComputedStyle(aida).display !== 'none') return 'aida';
      if (window.CampWorld && window.CampWorld.isTransitioning) return 'camp-transitioning';
      const runEnd = document.querySelector('#run-end-screen, .run-end-screen');
      if (runEnd && window.getComputedStyle(runEnd).display !== 'none') return 'run-end';
      if (window.levelUpPending) return 'levelup';
    } catch (_) {}
    return null;
  }

  function enqueue(notification) {
    if (!notification || !notification.title) return;
    queue.push(notification);
    _tryNext();
  }

  function _tryNext() {
    if (busy) return;
    if (queue.length === 0) return;
    const blocked = _isBlocked();
    if (blocked) {
      if (pollHandle) clearTimeout(pollHandle);
      pollHandle = setTimeout(_tryNext, 500);
      return;
    }
    busy = true;
    const n = queue.shift();
    _show(n, function () {
      setTimeout(function () {
        busy = false;
        _tryNext();
      }, 1000);
    });
  }

  function _show(n, done) {
    const el = document.createElement('div');
    el.className = 'unified-notification notif-' + (n.type || 'generic');
    if (n.rarity) el.classList.add('rarity-' + n.rarity);
    el.innerHTML =
      '<div class="notif-icon">' + (n.icon || '★') + '</div>' +
      '<div class="notif-body">' +
        '<div class="notif-title">' + (n.title || '') + '</div>' +
        (n.subtitle ? '<div class="notif-sub">' + n.subtitle + '</div>' : '') +
        (n.rewardLabel ? '<div class="notif-reward">' + n.rewardLabel + '</div>' : '') +
      '</div>';
    document.body.appendChild(el);
    void el.offsetHeight;
    el.classList.add('show');
    if (n.type === 'rank-up' || n.type === 'level-up' || n.type === 'achievement' || n.type === 'challenge') {
      _confettiBurst(el, n.rarity || 'common');
    }
    try {
      if (typeof playSound === 'function') {
        const soundMap = {
          'rank-up':     'rank_up',
          'level-up':    'level_up',
          'achievement': 'achievement',
          'challenge':   'challenge_claim',
          'quest':       'quest_claim',
          'building':    'building_done',
          'resource':    'pickup'
        };
        const s = soundMap[n.type];
        if (s) playSound(s);
      }
    } catch (_) {}
    setTimeout(function () {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(function () {
        try { el.remove(); } catch (_) {}
        done();
      }, 550);
    }, 3500);
  }

  function _confettiBurst(anchorEl, rarity) {
    const colors = {
      common:    ['#ffffff', '#dddddd', '#bbbbbb'],
      uncommon:  ['#55cc55', '#88ee88', '#33aa33'],
      rare:      ['#00aaff', '#55ccff', '#0088dd'],
      epic:      ['#aa00ff', '#cc55ff', '#8800dd'],
      legendary: ['#FFD700', '#FFE45A', '#FFB000'],
      mythical:  ['#ff2020', '#ff5555', '#cc0000']
    };
    const palette = colors[rarity] || colors.common;
    const rect = anchorEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.className = 'notif-confetti';
      p.style.position = 'fixed';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.width = '8px';
      p.style.height = '8px';
      p.style.background = palette[Math.floor(Math.random() * palette.length)];
      p.style.borderRadius = (Math.random() > 0.5 ? '50%' : '0');
      p.style.pointerEvents = 'none';
      p.style.zIndex = '10001';
      p.style.transform = 'translate(-50%, -50%)';
      p.style.transition = 'transform 1.0s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 1.0s';
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist + 40;
      const rot = (Math.random() - 0.5) * 720;
      requestAnimationFrame(function () {
        p.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + rot + 'deg)';
        p.style.opacity = '0';
      });
      setTimeout(function () { try { p.remove(); } catch (_) {} }, 1100);
    }
  }

  window.NotificationQueue = { enqueue: enqueue, _debug: { queue: queue, isBlocked: _isBlocked } };
})();
