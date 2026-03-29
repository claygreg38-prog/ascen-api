// ============================================================
// [ABI] Capacity Currency Routes
// File: src/routes/capacityRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// Family members see STATE only — never balances or transactions.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const capacityCurrency = require('../abi/capacityCurrency');
const { tenantWhere } = require('../utils/tenantHelper');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GET /balance/:userId — Current balance and state ─────────

router.get('/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const balance = await capacityCurrency.getBalance(userId);

    // Last transaction
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    let lastTransaction = null;
    if (userRow.rows.length > 0) {
      const last = await pool.query(
        `SELECT transaction_type, amount, source, created_at FROM capacity_ledger
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userRow.rows[0].id]
      );
      if (last.rows.length > 0) lastTransaction = last.rows[0];
    }

    res.json({
      user_id: userId,
      balance: balance.balance,
      savings: balance.savings,
      state: balance.state,
      overdraft_active: balance.overdraftActive,
      last_transaction: lastTransaction
    });
  } catch (err) {
    console.error('[Capacity] Balance failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// ── GET /history/:userId — Ledger history (paginated) ────────

router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const t = tenantWhere(req.tenantId, 1);
    const total = await pool.query(
      `SELECT COUNT(*) as c FROM capacity_ledger WHERE user_id = $1${t.clause}`,
      [userRow.rows[0].id, ...t.params]
    );

    const t2 = tenantWhere(req.tenantId, 3);
    const entries = await pool.query(
      `SELECT transaction_type, amount, source, balance_after, savings_after, metadata, created_at
       FROM capacity_ledger WHERE user_id = $1${t2.clause}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userRow.rows[0].id, limit, offset, ...t2.params]
    );

    res.json({
      entries: entries.rows,
      page,
      pages: Math.ceil(parseInt(total.rows[0].c) / limit),
      total: parseInt(total.rows[0].c)
    });
  } catch (err) {
    console.error('[Capacity] History failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ── GET /trend/:userId — Snapshot trend ──────────────────────

router.get('/trend/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const t = tenantWhere(req.tenantId, 2);
    const snapshots = await pool.query(
      `SELECT snapshot_date, capacity_score, capacity_state, active_balance, savings_balance
       FROM capacity_snapshots
       WHERE user_id = $1 AND snapshot_date > CURRENT_DATE - $2 * INTERVAL '1 day'${t.clause}
       ORDER BY snapshot_date ASC`,
      [userRow.rows[0].id, days, ...t.params]
    );

    res.json({ snapshots: snapshots.rows, days });
  } catch (err) {
    console.error('[Capacity] Trend failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get trend' });
  }
});

// ── GET /family/:familyUnitId — Family states ONLY ───────────

router.get('/family/:familyUnitId', async (req, res) => {
  try {
    const { familyUnitId } = req.params;

    const t = tenantWhere(req.tenantId, 1, 'fm');
    const members = await pool.query(
      `SELECT u.id, u.first_name, fm.role
       FROM family_memberships fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1${t.clause}
       ORDER BY fm.generation_level ASC`,
      [familyUnitId, ...t.params]
    );

    // Get state ONLY for each member — no balances, no savings, no transactions
    const memberStates = [];
    for (const m of members.rows) {
      const balance = await capacityCurrency.getBalance(m.user_id);
      memberStates.push({
        user_id: m.user_id,
        first_name: m.first_name,
        role: m.role,
        state: balance.state  // STATE ONLY — never balance or savings
      });
    }

    res.json({ family_unit_id: familyUnitId, members: memberStates });
  } catch (err) {
    console.error('[Capacity] Family states failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get family states' });
  }
});

// ── POST /invest — Capacity investment ───────────────────────

router.post('/invest', async (req, res) => {
  try {
    const { investor_id, recipient_id, family_unit_id } = req.body;

    if (!investor_id || !recipient_id) {
      return res.status(400).json({ error: 'investor_id and recipient_id required' });
    }

    const result = await capacityCurrency.processInvestment(investor_id, recipient_id, family_unit_id);

    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Capacity] Investment failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Investment failed' });
  }
});

// ── POST /sleep — Manual sleep quality entry ─────────────────

router.post('/sleep', async (req, res) => {
  try {
    const { user_id, quality, date } = req.body;

    if (!user_id || quality === undefined) {
      return res.status(400).json({ error: 'user_id and quality required' });
    }

    const qualityScore = Math.max(0, Math.min(100, parseInt(quality)));
    const entryDate = date || new Date().toISOString().split('T')[0];

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [user_id]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      `INSERT INTO sleep_entries (user_id, quality_score, entry_date, source)
       VALUES ($1, $2, $3, 'manual')
       ON CONFLICT (user_id, entry_date) DO UPDATE SET quality_score = EXCLUDED.quality_score`,
      [userRow.rows[0].id, qualityScore, entryDate]
    );

    res.json({ stored: true, quality: qualityScore, date: entryDate });
  } catch (err) {
    console.error('[Capacity] Sleep entry failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to store sleep entry' });
  }
});

module.exports = router;
