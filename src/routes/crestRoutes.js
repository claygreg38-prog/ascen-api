// ============================================================
// Family Crest Routes — Living System Document API
// File: src/routes/crestRoutes.js
//
// The Crest exists from day one. It IS the family's operating
// system version number. It grows. It never shrinks.
//
// Endpoints:
//   GET  /              — get family crest
//   POST /evidence      — submit evidence toward version upgrade
//   POST /upgrade       — trigger version upgrade (if criteria met)
//   GET  /evaluate/:v   — check if version criteria are met
//   POST /absent-member — add absent member (honored, not erased)
//   POST /ceremony      — record ceremony event
//   GET  /history       — version history timeline
// ============================================================

'use strict';

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crestEngine = require('../abi/familyCrestEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Helper: resolve family_unit_id from JWT user ────────────

async function resolveFamilyUnit(req) {
  const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
  if (!userId) return null;

  const result = await pool.query(
    'SELECT family_unit_id FROM users WHERE user_id = $1 OR id = $2',
    [userId, parseInt(userId) || 0]
  );
  return result.rows[0]?.family_unit_id || null;
}

// ── GET / — Get family crest ────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found for user' });

    const crest = await crestEngine.getCrest(familyUnitId);
    if (!crest) return res.status(404).json({ error: 'No crest found. Complete LACE assessment first.' });

    res.json(crest);
  } catch (err) {
    console.error('[CREST] Get failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get crest' });
  }
});

// ── POST /evidence — Submit evidence toward version upgrade ──

router.post('/evidence', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found' });

    const { version_target, trigger_type, evidence_data } = req.body;
    if (!version_target || !trigger_type || !evidence_data) {
      return res.status(400).json({ error: 'version_target, trigger_type, and evidence_data required' });
    }

    // Look up crest id
    const crest = await pool.query(
      'SELECT id FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (!crest.rows.length) return res.status(404).json({ error: 'No crest found' });

    const userId = req.user?.participant_id || req.user?.userId || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    const submittedBy = userRow.rows[0]?.id || null;

    const evaluation = await crestEngine.submitEvidence(
      crest.rows[0].id, version_target, trigger_type, evidence_data, submittedBy
    );

    res.json({ submitted: true, evaluation });
  } catch (err) {
    console.error('[CREST] Evidence submission failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to submit evidence' });
  }
});

// ── POST /upgrade — Trigger version upgrade (if criteria met) ──

router.post('/upgrade', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found' });

    const { target_version, upgrade_data } = req.body;
    if (!target_version) return res.status(400).json({ error: 'target_version required' });

    const crest = await pool.query(
      'SELECT id FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (!crest.rows.length) return res.status(404).json({ error: 'No crest found' });

    // Verify criteria are met before upgrading
    const evaluation = await crestEngine.evaluateVersion(crest.rows[0].id, target_version);
    if (!evaluation.eligible) {
      return res.status(400).json({ error: 'Version criteria not met', evaluation });
    }

    const result = await crestEngine.upgradeVersion(crest.rows[0].id, target_version, upgrade_data || {});
    res.json(result);
  } catch (err) {
    console.error('[CREST] Upgrade failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to upgrade version' });
  }
});

// ── GET /evaluate/:version — Check if version criteria met ───

router.get('/evaluate/:version', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found' });

    const crest = await pool.query(
      'SELECT id FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (!crest.rows.length) return res.status(404).json({ error: 'No crest found' });

    const evaluation = await crestEngine.evaluateVersion(crest.rows[0].id, req.params.version);
    res.json(evaluation);
  } catch (err) {
    console.error('[CREST] Evaluate failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to evaluate version' });
  }
});

// ── POST /absent-member — Honor an absent member ─────────────

router.post('/absent-member', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found' });

    const { name, relationship } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const crest = await pool.query(
      'SELECT id, absent_members FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (!crest.rows.length) return res.status(404).json({ error: 'No crest found' });

    const absent = crest.rows[0].absent_members || [];
    absent.push({
      name,
      relationship: relationship || null,
      note: 'Honored in absence. Welcomed when ready.',
      added_at: new Date().toISOString()
    });

    await pool.query(
      'UPDATE family_crests SET absent_members = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(absent), crest.rows[0].id]
    );

    res.json({ success: true, absent_members: absent });
  } catch (err) {
    console.error('[CREST] Absent member failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to add absent member' });
  }
});

// ── POST /ceremony — Record ceremony event ───────────────────

router.post('/ceremony', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found' });

    const crest = await pool.query(
      'SELECT id, tenant_id, ceremony_count FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (!crest.rows.length) return res.status(404).json({ error: 'No crest found' });

    const c = crest.rows[0];
    const newCount = (c.ceremony_count || 0) + 1;

    await pool.query(
      'UPDATE family_crests SET ceremony_count = $1, last_ceremony_at = NOW(), updated_at = NOW() WHERE id = $2',
      [newCount, c.id]
    );

    // Generate ceremony narration via Haiku
    const narration = await crestEngine.generateCeremonyNarration(c.id, c.tenant_id);

    res.json({ ceremony_number: newCount, narration });
  } catch (err) {
    console.error('[CREST] Ceremony failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record ceremony' });
  }
});

// ── GET /history — Version history timeline ──────────────────

router.get('/history', async (req, res) => {
  try {
    const familyUnitId = await resolveFamilyUnit(req);
    if (!familyUnitId) return res.status(400).json({ error: 'No family unit found' });

    const crest = await pool.query(
      'SELECT version_history, current_version, created_at FROM family_crests WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (!crest.rows.length) return res.status(404).json({ error: 'No crest found' });

    const c = crest.rows[0];
    res.json({
      current_version: c.current_version,
      history: c.version_history || [],
      created_at: c.created_at
    });
  } catch (err) {
    console.error('[CREST] History failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

module.exports = router;
