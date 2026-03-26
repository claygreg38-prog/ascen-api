// ============================================================
// FCR Manager — Family Capital Reserve
// File: src/axis/fcrManager.js
//
// Maintains family-level accumulation of LIT value.
// FACC auto-contribution (5-10%) flows from every credit.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');

async function updateFCR(familyUnitId, userId, litAmount, tenantId) {
  try {
    // Upsert FCR
    await pool.query(`
      INSERT INTO family_capital_reserves (family_unit_id, tenant_id, total_lit, total_credentials, total_value_usd)
      VALUES ($1, $2, $3, 1, $3)
      ON CONFLICT (family_unit_id) DO UPDATE SET
        total_lit = family_capital_reserves.total_lit + $3,
        total_credentials = family_capital_reserves.total_credentials + 1,
        total_value_usd = family_capital_reserves.total_value_usd + $3,
        updated_at = NOW()
    `, [familyUnitId, tenantId, litAmount]);

    // Update member contribution tracking
    const userKey = userId.toString();
    await pool.query(`
      UPDATE family_capital_reserves SET
        member_contributions = jsonb_set(
          COALESCE(member_contributions, '{}'),
          $1::text[],
          to_jsonb(jsonb_build_object(
            'lit_earned', COALESCE((member_contributions->$2->>'lit_earned')::decimal, 0) + $3,
            'credentials', COALESCE((member_contributions->$2->>'credentials')::int, 0) + 1
          ))
        )
      WHERE family_unit_id = $4
    `, ['{' + userKey + '}', userKey, litAmount, familyUnitId]);

    // FACC contribution (5-10% auto-routed — non-negotiable)
    const fcr = await pool.query(
      'SELECT facc_rate FROM family_capital_reserves WHERE family_unit_id = $1',
      [familyUnitId]
    );
    const faccRate = parseFloat(fcr.rows[0]?.facc_rate || 0.05);
    const faccContribution = Math.round(litAmount * faccRate * 100) / 100;

    if (faccContribution > 0) {
      await pool.query(
        'UPDATE family_capital_reserves SET facc_contributed = facc_contributed + $1 WHERE family_unit_id = $2',
        [faccContribution, familyUnitId]
      );
    }
  } catch (err) {
    Sentry.captureException(err);
  }
}

async function getFCR(familyUnitId) {
  try {
    const fcr = await pool.query('SELECT * FROM family_capital_reserves WHERE family_unit_id = $1', [familyUnitId]);
    if (!fcr.rows.length) return null;
    return fcr.rows[0];
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function getFACCPool() {
  try {
    const result = await pool.query(
      'SELECT COALESCE(SUM(facc_contributed), 0) as total_facc, COUNT(*) as family_count FROM family_capital_reserves'
    );
    return {
      total_facc: parseFloat(result.rows[0].total_facc),
      contributing_families: parseInt(result.rows[0].family_count)
    };
  } catch (err) {
    Sentry.captureException(err);
    return { total_facc: 0, contributing_families: 0 };
  }
}

module.exports = { updateFCR, getFCR, getFACCPool };
