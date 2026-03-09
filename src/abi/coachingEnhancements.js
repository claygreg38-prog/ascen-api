// ============================================================
// coachingEnhancements.js — Effectiveness tracking
// Tracks whether coaching interventions actually helped.
// ============================================================

class CoachingEffectivenessTracker {
  constructor() {
    this.interventions = [];
    this.currentIntervention = null;
  }

  /**
   * Record a coaching intervention and track its outcome.
   */
  recordIntervention(type, stateBefore) {
    this.currentIntervention = {
      type,
      state_before: stateBefore,
      state_after: null,
      tick_at: Date.now(),
      ticks_to_resolve: null,
      effective: null
    };
    this.interventions.push(this.currentIntervention);
  }

  /**
   * Called each tick after an intervention to track resolution.
   */
  onTick(currentState, responseLevel) {
    if (!this.currentIntervention) return;
    if (this.currentIntervention.state_after) return; // Already resolved

    const ticksSince = Date.now() - this.currentIntervention.tick_at;
    const secondsSince = ticksSince / 1000;

    // Resolved if state improved within 60 seconds
    if (responseLevel <= 1 && secondsSince > 5) {
      this.currentIntervention.state_after = currentState;
      this.currentIntervention.ticks_to_resolve = Math.round(secondsSince);
      this.currentIntervention.effective = true;
      this.currentIntervention = null;
    } else if (secondsSince > 60) {
      // Timed out — intervention didn't resolve
      this.currentIntervention.state_after = currentState;
      this.currentIntervention.ticks_to_resolve = Math.round(secondsSince);
      this.currentIntervention.effective = false;
      this.currentIntervention = null;
    }
  }

  getSummary() {
    const resolved = this.interventions.filter(i => i.effective !== null);
    const effective = resolved.filter(i => i.effective);
    return {
      total_interventions: this.interventions.length,
      resolved: resolved.length,
      effective: effective.length,
      effectiveness_rate: resolved.length > 0
        ? Math.round((effective.length / resolved.length) * 100) / 100
        : null,
      avg_resolution_time: effective.length > 0
        ? Math.round(effective.reduce((s, i) => s + i.ticks_to_resolve, 0) / effective.length)
        : null
    };
  }
}

module.exports = { CoachingEffectivenessTracker };
