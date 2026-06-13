// js/xp-star-system.js — Floating XP star particles on kill
// Supports BOTH old API: XPStarSystem.spawn(x, y, z, type, dmg, vx, vz)
//            AND new API: XpStarSystem.spawn(worldPos, amount, scene, camera)
// Zero heap allocation in steady state — uses a fixed-size object pool.

(function() {
  'use strict';

  const POOL_SIZE = 80;
  const FLOAT_DUR = 0.85;
  const HOME_DUR  = 0.50;
  const ICONS = ['⭐','✨','💧'];

  const _pool = [];
  let _poolInit = false;

  function _initPool() {
    if (_poolInit) return;
    try {
      for (let i = 0; i < POOL_SIZE; i++) {
        const el = document.createElement('div');
        el.className = 'xp-star-particle';
        el.style.cssText =
          'position:fixed;pointer-events:none;z-index:9995;font-size:18px;' +
          'will-change:transform,opacity;display:none;user-select:none;' +
          'text-shadow:0 0 6px rgba(255,215,0,0.8);';
        document.body.appendChild(el);
        _pool.push({ el, active: false, phase: 'idle', x: 0, y: 0, vx: 0, vy: 0, age: 0, amount: 0, _sx: 0, _sy: 0 });
      }
      _poolInit = true;
    } catch(e) { console.warn('[XpStarSystem] pool init failed:', e); }
  }

  function _getXpBarPos() {
    try {
      const bar = document.getElementById('bottom-exp-fill') ||
                  document.getElementById('exp-fill') ||
                  document.getElementById('xp-bar-fill') ||
                  document.getElementById('xp-bar') ||
                  document.getElementById('account-xp-bar') ||
                  document.querySelector('.xp-bar-fill,.xp-fill,.acc-xp-bar,[id*="xp-bar"],[id*="exp-fill"]');
      if (!bar) return { x: window.innerWidth * 0.5, y: window.innerHeight - 30 };
      const r = bar.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return { x: window.innerWidth * 0.5, y: window.innerHeight - 30 };
      return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.5 };
    } catch(e) { return { x: window.innerWidth * 0.5, y: window.innerHeight - 30 }; }
  }

  function _worldToScreen(worldPos, camera) {
    try {
      if (!camera) camera = window.camera;
      if (!camera || !window.THREE) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      }
      const THREE = window.THREE;
      const v = (worldPos && worldPos.clone)
        ? worldPos.clone()
        : new THREE.Vector3(
            worldPos ? (worldPos.x || 0) : 0,
            worldPos ? (worldPos.y || 0) : 0,
            worldPos ? (worldPos.z || 0) : 0
          );
      v.y += 0.6;
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight
      };
    } catch(e) { return { x: window.innerWidth / 2, y: window.innerHeight / 2 }; }
  }

  let _rafRunning = false;
  let _prevT = 0;

  function _tick(now) {
    try {
      const dt = Math.min((now - _prevT) / 1000, 0.05);
      _prevT = now;
      let anyActive = false;
      const dest = _getXpBarPos();
      for (let i = 0; i < _pool.length; i++) {
        const p = _pool[i];
        if (!p.active) continue;
        anyActive = true;
        p.age += dt;

        if (p.phase === 'float') {
          p.vy -= 220 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.el.style.left = p.x + 'px';
          p.el.style.top  = p.y + 'px';
          p.el.style.opacity = '1';
          if (p.age >= FLOAT_DUR) {
            p.phase = 'home';
            p.age = 0;
            p._sx = p.x;
            p._sy = p.y;
          }
        } else if (p.phase === 'home') {
          const t = Math.min(p.age / HOME_DUR, 1);
          const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
          p.x = p._sx + (dest.x - p._sx) * ease;
          p.y = p._sy + (dest.y - p._sy) * ease;
          const scale = 1 - t * 0.5;
          p.el.style.left = p.x + 'px';
          p.el.style.top  = p.y + 'px';
          p.el.style.transform = 'translate(-50%,-50%) scale(' + scale + ')';
          p.el.style.opacity = String(1 - t * 0.3);
          if (p.age >= HOME_DUR) {
            _returnToPool(p);
            _flashXpBar();
          }
        }
      }
      if (anyActive) {
        _rafRunning = true;
        requestAnimationFrame(_tick);
      } else {
        _rafRunning = false;
      }
    } catch(e) { _rafRunning = false; }
  }

  function _flashXpBar() {
    try {
      const bar = document.getElementById('bottom-exp-fill') ||
                  document.getElementById('exp-fill') ||
                  document.getElementById('xp-bar-fill') ||
                  document.getElementById('xp-bar') ||
                  document.querySelector('.xp-bar-fill,.xp-fill,.acc-xp-bar,[id*="xp-bar"],[id*="exp-fill"]');
      if (!bar) return;
      bar.style.transition = 'box-shadow 0.08s ease-out';
      bar.style.boxShadow = '0 0 12px 4px rgba(255,215,0,0.9)';
      setTimeout(function() { try { bar.style.boxShadow = ''; } catch(_) {} }, 180);
    } catch(e) {}
  }

  function _returnToPool(p) {
    p.active = false;
    p.phase = 'idle';
    try { p.el.style.display = 'none'; } catch(_) {}
  }

  // ── Core spawn (new API) ──────────────────────────────────────────
  // spawn(worldPos, amount, scene, camera)
  function spawn(worldPos, amount, scene, camera) {
    try {
      if (!_poolInit) _initPool();
      const count = Math.min(1 + Math.floor(((amount || 1)) / 5), 5);
      const screenPos = _worldToScreen(worldPos, camera || window.camera);
      let spawned = 0;
      for (let i = 0; i < _pool.length && spawned < count; i++) {
        const p = _pool[i];
        if (p.active) continue;
        p.active = true;
        p.phase = 'float';
        p.age = 0;
        p.x = screenPos.x + (Math.random() - 0.5) * 30;
        p.y = screenPos.y + (Math.random() - 0.5) * 20;
        p.vx = (Math.random() - 0.5) * 60;
        p.vy = -40 - Math.random() * 30;
        p.amount = amount || 1;
        p.el.textContent = ICONS[Math.floor(Math.random() * ICONS.length)];
        p.el.style.left = p.x + 'px';
        p.el.style.top  = p.y + 'px';
        p.el.style.transform = 'translate(-50%,-50%) scale(1)';
        p.el.style.opacity = '1';
        p.el.style.display = 'block';
        spawned++;
      }
      if (!_rafRunning && spawned > 0) {
        _prevT = performance.now();
        _rafRunning = true;
        requestAnimationFrame(_tick);
      }
    } catch(e) { console.warn('[XpStarSystem] spawn error:', e); }
  }

  // ── Old API shim ──────────────────────────────────────────────────
  // spawn(x, y, z, type, dmg, vx, vz)
  function spawnOld(x, y, z, type, dmg, vx, vz) {
    try {
      if (!_poolInit) _initPool();
      const worldPos = { x: x || 0, y: y || 0, z: z || 0 };
      const amount = Math.max(1, Math.round((dmg || 1) / 10));
      spawn(worldPos, amount, null, window.camera);
    } catch(e) { console.warn('[XpStarSystem] spawnOld error:', e); }
  }

  function reset() {
    try {
      for (let i = 0; i < _pool.length; i++) {
        _returnToPool(_pool[i]);
      }
    } catch(e) {}
  }

  function init(scene) {
    try {
      if (!_poolInit) _initPool();
    } catch(e) {}
  }

  function update(dt, playerPos) {
    // Particles use their own RAF loop; this is a no-op but kept for API compat
  }

  function collectAll() {
    try {
      const dest = _getXpBarPos();
      for (let i = 0; i < _pool.length; i++) {
        const p = _pool[i];
        if (!p.active) continue;
        p.phase = 'home';
        p.age = 0;
        p._sx = p.x;
        p._sy = p.y;
      }
    } catch(e) {}
  }

  const api = {
    spawn:      spawn,
    spawnOld:   spawnOld,
    init:       init,
    update:     update,
    reset:      reset,
    collectAll: collectAll
  };

  // Expose under BOTH names (camelCase + UPPERCASE) so all callsites work
  window.XpStarSystem  = api;
  window.XPStarSystem  = {
    spawn: spawnOld   // Old callsites use spawn(x,y,z,type,dmg,vx,vz)
  };

})();
