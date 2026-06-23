// ============================================================
// Partnership Routes — Couples/Intimate Partner Co-Regulation API
// File: src/routes/partnershipRoutes.js
//
// The system reads the SPACE BETWEEN two nervous systems.
// It protects both partners equally. It does not take sides.
//
// Endpoints:
//   POST /enroll              — enroll partnership
//   GET  /eligibility         — check enrollment eligibility
//   GET  /status              — current state + account balance
//   POST /session/start       — start partnership session
//   POST /session/tick        — dual biometric tick
//   POST /session/complete    — complete session, update account
//   GET  /sessions            — session history
//   GET  /topics              — filtered by account balance
//   POST /kitchen-table/start — start partnership kitchen table
//   POST /kitchen-table/tick  — dual biometric + pattern detection
//   POST /repair/start        — initiate repair protocol
//   POST /repair/complete     — complete repair, deposit
//   GET  /account             — balance + recent history
//   GET  /account/trend       — 30-day trend
//   POST /baseline            — capture dyadic baseline
// ============================================================

'use strict';

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const partnershipEngine = require('../abi/partnershipEngine');
// L3 — server-side dyadic compute + WS regulation forward.
const coBreathSession = require('../services/coBreathSession');
const coBreathWS = require('../services/coBreathWebSocket');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helper: resolve user's active partnership ────────────────

// The canonical resolver now lives in partnershipEngine (one implementation shared
// by these routes and the WS room-admission check). Use it everywhere.
async function resolveUserId(req) {
  const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
  return partnershipEngine.resolveUserIdValue(userId);
}

async function resolvePartnership(req) {
  const id = await resolveUserId(req);
  if (!id) return null;
  return await partnershipEngine.getPartnership(id);
}

// ═══════════════════════════════════════════════════════════════
// ENROLLMENT
// ═══════════════════════════════════════════════════════════════

