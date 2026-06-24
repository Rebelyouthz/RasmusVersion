// js/rebalance.js — Global rebalance for proper roguelike survivor progression
// Start weak. Die = small permanent gains. Level up = feel the difference but not broken.
// Only 1 meaningful thing per menu/level. Codex = 1 gem always.
// Skills/talents slow + low %. Meta has clear 10-level tiers that you BUY with tokens from account XP.

(function() {
  'use strict';

  window.REBALANCE = {
    // Core multipliers (modest)
    REWARD_MULT: 0.08,          // old rewards were way too high
    SKILL_POINT_MULT: 0.4,
    TALENT_POINT_MULT: 0.35,
    GEM_FROM_CODEX: 1,          // ALWAYS 1 gem for codex discoveries
    BOOST_MULT: 0.22,           // % boosts in skills/talents now reasonable

    // Meta / Tier system
    META_LEVELS_PER_TIER: 10,
    TIER_UP_TOKEN_COST_BASE: 5,

    // "Only 1 thing per menu at each level"
    MAX_CHOICES_PER_CATEGORY: 1,

    // Feel progression
    START_WEAK_HP: 18,
    START_WEAK_DMG: 0.6,
  };

  // Hook: make codex always give exactly 1 gem
  const origCodexReward = window.giveCodexReward || null;
  window.giveCodexReward = function(type) {
    if (origCodexReward) origCodexReward(type);
    // Force 1 gem
    if (window.saveData && window.saveData.resources) {
      window.saveData.resources.gems = (window.saveData.resources.gems || 0) + window.REBALANCE.GEM_FROM_CODEX;
    }
    if (typeof showStatChange === 'function') showStatChange('💎 +1 Gem (Codex)');
  };

  // Reduce reward amounts globally where possible
  function nerfReward(amount, type) {
    if (!amount || typeof amount !== 'number') return amount;
    const m = window.REBALANCE.REWARD_MULT;
    return Math.max(1, Math.floor(amount * m));
  }
  window.nerfReward = nerfReward;

  // Meta tier system helper (call from account level up)
  window.getMetaTier = function(level) {
    level = level || (window.saveData && window.saveData.accountLevel) || 1;
    return Math.floor((level - 1) / window.REBALANCE.META_LEVELS_PER_TIER) + 1;
  };

  window.getTierUpTokensNeeded = function(currentTier) {
    return window.REBALANCE.TIER_UP_TOKEN_COST_BASE * (currentTier || 1);
  };

  // When account levels up, grant tier tokens every 10 levels
  const origAddAccountLevel = window.addAccountLevel || null;
  window.addAccountLevel = function() {
    if (origAddAccountLevel) origAddAccountLevel();
    const sd = window.saveData;
    if (!sd) return;
    sd.accountLevel = (sd.accountLevel || 1) + 1;

    const tier = window.getMetaTier(sd.accountLevel);
    const prevTier = window.getMetaTier(sd.accountLevel - 1);

    if (tier > prevTier) {
      sd.tierUpTokens = (sd.tierUpTokens || 0) + 3; // reward some tokens on tier boundary
      if (typeof showStatChange === 'function') {
        showStatChange('🌟 Tier Up Tokens +3! (Meta Tier ' + tier + ')');
      }
    }

    // Grant small tokens on every level for the buyable tier ups
    sd.tierUpTokens = (sd.tierUpTokens || 0) + 1;
  };

  // Tier up purchase (call from UI when tier up button appears)
  window.buyTierUp = function() {
    const sd = window.saveData;
    if (!sd) return false;
    const currentTier = window.getMetaTier(sd.accountLevel);
    const cost = window.getTierUpTokensNeeded(currentTier);
    if ((sd.tierUpTokens || 0) < cost) {
      if (typeof showStatChange === 'function') showStatChange('Not enough Tier Tokens');
      return false;
    }
    sd.tierUpTokens -= cost;
    sd.metaTier = (sd.metaTier || 1) + 1;
    // Big but fair permanent boost on tier purchase
    sd.metaTierBonus = (sd.metaTierBonus || 0) + 0.08; // +8% all stats per tier (modest)
    if (typeof showStatChange === 'function') showStatChange('TIER ' + sd.metaTier + ' UNLOCKED!');
    return true;
  };

  // Limit level-up choices to 1 per category (roguelike feel)
  window.limitLevelChoices = function(choices) {
    if (!choices || !Array.isArray(choices)) return choices;
    const max = window.REBALANCE.MAX_CHOICES_PER_CATEGORY || 1;
    // Group by category if they have one, otherwise just take first N
    const byCat = {};
    choices.forEach(c => {
      const cat = c.category || c.type || 'general';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(c);
    });
    const limited = [];
    Object.keys(byCat).forEach(cat => {
      limited.push(...byCat[cat].slice(0, max));
    });
    return limited.length ? limited : choices.slice(0, max);
  };

  // Nerf skill/talent % boosts
  const origApplySkill = window.applySkillBonus || null;
  window.applySkillBonus = function(stat, val) {
    const m = window.REBALANCE.BOOST_MULT;
    return (origApplySkill ? origApplySkill(stat, val) : val) * m;
  };

  console.log('[REBALANCE] Roguelike progression loaded. Start weak. Small meaningful gains. 1 choice per level.');
})();
