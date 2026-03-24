// ============================================================
// SMS Service — Twilio Integration + Auth Gate
// File: src/services/smsService.js
//
// Production-grade: sends via Twilio, queues failures.
// Phone auth returns 503 when Twilio not configured.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let twilioClient = null;
let smsAvailable = false;

function initSMS() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('[SMS] No Twilio credentials — phone auth will return 503');
    Sentry.captureMessage('Production running without Twilio — phone auth disabled', 'warning');
    smsAvailable = false;
    return false;
  }
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    smsAvailable = true;
    console.log('[SMS] Twilio initialized');
    return true;
  } catch (err) {
    console.error('[SMS] Twilio init failed:', err.message);
    Sentry.captureException(err);
    smsAvailable = false;
    return false;
  }
}

function isSMSAvailable() {
  return smsAvailable;
}

async function sendSMS(to, body) {
  if (!twilioClient) {
    // Queue instead of dropping
    try {
      await pool.query(
        `INSERT INTO notification_queue (type, recipient, body_text, status, last_error)
         VALUES ('sms', $1, $2, 'failed', 'Twilio not configured')`,
        [to, body]
      );
    } catch (err) {
      console.error('[SMS] Queue insert failed:', err.message);
      Sentry.captureException(err);
    }
    return { queued: true, sent: false };
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });
    console.log(`[SMS] Sent to ${to}: ${message.sid}`);
    return { sid: message.sid, sent: true };
  } catch (err) {
    console.error('[SMS] Send failed:', err.message);
    Sentry.captureException(err);
    try {
      await pool.query(
        `INSERT INTO notification_queue (type, recipient, body_text, status, last_error)
         VALUES ('sms', $1, $2, 'retrying', $3)`,
        [to, body, err.message]
      );
    } catch (qErr) {
      console.error('[SMS] Queue insert failed:', qErr.message);
    }
    return { error: err.message, queued: true, sent: false };
  }
}

async function sendVerificationSMS(phone, code) {
  return sendSMS(phone, `ASCEN BreathWorx verification code: ${code}. Expires in 15 minutes.`);
}

module.exports = { initSMS, isSMSAvailable, sendSMS, sendVerificationSMS };
