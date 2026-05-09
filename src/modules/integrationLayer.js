/**
 * integrationLayer.js — Module 7: Integration Layer
 * Owns ALL backend communication and external system hooks.
 * No other module makes API calls, posts to vault, or touches blockchain.
 *
 * Contains verbatim copies of AbiService and BreathworkModes from v8.1.
 * All ABI calls wrapped in try/catch — failures logged, never crash session.
 *
 * LOCKED after completion. Do not modify.
 */

'use strict';

// ================================================================
// Event emitter
// ================================================================

const _listeners = {};

function on(eventName, callback) {
  if (!_listeners[eventName]) _listeners[eventName] = [];
  _listeners[eventName].push(callback);
  return function off() {
    const arr = _listeners[eventName];
    if (arr) {
      const idx = arr.indexOf(callback);
      if (idx >= 0) arr.splice(idx, 1);
    }
  };
}

function _emit(eventName, data) {
  const arr = _listeners[eventName];
  if (arr) {
    for (let i = 0; i < arr.length; i++) {
      try { arr[i](data); } catch (e) { console.error('[INT] Event handler error:', eventName, e); }
    }
  }
}

// ================================================================
// AbiService class — VERBATIM from v8.1 index_v8.html
// ================================================================

class AbiService {
  constructor(baseUrl, options) {
    options = options || {};
    this.base = (baseUrl || '').replace(/\/$/, '');
    this.sessionKey = null;
    this.token = options.token || null;
    this.apiKey = options.apiKey || null;
    this._eventCallbacks = {};
  }

  async _req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    if (this.apiKey) headers['x-api-key'] = this.apiKey;
    if (this.sessionKey) headers['x-session-key'] = this.sessionKey;
    const opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json().catch(function (err) {
      const e = new Error('Non-JSON (HTTP ' + res.status + ')');
      e.cause = err;
      throw e;
    });
    if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
    if (data.events && data.events.length > 0) this._processEvents(data.events);
    return data;
  }

  on(eventType, cb) {
    if (!this._eventCallbacks[eventType]) this._eventCallbacks[eventType] = [];
    this._eventCallbacks[eventType].push(cb);
  }

  off(eventType, cb) {
    if (!this._eventCallbacks[eventType]) return;
    this._eventCallbacks[eventType] = this._eventCallbacks[eventType].filter(function (c) { return c !== cb; });
  }

  _processEvents(events) {
    for (const ev of events) {
      (this._eventCallbacks[ev.type] || []).forEach(function (cb) { try { cb(ev.data, ev); } catch (e) { console.error('Event cb err:', e); } });
      (this._eventCallbacks['*'] || []).forEach(function (cb) { try { cb(ev.data, ev); } catch (e) {} });
    }
  }

  async startSession(userId, sessionId, options) {
    const r = await this._req('POST', '/api/abi/session/start', Object.assign({ user_id: userId, session_id: sessionId }, options || {}));
    this.sessionKey = r.session_key;
    return r;
  }

  async arrivalSample(bio) {
    if (!this.sessionKey) throw new Error('No session');
    return this._req('POST', '/api/abi/session/arrival-sample', { session_key: this.sessionKey, biometrics: bio });
  }

  async arrivalComplete(bio) {
    if (!this.sessionKey) throw new Error('No session');
    return this._req('POST', '/api/abi/session/arrival-complete', { session_key: this.sessionKey, biometrics: bio });
  }

  async tick(bio) {
    if (!this.sessionKey) throw new Error('No session');
    return this._req('POST', '/api/abi/session/tick', { session_key: this.sessionKey, biometrics: bio });
  }

  async pause() {
    if (!this.sessionKey) throw new Error('No session');
    return this._req('POST', '/api/abi/session/pause', { session_key: this.sessionKey });
  }

  async resume() {
    if (!this.sessionKey) throw new Error('No session');
    return this._req('POST', '/api/abi/session/resume', { session_key: this.sessionKey });
  }

  async exit() {
    if (!this.sessionKey) throw new Error('No session');
    const r = await this._req('POST', '/api/abi/session/exit', { session_key: this.sessionKey });
    this.sessionKey = null;
    return r;
  }

  async completeSession(metrics) {
    if (!this.sessionKey) throw new Error('No session');
    const r = await this._req('POST', '/api/abi/session/complete', { session_key: this.sessionKey, metrics: metrics || {} });
    this.sessionKey = null;
    return r;
  }

  async bleDisconnect() { return this._req('POST', '/api/abi/session/ble-disconnect', { session_key: this.sessionKey }); }
  async bleReconnect() { return this._req('POST', '/api/abi/session/ble-reconnect', { session_key: this.sessionKey }); }
  async selectDrill(drillId) { return this._req('POST', '/api/abi/drill/select', { session_key: this.sessionKey, drill_id: drillId }); }
  async getSessionState() { return this._req('GET', '/api/abi/session/state/' + this.sessionKey); }
  async getAdaptedSession() { return this._req('GET', '/api/abi/session/adapted/' + this.sessionKey); }
  async pollEvents() { return this._req('GET', '/api/abi/session/events/' + this.sessionKey); }
  async getDrills(track) { return this._req('GET', '/api/abi/drills/' + (track || 'standard')); }
  async getSessions() { return this._req('GET', '/api/sessions'); }
  async getSession(n) { return this._req('GET', '/api/sessions/' + n); }
  async health() { return this._req('GET', '/api/health'); }
  async abiHealth() { return this._req('GET', '/api/abi/health'); }
  async activateLightBridge(pid) { return this._req('POST', '/api/lightbridge/activate', { participant_id: pid }); }
  async verifyOnChain(d) { return this._req('POST', '/api/blockchain/verify-session', d); }
}

