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
  'crisis_checkins', 'steward_actions', 'crisis_message_templates'
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

module.exports = router;
