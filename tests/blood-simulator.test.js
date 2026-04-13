/**
 * Tests for js/blood-simulator-v21.js
 * Blood System V2.1 — pools, bursts, mist, decals, arterial jets, reset
 */

// Minimal THREE.js mock so the blood module can be required in jsdom
const mockMaterial = () => ({ needsUpdate: false, opacity: 1.0, color: { setHex() {} } });
const mockMesh = (geo, mat) => ({
  rotation: { x: 0 }, position: { set() {}, x: 0, y: 0, z: 0 },
  scale: { set() {} }, visible: false, frustumCulled: false,
  material: mat || mockMaterial(),
  traverse() {},
});

const mockIM = (maxCount) => {
  const im = {
    count: 0, frustumCulled: false,
    instanceColor: { needsUpdate: false },
    instanceMatrix: { needsUpdate: false },
    setMatrixAt() {}, setColorAt() {},
  };
  return im;
};

global.THREE = {
  Matrix4: class { makeScale() { return this; } setPosition() { return this; } },
  Color: class {
    constructor(hex) { this._h = hex || 0; }
    setHex(h) { this._h = h; return this; }
    multiplyScalar() { return this; }
  },
  Vector3: class { set() {} copy() {} },
  Raycaster: class { constructor() { this.ray = { direction: { set() {} }, origin: { copy() {} } }; } },
  SphereGeometry: class {},
  CircleGeometry: class {},
  MeshBasicMaterial: class {
    constructor(o) {
      Object.assign(this, o, { color: { setHex() {}, getHex() { return 0; } }, needsUpdate: false });
    }
    clone() {
      const m = new global.THREE.MeshBasicMaterial({});
      Object.assign(m, this);
      return m;
    }
  },
  InstancedMesh: function(geo, mat, maxCount) { return mockIM(maxCount); },
  InstancedBufferAttribute: class { constructor(arr, n) {} },
  AdditiveBlending: 'AdditiveBlending',
  Mesh: function(geo, mat) { return mockMesh(geo, mat); },
};

// JSDOM doesn't have navigator.deviceMemory — set a sensible default
Object.defineProperty(global.navigator, 'deviceMemory', { value: 8, configurable: true });
Object.defineProperty(global.navigator, 'maxTouchPoints', { value: 0, configurable: true });

// Load the module (sets window.BloodSimulatorV21)
require('../js/blood-simulator-v21.js');

// ── helpers ─────────────────────────────────────────────────────────────────
function makeFakeScene() {
  return { add() {} };
}

function initedSim() {
  const bs = window.BloodSimulatorV21;
  // Re-init with fresh pools each time
  bs.MAX_DROPS = window._BSV21_MAX_DROPS;
  bs.MAX_MIST  = window._BSV21_MAX_MIST;
  bs.scene = null; bs.dropIM = null; bs.mistIM = null; bs._pool = null; bs._mistPool = null;
  bs.init(makeFakeScene(), null, null);
  return bs;
}

// ── Device detection ─────────────────────────────────────────────────────────
describe('Device pool sizing', () => {
  test('sets _BSV21_MAX_DROPS on window', () => {
    expect(window._BSV21_MAX_DROPS).toBeDefined();
    expect(window._BSV21_MAX_DROPS).toBeGreaterThan(0);
  });

  test('desktop with 8GB memory uses >= 1200 drops', () => {
    expect(window._BSV21_MAX_DROPS).toBeGreaterThanOrEqual(1200);
  });

  test('desktop with 8GB memory uses >= 800 mist', () => {
    expect(window._BSV21_MAX_MIST).toBeGreaterThanOrEqual(800);
  });
});

// ── Init ─────────────────────────────────────────────────────────────────────
describe('BloodSimulatorV21.init()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('creates _pool with correct length', () => {
    expect(bs._pool).toHaveLength(bs.MAX_DROPS);
  });

  test('all drops start as not alive', () => {
    for (const d of bs._pool) expect(d.alive).toBe(false);
  });

  test('creates _mistPool with correct length', () => {
    expect(bs._mistPool).toHaveLength(bs.MAX_MIST);
  });

  test('creates _decals array', () => {
    expect(bs._decals).toBeDefined();
    expect(bs._decals.length).toBe(bs.MAX_DECALS);
  });

  test('_head starts at 0', () => {
    expect(bs._head).toBe(0);
  });

  test('dropIM.count starts at 0', () => {
    expect(bs.dropIM.count).toBe(0);
  });
});

// ── rawBurst ─────────────────────────────────────────────────────────────────
describe('BloodSimulatorV21.rawBurst()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('spawns correct number of alive drops', () => {
    bs.rawBurst(0, 1, 0, 20);
    const alive = bs._pool.filter(d => d.alive).length;
    expect(alive).toBe(20);
  });

  test('advances _head by count', () => {
    bs.rawBurst(0, 1, 0, 10);
    expect(bs._head).toBe(10);
  });

  test('respects MAX_DROPS cap', () => {
    bs.rawBurst(0, 1, 0, bs.MAX_DROPS + 999);
    const alive = bs._pool.filter(d => d.alive).length;
    expect(alive).toBeLessThanOrEqual(bs.MAX_DROPS);
  });

  test('sets correct color from enemyType', () => {
    bs.rawBurst(0, 1, 0, 5, { enemyType: 'slime' });
    const drop = bs._pool[0];
    expect(drop.color).toBe(0x22cc44); // slime green
  });

  test('sets explicit color when provided', () => {
    bs.rawBurst(0, 1, 0, 5, { color: 0xaabbcc });
    expect(bs._pool[0].color).toBe(0xaabbcc);
  });

  test('ring-buffer wraps around correctly', () => {
    bs.rawBurst(0, 1, 0, bs.MAX_DROPS);  // fill to end
    bs.rawBurst(0, 1, 0, 5);              // wrap around
    expect(bs._head).toBe(5);
  });
});