// ================================================================
// Breathwork Modes — VERBATIM from v8.1 breathworkModes.js
// ================================================================

function _bmParseRatio(r) {
  if (!r) return [4, 6];
  if (r === 'user_chosen') throw new Error('parseRatio: user_chosen requires explicit ratio selection');
  return r.split(':').map(Number).filter(function (n) { return !isNaN(n) && n > 0; });
}

const MODES = {
  simple_pacer: { name: 'Simple Pacer', phases: ['inhale', 'exhale'], visual: 'circle_expand', getTimings: function (r) { const p = _bmParseRatio(r); return { inhale: { duration: p[0], label: 'Breathe In', pacer: 'expand', orbit_start: 0, orbit_end: 0.5 }, exhale: { duration: p[1], label: 'Breathe Out', pacer: 'contract', orbit_start: 0.5, orbit_end: 1.0 } }; }, tracks: { standard: { ratio: '4:6', total_cycle: 10, color_base: [120, 170, 210] }, gentle: { ratio: '3:5', total_cycle: 8, color_base: [140, 185, 210] }, minimal: { ratio: '3:4', total_cycle: 7, color_base: [155, 195, 215] } } },

  user_chosen: { name: 'Your Choice', phases: ['inhale', 'exhale'], visual: 'circle_expand', requiresSelection: true, availableRatios: { standard: ['4:6', '4:7', '4:8', '5:7'], gentle: ['3:5', '3:6', '4:6'], minimal: ['3:4', '3:5', '4:5'] }, getTimings: function (r) { const p = _bmParseRatio(r); return { inhale: { duration: p[0], label: 'Breathe In', pacer: 'expand', orbit_start: 0, orbit_end: 0.5 }, exhale: { duration: p[1], label: 'Breathe Out', pacer: 'contract', orbit_start: 0.5, orbit_end: 1.0 } }; }, tracks: { standard: { ratio: '4:6', total_cycle: 10, color_base: [120, 170, 210] }, gentle: { ratio: '3:5', total_cycle: 8, color_base: [140, 185, 210] }, minimal: { ratio: '3:4', total_cycle: 7, color_base: [155, 195, 215] } } },

  pendulation_loop: { name: 'Pendulation', phases: ['inhale', 'hold', 'exhale'], visual: 'pendulation', getTimings: function (r) { const p = _bmParseRatio(r); if (p.length === 3) return { inhale: { duration: p[0], label: 'Breathe In', pacer: 'expand', orbit_start: 0, orbit_end: 0.33 }, hold: { duration: p[1], label: 'Hold', pacer: 'hold', orbit_start: 0.33, orbit_end: 0.5 }, exhale: { duration: p[2], label: 'Breathe Out', pacer: 'contract', orbit_start: 0.5, orbit_end: 1.0 } }; return { inhale: { duration: p[0], label: 'Breathe In', pacer: 'expand', orbit_start: 0, orbit_end: 0.4 }, exhale: { duration: p[1], label: 'Breathe Out', pacer: 'contract', orbit_start: 0.4, orbit_end: 1.0 } }; }, pendulationVisual: { trigger_color: [210, 140, 90], resource_color: [90, 160, 210] }, tracks: { standard: { ratio: '4:6', hold: 0, total_cycle: 10, color_base: [160, 150, 180] }, gentle: { ratio: '3:5', hold: 0, total_cycle: 8, color_base: [170, 160, 185] }, minimal: { ratio: '3:4', hold: 0, total_cycle: 7, color_base: [180, 170, 190] } }, emotional_granularity: { standard: { ratio: '4:2:6', hold: 2, total_cycle: 12 }, gentle: { ratio: '3:2:5', hold: 2, total_cycle: 10 }, minimal: { ratio: '3:2:4', hold: 2, total_cycle: 9 } } },

  somatic_release: { name: 'Somatic Release', phases: ['inhale', 'exhale'], visual: 'wave', getTimings: function (r) { const p = _bmParseRatio(r); return { inhale: { duration: p[0], label: 'Breathe In', pacer: 'gentle_expand', orbit_start: 0, orbit_end: 0.33 }, exhale: { duration: p[1], label: 'Let Go', pacer: 'wave_release', orbit_start: 0.33, orbit_end: 1.0 } }; }, waveVisual: { wave_count: 3, wave_amplitude: 0.15, wave_color: [100, 160, 180] }, tracks: { standard: { ratio: '4:8', total_cycle: 12, color_base: [100, 155, 175] }, gentle: { ratio: '3:6', total_cycle: 9, color_base: [120, 170, 185] }, minimal: { ratio: '3:5', total_cycle: 8, color_base: [135, 180, 190] } } },

  coherence: { name: 'Coherence', phases: ['inhale', 'exhale'], visual: 'coherence_rings', locked_ratio: '6:6', getTimings: function () { return { inhale: { duration: 6, label: 'Breathe In', pacer: 'symmetrical_expand', orbit_start: 0, orbit_end: 0.5 }, exhale: { duration: 6, label: 'Breathe Out', pacer: 'symmetrical_contract', orbit_start: 0.5, orbit_end: 1.0 } }; }, tracks: { standard: { ratio: '6:6', total_cycle: 12, color_base: [180, 170, 140] } } },

  extended_exhale: { name: 'Extended Exhale', phases: ['inhale', 'exhale'], visual: 'circle_expand', getTimings: function (r) { const p = _bmParseRatio(r); return { inhale: { duration: p[0], label: 'Breathe In', pacer: 'expand', orbit_start: 0, orbit_end: 0.3 }, exhale: { duration: p[1], label: 'Slow Release', pacer: 'slow_contract', orbit_start: 0.3, orbit_end: 1.0 } }; }, tracks: { standard: { ratio: '4:8', total_cycle: 12, color_base: [120, 170, 210] }, gentle: { ratio: '3:7', total_cycle: 10, color_base: [140, 185, 210] }, minimal: { ratio: '3:6', total_cycle: 9, color_base: [155, 195, 215] } } }
};

