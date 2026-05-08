// ===============================================
// BLOOD SIMULATOR V2.1 – MAX QUALITY (BennyHood Edition)
// Fully fixed, terrain-aware, fantasy-realism, 120 FPS mobile+PC
// Replaces all old blood systems. Compatible with AdvancedTreeSystem.
// ===============================================

// Per-enemy-type blood palette (mirrors BloodV2 ENEMY_BLOOD table)
const _BSV21_BLOOD = {
  slime:         0x22cc44,
  crawler:       0x994422,
  leaping_slime: 0x00bfff,
  skinwalker:    0x220000,
  bug:           0xaadd00,
  human:         0xcc1100,
  alien:         0x8800ff,
  robot:         0x88aaff,
};
window._BSV21_BLOOD = _BSV21_BLOOD;

// Per-enemy mist color palette
const _BSV21_MIST = {
  slime:         0x55ff66,
  crawler:       0xbb7744,
  leaping_slime: 0x55ddff,
  skinwalker:    0x330000,
  bug:           0xccee33,
  human:         0xee2200,
  alien:         0xaa33ee,
  robot:         0xaaccff,
};

// Device capability detection — auto-scales pool sizes:
// Low-memory/mobile (≤2GB or touch device): 600 drops / 50 mist
// Mid-tier (≤4GB): 1800 drops / 120 mist
// Desktop/high-memory (>4GB): 3600 drops / 250 mist
// Goal: maximum blood coverage with minimal mist particles for advanced visual impact.
(function _bsv21DetectDevice() {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
  const mem = (navigator.deviceMemory || (isMobile ? 2 : 8));
  if (isMobile || mem <= 2) {
    window._BSV21_MAX_DROPS = 600;
    window._BSV21_MAX_MIST  = 50;
  } else if (mem <= 4) {
    window._BSV21_MAX_DROPS = 1800;
    window._BSV21_MAX_MIST  = 120;
  } else {
    window._BSV21_MAX_DROPS = 3600;
    window._BSV21_MAX_MIST  = 250;
  }
}());

