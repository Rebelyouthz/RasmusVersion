/**
 * js/spawn-sequence.js — Eye of Horus Spawn Cinematic
 *
 * Completely rewritten. A dramatic multi-phase cinematic plays when the player
 * spawns into the game world:
 *
 *  Phase 0 (0 – 0.6s)   Dark void. Faint golden hieroglyph ring materialises.
 *  Phase 1 (0.6 – 1.5s) The Eye of Horus draws itself — lids closed, teardrop glyph.
 *  Phase 2 (1.5 – 2.6s) Eyelids part; iris expands with rotating sacred-geometry spiral.
 *  Phase 3 (2.6 – 3.4s) Full-open eye pulses; golden colour fills the screen outward.
 *  Phase 4 (3.4 – 4.2s) Overlay shatters into colour shards that dissolve; player scales in.
 *
 * API (matches old SpawnSequence API):
 *   SpawnSequence.init(scene)
 *   SpawnSequence.play(playerOrScene, playerOrCallback, callback)
 *   SpawnSequence.update(dt)   — no-op, kept for back-compat
 *   SpawnSequence.reset()
 */
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────────────────── */
  let _scene       = null;
  let _playerMesh  = null;
  let _active      = false;
  let _overlay     = null;
  let _canvas      = null;
  let _ctx         = null;
  let _phaseStart  = 0;
  let _rafId       = 0;
  let _onComplete  = null;
  let _flashLights = [];
  let _shards      = [];   // for phase-4 colour shard animation

  /* ── Palette ────────────────────────────────────────────────────────────── */
  const GOLD    = '#C9A227';
  const GOLD2   = '#FFD700';
  const AMBER   = '#FF8C00';
  const CYAN    = '#00E5FF';
  const DARK    = '#0a0600';

  /* ── Init / cleanup helpers ─────────────────────────────────────────────── */
  function init(scene) { _scene = scene || null; }

  function _resolvePlayArgs(a, b, c) {
    let scene = _scene, player = null, onComplete = null;
    if (a && a.isScene) { scene = a; player = b; onComplete = c; }
    else { player = a; onComplete = b; }
    const mesh = player && player.mesh ? player.mesh : player;
    return { scene, mesh, onComplete };
  }

  function _cleanup() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
    _disposeFlashLights();
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = null; _canvas = null; _ctx = null;
    _shards = [];
    _active = false;
  }

  /* ── Overlay DOM ────────────────────────────────────────────────────────── */
  function _createOverlay() {
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = document.createElement('div');
    _overlay.id = 'horus-spawn-overlay';
    Object.assign(_overlay.style, {
      position: 'fixed', inset: '0', zIndex: '99998',
      background: DARK,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', opacity: '1',
      overflow: 'hidden'
    });

    _canvas = document.createElement('canvas');
    const S = Math.min(window.innerWidth, window.innerHeight, 520);
    _canvas.width  = S;
    _canvas.height = S;
    Object.assign(_canvas.style, { display: 'block' });
    _overlay.appendChild(_canvas);
    document.body.appendChild(_overlay);
    _ctx = _canvas.getContext('2d');
  }

  /* ── 3D flash lights around player ─────────────────────────────────────── */
  function _spawnFlashLights() {
    if (!_scene || !_playerMesh) return;
    _flashLights = [];
    const COLS = [0xFFD700, 0xFF8C00, 0x00E5FF, 0xFFFFFF];
    for (let i = 0; i < 16; i++) {
      const light = new THREE.PointLight(COLS[i % COLS.length], 2.5, 4, 2);
      const a = (i / 16) * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.4;
      light.position.set(
        _playerMesh.position.x + Math.cos(a) * r,
        0.4 + Math.random() * 1.6,
        _playerMesh.position.z + Math.sin(a) * r
      );
      _scene.add(light);
      _flashLights.push(light);
    }
  }

  function _disposeFlashLights() {
    if (!_scene) return;
    _flashLights.forEach(l => _scene.remove(l));
    _flashLights = [];
  }

  /* ── Canvas drawing helpers ─────────────────────────────────────────────── */
  function _ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }  // ease in-out quad

  /** Draw hieroglyph ring of dots + short arcs */
  function _drawGlyphRing(cx, cy, r, alpha, time) {
    if (!_ctx || alpha <= 0) return;
    const ctx = _ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    const N = 24;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + time * 0.4;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const dotR = (i % 3 === 0) ? 3.5 : 1.8;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = (i % 6 === 0) ? GOLD2 : GOLD;
      ctx.fill();
    }
    // Tick marks at cardinal points
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + time * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7));
      ctx.lineTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7));
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draw the sacred-geometry fibonacci spiral (golden ratio) */
  function _drawSacredSpiral(cx, cy, outerR, alpha, time) {
    if (!_ctx || alpha <= 0) return;
    const ctx = _ctx;
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.2;
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.6);
    // Draw 3 interlocking ellipses (Vesica Piscis variant)
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(outerR * 0.28, 0, outerR * 0.38, outerR * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Central hexagram
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      pts.push([Math.cos(a) * outerR * 0.36, Math.sin(a) * outerR * 0.36]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = GOLD2;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw the Eye of Horus.
   *
   * @param {number} cx          Canvas centre X
   * @param {number} cy          Canvas centre Y
   * @param {number} openAmt     0 = fully closed, 1 = fully open
   * @param {number} irisR       Iris radius (px)
   * @param {number} glowAmt     0–1 overall glow / pulse intensity
   * @param {number} time        Elapsed seconds (for animations)
   */
  function _drawEye(cx, cy, openAmt, irisR, glowAmt, time) {
    if (!_ctx) return;
    const ctx = _ctx;
    const S = _canvas.width;

    // ── Outer glow aura ──
    if (glowAmt > 0) {
      const aura = ctx.createRadialGradient(cx, cy, irisR * 0.5, cx, cy, irisR * 3.2);
      aura.addColorStop(0,   `rgba(255,215,0,${0.18 * glowAmt})`);
      aura.addColorStop(0.5, `rgba(255,140,0,${0.06 * glowAmt})`);
      aura.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, irisR * 3.2, 0, Math.PI * 2);
      ctx.fillStyle = aura;
      ctx.fill();
    }

    // ── Eye outline (almond shape) ──
    const halfW = 160;
    const openH = 55 + openAmt * 45;   // half-height of eye opening

    // Clipping mask — only draw iris/pupil inside the eye shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy);
    ctx.quadraticCurveTo(cx, cy - openH, cx + halfW, cy);
    ctx.quadraticCurveTo(cx, cy + openH, cx - halfW, cy);
    ctx.closePath();
    ctx.clip();

    // Eye interior (dark sclera)
    ctx.fillStyle = '#050204';
    ctx.fill();

    // Iris gradient
    const irisGrad = ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, Math.max(0.1, irisR)
    );
    irisGrad.addColorStop(0,    '#FFF8DC');
    irisGrad.addColorStop(0.18, GOLD2);
    irisGrad.addColorStop(0.55, '#B8860B');
    irisGrad.addColorStop(0.80, '#7a4a00');
    irisGrad.addColorStop(1,    '#3a1e00');
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, irisR), 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Iris texture rings
    for (let r = 1; r <= 5; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, irisR * (r / 5.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,0,0,${0.15 + r * 0.04})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Sacred spiral inside iris (rotates with time)
    _drawSacredSpiral(cx, cy, irisR * 0.8, openAmt, time);

    // Pupil
    const pupilR = Math.max(0, irisR * (0.28 + 0.06 * Math.sin(time * 2.5)));
    const pupilGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pupilR);
    pupilGrad.addColorStop(0, '#000');
    pupilGrad.addColorStop(0.7, '#0a0500');
    pupilGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.beginPath();
    ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = pupilGrad;
    ctx.fill();

    // Catchlight (bright specular glint)
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.2, cy - irisR * 0.2, irisR * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    ctx.restore(); // end clip

    // ── Eye outline strokes ──
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy);
    ctx.quadraticCurveTo(cx, cy - openH, cx + halfW, cy);
    ctx.strokeStyle = GOLD2;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = GOLD2;
    ctx.shadowBlur = 12 * glowAmt;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy);
    ctx.quadraticCurveTo(cx, cy + openH, cx + halfW, cy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Classic Horus teardrop / cheek glyph ──
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy + 40);
    ctx.bezierCurveTo(cx - 95, cy + 90, cx - 80, cy + 125, cx - 42, cy + 130);
    ctx.bezierCurveTo(cx - 55, cy + 100, cx - 28, cy + 72, cx - 20, cy + 55);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 8 * glowAmt;
    ctx.stroke();

    // Short eyebrow mark
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - openH - 12);
    ctx.quadraticCurveTo(cx, cy - openH - 24, cx + 70, cy - openH - 12);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ── Shard animation (phase 4) ─────────────────────────────────────────── */
  function _initShards(cx, cy) {
    _shards = [];
    const SHARD_COLS = [GOLD2, AMBER, GOLD, CYAN, '#FFFFFF', '#FF4500'];
    for (let i = 0; i < 56; i++) {
      const a  = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      _shards.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        size: 3 + Math.random() * 11,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 8,
        col: SHARD_COLS[(Math.random() * SHARD_COLS.length) | 0],
        life: 1.0
      });
    }
  }

  function _updateShards(dt, alpha) {
    if (!_ctx || _shards.length === 0) return;
    const ctx = _ctx;
    _shards.forEach(s => {
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
      s.rot += s.rotV * dt;
      s.vx *= 0.92;
      s.vy *= 0.92;
      s.life = Math.max(0, s.life - dt * 1.8);
      ctx.save();
      ctx.globalAlpha = s.life * alpha;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.col;
      ctx.shadowColor = s.col;
      ctx.shadowBlur = 6;
      ctx.fillRect(-s.size * 0.5, -s.size * 0.5, s.size, s.size * 0.4);
      ctx.restore();
    });
  }

  /* ── Main animate loop ──────────────────────────────────────────────────── */
  function play(a, b, c) {
    const resolved = _resolvePlayArgs(a, b, c);
    _scene      = resolved.scene    || _scene;
    _playerMesh = resolved.mesh     || null;
    _onComplete = typeof resolved.onComplete === 'function' ? resolved.onComplete : null;

    if (!_scene || !_playerMesh || _active) {
      if (_onComplete) _onComplete();
      return;
    }

    _active = true;
    _playerMesh.scale.set(0.01, 0.01, 0.01);
    _playerMesh.position.y = 0.5;
    _createOverlay();
    _phaseStart = performance.now();
    let _lastT  = 0;

    const S  = _canvas.width;
    const cx = S * 0.5;
    const cy = S * 0.5;

    const animate = () => {
      if (!_active) return;
      const now = performance.now();
      const t   = (now - _phaseStart) / 1000;
      const dt  = Math.min(t - _lastT, 0.05);
      _lastT    = t;

      const ctx = _ctx;
      ctx.clearRect(0, 0, S, S);
      // Background
      ctx.fillStyle = DARK;
      ctx.fillRect(0, 0, S, S);

      /* ── Phase 0: hieroglyph ring materialises (0 – 0.6s) ── */
      if (t < 0.6) {
        const k = t / 0.6;
        _drawGlyphRing(cx, cy, S * 0.42, _ease(k), t);

      /* ── Phase 1: eye draws itself, closed (0.6 – 1.5s) ── */
      } else if (t < 1.5) {
        const k = (t - 0.6) / 0.9;
        const ek = _ease(k);
        _drawGlyphRing(cx, cy, S * 0.42, 1, t);
        _drawEye(cx, cy, 0, 44 * ek, ek * 0.6, t);

      /* ── Phase 2: eyelids part, iris expands (1.5 – 2.6s) ── */
      } else if (t < 2.6) {
        const k = (t - 1.5) / 1.1;
        const ek = _ease(k);
        _drawGlyphRing(cx, cy, S * 0.42, 1 - ek * 0.3, t);
        _drawEye(cx, cy, ek, 44 + ek * 28, 0.6 + ek * 0.4, t);

      /* ── Phase 3: full-open pulse, gold fills (2.6 – 3.4s) ── */
      } else if (t < 3.4) {
        const k      = (t - 2.6) / 0.8;
        const pulse  = 0.5 + 0.5 * Math.sin(t * 9);
        const fillR  = k * S * 0.8;
        // Radial golden wash
        const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, fillR);
        wash.addColorStop(0,   `rgba(255,215,0,${0.35 * k})`);
        wash.addColorStop(0.5, `rgba(180,100,0,${0.15 * k})`);
        wash.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, fillR, 0, Math.PI * 2);
        ctx.fillStyle = wash;
        ctx.fill();
        _drawGlyphRing(cx, cy, S * 0.42 + fillR * 0.1, Math.max(0, 0.7 - k * 0.8), t);
        _drawEye(cx, cy, 1, 72 + pulse * 6, 1, t);
        // Fade out the overlay bg as pulse builds
        if (_overlay) _overlay.style.opacity = String(Math.max(0, 1 - k * 0.6));
        // Player begins to materialise
        const sc = 0.01 + 0.5 * k;
        _playerMesh.scale.set(sc, sc, sc);
        if (_flashLights.length === 0) _spawnFlashLights();
        _flashLights.forEach(l => { l.intensity = 2.5 * (1 - k * 0.5); });

      /* ── Phase 4: shard explosion + dissolve (3.4 – 4.4s) ── */
      } else if (t < 4.4) {
        const k = (t - 3.4);
        if (_shards.length === 0) _initShards(cx, cy);
        const alpha = Math.max(0, 1 - k / 1.0);
        _updateShards(dt, alpha);
        if (_overlay) _overlay.style.opacity = String(alpha);
        const sc = 0.5 + 0.5 * Math.min(1, k / 0.6);
        _playerMesh.scale.set(sc, sc, sc);
        _flashLights.forEach(l => { l.intensity = Math.max(0, 2 * (1 - k)); });

      /* ── Done ── */
      } else {
        _playerMesh.scale.set(1, 1, 1);
        _playerMesh.position.y = 0.5;
        _cleanup();
        if (_onComplete) _onComplete();
        return;
      }

      _rafId = requestAnimationFrame(animate);
    };

    _rafId = requestAnimationFrame(animate);
  }

  function update(dt) {
    // No-op — kept for backward-compatibility with callers that pass dt each frame.
    return Math.min(Math.max(dt || 0.016, 0.001), 0.05);
  }

  function reset() {
    _cleanup();
    _playerMesh = null;
    _onComplete = null;
  }

  window.SpawnSequence = { init, play, update, reset };
})();
