// ============================================================
// postSessionIntelligence.js — Post-session analysis
// Aggregates cross-system data after session completion.
// Feeds AXIS with enriched insights.
// ============================================================

class PostSessionIntelligence {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Run post-session analysis after all systems have reported.
   * Called in onSessionComplete after metrics are saved.
   */
  async analyze(sessionData) {
    const {
      userId, sessionId, sessionNumber,
      cleanMetrics, stateSummary, coachingSummary,
      immuneScan, sessionPacket, arrivalBaseline, breathParamsResult
    } = sessionData;

    const result = {
      session_quality: 'unknown',
      regulation_efficiency: null,
      breath_adaptation_score: null,
      risk_flags: [],
      growth_indicators: []
    };

    try {
      // Session quality classification
      result.session_quality = this._classifyQuality(cleanMetrics, stateSummary);

      // Regulation efficiency
      if (sessionPacket?.timeToRegulationSec !== null && sessionPacket?.timeToRegulationSec !== undefined) {
        const totalSec = cleanMetrics?.active_duration_seconds || 300;
        result.regulation_efficiency = totalSec > 0
          ? Math.round((1 - (sessionPacket.timeToRegulationSec / totalSec)) * 100) / 100
          : null;
      }

      // Breath adaptation score
      if (breathParamsResult) {
        result.breath_adaptation_score = this._scoreAdaptation(breathParamsResult, cleanMetrics);
      }

      // Risk flags
      result.risk_flags = this._detectRisks(cleanMetrics, stateSummary, immuneScan);

      // Growth indicators
      result.growth_indicators = this._detectGrowth(cleanMetrics, stateSummary, coachingSummary);

    } catch (err) {
      console.error('[PostSessionIntelligence] Analysis failed (non-blocking):', err.message);
    }

    return result;
  }

  _classifyQuality(metrics, stateSummary) {
    if (!metrics) return 'unknown';
    const coherence = metrics.adjusted_cycle_completion_rate || metrics.cycle_completion_rate || 0;
    const exitType = metrics.exit_type || 'normal';

    if (exitType === 'exit') return 'incomplete';
    if (exitType === 'honorable_exit') return 'regulated_exit';
    if (metrics.panic_event) return 'recovery';
    if (coherence > 0.7) return 'excellent';
    if (coherence > 0.5) return 'good';
    if (coherence > 0.3) return 'building';
    return 'foundational';
  }

  _scoreAdaptation(breathParams, metrics) {
    if (!breathParams || !metrics) return null;
    const confidence = breathParams.confidence || 0.5;
    const completion = metrics.adjusted_cycle_completion_rate || metrics.cycle_completion_rate || 0;
    // High confidence + high completion = good adaptation
    return Math.round((confidence * 0.4 + completion * 0.6) * 100) / 100;
  }

  _detectRisks(metrics, stateSummary, immuneScan) {
    const flags = [];
    if (metrics?.panic_event) flags.push('panic_event');
    if (metrics?.exit_type === 'exit' && (metrics?.active_duration_seconds || 0) < 60) {
      flags.push('very_early_exit');
    }
    if (stateSummary?.dominant_state === 'dissociating') flags.push('dissociation_detected');
    if (stateSummary?.time_in_activation > (stateSummary?.total_ticks || 1) * 0.5) {
      flags.push('prolonged_activation');
    }
    if (immuneScan?.flags?.length > 2) flags.push('multiple_immune_flags');
    return flags;
  }

  _detectGrowth(metrics, stateSummary, coachingSummary) {
    const indicators = [];
    const completion = metrics?.adjusted_cycle_completion_rate || metrics?.cycle_completion_rate || 0;
    if (completion > 0.8) indicators.push('high_completion');
    if (stateSummary?.time_in_flow > 0) indicators.push('flow_achieved');
    if (coachingSummary?.max_sustained_regulation_sec > 120) indicators.push('sustained_regulation');
    if (coachingSummary?.total_interventions === 0) indicators.push('zero_interventions');
    return indicators;
  }
}

module.exports = { PostSessionIntelligence };
