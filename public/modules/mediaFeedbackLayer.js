/* ============================================================================
   MediaFeedbackLayer — overlay-based coherence feedback for partner media
   ----------------------------------------------------------------------------
   PORT MAP: Port 4 (VisualLayer) coordinating with Port 3 (ContentDelivery).
   Input: clarity 0-1 from FeedbackFilterEngine (fed by Port 2 → NS3).

   DRM-SAFE BY CONSTRUCTION (Rev 2 overlay model — HARD CONSTRAINTS):
   - NEVER applies CSS/WebGL filters to the partner video element. All visual
     feedback is composited overlays stacked ABOVE the content.
   - NEVER creates a MediaElementAudioSourceNode from the partner stream.
     Partner audio changes go through the player's own volume/pause API only
     (the playerAdapter). The ambient bed is our OWN AudioBufferSource.

   Effects, all driven by clarity c (1 = in-coherence, 0 = full drift):
     a) brightness  — dim overlay opacity      = (1 - c) * MAX_DIM
     b) grain       — noise overlay opacity    = (1 - c) * MAX_GRAIN
     c) partner vol — playerAdapter.setVolume(lerp(MIN_VOL, 1, c))
     d) ambient bed — own GainNode target      = (1 - c) * MAX_AMBIENT
     e) gate (opt)  — pause via playerAdapter after sustained low clarity

   playerAdapter contract: { setVolume(v 0-1), pause(), play(), isPaused() }
   Any method may be absent (partner platforms differ) — absent = skipped.
   ============================================================================ */