const STATE_VISUALS = { visual_warmth: { cool_color: [14, 32, 48], warm_color: [48, 32, 14] }, exhale_extend: { max_extend: 3 }, luno_pulse_slow: { normal_speed: 8, slow_speed: 12 } };

function getModeConfig(mode, ratio, track, options) {
  track = track || 'standard'; options = options || {};
  const md = MODES[mode];
  if (!md) return getModeConfig('simple_pacer', ratio || '4:6', track, options);
  if (mode === 'coherence') { ratio = '6:6'; track = 'standard'; }
  const tc = md.tracks[track] || md.tracks.standard;
  const er = (ratio && ratio !== 'user_chosen') ? ratio : (tc.ratio || '4:6');
  const timings = md.getTimings(er);
  if (mode === 'pendulation_loop' && options.arc === 'emotional_granularity' && md.emotional_granularity) {
    const eg = md.emotional_granularity[track] || md.emotional_granularity.standard;
    return { mode: mode, name: md.name, visual: md.visual, ratio: eg.ratio, total_cycle: eg.total_cycle, timings: md.getTimings(eg.ratio), color_base: tc.color_base || [160, 150, 180], phases: md.phases, hold_seconds: eg.hold };
  }
  return { mode: mode, name: md.name, visual: md.visual, ratio: er, total_cycle: tc.total_cycle || _bmParseRatio(er).reduce(function (a, b) { return a + b; }, 0), timings: timings, color_base: tc.color_base || [120, 170, 210], phases: md.phases, locked: mode === 'coherence', requires_selection: md.requiresSelection || false, available_ratios: md.availableRatios ? md.availableRatios[track] : null, hold_seconds: tc.hold || 0 };
}

