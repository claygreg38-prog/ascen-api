// ============================================================
// preSessionIntelligence.js — Pre-session analysis
// HomeostaticRegulator enhancements: emotional load estimation,
// session pacing recommendations, stagnation intelligence
// ============================================================

class PreSessionIntelligence {
  constructor(userId, pool) {
    this.userId = userId;
    this.pool = pool;
  }

  /**
   * Comprehensive pre-session analysis.
   * Called during onSessionStart after homeostatic check passes.
   */
  async analyze() {
    const result = {
      emotional_load: 'unknown',
      pacing_recommendation: null,
      stagnation_intel: null,
      recent_pattern: null
    };

    try {
      // Recent session pattern (last 5)
      const recent = await this.pool.query(
        `SELECT coherence_score, coherence_end, exit_type, panic_event,
                active_duration_seconds, completed_at, breath_track_at_completion
         FROM session_completions
         WHERE user_id = $1
         ORDER BY completed_at DESC LIMIT 5`,
        [this.userId]
      );

      if (recent.rows.length > 0) {
        result.recent_pattern = this._analyzeRecentPattern(recent.rows);
        result.emotional_load = this._estimateEmotionalLoad(recent.rows);
        result.pacing_recommendation = this._getPacingRecommendation(recent.rows);
      }

      // Stagnation detection (30-day window)
      if (recent.rows.length >= 5) {
        result.stagnation_intel = await this._detectStagnation();
      }
    } catch (err) {
      console.error('[PreSessionIntelligence] Analysis failed (non-blocking):', err.message);
    }

    return result;
  }

  _analyzeRecentPattern(rows) {
    const avgCoherence = rows.reduce((s, r) => s + (parseFloat(r.coherence_score) || 0), 0) / rows.length;
    const panicCount = rows.filter(r => r.panic_event).length;
    const earlyExits = rows.filter(r => r.exit_type === 'exit' || r.exit_type === 'honorable_exit').length;

    return {
      avg_coherence: Math.round(avgCoherence * 1000) / 1000,
      panic_rate: panicCount / rows.length,
      early_exit_rate: earlyExits / rows.length,
      session_count: rows.length,
      trend: avgCoherence > 0.5 ? 'positive' : avgCoherence > 0.3 ? 'building' : 'struggling'
    };
  }

  _estimateEmotionalLoad(rows) {
    const panicCount = rows.filter(r => r.panic_event).length;
    const earlyExits = rows.filter(r => r.exit_type === 'exit').length;
    const avgCoherence = rows.reduce((s, r) => s + (parseFloat(r.coherence_end) || 0), 0) / rows.length;

    if (panicCount >= 2 || earlyExits >= 2) return 'high';
    if (avgCoherence < 0.3) return 'elevated';
    if (avgCoherence > 0.5) return 'low';
    return 'moderate';
  }

  _getPacingRecommendation(rows) {
    const lastSession = rows[0];
    if (!lastSession) return null;

    const hoursSince = lastSession.completed_at
      ? (Date.now() - new Date(lastSession.completed_at).getTime()) / (1000 * 60 * 60)
      : null;

    if (lastSession.panic_event) {
      return { pace: 'gentle', reason: 'Recent panic event — start with grounding' };
    }
    if (lastSession.exit_type === 'exit') {
      return { pace: 'shortened', reason: 'Last session ended early — reduce duration' };
    }
    if (hoursSince && hoursSince < 4) {
      return { pace: 'light', reason: 'Recent session — keep intensity low' };
    }
    return { pace: 'normal', reason: 'Ready for standard session' };
  }

  async _detectStagnation() {
    try {
      const thirtyDay = await this.pool.query(
        `SELECT AVG(coherence_score) as avg_30d,
                STDDEV(coherence_score) as std_30d,
                COUNT(*) as count_30d
         FROM session_completions
         WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '30 days'`,
        [this.userId]
      );

      const row = thirtyDay.rows[0];
      if (!row || parseInt(row.count_30d) < 10) return null;

      const avg = parseFloat(row.avg_30d) || 0;
      const std = parseFloat(row.std_30d) || 0;

      if (std < 0.05 && avg < 0.4) {
        return { detected: true, type: 'plateau', avg_coherence: avg, suggestion: 'Consider arc rotation or ratio adjustment' };
      }
      if (avg < 0.2 && parseInt(row.count_30d) > 20) {
        return { detected: true, type: 'declining', avg_coherence: avg, suggestion: 'Recommend clinician review' };
      }
      return { detected: false };
    } catch (err) {
      return null;
    }
  }
}

module.exports = { PreSessionIntelligence };
