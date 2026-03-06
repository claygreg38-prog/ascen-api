const STATES = { REGULATED: 'regulated', MILD_ACTIVATION: 'mild_activation', MODERATE_ACTIVATION: 'moderate_activation', HIGH_ACTIVATION: 'high_activation', FREEZE: 'freeze', FLOW: 'flow', DISSOCIATING: 'dissociating', UNKNOWN: 'unknown' };
const RESPONSE_LEVEL = { NONE: 0, AMBIENT: 1, GENTLE: 2, MODERATE: 3, INTERVENTION: 4 };

class StateEngine {
  constructor(config = {}) {
    this.currentState = STATES.UNKNOWN;
    this.previousState = STATES.UNKNOWN;
    this.baseline = null;
    this.stateHistory = [];
    this.tickCount = 0;
    this.stateTransitions = 0;
    this.config = { windowSize: config.windowSize || 10, ...config };
    this._window = [];
    this._hrvBuffer = [];
  }

  setBaseline(biometrics) {
    this.baseline = { heart_rate: biometrics.heart_rate || 72, respiratory_rate: biometrics.respiratory_rate || 14, hrv: biometrics.hrv || 45, coherence: biometrics.coherence || 0.25 };
    this.currentState = STATES.REGULATED;
  }

  tick(biometrics) {
    this.tickCount++;
    this._window.push(biometrics);
    if (this._window.length > this.config.windowSize) this._window.shift();
    if (biometrics.hrv !== undefined) { this._hrvBuffer.push({ value: biometrics.hrv, time: Date.now() }); if (this._hrvBuffer.length > 30) this._hrvBuffer.shift(); }

    this.previousState = this.currentState;
    this.currentState = this._classify(biometrics);
    if (this.currentState !== this.previousState) { this.stateTransitions++; this.stateHistory.push({ state: this.currentState, tick: this.tickCount, time: Date.now() }); }
    const responseLevel = this._getResponseLevel();
    return { state: this.currentState, previous_state: this.previousState, response_level: responseLevel, adjustments: this._getAdjustments(responseLevel), tick: this.tickCount };
  }

  _classify(bio) {
    if (!this.baseline) return STATES.UNKNOWN;
    const hr = bio.heart_rate || 72;
    const hrDelta = hr - (this.baseline.heart_rate || 72);
    const coherence = bio.coherence || 0;
    const rr = bio.respiratory_rate || 14;

    // Dissociation detection — FIXED: uses null check for variance
    const hrvVariance = this._bufferVariance(this._hrvBuffer);
    if (hrDelta <= -15 && hrvVariance !== null && hrvVariance < 0.5 && rr < 10) return STATES.DISSOCIATING;

    if (coherence > 0.7 && Math.abs(hrDelta) < 5) return STATES.FLOW;
    if (hrDelta > 30) return STATES.HIGH_ACTIVATION;
    if (hrDelta > 15) return STATES.MODERATE_ACTIVATION;
    if (hrDelta > 8) return STATES.MILD_ACTIVATION;
    if (hr < 55 && coherence < 0.2) return STATES.FREEZE;
    return STATES.REGULATED;
  }

  // FIXED: returns null for insufficient data instead of 0
  _bufferVariance(buffer) {
    if (!buffer || buffer.length < 2) return null;
    const vals = buffer.map(b => b.value !== undefined ? b.value : b);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / vals.length;
  }

  _getResponseLevel() {
    switch (this.currentState) {
      case STATES.HIGH_ACTIVATION: return RESPONSE_LEVEL.INTERVENTION;
      case STATES.MODERATE_ACTIVATION: return RESPONSE_LEVEL.MODERATE;
      case STATES.MILD_ACTIVATION: return RESPONSE_LEVEL.GENTLE;
      case STATES.FREEZE: return RESPONSE_LEVEL.MODERATE;
      case STATES.DISSOCIATING: return RESPONSE_LEVEL.INTERVENTION;
      case STATES.FLOW: return RESPONSE_LEVEL.NONE;
      case STATES.REGULATED: return RESPONSE_LEVEL.NONE;
      default: return RESPONSE_LEVEL.AMBIENT;
    }
  }

  _getAdjustments(level) {
    if (level <= RESPONSE_LEVEL.NONE) return {};
    return { exhale_extend: level >= RESPONSE_LEVEL.GENTLE ? 1 + (level * 0.5) : 0, visual_warmth: Math.min(1, level * 0.25), pacer_slow: level >= RESPONSE_LEVEL.MODERATE ? 0.85 : 1, luno_pulse_slow: level >= RESPONSE_LEVEL.GENTLE };
  }

  getSessionSummary() {
    const stateCounts = {};
    this.stateHistory.forEach(s => { stateCounts[s.state] = (stateCounts[s.state] || 0) + 1; });
    // Calculate coherence std dev for gaming detection
    const coherences = this._window.map(w => w.coherence || 0).filter(c => c > 0);
    let coherence_std_dev = null;
    if (coherences.length >= 2) {
      const avg = coherences.reduce((a, b) => a + b, 0) / coherences.length;
      coherence_std_dev = Math.sqrt(coherences.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / coherences.length);
    }
    return { total_ticks: this.tickCount, state_transitions: this.stateTransitions, dominant_state: this.currentState, state_distribution: stateCounts, time_in_flow: (stateCounts[STATES.FLOW] || 0), time_in_activation: (stateCounts[STATES.HIGH_ACTIVATION] || 0) + (stateCounts[STATES.MODERATE_ACTIVATION] || 0), coherence_std_dev };
  }
}

module.exports = { StateEngine, STATES, RESPONSE_LEVEL };
