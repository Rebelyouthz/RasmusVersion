(function () {
  'use strict';

  let _scene = null;
  let _playerMesh = null;
  let _active = false;
  let _overlay = null;
  let _canvas = null;
  let _ctx = null;
  let _phaseStart = 0;
  let _rafId = 0;
  let _onComplete = null;
  let _flashLights = [];
  const _tmpVec = new THREE.Vector3();

  function init(scene) {
    _scene = scene || null;
  }

  function _resolvePlayArgs(a, b, c) {
    let scene = _scene;
    let player = null;
    let onComplete = null;
    if (a && a.isScene) {
      scene = a;
      player = b;
      onComplete = c;
    } else {
      player = a;
      onComplete = b;
    }
    const mesh = player && player.mesh ? player.mesh : player;
    return { scene, mesh, onComplete };
  }

  function _createOverlay() {
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = document.createElement('div');
    _overlay.id = 'eye-of-horus-intro';
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#000;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:1;';
    _canvas = document.createElement('canvas');
    _canvas.width = 400;
    _canvas.height = 400;
    _overlay.appendChild(_canvas);
    document.body.appendChild(_overlay);
    _ctx = _canvas.getContext('2d');
  }

  function _drawEye(openAmt, irisRadius) {
    if (!_ctx) return;
    const ctx = _ctx;
    const w = _canvas.width;
    const h = _canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.clearRect(0, 0, w, h);

    const topY = cy - (55 + openAmt * 38);
    const botY = cy + (55 + openAmt * 38);
    ctx.beginPath();
    ctx.moveTo(cx - 150, cy);
    ctx.quadraticCurveTo(cx, topY, cx + 150, cy);
    ctx.quadraticCurveTo(cx, botY, cx - 150, cy);
    ctx.closePath();
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#C9A227';
    ctx.stroke();

    const grad = ctx.createRadialGradient(cx, cy, Math.max(0, irisRadius * 0.1), cx, cy, Math.max(0.1, irisRadius));
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(1, '#8B6914');
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, irisRadius), 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, irisRadius * 0.35), 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 55, cy + 40);
    ctx.quadraticCurveTo(cx - 82, cy + 90, cx - 45, cy + 118);
    ctx.quadraticCurveTo(cx - 52, cy + 88, cx - 26, cy + 68);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#C9A227';
    ctx.stroke();
  }

  function _spawnFlashLights() {
    if (!_scene || !_playerMesh) return;
    _flashLights = [];
    for (let i = 0; i < 12; i++) {
      const light = new THREE.PointLight(0xFFD700, 2, 3, 2);
      const a = (i / 12) * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.2;
      light.position.set(_playerMesh.position.x + Math.cos(a) * r, 0.5 + (Math.random() * 1.2), _playerMesh.position.z + Math.sin(a) * r);
      _scene.add(light);
      _flashLights.push(light);
    }
  }

  function _disposeFlashLights() {
    if (!_scene) return;
    _flashLights.forEach((l) => {
      _scene.remove(l);
    });
    _flashLights = [];
  }

  function _cleanup() {
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = 0;
    _disposeFlashLights();
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = null;
    _canvas = null;
    _ctx = null;
    _active = false;
  }

  function play(a, b, c) {
    const resolved = _resolvePlayArgs(a, b, c);
    _scene = resolved.scene || _scene;
    _playerMesh = resolved.mesh || null;
    _onComplete = typeof resolved.onComplete === 'function' ? resolved.onComplete : null;
    if (!_scene || !_playerMesh || _active) {
      if (_onComplete) _onComplete();
      return;
    }

    _active = true;
    _playerMesh.position.y = 0.5;
    _playerMesh.scale.set(0.01, 0.01, 0.01);
    _createOverlay();
    _phaseStart = performance.now();

    const animate = () => {
      if (!_active) return;
      const now = performance.now();
      const t = (now - _phaseStart) / 1000;
      _playerMesh.position.y = 0.5;

      if (t < 1.2) {
        const irisT = Math.min(1, t / 0.8);
        _drawEye(0, 42 * irisT);
      } else if (t < 2.4) {
        const k = Math.min(1, (t - 1.2) / 1.2);
        const open = Math.min(1, k);
        const fade = Math.max(0, 1 - Math.min(1, (t - 1.6) / 0.8));
        _drawEye(open, 42);
        if (_overlay) _overlay.style.opacity = String(fade);
      } else if (t < 3.8) {
        if (_overlay && _overlay.style.opacity !== '0') _overlay.style.opacity = '0';
        const k = Math.min(1, (t - 2.4) / 1.4);
        const sc = 0.01 + (1.0 - 0.01) * k;
        _playerMesh.scale.set(sc, sc, sc);
        if (_flashLights.length === 0) _spawnFlashLights();
        const fade = Math.max(0, 1 - (t - 2.4) / 0.8);
        _flashLights.forEach((l) => { l.intensity = 2 * fade; });
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
    dt = Math.min(Math.max(dt || 0.016, 0.001), 0.05);
    return dt;
  }

  function reset() {
    _cleanup();
    _playerMesh = null;
    _onComplete = null;
  }

  window.SpawnSequence = { init, play, update, reset };
})();
