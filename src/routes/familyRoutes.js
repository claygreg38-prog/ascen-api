// ============================================================
// [ABI] Family Routes — Family Unit Management & Intelligence API
// File: src/routes/familyRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const familyUnitEngine = require('../abi/familyUnitEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { tenantWhere } = require('../utils/tenantHelper');

// ── POST /unit — Create family unit ─────────────────────────

router.post('/unit', async (req, res) => {
  try {
    const { family_name } = req.body;
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const tenantId = req.tenantId || null;
    const tenantConfig = req.tenantConfig || {};

    if (!family_name) {
      return res.status(400).json({ error: 'family_name required' });
    }

    const result = await familyUnitEngine.createFamilyUnit(userId, family_name, tenantId, tenantConfig);

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[Family] Create unit failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to create family unit' });
  }
});

// ── GET /unit/:id — Get family unit with members ────────────

router.get('/unit/:id', async (req, res) => {
  try {
    const result = await familyUnitEngine.getFamilyUnit(req.params.id);
    if (!result) return res.status(404).json({ error: 'Family unit not found' });

    // ── Per-member capacity state + LightBridge state ──────
    // Privacy rule: capacity STATE only — never balance, never NS3, never biometrics
    const membersWithState = await Promise.all(result.members.map(async (member) => {
      // Resolve internal user id for DB queries
      let internalId = null;
      try {
        const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [member.userId]);
        if (userRow.rows.length) internalId = userRow.rows[0].id;
      } catch (e) { /* skip enrichment */ }

      // Get capacity state (label only — NEVER balance or NS3 score)
      let capacityState = 'steady'; // default
      if (internalId) {
        try {
          const capResult = await pool.query(
            `SELECT capacity_state FROM capacity_snapshots
             WHERE user_id = $1 ORDER BY snapshot_date DESC LIMIT 1`,
            [internalId]
          );
          if (capResult.rows.length) capacityState = capResult.rows[0].capacity_state;
        } catch (e) { /* default to steady */ }
      }

      // Get LightBridge state (null if no device)
      let lightbridgeState = null;
      if (internalId) {
        try {
          const lbResult = await pool.query(
            `SELECT current_state FROM lightbridge_devices
             WHERE user_id = $1 AND is_active = true LIMIT 1`,
            [internalId]
          );
          if (lbResult.rows.length) lightbridgeState = lbResult.rows[0].current_state;
        } catch (e) { /* null */ }
      }

      return {
        ...member,
        capacity_state: capacityState,
        lightbridge_state: lightbridgeState
      };
    }));

    // ── Co-breath suggestion (null if insufficient data) ───
    let coBreathSuggestion = null;
    const requestingUserId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    try {
      // Resolve requesting user's internal id
      const reqUserRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [requestingUserId]);
      if (reqUserRow.rows.length) {
        const reqInternalId = reqUserRow.rows[0].id;

        // Analyze historical co-breath timing + quality
        const coBreathHistory = await pool.query(
          `SELECT cs.partner_id, u.first_name,
                  EXTRACT(DOW FROM cs.created_at) as day_of_week,
                  EXTRACT(HOUR FROM cs.created_at) as hour,
                  cs.connection_score
           FROM cobreath_sessions cs
           JOIN users u ON u.id = cs.partner_id
           WHERE cs.initiator_id = $1 AND cs.connection_score IS NOT NULL
           ORDER BY cs.created_at DESC LIMIT 20`,
          [reqInternalId]
        );

        if (coBreathHistory.rows.length >= 3) {
          // Find best partner + best time
          const partnerScores = {};
          coBreathHistory.rows.forEach(row => {
            if (!partnerScores[row.partner_id]) {
              partnerScores[row.partner_id] = {
                name: row.first_name, scores: [], days: [], hours: []
              };
            }
            partnerScores[row.partner_id].scores.push(parseFloat(row.connection_score));
            partnerScores[row.partner_id].days.push(parseInt(row.day_of_week));
            partnerScores[row.partner_id].hours.push(parseInt(row.hour));
          });

          // Best partner by average connection score
          let bestPartner = null;
          let bestAvg = 0;
          for (const [id, data] of Object.entries(partnerScores)) {
            const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            if (avg > bestAvg) { bestAvg = avg; bestPartner = { id, ...data }; }
          }

          if (bestPartner) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayCount = {};
            bestPartner.days.forEach(d => { dayCount[d] = (dayCount[d] || 0) + 1; });
            const bestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

            const hourCount = {};
            bestPartner.hours.forEach(h => { hourCount[h] = (hourCount[h] || 0) + 1; });
            const bestHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
            const timeLabel = bestHour ? (parseInt(bestHour[0]) < 12 ? 'mornings' : 'evenings') : null;

            coBreathSuggestion = {
              partner_name: bestPartner.name,
              best_day: bestDay ? dayNames[parseInt(bestDay[0])] : null,
              best_time: timeLabel
            };
          }
        }
      }
    } catch (e) { /* null — insufficient data */ }

    res.json({
      ...result,
      members: membersWithState,
      co_breath_suggestion: coBreathSuggestion
    });
  } catch (err) {
    console.error('[Family] Get unit failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get family unit' });
  }
});

