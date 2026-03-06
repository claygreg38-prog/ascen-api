// coachingEngine.js — Graduated coaching system
// FIXED: syntax error, sustained regulation calc, dual require

const { adaptDrill, filterDrillRecommendation } = require('./drillAdapter'); // FIXED: consolidated at top

class CoachingEngine {
  constructor(config = {}) {
    this.interventionCount = 0;
    this.coachingEvents = [];
    this.lastIntervention = null;
    this.sustainedRegulatedStart = 0;
    this.maxSustainedRegulationSec = 0; // FIXED: track max explicitly
    this.config = { interventionCooldown: config.interventionCooldown || 60, ambientThreshold: config.ambientThreshold || 0.3, ...config };
    this.isFR = config.isFR || false;
    this.frBlock = config.frBlock || null;
    this.sessionNumber = config.sessionNumber || 0;
  }

  evaluate(stateResult, biometrics, sessionContext) {
    const { state, response_level } = stateResult;
    const now = Date.now();

    // Track sustained regulation — FIXED: store max on exit
    if (state === 'regulated' || state === 'flow') {
      if (this.sustainedRegulatedStart === 0) this.sustainedRegulatedStart = now;
    } else {
      if (this.sustainedRegulatedStart > 0) {
        this.maxSustainedRegulationSec = Math.max(this.maxSustainedRegulationSec, Math.floor((now - this.sustainedRegulatedStart) / 1000));
      }
      this.sustainedRegulatedStart = 0;
    }

    if (this.lastIntervention && (now - this.lastIntervention) < this.config.interventionCooldown * 1000) {
      return { action: 'continue', coaching: null };
    }

    if (response_level >= 4) {
      this.interventionCount++;
      this.lastIntervention = now;
      this.coachingEvents.push({ type: 'intervention', state, time: now });
      return { action: 'intervention', coaching: { type: 'pause_and_choose', message: "Let's pause here. Your body is asking for something.", options: ['continue', 'grounding_drill', 'honorable_exit'] } };
    }
    if (response_level >= 3) {
      this.coachingEvents.push({ type: 'coaching_cue', state, time: now });
      return { action: 'coaching_cue', coaching: { type: 'verbal', message: 'Soften the exhale. Let it be easy.' } };
    }
    if (response_level >= 2) return { action: 'ambient', coaching: { type: 'exhale_extend', extend_by: 1 } };
    return { action: 'continue', coaching: null };
  }

  getPredictivePreFrame(session, userHistory) {
    const arc = session._arc || '';
    if (arc === 'grief' || arc === 'deeper_grief') return { pre_frame: true, message: "This session touches deeper waters. Your breath is your anchor." };
    // FR repair block — FIXED: session range check
    if (this.isFR && this.frBlock === 'repair' && this.sessionNumber >= 6 && this.sessionNumber <= 10) {
      return { pre_frame: true, message: "This session may bring up difficult feelings. That's expected. Your breath holds you." };
    }
    return { pre_frame: false };
  }

  getPostDrillOptions() { return { options: ['return_to_session', 'end_session'], message: "Ready to return, or is this enough for today?" }; }

  getCoachingSummary() {
    // FIXED: use stored max, not live calculation
    if (this.sustainedRegulatedStart > 0) {
      this.maxSustainedRegulationSec = Math.max(this.maxSustainedRegulationSec, Math.floor((Date.now() - this.sustainedRegulatedStart) / 1000));
    }
    return { total_interventions: this.interventionCount, total_events: this.coachingEvents.length, events: this.coachingEvents.slice(-10), max_sustained_regulation_sec: this.maxSustainedRegulationSec };
  }
}

module.exports = { CoachingEngine };
