// ================================================================
// === MODULE 7: NARRATIVE VISUALS ENGINE ===
// ================================================================
// narrativeVisualsEngine.js — integrated as Module 7
// Controls particle field, background warmth, and alignment indicator
// in response to session YAML visual_narrative triggers.
// Operates WITHIN the biofeedback water layer — never above it.
// Ref: narrativeVisualsEngine_Build_Handoff_v3.md
// ================================================================

var NarrativeVisualsEngine = (function() {

  // ── UTILITIES ──
  // Standalone-safe linear interpolation. Previously this module relied on
  // a `lerp` defined in the integrated HTML, which threw ReferenceError when
  // the module was loaded in isolation (Phase 2 smoke test, Test 2).
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── VISUAL PRIORITY LEVELS ──
  var VISUAL_PRIORITY = {
    ambient:          0,
    atmosphere:       1,
    narrative_subtle: 2,
    narrative_active: 3,
    breath_sync:      4,
    signature_moment: 5
  };

  // ── VISUAL CATALOG: name → priority ──
  var VISUAL_PRIORITY_MAP = {
    // Particle field
    depth_pulse:          'narrative_active',
    trigger_flash:        'signature_moment',
    gap_reveal:           'signature_moment',
    environment_sync:     'breath_sync',
    anchor_descend:       'narrative_active',
    blueprint_lines:      'narrative_active',
    ladder_emerge:        'narrative_active',
    hrv_rhythm:           'narrative_active',
    hrv_expand:           'breath_sync',
    tax_weight:           'narrative_subtle',
    tax_erosion:          'narrative_subtle',
    refund_begins:        'narrative_subtle',
    refund_accumulate:    'breath_sync',
    breath_thread:        'narrative_subtle',
    anchor_deepen:        'breath_sync',
    anchor_set:           'narrative_subtle',
    ladder_climb:         'breath_sync',
    gap_practice:         'breath_sync',
    blueprint_breathe:    'breath_sync',
    six_seconds_weight:   'narrative_subtle',
    gap_installed:        'narrative_active',
    weight_of_everything: 'narrative_subtle',
    five_signals:         'narrative_subtle',
    not_broken_reveal:    'narrative_subtle',
    foundation_build:     'breath_sync',
    body_memory_map:      'narrative_subtle',
    hrv_rhythm_slow:      'narrative_active',
    score_rewritten:      'narrative_subtle',
    surplus_visible:      'narrative_subtle',
    position_marker:      'narrative_subtle',
    authorship_glow:      'narrative_subtle',
    // Background atmosphere
    environment_settled:  'atmosphere',
    body_memory_glow:     'atmosphere',
    storm_surface:        'atmosphere',
    arc_complete_horizon: 'atmosphere',
    warmth_layer:         'atmosphere',
    gap_persist:          'atmosphere',
    anchor_set_bg:        'atmosphere',
    blueprint_illuminate: 'atmosphere',
    // Text
    text_fade_line:       'ambient',
    text_hidden:          'ambient',
    text_visible:         'ambient'
  };

  // ── ENGINE STATE ──
  var _activeVisuals = {};      // layer → { name, priority, startTime, params, timerId }
  var _queue = [];              // queued lower-priority visuals
  var _frozenState = null;      // snapshot for gap_reveal restore
  var _performanceTier = 'full'; // 'full' | 'reduced'
  var _breathSyncActive = false;
  var _breathPhase = 'exhale';
  var _breathProgress = 0;
  var _breathCycleCount = 0;
  var _breathSyncInterval = null;
  var _breathSyncRAF = null;
  var _currentSession = 1;
  var _currentPhase = 'arrival';
  var _warmthAccumulated = 0;   // 0–1 warmth that persists into close
  var _alignmentRingAdded = false;
  var _blueprintLines = [];     // static snapshot connections
  var _blueprintCanvas = null;
  var _blueprintCtx = null;
  var _gapFreezeTimer = null;
  var _gapResumeRAF = null;
  var _ladderZone = null;       // 'top' | 'mid' | 'bottom' | null
  var _hrvPulseInterval = null;
  var _hrvPulseMs = 600;
  var _hrvPulseTarget = 600;
  var _particleOverrides = {};  // per-particle overrides for narrative control
  var _fieldState = {           // current narrative particle field state
    speedMul: 1.0,
    rhythm: 'ambient',         // 'ambient'|'erratic'|'steady'|'frozen'|'breath_sync'|'heartbeat'
    clustering: 0.5,
    colorShift: null,          // null | 'warm' | 'cool' | 'erratic'
    zoneDensity: null,         // null | { zone, density, speed, colorShift, gravity }
    triband: null,             // null | { top, mid, bottom }
    dragMul: 1.0,
    inhaleDrift: null,
    exhaleDrift: null
  };
  var _bgState = {
    warmth: 0,
    stormTop: 0,
    openness: 0
  };
  var _ssm = null;
  var _bioBridge = null;
  var _depthEngine = null;
  var _pacerRatio = { inhale: 4, hold: 0, exhale: 6 };
  var _pacerCycleMs = 10000;
  var _pacerTimer = null;
  var _pacerPhase = 'exhale';
  var _pacerProgress = 0;

  // ── PERFORMANCE TIER DETECTION ──
  function _detectPerformanceTier() {
    try {
      var cores = navigator.hardwareConcurrency || 4;
      var mem = navigator.deviceMemory || 4;
      var sw = screen.width || 1920;
      if (cores <= 4 || mem <= 4 || sw <= 1024) {
        _performanceTier = 'reduced';
      } else {
        _performanceTier = 'full';
      }
    } catch(e) {
      _performanceTier = 'full';
    }
    console.log('[NVE] Performance tier:', _performanceTier);
  }

  // ── SNAPSHOT / RESTORE FOR gap_reveal ──
  function _snapshotState() {
    // Snapshot particle field state and CSS animation states
    var snapshot = {
      fieldState: JSON.parse(JSON.stringify(_fieldState)),
      bgState: JSON.parse(JSON.stringify(_bgState)),
      warmth: _warmthAccumulated,
      particles: []
    };
    // Snapshot DOM particle positions
    var particles = document.querySelectorAll('.particle');
    particles.forEach(function(p) {
      var rect = p.getBoundingClientRect();
      snapshot.particles.push({
        el: p,
        left: p.style.left,
        top: p.style.top,
        opacity: window.getComputedStyle(p).opacity,
        animPlayState: window.getComputedStyle(p).animationPlayState
      });
    });
    // Snapshot depth canvas particles if accessible
    if (_depthEngine && typeof _depthEngine.getParticleSnapshot === 'function') {
      snapshot.depthParticles = _depthEngine.getParticleSnapshot();
    }
    return snapshot;
  }

  function _restoreState(snapshot, easeDuration) {
    if (!snapshot) return;
    _fieldState = JSON.parse(JSON.stringify(snapshot.fieldState));
    _bgState = JSON.parse(JSON.stringify(snapshot.bgState));
    _warmthAccumulated = snapshot.warmth;
    // Restore depth canvas particles
    if (_depthEngine && typeof _depthEngine.restoreParticleSnapshot === 'function' && snapshot.depthParticles) {
      _depthEngine.restoreParticleSnapshot(snapshot.depthParticles, easeDuration);
    }
    // Resume CSS animations on DOM particles
    var particles = document.querySelectorAll('.particle');
    particles.forEach(function(p) {
      p.style.animationPlayState = 'running';
    });
    // Ease background back
    _applyBgState(_bgState, easeDuration);
    console.log('[NVE] State restored from snapshot, ease:', easeDuration + 'ms');
  }

  // ── FREEZE ALL ANIMATIONS (for gap_reveal) ──
  function _freezeAll() {
    // Freeze CSS-animated DOM particles
    var particles = document.querySelectorAll('.particle');
    particles.forEach(function(p) {
      // Capture current computed position and freeze it
      var computed = window.getComputedStyle(p);
      p.style.animationPlayState = 'paused';
    });
    // Freeze alignment rings
    var rings = document.querySelectorAll('.coh-ring');
    rings.forEach(function(r) {
      r.style.animationPlayState = 'paused';
    });
    // Freeze Luno drift
    var lunoCon = document.getElementById('lunoCon');
    if (lunoCon) {
      var lunoEl = lunoCon.querySelector('.luno');
      if (lunoEl) lunoEl.style.animationPlayState = 'paused';
    }
    // Freeze aurora bands
    var auroraBands = document.querySelectorAll('.aurora-band');
    auroraBands.forEach(function(b) { b.style.animationPlayState = 'paused'; });
    // Freeze waves
    var waves = document.querySelectorAll('.wave');
    waves.forEach(function(w) { w.style.animationPlayState = 'paused'; });
    // Signal depth engine to freeze its rAF loop
    if (_depthEngine && typeof _depthEngine.freeze === 'function') {
      _depthEngine.freeze();
    }
    console.log('[NVE] All animations frozen for gap_reveal');
  }

  function _unfreezeAll() {
    var particles = document.querySelectorAll('.particle');
    particles.forEach(function(p) { p.style.animationPlayState = 'running'; });
    var rings = document.querySelectorAll('.coh-ring');
    rings.forEach(function(r) { r.style.animationPlayState = 'running'; });
    var lunoCon = document.getElementById('lunoCon');
    if (lunoCon) {
      var lunoEl = lunoCon.querySelector('.luno');
      if (lunoEl) lunoEl.style.animationPlayState = 'running';
    }
    var auroraBands = document.querySelectorAll('.aurora-band');
    auroraBands.forEach(function(b) { b.style.animationPlayState = 'running'; });
    var waves = document.querySelectorAll('.wave');
    waves.forEach(function(w) { w.style.animationPlayState = 'running'; });
    if (_depthEngine && typeof _depthEngine.unfreeze === 'function') {
      _depthEngine.unfreeze();
    }
    console.log('[NVE] All animations resumed');
  }

  // ── APPLY BACKGROUND STATE ──
  function _applyBgState(state, transitionMs) {
    var ms = transitionMs || 3000;
    var oceanBg = document.getElementById('oceanBg');
    if (!oceanBg) return;
    // Warmth: shift background toward amber/gold tones
    var warmth = Math.max(0, Math.min(1, state.warmth || 0));
    var r = Math.round(lerp(2, 18, warmth));
    var g = Math.round(lerp(8, 12, warmth));
    var b = Math.round(lerp(18, 8, warmth));
    // Storm top: darker turbulent gradient at top
    var stormTop = Math.max(0, Math.min(1, state.stormTop || 0));
    if (stormTop > 0.01) {
      oceanBg.style.transition = 'background ' + ms + 'ms ease';
      oceanBg.style.background = 'linear-gradient(to bottom, rgba(' + Math.round(lerp(2,30,stormTop)) + ',' + Math.round(lerp(8,20,stormTop)) + ',' + Math.round(lerp(18,30,stormTop)) + ',' + (stormTop * 0.3) + ') 0%, transparent 40%)';
    }
    // Openness: subtle scale/opacity expansion effect
    if (state.openness && state.openness > 0) {
      var immView = document.getElementById('immersiveView');
      if (immView) {
        immView.style.transition = 'filter ' + ms + 'ms ease';
        immView.style.filter = 'brightness(' + (1 + state.openness * 0.08) + ')';
      }
    }
  }

  // ── APPLY PARTICLE FIELD STATE ──
  function _applyFieldState(state) {
    // Modulate CSS-animated DOM particles (plankton layer)
    var particles = document.querySelectorAll('.particle');
    var tier = _performanceTier;
    var count = tier === 'reduced' ? Math.min(15, particles.length) : particles.length;

    particles.forEach(function(p, i) {
      if (i >= count) { p.style.opacity = '0'; return; }
      p.style.opacity = '';

      var baseSpeed = parseFloat(p.dataset.baseSpeed || p.style.getPropertyValue('--speed') || '5');
      if (!p.dataset.baseSpeed) p.dataset.baseSpeed = baseSpeed;

      // Speed multiplier
      var newSpeed = baseSpeed / Math.max(0.1, state.speedMul);
      p.style.setProperty('--speed', newSpeed + 's');

      // Rhythm
      switch(state.rhythm) {
        case 'frozen':
          p.style.animationPlayState = 'paused';
          break;
        case 'erratic':
          p.style.animationPlayState = 'running';
          // Erratic: randomize drift direction
          var ex = (Math.random() - 0.5) * 60;
          var ey = (Math.random() - 0.5) * 60;
          p.style.setProperty('--dx', ex + 'px');
          p.style.setProperty('--dy', ey + 'px');
          break;
        case 'steady':
          p.style.animationPlayState = 'running';
          break;
        case 'breath_sync':
          p.style.animationPlayState = 'running';
          break;
        default:
          p.style.animationPlayState = 'running';
      }

      // Color shift
      if (state.colorShift === 'warm') {
        p.style.background = 'rgba(200, 140, 80, 0.6)';
        p.style.boxShadow = 'rgba(200, 140, 80, 0.5) 0px 0px 10px';
      } else if (state.colorShift === 'cool') {
        p.style.background = 'rgba(80, 140, 200, 0.6)';
        p.style.boxShadow = 'rgba(80, 140, 200, 0.5) 0px 0px 10px';
      } else if (state.colorShift === null) {
        // Restore original color from data attribute
        var origBg = p.dataset.origBg;
        var origShadow = p.dataset.origShadow;
        if (origBg) { p.style.background = origBg; p.style.boxShadow = origShadow || ''; }
      }

      // Triband zones
      if (state.triband) {
        var topPct = window.innerHeight * 0.33;
        var midPct = window.innerHeight * 0.66;
        var rect = p.getBoundingClientRect();
        var py = rect.top;
        var zone;
        if (py < topPct) zone = state.triband.top;
        else if (py < midPct) zone = state.triband.mid;
        else zone = state.triband.bottom;
        if (zone) {
          p.style.setProperty('--speed', (baseSpeed / Math.max(0.1, zone.speed || 1)) + 's');
          if (zone.color === 'warm_gold') { p.style.background = 'rgba(220,180,80,0.65)'; p.style.boxShadow = 'rgba(220,180,80,0.5) 0px 0px 10px'; }
          else if (zone.color === 'amber') { p.style.background = 'rgba(200,140,60,0.65)'; p.style.boxShadow = 'rgba(200,140,60,0.5) 0px 0px 10px'; }
          else if (zone.color === 'deep_blue') { p.style.background = 'rgba(40,80,140,0.5)'; p.style.boxShadow = 'rgba(40,80,140,0.4) 0px 0px 8px'; }
          if (zone.rhythm === 'frozen') p.style.animationPlayState = 'paused';
          else p.style.animationPlayState = 'running';
        }
      }

      // Zone density (anchor_descend)
      if (state.zoneDensity) {
        var zd = state.zoneDensity;
        var pLeft = parseFloat(p.style.left);
        var pTop = parseFloat(p.style.top);
        var inZone = false;
        if (zd.zone === 'center_bottom' && pLeft > 30 && pLeft < 70 && pTop > 55) inZone = true;
        if (inZone) {
          var zdSpeed = baseSpeed / Math.max(0.1, zd.speed || 0.5);
          p.style.setProperty('--speed', zdSpeed + 's');
          if (zd.colorShift === 'warm') { p.style.background = 'rgba(200,150,80,0.7)'; p.style.boxShadow = 'rgba(200,150,80,0.6) 0px 0px 12px'; }
          if (zd.gravity === 'sink') {
            var curDy = parseFloat(p.style.getPropertyValue('--dy') || '0');
            p.style.setProperty('--dy', Math.abs(curDy) + 8 + 'px');
          }
        }
      }
    });
  }

  // ── STORE ORIGINAL PARTICLE COLORS ──
  function _cacheParticleColors() {
    var particles = document.querySelectorAll('.particle');
    particles.forEach(function(p) {
      if (!p.dataset.origBg) {
        p.dataset.origBg = p.style.background || '';
        p.dataset.origShadow = p.style.boxShadow || '';
        p.dataset.origSpeed = p.style.getPropertyValue('--speed') || '5s';
        p.dataset.origDx = p.style.getPropertyValue('--dx') || '0px';
        p.dataset.origDy = p.style.getPropertyValue('--dy') || '0px';
      }
    });
  }

  // ── RESTORE ORIGINAL PARTICLE COLORS ──
  function _restoreParticleColors(transitionMs) {
    var particles = document.querySelectorAll('.particle');
    particles.forEach(function(p) {
      if (p.dataset.origBg !== undefined) {
        p.style.transition = 'background ' + (transitionMs || 2000) + 'ms ease, box-shadow ' + (transitionMs || 2000) + 'ms ease';
        p.style.background = p.dataset.origBg;
        p.style.boxShadow = p.dataset.origShadow || '';
        p.style.setProperty('--speed', p.dataset.origSpeed || '5s');
        p.style.setProperty('--dx', p.dataset.origDx || '0px');
        p.style.setProperty('--dy', p.dataset.origDy || '0px');
        p.style.animationPlayState = 'running';
      }
    });
  }

  // ── BLUEPRINT LINES (static snapshot connections) ──
  function _drawBlueprintLines(opacity, color, pulseSpeed) {
    if (_performanceTier === 'reduced') {
      // Fallback: color shift on particles
      _fieldState.colorShift = 'cool';
      _applyFieldState(_fieldState);
      return;
    }
    // Remove existing blueprint canvas
    _clearBlueprintLines();
    var container = document.getElementById('immersiveView');
    if (!container) return;
    var canvas = document.createElement('canvas');
    canvas.id = 'blueprintCanvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;opacity:0;transition:opacity 2000ms ease;';
    container.appendChild(canvas);
    _blueprintCanvas = canvas;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    _blueprintCtx = canvas.getContext('2d');

    // Snapshot particle positions at this moment
    var particles = document.querySelectorAll('.particle');
    var positions = [];
    particles.forEach(function(p) {
      var rect = p.getBoundingClientRect();
      var containerRect = container.getBoundingClientRect();
      positions.push({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2
      });
    });

    // Draw 8 nearest-neighbor connections
    var connections = [];
    var maxConnections = 8;
    for (var i = 0; i < positions.length && connections.length < maxConnections; i++) {
      var nearest = null, nearDist = Infinity;
      for (var j = i + 1; j < positions.length; j++) {
        var dx = positions[i].x - positions[j].x;
        var dy = positions[i].y - positions[j].y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 200 && dist < nearDist) { nearDist = dist; nearest = j; }
      }
      if (nearest !== null) connections.push([positions[i], positions[nearest]]);
    }
    _blueprintLines = connections;

    // Draw static lines
    _blueprintCtx.clearRect(0, 0, canvas.width, canvas.height);
    _blueprintCtx.strokeStyle = color || '#8B9DC3';
    _blueprintCtx.lineWidth = 0.8;
    connections.forEach(function(conn) {
      _blueprintCtx.globalAlpha = opacity || 0.15;
      _blueprintCtx.beginPath();
      _blueprintCtx.moveTo(conn[0].x, conn[0].y);
      _blueprintCtx.lineTo(conn[1].x, conn[1].y);
      _blueprintCtx.stroke();
    });

    // Fade in
    setTimeout(function() { if (canvas.parentNode) canvas.style.opacity = '1'; }, 50);

    // Pulse animation
    if (pulseSpeed) {
      var pulseT = 0;
      var pulseRAF;
      function pulseDraw() {
        if (!_blueprintCtx || !canvas.parentNode) return;
        pulseT += 0.016 * (pulseSpeed || 0.5);
        var alpha = (opacity || 0.15) * (0.7 + 0.3 * Math.sin(pulseT));
        _blueprintCtx.clearRect(0, 0, canvas.width, canvas.height);
        _blueprintCtx.strokeStyle = color || '#8B9DC3';
        _blueprintCtx.lineWidth = 0.8;
        connections.forEach(function(conn) {
          _blueprintCtx.globalAlpha = alpha;
          _blueprintCtx.beginPath();
          _blueprintCtx.moveTo(conn[0].x, conn[0].y);
          _blueprintCtx.lineTo(conn[1].x, conn[1].y);
          _blueprintCtx.stroke();
        });
        pulseRAF = requestAnimationFrame(pulseDraw);
      }
      canvas._pulseRAF = pulseRAF;
      pulseDraw();
    }
    console.log('[NVE] Blueprint lines drawn:', connections.length, 'connections');
  }

  function _clearBlueprintLines() {
    if (_blueprintCanvas) {
      if (_blueprintCanvas._pulseRAF) cancelAnimationFrame(_blueprintCanvas._pulseRAF);
      _blueprintCanvas.style.opacity = '0';
      var bc = _blueprintCanvas;
      setTimeout(function() { if (bc.parentNode) bc.parentNode.removeChild(bc); }, 2000);
      _blueprintCanvas = null;
      _blueprintCtx = null;
    }
    _blueprintLines = [];
  }

  // ── ALIGNMENT INDICATOR CONTROL ──
  function _pulseAlignmentRings(syncPhase, scaleMul, durationMs) {
    var rings = document.querySelectorAll('.coh-ring');
    rings.forEach(function(r) {
      r.style.transition = 'transform ' + (durationMs || 800) + 'ms ease-in-out';
      if (syncPhase === 'exhale' && _breathPhase === 'exhale') {
        r.style.transform = 'scale(' + (scaleMul || 1.15) + ')';
        setTimeout(function() { r.style.transform = 'scale(1)'; }, durationMs || 800);
      }
    });
  }

  function _addAlignmentRing(color, opacity) {
    if (_alignmentRingAdded) return;
    var cohRings = document.querySelector('.coh-rings');
    if (!cohRings) return;
    var ring = document.createElement('div');
    ring.className = 'coh-ring nve-position-ring';
    ring.style.cssText = 'width:110px;height:110px;left:-5px;top:-5px;border-color:' + (color || 'rgba(220,180,80,0.4)') + ';opacity:0;transition:opacity 3000ms ease;border-width:1px;';
    cohRings.appendChild(ring);
    setTimeout(function() { ring.style.opacity = opacity || '0.4'; }, 100);
    _alignmentRingAdded = true;
    console.log('[NVE] Position marker ring added');
  }

  // ── TRIGGER FLASH (shockwave scatter) ──
  function _triggerFlash() {
    // NS3 gate (clinical safety, spec §7): suppress if below regulation window.
    // The shockwave scatter is contraindicated when the user is dysregulated.
    if (_bioBridge && typeof _bioBridge.isInRegulationWindow === 'function' &&
        !_bioBridge.isInRegulationWindow()) {
      console.log('[NVE] trigger_flash suppressed: NS3 below regulation window');
      return;
    }
    var particles = document.querySelectorAll('.particle');
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var speedMul = _performanceTier === 'reduced' ? 4 : 8;
    particles.forEach(function(p) {
      var rect = p.getBoundingClientRect();
      var px = rect.left + rect.width / 2;
      var py = rect.top + rect.height / 2;
      var dx = px - cx;
      var dy = py - cy;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      var nx = (dx / dist) * speedMul * (50 + Math.random() * 80);
      var ny = (dy / dist) * speedMul * (50 + Math.random() * 80);
      p.style.transition = 'left 2500ms cubic-bezier(0.16,1,0.3,1), top 2500ms cubic-bezier(0.16,1,0.3,1), opacity 2000ms ease-out';
      var curLeft = parseFloat(p.style.left);
      var curTop = parseFloat(p.style.top);
      p.style.left = (curLeft + nx / window.innerWidth * 100) + '%';
      p.style.top = (curTop + ny / window.innerHeight * 100) + '%';
      p.style.opacity = '0';
    });
    // After scatter, restore
    setTimeout(function() {
      _restoreParticleColors(3000);
      particles.forEach(function(p) {
        p.style.transition = 'left 3000ms ease-in, top 3000ms ease-in, opacity 3000ms ease-in';
        p.style.opacity = '';
      });
    }, 2500);
    console.log('[NVE] Trigger flash fired');
  }

  // ── GAP REVEAL (6-second total freeze) ──
  function _gapReveal(durationMs, resumeDurationMs) {
    var dur = durationMs || 6000;
    var resumeDur = resumeDurationMs || 3000;
    console.log('[NVE] gap_reveal: freezing all animations for', dur + 'ms');
    _frozenState = _snapshotState();
    _freezeAll();
    // Hold for exactly dur ms
    _gapFreezeTimer = setTimeout(function() {
      _gapFreezeTimer = null;
      console.log('[NVE] gap_reveal: resuming after', dur + 'ms freeze');
      _unfreezeAll();
      _restoreState(_frozenState, resumeDur);
    }, dur);
  }

  // ── BREATH SYNC VISUAL UPDATE ──
  function _onBreathFrame(data) {
    _breathPhase = data.phase || 'exhale';
    _breathProgress = data.progress || 0;
    _breathCycleCount = data.cycle_count || 0;

    var particles = document.querySelectorAll('.particle');
    if (_fieldState.rhythm === 'breath_sync') {
      // environment_sync: particles drift inward on inhale, outward on exhale
      var cx = 50; // percent center
      var cy = 50;
      particles.forEach(function(p) {
        var pLeft = parseFloat(p.style.left);
        var pTop = parseFloat(p.style.top);
        if (_breathPhase === 'inhale') {
          // Drift toward center
          var dx = (cx - pLeft) * 0.015 * _breathProgress;
          var dy = (cy - pTop) * 0.015 * _breathProgress;
          p.style.setProperty('--dx', (parseFloat(p.style.getPropertyValue('--dx') || '0') + dx) + 'px');
          p.style.setProperty('--dy', (parseFloat(p.style.getPropertyValue('--dy') || '0') + dy) + 'px');
          // Brighten
          p.style.opacity = String(Math.min(1, 0.6 + _breathProgress * 0.3));
        } else if (_breathPhase === 'exhale') {
          // Drift outward
          var dx2 = (pLeft - cx) * 0.012 * _breathProgress;
          var dy2 = (pTop - cy) * 0.012 * _breathProgress;
          p.style.setProperty('--dx', (parseFloat(p.style.getPropertyValue('--dx') || '0') + dx2) + 'px');
          p.style.setProperty('--dy', (parseFloat(p.style.getPropertyValue('--dy') || '0') + dy2) + 'px');
          // Soften
          p.style.opacity = String(Math.max(0.2, 0.6 - _breathProgress * 0.2));
        }
      });
    }

    // Alignment ring pulse on exhale
    if (_breathPhase === 'exhale' && _breathProgress > 0.1 && _breathProgress < 0.3) {
      _pulseAlignmentRings('exhale', 1.12, 600);
    }

    // HRV expand: widen pulse interval over breathing phase
    if (_fieldState.rhythm === 'heartbeat' && _hrvPulseTarget !== _hrvPulseMs) {
      _hrvPulseMs += (_hrvPulseTarget - _hrvPulseMs) * 0.01;
    }

    // Ladder climb: user drifts upward per exhale
    if (_ladderZone === 'climb' && _breathPhase === 'exhale' && _breathProgress > 0.5) {
      particles.forEach(function(p) {
        var pTop = parseFloat(p.style.top);
        if (pTop > 10) {
          p.style.top = (pTop - 0.08) + '%';
        }
      });
    }

    // Anchor deepen: center-bottom cluster sinks per exhale
    if (_fieldState.rhythm === 'breath_sync' && _fieldState.zoneDensity && _breathPhase === 'exhale') {
      particles.forEach(function(p) {
        var pLeft = parseFloat(p.style.left);
        var pTop = parseFloat(p.style.top);
        if (pLeft > 30 && pLeft < 70 && pTop > 55) {
          p.style.top = Math.min(92, pTop + 0.05 * _breathProgress) + '%';
        }
      });
    }

    // Refund accumulate: restore edge particles per exhale
    if (_breathPhase === 'exhale' && _breathProgress > 0.8) {
      _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.002);
    }

    // Gap practice: pause at inhale peak
    if (_currentPhase === 'breathing' && _fieldState.rhythm === 'breath_sync') {
      if (_breathPhase === 'hold' || (_breathPhase === 'inhale' && _breathProgress > 0.92)) {
        // Brief freeze at peak
        particles.forEach(function(p) { p.style.animationPlayState = 'paused'; });
        setTimeout(function() {
          particles.forEach(function(p) { p.style.animationPlayState = 'running'; });
        }, 400);
      }
    }
  }

  // ── PACER FALLBACK (when no Polar H10) ──
  function _startPacerFallback(ratio) {
    _stopPacerFallback();
    _pacerRatio = ratio || { inhale: 4, hold: 0, exhale: 6 };
    _pacerCycleMs = (_pacerRatio.inhale + (_pacerRatio.hold || 0) + _pacerRatio.exhale) * 1000;
    var phases = ['inhale'];
    if (_pacerRatio.hold > 0) phases.push('hold');
    phases.push('exhale');
    var phaseIdx = 0;
    var phaseDurations = {
      inhale: _pacerRatio.inhale * 1000,
      hold: (_pacerRatio.hold || 0) * 1000,
      exhale: _pacerRatio.exhale * 1000
    };
    function runPhase() {
      _pacerPhase = phases[phaseIdx];
      var dur = phaseDurations[_pacerPhase];
      var start = Date.now();
      function tick() {
        var elapsed = Date.now() - start;
        _pacerProgress = Math.min(1, elapsed / dur);
        _onBreathFrame({ phase: _pacerPhase, progress: _pacerProgress, cycle_count: _breathCycleCount });
        if (elapsed < dur) {
          _pacerTimer = setTimeout(tick, 100);
        } else {
          phaseIdx = (phaseIdx + 1) % phases.length;
          if (phases[phaseIdx] === 'inhale') _breathCycleCount++;
          runPhase();
        }
      }
      tick();
    }
    runPhase();
    console.log('[NVE] Pacer fallback started:', _pacerRatio.inhale + ':' + (_pacerRatio.hold || 0) + ':' + _pacerRatio.exhale);
  }

  function _stopPacerFallback() {
    if (_pacerTimer) { clearTimeout(_pacerTimer); _pacerTimer = null; }
  }

  // ── HRV HEARTBEAT PULSE ──
  function _startHrvPulse(intervalMs) {
    _stopHrvPulse();
    _hrvPulseMs = intervalMs || 600;
    function pulse() {
      var particles = document.querySelectorAll('.particle');
      particles.forEach(function(p) {
        p.style.transition = 'transform 80ms ease-out';
        p.style.transform = 'scale(1.08)';
        setTimeout(function() {
          p.style.transform = 'scale(1)';
        }, 80);
      });
      _hrvPulseInterval = setTimeout(pulse, _hrvPulseMs);
    }
    pulse();
    console.log('[NVE] HRV pulse started at', intervalMs + 'ms interval');
  }

  function _stopHrvPulse() {
    if (_hrvPulseInterval) { clearTimeout(_hrvPulseInterval); _hrvPulseInterval = null; }
  }

  // ── CORE TRIGGER DISPATCHER ──
  function trigger(visualName, options) {
    var opts = options || {};
    var priorityKey = VISUAL_PRIORITY_MAP[visualName] || 'narrative_subtle';
    var priority = VISUAL_PRIORITY[priorityKey] || 2;
    var durationMs = (opts.duration_seconds || 30) * 1000;

    // Check active visual priority
    var currentPriority = -1;
    var currentLayer = _getActiveLayer(visualName);
    if (_activeVisuals[currentLayer]) {
      currentPriority = VISUAL_PRIORITY[_activeVisuals[currentLayer].priorityKey] || 0;
    }

    // Priority rules
    if (priority < currentPriority) {
      // Queue behind current
      _queue.push({ name: visualName, options: opts, priority: priority, priorityKey: priorityKey });
      console.log('[NVE] Queued:', visualName, '(priority', priority, '< active', currentPriority + ')');
      return;
    }

    // Signature moment: cancel everything except breath_sync
    if (priorityKey === 'signature_moment') {
      _cancelAllExceptBreathSync();
    }

    // Crossfade over 500ms if replacing equal/higher priority
    _dispatchVisual(visualName, opts, priority, priorityKey, durationMs, currentLayer);
  }

  function _getActiveLayer(visualName) {
    // Determine which "layer" this visual occupies
    var particleVisuals = ['depth_pulse','trigger_flash','gap_reveal','environment_sync','anchor_descend','blueprint_lines','ladder_emerge','hrv_rhythm','hrv_expand','tax_weight','tax_erosion','refund_begins','refund_accumulate','breath_thread','anchor_deepen','anchor_set','ladder_climb','gap_practice','blueprint_breathe','six_seconds_weight','gap_installed','weight_of_everything','five_signals','not_broken_reveal','foundation_build','body_memory_map','hrv_rhythm_slow','score_rewritten','surplus_visible','position_marker','authorship_glow'];
    var bgVisuals = ['environment_settled','body_memory_glow','storm_surface','arc_complete_horizon','warmth_layer','gap_persist','anchor_set_bg','blueprint_illuminate'];
    var textVisuals = ['text_fade_line','text_hidden','text_visible'];
    if (particleVisuals.indexOf(visualName) >= 0) return 'particle';
    if (bgVisuals.indexOf(visualName) >= 0) return 'background';
    if (textVisuals.indexOf(visualName) >= 0) return 'text';
    return 'particle';
  }

  function _cancelAllExceptBreathSync() {
    Object.keys(_activeVisuals).forEach(function(layer) {
      var v = _activeVisuals[layer];
      if (v && v.priorityKey !== 'breath_sync') {
        if (v.timerId) clearTimeout(v.timerId);
        delete _activeVisuals[layer];
      }
    });
    _queue = _queue.filter(function(q) { return q.priorityKey === 'breath_sync'; });
  }

  function _dispatchVisual(name, opts, priority, priorityKey, durationMs, layer) {
    // Clear previous timer for this layer
    if (_activeVisuals[layer] && _activeVisuals[layer].timerId) {
      clearTimeout(_activeVisuals[layer].timerId);
    }

    // Register as active
    var timerId = null;
    if (durationMs > 0 && durationMs < 999999) {
      timerId = setTimeout(function() {
        delete _activeVisuals[layer];
        _processQueue();
      }, durationMs);
    }
    _activeVisuals[layer] = { name: name, priority: priority, priorityKey: priorityKey, startTime: Date.now(), params: opts, timerId: timerId };

    console.log('[NVE] Triggering:', name, '| priority:', priorityKey, '| duration:', durationMs + 'ms');

    // Dispatch to specific handler
    switch(name) {
      // ── PARTICLE FIELD ──
      case 'depth_pulse':
        _fieldState.speedMul = 2.5;
        _fieldState.rhythm = 'erratic';
        _fieldState.clustering = 0.8;
        _applyFieldState(_fieldState);
        break;

      case 'trigger_flash':
        _triggerFlash();
        break;

      case 'gap_reveal':
        var gapDur = opts.duration_ms || (opts.duration_seconds ? opts.duration_seconds * 1000 : 6000);
        var resumeDur = opts.resume_duration_ms || 3000;
        _gapReveal(gapDur, resumeDur);
        break;

      case 'environment_sync':
      case 'environment_sync_begin':
        _fieldState.rhythm = 'breath_sync';
        _fieldState.speedMul = 0.6;
        _applyFieldState(_fieldState);
        _breathSyncActive = true;
        // Start pacer fallback if no BLE
        if (_bioBridge && _bioBridge.getActiveSource() !== 'h10') {
          var ratio = _pacerRatio;
          if (_ssm) {
            try { var sd = _ssm.getSessionState(); if (sd && sd.ratio) ratio = sd.ratio; } catch(e) {}
          }
          _startPacerFallback(ratio);
        }
        break;

      case 'breath_thread':
        // Single particle thread — highlight one particle
        var particles = document.querySelectorAll('.particle');
        if (particles.length > 0) {
          var chosen = particles[Math.floor(particles.length / 2)];
          chosen.style.transition = 'background 2000ms ease, box-shadow 2000ms ease';
          chosen.style.background = 'rgba(220,200,160,0.9)';
          chosen.style.boxShadow = 'rgba(220,200,160,0.8) 0px 0px 20px';
        }
        break;

      case 'anchor_descend':
        _fieldState.zoneDensity = { zone: 'center_bottom', density: 3.0, speed: 0.2, colorShift: 'warm', gravity: 'sink' };
        _applyFieldState(_fieldState);
        break;

      case 'anchor_deepen':
        _fieldState.rhythm = 'breath_sync';
        _fieldState.zoneDensity = { zone: 'center_bottom', density: 3.0, speed: 0.15, colorShift: 'warm', gravity: 'sink' };
        _applyFieldState(_fieldState);
        break;

      case 'anchor_set':
        _fieldState.zoneDensity = { zone: 'center_bottom', density: 2.0, speed: 0.1, colorShift: 'warm', gravity: 'sink' };
        _fieldState.speedMul = 0.8;
        _applyFieldState(_fieldState);
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.1);
        break;

      case 'blueprint_lines':
        _drawBlueprintLines(0.15, '#8B9DC3', 0.5);
        break;

      case 'blueprint_breathe':
        if (_blueprintCanvas) {
          // Pulse lines with exhale
          _blueprintCanvas.style.opacity = _breathPhase === 'exhale' ? '0.9' : '0.5';
        }
        break;

      case 'blueprint_illuminate':
        _fieldState.colorShift = 'cool';
        _applyFieldState(_fieldState);
        break;

      case 'ladder_emerge':
        _fieldState.triband = {
          top: { color: 'warm_gold', speed: 0.5, rhythm: 'steady' },
          mid: { color: 'amber', speed: 2.0, rhythm: 'erratic' },
          bottom: { color: 'deep_blue', speed: 0.1, rhythm: 'frozen' }
        };
        _applyFieldState(_fieldState);
        break;

      case 'ladder_climb':
        _ladderZone = 'climb';
        _fieldState.rhythm = 'breath_sync';
        break;

      case 'hrv_rhythm':
        _startHrvPulse(opts.pulse_interval_ms || 600);
        _fieldState.rhythm = 'heartbeat';
        break;

      case 'hrv_expand':
        _hrvPulseTarget = opts.pulse_interval_end_ms || 1200;
        _fieldState.rhythm = 'heartbeat';
        break;

      case 'tax_weight':
        _fieldState.speedMul = 0.3;
        _fieldState.dragMul = 0.8;
        _applyFieldState(_fieldState);
        break;

      case 'tax_erosion':
        // Dim edge particles
        var particles2 = document.querySelectorAll('.particle');
        particles2.forEach(function(p) {
          var pLeft = parseFloat(p.style.left);
          var pTop = parseFloat(p.style.top);
          if (pLeft < 15 || pLeft > 85 || pTop < 15 || pTop > 85) {
            p.style.transition = 'opacity 3000ms ease';
            p.style.opacity = '0.1';
          }
        });
        break;

      case 'refund_begins':
        // Center warmth returns
        _fieldState.colorShift = 'warm';
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.05);
        _applyFieldState(_fieldState);
        break;

      case 'refund_accumulate':
        _fieldState.rhythm = 'breath_sync';
        // Restore edge particles per exhale (handled in _onBreathFrame)
        break;

      case 'weight_of_everything':
        _fieldState.speedMul = 0.25;
        _fieldState.dragMul = 0.9;
        _applyFieldState(_fieldState);
        break;

      case 'five_signals':
        // Five warm layers below — create 5 warm particle clusters at different depths
        _fieldState.colorShift = 'warm';
        _applyFieldState(_fieldState);
        break;

      case 'not_broken_reveal':
        // Heavy shapes lighten
        _fieldState.speedMul = 0.6;
        _fieldState.colorShift = null;
        _restoreParticleColors(3000);
        break;

      case 'foundation_build':
        _fieldState.rhythm = 'breath_sync';
        _fieldState.speedMul = 0.5;
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.08);
        _applyFieldState(_fieldState);
        break;

      case 'body_memory_map':
        // Warm spots in field
        _fieldState.colorShift = 'warm';
        _applyFieldState(_fieldState);
        break;

      case 'score_rewritten':
        _fieldState.speedMul = 0.7;
        _fieldState.colorShift = 'warm';
        _stopHrvPulse();
        _applyFieldState(_fieldState);
        break;

      case 'surplus_visible':
        _fieldState.speedMul = 1.0;
        _fieldState.colorShift = 'warm';
        _restoreParticleColors(4000);
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.12);
        break;

      case 'gap_practice':
        _fieldState.rhythm = 'breath_sync';
        // Pause at inhale peak — handled in _onBreathFrame
        break;

      case 'gap_installed':
        // Trigger replays, gap catches it
        setTimeout(function() { _triggerFlash(); }, 500);
        setTimeout(function() { _gapReveal(3000, 2000); }, 3500);
        break;

      case 'six_seconds_weight':
        // Stillness lingers after gap_reveal
        _fieldState.speedMul = 0.3;
        _fieldState.rhythm = 'steady';
        _applyFieldState(_fieldState);
        break;

      case 'position_marker':
        _addAlignmentRing('rgba(220,180,80,0.4)', '0.4');
        break;

      case 'authorship_glow':
        if (_blueprintCanvas) {
          _blueprintCtx && (_blueprintCtx.strokeStyle = 'rgba(220,200,120,0.4)');
        }
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.06);
        break;

      // ── BACKGROUND ATMOSPHERE ──
      case 'environment_settled':
        _bgState.warmth = Math.min(1, _bgState.warmth + (opts.background_warmth || 0.15));
        _applyBgState(_bgState, opts.transition_ms || 5000);
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.05);
        break;

      case 'body_memory_glow':
        _bgState.warmth = Math.min(1, _bgState.warmth + (opts.background_warmth || 0.08));
        _applyBgState(_bgState, 4000);
        break;

      case 'storm_surface':
        _bgState.stormTop = 0.3;
        _applyBgState(_bgState, 3000);
        break;

      case 'arc_complete_horizon':
        _bgState.warmth = Math.min(1, _bgState.warmth + 0.25);
        _bgState.openness = 0.5;
        _applyBgState(_bgState, opts.transition_ms || 8000);
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.15);
        break;

      case 'warmth_layer':
        _bgState.warmth = Math.min(1, _bgState.warmth + 0.12);
        _applyBgState(_bgState, 4000);
        _warmthAccumulated = Math.min(1, _warmthAccumulated + 0.06);
        break;

      case 'gap_persist':
        // Light lingers post-breath
        _bgState.warmth = Math.min(1, _bgState.warmth + 0.08);
        _applyBgState(_bgState, 5000);
        break;

      case 'blueprint_illuminate':
        _bgState.warmth = Math.min(1, _bgState.warmth + 0.05);
        _applyBgState(_bgState, 3000);
        break;

      // ── TEXT ──
      case 'text_hidden':
        var dialogue = document.getElementById('dialogue');
        if (dialogue) { dialogue.style.transition = 'opacity 1000ms ease'; dialogue.style.opacity = '0'; dialogue.style.pointerEvents = 'none'; }
        break;

      case 'text_visible':
        var dialogue2 = document.getElementById('dialogue');
        if (dialogue2) { dialogue2.style.transition = 'opacity 1000ms ease'; dialogue2.style.opacity = '1'; dialogue2.style.pointerEvents = ''; }
        break;

      case 'text_fade_line':
        // Text fade per line — handled by Dialogue module; this just ensures visibility
        var dialogue3 = document.getElementById('dialogue');
        if (dialogue3) { dialogue3.style.opacity = '1'; }
        break;

      default:
        console.log('[NVE] Unknown visual:', name, '— no handler');
    }
  }

  function _processQueue() {
    if (_queue.length === 0) return;
    _queue.sort(function(a, b) { return b.priority - a.priority; });
    var next = _queue.shift();
    trigger(next.name, next.options);
  }

  // ── RESET TO AMBIENT ──
  function reset(fadeDuration) {
    var fd = fadeDuration || 2000;
    console.log('[NVE] Resetting to ambient, fade:', fd + 'ms');
    // Cancel all active visual timers
    Object.keys(_activeVisuals).forEach(function(layer) {
      if (_activeVisuals[layer] && _activeVisuals[layer].timerId) {
        clearTimeout(_activeVisuals[layer].timerId);
      }
    });
    _activeVisuals = {};
    _queue = [];
    _stopHrvPulse();
    _stopPacerFallback();
    _clearBlueprintLines();
    _breathSyncActive = false;
    _ladderZone = null;
    if (_gapFreezeTimer) { clearTimeout(_gapFreezeTimer); _gapFreezeTimer = null; _unfreezeAll(); }
    // Restore particle field
    _fieldState = { speedMul: 1.0, rhythm: 'ambient', clustering: 0.5, colorShift: null, zoneDensity: null, triband: null, dragMul: 1.0, inhaleDrift: null, exhaleDrift: null };
    _restoreParticleColors(fd);
    // Restore background (keep accumulated warmth)
    _bgState.stormTop = 0;
    _bgState.openness = 0;
    _applyBgState(_bgState, fd);
  }

  // ── PHASE-BASED DEFAULT VISUALS ──
  function _applyPhaseDefaults(phase) {
    switch(phase) {
      case 'arrival':
        trigger('text_visible', {});
        break;
      case 'opening':
        trigger('text_fade_line', {});
        break;
      case 'resistance':
        trigger('text_fade_line', {});
        break;
      case 'before_the_breath':
        trigger('text_visible', {});
        _fieldState.speedMul = 0.7;
        _applyFieldState(_fieldState);
        break;
      case 'breathing':
        trigger('text_hidden', {});
        trigger('environment_sync', { duration_seconds: 999 });
        break;
      case 'shift':
        trigger('text_fade_line', {});
        _breathSyncActive = false;
        _stopPacerFallback();
        // Apply accumulated warmth
        _bgState.warmth = Math.min(1, _bgState.warmth + _warmthAccumulated * 0.1);
        _applyBgState(_bgState, 5000);
        break;
      case 'close':
        trigger('text_visible', {});
        // Background warmer than start
        _bgState.warmth = Math.min(1, _bgState.warmth + 0.05);
        _applyBgState(_bgState, 6000);
        break;
      case 'vault':
        trigger('text_visible', {});
        break;
    }
  }

  // ── CONNECT TO STATE MACHINE ──
  function connectToStateMachine(ssm) {
    _ssm = ssm;
    ssm.on('onPhaseChange', function(phase) {
      _currentPhase = phase;
      _applyPhaseDefaults(phase);
      if (phase === 'breathing') {
        // Start breath sync interval
        _breathSyncInterval = setInterval(function() {
          if (_bioBridge && _bioBridge.getActiveSource() === 'h10') {
            // BioBridge exports getCurrentBiometrics, not getCurrentSample.
            // Phase 1 finding N5: live H10 path silently no-op'd before this rename.
            var sample = _bioBridge.getCurrentBiometrics ? _bioBridge.getCurrentBiometrics() : null;
            if (sample) {
              _onBreathFrame({ phase: _breathPhase, progress: _breathProgress, bpm: sample.heart_rate, coherence: sample.coherence, cycle_count: _breathCycleCount });
            }
          }
        }, 500);
      } else {
        if (_breathSyncInterval) { clearInterval(_breathSyncInterval); _breathSyncInterval = null; }
        if (phase !== 'breathing') { _stopPacerFallback(); }
      }
    });
    ssm.on('onBreathPhase', function(data) {
      _breathPhase = data.phase;
      _breathProgress = 0;
      _onBreathFrame({ phase: data.phase, progress: 0, cycle_count: data.breathCount || 0 });
    });
    ssm.on('onSessionReset', function() {
      reset(1500);
      _warmthAccumulated = 0;
      _alignmentRingAdded = false;
      var posRing = document.querySelector('.nve-position-ring');
      if (posRing && posRing.parentNode) posRing.parentNode.removeChild(posRing);
    });
    ssm.on('onSessionStart', function(data) {
      _currentSession = (data && data.sessionNumber) || 1;
      _cacheParticleColors();
    });
    console.log('[NVE] Connected to State Machine');
  }

  // ── CONNECT TO BIOMETRIC BRIDGE ──
  function connectToBiometricBridge(bio) {
    _bioBridge = bio;
    bio.on('biometricTick', function(data) {
      if (_breathSyncActive && data.sample) {
        // Smooth breath phase detection from HR data
        // (actual phase comes from SSM onBreathPhase events)
      }
    });
    console.log('[NVE] Connected to Biometric Bridge');
  }

  // ── CONNECT TO DEPTH ENGINE ──
  function connectToDepthEngine(de) {
    _depthEngine = de;
    console.log('[NVE] Connected to Depth Engine');
  }

  // ── postMessage INTERFACE (for iframe embedding) ──
  window.addEventListener('message', function(event) {
    if (!event.data) return;
    if (event.data.type === 'NARRATIVE_VISUAL') {
      var payload = event.data.payload || {};
      trigger(payload.visual, {
        duration_seconds: payload.duration_seconds,
        breath_sync: payload.breath_sync,
        sync_phase: payload.sync_phase,
        params: payload.params || {}
      });
    } else if (event.data.type === 'NARRATIVE_VISUAL_CLEAR') {
      var fd = (event.data.payload && event.data.payload.fade_duration_ms) || 2000;
      reset(fd);
    }
  });

  // ── GET STATE (for debugging) ──
  function getState() {
    return {
      activeVisuals: Object.keys(_activeVisuals).map(function(l) { return { layer: l, name: _activeVisuals[l].name, priority: _activeVisuals[l].priorityKey }; }),
      queue: _queue.map(function(q) { return q.name; }),
      fieldState: _fieldState,
      bgState: _bgState,
      breathSyncActive: _breathSyncActive,
      performanceTier: _performanceTier,
      warmthAccumulated: _warmthAccumulated,
      currentPhase: _currentPhase,
      currentSession: _currentSession
    };
  }

  // ── INIT ──
  function init() {
    _detectPerformanceTier();
    _cacheParticleColors();
    console.log('[NVE] Narrative Visuals Engine initialized | tier:', _performanceTier);
  }

  return {
    init: init,
    trigger: trigger,
    reset: reset,
    onBreathFrame: _onBreathFrame,
    connectToStateMachine: connectToStateMachine,
    connectToBiometricBridge: connectToBiometricBridge,
    connectToDepthEngine: connectToDepthEngine,
    getState: getState
  };

})();
