// ============================================================
// Lineage Service — Permanent Milestone Recording
// File: src/services/lineageService.js
//
// Records milestones in the lineage ledger with SHA-256
// attestation hashes. Entries are permanent. They compose
// the healing record.
//
// Called from:
//   laceEngine.completeAssessment → 'armor_confirmed'
//   firmwareRecommender.complete  → 'firmware_installed'
//   After 3 firmware sessions     → 'firmware_completed'
//   After field test response     → 'field_test_passed'
//   Family code naming            → 'family_code_named'
// ============================================================

const crypto = require('crypto');
const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function recordEntry(userId, familyUnitId, tenantId, entryType, entryData) {
  try {
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify({ userId, entryType, entryData, timestamp: Date.now() }))
      .digest('hex');

    await pool.query(
      `INSERT INTO lineage_entries (user_id, family_unit_id, tenant_id, entry_type, entry_data, attestation_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, familyUnitId, tenantId, entryType, JSON.stringify(entryData), hash]
    );

    return hash;
  } catch (err) {
    console.error('[LINEAGE] Record entry failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function getUserTimeline(userId) {
  const result = await pool.query(
    `SELECT id, entry_type, entry_data, attestation_hash, created_at
     FROM lineage_entries WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
}

async function getFamilyTimeline(familyUnitId) {
  const result = await pool.query(
    `SELECT le.id, le.entry_type, le.entry_data, le.attestation_hash, le.created_at,
            u.first_name, u.id
     FROM lineage_entries le
     JOIN users u ON le.user_id = u.id
     WHERE le.family_unit_id = $1
     ORDER BY le.created_at ASC`,
    [familyUnitId]
  );
  return result.rows;
}

async function getUserLedger(userId) {
  const result = await pool.query(
    `SELECT entry_type, COUNT(*) as count, MAX(created_at) as latest
     FROM lineage_entries WHERE user_id = $1
     GROUP BY entry_type ORDER BY latest DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = { recordEntry, getUserTimeline, getFamilyTimeline, getUserLedger };