function getOrbitPosition(timings, elapsed, totalCycle) {
  if (!totalCycle || totalCycle <= 0) return 0;
  const eff = elapsed % totalCycle; let acc = 0;
  for (const [, cfg] of Object.entries(timings)) { if (eff < acc + cfg.duration) { const p = (eff - acc) / cfg.duration; return (cfg.orbit_start + p * (cfg.orbit_end - cfg.orbit_start)) * 360; } acc += cfg.duration; }
  return 359;
}

function getCurrentPhaseBM(timings, elapsed) {
  let totalCycle = 0;
  for (const [, c] of Object.entries(timings)) totalCycle += c.duration;
  if (totalCycle <= 0) return { phase: 'inhale', label: 'Breathe In', progress: 0 };
  const eff = elapsed % totalCycle; let acc = 0;
  for (const [phase, cfg] of Object.entries(timings)) { if (eff < acc + cfg.duration) return { phase: phase, label: cfg.label, progress: (eff - acc) / cfg.duration }; acc += cfg.duration; }
  return { phase: 'inhale', label: 'Breathe In', progress: 0 };
}

// ================================================================
// Module state
// ================================================================

let _apiBase = '';
let _apiKey = 'ascen-fr-2026-prod';
let _apiStatus = 'connecting';
let _abi = null;
let _userId = null;

// Embedded mode
let _isEmbedded = false;
let _embeddedAuthReceived = false;

// Module references
let _stateMachine = null;
let _biometricBridge = null;
let _sessionUI = null;

// Session tracking
let _activeSessionNumber = 0;
let _activeSessionData = null;
let _abiSessionActive = false;
let _abiCoherencePeak = 0;
let _abiMirror = null;
let _abiAffirmation = null;
let _abiAdvancement = null;
let _abiModeConfig = null;
let _tickInterval = null;
let _lastKnownCoherence = 0.25;

// ================================================================
// Initialization
// ================================================================

/**
 * initIntegrations — create ABI service, detect embedded mode, start handshake.
 * @param {string} apiBase - API base URL
 */
function initIntegrations(apiBase) {
  _apiBase = (apiBase || window.location.origin || 'https://hearty-optimism-production-2eb6.up.railway.app').replace(/\/$/, '');

  // Create ABI service
  _abi = new AbiService(_apiBase, { apiKey: _apiKey });

  // User ID
  _userId = localStorage.getItem('ascen_uid');
  if (!_userId) {
    _userId = 'user_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('ascen_uid', _userId);
  }

  // Detect embedded mode
  const urlParams = new URLSearchParams(window.location.search);
  _isEmbedded = urlParams.get('embedded') === 'true';

  if (_isEmbedded) {
    _initEmbeddedMode();
  }

  _setApiStatus('connecting');
}

