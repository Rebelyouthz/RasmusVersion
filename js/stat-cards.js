// Stat Cards System - stable rewrite (no flicker-prone DOM flashing)
(function () {
  'use strict';

  const CARD_COUNT = 16;
  const BASE_COST = 5;
  const COST_MULTIPLIER = 1.3;
  const ROLL_STEPS = 18;
  const ROLL_STEP_MS_MIN = 55;
  const ROLL_STEP_MS_MAX = 150;

  const STAT_TYPES = [
    { id: 'maxHp', name: 'Max HP', icon: '❤️', color: '#ff4444', baseValue: 20 },
    { id: 'hpRegen', name: 'HP Regen', icon: '💚', color: '#44ff44', baseValue: 1 },
    { id: 'damage', name: 'Damage', icon: '⚔️', color: '#ff8800', baseValue: 5 },
    { id: 'attackSpeed', name: 'Attack Speed', icon: '⚡', color: '#ffff00', baseValue: 0.05 },
    { id: 'armor', name: 'Armor', icon: '🛡️', color: '#8888ff', baseValue: 2 },
    { id: 'damageReduction', name: 'Damage Reduction', icon: '🔰', color: '#4488ff', baseValue: 0.02 },
    { id: 'critChance', name: 'Crit Chance', icon: '💥', color: '#ff00ff', baseValue: 0.03 },
    { id: 'critDamage', name: 'Crit Damage', icon: '💢', color: '#ff0088', baseValue: 0.1 },
    { id: 'lifeSteal', name: 'Life Steal', icon: '🩸', color: '#cc0000', baseValue: 0.02 },
    { id: 'moveSpeed', name: 'Move Speed', icon: '👟', color: '#00ffff', baseValue: 0.03 },
    { id: 'companionDamage', name: 'Companion Damage', icon: '🐺', color: '#aa88ff', baseValue: 3 },
    { id: 'cooldownReduction', name: 'Cooldown Reduction', icon: '⏱️', color: '#88ffff', baseValue: 0.02 },
    { id: 'projectileSpeed', name: 'Projectile Speed', icon: '🎯', color: '#ffaa00', baseValue: 0.05 },
    { id: 'pickupRange', name: 'Pickup Range', icon: '🧲', color: '#ff88ff', baseValue: 10 },
    { id: 'expGain', name: 'EXP Gain', icon: '⭐', color: '#ffdd00', baseValue: 0.05 },
    { id: 'goldGain', name: 'Gold Gain', icon: '💰', color: '#ffd700', baseValue: 0.05 }
  ];

  const cardState = {
    cards: [],
    purchases: 0,
    currentCost: BASE_COST,
    isAnimating: false,
    rollToken: 0,
    highlightedIndex: -1
  };

  function _getSave() {
    if (!window.saveData) window.saveData = {};
    if (!window.saveData.statCards || !Array.isArray(window.saveData.statCards.cards)) {
      window.saveData.statCards = { cards: [], purchases: 0 };
    }
    return window.saveData;
  }

  function _ensureCardsShape() {
    const sd = _getSave();
    const store = sd.statCards;

    while (store.cards.length < CARD_COUNT) {
      const pick = STAT_TYPES[(Math.random() * STAT_TYPES.length) | 0];
      store.cards.push({
        id: store.cards.length,
        statType: pick.id,
        isFlipped: false,
        level: 0,
        totalBonus: 0
      });
    }

    if (store.cards.length > CARD_COUNT) {
      store.cards = store.cards.slice(0, CARD_COUNT);
    }

    store.cards.forEach(function (c, i) {
      if (!c || typeof c !== 'object') {
        const pick = STAT_TYPES[(Math.random() * STAT_TYPES.length) | 0];
        store.cards[i] = { id: i, statType: pick.id, isFlipped: false, level: 0, totalBonus: 0 };
        return;
      }
      c.id = i;
      if (!STAT_TYPES.some(function (s) { return s.id === c.statType; })) {
        c.statType = STAT_TYPES[(Math.random() * STAT_TYPES.length) | 0].id;
      }
      c.isFlipped = !!c.isFlipped;
      c.level = Number.isFinite(c.level) ? Math.max(0, c.level) : 0;
      c.totalBonus = Number.isFinite(c.totalBonus) ? c.totalBonus : 0;
    });

    store.purchases = Number.isFinite(store.purchases) ? Math.max(0, store.purchases) : 0;

    cardState.cards = store.cards;
    cardState.purchases = store.purchases;
    _updateCost();
  }

  function _updateCost() {
    cardState.currentCost = Math.floor(BASE_COST * Math.pow(COST_MULTIPLIER, cardState.purchases));
  }

  function _rollRarity() {
    if (typeof window.rollUpgradeRarity === 'function') return window.rollUpgradeRarity();
    const r = Math.random();
    if (r < 0.5) return { name: 'common', scale: 1.0, color: '#888888' };
    if (r < 0.8) return { name: 'rare', scale: 1.5, color: '#4488ff' };
    if (r < 0.95) return { name: 'epic', scale: 2.0, color: '#aa44ff' };
    if (r < 0.99) return { name: 'legendary', scale: 3.0, color: '#ffaa00' };
    return { name: 'mythical', scale: 5.0, color: '#ff0088' };
  }

  function _isPercentStat(statId) {
    return statId.includes('Chance') || statId.includes('Reduction') || statId.includes('Speed') ||
      statId.includes('Gain') || statId === 'lifeSteal';
  }

  function _formatValue(v, statId) {
    if (_isPercentStat(statId)) return (v * 100).toFixed(1) + '%';
    return Number(v).toFixed(1);
  }

  function _applyStatBonus(statId, value) {
    if (!window.player) return;
    const p = window.player;
    const bonuses = p.permanentBonuses || {};
    bonuses[statId] = (bonuses[statId] || 0) + value;
    p.permanentBonuses = bonuses;

    if (statId === 'maxHp' && p.maxHealth !== undefined) {
      p.maxHealth += value;
      p.health = Math.min((p.health || 0) + value, p.maxHealth);
    } else if (statId === 'damage' && p.damage !== undefined) {
      p.damage += value;
    } else if (statId === 'armor' && p.armor !== undefined) {
      p.armor += value;
    }
  }

  function _pickFinalCard() {
    const unflipped = cardState.cards.filter(function (c) { return !c.isFlipped; });
    if (unflipped.length && Math.random() < 0.7) {
      return unflipped[(Math.random() * unflipped.length) | 0];
    }
    return cardState.cards[(Math.random() * cardState.cards.length) | 0];
  }

  function _trackCardUseStat() {
    const sd = _getSave();
    if (!sd.stats) {
      sd.stats = {
        itemsCrafted: 0, weaponsUpgraded: 0, statCardsUsed: 0, spinWheelSpins: 0,
        companionsLeveled: 0, buildingsUpgraded: 0, questsCompleted: 0, skillsUnlocked: 0, gearsEquipped: 0
      };
    }
    sd.stats.statCardsUsed = (sd.stats.statCardsUsed || 0) + 1;
  }

  function _save() {
    const sd = _getSave();
    sd.statCards.cards = cardState.cards;
    sd.statCards.purchases = cardState.purchases;
    if (typeof window.saveGame === 'function') window.saveGame();
    else if (typeof window.saveSaveData === 'function') window.saveSaveData();
  }

  function _renderCardHTML(card, index) {
    const statType = STAT_TYPES.find(function (s) { return s.id === card.statType; }) || STAT_TYPES[0];
    const isHi = cardState.highlightedIndex === index;
    const hiClass = isHi ? ' highlighted' : '';
    if (card.isFlipped) {
      return '<div class="stat-card flipped' + hiClass + '" data-index="' + index + '">' +
        '<div class="card-level">Lv ' + card.level + '</div>' +
        '<div class="card-icon">' + statType.icon + '</div>' +
        '<div class="card-name">' + statType.name + '</div>' +
        '<div class="card-value" style="color:' + statType.color + ';">+' + _formatValue(card.totalBonus, statType.id) + '</div>' +
      '</div>';
    }
    return '<div class="stat-card' + hiClass + '" data-index="' + index + '"><div class="card-back">?</div></div>';
  }

  function _render() {
    const overlay = document.getElementById('stat-cards-overlay');
    if (!overlay) return;
    overlay.innerHTML = '' +
      '<div class="stat-cards-container">' +
        '<div class="stat-cards-header">' +
          '<h2>🎰 Stat Cards</h2>' +
          '<button class="close-button" id="stat-cards-close-btn">✕</button>' +
        '</div>' +
        '<div class="stat-cards-info">' +
          '<div class="info-item"><span class="info-label">Current Cost:</span><span class="info-value">💰 ' + cardState.currentCost + ' Gold</span></div>' +
          '<div class="info-item"><span class="info-label">Your Gold:</span><span class="info-value">💰 ' + (window.player ? window.player.gold : 0) + '</span></div>' +
          '<div class="info-item"><span class="info-label">Purchases:</span><span class="info-value">' + cardState.purchases + '</span></div>' +
        '</div>' +
        '<button class="purchase-button" id="stat-cards-purchase-btn" ' + (cardState.isAnimating ? 'disabled' : '') + '>' +
          (cardState.isAnimating ? '🎰 ROLLING...' : ('🎰 Roll for ' + cardState.currentCost + ' Gold')) +
        '</button>' +
        '<div class="cards-grid">' + cardState.cards.map(_renderCardHTML).join('') + '</div>' +
      '</div>';

    const closeBtn = document.getElementById('stat-cards-close-btn');
    if (closeBtn) closeBtn.addEventListener('pointerdown', close);
    const purchaseBtn = document.getElementById('stat-cards-purchase-btn');
    if (purchaseBtn) purchaseBtn.addEventListener('pointerdown', purchaseCard);
  }

  function _animateRoll(finalIndex, rarity, done) {
    cardState.rollToken += 1;
    const token = cardState.rollToken;
    cardState.isAnimating = true;

    let step = 0;
    let idx = (Math.random() * CARD_COUNT) | 0;

    const tick = function () {
      if (token !== cardState.rollToken) return;
      if (step >= ROLL_STEPS) {
        cardState.highlightedIndex = finalIndex;
        _render();
        cardState.isAnimating = false;
        if (typeof done === 'function') done();
        return;
      }

      idx = (idx + 1) % CARD_COUNT;
      cardState.highlightedIndex = idx;
      _render();

      const t = step / (ROLL_STEPS - 1);
      const delay = Math.floor(ROLL_STEP_MS_MIN + (ROLL_STEP_MS_MAX - ROLL_STEP_MS_MIN) * t);
      step += 1;
      setTimeout(tick, delay);
    };

    if (window.GameAudio && window.GameAudio.playSound) {
      try { window.GameAudio.playSound('card_flip'); } catch (_e) {}
    }
    tick();
  }

  function _showResultMessage(card, statType, rarity, gained) {
    const msg = document.createElement('div');
    msg.style.cssText = [
      'position:fixed', 'left:50%', 'top:18%', 'transform:translateX(-50%)',
      'padding:14px 20px', 'border-radius:12px', 'z-index:10001', 'font-weight:800',
      'background:rgba(0,0,0,0.9)', 'border:2px solid ' + rarity.color,
      'box-shadow:0 0 18px ' + rarity.color, 'color:#fff', 'text-align:center'
    ].join(';');
    msg.innerHTML =
      '<div style="font-size:13px;opacity:.9;letter-spacing:1px;">' + rarity.name.toUpperCase() + '</div>' +
      '<div style="font-size:20px;margin:4px 0;">' + statType.icon + ' ' + statType.name + '</div>' +
      '<div style="font-size:18px;color:' + statType.color + ';">+' + _formatValue(gained, statType.id) + '</div>' +
      '<div style="font-size:12px;opacity:.8;margin-top:3px;">Total: ' + _formatValue(card.totalBonus, statType.id) + '</div>';
    document.body.appendChild(msg);
    setTimeout(function () {
      if (!msg.parentNode) return;
      msg.style.transition = 'opacity .2s ease';
      msg.style.opacity = '0';
      setTimeout(function () { if (msg.parentNode) msg.remove(); }, 220);
    }, 1600);
  }

  function initializeCards() {
    _ensureCardsShape();
  }

  function purchaseCard() {
    if (cardState.isAnimating) return;
    if (!window.player || window.player.gold < cardState.currentCost) {
      if (window.GameAudio && window.GameAudio.playSound) {
        try { window.GameAudio.playSound('invalid'); } catch (_e) {}
      }
      return;
    }

    window.player.gold -= cardState.currentCost;
    cardState.purchases += 1;
    _updateCost();

    const rarity = _rollRarity();
    const selectedCard = _pickFinalCard();
    const selectedIndex = Math.max(0, cardState.cards.indexOf(selectedCard));

    _animateRoll(selectedIndex, rarity, function () {
      const statType = STAT_TYPES.find(function (s) { return s.id === selectedCard.statType; }) || STAT_TYPES[0];
      const gain = statType.baseValue * (rarity.scale || 1);

      if (!selectedCard.isFlipped) {
        selectedCard.isFlipped = true;
        selectedCard.level = 1;
        selectedCard.totalBonus = gain;
      } else {
        selectedCard.level += 1;
        selectedCard.totalBonus += gain;
      }

      _applyStatBonus(selectedCard.statType, gain);
      _trackCardUseStat();
      _save();
      _render();

      if (window.GameAudio && window.GameAudio.playSound) {
        try { window.GameAudio.playSound('card_select'); } catch (_e) {}
      }
      _showResultMessage(selectedCard, statType, rarity, gain);
    });
  }

  function open() {
    initializeCards();
    let overlay = document.getElementById('stat-cards-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'stat-cards-overlay';
      overlay.className = 'building-overlay';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    _render();
  }

  function close() {
    cardState.highlightedIndex = -1;
    cardState.isAnimating = false;
    cardState.rollToken += 1;
    const overlay = document.getElementById('stat-cards-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  window.StatCards = {
    open: open,
    close: close,
    purchase: purchaseCard,
    initialize: initializeCards
  };
})();
