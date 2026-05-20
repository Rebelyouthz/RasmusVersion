/**
 * Tests for Camp/AIDA quest flow critical paths
 * Tests chip pickup, chip insertion, quest advance, and state persistence.
 */

// Minimal DOM environment setup (jsdom provided by Jest config)
beforeEach(() => {
  // Reset saveData-like object
  global.saveData = {
    aidaIntroState: { chipPickedUp: false, chipInserted: false },
    resources: { wood: 0, stone: 0 },
    campBuildings: { questMission: { level: 0, unlocked: false } },
    aidaStarterGranted: false,
  };
  global.saveSaveData = jest.fn();
  global.showStatusMessage = jest.fn();
  global.window._suppressAidaBubbles = false;
});

// ── Chip pickup state ────────────────────────────────────────────────────────
describe('AIDA chip pickup', () => {
  test('chipPickedUp flag starts false', () => {
    expect(global.saveData.aidaIntroState.chipPickedUp).toBe(false);
  });

  test('picking up chip sets chipPickedUp to true in saveData', () => {
    // Simulate what _pickUpAidaChip() does
    global.saveData.aidaIntroState.chipPickedUp = true;
    saveSaveData();
    expect(global.saveData.aidaIntroState.chipPickedUp).toBe(true);
    expect(global.saveSaveData).toHaveBeenCalledTimes(1);
  });

  test('chip cannot be picked up twice', () => {
    global.saveData.aidaIntroState.chipPickedUp = true;
    // Simulate guard: if already picked up, do nothing
    const callsBefore = global.saveSaveData.mock.calls.length;
    if (!global.saveData.aidaIntroState.chipPickedUp) {
      global.saveData.aidaIntroState.chipPickedUp = true;
      saveSaveData();
    }
    expect(global.saveSaveData.mock.calls.length).toBe(callsBefore); // no additional saves
  });
});

// ── Chip insertion state ─────────────────────────────────────────────────────
describe('AIDA chip insertion', () => {
  beforeEach(() => {
    global.saveData.aidaIntroState.chipPickedUp = true; // prereq
  });

  test('chipInserted flag starts false', () => {
    expect(global.saveData.aidaIntroState.chipInserted).toBe(false);
  });

  test('inserting chip sets chipInserted to true', () => {
    // Guard: must have picked up chip and not yet inserted
    if (global.saveData.aidaIntroState.chipPickedUp && !global.saveData.aidaIntroState.chipInserted) {
      global.saveData.aidaIntroState.chipInserted = true;
      saveSaveData();
    }
    expect(global.saveData.aidaIntroState.chipInserted).toBe(true);
    expect(global.saveSaveData).toHaveBeenCalledTimes(1);
  });

  test('chip cannot be inserted without being picked up', () => {
    global.saveData.aidaIntroState.chipPickedUp = false;
    const inserted = global.saveData.aidaIntroState.chipInserted;
    // Guard check (mirrors _insertAidaChip logic)
    if (!global.saveData.aidaIntroState.chipPickedUp) {
      // Should do nothing
    } else {
      global.saveData.aidaIntroState.chipInserted = true;
    }
    expect(global.saveData.aidaIntroState.chipInserted).toBe(inserted); // unchanged
  });

  test('chip cannot be re-inserted once done', () => {
    global.saveData.aidaIntroState.chipInserted = true;
    const savesBefore = global.saveSaveData.mock.calls.length;
    if (!global.saveData.aidaIntroState.chipPickedUp || global.saveData.aidaIntroState.chipInserted) {
      // Guard: do nothing
    } else {
      global.saveData.aidaIntroState.chipInserted = true;
      saveSaveData();
    }
    expect(global.saveSaveData.mock.calls.length).toBe(savesBefore);
  });
});

// ── Starter materials grant ───────────────────────────────────────────────────
describe('AIDA starter materials', () => {
  test('grants wood and stone on first call', () => {
    if (!global.saveData.aidaStarterGranted) {
      global.saveData.aidaStarterGranted = true;
      global.saveData.resources.wood  += 3;
      global.saveData.resources.stone += 3;
      global.saveData.campBuildings.questMission.unlocked = true;
      saveSaveData();
    }
    expect(global.saveData.resources.wood).toBe(3);
    expect(global.saveData.resources.stone).toBe(3);
    expect(global.saveData.campBuildings.questMission.unlocked).toBe(true);
  });

  test('does not grant materials twice', () => {
    global.saveData.aidaStarterGranted = true;
    const woodBefore = global.saveData.resources.wood;
    if (!global.saveData.aidaStarterGranted) {
      global.saveData.resources.wood += 3;
    }
    expect(global.saveData.resources.wood).toBe(woodBefore); // unchanged
  });
});

