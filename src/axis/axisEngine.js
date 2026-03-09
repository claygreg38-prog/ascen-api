// ============================================================
// axisEngine.js — AXIS Brain Stem (enhanced)
// Value Engine integration, expanded refinement queries
// Three operations: Ingest, Refine, Distribute
// ============================================================

class AxisEngine {
  constructor(pool) {
    this.pool = pool;
  }

  // ── INGEST: After every session ──────────────────────────
  async ingestSessionData(data) {
    try {
      await this.pool.query(
        `INSERT INTO axis_sessions (
          user_id, session_id, session_number, track, arc, mode,
          coherence_peak, coherence_end, cycle_completion_rate,
          active_duration_seconds, pause_count, panic_event, exit_type,
          state_summary, coaching_summary, ingested_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
        [
          data.user_id, data.session_id, data.session_number,
          data.track, data.arc, data.mode,
          data.coherence_peak, data.coherence_end, data.cycle_completion_rate,
          data.active_duration_seconds, data.pause_count, data.panic_event, data.exit_type,
          JSON.stringify(data.state_summary || {}), JSON.stringify(data.coaching_summary || {})
        ]
      );
      return { ingested: true };
    } catch (err) {
      console.error('AXIS ingest (non-blocking):', err.message);
      return { ingested: false, error: err.message };
    }
  }

  // ── REFINE: Nightly batch (expanded) ───────────────────────
  async runRefinementCycle() {
    const results = { protocols_analyzed: 0, recommendations: [], value_metrics: null };
    try {
      // Analyze by arc × track combination
      const arcTrackStats = await this.pool.query(
        `SELECT arc, track, mode,
           COUNT(*) as session_count,
           AVG(coherence_peak) as avg_coherence,
           AVG(coherence_end) as avg_coherence_end,
           AVG(cycle_completion_rate) as avg_completion,
           AVG(active_duration_seconds) as avg_duration,
           SUM(CASE WHEN panic_event THEN 1 ELSE 0 END) as panic_count,
           SUM(CASE WHEN exit_type = 'exit' THEN 1 ELSE 0 END) as early_exits,
           SUM(CASE WHEN exit_type = 'honorable_exit' THEN 1 ELSE 0 END) as honorable_exits
         FROM axis_sessions
         WHERE ingested_at > NOW() - INTERVAL '30 days'
         GROUP BY arc, track, mode
         ORDER BY avg_coherence DESC`
      );

      results.protocols_analyzed = arcTrackStats.rows.length;

      for (const row of arcTrackStats.rows) {
        if (row.session_count >= 10 && parseFloat(row.avg_completion) < 0.5) {
          results.recommendations.push({
            arc: row.arc, track: row.track, mode: row.mode,
            issue: 'low_completion',
            suggestion: 'Consider duration reduction or ratio simplification',
            avg_completion: parseFloat(row.avg_completion)
          });
        }
        if (row.session_count >= 10 && parseInt(row.panic_count) > row.session_count * 0.2) {
          results.recommendations.push({
            arc: row.arc, track: row.track, mode: row.mode,
            issue: 'high_panic_rate',
            suggestion: 'Review ratio floor and coaching intervention threshold',
            panic_rate: parseInt(row.panic_count) / parseInt(row.session_count)
          });
        }
      }

      // Coherence trajectory analysis (population-level)
      try {
        const trajectoryStats = await this.pool.query(
          `SELECT coherence_trajectory, COUNT(*) as cnt
           FROM session_completions
           WHERE completed_at > NOW() - INTERVAL '30 days'
             AND coherence_trajectory IS NOT NULL
           GROUP BY coherence_trajectory`
        );
        results.coherence_trajectories = trajectoryStats.rows;
      } catch (e) { /* non-blocking */ }

      // Value Engine metrics
      try {
        results.value_metrics = await this.computeValueMetrics();
      } catch (e) { /* non-blocking */ }

      // Store refinement results
      await this.pool.query(
        `INSERT INTO axis_refinements (results, refined_at) VALUES ($1, NOW())`,
        [JSON.stringify(results)]
      ).catch(() => {});

    } catch (err) {
      console.error('AXIS refinement (non-blocking):', err.message);
      results.error = err.message;
    }
    return results;
  }

  // ── VALUE ENGINE METRICS ──────────────────────────────────
  async computeValueMetrics() {
    try {
      const totals = await this.pool.query(
        `SELECT
           COUNT(DISTINCT user_id) as total_users,
           COUNT(*) as total_sessions,
           AVG(coherence_peak) as avg_coherence,
           SUM(active_duration_seconds) as total_breath_seconds,
           COUNT(CASE WHEN packet_hash IS NOT NULL THEN 1 END) as attested_sessions,
           COUNT(CASE WHEN attestation_submitted THEN 1 END) as on_chain_attestations
         FROM session_completions
         WHERE completed_at > NOW() - INTERVAL '30 days'`
      );
      const row = totals.rows[0] || {};
      return {
        period: '30d',
        total_users: parseInt(row.total_users) || 0,
        total_sessions: parseInt(row.total_sessions) || 0,
        avg_coherence: parseFloat(row.avg_coherence) || 0,
        total_breath_minutes: Math.round((parseInt(row.total_breath_seconds) || 0) / 60),
        attested_sessions: parseInt(row.attested_sessions) || 0,
        on_chain_attestations: parseInt(row.on_chain_attestations) || 0
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ── DISTRIBUTE: Per-user context packets ─────────────────
  async generateContextPacket(userId) {
    try {
      const userStats = await this.pool.query(
        `SELECT arc, track, mode,
           AVG(coherence_peak) as avg_coherence,
           AVG(cycle_completion_rate) as avg_completion,
           COUNT(*) as session_count
         FROM axis_sessions
         WHERE user_id = $1 AND ingested_at > NOW() - INTERVAL '90 days'
         GROUP BY arc, track, mode`,
        [userId]
      );

      const userTrack = await this.pool.query(
        `SELECT breath_track FROM users WHERE user_id = $1`,
        [userId]
      );
      const track = userTrack.rows[0]?.breath_track || 'standard';

      // Coaching bias from recent patterns
      const coachingBias = this._deriveCoachingBias(userStats.rows);

      return {
        user_id: userId,
        generated_at: new Date().toISOString(),
        track,
        user_stats: userStats.rows,
        optimal_ratio: null,
        track_trajectory: this._calcTrajectory(userStats.rows),
        coaching_bias: coachingBias
      };
    } catch (err) {
      return { user_id: userId, error: err.message };
    }
  }

  _calcTrajectory(stats) {
    if (!stats || stats.length === 0) return 'new_user';
    const avgCoherence = stats.reduce((s, r) => s + parseFloat(r.avg_coherence || 0), 0) / stats.length;
    if (avgCoherence > 0.6) return 'advancing';
    if (avgCoherence > 0.35) return 'stable';
    return 'building';
  }

  _deriveCoachingBias(stats) {
    if (!stats || stats.length === 0) return 'neutral';
    const avgCompletion = stats.reduce((s, r) => s + parseFloat(r.avg_completion || 0), 0) / stats.length;
    if (avgCompletion < 0.4) return 'supportive';
    if (avgCompletion > 0.8) return 'progressive';
    return 'neutral';
  }

  // ── DASHBOARD: Protocol analysis ─────────────────────────
  async getProtocolAnalysis() {
    try {
      const result = await this.pool.query(
        `SELECT arc, track, mode,
           COUNT(*) as session_count,
           ROUND(AVG(coherence_peak)::numeric, 3) as avg_coherence,
           ROUND(AVG(cycle_completion_rate)::numeric, 3) as avg_completion,
           ROUND(AVG(active_duration_seconds)::numeric, 0) as avg_duration
         FROM axis_sessions
         GROUP BY arc, track, mode
         ORDER BY session_count DESC`
      );
      return { protocols: result.rows };
    } catch (err) {
      return { protocols: [], error: err.message };
    }
  }
}

module.exports = { AxisEngine };
