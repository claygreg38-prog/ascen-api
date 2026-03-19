// ============================================================
// Daily Capacity Snapshot Job
// File: src/jobs/capacitySnapshot.js
//
// Runs daily at 3:00 AM UTC. Computes capacity score snapshot
// for every active user. Called from server.js cron.
// ============================================================

const { Pool } = require('pg');
const capacityCurrency = require('../abi/capacityCurrency');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Run daily snapshots for all active users.
 * @returns {Promise<Object>} { count, errors }
 */
async function runDailySnapshots() {
  let count = 0;
  let errors = 0;
  const startTime = Date.now();

  try {
    // Get all users with at least 1 session
    const users = await pool.query(
      `SELECT DISTINCT u.id, u.user_id FROM users u
       JOIN session_completions sc ON sc.user_id = u.user_id
       WHERE u.user_id IS NOT NULL`
    );

    const today = new Date().toISOString().split('T')[0];

    for (const user of users.rows) {
      try {
        // Compute capacity score
        const capacity = await capacityCurrency.computeCapacityScore(user.user_id);

        // Get current balance from ledger
        const balance = await capacityCurrency.getBalance(user.user_id);

        // Compute savings
        const savings = await capacityCurrency.computeSavings(user.id);

        // Insert snapshot (upsert on unique user_id + date)
        await pool.query(
          `INSERT INTO capacity_snapshots (user_id, snapshot_date, capacity_score, capacity_state, active_balance, savings_balance, component_scores)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
             capacity_score = EXCLUDED.capacity_score,
             capacity_state = EXCLUDED.capacity_state,
             active_balance = EXCLUDED.active_balance,
             savings_balance = EXCLUDED.savings_balance,
             component_scores = EXCLUDED.component_scores`,
          [user.id, today, capacity.score, capacity.state, balance.balance, savings, JSON.stringify(capacity.components)]
        );

        count++;
      } catch (err) {
        errors++;
        console.error(`[CapacitySnapshot] Failed for user ${user.user_id}:`, err.message);
      }
    }

    // Also check dividends
    const dividends = await capacityCurrency.checkDividends();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CapacitySnapshot] Complete: ${count} snapshots, ${errors} errors, ${dividends} dividends, ${elapsed}s`);

  } catch (err) {
    console.error('[CapacitySnapshot] Job failed:', err.message);
    Sentry.captureException(err);
  }

  return { count, errors };
}

module.exports = { runDailySnapshots };
