/* ============================================================================
   FeedbackFilterEngine — Coherence → Clarity transform (Myndlift-style reward)
   ----------------------------------------------------------------------------
   PORT MAP: fed by Port 2 (Biometric Stream) → NS3. Output consumed by Port 4
   (VisualLayer / MediaFeedbackLayer) coordinating with Port 3 (ContentDelivery).
   Registered under ABI via the integration layer — this module NEVER taps H10
   raw RR. It subscribes ONLY to the NS3 output contract carried on the
   BioBridge 'biometricTick' event:
       { sample, ns3: 0-100|0, coherence: 0-1, coherencePeak: 0-1, tickCount }
   (server source of truth: sessionOrchestrator.js result.ns3 =
    { score: 0-100, zone, coherence: components.coherence.raw 0-1 })

   Pipeline per tick:
     coherence (0-1) → EMA(N) → transfer(ema, baseline) → hysteresis → clarity
   clarity is 0-1: 1 = full brightness/volume reward, 0 = max feedback (dim).
   Reward is RELATIVE to the per-session arrival baseline (initial_coherence),
   never absolute.
   ============================================================================ */
var FeedbackFilterEngine = (function () {
  'use strict';

  // ── CONFIG (all tunable via configure()) ──────────────────────────────────
  var _cfg = {
    emaTicks: 5,          // EMA window N — alpha = 2/(N+1)
    deadband: 0.05,       // hysteresis: output only moves when |Δclarity| ≥ deadband
    driftSpan: 0.15,      // coherence drop below baseline that maps to clarity 0
    baselineFloor: 0.10,  // clamp arrival baseline into a sane band so a noisy
    baselineCeil: 0.60,   //   arrival can't make the reward unreachable/trivial
    defaultBaseline: 0.25 // used until arrivalComplete delivers the real one
  };

  // ── STATE ──────────────────────────────────────────────────────────────────
  var _bio = null;            // BioBridge handle (Port 2 contract)
  var _userId = null;
  var _offs = [];             // unsubscribe fns from bio.on
  var _baseline = null;       // per-session baseline coherence (clamped)
  var _ema = null;            // smoothed coherence; seeded with baseline
  var _clarity = 1;           // current output (starts fully clear)
  var _listeners = { clarity: [] };
  var _tickCount = 0;

  // ── TRANSFER FUNCTION (swappable) ──────────────────────────────────────────
  // Linear default: at/above baseline → 1 (content fully clear); falls linearly
  // to 0 at (baseline - driftSpan). Drift below YOUR OWN baseline dims; sitting
  // at baseline is never punished.
  function _linearTransfer(ema, baseline, cfg) {
    var c = (ema - (baseline - cfg.driftSpan)) / cfg.driftSpan;
    return Math.max(0, Math.min(1, c));
  }
  var _transfer = _linearTransfer;

  function setTransferFunction(fn) {
    if (typeof fn === 'function') { _transfer = fn; console.log('[FFE] Transfer function swapped'); }
  }

  // ── CORE PIPELINE ──────────────────────────────────────────────────────────
  function _onCoherence(coh) {
    if (typeof coh !== 'number' || isNaN(coh) || coh < 0 || coh > 1) {
      console.warn('[FFE] coherence sample rejected (contract range 0-1):', coh);
      return;
    }
    _tickCount++;
    var baseline = (_baseline !== null) ? _baseline : _cfg.defaultBaseline;

    // EMA smoothing (anti-flicker)
    var alpha = 2 / (_cfg.emaTicks + 1);
    _ema = (_ema === null) ? coh : _ema + alpha * (coh - _ema);

    var candidate = _transfer(_ema, baseline, _cfg);

    // Hysteresis dead-band — micro-fluctuations don't move the effect.
    // Endpoints snap so we can always settle at exactly 0 or 1.
    var moved = false;
    if (Math.abs(candidate - _clarity) >= _cfg.deadband) { _clarity = candidate; moved = true; }
    else if (candidate >= 1 && _clarity !== 1) { _clarity = 1; moved = true; }
    else if (candidate <= 0 && _clarity !== 0) { _clarity = 0; moved = true; }

    _emit('clarity', {
      clarity: _clarity, raw: candidate, ema: _ema,
      coherence: coh, baseline: baseline, moved: moved, tickCount: _tickCount
    });
  }

  // ── EVENT BUS (same off-fn pattern as BioBridge.bioOn) ─────────────────────
  function on(eventName, cb) {
    if (!_listeners[eventName]) _listeners[eventName] = [];
    _listeners[eventName].push(cb);
    return function off() {
      var arr = _listeners[eventName]; if (!arr) return;
      var i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1);
    };
  }
  function _emit(eventName, data) {
    var arr = _listeners[eventName]; if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](data); } catch (e) { console.error('[FFE] listener error:', eventName, e); }
    }
  }

  // ── PORT 2 WIRING (house pattern: connectToBiometricBridge + bindUser) ─────
  function connectToBiometricBridge(bio) { _bio = bio; }

  function bindUser(userId) {
    if (!userId || !_bio) { console.warn('[FFE] bindUser: missing userId or bridge'); return; }
    unbind();
    _userId = userId;
    _offs.push(_bio.on(userId, 'arrivalComplete', function (baseline) {
      if (baseline && typeof baseline.initial_coherence === 'number') {
        setBaseline(baseline.initial_coherence);
      }
    }));
    _offs.push(_bio.on(userId, 'biometricTick', function (data) {
      // NS3 output contract: top-level `coherence` (0-1). sample.coherence is
      // the same value on the ABI tick path; fall back to it defensively.
      var coh = (data && typeof data.coherence === 'number') ? data.coherence
        : (data && data.sample && typeof data.sample.coherence === 'number') ? data.sample.coherence
        : null;
      if (coh !== null) _onCoherence(coh);
    }));
    console.log('[FFE] Bound to BioBridge for user:', userId);
  }

  function unbind() {
    for (var i = 0; i < _offs.length; i++) { try { _offs[i](); } catch (e) {} }
    _offs = []; _userId = null;
  }

  // Direct push escape hatch — house pattern (DepthEngine.setCoherence et al).
  // Runs the identical pipeline; used by harnesses and the ABI tick fan-out.
  function setCoherence(v) { _onCoherence(v); }

  function setBaseline(v) {
    if (typeof v !== 'number' || isNaN(v)) return;
    _baseline = Math.max(_cfg.baselineFloor, Math.min(_cfg.baselineCeil, v));
    if (_ema === null) _ema = _baseline; // seed: session starts at clarity 1
    console.log('[FFE] Session baseline set:', _baseline, '(raw arrival:', v + ')');
  }

  function configure(opts) {
    opts = opts || {};
    for (var k in _cfg) { if (Object.prototype.hasOwnProperty.call(opts, k)) _cfg[k] = opts[k]; }
    console.log('[FFE] Config:', JSON.stringify(_cfg));
  }

  function reset() {
    _baseline = null; _ema = null; _clarity = 1; _tickCount = 0;
    console.log('[FFE] Reset');
  }

  function getClarity() { return _clarity; }
  function getState() {
    return { clarity: _clarity, ema: _ema, baseline: _baseline, tickCount: _tickCount, config: _cfg };
  }

  return {
    connectToBiometricBridge: connectToBiometricBridge,
    bindUser: bindUser,
    unbind: unbind,
    on: on,
    setCoherence: setCoherence,
    setBaseline: setBaseline,
    setTransferFunction: setTransferFunction,
    configure: configure,
    reset: reset,
    getClarity: getClarity,
    getState: getState
  };
})();
if (typeof window !== 'undefined') window.FeedbackFilterEngine = FeedbackFilterEngine;
