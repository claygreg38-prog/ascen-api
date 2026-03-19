// ============================================================
// [ABI] Capacity Currency Engine — AXIS Output Module
// File: src/abi/capacityCurrency.js
//
// Composite emotional bandwidth scoring using financial metaphors.
// Receives data from AXIS, not directly from biometric streams.
// Family members see STATE only (full/steady/etc), never raw scores.
//
// Exports:
//   computeCapacityScore(userId, tenantConfig)
//   processTransaction(userId, transactionType, amount, source, metadata)
//   onSessionComplete(userId, sessionData)
//   processWithdrawal(userId, source, severity, metadata)
//   processInvestment(investorId, recipientId, familyUnitId)
//   checkDividends()
//   computeSavings(userId)
//   getBalance(userId)
//   scoreToState(score)
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CONFIGURABLE WEIGHTS (overridable per tenant) ───────────

const DEFAULT_WEIGHTS = {
  hrv_trend: 0.30,
  sleep_quality: 0.20,
  session_consistency: 0.15,
  breath_ratio_progression: 0.15,
  recovery_velocity: 0.10,
  engagement_pattern: 0.10
};

// ── STATE MAPPING ───────────────────────────────────────────

function scoreToState(score) {
  if (score >= 80) return 'full';
  if (score >= 60) return 'steady';
  if (score >= 40) return 'drawing_down';
  if (score >= 20) return 'low';
  return 'depleted';
}

// ── COMPUTE CAPACITY SCORE ──────────────────────────────────

/**
 * Compute composite capacity score from weighted inputs.
 * Reads from AXIS outputs (NS3 data, session history) — never raw biometrics.
 *
 * @param {string} userId - user_id string
 * @param {Object} tenantConfig - optional tenant-specific weight overrides
 * @returns {Promise<Object>} { score, state, components }
 */
async function computeCapacityScore(userId, tenantConfig = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(tenantConfig.capacity_weights || {}) };
  const components = {};

  try {
    // 1. HRV Trend (30%) — 72-hour NS3 directional trend
    components.hrv_trend = await computeHRVTrend(userId);

    // 2. Sleep Quality (20%) — manual entry or default
    components.sleep_quality = await getSleepScore(userId);

    // 3. Session Consistency (15%) — completion vs personal baseline
    components.session_consistency = await computeSessionConsistency(userId);

    // 4. Breath Ratio Progression (15%) — trending toward optimal
    components.breath_ratio_progression = await computeBreathProgression(userId);

    // 5. Recovery Velocity (10%) — time to regulation
    components.recovery_velocity = await computeRecoveryVelocity(userId);

    // 6. Engagement Pattern (10%) — regularity and streaks
    components.engagement_pattern = await computeEngagementPattern(userId);

  } catch (err) {
    console.error('[CapacityCurrency] Score computation failed:', err.message);
    Sentry.captureException(err);
    // Return neutral score on error
    return { score: 60, state: 'steady', components: {} };
  }

  // Weighted sum
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += (components[key] || 60) * weight;
  }

  score = Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
  const state = scoreToState(score);

  return { score, state, components };
}

// ── COMPONENT SCORERS ───────────────────────────────────────