// ================================================================
// Embedded mode — postMessage bridge
// ================================================================

function _initEmbeddedMode() {
  console.log('[EMBEDDED] Mode active');

  // Notify parent the iframe is ready (repeat until auth received)
  window.parent.postMessage({ type: 'iframe_ready' }, '*');
  const readyInterval = setInterval(function () {
    if (_embeddedAuthReceived) { clearInterval(readyInterval); return; }
    window.parent.postMessage({ type: 'iframe_ready' }, '*');
  }, 500);

  // Listen for auth from parent
  window.addEventListener('message', function (event) {
    const data = event.data || {};
    if (data.type === 'auth') {
      _embeddedAuthReceived = true;

      // Set auth on ABI service
      if (data.token && _abi) {
        _abi.token = data.token;
        localStorage.setItem('ascen_jwt', data.token);
      }
      if (data.apiKey && _abi) {
        _abi.apiKey = data.apiKey;
      }

      // Decode userId from JWT
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        _userId = payload.userId || payload.sub || payload.id || _userId;
        localStorage.setItem('ascen_uid', String(_userId));
      } catch (e) {}

      console.log('[EMBEDDED] Auth received, userId:', _userId);

      // Load sessions with JWT auth
      loadSessions();
    }
  });
}

function _notifyParentComplete(sessionNumber) {
  if (_isEmbedded) {
    window.parent.postMessage({ type: 'session_complete', data: { session_number: sessionNumber } }, '*');
  }
}

function _notifyParentExit() {
  if (_isEmbedded) {
    window.parent.postMessage({ type: 'session_exit' }, '*');
  }
}

function isEmbedded() {
  return _isEmbedded;
}

// ================================================================
// Session loading
// ================================================================

async function loadSessions() {
  try {
    const data = await _abi.getSessions();
    if (data && data.sessions && data.sessions.length) {
      _setApiStatus('live');
      _emit('sessionsLoaded', { sessions: data.sessions });
      return data.sessions;
    }
    _setApiStatus('live');
    return [];
  } catch (e) {
    console.error('[API] Failed to load sessions:', e);
    _setApiStatus('offline');
    return [];
  }
}

async function loadSession(sessionNumber) {
  try {
    const data = await _abi.getSession(sessionNumber);
    return data;
  } catch (e) {
    console.warn('[API] Failed to load session', sessionNumber, ':', e.message);
    return null;
  }
}

// ================================================================
// API status
// ================================================================

function _setApiStatus(status) {
  _apiStatus = status;
  _emit('apiStatusChanged', { status: status });
  if (_sessionUI) {
    _sessionUI.setApiStatus(status);
  }
}

function setApiStatus(status) {
  _setApiStatus(status);
}

function getApiStatus() {
  return _apiStatus;
}

// ================================================================
// Session lifecycle wiring
// ================================================================

/**
 * _abiStartSession — start ABI session on arrival.
 */
async function _abiStartSession(sessionNumber, sessionData) {
  if (_abiSessionActive) return;
  const sid = (sessionData && (sessionData.session_id || sessionData.session_key)) || ('s' + sessionNumber);
  console.log('[ABI] Starting:', sid);
  try {
    const r = await _abi.startSession(_userId, sid, { facility_mode: false });
    _abiSessionActive = true;
    _abiCoherencePeak = 0;
    _abiMirror = null;
    _abiAffirmation = null;
    _abiAdvancement = null;
    _lastKnownCoherence = 0.25;

    // Capture session content for TTS and phase dialogue
    if (r.session_content) {
      console.log('[SESSION] Content:', r.session_content.title || 'untitled');
    }

    if (r.session_blocked) {
      console.warn('[ABI] Session blocked:', r.luno_message);
      return false;
    }

    if (_stateMachine) {
      _stateMachine.setAbiSessionActive(true, _abi.sessionKey);
    }

    return true;
  } catch (e) {
    console.warn('[ABI] Start failed:', e.message || e);
    return false;
  }
}