router.get('/eligibility', async (req, res) => {
  try {
    const { partner_a_id, partner_b_id } = req.query;
    if (!partner_a_id || !partner_b_id) {
      return res.status(400).json({ error: 'partner_a_id and partner_b_id query params required' });
    }
    // Resolve user_id/code -> users.id (the UI sends text ids, not integers).
    const aId = await partnershipEngine.resolveUserIdValue(partner_a_id);
    const bId = await partnershipEngine.resolveUserIdValue(partner_b_id);
    if (!aId || !bId) {
      return res.status(404).json({ error: 'Partner not found', partner_a_resolved: !!aId, partner_b_resolved: !!bId });
    }
    const result = await partnershipEngine.checkEligibility(aId, bId);
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Eligibility check failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

router.post('/enroll', async (req, res) => {
  try {
    const { partner_a_id, partner_b_id, family_unit_id } = req.body;
    if (!partner_a_id || !partner_b_id) {
      return res.status(400).json({ error: 'partner_a_id and partner_b_id required' });
    }
    // Resolve user_id/code -> users.id (same resolver), so the UI's text ids
    // become the integer ids enroll()'s FK + canonical ordering require.
    const aId = await partnershipEngine.resolveUserIdValue(partner_a_id);
    const bId = await partnershipEngine.resolveUserIdValue(partner_b_id);
    if (!aId || !bId) {
      return res.status(404).json({ error: 'Partner not found', partner_a_resolved: !!aId, partner_b_resolved: !!bId });
    }
    const tenantId = req.tenantId || null;
    const result = await partnershipEngine.enroll(
      aId, bId, family_unit_id, tenantId
    );
    if (!result.enrolled) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Enrollment failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to enroll partnership' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const account = await partnershipEngine.getAccount(partnership.id);
    res.json({
      partnership_id: partnership.id,
      status: partnership.status,
      enrolled_at: partnership.enrolled_at,
      dyadic_baseline: partnership.dyadic_baseline,
      account
    });
  } catch (err) {
    console.error('[PARTNERSHIP] Status failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get partnership status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DYADIC BASELINE
// ═══════════════════════════════════════════════════════════════

router.post('/baseline', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { partner_a_biometrics, partner_b_biometrics } = req.body;
    if (!partner_a_biometrics || !partner_b_biometrics) {
      return res.status(400).json({ error: 'Both partner biometrics required' });
    }

    const baseline = await partnershipEngine.captureDyadicBaseline(
      partnership.id, partner_a_biometrics, partner_b_biometrics
    );
    res.json({ baseline });
  } catch (err) {
    console.error('[PARTNERSHIP] Baseline capture failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to capture baseline' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════

router.post('/session/start', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { session_type } = req.body;
    if (!session_type) return res.status(400).json({ error: 'session_type required' });

    const result = await partnershipEngine.startSession(partnership.id, session_type);
    // B1 — DV deny-by-default gate: structurally impossible to enter ungated.
    if (result.started === false) return res.status(403).json(result);
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Session start failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.post('/session/tick', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { partner_a, partner_b, session_key, dyadic_buffer, partner_a_ratio, partner_b_ratio } = req.body;
    if (!partner_a || !partner_b) {
      return res.status(400).json({ error: 'Both partner biometrics required' });
    }

    // Get individual baselines from dyadic baseline
    const dyadicBaseline = partnership.dyadic_baseline || {};
    const baselineA = dyadicBaseline.individual_baselines?.a || null;
    const baselineB = dyadicBaseline.individual_baselines?.b || null;

    // Pass dyadic buffer and per-partner ratio state for sustained evaluation
    const result = partnershipEngine.processTick(
      partner_a, partner_b, baselineA, baselineB,
      dyadic_buffer || [], partner_a_ratio || null, partner_b_ratio || null
    );
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Tick failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to process tick' });
  }
});

router.post('/session/complete', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { session_id, metrics } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const result = await partnershipEngine.completeSession(session_id, partnership.id, metrics || {});
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Session complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// L3 — Parallel authed RAW bio tick, keyed by session_id. Raw biometrics reach the
// SERVER here (never the WS). Server-side processTick runs in the in-memory session
// manager; only the server-derived regulation CATEGORY is forwarded to the partner
// over WS. Membership is validated via L1's validateRoomAdmission.
router.post('/session/:id/tick-bio', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { biometrics } = req.body;
    if (!biometrics) return res.status(400).json({ error: 'biometrics required' });

    const userId = req.user?.participant_id || req.user?.userId || req.user?.sub || req.body.user_id;
    const admission = await partnershipEngine.validateRoomAdmission(sessionId, userId);
    if (!admission.ok) return res.status(403).json({ error: 'Not admitted to session', reason: admission.reason });

    // ECHO — single recipient breathing with a recorded trace; compute entrainment.
    if (admission.mode === 'echo') {
      const er = await coBreathSession.ingestEchoBio(sessionId, biometrics);
      return res.json({ ok: true, mode: 'echo', metrics: er.metrics, aggregate: er.aggregate });
    }

    // LIVE — dyadic; forward ONLY the server-derived regulation category to the partner.
    const result = await coBreathSession.ingestBio(sessionId, admission.is_partner_a, biometrics);
    coBreathWS.pushPartnerRegulation(sessionId, admission.user_db_id, result.regulation_category);

    // Response: sender's own category + shared dyad metrics + rolling aggregate.
    // Never the partner's raw bio.
    res.json({ ok: true, regulation_category: result.regulation_category, metrics: result.metrics, aggregate: result.aggregate });
  } catch (err) {
    console.error('[PARTNERSHIP] bio-tick failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to process bio tick' });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const history = await partnershipEngine.getSessionHistory(partnership.id, parseInt(req.query.limit) || 20);
    res.json({ sessions: history });
  } catch (err) {
    console.error('[PARTNERSHIP] Session history failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get session history' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PARTNERSHIP KITCHEN TABLE
// ═══════════════════════════════════════════════════════════════

router.get('/topics', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const balance = parseFloat(partnership.account_balance);

    // Below 20: co-breath only, no kitchen table
    if (balance < 20) {
      return res.json({
        topics: [],
        message: 'Shared System Balance is rebuilding. Co-breath sessions are available to strengthen the connection.',
        balance,
        threshold: 20
      });
    }

    const topics = await partnershipEngine.getTopics(balance);
    res.json({ topics, balance });
  } catch (err) {
    console.error('[PARTNERSHIP] Topics failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get topics' });
  }
});

router.post('/kitchen-table/start', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const balance = parseFloat(partnership.account_balance);
    if (balance < 20) {
      return res.status(400).json({
        error: 'Shared System Balance too low for kitchen table. Continue with co-breath sessions.',
        balance,
        threshold: 20
      });
    }

    const { topic_id } = req.body;
    if (!topic_id) return res.status(400).json({ error: 'topic_id required' });

    // Verify topic is accessible at current balance
    const topic = await pool.query(
      'SELECT * FROM partnership_topics WHERE id = $1 AND min_account_balance <= $2',
      [topic_id, balance]
    );
    if (!topic.rows.length) {
      return res.status(400).json({ error: 'Topic not available at current Shared System Balance' });
    }

    const session = await partnershipEngine.startSession(partnership.id, 'kitchen_table');
    res.json({ session, topic: topic.rows[0] });
  } catch (err) {
    console.error('[PARTNERSHIP] Kitchen table start failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start kitchen table' });
  }
});

router.post('/kitchen-table/tick', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { partner_a, partner_b, dyadic_buffer, partner_a_ratio, partner_b_ratio } = req.body;
    if (!partner_a || !partner_b) {
      return res.status(400).json({ error: 'Both partner biometrics required' });
    }

    const dyadicBaseline = partnership.dyadic_baseline || {};
    const baselineA = dyadicBaseline.individual_baselines?.a || null;
    const baselineB = dyadicBaseline.individual_baselines?.b || null;

    const result = partnershipEngine.processTick(
      partner_a, partner_b, baselineA, baselineB,
      dyadic_buffer || [], partner_a_ratio || null, partner_b_ratio || null
    );
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Kitchen table tick failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to process tick' });
  }
});

// ═══════════════════════════════════════════════════════════════
// REPAIR PROTOCOL
// ═══════════════════════════════════════════════════════════════

router.post('/repair/start', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { session_id, reason } = req.body;
    const result = await partnershipEngine.initiateRepair(partnership.id, session_id, reason || 'manual');
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Repair start failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to initiate repair' });
  }
});

router.post('/repair/complete', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const { session_id, metrics } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const result = await partnershipEngine.completeRepair(session_id, partnership.id, metrics);
    res.json(result);
  } catch (err) {
    console.error('[PARTNERSHIP] Repair complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete repair' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ACCOUNT
// ═══════════════════════════════════════════════════════════════

router.get('/account', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const account = await partnershipEngine.getAccount(partnership.id);
    res.json(account);
  } catch (err) {
    console.error('[PARTNERSHIP] Account failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

router.get('/account/trend', async (req, res) => {
  try {
    const partnership = await resolvePartnership(req);
    if (!partnership) return res.status(404).json({ error: 'No active partnership found' });

    const trend = await partnershipEngine.getAccountTrend(partnership.id);
    res.json(trend);
  } catch (err) {
    console.error('[PARTNERSHIP] Account trend failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get account trend' });
  }
});

module.exports = router;
