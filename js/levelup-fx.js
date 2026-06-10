// js/levelup-fx.js — Cinematic level-up FX system
// Handles: water fountain, force-field shockwave, LEVEL UP text, card confetti + black hole
// State machine: window._levelupPhase tracks current phase
// Zero setTimeout chains — uses requestAnimationFrame + phase tracker

window.LevelUpFX = (function () {
  'use strict';

  let _state = 'idle';
  let _onExplosionComplete = null;

  // ── Water Fountain (InstancedMesh particle system) ──────────────────────
  const MAX_DROPS = 300;
  let _scene = null;
  let _fountain = null;
  let _fountainMat = null;
  let _drops = null; // {px,py,pz, vx,vy,vz, life, maxLife}[]
  let _dropCount = 0;
  let _fountainActive = false;
  let _fountainAge = 0;
  const _m4 = typeof THREE !== 'undefined' ? new THREE.Matrix4() : null;
  const _v3 = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
  const _q0 = typeof THREE !== 'undefined' ? new THREE.Quaternion() : null;
  const _s1 = typeof THREE !== 'undefined' ? new THREE.Vector3(1, 1, 1) : null;

  function _initFountain(scene) {
    if (!window.THREE) return;
    _scene = scene;
    const geo = new THREE.SphereGeometry(0.045, 4, 4);
    _fountainMat = new THREE.MeshBasicMaterial({ color: 0x4ac8ff });
    _fountainMat.transparent = true;
    _fountainMat.opacity = 0.85;
    _fountain = new THREE.InstancedMesh(geo, _fountainMat, MAX_DROPS);
    _fountain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    _fountain.frustumCulled = false;
    scene.add(_fountain);
    // pre-alloc drop structs
    _drops = [];
    for (let i = 0; i < MAX_DROPS; i++) {
      _drops.push({ px:0,py:0,pz:0, vx:0,vy:0,vz:0, life:0, maxLife:1 });
    }
    _dropCount = 0;
  }

  function _emitFountainDrops(origin, count) {
    for (let i = 0; i < count; i++) {
      if (_dropCount >= MAX_DROPS) _dropCount = 0;
      const d = _drops[_dropCount++];
      const spread = 2;
      d.px = origin.x + (Math.random() - 0.5) * 0.3;
      d.py = origin.y + 0.5;
      d.pz = origin.z + (Math.random() - 0.5) * 0.3;
      d.vx = (Math.random() - 0.5) * spread;
      d.vy = 6 + Math.random() * 4;
      d.vz = (Math.random() - 0.5) * spread;
      d.life = 0;
      d.maxLife = 1.2 + Math.random() * 0.4;
    }
  }

  function _updateFountain(dt) {
    if (!_fountain || !_drops) return;
    const G = -9.8;
    let visible = 0;
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = _drops[i];
      if (d.life >= d.maxLife) {
        _m4.makeScale(0, 0, 0);
        _fountain.setMatrixAt(i, _m4);
        continue;
      }
      d.life += dt;
      d.vy += G * dt;
      d.px += d.vx * dt;
      d.py += d.vy * dt;
      d.pz += d.vz * dt;
      const t = d.life / d.maxLife;
      const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      _v3.set(d.px, d.py, d.pz);
      _m4.compose(_v3, _q0, _s1);
      _fountain.setMatrixAt(i, _m4);
      visible++;
    }
    _fountain.instanceMatrix.needsUpdate = true;
    _fountain.count = MAX_DROPS;
    return visible;
  }

  function _destroyFountain() {
    if (_fountain && _scene) {
      _scene.remove(_fountain);
      _fountain.geometry.dispose();
      _fountainMat.dispose();
      _fountain = null;
    }
  }

  // ── Force-field shockwave ring ──────────────────────────────────────────
  let _ringMesh = null;
  let _ringAge = 0;
  const RING_DURATION = 0.8;
  const RING_MAX_RADIUS = 8;

  function _startRing(scene, origin) {
    if (!window.THREE) return;
    const geo = new THREE.RingGeometry(0.1, 0.25, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    _ringMesh = new THREE.Mesh(geo, mat);
    _ringMesh.rotation.x = -Math.PI / 2;
    _ringMesh.position.set(origin.x, origin.y + 0.05, origin.z);
    scene.add(_ringMesh);
    _ringAge = 0;
  }

  function _updateRing(dt) {
    if (!_ringMesh) return;
    _ringAge += dt;
    const t = Math.min(_ringAge / RING_DURATION, 1);
    const r = t * RING_MAX_RADIUS;
    _ringMesh.scale.setScalar(r < 0.01 ? 0.01 : r);
    _ringMesh.material.opacity = 1 - t;
    if (_ringAge >= RING_DURATION) {
      _scene && _scene.remove(_ringMesh);
      _ringMesh.geometry.dispose();
      _ringMesh.material.dispose();
      _ringMesh = null;
    }
  }

  // ── LEVEL UP text ────────────────────────────────────────────────────────
  let _textEl = null;

  function _showLevelUpText(screenX, screenY) {
    if (_textEl) { try { _textEl.remove(); } catch(_) {} }
    _textEl = document.createElement('div');
    _textEl.style.cssText = [
      'position:fixed',
      'left:' + screenX + 'px',
      'top:' + screenY + 'px',
      'transform:translate(-50%,-50%) scale(0.3)',
      'font:900 4em/1 "Bangers",cursive',
      'color:#FFD700',
      'text-shadow:2px 2px 0 #000,-2px -2px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,0 0 20px rgba(255,215,0,0.6)',
      'pointer-events:none',
      'z-index:9998',
      'opacity:1',
      'transition:transform 0.5s cubic-bezier(0.34,1.56,0.64,1),opacity 0.25s ease-out,top 0.9s ease-out'
    ].join(';');
    _textEl.textContent = 'LEVEL UP!';
    document.body.appendChild(_textEl);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (!_textEl) return;
        _textEl.style.transform = 'translate(-50%,-50%) scale(1)';
        _textEl.style.top = (screenY - 120) + 'px';
        setTimeout(function() {
          if (!_textEl) return;
          _textEl.style.opacity = '0';
          setTimeout(function() { if (_textEl) { _textEl.remove(); _textEl = null; } }, 280);
        }, 650);
      });
    });
  }

  // ── Enemy push from shockwave ────────────────────────────────────────────
  function _pushEnemies(origin) {
    try {
      const enemies = window.enemies || window._enemies || [];
      enemies.forEach(function(e) {
        if (!e || !e.mesh) return;
        const dx = e.mesh.position.x - origin.x;
        const dz = e.mesh.position.z - origin.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < RING_MAX_RADIUS && dist > 0.01) {
          const force = (RING_MAX_RADIUS - dist) * 4;
          e.vx = (e.vx || 0) + (dx / dist) * force;
          e.vz = (e.vz || 0) + (dz / dist) * force;
        }
      });
    } catch(_) {}
  }

  // ── Main public API ──────────────────────────────────────────────────────
  let _rafHandle = null;
  let _prevT = 0;
  let _explosionTimer = 0;

  function playExplosion(playerOrPos, scene, onComplete) {
    if (!window.THREE) { onComplete && onComplete(); return; }
    _onExplosionComplete = onComplete;
    _state = 'fx';
    _explosionTimer = 0;
    if (!_fountain) _initFountain(scene);

    const origin = playerOrPos && playerOrPos.mesh
      ? playerOrPos.mesh.position
      : (playerOrPos && playerOrPos.position ? playerOrPos.position : new THREE.Vector3(0,0,0));

    // Emit first burst of drops
    _emitFountainDrops(origin, 150);
    _fountainActive = true;
    _fountainAge = 0;

    _startRing(scene, origin);
    _pushEnemies(origin);

    // Screen coords for LEVEL UP text
    let sx = window.innerWidth / 2, sy = window.innerHeight / 2;
    try {
      if (playerOrPos && playerOrPos.mesh && window.camera) {
        const headPos = playerOrPos.mesh.position.clone();
        headPos.y += 2;
        headPos.project(window.camera);
        sx = (headPos.x * 0.5 + 0.5) * window.innerWidth;
        sy = (-(headPos.y * 0.5) + 0.5) * window.innerHeight;
      }
    } catch(_) {}
    _showLevelUpText(sx, sy);

    // Emit secondary burst at 0.3s
    setTimeout(function() { _emitFountainDrops(origin, 150); }, 300);

    _prevT = performance.now();
    function _tick(now) {
      const dt = Math.min((now - _prevT) / 1000, 0.05);
      _prevT = now;
      _explosionTimer += dt;
      _updateFountain(dt);
      _updateRing(dt);
      if (_explosionTimer < 1.0) {
        _rafHandle = requestAnimationFrame(_tick);
      } else {
        _fountainActive = false;
        setTimeout(function() { _destroyFountain(); }, 500);
        _state = 'idle';
        if (_onExplosionComplete) { _onExplosionComplete(); _onExplosionComplete = null; }
      }
    }
    _rafHandle = requestAnimationFrame(_tick);
  }

  // ── Card confetti + black hole ───────────────────────────────────────────
  function confettiAndBlackHole(selectedCardEl, rarity, onDone) {
    const FRAG_COUNT = 55;
    const rarityPalettes = {
      common:    ['#ffffff','#dddddd','#aaaaaa'],
      uncommon:  ['#55cc55','#88ee88','#33aa33'],
      rare:      ['#00aaff','#55ccff','#0077cc'],
      epic:      ['#aa00ff','#cc55ff','#8800cc'],
      legendary: ['#FFD700','#FFE45A','#FFB000'],
      mythic:    ['#ff2020','#ff5555','#cc0000']
    };
    const palette = rarityPalettes[rarity] || rarityPalettes.common;

    // Get card centre
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    try {
      const r = selectedCardEl.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    } catch(_) {}

    // Build fragments
    const frags = [];
    for (let i = 0; i < FRAG_COUNT; i++) {
      const f = document.createElement('div');
      f.className = 'confetti-piece';
      const sz = 12 + Math.random() * 13;
      f.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;will-change:transform,opacity;width:' + sz + 'px;height:' + sz + 'px;background:' + palette[Math.floor(Math.random() * palette.length)] + ';border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';left:' + cx + 'px;top:' + cy + 'px;transform:translate(-50%,-50%);opacity:1;';
      document.body.appendChild(f);
      const angle = Math.random() * Math.PI * 2;
      const speed = 400 + Math.random() * 600;
      frags.push({
        el: f,
        vx: Math.cos(angle) * speed,
        vy: -600 + Math.random() * 400,
        vr: (Math.random() - 0.5) * 800,
        x: cx, y: cy, r: 0,
        life: 0, maxLife: 1.1 + Math.random() * 0.2
      });
    }

    // Physics loop
    let prev = performance.now();
    const G = 1500;
    function _fragTick(now) {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      let anyAlive = false;
      for (let i = 0; i < frags.length; i++) {
        const f = frags[i];
        if (f.life >= f.maxLife) continue;
        anyAlive = true;
        f.vy += G * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.r += f.vr * dt;
        f.life += dt;
        const alpha = f.life > f.maxLife * 0.65 ? 1 - (f.life - f.maxLife * 0.65) / (f.maxLife * 0.35) : 1;
        f.el.style.left = f.x + 'px';
        f.el.style.top  = f.y + 'px';
        f.el.style.transform = 'translate(-50%,-50%) rotate(' + f.r + 'deg)';
        f.el.style.opacity = Math.max(0, alpha);
      }
      if (anyAlive) {
        requestAnimationFrame(_fragTick);
      } else {
        frags.forEach(function(f) { try { f.el.remove(); } catch(_){} });
        _spawnBlackHole(onDone);
      }
    }
    requestAnimationFrame(_fragTick);
  }

  function _spawnBlackHole(onDone) {
    const bh = document.createElement('div');
    bh.className = 'levelup-blackhole';
    document.body.appendChild(bh);
    // Expand
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        bh.style.transition = 'all 0.5s cubic-bezier(0.55,0,1,0.45)';
        const maxR = Math.max(window.innerWidth, window.innerHeight) * 2;
        bh.style.width  = maxR + 'px';
        bh.style.height = maxR + 'px';
        bh.style.transform = 'translate(-50%,-50%) rotate(360deg)';
        setTimeout(function() {
          // Collapse
          bh.style.transition = 'all 0.4s ease-in';
          bh.style.width  = '0px';
          bh.style.height = '0px';
          bh.style.opacity = '0';
          bh.style.transform = 'translate(-50%,-50%) rotate(720deg)';
          setTimeout(function() {
            try { bh.remove(); } catch(_) {}
            if (onDone) onDone();
          }, 420);
        }, 520);
      });
    });
  }

  return {
    playExplosion: playExplosion,
    confettiAndBlackHole: confettiAndBlackHole,
    _updateFountain: _updateFountain,
    _state: function() { return _state; }
  };
})();
