// ============================================================
// pauseHandler.js — Session pause management
// Tracks active vs paused time, auto-detects coughs/sneezes,
// manages extended pause → exit flow
// ============================================================

const PAUSE_STATE = { ACTIVE: 'active', PAUSED: 'paused', EXTENDED_PAUSE: 'extended_pause', EXITING: 'exiting' };

class PauseHandler {
  constructor(config = {}) {
    this.state = PAUSE_STATE.ACTIVE;
    this.pauseCount = 0;
    this.totalPauseDuration = 0;
    this.extendedPauseCount = 0;
    this.startTime = Date.now();
    this.pauseStartTime = null;
    this.activeDuration = 0;
    this.lastTickTime = Date.now();
    this.config = {
      extendedPauseThreshold: config.extendedPauseThreshold || 120,
      coughDetectionWindow: config.coughDetectionWindow || 3,
      maxPausesBeforeExit: config.maxPausesBeforeExit || 5,
      ...config
    };
  }

  tick(biometrics = {}) {
    const now = Date.now();
    if (this.state === PAUSE_STATE.ACTIVE) {
      this.activeDuration += (now - this.lastTickTime) / 1000;
    }
    this.lastTickTime = now;
    return { state: this.state, active_seconds: this.activeDuration };
  }

  checkForInterrupt(biometrics = {}) {
    // Detect sudden HRV spike (cough/sneeze) — auto-pause 3s
    if (biometrics.hrv_spike && biometrics.hrv_spike > 80) {
      return { interrupt: true, type: 'cough_detected', auto_resume_seconds: this.config.coughDetectionWindow };
    }
    return { interrupt: false };
  }

  pause() {
    if (this.state !== PAUSE_STATE.ACTIVE) return;
    this.state = PAUSE_STATE.PAUSED;
    this.pauseStartTime = Date.now();
    this.pauseCount++;
  }

  resume() {
    if (this.state === PAUSE_STATE.PAUSED || this.state === PAUSE_STATE.EXTENDED_PAUSE) {
      this.totalPauseDuration += (Date.now() - this.pauseStartTime) / 1000;
      this.state = PAUSE_STATE.ACTIVE;
      this.pauseStartTime = null;
    }
  }

  exit() {
    this.state = PAUSE_STATE.EXITING;
    if (this.pauseStartTime) {
      this.totalPauseDuration += (Date.now() - this.pauseStartTime) / 1000;
    }
  }

  getActiveSeconds() { return Math.round(this.activeDuration); }
  getTotalPauses() { return this.pauseCount; }
  shouldOfferExit() { return this.pauseCount >= this.config.maxPausesBeforeExit; }

  getCleanMetrics(rawMetrics = {}) {
    return {
      ...rawMetrics,
      active_duration_seconds: this.getActiveSeconds(),
      total_pauses: this.pauseCount,
      total_pause_duration: Math.round(this.totalPauseDuration),
      extended_pauses: this.extendedPauseCount,
      exit_type: this.state === PAUSE_STATE.EXITING ? 'exit' : 'normal',
      adjusted_cycle_completion_rate: rawMetrics.cycle_completion_rate || 0,
      mirror_pause_note: this.pauseCount > 2
        ? `You paused ${this.pauseCount} times. That's listening to your body.`
        : null
    };
  }
}

module.exports = { PauseHandler, PAUSE_STATE };
