// ============================================================
// Child Session Routes — Breath Bridge Phase 1
// File: src/routes/childSessionRoutes.js
//
// POST /api/child-session — log a child Air Dancer session
// GET /api/child-session/family/:familyId — clinician view of child engagement
//
// Phase 1: infrastructure + clinician visibility only.
// No messages, no parent-facing data, no notifications.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { computeAgeBracket } = require('../services/personaEngine');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CHILD_BRACKETS = ['elementary', 'middle_school', 'high_school'];

// ── POST /api/child-session ──────────────────────────────────
// Log a child Air Dancer session completion.
// Auth: JWT required. Must be a child bracket participant.

router.post('/', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { breaths_completed, breaths_available, duration_seconds } = req.body;

    // ── Validation ──
    if (!Number.isInteger(breaths_completed) || breaths_completed < 0) {
      return res.status(400).json({ error: 'breaths_completed must be integer >= 0' });
    }
    if (!Number.isInteger(breaths_available) || breaths_available <= 0) {
      return res.status(400).json({ error: 'breaths_available must be integer > 0' });
    }
    if (!Number.isInteger(duration_seconds) || duration_seconds < 0) {
      return res.status(400).json({ error: 'duration_seconds must be integer >= 0' });
    }
    if (breaths_completed > breaths_available) {
      return res.status(400).json({ error: 'breaths_completed must be <= breaths_available' });
    }

    // ── Look up participant ──
    const userResult = await pool.query(
      'SELECT id, date_of_birth, family_unit_id FROM users WHERE id = $1 OR user_id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // ── Age bracket check (server-side, per locked decision #23) ──
    const ageBracket = computeAgeBracket(user.date_of_birth);

    if (!user.date_of_birth) {
      return res.status(403).json({ error: 'Age bracket required for child sessions' });
    }
    if (ageBracket === 'adult') {
      return res.status(403).json({ error: 'Adult participants use standard session endpoints' });
    }
    if (!CHILD_BRACKETS.includes(ageBracket)) {
      return res.status(403).json({ error: 'Age bracket required for child sessions' });
    }

    // ── Look up family_id (nullable) ──
    let familyId = user.family_unit_id || null;
    if (!familyId) {
      const famResult = await pool.query(
        `SELECT family_unit_id FROM family_memberships
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [user.id]
      );
      familyId = famResult.rows[0]?.family_unit_id || null;
    }

    // ── Compute early_quit server-side ──
    const earlyQuit = breaths_completed < breaths_available;

    // ── INSERT ──
    const result = await pool.query(
      `INSERT INTO child_session_log
        (participant_id, family_id, age_bracket, breaths_completed, breaths_available, duration_seconds, early_quit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, session_timestamp`,
      [user.id, familyId, ageBracket, breaths_completed, breaths_available, duration_seconds, earlyQuit]
    );

    const row = result.rows[0];
    res.status(201).json({ id: row.id, session_timestamp: row.session_timestamp });
  } catch (err) {
    console.error('[CHILD-SESSION] POST error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to log child session' });
  }
});

// ── GET /api/child-session/family/:familyId ──────────────────
// Clinician view of child engagement for a family.
// Auth: JWT required. Role must be clinician or admin.

router.get('/family/:familyId', authenticate, requireRole('clinician'), async (req, res) => {
  try {
    const { familyId } = req.params;

    // ── Get child participant for this family ──
    const childResult = await pool.query(
      `SELECT DISTINCT csl.participant_id, u.date_of_birth
       FROM child_session_log csl
       JOIN users u ON csl.participant_id = u.id
       WHERE csl.family_id = $1
       ORDER BY csl.participant_id
       LIMIT 1`,
      [familyId]
    );

    const childParticipantId = childResult.rows[0]?.participant_id || null;
    const childDob = childResult.rows[0]?.date_of_birth || null;
    const ageBracket = childDob ? computeAgeBracket(childDob) : null;

    // ── Get sessions ──
    const sessionsResult = await pool.query(
      `SELECT id, breaths_completed, breaths_available, duration_seconds, early_quit, session_timestamp
       FROM child_session_log
       WHERE family_id = $1
       ORDER BY session_timestamp DESC`,
      [familyId]
    );

    const sessions = sessionsResult.rows;

    // ── Compute summary ──
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalSessions = sessions.length;
    const sessionsThisWeek = sessions.filter(s => new Date(s.session_timestamp) >= weekAgo).length;
    const sessionsThisMonth = sessions.filter(s => new Date(s.session_timestamp) >= monthAgo).length;

    let avgBreathsCompleted = 0;
    let avgDurationSeconds = 0;
    let earlyQuitRate = 0;
    let longestSessionBreaths = 0;
    let trend = 'new';

    if (totalSessions > 0) {
      avgBreathsCompleted = parseFloat(
        (sessions.reduce((sum, s) => sum + s.breaths_completed, 0) / totalSessions).toFixed(1)
      );
      avgDurationSeconds = Math.round(
        sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / totalSessions
      );
      earlyQuitRate = parseFloat(
        (sessions.filter(s => s.early_quit).length / totalSessions).toFixed(2)
      );
      longestSessionBreaths = Math.max(...sessions.map(s => s.breaths_completed));
    }

    // ── Trend computation ──
    if (totalSessions >= 4) {
      const lastWeekSessions = sessions.filter(s => {
        const ts = new Date(s.session_timestamp);
        return ts >= weekAgo;
      });
      const priorWeekSessions = sessions.filter(s => {
        const ts = new Date(s.session_timestamp);
        return ts >= twoWeeksAgo && ts < weekAgo;
      });

      if (lastWeekSessions.length > 0 && priorWeekSessions.length > 0) {
        const currentAvg = lastWeekSessions.reduce((sum, s) => sum + s.breaths_completed, 0) / lastWeekSessions.length;
        const priorAvg = priorWeekSessions.reduce((sum, s) => sum + s.breaths_completed, 0) / priorWeekSessions.length;

        if (currentAvg > priorAvg * 1.15) {
          trend = 'increasing';
        } else if (currentAvg < priorAvg * 0.85) {
          trend = 'decreasing';
        } else {
          trend = 'steady';
        }
      } else {
        trend = 'steady';
      }
    }

    res.json({
      family_id: familyId,
      child_participant_id: childParticipantId,
      age_bracket: ageBracket,
      sessions: sessions.map(s => ({
        id: s.id,
        breaths_completed: s.breaths_completed,
        breaths_available: s.breaths_available,
        duration_seconds: s.duration_seconds,
        early_quit: s.early_quit,
        session_timestamp: s.session_timestamp,
      })),
      summary: {
        total_sessions: totalSessions,
        sessions_this_week: sessionsThisWeek,
        sessions_this_month: sessionsThisMonth,
        avg_breaths_completed: avgBreathsCompleted,
        avg_duration_seconds: avgDurationSeconds,
        early_quit_rate: earlyQuitRate,
        longest_session_breaths: longestSessionBreaths,
        trend,
      },
    });
  } catch (err) {
    console.error('[CHILD-SESSION] GET family error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to retrieve child sessions' });
  }
});

module.exports = router;
