// ============================================================
// [ABI] LACE Routes — Legacy ACE Assessment + Family Code Naming
// File: src/routes/laceRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// LACE never produces a SCORE. It produces a MAP.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const laceEngine = require('../abi/laceEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── POST /start — Begin LACE assessment ─────────────────────

router.post('/start', async (req, res) => {
  try {
    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });

    const result = await laceEngine.startAssessment(
      userRow.rows[0].id,
      req.body.family_unit_id || null,
      req.tenantId || null
    );
    res.json(result);
  } catch (err) {
    console.error('[LACE] Start failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to start system scan' });
  }
});

// ── POST /domain — Record domain response + biometric ───────

router.post('/domain', async (req, res) => {
  try {
    const { assessment_id, domain_id, response, biometrics } = req.body;
    if (!assessment_id || !domain_id) {
      return res.status(400).json({ error: 'assessment_id and domain_id required' });
    }
    await laceEngine.recordDomainResponse(assessment_id, domain_id, response, biometrics);
    res.json({ recorded: true });
  } catch (err) {
    console.error('[LACE] Domain response failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record domain response' });
  }
});

// ── POST /breath-baseline — Inter-cluster breath reading ────

router.post('/breath-baseline', async (req, res) => {
  try {
    const { assessment_id, cluster_number, baseline } = req.body;
    if (!assessment_id || !cluster_number) {
      return res.status(400).json({ error: 'assessment_id and cluster_number required' });
    }
    await laceEngine.recordBreathBaseline(assessment_id, cluster_number, baseline);
    res.json({ recorded: true });
  } catch (err) {
    console.error('[LACE] Breath baseline failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to record breath baseline' });
  }
});

// ── POST /confirm-armor — Confirm armor with biometric ──────

router.post('/confirm-armor', async (req, res) => {
  try {
    const { assessment_id, armor_name, biometric_response } = req.body;
    if (!assessment_id || !armor_name) {
      return res.status(400).json({ error: 'assessment_id and armor_name required' });
    }
    await laceEngine.confirmArmor(assessment_id, armor_name, biometric_response || {});
    res.json({ confirmed: true });
  } catch (err) {
    console.error('[LACE] Confirm armor failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to confirm armor' });
  }
});

// ── POST /complete — Finalize, generate armor MAP ───────────

router.post('/complete', async (req, res) => {
  try {
    const { assessment_id } = req.body;
    if (!assessment_id) return res.status(400).json({ error: 'assessment_id required' });
    const map = await laceEngine.completeAssessment(assessment_id);
    res.json(map);
  } catch (err) {
    console.error('[LACE] Complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to complete system scan' });
  }
});

// ── GET /status/:id — Assessment progress ───────────────────

router.get('/status/:id', async (req, res) => {
  try {
    const status = await laceEngine.getStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'Assessment not found' });
    res.json(status);
  } catch (err) {
    console.error('[LACE] Status failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ── GET /map/:id — Armor map for completed assessment ───────

router.get('/map/:id', async (req, res) => {
  try {
    const assessment = await pool.query(
      "SELECT * FROM lace_assessments WHERE id = $1 AND status = 'completed'",
      [req.params.id]
    );
    if (!assessment.rows.length) return res.status(404).json({ error: 'Completed assessment not found' });

    const data = assessment.rows[0];
    const domainsActivated = Object.entries(data.domain_responses || {})
      .filter(([, r]) => r.acknowledged || r.intensity !== 'none')
      .map(([id]) => {
        const domain = laceEngine.DOMAINS.find(d => d.id === id);
        return domain ? { id: domain.id, name: domain.name, armor: domain.armor } : null;
      })
      .filter(Boolean);

    const confirmedArmors = (data.confirmed_armors || [])
      .filter(a => a.confirmed)
      .map(a => ({ name: a.name, ...laceEngine.ARMORS[a.name] }));

    // MAP, never score
    res.json({
      domains_activated: domainsActivated,
      confirmed_armors: confirmedArmors,
      breath_trajectory: laceEngine.DOMAINS.length > 0 ? 'stable' : 'insufficient',
    });
  } catch (err) {
    console.error('[LACE] Map failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to load armor map' });
  }
});

// ── GET /domains — Domain and cluster reference ─────────────

router.get('/domains', (req, res) => {
  res.json({ domains: laceEngine.DOMAINS, clusters: laceEngine.CLUSTERS, armors: laceEngine.ARMORS });
});

// ── POST /family/code-name — Name the family code ───────────
// Only elder (ELDR) can set the family code name

router.post('/family/code-name', async (req, res) => {
  try {
    const { family_unit_id, code_name, carriers } = req.body;
    if (!family_unit_id || !code_name) {
      return res.status(400).json({ error: 'family_unit_id and code_name required' });
    }

    const userId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (!userRow.rows.length) return res.status(404).json({ error: 'User not found' });
    const internalId = userRow.rows[0].id;

    // Verify elder role
    const membership = await pool.query(
      'SELECT role FROM family_memberships WHERE user_id = $1 AND family_unit_id = $2',
      [internalId, family_unit_id]
    );
    if (!membership.rows.length || !['elder', 'founder'].includes(membership.rows[0].role)) {
      return res.status(403).json({ error: 'Only the elder can name the family code' });
    }

    await pool.query(`
      INSERT INTO lineage_profiles (user_id, family_unit_id, tenant_id, family_code_name, carriers)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (family_unit_id) DO UPDATE SET family_code_name = $4, carriers = $5, updated_at = NOW()
    `, [internalId, family_unit_id, req.tenantId || null, code_name, JSON.stringify(carriers || [])]);

    res.json({ named: true, family_code_name: code_name });
  } catch (err) {
    console.error('[LACE] Code naming failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to name family code' });
  }
});

module.exports = router;
