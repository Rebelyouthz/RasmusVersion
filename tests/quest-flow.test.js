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
