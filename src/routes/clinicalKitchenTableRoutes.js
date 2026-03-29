// ============================================================
// Clinical Kitchen Table Routes — Clinician-Only Endpoints
// File: src/routes/clinicalKitchenTableRoutes.js
//
// ADDITIONS to Session 17's kitchen table routes.
// Mounted at /api/kitchen-table/clinical/* — separate from
// family routes at /api/kitchen-table/*.
//
// All routes require role = clinician in JWT. No exceptions.
//
// Correction #6: Sentry in all catch blocks.
// Correction #7: Server-side rate limit on /coach-me (30s per session).
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const promptImpactEngine = require('../abi/promptImpactEngine');
const communicationAnalyzer = require('../abi/communicationAnalyzer');
const coachingEngine = require('../abi/clinicalCoachingEngine');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// All clinical routes require clinician+ role
router.use(requireRole('clinician'));

// Correction #7: Server-side coach-me rate limit tracking
const coachMeLastRequest = new Map(); // sessionId → timestamp
const COACH_ME_COOLDOWN_MS = 30000;

// ── PROMPT ACTIVATION ─────────────────────────────────────────

router.post('/prompt/activate', async (req, res) => {
  try {
    const { session_id, topic_id, member_ids } = req.body;

    if (!session_id || !topic_id || !member_ids || !Array.isArray(member_ids)) {
      return res.status(400).json({ error: 'session_id, topic_id, and member_ids[] required' });
    }

    const result = await promptImpactEngine.startImpactMonitoring(session_id, topic_id, member_ids);
    res.json({ activated: true, ...result });
  } catch (err) {
    console.error('[CLINICAL] prompt/activate error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to activate prompt' });
  }
});

// ── ENGAGEMENT UPDATE ─────────────────────────────────────────

router.post('/engagement/update', async (req, res) => {
  try {
    const { session_id, user_id, status } = req.body;

    if (!session_id || !user_id || !status) {
      return res.status(400).json({ error: 'session_id, user_id, and status required' });
    }

    // Store engagement event in DB
    const coBreathWS = require('../services/coBreathWebSocket');
    if (coBreathWS.logEngagementEvent) {
      await coBreathWS.logEngagementEvent(session_id, {
        user_id,
        status, // reflecting | listening | disengaged
        timestamp: Date.now()
      });
    }

    res.json({ updated: true });
  } catch (err) {
    console.error('[CLINICAL] engagement/update error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to update engagement' });
  }
});

// ── POST-SESSION CLINICAL REPORT ──────────────────────────────

router.get('/session/report/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [impacts, communication, coaching] = await Promise.all([
      pool.query(
        'SELECT * FROM kitchen_table_prompt_impacts WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      ),
      pool.query(
        'SELECT * FROM kitchen_table_communication WHERE session_id = $1',
        [sessionId]
      ),
      pool.query(
        'SELECT * FROM kitchen_table_coaching_logs WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      )
    ]);

    res.json({
      session_id: sessionId,
      prompt_impacts: impacts.rows,
      communication_patterns: communication.rows,
      coaching_cards: coaching.rows,
      summary: {
        total_topics: new Set(impacts.rows.map(r => r.topic_id)).size,
        activations_detected: impacts.rows.filter(r => r.response_type === 'activated').length,
        withdrawals_detected: impacts.rows.filter(r => r.response_type === 'withdrew').length,
        coaching_cards_delivered: coaching.rows.length,
        coaching_cards_seen: coaching.rows.filter(r => r.was_seen).length,
      }
    });
  } catch (err) {
    console.error('[CLINICAL] session/report error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ── MULTI-SESSION COMMUNICATION HISTORY ───────────────────────

router.get('/family/communication-history', async (req, res) => {
  try {
    const { family_unit_id } = req.query;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const history = await communicationAnalyzer.getCommunicationHistory(family_unit_id);
    const sessions = [...new Set(history.map(h => h.session_id))];

    res.json({
      entries: history,
      total_sessions: sessions.length,
      sufficient_data: sessions.length >= 3,
      trends: sessions.length >= 3 ? computeTrends(history) : null,
    });
  } catch (err) {
    console.error('[CLINICAL] communication-history error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get communication history' });
  }
});

// ── COACH ME — ON-DEMAND SONNET ANALYSIS ──────────────────────

router.post('/coach-me', async (req, res) => {
  try {
    const { session_id, members, baselines, engagement_states, family_profile, session_history } = req.body;

    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    // Correction #7: Server-side rate limit — 30s between requests per session
    const lastRequest = coachMeLastRequest.get(session_id);
    if (lastRequest && Date.now() - lastRequest < COACH_ME_COOLDOWN_MS) {
      const retryAfter = Math.ceil((COACH_ME_COOLDOWN_MS - (Date.now() - lastRequest)) / 1000);
      return res.status(429).json({
        error: 'Coach Me rate limit exceeded',
        retry_after_seconds: retryAfter
      });
    }
    coachMeLastRequest.set(session_id, Date.now());

    const card = await coachingEngine.coachMe(
      session_id, members, baselines, engagement_states, family_profile, session_history || []
    );

    res.json({ card });
  } catch (err) {
    console.error('[CLINICAL] coach-me error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Coach Me failed' });
  }
});

// ── COACHING CARD FEEDBACK ────────────────────────────────────

router.post('/coaching/feedback', async (req, res) => {
  try {
    const { card_id, was_seen, was_used } = req.body;

    if (!card_id) return res.status(400).json({ error: 'card_id required' });

    await pool.query(
      'UPDATE kitchen_table_coaching_logs SET was_seen = COALESCE($1, was_seen), was_used = COALESCE($2, was_used) WHERE id = $3',
      [was_seen, was_used, card_id]
    );

    res.json({ updated: true });
  } catch (err) {
    console.error('[CLINICAL] coaching/feedback error:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// ── TRENDS COMPUTATION ────────────────────────────────────────

function computeTrends(history) {
  const sessionMap = {};
  for (const entry of history) {
    if (!sessionMap[entry.session_id]) sessionMap[entry.session_id] = [];
    sessionMap[entry.session_id].push(entry);
  }

  const sessions = Object.values(sessionMap);
  if (sessions.length < 3) return null;

  // Average speaking distribution spread (lower = more balanced)
  const speakingSpread = sessions.map(s => {
    const pcts = s.map(e => parseFloat(e.speaking_pct) || 0);
    const max = Math.max(...pcts);
    const min = Math.min(...pcts);
    return max - min;
  });

  // Average co-regulation events per session
  const coRegPerSession = sessions.map(s =>
    s.reduce((sum, e) => sum + (e.co_regulation_events || 0), 0)
  );

  // Average interruptions per session
  const interruptionsPerSession = sessions.map(s =>
    s.reduce((sum, e) => sum + (e.interruption_count || 0), 0)
  );

  return {
    speaking_distribution_trend: speakingSpread.length >= 2
      ? (speakingSpread[0] < speakingSpread[speakingSpread.length - 1] ? 'improving' : 'needs_attention')
      : 'insufficient_data',
    co_regulation_trend: coRegPerSession.length >= 2
      ? (coRegPerSession[0] > coRegPerSession[coRegPerSession.length - 1] ? 'improving' : 'stable')
      : 'insufficient_data',
    interruption_trend: interruptionsPerSession.length >= 2
      ? (interruptionsPerSession[0] < interruptionsPerSession[interruptionsPerSession.length - 1] ? 'improving' : 'needs_attention')
      : 'insufficient_data',
    sessions_analyzed: sessions.length
  };
}

module.exports = router;