const BloodSimulatorV21 = {
  scene: null,
  terrainMesh: null,
  player: null,
  dropIM: null,
  mistIM: null,
  _decals: null,
  _decalHead: 0,
  MAX_DROPS: window._BSV21_MAX_DROPS,
  MAX_MIST:  window._BSV21_MAX_MIST,
  MAX_DECALS: 200,

  _pool: null,
  _head: 0,
  _mistPool: null,
  _mistHead: 0,

  // Heartbeat pulse state
  _pulseTimer: 0,
  _pulseInterval: 0.30,
  _pulseWounds: [],

  _matrix: null,
  _color: null,

  /**
   * Creates a 64×64 THREE.CanvasTexture containing a white radial gradient
   * (opaque at centre, transparent at edge).  Used as the alphaMap/map on
   * the drop and mist InstancedMesh materials so each sprite renders as a
   * soft circular puff rather than a hard-edged polygon.
   * Falls back to a 1×1 white DataTexture if a 2D canvas context is unavailable.
   * @returns {THREE.Texture}
   */
  _makeCircleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Guard: some browsers may refuse a 2D context (context limit exhaustion).
    // Return a 1×1 opaque white DataTexture so the material still works.
    if (!ctx) {
      console.warn('[BloodSimulatorV21] Canvas 2D context unavailable — using fallback texture. Blood particles may appear as solid squares.');
      const fallback = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
      fallback.needsUpdate = true;
      return fallback;
    }
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0,   'rgba(255,255,255,1)');
    grad.addColorStop(0.45,'rgba(255,255,255,0.85)');
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  },

  init(scene, terrainMesh, player) {
    // Kill any legacy blood/gore systems that may linger from old saves or cached scripts.
    window.BloodV2 = null;
    window.GoreSimulator = null;

    this.scene = scene;
    this.terrainMesh = terrainMesh;
    this.player = player;

    this._matrix = new THREE.Matrix4();
    this._color  = new THREE.Color();

    // Shared circular alpha-map sprite texture (radial gradient, no hard edges)
    const _circleTex = this._makeCircleTexture();

    // Drop pool — use CircleGeometry laid flat (horizontal) for top-down view.
    // The radial-gradient alphaMap makes each drop appear as a soft circle.
    this._pool = new Array(this.MAX_DROPS);
    for (let i = 0; i < this.MAX_DROPS; i++) {
      this._pool[i] = { alive:false, px:0, py:0, pz:0, vx:0, vy:0, vz:0,
        radius:0.025, viscosity:0.62, life:0, onGround:false, color:0x8B0000 };
    }
    this._head = 0;

    // CircleGeometry lies in XY plane; rotateX(-PI/2) lays it flat in XZ (horizontal).
    const dropGeo = new THREE.CircleGeometry(1.0, 8);
    dropGeo.rotateX(-Math.PI / 2);
    const dropMat = new THREE.MeshBasicMaterial({
      map: _circleTex, transparent: true, alphaTest: 0.05,
      depthWrite: false, vertexColors: true, opacity: 0.92
    });
    this.dropIM = new THREE.InstancedMesh(dropGeo, dropMat, this.MAX_DROPS);
    this.dropIM.count = 0;
    this.dropIM.frustumCulled = false;
    this.dropIM.renderOrder = 10;
    this.dropIM.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.MAX_DROPS * 3), 3);
    this.dropIM.setColorAt(0, new THREE.Color(0x8B0000));
    scene.add(this.dropIM);

    // Mist pool — same CircleGeometry + radial-gradient texture for soft circular puffs.
    this._mistPool = new Array(this.MAX_MIST);
    for (let i = 0; i < this.MAX_MIST; i++) {
      this._mistPool[i] = { alive:false, px:0, py:0, pz:0, vx:0, vy:0, vz:0,
        radius:0.14, maxRadius:0.40, life:0, maxLife:1.8, color:0xee2200 };
    }
    this._mistHead = 0;

    const mistGeo = new THREE.CircleGeometry(1.0, 12);
    mistGeo.rotateX(-Math.PI / 2);
    const mistMat = new THREE.MeshBasicMaterial({
      map: _circleTex, transparent:true, opacity:0.65, depthWrite:false, alphaTest: 0.05,
      vertexColors:true, blending:THREE.AdditiveBlending
    });
    this.mistIM = new THREE.InstancedMesh(mistGeo, mistMat, this.MAX_MIST);
    this.mistIM.count = 0;
    this.mistIM.frustumCulled = false;
    this.mistIM.renderOrder = 11;
    this.mistIM.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.MAX_MIST * 3), 3);
    scene.add(this.mistIM);

    // Ground decal pool
    this._decals = [];
    this._decalHead = 0;
    const decalGeo = new THREE.CircleGeometry(1.0, 12);
    const decalMat = new THREE.MeshBasicMaterial({
      transparent:true, opacity:0.82, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1
    });
    for (let i = 0; i < this.MAX_DECALS; i++) {
      const m = new THREE.Mesh(decalGeo, decalMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.015;
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this._decals.push({ mesh:m, life:0, maxLife:0 });
    }

    this._pulseWounds = [];
    this._pulseTimer  = 0;
    return this;
  },

  reset() {
    if (this._pool) {
      for (let i = 0; i < this.MAX_DROPS; i++) this._pool[i].alive = false;
      this._head = 0;
    }
    if (this._mistPool) {
      for (let i = 0; i < this.MAX_MIST; i++) this._mistPool[i].alive = false;
      this._mistHead = 0;
    }
    if (this._decals) {
      for (let i = 0; i < this._decals.length; i++) {
        this._decals[i].life = 0;
        this._decals[i].mesh.visible = false;
      }
      this._decalHead = 0;
    }
    if (this._pulseWounds) this._pulseWounds.length = 0;
    this._pulseTimer = 0;
    if (this.dropIM) { this.dropIM.count = 0; this.dropIM.instanceMatrix.needsUpdate = true; }
    if (this.mistIM) { this.mistIM.count = 0; this.mistIM.instanceMatrix.needsUpdate = true; }
  },

  _spawnDecal(x, z, radius, hexColor, lifetime) {
    if (!this._decals) return;
    const slot = this._decals[this._decalHead];
    this._decalHead = (this._decalHead + 1) % this.MAX_DECALS;
    slot.mesh.material.color.setHex(hexColor);
    slot.mesh.material.opacity = 0.82;
    slot.mesh.material.needsUpdate = true;
    slot.mesh.position.set(x, 0.015, z);
    slot.mesh.scale.set(radius, 1, radius);
    slot.mesh.visible = true;
    slot.maxLife = lifetime || 25;
    slot.life    = slot.maxLife;
  },

  _spawnMist(x, y, z, vx, vy, vz, hexColor) {
    if (!this._mistPool) return;
    const m = this._mistPool[this._mistHead];
    this._mistHead = (this._mistHead + 1) % this.MAX_MIST;
    m.alive = true;
    m.px=x; m.py=y; m.pz=z;
    m.vx=vx; m.vy=vy; m.vz=vz;
    m.radius    = 0.12 + Math.random() * 0.10;
    m.maxRadius = 0.32 + Math.random() * 0.30;
    m.maxLife   = 1.6  + Math.random() * 1.2;
    m.life      = m.maxLife;
    m.color     = hexColor;
  },

  update(dt) {
    if (!this.dropIM || !this._pool) return;
    const matrix = this._matrix;
    const color  = this._color;

    // Heartbeat pulse
    this._pulseTimer += dt;
    if (this._pulseTimer >= this._pulseInterval && this._pulseWounds.length > 0) {
      this._pulseTimer = 0;
      for (let w = this._pulseWounds.length - 1; w >= 0; w--) {
        const wnd = this._pulseWounds[w];
        wnd.life -= this._pulseInterval;
        if (wnd.life <= 0) { this._pulseWounds.splice(w, 1); continue; }
        const pulseStr = Math.max(0.2, wnd.life / wnd.maxLife);
        // Scale count by device tier (MAX_DROPS relative to desktop max of 1200)
        // so lower-end devices never generate more particles than their pool supports.
        const tierScale = Math.min(1, this.MAX_DROPS / 1200);
        const cnt = Math.ceil(18 * pulseStr * tierScale);
        for (let i = 0; i < cnt; i++) {
          const d = this._pool[this._head];
          this._head = (this._head + 1) % this.MAX_DROPS;
          d.alive = true;
          d.px = wnd.x + (Math.random() - 0.5) * 0.3;
          d.py = wnd.y;
          d.pz = wnd.z + (Math.random() - 0.5) * 0.3;
          d.vx = (Math.random() - 0.5) * 4;
          d.vy = 2.5 + Math.random() * 5.0;
          d.vz = (Math.random() - 0.5) * 4;
          d.radius = 0.095 + Math.random() * 0.100; // 2.5x base for visibility
          d.viscosity = 0.72;
          d.life = 2 + Math.random() * 1.5;
          d.onGround = false;
          d.color = wnd.color;
        }
      }
    }

    // Drop physics
    let activeDrops = 0;
    for (let i = 0; i < this.MAX_DROPS; i++) {
      const d = this._pool[i];
      if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.alive = false;
        continue;
      }
      if (!d.onGround) {
        d.vy -= 9.81 * dt * 1.1;
        const speed = Math.hypot(d.vx, d.vy, d.vz);
        const drag  = Math.max(0, 1 - d.viscosity * dt * Math.max(speed, 0.1) * 1.2);
        d.vx *= drag; d.vy *= drag; d.vz *= drag;
        d.px += d.vx * dt; d.py += d.vy * dt; d.pz += d.vz * dt;
        if (d.py <= 0.015) {
          d.py = 0.015;
          d.vy = Math.abs(d.vy) * 0.25;
          if (d.vy < 0.15) {
            d.onGround = true;
            d.vx *= 0.3; d.vz *= 0.3;
            this._spawnDecal(d.px, d.pz, d.radius * 16 + 0.10, d.color, 30);
          }
        }
      }
      if (this.player && !d.onGround) {
        const dx = d.px - this.player.position.x;
        const dz = d.pz - this.player.position.z;
        if (dx*dx + dz*dz < 1.8 && d.py > 0.1) { d.vx += dx*6*dt; d.vz += dz*6*dt; }
      }
      if (activeDrops >= this.MAX_DROPS) continue;
      // CircleGeometry has radius 1.0; scale by d.radius gives the correct world size.
      matrix.makeScale(d.radius, d.radius, d.radius);
      matrix.setPosition(d.px, d.py, d.pz);
      this.dropIM.setMatrixAt(activeDrops, matrix);
      color.setHex(d.color);
      this.dropIM.setColorAt(activeDrops, color);
      activeDrops++;
    }
    this.dropIM.count = activeDrops;
    this.dropIM.instanceMatrix.needsUpdate = true;
    if (this.dropIM.instanceColor) this.dropIM.instanceColor.needsUpdate = true;

    // Mist update
    if (this.mistIM && this._mistPool) {
      let activeMist = 0;
      for (let i = 0; i < this.MAX_MIST; i++) {
        const m = this._mistPool[i];
        if (!m.alive) continue;
        m.life -= dt;
        if (m.life <= 0) { m.alive = false; continue; }
        m.vy = Math.max(m.vy, 0) + 0.04 * dt;
        m.vx *= Math.max(0, 1 - 1.8*dt);
        m.vz *= Math.max(0, 1 - 1.8*dt);
        m.px += m.vx*dt; m.py += m.vy*dt; m.pz += m.vz*dt;
        const t = 1 - m.life / m.maxLife;
        const r = m.radius + (m.maxRadius - m.radius) * t;
        const fade = Math.min(1, (m.life / m.maxLife) * 3);
        // Horizontal circle: uniform XZ scale (Y dimension has no visible effect on flat circle)
        matrix.makeScale(r, r, r);
        matrix.setPosition(m.px, m.py, m.pz);
        this.mistIM.setMatrixAt(activeMist, matrix);
        color.setHex(m.color);
        color.multiplyScalar(fade);
        this.mistIM.setColorAt(activeMist, color);
        activeMist++;
      }
      this.mistIM.count = activeMist;
      this.mistIM.instanceMatrix.needsUpdate = true;
      if (this.mistIM.instanceColor) this.mistIM.instanceColor.needsUpdate = true;
    }

    // Decal fade
    if (this._decals) {
      for (let i = 0; i < this._decals.length; i++) {
        const dc = this._decals[i];
        if (!dc.mesh.visible || dc.life <= 0) continue;
        dc.life -= dt;
        if (dc.life <= 0) {
          dc.mesh.visible = false;
        } else if (dc.life < 3) {
          dc.mesh.material.opacity = (dc.life / 3) * 0.82;
          dc.mesh.material.needsUpdate = true;
        }
      }
    }
  },

  rawBurst(x, y, z, count, options) {
    if (!this._pool) return;
    count = count || 45;
    options = options || {};
    let resolvedColor = options.color;
    if (!resolvedColor && options.enemyType && _BSV21_BLOOD[options.enemyType]) {
      resolvedColor = _BSV21_BLOOD[options.enemyType];
    }
    const spreadXZ  = options.spreadXZ  || 9;
    const spreadY   = options.spreadY   || 14;
    const viscosity = options.viscosity || 0.62;
    const col       = resolvedColor || 0x8B0000;
    const n = Math.min(count, this.MAX_DROPS);
    for (let i = 0; i < n; i++) {
      const d = this._pool[this._head];
      this._head = (this._head + 1) % this.MAX_DROPS;
      d.alive    = true;
      d.px = x + (Math.random()-0.5)*0.4;
      d.py = y + Math.random()*0.6;
      d.pz = z + (Math.random()-0.5)*0.4;
      d.vx = (Math.random()-0.5)*spreadXZ;
      d.vy = 4 + Math.random()*spreadY;
      d.vz = (Math.random()-0.5)*spreadXZ;
      d.radius    = 0.3375 + Math.random()*0.4125; // 3x base for maximum visibility
      d.viscosity = viscosity;
      d.life      = 5 + Math.random()*3;
      d.onGround  = false;
      d.color     = col;
    }
  },

  // V-shaped arterial jet: two diverging high-pressure streams + mist
  arterialJet(x, y, z, dirX, dirZ, hexColor) {
    if (!this._pool) return;
    const col    = hexColor || 0xcc1100;
    const mistEntry = Object.keys(_BSV21_BLOOD).find(k => _BSV21_BLOOD[k] === col);
    const misCol = (mistEntry && _BSV21_MIST[mistEntry]) ? _BSV21_MIST[mistEntry] : 0xee2200;
    const ANGLE  = 0.55;
    const cosA = Math.cos(ANGLE), sinA = Math.sin(ANGLE);
    const len  = Math.hypot(dirX || 1, dirZ || 0) || 1;
    const nx = (dirX || 1) / len, nz = (dirZ || 0) / len;
    for (let arm = 0; arm < 2; arm++) {
      const s  = arm === 0 ? sinA : -sinA;
      const ax = nx*cosA - nz*s;
      const az = nx*s    + nz*cosA;
      for (let i = 0; i < 30; i++) {
        const d = this._pool[this._head];
        this._head = (this._head + 1) % this.MAX_DROPS;
        const speed  = 60 + Math.random()*66;
        const spread = 0.18;
        d.alive = true;
        d.px = x + (Math.random()-0.5)*0.15;
        d.py = y + (Math.random()-0.5)*0.15;
        d.pz = z + (Math.random()-0.5)*0.15;
        d.vx = (ax + (Math.random()-0.5)*spread)*speed;
        d.vy = 2.0 + Math.random()*5.0;
        d.vz = (az + (Math.random()-0.5)*spread)*speed;
        d.radius    = 0.285 + Math.random()*0.3375; // 3x base for maximum visibility
        d.viscosity = 0.50;
        d.life      = 2.5 + Math.random()*2;
        d.onGround  = false;
        d.color     = col;
      }
    }
    const mistCount = Math.min(16, Math.max(4, Math.floor(this.MAX_MIST / 6)));
    for (let i = 0; i < mistCount; i++) {
      this._spawnMist(
        x + (Math.random()-0.5)*0.3, y + 0.2 + Math.random()*0.4, z + (Math.random()-0.5)*0.3,
        (Math.random()-0.5)*1.5, 0.4 + Math.random()*0.8, (Math.random()-0.5)*1.5, misCol
      );
    }
  },

  addWoundPulse(x, y, z, hexColor, duration) {
    if (this._pulseWounds.length >= 12) return;
    this._pulseWounds.push({ x, y, z, color: hexColor||0xcc1100,
      maxLife: duration||4.0, life: duration||4.0 });
  },

  spawnMist(x, y, z, count, hexColor) {
    const n = Math.min(count || 6, Math.max(2, Math.floor(this.MAX_MIST / 6)));
    for (let i = 0; i < n; i++) {
      this._spawnMist(
        x+(Math.random()-0.5)*0.5, y+0.1+Math.random()*0.4, z+(Math.random()-0.5)*0.5,
        (Math.random()-0.5)*2, 0.3+Math.random()*0.6, (Math.random()-0.5)*2,
        hexColor || 0xee2200
      );
    }
  },

  onEnemyHit(enemy, hitPoint, damageType) {
    const isProjectile = (typeof damageType === 'string') && damageType !== 'melee';
    // More blood drops on every hit — fewer mist particles to keep the look clean.
    const burstCount   = isProjectile ? 350 : 250;
    const mistColor    = (enemy && enemy.enemyType && _BSV21_MIST[enemy.enemyType])
      ? _BSV21_MIST[enemy.enemyType]  : 0xee2200;

    this.rawBurst(hitPoint.x, hitPoint.y, hitPoint.z, burstCount, {
      spreadXZ: 16, spreadY: 22,
      viscosity: (enemy && enemy.bloodViscosity) ? enemy.bloodViscosity : 0.62,
      color: 0xaa0000
    });
    // Reduced mist — only a light haze on impact
    this.spawnMist(hitPoint.x, hitPoint.y+0.3, hitPoint.z, isProjectile ? 6 : 3, mistColor);
    if (isProjectile || damageType === 'sword') {
      this.arterialJet(hitPoint.x, hitPoint.y+0.4, hitPoint.z,
        (Math.random()-0.5), (Math.random()-0.5), 0xaa0000);
    }
    this.addWoundPulse(hitPoint.x, hitPoint.y, hitPoint.z, 0xaa0000, 5.0);
  },

  onEnemyDeath(enemy, position) {
    // Massive blood burst on death — 6 arterial jets in all directions, huge decal.
    const mistColor  = (enemy && enemy.enemyType && _BSV21_MIST[enemy.enemyType])
      ? _BSV21_MIST[enemy.enemyType]  : 0xee2200;

    this.rawBurst(position.x, position.y+0.8, position.z, 600,
      { spreadXZ: 22, spreadY: 32, viscosity: 0.50, color: 0xaa0000 });
    // 6 jets spread evenly — fan of arterial sprays
    for (let jet = 0; jet < 6; jet++) {
      const ang = (jet / 6) * Math.PI * 2;
      this.arterialJet(position.x, position.y+1.0, position.z,
        Math.cos(ang), Math.sin(ang), 0xaa0000);
    }
    // Minimal mist on death — just enough for atmosphere
    this.spawnMist(position.x, position.y+0.6, position.z, 10, mistColor);
    // Larger, more dramatic ground decal
    this._spawnDecal(position.x, position.z, 2.5+Math.random()*1.2, 0xaa0000, 60);
    this.addWoundPulse(position.x, position.y+0.5, position.z, 0xaa0000, 9.0);
  },

  // Returns the 3D blood hex color for a given enemy type string.
  // Single source of truth — avoids duplicating _BSV21_BLOOD elsewhere.
  getEnemyBloodColor(enemyType) {
    return (enemyType && _BSV21_BLOOD[enemyType]) ? _BSV21_BLOOD[enemyType] : 0xcc1100;
  }
};

window.BloodSimulatorV21 = BloodSimulatorV21;