// ── GET /unit/:id/gates — Current gate state + requirements ─

router.get('/unit/:id/gates', async (req, res) => {
  try {
    const t = tenantWhere(req.tenantId, 1);
    const family = await pool.query(
      `SELECT gate_state FROM family_units WHERE family_unit_id = $1${t.clause}`,
      [req.params.id, ...t.params]
    );
    if (family.rows.length === 0) return res.status(404).json({ error: 'Family unit not found' });

    const gates = family.rows[0].gate_state || {};
    const config = familyUnitEngine.DEFAULT_GATE_CONFIG;

    res.json({
      gates,
      requirements: {
        gate_1: { ...config.gate_1, unlocked: gates.gate_1 || false, description: 'Elder practice threshold' },
        gate_2: { ...config.gate_2, unlocked: gates.gate_2 || false, description: 'Elder + first member sustained practice' },
        gate_3: { ...config.gate_3, unlocked: gates.gate_3 || false, description: 'Collective family milestone' }
      }
    });
  } catch (err) {
    console.error('[Family] Gates failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get gate state' });
  }
});

// ── POST /invite — Send invitation ──────────────────────────

router.post('/invite', async (req, res) => {
  try {
    const { family_unit_id, invitee_name, relationship, gate_number } = req.body;
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;

    if (!family_unit_id || !invitee_name || !relationship || !gate_number) {
      return res.status(400).json({ error: 'family_unit_id, invitee_name, relationship, and gate_number required' });
    }

    // Get DB id
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await familyUnitEngine.sendInvitation(
      family_unit_id, userRow.rows[0].id, invitee_name, relationship, gate_number
    );

    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Family] Invite failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ── POST /invite/:code/accept — Accept invitation ───────────

router.post('/invite/:code/accept', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const result = await familyUnitEngine.acceptInvitation(req.params.code, userId);

    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Family] Accept invite failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// ── GET /members/:familyUnitId — List members ───────────────

router.get('/members/:familyUnitId', async (req, res) => {
  try {
    const t = tenantWhere(req.tenantId, 1, 'fm');
    const members = await pool.query(
      `SELECT fm.role, fm.generation_level, fm.joined_at, fm.individual_progress,
              u.participant_id as user_id, u.first_name, u.total_sessions_completed
       FROM family_memberships fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1${t.clause}
       ORDER BY fm.generation_level ASC, fm.joined_at ASC`,
      [req.params.familyUnitId, ...t.params]
    );

    res.json({
      members: members.rows.map(m => ({
        userId: m.user_id,
        firstName: m.first_name,
        role: m.role,
        generationLevel: m.generation_level,
        joinedAt: m.joined_at,
        sessionsCompleted: m.total_sessions_completed || 0,
        progress: m.individual_progress
      }))
    });
  } catch (err) {
    console.error('[Family] Members failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// ── GET /patterns/:familyUnitId — Actionable patterns ───────

router.get('/patterns/:familyUnitId', async (req, res) => {
  try {
    const t = tenantWhere(req.tenantId, 1);
    const patterns = await pool.query(
      `SELECT pattern_type, pattern_key, pattern_data, observation_count, last_observed
       FROM family_patterns
       WHERE family_unit_id = $1 AND observation_count >= 3${t.clause}
       ORDER BY last_observed DESC`,
      [req.params.familyUnitId, ...t.params]
    );

    res.json({ patterns: patterns.rows });
  } catch (err) {
    console.error('[Family] Patterns failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get patterns' });
  }
});

// ── GET /messages/:userId — Recent automated messages ───────

router.get('/messages/:userId', async (req, res) => {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [req.params.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const messages = await pool.query(
      `SELECT category, severity, message_text, sent_at
       FROM family_messages
       WHERE target_user_id = $1
       ORDER BY sent_at DESC LIMIT 20`,
      [userRow.rows[0].id]
    );

    res.json({ messages: messages.rows });
  } catch (err) {
    console.error('[Family] Messages failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ── GET /escalations/:familyUnitId — Open escalations ───────

router.get('/escalations/:familyUnitId', async (req, res) => {
  try {
    const escalations = await pool.query(
      `SELECT id, escalation_type, trigger_data, routed_to, status, created_at
       FROM family_escalations
       WHERE family_unit_id = $1 AND status != 'resolved'
       ORDER BY created_at DESC`,
      [req.params.familyUnitId]
    );

    res.json({ escalations: escalations.rows });
  } catch (err) {
    console.error('[Family] Escalations failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get escalations' });
  }
});

// ── POST /escalations/:id/acknowledge — Acknowledge ─────────

router.post('/escalations/:id/acknowledge', async (req, res) => {
  try {
    await pool.query(
      "UPDATE family_escalations SET status = 'acknowledged' WHERE id = $1",
      [req.params.id]
    );
    res.json({ acknowledged: true });
  } catch (err) {
    console.error('[Family] Acknowledge failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to acknowledge escalation' });
  }
});

module.exports = router;