// ── Mist spawning ────────────────────────────────────────────────────────────
describe('BloodSimulatorV21.spawnMist()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('marks mist particles as alive', () => {
    bs.spawnMist(0, 1, 0, 6, 0xee2200);
    const alive = bs._mistPool.filter(m => m.alive).length;
    expect(alive).toBeGreaterThan(0);
  });

  test('does not exceed MAX_MIST', () => {
    bs.spawnMist(0, 1, 0, bs.MAX_MIST + 500, 0xee2200);
    const alive = bs._mistPool.filter(m => m.alive).length;
    expect(alive).toBeLessThanOrEqual(bs.MAX_MIST);
  });

  test('sets mist color', () => {
    bs.spawnMist(0, 1, 0, 1, 0x55ff66);
    expect(bs._mistPool[0].color).toBe(0x55ff66);
  });
});

// ── Decal spawning ───────────────────────────────────────────────────────────
describe('BloodSimulatorV21._spawnDecal()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('makes decal mesh visible', () => {
    bs._spawnDecal(1, 2, 0.3, 0xcc1100, 20);
    const slot = bs._decals[0];
    expect(slot.mesh.visible).toBe(true);
  });

  test('sets decal lifetime', () => {
    bs._spawnDecal(0, 0, 0.4, 0xcc1100, 30);
    expect(bs._decals[0].maxLife).toBe(30);
    expect(bs._decals[0].life).toBe(30);
  });

  test('ring-buffer wraps decals', () => {
    for (let i = 0; i <= bs.MAX_DECALS; i++) {
      bs._spawnDecal(i, i, 0.2, 0xcc1100, 10);
    }
    expect(bs._decalHead).toBe(1); // wrapped around once
  });
});

// ── Arterial jet ─────────────────────────────────────────────────────────────
describe('BloodSimulatorV21.arterialJet()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('spawns drops in two arms (36 drops total)', () => {
    bs.arterialJet(0, 1, 0, 1, 0, 0xcc1100);
    const alive = bs._pool.filter(d => d.alive).length;
    expect(alive).toBe(36); // 18 per arm × 2
  });

  test('drops have upward velocity component', () => {
    bs.arterialJet(0, 1, 0, 1, 0, 0xcc1100);
    const aliveDrop = bs._pool.find(d => d.alive);
    expect(aliveDrop.vy).toBeGreaterThan(0);
  });

  test('respects pool limit', () => {
    // Fill the pool first
    bs.rawBurst(0, 0, 0, bs.MAX_DROPS - 10);
    bs.arterialJet(0, 1, 0, 1, 0, 0xcc1100); // should not throw
    const alive = bs._pool.filter(d => d.alive).length;
    expect(alive).toBeLessThanOrEqual(bs.MAX_DROPS);
  });
});

// ── Wound pulse ──────────────────────────────────────────────────────────────
describe('BloodSimulatorV21.addWoundPulse()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('registers a wound pulse', () => {
    bs.addWoundPulse(0, 1, 0, 0xcc1100, 3);
    expect(bs._pulseWounds).toHaveLength(1);
  });

  test('caps pulse wounds at 8', () => {
    for (let i = 0; i < 20; i++) bs.addWoundPulse(i, 1, i, 0xcc1100, 2);
    expect(bs._pulseWounds.length).toBeLessThanOrEqual(8);
  });
});

// ── Reset ─────────────────────────────────────────────────────────────────────
describe('BloodSimulatorV21.reset()', () => {
  let bs;
  beforeEach(() => { bs = initedSim(); });

  test('clears all alive drops', () => {
    bs.rawBurst(0, 1, 0, 50);
    bs.reset();
    const alive = bs._pool.filter(d => d.alive).length;
    expect(alive).toBe(0);
  });

  test('resets _head to 0', () => {
    bs.rawBurst(0, 1, 0, 30);
    bs.reset();
    expect(bs._head).toBe(0);
  });

  test('clears mist pool', () => {
    bs.spawnMist(0, 1, 0, 10);
    bs.reset();
    const alive = bs._mistPool.filter(m => m.alive).length;
    expect(alive).toBe(0);
  });

  test('hides all decals', () => {
    bs._spawnDecal(0, 0, 0.3, 0xcc1100, 20);
    bs.reset();
    const visible = bs._decals.filter(d => d.mesh.visible).length;
    expect(visible).toBe(0);
  });

  test('clears pulse wounds', () => {
    bs.addWoundPulse(0, 1, 0, 0xcc1100, 4);
    bs.reset();
    expect(bs._pulseWounds).toHaveLength(0);
  });
});

// ── Blood color table ─────────────────────────────────────────────────────────
describe('Blood color palette', () => {
  test('slime uses green blood', () => {
    const bs = initedSim();
    bs.rawBurst(0, 1, 0, 1, { enemyType: 'slime' });
    expect(bs._pool[0].color).toBe(0x22cc44);
  });

  test('robot uses blue blood', () => {
    const bs = initedSim();
    bs.rawBurst(0, 1, 0, 1, { enemyType: 'robot' });
    expect(bs._pool[0].color).toBe(0x88aaff);
  });

  test('human uses red blood', () => {
    const bs = initedSim();
    bs.rawBurst(0, 1, 0, 1, { enemyType: 'human' });
    expect(bs._pool[0].color).toBe(0xcc1100);
  });

  test('unknown type defaults to dark red', () => {
    const bs = initedSim();
    bs.rawBurst(0, 1, 0, 1, { enemyType: 'unknown_xyz' });
    expect(bs._pool[0].color).toBe(0x8B0000);
  });
});
