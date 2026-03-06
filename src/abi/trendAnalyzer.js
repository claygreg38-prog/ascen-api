// trendAnalyzer.js — Cross-session trend detection
// FIXED: uses shared pool instead of creating its own

const pool = require('../db/pool');

function shouldRunTrendAnalysis(sessionCount) { return sessionCount > 0 && sessionCount % 10 === 0; }

async function analyzeTrends(userId) {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') return { error: 'userId required' };
  if (!pool) return { error: 'No database connection' };
  try {
    const result = await pool.query(
      `SELECT session_number, coherence_score, cycle_completion_rate, active_duration_seconds, exit_type, created_at FROM session_completions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    if (result.rows.length < 5) return { insufficient_data: true };
    const rows = result.rows.reverse();
    const coherences = rows.map(r => r.coherence_score || 0);
    const mid = Math.floor(coherences.length / 2);
    const avgFirst = coherences.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const avgSecond = coherences.slice(mid).reduce((a, b) => a + b, 0) / (coherences.length - mid);
    const trend = avgSecond > avgFirst * 1.1 ? 'improving' : avgSecond < avgFirst * 0.9 ? 'declining' : 'stable';
    return { trend, coherence_avg: Math.round(((avgFirst + avgSecond) / 2) * 100) / 100, coherence_trend: { first_half: Math.round(avgFirst * 100) / 100, second_half: Math.round(avgSecond * 100) / 100 }, sessions_analyzed: rows.length, early_exits: rows.filter(r => r.exit_type === 'exit').length };
  } catch (err) { return { error: err.message }; }
}

module.exports = { analyzeTrends, shouldRunTrendAnalysis };
