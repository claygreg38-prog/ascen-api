// ============================================================
// Ripple Signal Service
// "They showed up today." — one quiet ping per day to a supporter.
//
// RULES (LOCKED):
// - Message content is EXACTLY: "They showed up today."
// - Never includes session data, vault content, biometrics, or mood
// - One ping per 24h per recipient maximum
// - Opt-in only, recipient must confirm via SMS
// - User can pause/remove at any time
// - Recipient can opt out by replying STOP (Twilio auto-handles)
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');
const smsService = require('./smsService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const RIPPLE_MESSAGE = 'They showed up today.';

const CONFIRMATION_MESSAGE =
  'Your person added you to ASCEN Ripple Signal. ' +
  "You'll get a quiet message when they show up to do their breathing work. " +
  'Reply YES to confirm. Reply STOP anytime to opt out.';

async function addRecipient(userId, recipientPhone, recipientName) {
  // Check for existing signal for this user
  const existing = await pool.query(
    "SELECT id, status FROM ripple_signals WHERE user_id = $1 AND status != 'removed'",
    [userId]
  );
  if (existing.rows.length > 0) {
    return { error: 'You already have a Ripple Signal recipient. Remove the current one first.' };
  }

  const result = await pool.query(
    `INSERT INTO ripple_signals (user_id, recipient_phone, recipient_name, status)
     VALUES ($1, $2, $3, 'pending') RETURNING id, status`,
    [userId, recipientPhone, recipientName || null]
  );

  // Send confirmation SMS to recipient
  await smsService.sendSMS(recipientPhone, CONFIRMATION_MESSAGE);

  return { id: result.rows[0].id, status: 'pending' };
}

async function confirmRecipient(recipientPhone) {
  const result = await pool.query(
    `UPDATE ripple_signals SET status = 'confirmed', confirmed_at = NOW()
     WHERE recipient_phone = $1 AND status = 'pending' RETURNING id, user_id`,
    [recipientPhone]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function pauseSignal(userId) {
  await pool.query(
    "UPDATE ripple_signals SET status = 'paused' WHERE user_id = $1 AND status = 'confirmed'",
    [userId]
  );
}

async function resumeSignal(userId) {
  await pool.query(
    "UPDATE ripple_signals SET status = 'confirmed' WHERE user_id = $1 AND status = 'paused'",
    [userId]
  );
}

async function removeSignal(userId, signalId) {
  await pool.query(
    "UPDATE ripple_signals SET status = 'removed' WHERE id = $1 AND user_id = $2",
    [signalId, userId]
  );
}

async function getStatus(userId) {
  const result = await pool.query(
    "SELECT id, recipient_phone, recipient_name, status, send_count, last_sent_at FROM ripple_signals WHERE user_id = $1 AND status != 'removed' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : { status: 'none' };
}

/**
 * Fire the ripple if applicable. Called after session completion.
 * Non-blocking — failure here never blocks session completion.
 */
async function fireRippleIfApplicable(userId) {
  try {
    const ripple = await pool.query(
      "SELECT id, recipient_phone, last_sent_at FROM ripple_signals WHERE user_id = $1 AND status = 'confirmed'",
      [userId]
    );

    if (ripple.rows.length === 0) return;

    const signal = ripple.rows[0];

    // Rate limit: max 1 per 24 hours
    if (signal.last_sent_at) {
      const hoursSince = (Date.now() - new Date(signal.last_sent_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }

    // Send EXACTLY this message
    await smsService.sendSMS(signal.recipient_phone, RIPPLE_MESSAGE);

    await pool.query(
      'UPDATE ripple_signals SET last_sent_at = NOW(), send_count = send_count + 1 WHERE id = $1',
      [signal.id]
    );

    console.log('[RIPPLE] Sent to', signal.recipient_phone);
  } catch (err) {
    // Non-blocking — session completion continues regardless
    console.error('[RIPPLE] Fire failed (non-blocking):', err.message);
    Sentry.captureException(err);
  }
}

module.exports = {
  RIPPLE_MESSAGE,
  addRecipient,
  confirmRecipient,
  pauseSignal,
  resumeSignal,
  removeSignal,
  getStatus,
  fireRippleIfApplicable
};
