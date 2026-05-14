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
const _BSV21_HUMAN_BLOOD_PALETTE = [0xcc1100, 0xaa0000, 0x8b0000, 0x990000, 0xbb1111, 0xdd2200];

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
// Mobile ≤2GB: 800 drops / 30 mist
// Mid ≤4GB: 2400 drops / 80 mist
// Desktop >4GB: 4800 drops / 120 mist
(function _bsv21DetectDevice() {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || ('ontouchstart' in window && navigator.maxTouchPoints > 1);
  const mem = (navigator.deviceMemory || (isMobile ? 2 : 8));
  if (isMobile || mem <= 2) {
    window._BSV21_MAX_DROPS = 800;
    window._BSV21_MAX_MIST  = 30;
  } else if (mem <= 4) {
    window._BSV21_MAX_DROPS = 2400;
    window._BSV21_MAX_MIST  = 80;
  } else {
    window._BSV21_MAX_DROPS = 4800;
    window._BSV21_MAX_MIST  = 120;
  }
}());

const _ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
const _SLIME_HIT_BASE_BURST = 350;

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
  _rivulets: null,
  _rivuletHead: 0,
  _bulletHoleSpurts: null,

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
        radius:0.025, viscosity:0.62, life:0, onGround:false, color:0x8B0000, bounces:0, enemyType:'human' };
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
    this._dropIM = this.dropIM;
    this._dropData = this._pool;
    this._mistIM = this.mistIM;

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
    this._rivulets = [];
    this._rivuletHead = 0;
    const rivGeo = new THREE.CircleGeometry(0.35, 8);
    rivGeo.rotateX(-Math.PI / 2);
    const rivMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 40; i++) {
      const rv = new THREE.Mesh(rivGeo, rivMat.clone());
      rv.visible = false;
      rv.position.y = 0.017;
      scene.add(rv);
      this._rivulets.push({ mesh: rv, life: 0, maxLife: 8 });
    }

    this._bulletHoleSpurts = [];

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
    if (this._rivulets) {
      for (let i = 0; i < this._rivulets.length; i++) {
        this._rivulets[i].life = 0;
        this._rivulets[i].mesh.visible = false;
      }
      this._rivuletHead = 0;
    }
    if (this._bulletHoleSpurts) this._bulletHoleSpurts.length = 0;
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

  _pickBloodColor(enemyType, fallbackColor) {
    if (enemyType === 'slime') return _BSV21_BLOOD.slime;
    if (enemyType === 'human' || !enemyType || enemyType === 'default') {
      return _BSV21_HUMAN_BLOOD_PALETTE[(Math.random() * _BSV21_HUMAN_BLOOD_PALETTE.length) | 0];
    }
    return _BSV21_BLOOD[enemyType] || fallbackColor || 0x8B0000;
  },

  update(dt) {
    if (!this.dropIM || !this._pool) return;
    dt = Math.min(Math.max(dt || 0.016, 0.001), 0.05);
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
        const cnt = Math.max(2, Math.min(4, Math.round(2 + pulseStr * 2)));
        for (let i = 0; i < cnt; i++) {
          const d = this._pool[this._head];
          this._head = (this._head + 1) % this.MAX_DROPS;
          d.alive = true;
          d.px = wnd.x + (Math.random() - 0.5) * 0.3;
          d.py = wnd.y;
          d.pz = wnd.z + (Math.random() - 0.5) * 0.3;
          d.vx = (Math.random() - 0.5) * 2.8;
          d.vy = 2.5 + Math.random() * 1.5;
          d.vz = (Math.random() - 0.5) * 2.8;
          d.radius = 0.06 + Math.random() * 0.05;
          d.viscosity = 0.72;
          d.life = 2 + Math.random() * 1.5;
          d.onGround = false;
          d.bounces = 0;
          d.color = wnd.color;
          // mini trail: 3 droplets trailing behind
          for (let t = 1; t <= 3; t++) {
            const tr = this._pool[this._head];
            this._head = (this._head + 1) % this.MAX_DROPS;
            tr.alive = true;
            tr.px = d.px - d.vx * 0.01 * t;
            tr.py = d.py - 0.03 * t;
            tr.pz = d.pz - d.vz * 0.01 * t;
            tr.vx = d.vx * 0.35;
            tr.vy = Math.max(0, d.vy * 0.35 - t * 0.1);
            tr.vz = d.vz * 0.35;
            tr.radius = 0.02 + Math.random() * 0.01;
            tr.viscosity = 0.78;
            tr.life = 0.9 + Math.random() * 0.4;
            tr.onGround = false;
            tr.bounces = 0;
            tr.color = wnd.color;
          }
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
        d.vy -= 9.8 * dt;
        const speed = Math.hypot(d.vx, d.vy, d.vz);
        const drag  = Math.max(0, 1 - d.viscosity * dt * Math.max(speed, 0.1) * 1.2);
        d.vx *= drag; d.vy *= drag; d.vz *= drag;
        d.px += d.vx * dt; d.py += d.vy * dt; d.pz += d.vz * dt;
        if (d.py <= 0.05) {
          d.py = 0.05;
          if ((d.bounces || 0) < 1) {
            d.bounces = (d.bounces || 0) + 1;
            d.vy = Math.abs(d.vy) * 0.25;
            d.vx *= 0.6; d.vz *= 0.6;
            this._spawnDecal(d.px, d.pz, d.radius * 8 + 0.05, d.color, 18);
          } else {
            d.onGround = true;
            d.vx *= 0.88; d.vz *= 0.88;
            this._spawnDecal(d.px, d.pz, d.radius * 16 + 0.10, d.color, 30);
            if (Math.random() < 0.30 && this._rivulets && this._rivulets.length) {
              const rv = this._rivulets[this._rivuletHead];
              this._rivuletHead = (this._rivuletHead + 1) % this._rivulets.length;
              rv.mesh.visible = true;
              rv.mesh.position.set(d.px, 0.016, d.pz);
              rv.mesh.rotation.x = -Math.PI / 2;
              rv.mesh.rotation.z = Math.atan2(d.vz || (Math.random() - 0.5), d.vx || (Math.random() - 0.5));
              rv.mesh.material.color.setHex(d.color);
              rv.mesh.material.opacity = 0.68;
              rv.life = 8;
              rv.maxLife = 8;
              rv.mesh.scale.set(1, 1 + Math.random() * 1.4, 1);
            }
          }
        }
      } else {
        d.vx *= Math.max(0, 1 - dt * 2.5);
        d.vz *= Math.max(0, 1 - dt * 2.5);
        d.px += d.vx * dt;
        d.pz += d.vz * dt;
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
    for (let i = activeDrops; i < this.MAX_DROPS; i++) { this.dropIM.setMatrixAt(i, _ZERO_MATRIX); }
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
      for (let i = activeMist; i < this.MAX_MIST; i++) { this.mistIM.setMatrixAt(i, _ZERO_MATRIX); }
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

    if (this._rivulets) {
      for (let i = 0; i < this._rivulets.length; i++) {
        const rv = this._rivulets[i];
        if (!rv.mesh.visible || rv.life <= 0) continue;
        rv.life -= dt;
        if (rv.life <= 0) {
          rv.mesh.visible = false;
        } else {
          rv.mesh.material.opacity = Math.max(0, 0.68 * (rv.life / rv.maxLife));
          rv.mesh.material.needsUpdate = true;
        }
      }
    }

    if (this._bulletHoleSpurts && this._bulletHoleSpurts.length) {
      for (let i = this._bulletHoleSpurts.length - 1; i >= 0; i--) {
        const bh = this._bulletHoleSpurts[i];
        bh.life -= dt;
        bh.tick -= dt;
        if (bh.life <= 0) {
          this._bulletHoleSpurts.splice(i, 1);
          continue;
        }
        if (bh.tick <= 0) {
          bh.tick = bh.life > 0.4 ? 0.06 : 0.08;
          const drops = bh.life > 0.4 ? 10 : (2 + ((Math.random() * 2) | 0));
          for (let j = 0; j < drops; j++) {
            const d = this._pool[this._head];
            this._head = (this._head + 1) % this.MAX_DROPS;
            const spread = bh.life > 0.4 ? 0.45 : 0.2;
            d.alive = true;
            d.px = bh.x + (Math.random() - 0.5) * 0.04;
            d.py = bh.y + (Math.random() - 0.5) * 0.04;
            d.pz = bh.z + (Math.random() - 0.5) * 0.04;
            d.vx = (bh.nx + (Math.random() - 0.5) * spread) * (bh.life > 0.4 ? 12 : 4);
            d.vy = 1.3 + Math.random() * 2.6;
            d.vz = (bh.nz + (Math.random() - 0.5) * spread) * (bh.life > 0.4 ? 12 : 4);
            d.radius = 0.025 + Math.random() * 0.02;
            d.viscosity = 0.72;
            d.life = 0.9 + Math.random() * 0.8;
            d.onGround = false;
            d.bounces = 0;
            d.color = bh.color;
          }
        }
      }
    }
  },

  emit(x, y, z, count, options) {
    const opts = options || {};
    const shotType = opts.shotType || 'pistol';
    const map = {
      pistol: { count: 10, spreadXZ: 6, spreadY: 8, radius: 0.03 },
      shotgun: { count: 22, spreadXZ: 12, spreadY: 10, radius: 0.035 },
      rifle: { count: 5, spreadXZ: 2, spreadY: 6, radius: 0.03 },
      uzi: { count: 7, spreadXZ: 7, spreadY: 7, radius: 0.028 },
      sniper: { count: 3, spreadXZ: 1.2, spreadY: 9, radius: 0.09 },
      melee: { count: 16, spreadXZ: 10, spreadY: 12, radius: 0.035 }
    }[shotType] || { count: 10, spreadXZ: 6, spreadY: 8, radius: 0.03 };
    const finalCount = count || map.count;
    const emitColor = (opts.color !== undefined && opts.color !== null)
      ? opts.color
      : this._pickBloodColor(opts.enemyType || 'human', 0xaa0000);
    this.rawBurst(x, y, z, finalCount, {
      spreadXZ: map.spreadXZ,
      spreadY: map.spreadY,
      viscosity: opts.viscosity || 0.62,
      color: emitColor,
      enemyType: opts.enemyType
    });
    if (shotType === 'sniper') {
      for (let i = 0; i < 6; i++) {
        this.rawBurst(x, y + 0.05 * i, z, 1, { spreadXZ: 0.8, spreadY: 2, color: opts.color, enemyType: opts.enemyType });
      }
    }
    if (Math.random() < 0.15) {
      this.rawBurst(x, y, z, 1, { spreadXZ: 0.5, spreadY: 0.5, color: opts.color, enemyType: opts.enemyType });
      const ad = this._pool[(this._head - 1 + this.MAX_DROPS) % this.MAX_DROPS];
      ad.vx = (Math.random() - 0.5) * 0.6;
      ad.vy = 5.0 + Math.random() * 3.0;
      ad.vz = (Math.random() - 0.5) * 0.6;
      ad.radius = 0.05 + Math.random() * 0.06;
    }
  },

  emitBurst(pos, count, opts) {
    if (!pos) return;
    this.emit(pos.x || 0, pos.y || 0, pos.z || 0, count || 8, Object.assign({ shotType: 'pistol' }, opts || {}));
  },

  emitWaterBurst(pos, count, opts) {
    if (!pos) return;
    this.spawnMist(pos.x || 0, (pos.y || 0) + 0.2, pos.z || 0, Math.max(1, Math.min(6, count || 2)), 0x5DADE2);
  },

  emitWaterPulse(pos, opts) {
    if (!pos) return;
    const o = opts || {};
    const pulses = o.pulses || 3;
    const perPulse = o.perPulse || 3;
    for (let i = 0; i < pulses; i++) {
      this.spawnMist(pos.x || 0, (pos.y || 0) + 0.2 + i * 0.02, pos.z || 0, Math.min(8, perPulse), 0x5DADE2);
    }
  },

  emitPulse(pos, opts) { this.emitBurst(pos, (opts && opts.perPulse) || 8, opts || {}); },
  emitGuts(pos, count) { this.emitBurst(pos, count || 6, { shotType: 'melee', spreadXZ: 7, spreadY: 10 }); },
  emitDroneMist(pos, dir, count) { if (pos) this.spawnMist(pos.x, (pos.y || 0) + 0.2, pos.z, Math.min(8, count || 4), 0x5DADE2); },
  emitSwordSlash(pos, dir, count) { this.emitBurst(pos, count || 12, { shotType: 'melee' }); },
  emitExitWound(pos, dir, count, opts) { this.emitBurst(pos, count || 8, Object.assign({ shotType: 'rifle' }, opts || {})); },
  emitHeartbeatWound(pos, opts) {
    if (!pos) return;
    this.addWoundPulse(pos.x || 0, (pos.y || 0) + ((opts && opts.woundHeight) || 0.5), pos.z || 0, 0xaa0000, 2.0);
  },
  emitArterialSpurt(pos, dir, opts) {
    if (!pos) return;
    this.arterialJet(pos.x || 0, (pos.y || 0) + 0.1, pos.z || 0, (dir && dir.x) || 1, (dir && dir.z) || 0, (opts && opts.color) || 0xaa0000);
  },

  emitBulletHole(pos, normal, opts) {
    if (!pos) return;
    const o = opts || {};
    const color = o.color || 0xaa0000;
    this._spawnDecal(pos.x || 0, pos.z || 0, 0.12 + Math.random() * 0.18, color, 24);
    const nx = normal && typeof normal.x === 'number' ? -normal.x : (Math.random() - 0.5);
    const nz = normal && typeof normal.z === 'number' ? -normal.z : (Math.random() - 0.5);
    this._bulletHoleSpurts.push({ x: pos.x || 0, y: pos.y || 0.1, z: pos.z || 0, nx, nz, color, life: 0.5, tick: 0 });
  },

  emitPoolGrow(pos, opts) {
    if (!pos) return;
    const o = opts || {};
    this._spawnDecal(pos.x || 0, pos.z || 0, o.maxRadius || 1.2, o.color || 0xaa0000, 60);
  },

  dispose() {
    try {
      if (this.scene && this.dropIM) this.scene.remove(this.dropIM);
      if (this.scene && this.mistIM) this.scene.remove(this.mistIM);
      if (this.dropIM) { this.dropIM.geometry.dispose(); this.dropIM.material.dispose(); }
      if (this.mistIM) { this.mistIM.geometry.dispose(); this.mistIM.material.dispose(); }
      if (this._decals) {
        for (let i = 0; i < this._decals.length; i++) {
          const m = this._decals[i].mesh;
          if (this.scene && m) this.scene.remove(m);
          if (m && m.geometry) m.geometry.dispose();
          if (m && m.material) m.material.dispose();
        }
      }
      if (this._rivulets) {
        for (let i = 0; i < this._rivulets.length; i++) {
          const m = this._rivulets[i].mesh;
          if (this.scene && m) this.scene.remove(m);
          if (m && m.geometry) m.geometry.dispose();
          if (m && m.material) m.material.dispose();
        }
      }
    } catch (_e) {}
  },

  rawBurst(x, y, z, count, options) {
    if (!this._pool) return;
    count = count || 45;
    options = options || {};
    const enemyType = options.enemyType || 'human';
    let resolvedColor = options.color;
    if (resolvedColor === undefined || resolvedColor === null) {
      resolvedColor = _BSV21_BLOOD[enemyType] || 0x8B0000;
    }
    const spreadXZ  = options.spreadXZ  || 9;
    const spreadY   = options.spreadY   || 14;
    const viscosity = options.viscosity || 0.62;
    const col       = resolvedColor || 0x8B0000;
    const _slimeScale = enemyType === 'slime' ? 0.15 : 1.0;
    const n = Math.min(Math.max(1, Math.round(count * _slimeScale)), this.MAX_DROPS);
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
      d.radius    = 0.04 + Math.random() * 0.08;
      d.viscosity = viscosity;
      d.life      = 5 + Math.random()*3;
      d.onGround  = false;
      d.bounces   = 0;
      d.enemyType = enemyType;
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

  spawnMist(x, y, z, count, hexColor, enemyType) {
    const isSlimeMist = enemyType === 'slime' || hexColor === _BSV21_MIST.slime || hexColor === _BSV21_BLOOD.slime;
    const n = isSlimeMist
      ? Math.min(1, Math.max(1, count || 2))
      : Math.min(count || 6, Math.max(2, Math.floor(this.MAX_MIST / 6)));
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
    const enemyType = (enemy && enemy.enemyType) ? enemy.enemyType : 'human';

    // Slimes get a smaller, melee-style burst to avoid excessive green particles
    if (enemy && enemy.enemyType === 'slime') {
      const burstCount = Math.max(2, Math.round(_SLIME_HIT_BASE_BURST * 0.15));
      this.emit(hitPoint.x, hitPoint.y, hitPoint.z, burstCount, {
        shotType: 'melee', enemyType, viscosity: 0.62
      });
      const mistColor = _BSV21_MIST.slime || 0x55ff66;
      this.spawnMist(hitPoint.x, hitPoint.y + 0.3, hitPoint.z, 2, mistColor, 'slime');
      return;
    }

    // More blood drops on every hit — fewer mist particles to keep the look clean.
    const burstCount   = isProjectile ? 350 : 250;
    const mistColor    = (enemy && enemy.enemyType && _BSV21_MIST[enemy.enemyType])
      ? _BSV21_MIST[enemy.enemyType]  : 0xee2200;
    this.emit(hitPoint.x, hitPoint.y, hitPoint.z, burstCount, {
      shotType: damageType === 'shotgun' ? 'shotgun' : (damageType === 'sniper' ? 'sniper' : (damageType === 'melee' ? 'melee' : (damageType === 'uzi' ? 'uzi' : 'pistol'))),
      enemyType,
      viscosity: (enemy && enemy.bloodViscosity) ? enemy.bloodViscosity : 0.62
    });
    // Reduced mist — only a light haze on impact
    this.spawnMist(hitPoint.x, hitPoint.y+0.3, hitPoint.z, isProjectile ? 6 : 3, mistColor, enemyType);
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

    const enemyType = (enemy && enemy.enemyType) ? enemy.enemyType : 'human';
    const emitCount = enemyType === 'slime' ? Math.max(3, Math.round(600 * 0.15)) : 600;
    const jetCount = enemyType === 'slime' ? 1 : 6;
    const mistCount = enemyType === 'slime' ? 2 : 10;
    this.emit(position.x, position.y+0.8, position.z, emitCount,
      { shotType: 'shotgun', spreadXZ: 22, spreadY: 32, viscosity: 0.50, enemyType });
    for (let jet = 0; jet < jetCount; jet++) {
      const ang = (jet / Math.max(1, jetCount)) * Math.PI * 2;
      this.arterialJet(position.x, position.y+1.0, position.z,
        Math.cos(ang), Math.sin(ang), 0xaa0000);
    }
    this.spawnMist(position.x, position.y+0.6, position.z, mistCount, mistColor, enemyType);
    // Larger, more dramatic ground decal
    this._spawnDecal(position.x, position.z, 2.5+Math.random()*1.2, 0xaa0000, 60);
    this.addWoundPulse(position.x, position.y+0.5, position.z, 0xaa0000, 9.0);
  },

  // Returns the 3D blood hex color for a given enemy type string.
  // Single source of truth — avoids duplicating _BSV21_BLOOD elsewhere.
  getEnemyBloodColor(enemyType) {
    return (enemyType && _BSV21_BLOOD[enemyType]) ? _BSV21_BLOOD[enemyType] : 0xcc1100;
  },

  hit(enemy, weaponKey, hitPoint) {
    const pos = hitPoint || (enemy && enemy.mesh && enemy.mesh.position) || { x: 0, y: 0, z: 0 };
    this.onEnemyHit(enemy || { enemyType: 'default' }, { x: pos.x || 0, y: pos.y || 0, z: pos.z || 0 }, weaponKey);
  },

  kill(enemy, weaponKey, hitPoint) {
    const pos = hitPoint || (enemy && enemy.mesh && enemy.mesh.position) || { x: 0, y: 0, z: 0 };
    this.onEnemyDeath(enemy || { enemyType: 'default' }, { x: pos.x || 0, y: pos.y || 0, z: pos.z || 0 }, weaponKey);
  },

  rawBurstUpward(x, y, z, count, opts) {
    const o = opts || {};
    this.rawBurst(x, y, z, count, Object.assign({}, o, { spreadY: Math.max(8, o.spreadY || 0) }));
  },

  smearBlood(x1, y1, z1, x2, y2, z2, count, color) {
    const mx = (x1 + x2) * 0.5;
    const my = (y1 + y2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    this.rawBurst(mx, my, mz, Math.max(6, count || 10), {
      spreadXZ: 4,
      spreadY: 6,
      viscosity: 0.75,
      color: color || 0xaa0000
    });
    this._spawnDecal(mx, mz, 0.45 + Math.random() * 0.25, color || 0xaa0000, 30);
  },

  getMeshes() {
    return {
      drops: this.dropIM || null,
      mist: this.mistIM || null,
    };
  },

  setParticleEffects(enabled) {
    this._particleEffectsEnabled = enabled !== false;
  },

  addEnemyBlood(enemyType, colors) {
    if (!enemyType || !colors) return;
    _BSV21_BLOOD[enemyType] = colors.base || colors.dark || colors.organ || colors.mist || 0xcc1100;
    _BSV21_MIST[enemyType] = colors.mist || colors.base || 0xee2200;
  }
};

window.BloodSimulatorV21 = BloodSimulatorV21;
// BloodV2 shim — inherits all BloodSimulatorV21 methods via prototype but hides
// init() to prevent accidental re-initialisation via window.BloodV2.init(scene).
// window.BloodSimulatorV21.init(scene) remains the canonical initialisation path.
window.BloodV2 = {
  ENEMY_BLOOD: {},
  _dropData: BloodSimulatorV21._pool || null,
  _dropIM: null,
  init: function(scene) {
    if (BloodSimulatorV21.scene) return;
    BloodSimulatorV21.init(scene, null, null);
  },
  update: function(dt) {
    if (typeof BloodSimulatorV21.update === 'function') BloodSimulatorV21.update(dt);
  },
  setParticleEffects: function(e) { BloodSimulatorV21.setParticleEffects(e); },
  emitBurst: function(pos, count, opts) { BloodSimulatorV21.emitBurst(pos, count, opts); },
  emit: function(x, y, z, count, opts) { BloodSimulatorV21.emit(x, y, z, count, opts); },
  hit: function(e, wk, hp, hn) { BloodSimulatorV21.hit(e, wk, hp); },
  kill: function(e, wk, hp) { BloodSimulatorV21.kill(e, wk, hp); },
  spawnMist: function(x,y,z,n,col,et) { BloodSimulatorV21.spawnMist(x,y,z,n,col,et); },
  rawBurst: function(x,y,z,count,opts) {
    if (typeof BloodSimulatorV21.rawBurst === 'function') BloodSimulatorV21.rawBurst(x,y,z,count,opts);
  },
  rawBurstUpward: function(x,y,z,count,opts) {
    if (typeof BloodSimulatorV21.rawBurstUpward === 'function') BloodSimulatorV21.rawBurstUpward(x,y,z,count,opts);
  },
  arterialJet: function(x,y,z,dx,dy,col) {
    if (typeof BloodSimulatorV21.arterialJet === 'function') BloodSimulatorV21.arterialJet(x,y,z,dx,dy,col);
  },
  addWoundPulse: function(x,y,z,col,r) {
    if (typeof BloodSimulatorV21.addWoundPulse === 'function') BloodSimulatorV21.addWoundPulse(x,y,z,col,r);
  },
  reset: function() { BloodSimulatorV21.reset(); },
};
Object.keys(_BSV21_BLOOD).forEach((enemyType) => {
  const base = _BSV21_BLOOD[enemyType];
  const mist = _BSV21_MIST[enemyType] || base;
  window.BloodV2.ENEMY_BLOOD[enemyType] = { base, dark: base, organ: base, mist };
});
if (!window.BloodV2.ENEMY_BLOOD.default) {
  window.BloodV2.ENEMY_BLOOD.default = { base: 0xcc1100, dark: 0xaa0000, organ: 0xcc1100, mist: 0xee2200 };
}
window.BloodSystem = window.BloodV2;

if (!window.GoreSim) {
  window.GoreSim = {
    init() {},
    update() {},
    reset() {},
    onHit(enemy, weaponKey, hitPoint) { window.BloodSimulatorV21.hit(enemy, weaponKey, hitPoint); },
    onKill(enemy, weaponKey, hitPoint) { window.BloodSimulatorV21.kill(enemy, weaponKey, hitPoint); },
  };
}
window.GoreSimulator = window.GoreSim;

if (!window.TraumaSystem) {
  window.TraumaSystem = {
    init() {},
    update() {},
    startArterialPump(position, dirX, dirY, dirZ, color) {
      if (!position) return;
      window.BloodSimulatorV21.arterialJet(position.x, position.y + 0.1, position.z, dirX || 0, dirZ || 0, color || 0xaa0000);
    },
    shotgunBlast(position, blastDir, enemyColor) {
      if (!position) return;
      window.BloodSimulatorV21.rawBurst(position.x, position.y, position.z, 40, {
        spreadXZ: 10,
        spreadY: 12,
        color: enemyColor || 0xaa0000
      });
      if (blastDir) {
        window.BloodSimulatorV21.arterialJet(position.x, position.y + 0.1, position.z, blastDir.x || 0, blastDir.z || 0, enemyColor || 0xaa0000);
      }
    },
    swordCleave(position, sliceAxisX, sliceAxisZ, enemyColor) {
      if (!position) return;
      window.BloodSimulatorV21.smearBlood(
        position.x - (sliceAxisX || 1) * 0.5, position.y + 0.1, position.z - (sliceAxisZ || 0) * 0.5,
        position.x + (sliceAxisX || 1) * 0.5, position.y + 0.1, position.z + (sliceAxisZ || 0) * 0.5,
        18, enemyColor || 0xaa0000
      );
    },
    explosiveGib(position, enemyColor) {
      if (!position) return;
      window.BloodSimulatorV21.rawBurst(position.x, position.y, position.z, 80, {
        spreadXZ: 16,
        spreadY: 20,
        color: enemyColor || 0xaa0000
      });
    }
  };
}
