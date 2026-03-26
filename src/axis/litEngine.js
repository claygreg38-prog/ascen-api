// ============================================================
// LIT Engine — Legacy Impact Token Accounting
// File: src/axis/litEngine.js
//
// LIT is NOT a cryptocurrency. It is a database-tracked
// credential value derived from the Artifact Valuation Engine.
// Each healing credential earns LIT. LIT accumulates in the
// Family Capital Reserve. The value is defensible and auditable.
//
// Every LIT credit traces to a session_completion_id.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');
const { updateFCR } = require('./fcrManager');

async function creditCredential(userId, familyUnitId, sessionCompletionId, artifactValueUsd, tenantId) {
  try {
    if (!artifactValueUsd || isNaN(artifactValueUsd) || artifactValueUsd <= 0) return null;

    const lastEntry = await pool.query(
      'SELECT running_balance FROM lit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const currentBalance = lastEntry.rows.length ? parseFloat(lastEntry.rows[0].running_balance) : 0;
    const newBalance = Math.round((currentBalance + artifactValueUsd) * 100) / 100;

    await pool.query(`
      INSERT INTO lit_ledger (user_id, family_unit_id, tenant_id, transaction_type, session_completion_id, lit_amount, running_balance, metadata)
      VALUES ($1, $2, $3, 'credential_earned', $4, $5, $6, $7)
    `, [userId, familyUnitId, tenantId, sessionCompletionId, artifactValueUsd, newBalance,
      JSON.stringify({ session_completion_id: sessionCompletionId, credited_at: new Date() })]);

    // Update Family Capital Reserve
    if (familyUnitId) {
      await updateFCR(familyUnitId, userId, artifactValueUsd, tenantId);
    }

    return { credited: artifactValueUsd, balance: newBalance };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function recordRevaluation(userId, familyUnitId, sessionCompletionId, delta, tenantId) {
  try {
    if (!delta || delta === 0) return null;

    const lastEntry = await pool.query(
      'SELECT running_balance FROM lit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const currentBalance = lastEntry.rows.length ? parseFloat(lastEntry.rows[0].running_balance) : 0;
    const newBalance = Math.round((currentBalance + delta) * 100) / 100;

    const txType = delta > 0 ? 'revaluation_increase' : 'revaluation_decrease';

    await pool.query(`
      INSERT INTO lit_ledger (user_id, family_unit_id, tenant_id, transaction_type, session_completion_id, lit_amount, running_balance, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [userId, familyUnitId, tenantId, txType, sessionCompletionId, delta, newBalance,
      JSON.stringify({ revaluation_delta: delta })]);

    // Update FCR with delta
    if (familyUnitId && delta > 0) {
      await updateFCR(familyUnitId, userId, delta, tenantId);
    }

    return { delta, balance: newBalance };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function creditBondBonus(userId, familyUnitId, bonusAmount, bondTier, tenantId) {
  try {
    const lastEntry = await pool.query(
      'SELECT running_balance FROM lit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const currentBalance = lastEntry.rows.length ? parseFloat(lastEntry.rows[0].running_balance) : 0;
    const newBalance = Math.round((currentBalance + bonusAmount) * 100) / 100;

    await pool.query(`
      INSERT INTO lit_ledger (user_id, family_unit_id, tenant_id, transaction_type, lit_amount, running_balance, metadata)
      VALUES ($1, $2, $3, 'bond_maturation_bonus', $4, $5, $6)
    `, [userId, familyUnitId, tenantId, bonusAmount, newBalance,
      JSON.stringify({ bond_tier: bondTier })]);

    return { credited: bonusAmount, balance: newBalance };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function getPortfolio(userId) {
  try {
    const entries = await pool.query(
      `SELECT ll.* FROM lit_ledger ll WHERE ll.user_id = $1 ORDER BY ll.created_at DESC`,
      [userId]
    );

    const balance = entries.rows.length ? parseFloat(entries.rows[0].running_balance) : 0;
    const totalCredentials = entries.rows.filter(e => e.transaction_type === 'credential_earned').length;

    // Annual portfolio from artifact valuations (upstream ceiling still enforced)
    const annualTotal = await pool.query(
      `SELECT COALESCE(SUM(value_usd), 0) as total FROM artifact_valuations
       WHERE user_id = $1 AND is_latest = true AND computed_at > NOW() - INTERVAL '1 year'`,
      [userId]
    );

    return {
      balance,
      total_credentials: totalCredentials,
      recent_entries: entries.rows.slice(0, 20),
      portfolio_ceiling: 50000,
      annual_total: parseFloat(annualTotal.rows[0].total),
      portfolio_utilization: Math.min(100, (parseFloat(annualTotal.rows[0].total) / 50000) * 100)
    };
  } catch (err) {
    Sentry.captureException(err);
    return { balance: 0, total_credentials: 0, recent_entries: [], portfolio_ceiling: 50000, annual_total: 0, portfolio_utilization: 0 };
  }
}

async function getLITHistory(userId, limit = 50) {
  const result = await pool.query(
    'SELECT * FROM lit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return result.rows;
}

module.exports = { creditCredential, recordRevaluation, creditBondBonus, getPortfolio, getLITHistory };