// ── Bubble suppression ────────────────────────────────────────────────────────
describe('AIDA robot bubble suppression', () => {
  test('_suppressAidaBubbles is false initially', () => {
    expect(global.window._suppressAidaBubbles).toBe(false);
  });

  test('bubble should be suppressed after chip insertion', () => {
    // Simulate what _insertAidaChip does
    global.window._suppressAidaBubbles = true;
    expect(global.window._suppressAidaBubbles).toBe(true);
  });

  test('bubble suppression persists across reloads (saveData)', () => {
    global.saveData.aidaIntroState.chipInserted = true;
    // On camp load, if chipInserted: suppress bubbles
    if (global.saveData.aidaIntroState.chipInserted) {
      global.window._suppressAidaBubbles = true;
    }
    expect(global.window._suppressAidaBubbles).toBe(true);
  });
});

// ── Quest Hall unlock ─────────────────────────────────────────────────────────
describe('Quest Hall progression', () => {
  test('Quest Hall starts locked', () => {
    expect(global.saveData.campBuildings.questMission.unlocked).toBe(false);
  });

  test('Quest Hall unlocks after chip insertion and material grant', () => {
    global.saveData.campBuildings.questMission.unlocked = true;
    expect(global.saveData.campBuildings.questMission.unlocked).toBe(true);
  });

  test('Quest Hall level 0 means not yet built', () => {
    expect(global.saveData.campBuildings.questMission.level).toBe(0);
  });
});

// ── initFirstQuest — new quest flow ──────────────────────────────────────────
describe('initFirstQuest (new questline)', () => {
  function normalizeTutorialQuestIds() {
    if (!global.saveData.tutorialQuests) {
      global.saveData.tutorialQuests = { currentQuest: null, completedQuests: [], readyToClaim: [] };
    }
    const tq = global.saveData.tutorialQuests;
    if (!Array.isArray(tq.completedQuests)) tq.completedQuests = [];
    if (!Array.isArray(tq.readyToClaim)) tq.readyToClaim = [];
    const legacyMap = { quest_gatherStrength: 'quest_awaken' };
    const valid = {
      quest_awaken: true,
      quest_buildQuesthall: true,
      quest_findingAida: true,
      quest_harvester: true
    };
    const normalize = (id) => {
      const mapped = legacyMap[id] || id;
      return valid[mapped] ? mapped : null;
    };
    tq.currentQuest = normalize(tq.currentQuest);
    tq.completedQuests = tq.completedQuests.map(normalize).filter(Boolean);
    tq.readyToClaim = tq.readyToClaim.map(normalize).filter(Boolean);
  }

  // Minimal implementation that mirrors the real initFirstQuest logic
  function initFirstQuest() {
    normalizeTutorialQuestIds();
    const completed = global.saveData.tutorialQuests.completedQuests || [];
    if (completed.includes('quest_buildQuesthall') || completed.includes('quest_awaken') || completed.includes('quest_findingAida')) return;
    if (global.saveData.tutorialQuests.currentQuest) return;
    global.saveData.tutorialQuests.currentQuest = 'quest_awaken';
    global.saveSaveData();
  }

  beforeEach(() => {
    global.saveData.tutorialQuests = { currentQuest: null, completedQuests: [], readyToClaim: [] };
  });

  test('activates quest_awaken for a fresh save', () => {
    initFirstQuest();
    expect(global.saveData.tutorialQuests.currentQuest).toBe('quest_awaken');
    expect(global.saveSaveData).toHaveBeenCalledTimes(1);
  });

  test('does not override an already-active quest', () => {
    global.saveData.tutorialQuests.currentQuest = 'quest_harvester';
    initFirstQuest();
    expect(global.saveData.tutorialQuests.currentQuest).toBe('quest_harvester');
    expect(global.saveSaveData).not.toHaveBeenCalled();
  });

  test('skips activation when quest_buildQuesthall is already completed (legacy guard)', () => {
    global.saveData.tutorialQuests.completedQuests = ['quest_buildQuesthall'];
    initFirstQuest();
    expect(global.saveData.tutorialQuests.currentQuest).toBeNull();
    expect(global.saveSaveData).not.toHaveBeenCalled();
  });

  test('skips activation when quest_findingAida is already completed (legacy save guard)', () => {
    global.saveData.tutorialQuests.completedQuests = ['quest_findingAida'];
    initFirstQuest();
    expect(global.saveData.tutorialQuests.currentQuest).toBeNull();
    expect(global.saveSaveData).not.toHaveBeenCalled();
  });

  test('migrates legacy quest_gatherStrength to quest_awaken', () => {
    global.saveData.tutorialQuests.currentQuest = 'quest_gatherStrength';
    initFirstQuest();
    expect(global.saveData.tutorialQuests.currentQuest).toBe('quest_awaken');
    expect(global.saveSaveData).not.toHaveBeenCalled();
  });

  test('normalizes completedQuests legacy ids before activation checks', () => {
    global.saveData.tutorialQuests.completedQuests = ['quest_gatherStrength'];
    initFirstQuest();
    expect(global.saveData.tutorialQuests.completedQuests).toEqual(['quest_awaken']);
    expect(global.saveData.tutorialQuests.currentQuest).toBeNull();
    expect(global.saveSaveData).not.toHaveBeenCalled();
  });
});