/**
 * _abiForwardArrivalSample — forward biometric sample to ABI during arrival.
 */
async function _abiForwardArrivalSample(sample) {
  if (!_abiSessionActive) return;
  try {
    await _abi.arrivalSample(sample);
  } catch (e) {
    // Non-blocking — arrival samples can fail silently
  }
}

/**
 * _abiForwardArrivalComplete — forward arrival baseline to ABI.
 */
async function _abiForwardArrivalComplete(baseline) {
  if (!_abiSessionActive) return;
  try {
    const r = await _abi.arrivalComplete(baseline);
    const adapted = r.adapted_session || r;
    const mode = adapted._breathwork_mode || adapted.breathwork_mode || 'simple_pacer';
    const ratio = adapted.ratio || (r.breath_params && r.breath_params.ratio) || adapted.breath_ratio ||
      (adapted.breath_in && adapted.breath_out ? adapted.breath_in + ':' + adapted.breath_out : null) || '3:5';
    const track = adapted.track || 'standard';
    const arc = adapted._arc || adapted.arc || '';

    _abiModeConfig = getModeConfig(mode, ratio, track, { arc: arc });
    console.log('[ABI] Mode:', _abiModeConfig.mode, _abiModeConfig.ratio);

    // If user_chosen, show ratio selection
    if (_abiModeConfig.requires_selection && _abiModeConfig.available_ratios && _sessionUI) {
      _sessionUI.showRatioSelection(_abiModeConfig.available_ratios, function (selectedRatio) {
        _abiModeConfig = getModeConfig(_abiModeConfig.mode, selectedRatio, track);
      });
    }

    return _abiModeConfig;
  } catch (e) {
    console.warn('[ABI] Arrival complete error:', e.message || e);
    _abiModeConfig = getModeConfig('simple_pacer', '3:5', 'standard');
    return _abiModeConfig;
  }
}

/**
 * _abiStartTicks — begin sending ticks every 1s during breathing.
 */
function _abiStartTicks() {
  if (!_abiSessionActive) return;
  if (_tickInterval) return;
  console.log('[ABI] Starting ticks');
  let tickCount = 0;

  _tickInterval = setInterval(async function () {
    tickCount++;
    try {
      const bio = _biometricBridge ? _biometricBridge.getCurrentBiometrics() : {};
      // Apply server coherence feedback
      bio.coherence = _lastKnownCoherence;
      if (bio.coherence > _abiCoherencePeak) _abiCoherencePeak = bio.coherence;

      const r = await _abi.tick(bio);

      // Store coherence from tick response for next tick
      if (r.state && r.state.coherence !== undefined) _lastKnownCoherence = r.state.coherence;

      // Forward to biometric bridge for NS3 tracking
      if (_biometricBridge) _biometricBridge.updateFromTickResponse(r);

      // Visual adjustments
      if (r.adjustments && r.adjustments.visual_warmth !== undefined) {
        _emit('visualWarmthChanged', { warmth: r.adjustments.visual_warmth });
      }

      // Coaching intervention
      if (r.coaching && r.coaching.type === 'pause_and_choose') {
        _abiShowIntervention(r.coaching);
      }

      // Luno dialogue
      if (r.luno_dialogue) {
        _emit('lunoDialogue', { text: r.luno_dialogue });
      }
    } catch (e) {
      if (tickCount % 30 === 0) console.warn('[ABI] Tick err:', e.message || e);
    }
  }, 1000);
}

function _abiStopTicks() {
  if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
}

/**
 * _abiShowIntervention — handle coaching intervention from tick response.
 */
