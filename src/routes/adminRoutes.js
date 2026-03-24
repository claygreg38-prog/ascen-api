// ============================================================
// Admin Routes — System Audit, Table Checks, Health
// File: src/routes/adminRoutes.js
//
// Mount at /api/admin. Requires admin role.
// Supports the frontend AuditTool component.
// ============================================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ALLOWED_TABLES = [
  'users', 'tenants', 'session_templates', 'session_completions', 'family_units',
  'family_memberships', 'capacity_ledger', 'lightbridge_devices', 'facilitated_messages',
  'crisis_events', 'subscriptions', 'kitchen_table_topics', 'cobreath_sessions',
  'legacy_capsules', 'personalized_art', 'showcase_posts', 'art_aggregations',
  'family_curricula', 'relationship_predictions', 'family_healing_maps',
  'enrollment_codes', 'ai_usage_log', 'message_templates', 'conflict_events',
  'therapeutic_letters', 'therapy_reports', 'clinical_disclosures', 'story_arcs',
  'curriculum_assignments', 'payment_history', 'subscription_events',
  'crisis_checkins', 'steward_actions', 'crisis_message_templates',
  'notification_queue'
];

// Table existence + row count
router.get('/table-check/:tableName', async (req, res) => {
  try {
    const table = req.params.tableName;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    res.json({ table, count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Migration count
router.get('/migration-count', (req, res) => {
  try {
    const migrationDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
    res.json({ migrations_on_disk: files.length, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full system health
router.get('/system-health', async (req, res) => {
  const checks = {};

  try { await pool.query('SELECT 1'); checks.database = 'ok'; }
  catch { checks.database = 'error'; }

  checks.anthropic_key_set = !!process.env.ANTHROPIC_API_KEY;
  checks.stripe_key_set = !!process.env.STRIPE_SECRET_KEY;
  checks.lightbridge_simulate = process.env.LIGHTBRIDGE_SIMULATE === 'true';

  checks.env_vars = {
    jwt_secret: !!process.env.JWT_SECRET,
    wallet_encryption_key: !!process.env.WALLET_ENCRYPTION_KEY,
    art_encryption_key: !!process.env.ART_ENCRYPTION_KEY,
    recovery_encryption_key: !!process.env.RECOVERY_ENCRYPTION_KEY
  };

  // Table count
  try {
    const tables = await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'");
    checks.table_count = parseInt(tables.rows[0].count);
  } catch { checks.table_count = 'error'; }

  res.json(checks);
});

// ── TEST FIXTURE: Disclosure routing test data ──────────────
// Creates parent + child users in a family with guided_bridge tier.
// Idempotent. Returns credentials needed to run disclosure tests.
router.post('/test-fixture/disclosure', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure 'child' role is allowed in family_memberships
    await client.query(`
      ALTER TABLE family_memberships DROP CONSTRAINT IF EXISTS family_memberships_role_check;
      ALTER TABLE family_memberships ADD CONSTRAINT family_memberships_role_check
        CHECK (role IN ('elder', 'adult', 'adult_child', 'child', 'grandchild', 'extended'))
    `);

    // Get ASCEN tenant
    const tenantRow = await client.query("SELECT id FROM tenants WHERE slug = 'ascen'");
    const tenantId = tenantRow.rows[0]?.id;

    // Upsert parent user
    const parentUid = 'UTESTPARENT01';
    let parent = (await client.query('SELECT id, user_id FROM users WHERE user_id = $1', [parentUid])).rows[0];
    if (!parent) {
      parent = (await client.query(
        `INSERT INTO users (user_id, first_name, last_name, auth_method, role, is_active, is_verified, tenant_id, participant_id, onboarding_state, created_at)
         VALUES ($1, 'TestParent', 'Disclosure', 'facility_code', 'participant', true, true, $2, $1, '{"step":"complete"}', NOW())
         RETURNING id, user_id`, [parentUid, tenantId]
      )).rows[0];
    }

    // Upsert child user
    const childUid = 'UTESTCHILD01';
    let child = (await client.query('SELECT id, user_id FROM users WHERE user_id = $1', [childUid])).rows[0];
    if (!child) {
      child = (await client.query(
        `INSERT INTO users (user_id, first_name, last_name, auth_method, role, is_active, is_verified, tenant_id, participant_id, onboarding_state, created_at)
         VALUES ($1, 'TestChild', 'Disclosure', 'facility_code', 'participant', true, true, $2, $1, '{"step":"complete"}', NOW())
         RETURNING id, user_id`, [childUid, tenantId]
      )).rows[0];
    }

    // Upsert family unit
    let family = (await client.query("SELECT family_unit_id FROM family_units WHERE name = 'Disclosure Test Family'")).rows[0];
    if (!family) {
      family = (await client.query(
        `INSERT INTO family_units (name, created_by, tenant_id, status, gate_state, premium_tier)
         VALUES ('Disclosure Test Family', $1, $2, 'active', '{"gate_1":true}', 'guided_bridge')
         RETURNING family_unit_id`, [parent.id, tenantId]
      )).rows[0];
    } else {
      await client.query("UPDATE family_units SET premium_tier = 'guided_bridge' WHERE family_unit_id = $1", [family.family_unit_id]);
    }

    const familyId = family.family_unit_id;

    // Upsert memberships (update role if already exists)
    await client.query(
      `INSERT INTO family_memberships (family_unit_id, user_id, role, generation_level)
       VALUES ($1, $2, 'elder', 0)
       ON CONFLICT (family_unit_id, user_id) DO UPDATE SET role = 'elder'`, [familyId, parent.id]
    );
    await client.query(
      `INSERT INTO family_memberships (family_unit_id, user_id, role, generation_level)
       VALUES ($1, $2, 'child', 1)
       ON CONFLICT (family_unit_id, user_id) DO UPDATE SET role = 'child'`, [familyId, child.id]
    );

    // Update users with family_unit_id
    await client.query('UPDATE users SET family_unit_id = $1 WHERE id IN ($2, $3)', [familyId, parent.id, child.id]);

    await client.query('COMMIT');

    res.json({
      parent: { db_id: parent.id, user_id: parent.user_id },
      child: { db_id: child.id, user_id: child.user_id },
      family_unit_id: familyId,
      tenant_id: tenantId,
      tier: 'guided_bridge'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Admin] Test fixture failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── NOTIFICATION QUEUE MANAGEMENT ────────────────────────────

// GET /api/admin/notifications/failed — view failed deliveries
router.get('/notifications/failed', async (req, res) => {
  try {
    const failed = await pool.query(`
      SELECT id, type, recipient, subject, template_name, attempts, last_error, created_at
      FROM notification_queue
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json({ failed: failed.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/notifications/:id/resend — manual resend
router.post('/notifications/:id/resend', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notification_queue SET status = $1, attempts = 0 WHERE id = $2 RETURNING id',
      ['retrying', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ queued: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/notifications/stats — delivery stats (last 7 days)
router.get('/notifications/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT status, COUNT(*) as count FROM notification_queue
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY status
    `);
    const total = await pool.query(
      'SELECT COUNT(*) as count FROM notification_queue WHERE created_at > NOW() - INTERVAL \'7 days\''
    );
    res.json({ stats: stats.rows, total: parseInt(total.rows[0]?.count || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
