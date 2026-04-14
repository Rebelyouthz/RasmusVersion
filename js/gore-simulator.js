const GoreSimulator = {
  debug: false,
  onHit(enemy, weapon, hitPoint, hitNormal) {
    if (!enemy || enemy.dead) return;
    // FIX 3: ONLY use BloodSimulatorV21 - purge BloodV2 fallback
    if (window.BloodSimulatorV21) {
      window.BloodSimulatorV21.onEnemyHit(enemy, hitPoint, weapon.type);
    }
    if (weapon.type === 'sword' && Math.random() < 0.65) this.sliceEnemy(enemy, hitPoint, hitNormal);
  },
  onKill(enemy, weapon, killVX = 0, killVZ = 0) {
    if (!enemy) return;
    // FIX 3: ONLY use BloodSimulatorV21 - purge BloodV2 fallback
    if (window.BloodSimulatorV21) {
      window.BloodSimulatorV21.onEnemyDeath(enemy, enemy.mesh.position);
    }
    if (weapon.type === 'sword') this.dismemberEnemy(enemy, killVX, killVZ);
    else if (weapon.type === 'boomerang') this.boomerangKill(enemy);
    else if (weapon.type === 'shuriken') this.shurikenKill(enemy);
  },
  sliceEnemy(enemy, hitPoint, hitNormal) {
    if (this.debug) console.log('🩸 BRUTAL SLICE');
    // NOTE: do NOT squash enemy.mesh.scale here — it permanently distorts the mesh and
    // causes visible artifacts on every subsequent sword hit.
    const bx = hitPoint.x, by = hitPoint.y, bz = hitPoint.z;
    // FIX 3: ONLY use BloodSimulatorV21 - trigger ALL effects (spray, splatters, chunks)
    if (window.BloodSimulatorV21) {
      window.BloodSimulatorV21.rawBurst(bx, by + 0.4, bz, 28, {viscosity: 0.45});
      window.BloodSimulatorV21.rawBurst(bx, by + 0.8, bz, 12, {viscosity: 0.35});
    }
  },
  dismemberEnemy(enemy, vx, vz) {
    if (this.debug) console.log('💀 DISMEMBER');
    const pos = enemy.mesh.position;
    // FIX 3: ONLY use BloodSimulatorV21 - massive burst with ALL effects (strict GROUND_Y limits)
    if (window.BloodSimulatorV21) {
      window.BloodSimulatorV21.rawBurst(pos.x, pos.y + 1.8, pos.z, 220, {spreadXZ: 22, spreadY: 32, viscosity: 0.38});
    }
  },
  boomerangKill(enemy) {
    if (this.debug) console.log('🌀 BOOMERANG KILL');
    const pos = enemy.mesh ? enemy.mesh.position : enemy.position;
    if (!pos) return;
    // FIX 3: ONLY use BloodSimulatorV21 - spinning decapitation with ALL effects
    if (window.BloodSimulatorV21) {
      window.BloodSimulatorV21.rawBurst(pos.x, pos.y + 1.2, pos.z, 80, {spreadXZ: 18, spreadY: 20, viscosity: 0.45});
      window.BloodSimulatorV21.spawnMist(pos.x, pos.y + 0.8, pos.z, 10);
      window.BloodSimulatorV21.addWoundPulse(pos.x, pos.y + 0.5, pos.z, 0xcc1100, 3);
    }
  },
  shurikenKill(enemy) {
    if (this.debug) console.log('⭐ SHURIKEN KILL');
    const pos = enemy.mesh ? enemy.mesh.position : enemy.position;
    if (!pos) return;
    // FIX 3: ONLY use BloodSimulatorV21 - precision puncture with ALL effects
    if (window.BloodSimulatorV21) {
      window.BloodSimulatorV21.arterialJet(pos.x, pos.y + 1.0, pos.z, 1, 0, 0xcc1100);
      window.BloodSimulatorV21.spawnMist(pos.x, pos.y + 0.6, pos.z, 6, 0xee2200);
    }
  }
};
window.GoreSimulator = GoreSimulator;

// ── Backward-compat shim: existing callers use window.GoreSim with string weapon keys ──
// GoreSimulator expects weapon as {type: string}; legacy callers pass a plain string.
// Also stubs init/update/reset so guarded call-sites don't skip silently.
window.GoreSim = {
  init() {},
  update() {},
  reset() {},
  onHit(enemy, weaponKeyOrObj, hitPoint, hitNormal) {
    var w = (typeof weaponKeyOrObj === 'string') ? { type: weaponKeyOrObj } : weaponKeyOrObj;
    GoreSimulator.onHit(enemy, w, hitPoint, hitNormal);
  },
  onKill(enemy, weaponKeyOrObj, projectile) {
    var w = (typeof weaponKeyOrObj === 'string') ? { type: weaponKeyOrObj } : weaponKeyOrObj;
    GoreSimulator.onKill(enemy, w, 0, 0);
  }
};