function _abiShowIntervention(coaching) {
  console.log('[ABI] Coaching:', coaching);
  _abiStopTicks();
  if (_stateMachine) _stateMachine.pauseSession();

  if (_sessionUI) {
    _sessionUI.showCoachingIntervention(coaching, async function (choice) {
      if (choice === 'continue') {
        try { await _abi.resume(); } catch (e) {}
        if (_stateMachine) _stateMachine.resumeSession();
        _abiStartTicks();
      } else if (choice === 'drill') {
        try {
          const dr = await _abi.selectDrill('five_senses');
          _emit('drillSelected', { drill: dr });
        } catch (e) {
          if (_stateMachine) _stateMachine.resumeSession();
        }
      } else if (choice === 'exit') {
        try { await _abi.exit(); } catch (e) {}
        _abiSessionActive = false;
        if (_stateMachine) _stateMachine.setAbiSessionActive(false);
        _notifyParentExit();
      }
    });
  }
}

/**
 * _abiCompleteSession — fire on shift phase.
 */
async function _abiCompleteSession() {
  if (!_abiSessionActive) return;
  _abiStopTicks();
  console.log('[ABI] Completing session');

  const state = _stateMachine ? _stateMachine.getSessionState() : {};
  const duration = state.durationSeconds || 0;

  const metrics = {
    coherence_peak: _abiCoherencePeak,
    coherence_end: _lastKnownCoherence,
    cycle_completion_rate: state.totalBreaths > 0 ? Math.min(1, state.breathCount / state.totalBreaths) : 0.85,
    breath_count: state.breathCount || 0,
    duration_seconds: duration
  };

  try {
    const r = await _abi.completeSession(metrics);
    console.log('[ABI] Complete result:', r);
    _abiMirror = r.mirror || null;
    _abiAffirmation = r.affirmation || null;
    _abiAdvancement = r.advancement || null;

    // Blockchain verify (fire and forget)
    _verifyOnChain(duration);
  } catch (e) {
    console.warn('[ABI] Complete error:', e.message || e);
  }

  _abiSessionActive = false;
  if (_stateMachine) _stateMachine.setAbiSessionActive(false);
}

function _abiCleanup() {
  _abiStopTicks();
  _abiSessionActive = false;
  _abiCoherencePeak = 0;
  _abiModeConfig = null;
  _lastKnownCoherence = 0.25;
  _abiMirror = null;
  _abiAffirmation = null;
  _abiAdvancement = null;
  if (_abi) _abi.sessionKey = null;
}

// ================================================================
// Vault wiring
// ================================================================

async function postVaultEntry(data) {
  try {
    const res = await fetch(_apiBase + '/api/fr/vault', {
      method: 'POST',
      headers: _getHeaders(),
      body: JSON.stringify({
        user_id: _userId,
        session_number: data.session_number || _activeSessionNumber,
        vault_response: data.text || '',
        session_type: 'individual'
      })
    });
    if (res.ok) {
      _emit('vaultPosted', { success: true });
    }
  } catch (e) {
    console.warn('[VAULT] Post failed:', e.message || e);
    // Non-blocking — continue to ascent
  }
}

// ================================================================
// Engagement / progress wiring
// ================================================================

async function postProgress(metrics) {
  try {
    const body = {
      user_id: _userId,
      session_number: metrics.sessionNumber || _activeSessionNumber,
      completed: true,
      coherence_score: metrics.coherencePeak || (_abiCoherencePeak > 0 ? _abiCoherencePeak : 0.5),
      duration_seconds: metrics.durationSeconds || 0,
      session_type: 'individual'
    };
    const res = await fetch(_apiBase + '/api/fr/progress', {
      method: 'POST',
      headers: _getHeaders(),
      body: JSON.stringify(body)
    });
    if (res.ok) {
      _emit('progressPosted', { success: true, sessionNumber: body.session_number });
    }
  } catch (e) {
    console.warn('[PROGRESS] Post failed:', e.message || e);
  }
}

// ================================================================
// Blockchain wiring (simulated)
// ================================================================

