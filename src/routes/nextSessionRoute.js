/**
 * GET /api/user/next-session — Determine next session for authenticated user
 */
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get('/next-session', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Get user participant_id
    const userResult = await pool.query(
      `SELECT id, participant_id, user_id FROM users WHERE id = $1 OR user_id = $2`,
      [parseInt(userId) || 0, userId]
    );
    const user = userResult.rows[0];
    const pid = user?.participant_id || user?.user_id || userId;

    const lastCompleted = await pool.query(
      `SELECT MAX(session_number) as last FROM session_completions
       WHERE (user_id = $1 OR user_id = $2) AND session_active = false`,
      [pid, user?.id?.toString() || '0']
    );
    const next = (lastCompleted.rows[0]?.last || 0) + 1;

    const session = await pool.query(
      'SELECT session_number, title, arc, duration_seconds FROM session_templates WHERE session_number = $1',
      [next]
    );

    res.json({
      next_session_number: next,
      title: session.rows[0]?.title || `Session ${next}`,
      arc: session.rows[0]?.arc || 'foundation',
      duration_minutes: Math.round((session.rows[0]?.duration_seconds || 720) / 60)
    });
  } catch (err) {
    console.error('[NEXT-SESSION] Error:', err);
    res.status(500).json({ error: 'Failed to determine next session' });
  }
});

module.exports = router;
