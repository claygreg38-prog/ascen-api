// ============================================================
// axisEngine.js — AXIS Brain Stem
// Aggregates anonymized session data across all users.
// Learns what works for whom. Pushes intelligence back.
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
      // If axis_sessions table doesn't exist yet, fail silently
      console.error('AXIS ingest (non-blocking):', err.message);
      return { ingested: false, error: err.message };
    }
  }

  // ── REFINE: Nightly batch ────────────────────────────────
  async runRefinementCycle() {
    const results = { protocols_analyzed: 0, recommendations: [] };
    try {
      // Analyze by arc × track combination
      const arcTrackStats = await this.pool.query(
        `SELECT arc, track, mode,
           COUNT(*) as session_count,
           AVG(coherence_peak) as avg_coherence,
           AVG(cycle_completion_rate) as avg_completion,
           AVG(active_duration_seconds) as avg_duration,
           SUM(CASE WHEN panic_event THEN 1 ELSE 0 END) as panic_count,
           SUM(CASE WHEN exit_type = 'exit' THEN 1 ELSE 0 END) as early_exits
         FROM axis_sessions
         WHERE ingested_at > NOW() - INTERVAL '30 days'
         GROUP BY arc, track, mode
         ORDER BY avg_coherence DESC`
      );

      results.protocols_analyzed = arcTrackStats.rows.length;

      for (const row of arcTrackStats.rows) {
        if (row.session_count >= 10 && row.avg_completion < 0.5) {
          results.recommendations.push({
            arc: row.arc, track: row.track, mode: row.mode,
            issue: 'low_completion',
            suggestion: 'Consider duration reduction or ratio simplification',
            avg_completion: parseFloat(row.avg_completion)
          });
        }
      }

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

      // Find optimal ratio from population data for this track
      const userTrack = await this.pool.query(
        `SELECT breath_track FROM users WHERE user_id = $1`,
        [userId]
      );
      const track = userTrack.rows[0]?.breath_track || 'standard';

      return {
        user_id: userId,
        generated_at: new Date().toISOString(),
        track,
        user_stats: userStats.rows,
        optimal_ratio: null, // Populated after sufficient data
        track_trajectory: this._calcTrajectory(userStats.rows),
        coaching_bias: 'neutral'
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
