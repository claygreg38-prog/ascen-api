// ============================================================
// crossSystemSynergy.js — Combined risk scoring
// Aggregates signals from state, coaching, immune, and
// biometric systems into a single risk profile.
// ============================================================

class CrossSystemSynergy {
  constructor() {
    this.signals = [];
  }

  /**
   * Compute combined risk score from all system signals.
   * Returns 0-1 where higher = more risk.
   */
  computeRiskScore(params) {
    const {
      stateResult,
      coachingResult,
      immuneScan,
      biometricAnnotation,
      pauseCount,
      panicEvent
    } = params;

    let score = 0;
    const factors = [];

    // State engine contribution (0-0.3)
    if (stateResult) {
      const stateWeight = {
        high_activation: 0.3,
        dissociating: 0.3,
        moderate_activation: 0.15,
        freeze: 0.2,
        mild_activation: 0.05,
        regulated: 0,
        flow: 0,
        unknown: 0.1
      };
      const sw = stateWeight[stateResult.state] || 0;
      score += sw;
      if (sw > 0) factors.push({ source: 'state', value: sw, detail: stateResult.state });
    }

    // Coaching contribution (0-0.2)
    if (coachingResult?.action === 'intervention') {
      score += 0.2;
      factors.push({ source: 'coaching', value: 0.2, detail: 'intervention_triggered' });
    }

    // Immune contribution (0-0.2)
    if (immuneScan?.flags?.length > 0) {
      const immuneScore = Math.min(0.2, immuneScan.flags.length * 0.05);
      score += immuneScore;
      factors.push({ source: 'immune', value: immuneScore, detail: `${immuneScan.flags.length}_flags` });
    }

    // Biometric contribution (0-0.15)
    if (biometricAnnotation?.source === 'none') {
      score += 0.05;
      factors.push({ source: 'biometric', value: 0.05, detail: 'no_biometric_source' });
    }

    // Behavioral contribution (0-0.15)
    if (panicEvent) {
      score += 0.1;
      factors.push({ source: 'behavioral', value: 0.1, detail: 'panic_event' });
    }
    if (pauseCount > 3) {
      score += 0.05;
      factors.push({ source: 'behavioral', value: 0.05, detail: 'excessive_pauses' });
    }

    this.signals.push({ score: Math.min(1, score), factors, timestamp: Date.now() });

    return {
      risk_score: Math.round(Math.min(1, score) * 100) / 100,
      risk_level: score > 0.6 ? 'high' : score > 0.3 ? 'moderate' : score > 0.1 ? 'low' : 'minimal',
      factors,
      recommendation: this._getRecommendation(score)
    };
  }

  _getRecommendation(score) {
    if (score > 0.6) return 'Consider session termination or immediate grounding drill';
    if (score > 0.3) return 'Increase coaching frequency and extend exhale';
    if (score > 0.1) return 'Monitor — ambient support sufficient';
    return 'No intervention needed';
  }

  getSessionRiskProfile() {
    if (this.signals.length === 0) return { peak: 0, avg: 0, trend: 'stable' };
    const scores = this.signals.map(s => s.risk_score);
    const peak = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const recent = scores.slice(-10);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = scores.slice(0, -10).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 10);
    return {
      peak: Math.round(peak * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      trend: recentAvg > olderAvg + 0.05 ? 'increasing' : recentAvg < olderAvg - 0.05 ? 'decreasing' : 'stable'
    };
  }
}

module.exports = { CrossSystemSynergy };