async function computeHRVTrend(userId) {
  try {
    const sessions = await pool.query(
      `SELECT ns3_mean FROM session_completions
       WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '72 hours' AND ns3_mean IS NOT NULL
       ORDER BY completed_at ASC`,
      [userId]
    );

    if (sessions.rows.length < 2) {
      // Check if any sessions exist at all
      const lastSession = await pool.query(
        `SELECT ns3_mean, completed_at FROM session_completions
         WHERE user_id = $1 AND ns3_mean IS NOT NULL
         ORDER BY completed_at DESC LIMIT 1`,
        [userId]
      );
      if (lastSession.rows.length === 0) return 60; // neutral
      // Decay factor: lose 2 points per day since last session
      const daysSince = Math.floor((Date.now() - new Date(lastSession.rows[0].completed_at).getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(20, 60 - daysSince * 2);
    }

    const values = sessions.rows.map(r => parseFloat(r.ns3_mean));
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const trend = avgSecond - avgFirst;
    if (trend > 5) return Math.min(100, 80 + trend);  // improving
    if (trend > -5) return 60;                          // stable
    return Math.max(20, 40 + trend);                    // declining
  } catch (err) {
    Sentry.captureException(err);
    return 60;
  }
}

async function getSleepScore(userId) {
  try {
    // Terra API is PARKED. Use manual entries or default.
    const entries = await pool.query(
      `SELECT quality_score FROM sleep_entries
       WHERE user_id = (SELECT id FROM users WHERE user_id = $1)
       AND entry_date > CURRENT_DATE - INTERVAL '7 days'
       ORDER BY entry_date DESC`,
      [userId]
    );

    if (entries.rows.length === 0) return 60; // neutral default

    const avg = entries.rows.reduce((s, r) => s + r.quality_score, 0) / entries.rows.length;
    return Math.round(avg);
  } catch (err) {
    return 60;
  }
}

async function computeSessionConsistency(userId) {
  try {
    // Sessions in last 14 days
    const recent = await pool.query(
      `SELECT COUNT(*) as c FROM session_completions
       WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '14 days'`,
      [userId]
    );
    const recentCount = parseInt(recent.rows[0].c) || 0;

    // Personal baseline: average sessions per 14 days over last 60 days
    const baseline = await pool.query(
      `SELECT COUNT(*) as c FROM session_completions
       WHERE user_id = $1 AND completed_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '14 days'`,
      [userId]
    );
    const baselineCount = parseInt(baseline.rows[0].c) || 0;
    const baselinePer14 = baselineCount > 0 ? (baselineCount / (46 / 14)) * 14 : 7; // normalize to 14-day window, default 7

    if (baselinePer14 === 0) return 60;

    const ratio = recentCount / Math.max(1, baselinePer14);
    if (ratio >= 1.2) return 90;
    if (ratio >= 0.8) return 70;
    if (ratio >= 0.5) return 45;
    return 25;
  } catch (err) {
    Sentry.captureException(err);
    return 60;
  }
}

async function computeBreathProgression(userId) {
  try {
    const sessions = await pool.query(
      `SELECT coherence_score FROM session_completions
       WHERE user_id = $1 AND coherence_score IS NOT NULL
       ORDER BY completed_at DESC LIMIT 6`,
      [userId]
    );

    if (sessions.rows.length < 2) return 60;

    const values = sessions.rows.map(r => parseFloat(r.coherence_score));
    const latest = values[0];
    const previous = values.slice(1).reduce((a, b) => a + b, 0) / (values.length - 1);

    const diff = latest - previous;
    if (diff > 0.1) return 90;   // improving
    if (diff > -0.05) return 65; // stable
    return 35;                    // regressing
  } catch (err) {
    Sentry.captureException(err);
    return 60;
  }
}

async function computeRecoveryVelocity(userId) {
  try {
    const sessions = await pool.query(
      `SELECT time_to_regulation_sec FROM session_completions
       WHERE user_id = $1 AND time_to_regulation_sec IS NOT NULL
       ORDER BY completed_at DESC LIMIT 10`,
      [userId]
    );

    if (sessions.rows.length < 2) return 60;

    const values = sessions.rows.map(r => parseFloat(r.time_to_regulation_sec));
    const latest = values[0];
    const avg = values.slice(1).reduce((a, b) => a + b, 0) / (values.length - 1);

    if (latest < avg * 0.8) return 90;   // faster than average
    if (latest < avg * 1.2) return 65;   // at average
    if (latest === null || latest === 0) return 20; // no optimal zone
    return 35;                             // slower
  } catch (err) {
    Sentry.captureException(err);
    return 60;
  }
}

async function computeEngagementPattern(userId) {
  try {
    // Session timing regularity
    const sessions = await pool.query(
      `SELECT EXTRACT(HOUR FROM completed_at) as hour, completed_at::date as d
       FROM session_completions
       WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '30 days'
       ORDER BY completed_at DESC`,
      [userId]
    );

    if (sessions.rows.length < 3) return 50;

    const hours = sessions.rows.map(r => parseInt(r.hour));
    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((s, h) => s + Math.pow(h - avgHour, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);

    // Low std dev = regular timing
    let regularity = stdDev < 2 ? 90 : stdDev < 4 ? 70 : stdDev < 6 ? 50 : 30;

    // Streak bonus
    const dates = [...new Set(sessions.rows.map(r => r.d?.toISOString?.()?.split('T')[0] || ''))].sort().reverse();
    let streak = 0;
    for (let i = 0; i < dates.length - 1; i++) {
      const diff = (new Date(dates[i]) - new Date(dates[i + 1])) / (1000 * 60 * 60 * 24);
      if (diff <= 1) streak++;
      else break;
    }
    if (streak >= 7) regularity = Math.min(100, regularity + 10);
    else if (streak >= 3) regularity = Math.min(100, regularity + 5);

    return regularity;
  } catch (err) {
    Sentry.captureException(err);
    return 50;
  }
}

// ── TRANSACTION PROCESSING ──────────────────────────────────

/**
 * Record a transaction in the capacity ledger.
 *
 * @param {number} userDbId - users.id
 * @param {string} transactionType
 * @param {number} amount - positive for deposits, negative for withdrawals
 * @param {string} source
 * @param {Object} metadata
 * @returns {Promise<Object>} { newBalance, newSavings, state, overdraftActive }
 */
async function processTransaction(userDbId, transactionType, amount, source, metadata = {}) {
  try {
    // Get current balance
    const lastEntry = await pool.query(
      'SELECT balance_after, savings_after FROM capacity_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userDbId]
    );

    let currentBalance = lastEntry.rows.length > 0 ? parseFloat(lastEntry.rows[0].balance_after) : 60;
    let currentSavings = lastEntry.rows.length > 0 ? parseFloat(lastEntry.rows[0].savings_after) : 0;

    // Overdraft protection: block withdrawals when depleted
    let overdraftActive = currentBalance <= 19;
    if (overdraftActive && amount < 0) {
      // Record the blocked withdrawal as overdraft_protection
      await pool.query(
        `INSERT INTO capacity_ledger (user_id, transaction_type, amount, source, balance_after, savings_after, metadata)
         VALUES ($1, 'overdraft_protection', 0, $2, $3, $4, $5)`,
        [userDbId, source, currentBalance, currentSavings, JSON.stringify({ ...metadata, blocked_amount: amount })]
      );
      return { newBalance: currentBalance, newSavings: currentSavings, state: scoreToState(currentBalance), overdraftActive: true };
    }

    // Calculate new balance
    let newBalance = Math.max(0, Math.min(100, currentBalance + amount));

    // Get family_unit_id and tenant_id
    const userInfo = await pool.query('SELECT family_unit_id, tenant_id FROM users WHERE id = $1', [userDbId]);
    const familyUnitId = userInfo.rows[0]?.family_unit_id || null;
    const tenantId = userInfo.rows[0]?.tenant_id || null;

    // Insert ledger entry
    await pool.query(
      `INSERT INTO capacity_ledger (user_id, family_unit_id, tenant_id, transaction_type, amount, source, balance_after, savings_after, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userDbId, familyUnitId, tenantId, transactionType, amount, source, newBalance, currentSavings, JSON.stringify(metadata)]
    );

    overdraftActive = newBalance <= 19;

    return { newBalance, newSavings: currentSavings, state: scoreToState(newBalance), overdraftActive };
  } catch (err) {
    console.error('[CapacityCurrency] Transaction failed:', err.message);
    Sentry.captureException(err);
    return { newBalance: 60, newSavings: 0, state: 'steady', overdraftActive: false };
  }
}

// ── SESSION COMPLETE DEPOSIT ────────────────────────────────

/**
 * Process session completion as a capacity deposit.
 * Called from sessionOrchestrator.js.
 *
 * @param {string} userId - user_id string
 * @param {Object} sessionData
 * @returns {Promise<Object>} Transaction result
 */
async function onSessionComplete(userId, sessionData) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return null;
    const userDbId = userRow.rows[0].id;

    const deposit = calculateSessionDeposit(sessionData);

    return await processTransaction(userDbId, 'deposit', deposit, 'session_complete', {
      session_number: sessionData.sessionNumber,
      ns3_mean: sessionData.ns3Mean,
      deposit_breakdown: sessionData._depositBreakdown
    });
  } catch (err) {
    console.error('[CapacityCurrency] Session deposit failed:', err.message);
    Sentry.captureException(err);
    return null;
  }
}

function calculateSessionDeposit(sessionData) {
  let baseDeposit = 5; // Every completed session deposits at least 5
  const breakdown = { base: 5 };

  // Quality bonus based on NS3
  const ns3 = sessionData.ns3Mean || sessionData.ns3_mean || 50;
  if (ns3 >= 70) { baseDeposit += 5; breakdown.quality = 5; }
  else if (ns3 >= 50) { baseDeposit += 3; breakdown.quality = 3; }
  else { baseDeposit += 1; breakdown.quality = 1; }

  // Coherence bonus
  const coherence = sessionData.coherencePeak || sessionData.coherence_peak || 0;
  if (coherence >= 0.7) { baseDeposit += 3; breakdown.coherence = 3; }
  else if (coherence >= 0.5) { baseDeposit += 1; breakdown.coherence = 1; }

  // Streak bonus
  const streak = sessionData.streakDays || sessionData.streak_days || 0;
  if (streak >= 7) { baseDeposit += 3; breakdown.streak = 3; }
  else if (streak >= 3) { baseDeposit += 1; breakdown.streak = 1; }

  // Somatic reset courage bonus
  if (sessionData.somaticResetUsed || sessionData.somatic_reset_used) {
    baseDeposit += 2;
    breakdown.somatic = 2;
  }

  sessionData._depositBreakdown = breakdown;
  return Math.min(baseDeposit, 20); // Cap at 20
}

// ── WITHDRAWAL PROCESSING ───────────────────────────────────

/**
 * Process a capacity withdrawal.
 *
 * @param {string} userId - user_id string
 * @param {string} source
 * @param {string} severity - 'mild', 'moderate', 'severe'
 * @param {Object} metadata
 * @returns {Promise<Object>}
 */
async function processWithdrawal(userId, source, severity, metadata = {}) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return null;
    const userDbId = userRow.rows[0].id;

    const amounts = {
      streak_break: () => -Math.min(10, (metadata.streak_length || 1) * 0.5),
      topic_stress: () => severity === 'severe' ? -8 : severity === 'moderate' ? -5 : -3,
      sleep_deficit: () => severity === 'severe' ? -5 : severity === 'moderate' ? -3 : -2,
      external_stressor: () => severity === 'severe' ? -10 : severity === 'moderate' ? -7 : -5,
      co_breath_transfer: () => severity === 'severe' ? -5 : severity === 'moderate' ? -3 : -2,
      missed_session: () => -2
    };

    const amount = amounts[source] ? amounts[source]() : -3;

    return await processTransaction(userDbId, 'withdrawal', amount, source, metadata);
  } catch (err) {
    console.error('[CapacityCurrency] Withdrawal failed:', err.message);
    Sentry.captureException(err);
    return null;
  }
}

// ── INVESTMENT ──────────────────────────────────────────────

/**
 * Process capacity investment (co-breath with depleted member).
 *
 * @param {string} investorUserId - user_id string
 * @param {string} recipientUserId - user_id string
 * @param {string} familyUnitId
 * @returns {Promise<Object>}
 */
async function processInvestment(investorUserId, recipientUserId, familyUnitId) {
  try {
    const investorRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [investorUserId]);
    const recipientRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [recipientUserId]);
    if (investorRow.rows.length === 0 || recipientRow.rows.length === 0) {
      return { error: true, message: 'User not found' };
    }

    const investorDbId = investorRow.rows[0].id;
    const recipientDbId = recipientRow.rows[0].id;

    // Check investor balance >= 40
    const investorBalance = await getBalanceByDbId(investorDbId);
    if (investorBalance.balance < 40) {
      return { error: true, message: 'Insufficient capacity to invest. Balance must be 40 or above.' };
    }

    // Get recipient's current capacity
    const recipientBalance = await getBalanceByDbId(recipientDbId);
    const recipientState = scoreToState(recipientBalance.balance);

    // Investment amount based on recipient's depletion
    let investmentAmount;
    if (recipientState === 'depleted') investmentAmount = 10;
    else if (recipientState === 'low') investmentAmount = 7;
    else investmentAmount = 5;

    // Withdraw from investor
    await processTransaction(investorDbId, 'investment', -investmentAmount, 'co_breath_investment', {
      recipient_user_id: recipientUserId
    });

    // Record investment
    const result = await pool.query(
      `INSERT INTO capacity_investments (investor_user_id, recipient_user_id, family_unit_id, amount_invested, recipient_capacity_before)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [investorDbId, recipientDbId, familyUnitId, investmentAmount, recipientBalance.balance]
    );

    return {
      investmentId: result.rows[0].id,
      investorNewBalance: investorBalance.balance - investmentAmount,
      amountInvested: investmentAmount,
      recipientState
    };
  } catch (err) {
    console.error('[CapacityCurrency] Investment failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Investment processing failed' };
  }
}

// ── DIVIDEND CHECK ──────────────────────────────────────────

/**
 * Check pending investments for dividend eligibility.
 * Run every 6 hours or on session completion.
 *
 * @returns {Promise<number>} Count of dividends processed
 */
async function checkDividends() {
  let count = 0;
  try {
    const pending = await pool.query(
      `SELECT ci.*, ci.investor_user_id, ci.recipient_user_id
       FROM capacity_investments ci
       WHERE ci.dividend_eligible = false
         AND ci.created_at < NOW() - INTERVAL '48 hours'
         AND ci.dividend_checked_at IS NULL`,
      []
    );

    for (const inv of pending.rows) {
      const recipientBalance = await getBalanceByDbId(inv.recipient_user_id);
      const improvement = recipientBalance.balance - parseFloat(inv.recipient_capacity_before);

      let dividendAmount = 0;
      if (improvement >= 10) {
        dividendAmount = improvement >= 20 ? 5 : 3;

        // Process dividend deposit to investor
        await processTransaction(inv.investor_user_id, 'dividend', dividendAmount, 'investment_return', {
          investment_id: inv.id,
          recipient_improvement: improvement
        });

        await pool.query(
          `UPDATE capacity_investments
           SET dividend_eligible = true, dividend_earned = $1, dividend_checked_at = NOW(), recipient_capacity_after = $2
           WHERE id = $3`,
          [dividendAmount, recipientBalance.balance, inv.id]
        );

        count++;
      } else {
        // Mark as checked even if no dividend earned
        await pool.query(
          `UPDATE capacity_investments SET dividend_checked_at = NOW(), recipient_capacity_after = $1 WHERE id = $2`,
          [recipientBalance.balance, inv.id]
        );
      }
    }
  } catch (err) {
    console.error('[CapacityCurrency] Dividend check failed:', err.message);
    Sentry.captureException(err);
  }

  return count;
}

// ── SAVINGS COMPUTATION ─────────────────────────────────────

/**
 * 90-day rolling weighted average with recency bias.
 *
 * @param {number} userDbId
 * @returns {Promise<number>}
 */
async function computeSavings(userDbId) {
  try {
    const snapshots = await pool.query(
      `SELECT snapshot_date, active_balance FROM capacity_snapshots
       WHERE user_id = $1 AND snapshot_date > CURRENT_DATE - INTERVAL '90 days'
       ORDER BY snapshot_date ASC`,
      [userDbId]
    );

    if (snapshots.rows.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < snapshots.rows.length; i++) {
      const dayAge = snapshots.rows.length - i; // 1 = most recent
      const weight = 1 / Math.sqrt(dayAge);
      weightedSum += parseFloat(snapshots.rows[i].active_balance) * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  } catch (err) {
    Sentry.captureException(err);
    return 0;
  }
}

// ── BALANCE HELPERS ─────────────────────────────────────────

async function getBalance(userId) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return { balance: 60, savings: 0, state: 'steady', overdraftActive: false };
    return await getBalanceByDbId(userRow.rows[0].id);
  } catch (err) {
    Sentry.captureException(err);
    return { balance: 60, savings: 0, state: 'steady', overdraftActive: false };
  }
}

async function getBalanceByDbId(userDbId) {
  try {
    const last = await pool.query(
      'SELECT balance_after, savings_after FROM capacity_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userDbId]
    );

    if (last.rows.length === 0) return { balance: 60, savings: 0, state: 'steady', overdraftActive: false };

    const balance = parseFloat(last.rows[0].balance_after);
    const savings = parseFloat(last.rows[0].savings_after);
    return { balance, savings, state: scoreToState(balance), overdraftActive: balance <= 19 };
  } catch (err) {
    return { balance: 60, savings: 0, state: 'steady', overdraftActive: false };
  }
}

module.exports = {
  computeCapacityScore,
  processTransaction,
  onSessionComplete,
  processWithdrawal,
  processInvestment,
  checkDividends,
  computeSavings,
  getBalance,
  scoreToState,
  DEFAULT_WEIGHTS,
  // Exported for testing
  _calculateSessionDeposit: calculateSessionDeposit
};