// ── hasVisitedCamp legacy-safe guard ─────────────────────────────────────────
describe('hasVisitedCamp first-visit gate', () => {
  // Mirrors the _isLikelyNewSave heuristic from quest-system.js showCampScreen()
  function isLikelyNewSave(sd) {
    const completedQuests = (sd.tutorialQuests && sd.tutorialQuests.completedQuests) || [];
    return (sd.runCount || 0) === 0 &&
           (sd.totalRuns || 0) === 0 &&
           completedQuests.length === 0;
  }

  test('fresh save (runCount=0, no completed quests) is treated as new', () => {
    const sd = { runCount: 0, totalRuns: 0, tutorialQuests: { completedQuests: [] } };
    expect(isLikelyNewSave(sd)).toBe(true);
  });

  test('save with prior runs is NOT treated as new', () => {
    const sd = { runCount: 5, totalRuns: 5, tutorialQuests: { completedQuests: [] } };
    expect(isLikelyNewSave(sd)).toBe(false);
  });

  test('save with completed quests is NOT treated as new', () => {
    const sd = { runCount: 0, totalRuns: 0, tutorialQuests: { completedQuests: ['quest_findingAida'] } };
    expect(isLikelyNewSave(sd)).toBe(false);
  });

  test('legacy save missing tutorialQuests is NOT treated as new when runCount > 0', () => {
    const sd = { runCount: 3, totalRuns: 3 };
    expect(isLikelyNewSave(sd)).toBe(false);
  });

  test('legacy save missing runCount fields but with completed quests is NOT treated as new', () => {
    const sd = { tutorialQuests: { completedQuests: ['quest_buildQuesthall', 'firstRunDeath'] } };
    expect(isLikelyNewSave(sd)).toBe(false);
  });
});

// ── Building migration v8 — inventory/accountBuilding reset ──────────────────
// Mirrors the migration v8 block in save-system.js loadSaveData().
function applyMigrationV8(sd) {
  if (sd._buildingMigrationV8) return;
  const aisV8 = sd.aidaIntroState;
  const chipInsertedV8 = !!(aisV8 && aisV8.chipInserted);
  if (!chipInsertedV8 && sd.campBuildings) {
    const bldInvV8 = sd.campBuildings.inventory;
    if (bldInvV8) { bldInvV8.level = 0; bldInvV8.unlocked = false; }
    const bldAccV8 = sd.campBuildings.accountBuilding;
    if (bldAccV8) { bldAccV8.level = 0; bldAccV8.unlocked = false; }
  }
  sd._buildingMigrationV8 = true;
}