async function _verifyOnChain(duration) {
  try {
    await _abi.verifyOnChain({
      user_id: _userId,
      session_id: (_activeSessionData && _activeSessionData.session_id) || ('s' + _activeSessionNumber),
      coherence_peak: _abiCoherencePeak,
      duration: duration
    });
    console.log('[CHAIN] Session verified (simulated)');
    _emit('sessionVerified', { simulated: true });
  } catch (e) {
    // Fire and forget — non-blocking
    console.log('[CHAIN] Verify failed (non-blocking):', e.message || e);
  }
}

// ================================================================
// LightBridge hook (stub)
// ================================================================

async function activateLightBridge() {
  try {
    await _abi.activateLightBridge(_userId);
    console.log('[LIGHTBRIDGE] Activated (simulated)');
  } catch (e) {
    console.log('[LIGHTBRIDGE] Activation failed (non-blocking):', e.message || e);
  }
}

// ================================================================
// Co-Breathe hook (stub — not built)
// ================================================================

function toggleCoBreathe(enabled) {
  console.log('[CO-BREATHE] Not implemented — stub. enabled:', enabled);
  return null;
}

// ================================================================
// Breath Bridge hook (stub — not built)
// ================================================================

function showFamilyRecordingPrompt() {
  console.log('[BREATH_BRIDGE] Family recording not enabled — safety gate');
  return null;
}

// ================================================================
// Auth headers helper
// ================================================================

function _getHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (_abi && _abi.token) h['Authorization'] = 'Bearer ' + _abi.token;
  if (_abi && _abi.apiKey) h['x-api-key'] = _abi.apiKey;
  return h;
}

// ================================================================
// Event wiring — connect to all modules
// ================================================================

function connectToStateMachine(ssm) {
  _stateMachine = ssm;

  ssm.on('onPhaseChange', function (phase) {
    if (phase === 'arrival') {
      const state = ssm.getSessionState();
      _activeSessionNumber = state.sessionNumber;
      _activeSessionData = state.sessionData;
      _abiStartSession(state.sessionNumber, state.sessionData);
    }
    if (phase === 'breathing') {
      _abiStartTicks();
    }
    if (phase !== 'breathing') {
      _abiStopTicks();
    }
    if (phase === 'shift') {
      _abiCompleteSession();
    }
    if (phase === 'surface') {
      _abiCleanup();
    }
  });

  ssm.on('onSessionComplete', function (metrics) {
    postProgress({
      sessionNumber: metrics.sessionNumber,
      durationSeconds: metrics.durationSeconds,
      coherencePeak: _abiCoherencePeak
    });
    _notifyParentComplete(metrics.sessionNumber);
    if (_sessionUI) _sessionUI.markSessionComplete(metrics.sessionNumber);
    activateLightBridge();
  });

  ssm.on('onSessionReset', function () {
    _abiCleanup();
  });
}

function connectToBiometricBridge(bio) {
  _biometricBridge = bio;

  bio.on('arrivalSample', function (data) {
    _abiForwardArrivalSample(data.sample);
  });

  bio.on('arrivalComplete', function (baseline) {
    _abiForwardArrivalComplete(baseline);
  });
}

function connectToSessionUI(ui) {
  _sessionUI = ui;

  ui.on('vaultSealed', function (data) {
    postVaultEntry(data);
  });
}

// ================================================================
// Exports
// ================================================================

export {
  // Initialization
  initIntegrations,
  connectToStateMachine,
  connectToBiometricBridge,
  connectToSessionUI,

  // ABI service instance
  AbiService,

  // Session loading
  loadSessions,
  loadSession,

  // API actions
  postVaultEntry,
  postProgress,
  activateLightBridge,
  setApiStatus,
  getApiStatus,

  // Embedded mode
  isEmbedded,

  // Breathwork modes
  MODES,
  STATE_VISUALS,
  getModeConfig,
  getOrbitPosition,
  getCurrentPhaseBM as getCurrentPhase,

  // Stubs
  toggleCoBreathe,
  showFamilyRecordingPrompt,

  // Events
  on
};

// Also expose ABI instance getter for orchestrator
export function getAbi() { return _abi; }
export function getUserId() { return _userId; }
