// js/xp-star-system.js — Floating XP star particles on kill
// Spawns a teardrop/star icon that floats up from the kill position to the XP bar HUD element.
// Zero heap allocation in steady state — uses a fixed-size object pool.
// Public API: window.XpStarSystem.spawn(worldPos, amount, scene, camera)

window.XpStarSystem = (function() {
  'use strict';

  const POOL_SIZE = 80;
  const FLOAT_DUR = 0.85;  // seconds to float up before homing to HUD
  const HOME_DUR  = 0.50;  // seconds to travel to XP bar
  const ICONS = ['⭐','✨','💧'];

  // Pool
  const _pool = [];
  let _poolInit = false;

  function _initPool() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'xp-star-particle';
      el.style.cssText =
        'position:fixed;pointer-events:none;z-index:9995;font-size:18px;' +
        'will-change:transform,opacity;display:none;user-select:none;' +
        'text-shadow:0 0 6px rgba(255,215,0,0.8);';
      document.body.appendChild(el);
      _pool.push({ el, active: false, phase: 'idle', x: 0, y: 0, vx: 0, vy: 0, age: 0, amount: 0 });
    }
    _poolInit = true;
  }

  function _getXpBarPos() {
    const bar = document.getElementById('xp-bar-fill') ||
                document.getElementById('xp-bar') ||
                document.getElementById('account-xp-bar') ||
                document.querySelector('.xp-bar-fill, .xp-fill, [id*="xp-bar"]');
    if (!bar) return { x: window.innerWidth * 0.5, y: 20 };
    const r = bar.getBoundingClientRect();
    return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.5 };
  }

  function _worldToScreen(worldPos, camera) {
    if (!camera || !window.THREE) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const v = worldPos.clone ? worldPos.clone() : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    v.y += 0.6;
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  // RAF loop
  let _rafRunning = false;
  let _prevT = 0;

  function _tick(now) {
    const dt = Math.min((now - _prevT) / 1000, 0.05);
    _prevT = now;
    let anyActive = false;
    const dest = _getXpBarPos();
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = _pool[i];
      if (!p.active) continue;
      anyActive = true;
      p.age += dt;

      if (p.phase === 'float') {
        // Float upward with slight drift
        p.vy -= 220 * dt;   // upward acceleration
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
          // Flash the XP bar
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
  }

  function _flashXpBar() {
    const bar = document.getElementById('xp-bar-fill') ||
                document.getElementById('xp-bar') ||
                document.querySelector('.xp-bar-fill, .xp-fill, [id*="xp-bar"]');
    if (!bar) return;
    bar.style.transition = 'box-shadow 0.08s ease-out';
    bar.style.boxShadow = '0 0 12px 4px rgba(255,215,0,0.9)';
    setTimeout(function() { bar.style.boxShadow = ''; }, 180);
  }

  function _returnToPool(p) {
    p.active = false;
    p.phase = 'idle';
    p.el.style.display = 'none';
  }

  function spawn(worldPos, amount, scene, camera) {
    if (!_poolInit) _initPool();
    // Number of stars = 1 + 1 extra per 5 XP, capped at 5
    const count = Math.min(1 + Math.floor((amount || 1) / 5), 5);
    const screenPos = _worldToScreen(worldPos, camera || window.camera);
    let spawned = 0;
    for (let i = 0; i < POOL_SIZE && spawned < count; i++) {
      const p = _pool[i];
      if (p.active) continue;
      p.active = true;
      p.phase = 'float';
      p.age = 0;
      p.x = screenPos.x + (Math.random() - 0.5) * 30;
      p.y = screenPos.y + (Math.random() - 0.5) * 20;
      p.vx = (Math.random() - 0.5) * 60;
      p.vy = -40 - Math.random() * 30;
      p.amount = amount;
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
  }

  return { spawn: spawn };
})();