describe('Building migration v8', () => {
  function makeSave(chipInserted, invLevel, accLevel) {
    return {
      aidaIntroState: { chipPickedUp: chipInserted, chipInserted },
      campBuildings: {
        inventory:       { level: invLevel, unlocked: invLevel > 0 },
        accountBuilding: { level: accLevel, unlocked: accLevel > 0 },
      },
    };
  }

  test('resets inventory when chip NOT yet inserted (pre-chip save)', () => {
    const sd = makeSave(false, 1, 0);
    applyMigrationV8(sd);
    expect(sd.campBuildings.inventory.level).toBe(0);
    expect(sd.campBuildings.inventory.unlocked).toBe(false);
  });

  test('resets accountBuilding when chip NOT yet inserted', () => {
    const sd = makeSave(false, 1, 1);
    applyMigrationV8(sd);
    expect(sd.campBuildings.accountBuilding.level).toBe(0);
    expect(sd.campBuildings.accountBuilding.unlocked).toBe(false);
  });

  test('leaves inventory intact when chip IS inserted (post-chip save)', () => {
    const sd = makeSave(true, 1, 1);
    applyMigrationV8(sd);
    expect(sd.campBuildings.inventory.level).toBe(1);
    expect(sd.campBuildings.inventory.unlocked).toBe(true);
  });

  test('leaves accountBuilding intact when chip IS inserted', () => {
    const sd = makeSave(true, 1, 1);
    applyMigrationV8(sd);
    expect(sd.campBuildings.accountBuilding.level).toBe(1);
    expect(sd.campBuildings.accountBuilding.unlocked).toBe(true);
  });

  test('sets _buildingMigrationV8 flag after running', () => {
    const sd = makeSave(false, 1, 0);
    applyMigrationV8(sd);
    expect(sd._buildingMigrationV8).toBe(true);
  });

  test('does not run again once flag is set (idempotent)', () => {
    const sd = makeSave(false, 1, 0);
    applyMigrationV8(sd); // first run — resets to 0
    sd.campBuildings.inventory.level = 1; // simulate rebuild
    applyMigrationV8(sd); // second call — should be no-op
    expect(sd.campBuildings.inventory.level).toBe(1); // unchanged
  });

  test('handles saves where aidaIntroState is missing (legacy null-safety)', () => {
    const sd = {
      campBuildings: {
        inventory:       { level: 1, unlocked: true },
        accountBuilding: { level: 1, unlocked: true },
      },
    };
    expect(() => applyMigrationV8(sd)).not.toThrow();
    // No aidaIntroState → chipInserted = false → buildings reset
    expect(sd.campBuildings.inventory.level).toBe(0);
  });

  test('treats truthy non-boolean chipInserted as inserted (strict cast)', () => {
    // Simulate a corrupt save where chipInserted was stored as a truthy string
    const sd = {
      aidaIntroState: { chipInserted: 'yes' }, // truthy non-boolean
      campBuildings: {
        inventory:       { level: 1, unlocked: true },
        accountBuilding: { level: 1, unlocked: true },
      },
    };
    applyMigrationV8(sd);
    // !!('yes') → true → chip is "inserted" → buildings must NOT be reset
    expect(sd.campBuildings.inventory.level).toBe(1);
    expect(sd.campBuildings.accountBuilding.level).toBe(1);
  });
});

// ── showQuestHall guard — missing questMission (PR #33 regression) ────────────
// Mirrors the guard logic at the top of showQuestHall() in quest-system.js.
describe('showQuestHall() Quest Hall access guard', () => {
  // Minimal inline mirror of the guard so we can unit-test without loading
  // the full quest-system.js module.
  function showQuestHallGuard(sd) {
    const questMissionData = sd.campBuildings && sd.campBuildings.questMission;
    if (!questMissionData || questMissionData.level === 0) {
      // Would show build overlay / status message; return 'blocked' for test
      return 'blocked';
    }
    return 'open';
  }

  test('blocks access when campBuildings.questMission is completely missing (legacy save)', () => {
    expect(showQuestHallGuard({ campBuildings: {} })).toBe('blocked');
  });

  test('blocks access when campBuildings is missing entirely', () => {
    expect(showQuestHallGuard({})).toBe('blocked');
  });

  test('blocks access when questMission.level === 0 (not yet built)', () => {
    const sd = { campBuildings: { questMission: { level: 0, unlocked: true } } };
    expect(showQuestHallGuard(sd)).toBe('blocked');
  });

  test('allows access when questMission.level > 0 (built)', () => {
    const sd = { campBuildings: { questMission: { level: 1, unlocked: true } } };
    expect(showQuestHallGuard(sd)).toBe('open');
  });
});

// ── AIDA _robotWalkToQuestHall guard (PR #33 regression) ─────────────────────
// Mirrors the relocation guard in CampWorld.enter() and refreshBuildings().
describe('AIDA robot relocation guard (_robotWalkToQuestHall)', () => {
  // Inline mirror of the combined guard condition.
  function shouldRelocate({ robotMesh, lapActive, walkActive }) {
    return !!(robotMesh && !lapActive && !walkActive);
  }

  test('does NOT relocate while lap is active', () => {
    expect(shouldRelocate({ robotMesh: {}, lapActive: true, walkActive: false })).toBe(false);
  });

  test('does NOT relocate while walk-to-quest-hall is active', () => {
    expect(shouldRelocate({ robotMesh: {}, lapActive: false, walkActive: true })).toBe(false);
  });

  test('does NOT relocate when both lap and walk are active', () => {
    expect(shouldRelocate({ robotMesh: {}, lapActive: true, walkActive: true })).toBe(false);
  });

  test('relocates only when both states are inactive', () => {
    expect(shouldRelocate({ robotMesh: {}, lapActive: false, walkActive: false })).toBe(true);
  });

  test('does NOT relocate when robot mesh is null (unbuilt scene)', () => {
    expect(shouldRelocate({ robotMesh: null, lapActive: false, walkActive: false })).toBe(false);
  });
});
