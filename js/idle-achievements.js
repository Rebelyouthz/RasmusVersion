// Exposes window.GameAchievements for use by main.js
// Achievement system with permanent stat bonuses

(function () {
var ACHIEVEMENTS = [
  // Combat
  { id: 'combat_1',    name: 'First Blood',      description: 'Kill 100 enemies',      category: 'Combat',    requirement: { stat: 'totalKills', value: 100 },   bonus: { type: 'damage', pct: 1 },    attrPoints: 1 },
  { id: 'combat_2',    name: 'Warrior',          description: 'Kill 500 enemies',      category: 'Combat',    requirement: { stat: 'totalKills', value: 500 },   bonus: { type: 'damage', pct: 2 },    attrPoints: 1 },
  { id: 'combat_3',    name: 'Veteran',          description: 'Kill 1000 enemies',     category: 'Combat',    requirement: { stat: 'totalKills', value: 1000 },  bonus: { type: 'damage', pct: 3 },    attrPoints: 1 },
  { id: 'combat_4',    name: 'Warlord',          description: 'Kill 5000 enemies',     category: 'Combat',    requirement: { stat: 'totalKills', value: 5000 },  bonus: { type: 'damage', pct: 5 },    attrPoints: 2 },

  // Survival
  { id: 'survive_1',   name: 'Tough Cookie',     description: 'Survive 60 seconds',    category: 'Survival',  requirement: { stat: 'longestSurvival', value: 60 },  bonus: { type: 'maxHp', pct: 2 },  attrPoints: 1 },
  { id: 'survive_2',   name: 'Enduring',         description: 'Survive 180 seconds',   category: 'Survival',  requirement: { stat: 'longestSurvival', value: 180 }, bonus: { type: 'maxHp', pct: 4 },  attrPoints: 1 },
  { id: 'survive_3',   name: 'Resilient',        description: 'Survive 300 seconds',   category: 'Survival',  requirement: { stat: 'longestSurvival', value: 300 }, bonus: { type: 'maxHp', pct: 6 },  attrPoints: 1 },
  { id: 'survive_4',   name: 'Immortal',         description: 'Survive 600 seconds',   category: 'Survival',  requirement: { stat: 'longestSurvival', value: 600 }, bonus: { type: 'maxHp', pct: 10 }, attrPoints: 2 },

  // Wealth
  { id: 'wealth_1',    name: 'Coin Collector',   description: 'Earn 1000 total gold',  category: 'Wealth',    requirement: { stat: 'totalGoldEarned', value: 1000 },   bonus: { type: 'goldBonus', pct: 5 },  attrPoints: 1 },
  { id: 'wealth_2',    name: 'Merchant',         description: 'Earn 5000 total gold',  category: 'Wealth',    requirement: { stat: 'totalGoldEarned', value: 5000 },   bonus: { type: 'goldBonus', pct: 10 }, attrPoints: 1 },
  { id: 'wealth_3',    name: 'Tycoon',           description: 'Earn 25000 total gold',  category: 'Wealth',    requirement: { stat: 'totalGoldEarned', value: 25000 },  bonus: { type: 'goldBonus', pct: 15 }, attrPoints: 1 },
  { id: 'wealth_4',    name: 'Plutocrat',        description: 'Earn 100000 total gold', category: 'Wealth',    requirement: { stat: 'totalGoldEarned', value: 100000 }, bonus: { type: 'goldBonus', pct: 25 }, attrPoints: 2 },

  // Clicker
  { id: 'clicker_1',   name: 'Water Seeker',     description: 'Click fountain 100 times',  category: 'Clicker',   requirement: { stat: 'totalClicks', value: 100 },  bonus: { type: 'clickPower', pct: 10 }, attrPoints: 1 },
  { id: 'clicker_2',   name: 'Fountain Friend',  description: 'Click fountain 500 times',  category: 'Clicker',   requirement: { stat: 'totalClicks', value: 500 },  bonus: { type: 'clickPower', pct: 25 }, attrPoints: 1 },
  { id: 'clicker_3',   name: 'Drop Master',      description: 'Click fountain 2000 times', category: 'Clicker',   requirement: { stat: 'totalClicks', value: 2000 }, bonus: { type: 'clickPower', pct: 50 }, attrPoints: 1 },

  // Explorer
  { id: 'explorer_1',  name: 'Pathfinder',       description: 'Complete 5 expeditions',  category: 'Explorer',  requirement: { stat: 'totalExpeditions', value: 5 },  bonus: { type: 'expeditionRewards', pct: 10 }, attrPoints: 1 },
  { id: 'explorer_2',  name: 'Adventurer',       description: 'Complete 20 expeditions', category: 'Explorer',  requirement: { stat: 'totalExpeditions', value: 20 }, bonus: { type: 'expeditionRewards', pct: 20 }, attrPoints: 1 },
  { id: 'explorer_3',  name: 'Trailblazer',      description: 'Complete 50 expeditions', category: 'Explorer',  requirement: { stat: 'totalExpeditions', value: 50 }, bonus: { type: 'expeditionRewards', pct: 40 }, attrPoints: 1 },

  // Ascension
  { id: 'ascend_1',    name: 'Reborn',           description: 'Ascend 1 time',   category: 'Ascension', requirement: { stat: 'totalAscensions', value: 1 },  bonus: { type: 'allStats', pct: 5 },  attrPoints: 1 },
  { id: 'ascend_2',    name: 'Transcendent',     description: 'Ascend 3 times',  category: 'Ascension', requirement: { stat: 'totalAscensions', value: 3 },  bonus: { type: 'allStats', pct: 10 }, attrPoints: 1 },
  { id: 'ascend_3',    name: 'Ascendant',        description: 'Ascend 5 times',  category: 'Ascension', requirement: { stat: 'totalAscensions', value: 5 },  bonus: { type: 'allStats', pct: 20 }, attrPoints: 2 },
  { id: 'ascend_4',    name: 'Eternal',          description: 'Ascend 10 times', category: 'Ascension', requirement: { stat: 'totalAscensions', value: 10 }, bonus: { type: 'allStats', pct: 50 }, attrPoints: 2 },

  // ── Section 7: New tutorial-chain achievements ──────────────────────────────
  { id: 'new_first_step',    name: 'First Step',      description: 'Build your first building',     category: 'Camp',    requirement: { stat: 'totalBuildingsBuilt', value: 1 },  bonus: { type: 'goldBonus', pct: 1 }, rewardXP: 25,  rewardSlotCoins: 1,  rarity: 'common' },
  { id: 'new_blood_drawn',   name: 'Blood Drawn',     description: 'Complete your first run',       category: 'Combat',  requirement: { stat: 'totalRuns', value: 1 },             bonus: { type: 'damage',   pct: 1 }, rewardXP: 50,  rewardGold: 100,     rarity: 'common' },
  { id: 'new_collector',     name: 'Collector',       description: 'Gather 500 total resources',    category: 'Camp',    requirement: { stat: 'totalResourcesGathered', value: 500 }, bonus: { type: 'allStats', pct: 1 }, rewardXP: 75,  rewardSlotCoins: 2,  rarity: 'rare' },
  { id: 'new_slot_addict',   name: 'Slot Addict',     description: 'Spin the slot machine 5 times', category: 'Camp',    requirement: { stat: 'totalSlotSpins', value: 5 },         bonus: { type: 'goldBonus', pct: 2 }, rewardXP: 50,  rewardSlotCoins: 1,  rarity: 'common' },
  { id: 'new_the_grind',     name: 'The Grind',       description: 'Complete 10 runs',              category: 'Combat',  requirement: { stat: 'totalRuns', value: 10 },            bonus: { type: 'damage',   pct: 2 }, rewardXP: 200, rewardSkillPoints: 1, rarity: 'epic' },
  { id: 'new_builder_sup',   name: 'Builder Supreme', description: 'Build 5 buildings',             category: 'Camp',    requirement: { stat: 'totalBuildingsBuilt', value: 5 },  bonus: { type: 'allStats', pct: 2 }, rewardXP: 150, rewardSkillPoints: 2, rarity: 'epic' },
  { id: 'new_legendary',     name: 'Legendary',       description: 'Reach rank 5',                  category: 'Account', requirement: { stat: 'accountRank', value: 5 },          bonus: { type: 'allStats', pct: 5 }, rewardXP: 500, rewardSlotCoins: 5, rewardAttributePoints: 3, rarity: 'legendary' }
];

function getAchievementsDefaults() {
  return {
    unlocked: {}
  };
}

// Guard: the game's saveData.achievements is an Array (claimed-ID list), whereas the
// idle system needs an Object with an 'unlocked' map.  Returns true only when the field
// has the correct idle-system shape.
function _isIdleAchievementsData(raw) {
  return !!(raw && !Array.isArray(raw) && typeof raw === 'object' && raw.unlocked);
}

function checkAchievements(saveData) {
  var raw = saveData.achievements;
  var ach = _isIdleAchievementsData(raw) ? raw : getAchievementsDefaults();
  var stats = saveData.statistics || saveData.stats || {};
  // Also expose account rank as a stat for the 'Legendary' achievement
  if (saveData.account && saveData.account.level) {
    stats.accountRank = saveData.account.level;
  }
  var newly = [];

  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var def = ACHIEVEMENTS[i];
    if (ach.unlocked[def.id]) continue;
    var statVal = stats[def.requirement.stat] || 0;
    if (statVal >= def.requirement.value) {
      ach.unlocked[def.id] = Date.now();
      newly.push(def);
      // Award core attribute points for this achievement
      if (def.attrPoints && saveData.account) {
        saveData.account.coreAttributePoints = (saveData.account.coreAttributePoints || 0) + def.attrPoints;
      }
      // Section 7: grant new-achievement extra rewards (XP, slotCoins, gold, skillPoints)
      if (def.rewardXP && window.GameAccount && typeof window.GameAccount.addXP === 'function') {
        window.GameAccount.addXP(def.rewardXP, 'Achievement: ' + def.name, saveData);
      }
      if (def.rewardSlotCoins) {
        if (!saveData.resources) saveData.resources = {};
        saveData.resources.slotCoins = (saveData.resources.slotCoins || 0) + def.rewardSlotCoins;
      }
      if (def.rewardGold) {
        saveData.gold = (saveData.gold || 0) + def.rewardGold;
      }
      if (def.rewardSkillPoints) {
        saveData.skillPoints = (saveData.skillPoints || 0) + def.rewardSkillPoints;
      }
      if (def.rewardAttributePoints && saveData.account) {
        saveData.account.coreAttributePoints = (saveData.account.coreAttributePoints || 0) + def.rewardAttributePoints;
      }
      // Show via RewardDisplay for dopamine
      if (window.RewardDisplay) {
        (function(d) {
          setTimeout(function() {
            var rdItems = [];
            if (d.rewardXP)            rdItems.push({ icon: '⭐', label: 'Account XP', amount: d.rewardXP });
            if (d.rewardGold)          rdItems.push({ icon: '💰', label: 'Gold', amount: d.rewardGold });
            if (d.rewardSlotCoins)     rdItems.push({ icon: '🎰', label: 'Fate Coins', amount: d.rewardSlotCoins });
            if (d.rewardSkillPoints)   rdItems.push({ icon: '⭐', label: 'Skill Points', amount: d.rewardSkillPoints });
            window.RewardDisplay.show({
              title: '🏅 ACHIEVEMENT!',
              rarity: d.rarity || 'common',
              rewards: rdItems,
              source: 'achievement'
            });
          }, 300);
        })(def);
      }
    }
  }

  saveData.achievements = ach;
  return newly;
}

function getAchievementBonuses(saveData) {
  var raw = saveData.achievements;
  var ach = _isIdleAchievementsData(raw) ? raw : getAchievementsDefaults();
  var bonuses = {
    damage: 0,
    maxHp: 0,
    goldBonus: 0,
    clickPower: 0,
    expeditionRewards: 0,
    allStats: 0
  };

  for (var i = 0; i < ACHIEVEMENTS.length; i++) {
    var def = ACHIEVEMENTS[i];
    if (!ach.unlocked[def.id]) continue;
    bonuses[def.bonus.type] = (bonuses[def.bonus.type] || 0) + def.bonus.pct;
  }

  return bonuses;
}

window.GameAchievements = {
  ACHIEVEMENTS: ACHIEVEMENTS,
  getAchievementsDefaults: getAchievementsDefaults,
  isIdleAchievementsData: _isIdleAchievementsData,
  checkAchievements: checkAchievements,
  getAchievementBonuses: getAchievementBonuses
};
})();