var MediaFeedbackLayer = (function () {
  'use strict';

  // ── CONFIG (tunable via init opts / configure()) ──────────────────────────
  var _cfg = {
    MAX_DIM: 0.78,        // dim overlay opacity at clarity 0
    MAX_GRAIN: 0.12,      // grain overlay opacity at clarity 0
    MIN_VOL: 0.15,        // partner volume floor at clarity 0
    MAX_AMBIENT: 0.35,    // ambient bed gain at clarity 0
    DIM_RAMP_MS: 600,     // CSS transition for the dim overlay
    AUDIO_RAMP_TC: 0.6,   // setTargetAtTime time-constant for ambient ramps
    GRAIN_FPS: 12,        // grain redraw rate (cheap, low-res upscaled)
    grainEnabled: true,
    gateEnabled: false,   // OPEN ITEM 2: requires partner player pause/play API
    GATE_THRESHOLD: 0.15, // clarity below this counts toward the gate
    GATE_HOLD_S: 12,      // sustained seconds below threshold → pause
    GATE_RESUME_S: 3      // sustained seconds recovered → resume
  };

  // ── STATE ──────────────────────────────────────────────────────────────────
  var _container = null, _adapter = null;
  var _dimEl = null, _grainCanvas = null, _grainCtx = null;
  var _clarity = 1, _grainOpacity = 0, _grainRaf = null, _lastGrainDraw = 0;
  var _ax = null, _ambientSrc = null, _ambientGain = null, _audioReady = false;
  var _engineOff = null;
  var _gateBelowSince = null, _gateAboveSince = null, _gatePaused = false;
  var _active = false;

  // ── INIT / DOM (overlays only — partner element is never touched) ─────────
  // Two signatures:
  //   init(containerEl, playerAdapter, opts)  — Rev 2 (overlay surface supplied)
  //   init(playerAdapter, opts)               — Rev 3.1: adapter-first; the
  //     overlay surface comes from playerAdapter.getOverlayTarget(), so MFL
  //     talks ONLY through the PlayerAdapter interface.
  function init(containerEl, playerAdapter, opts) {
    if (containerEl && typeof containerEl.getOverlayTarget === 'function') {
      opts = playerAdapter;
      playerAdapter = containerEl;
      containerEl = playerAdapter.getOverlayTarget();
    }
    if (!containerEl) { console.error('[MFL] init: containerEl required'); return; }
    configure(opts);
    _container = containerEl;
    _adapter = playerAdapter || null;

    var pos = window.getComputedStyle(_container).position;
    if (pos === 'static') _container.style.position = 'relative';

    // a) brightness — translucent black overlay ABOVE the video
    _dimEl = document.createElement('div');
    _dimEl.className = 'mfl-dim';
    _dimEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;' +
      'pointer-events:none;z-index:50;transition:opacity ' + _cfg.DIM_RAMP_MS + 'ms linear;';
    _container.appendChild(_dimEl);

    // b) grain — low-res animated noise canvas, CSS-upscaled
    if (_cfg.grainEnabled) {
      _grainCanvas = document.createElement('canvas');
      _grainCanvas.className = 'mfl-grain';
      _grainCanvas.width = 160; _grainCanvas.height = 90;
      _grainCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;' +
        'opacity:0;pointer-events:none;z-index:51;image-rendering:pixelated;';
      _container.appendChild(_grainCanvas);
      _grainCtx = _grainCanvas.getContext('2d');
    }

    _active = true;
    console.log('[MFL] Initialized (overlay model — partner element untouched)');
  }

  // ── AMBIENT BED (our OWN source — AudioBufferSource loop → lowpass → gain) ─
  function _createAmbientBuffer(ctx, seconds) {
    // Soft pink-ish wash with slow swell — same procedural approach as
    // BiofeedbackSound._createOceanBuffer. Loopable, no asset required.
    var sr = ctx.sampleRate, len = sr * seconds;
    var buf = ctx.createBuffer(2, len, sr);
    var L = buf.getChannelData(0), R = buf.getChannelData(1);
    var lastL = 0, lastR = 0;
    for (var i = 0; i < len; i++) {
      lastL = (lastL + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      lastR = (lastR + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      var swell = Math.sin(i / sr * 0.3) * 0.25 + Math.sin(i / sr * 0.13) * 0.15;
      L[i] = lastL * (2.6 + swell);
      R[i] = lastR * (2.6 + swell);
    }
    return buf;
  }

  function initAudio() {
    if (_audioReady) return true;
    try {
      // Reuse the shared TTS AudioContext when present (house pattern).
      if (typeof Dialogue !== 'undefined' && Dialogue.getAudioContext) _ax = Dialogue.getAudioContext();
      if (!_ax) _ax = new (window.AudioContext || window.webkitAudioContext)();
      if (_ax.state === 'suspended') _ax.resume();

      _ambientSrc = _ax.createBufferSource();
      _ambientSrc.buffer = _createAmbientBuffer(_ax, 6);
      _ambientSrc.loop = true;
      var lp = _ax.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.8;
      _ambientGain = _ax.createGain();
      _ambientGain.gain.value = 0; // rises only on drift
      _ambientSrc.connect(lp); lp.connect(_ambientGain); _ambientGain.connect(_ax.destination);
      _ambientSrc.start(0);
      _audioReady = true;
      console.log('[MFL] Ambient bed live (own AudioBufferSource — no partner tap)');
      return true;
    } catch (e) {
      console.warn('[MFL] Ambient bed unavailable:', e.message);
      return false;
    }
  }

  // Optional: replace the procedural bed with a real ASCEN asset later.
  function loadAmbient(url) {
    if (!_audioReady && !initAudio()) return Promise.reject(new Error('no audio'));
    return fetch(url).then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return _ax.decodeAudioData(ab); })
      .then(function (buf) {
        var next = _ax.createBufferSource();
        next.buffer = buf; next.loop = true;
        var lp = _ax.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1200;
        next.connect(lp); lp.connect(_ambientGain);
        try { _ambientSrc.stop(); } catch (e) {}
        _ambientSrc = next; _ambientSrc.start(0);
        console.log('[MFL] Ambient bed swapped to asset:', url);
      });
  }

  // ── GRAIN LOOP (throttled rAF; idle when invisible) ────────────────────────
  function _grainLoop(ts) {
    _grainRaf = null;
    if (!_active || !_grainCtx) return;
    if (_grainOpacity <= 0.01) { _grainCanvas.style.opacity = '0'; return; } // park until needed
    if (ts - _lastGrainDraw >= 1000 / _cfg.GRAIN_FPS) {
      _lastGrainDraw = ts;
      var w = _grainCanvas.width, h = _grainCanvas.height;
      var img = _grainCtx.createImageData(w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var v = (Math.random() * 255) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
      _grainCtx.putImageData(img, 0, 0);
      _grainCanvas.style.opacity = String(_grainOpacity);
    }
    _grainRaf = requestAnimationFrame(_grainLoop);
  }
  function _kickGrain() {
    if (_grainCtx && _grainRaf === null && _grainOpacity > 0.01) {
      _grainRaf = requestAnimationFrame(_grainLoop);
    }
  }

  // ── GATE (optional; player API only) ───────────────────────────────────────
  function _gateTick(c) {
    if (!_cfg.gateEnabled || !_adapter || !_adapter.pause || !_adapter.play) return;
    var now = Date.now();
    if (c < _cfg.GATE_THRESHOLD) {
      _gateAboveSince = null;
      if (_gateBelowSince === null) _gateBelowSince = now;
      if (!_gatePaused && (now - _gateBelowSince) / 1000 >= _cfg.GATE_HOLD_S) {
        _gatePaused = true;
        try { _adapter.pause(); console.log('[MFL] Gate: paused (sustained drift)'); } catch (e) {}
      }
    } else {
      _gateBelowSince = null;
      if (_gatePaused) {
        if (_gateAboveSince === null) _gateAboveSince = now;
        if ((now - _gateAboveSince) / 1000 >= _cfg.GATE_RESUME_S) {
          _gatePaused = false; _gateAboveSince = null;
          try { _adapter.play(); console.log('[MFL] Gate: resumed (recovered)'); } catch (e) {}
        }
      }
    }
  }

  // ── CLARITY → EFFECTS (the whole feedback loop lands here) ────────────────
  function setClarity(c) {
    if (!_active) return;
    if (typeof c !== 'number' || isNaN(c)) return;
    _clarity = Math.max(0, Math.min(1, c));
    var inv = 1 - _clarity;

    // a) brightness
    if (_dimEl) _dimEl.style.opacity = String(inv * _cfg.MAX_DIM);

    // b) grain
    _grainOpacity = inv * _cfg.MAX_GRAIN;
    _kickGrain();

    // c) partner audio — player volume API ONLY (no Web Audio on their stream)
    if (_adapter && _adapter.setVolume) {
      try { _adapter.setVolume(_cfg.MIN_VOL + (1 - _cfg.MIN_VOL) * _clarity); } catch (e) {}
    }

    // d) ambient bed — our own gain, click-free exponential ramp
    if (_audioReady && _ambientGain) {
      _ambientGain.gain.setTargetAtTime(inv * _cfg.MAX_AMBIENT, _ax.currentTime, _cfg.AUDIO_RAMP_TC);
    }

    // e) optional gate
    _gateTick(_clarity);
  }

  // ── ENGINE HOOKUP ──────────────────────────────────────────────────────────
  function attachEngine(engine) {
    if (!engine || !engine.on) { console.warn('[MFL] attachEngine: bad engine'); return; }
    if (_engineOff) _engineOff();
    _engineOff = engine.on('clarity', function (d) { setClarity(d.clarity); });
    console.log('[MFL] Attached to FeedbackFilterEngine');
  }

  // ── ADAPTERS ───────────────────────────────────────────────────────────────
  // For OUR OWN / clear test content only. Partner platforms get their own
  // adapter built on the platform's embed API once OPEN ITEM 2 is answered.
  function createHtml5Adapter(videoEl) {
    return {
      setVolume: function (v) { videoEl.volume = Math.max(0, Math.min(1, v)); },
      pause: function () { videoEl.pause(); },
      play: function () { videoEl.play(); },
      isPaused: function () { return videoEl.paused; }
    };
  }

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  function configure(opts) {
    opts = opts || {};
    for (var k in _cfg) { if (Object.prototype.hasOwnProperty.call(opts, k)) _cfg[k] = opts[k]; }
    if (_dimEl) _dimEl.style.transition = 'opacity ' + _cfg.DIM_RAMP_MS + 'ms linear';
  }

  function teardown() {
    _active = false;
    if (_engineOff) { _engineOff(); _engineOff = null; }
    if (_grainRaf !== null) { cancelAnimationFrame(_grainRaf); _grainRaf = null; }
    if (_dimEl && _dimEl.parentNode) _dimEl.parentNode.removeChild(_dimEl);
    if (_grainCanvas && _grainCanvas.parentNode) _grainCanvas.parentNode.removeChild(_grainCanvas);
    _dimEl = null; _grainCanvas = null; _grainCtx = null;
    if (_ambientGain && _ax) _ambientGain.gain.setTargetAtTime(0, _ax.currentTime, 0.3);
    if (_ambientSrc) { try { _ambientSrc.stop(_ax.currentTime + 2); } catch (e) {} _ambientSrc = null; }
    _audioReady = false; _ambientGain = null;
    _gateBelowSince = null; _gateAboveSince = null; _gatePaused = false;
    console.log('[MFL] Teardown complete');
  }

  function getState() {
    return {
      clarity: _clarity,
      dimOpacity: _dimEl ? parseFloat(_dimEl.style.opacity || '0') : 0,
      grainOpacity: _grainOpacity,
      ambientGainTarget: _audioReady ? (1 - _clarity) * _cfg.MAX_AMBIENT : 0,
      audioReady: _audioReady,
      gatePaused: _gatePaused,
      config: _cfg
    };
  }

  return {
    init: init,
    initAudio: initAudio,
    loadAmbient: loadAmbient,
    setClarity: setClarity,
    attachEngine: attachEngine,
    createHtml5Adapter: createHtml5Adapter,
    configure: configure,
    teardown: teardown,
    getState: getState
  };
})();
if (typeof window !== 'undefined') window.MediaFeedbackLayer = MediaFeedbackLayer;
