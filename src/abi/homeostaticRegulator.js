// homeostaticRegulator.js — Dosage control
// FIXED: gap message, standard track stagnation, userId validation, SELECT columns

class HomeostaticRegulator {
  constructor(userId, pool) {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') throw new Error('HomeostaticRegulator: userId required');
    this.userId = userId;
    this.pool = pool;
  }

  async preSessionCheck() {
    try {
      // FIXED: SELECT specific columns, not *
      const userResult = await this.pool.query(
        `SELECT user_id, breath_track, total_sessions_completed, created_at FROM users WHERE user_id = $1`,
        [this.userId]
      );
      const user = userResult.rows[0];

      const result = await this.pool.query(
        `SELECT COUNT(*) as count, MAX(completed_at) as last_completed
         FROM session_completions WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '24 hours'`,
        [this.userId]
      );
      const sessionsToday = parseInt(result.rows[0]?.count || 0);
      const lastCompleted = result.rows[0]?.last_completed;

      // Dosage limit
      if (sessionsToday >= 3) {
        return { allowed: false, reason: 'daily_limit', luno_message: "Your body is asking for rest today. That wisdom is strength.", suggestion: 'rest' };
      }

      // FIXED: separate gap-block message (was reusing daily limit message)
      if (lastCompleted) {
        const hoursSince = (Date.now() - new Date(lastCompleted).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 2) {
          return { allowed: false, reason: 'min_gap', luno_message: "Your nervous system needs a little more time between sessions. Come back in a bit.", suggestion: 'wait' };
        }
      }

      // Stagnation check — FIXED: no longer excludes standard track
      if (user && user.total_sessions_completed > 30) {
        const recentCoherence = await this.pool.query(
          `SELECT AVG(coherence_score) as avg FROM session_completions WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '30 days'`,
          [this.userId]
        );
        const avg = parseFloat(recentCoherence.rows[0]?.avg || 0);
        const track = user.breath_track || 'standard';
        // Standard users get a longer plateau window before flagging
        const plateauThreshold = track === 'standard' ? 50 : 30;
        if (user.total_sessions_completed > plateauThreshold && avg < 0.2) {
          return { allowed: true, warning: true, stagnation: true, luno_message: "Your numbers show you might benefit from a different approach. Luno will adjust." };
        }
      }

      return { allowed: true, sessions_today: sessionsToday };
    } catch (err) {
      return { allowed: true }; // Fail open
    }
  }
}

module.exports = { HomeostaticRegulator };
