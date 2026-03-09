// ============================================================
// stateEngineEnhancements.js — Zone time tracking, coherence momentum
// Extends StateEngine with additional analytics capabilities.
// ============================================================

/**
 * Zone time tracker — accumulates seconds in each state.
 * Attached to StateEngine via composition.
 */
class ZoneTimeTracker {
  constructor() {
    this.zones = {};
    this.currentZone = null;
    this.zoneStartTick = 0;
    this.totalTicks = 0;
  }

  onTick(state, tick) {
    this.totalTicks = tick;
    if (state !== this.currentZone) {
      if (this.currentZone) {
        const duration = tick - this.zoneStartTick;
        this.zones[this.currentZone] = (this.zones[this.currentZone] || 0) + duration;
      }
      this.currentZone = state;
      this.zoneStartTick = tick;
    }
  }

  finalize(tick) {
    if (this.currentZone) {
      const duration = tick - this.zoneStartTick;
      this.zones[this.currentZone] = (this.zones[this.currentZone] || 0) + duration;
    }
    return { ...this.zones };
  }

  getProfile() {
    return { ...this.zones };
  }
}

/**
 * Coherence momentum tracker — detects acceleration/deceleration.
 */
class CoherenceMomentum {
  constructor(windowSize = 30) {
    this.buffer = [];
    this.windowSize = windowSize;
    this.momentum = 0;
    this.peakMomentum = 0;
  }

  update(coherence) {
    this.buffer.push(coherence);
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    if (this.buffer.length < 3) return 0;

    // Simple momentum: difference between recent avg and older avg
    const mid = Math.floor(this.buffer.length / 2);
    const recentAvg = this.buffer.slice(mid).reduce((a, b) => a + b, 0) / (this.buffer.length - mid);
    const olderAvg = this.buffer.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    this.momentum = recentAvg - olderAvg;
    this.peakMomentum = Math.max(this.peakMomentum, this.momentum);
    return this.momentum;
  }

  getSummary() {
    return {
      current_momentum: Math.round(this.momentum * 1000) / 1000,
      peak_momentum: Math.round(this.peakMomentum * 1000) / 1000,
      direction: this.momentum > 0.02 ? 'accelerating' : this.momentum < -0.02 ? 'decelerating' : 'stable'
    };
  }
}

module.exports = { ZoneTimeTracker, CoherenceMomentum };
