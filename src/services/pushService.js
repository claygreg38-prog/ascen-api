// ============================================================
// Push Notification Service — Firebase (APNs + FCM)
// File: src/services/pushService.js
//
// Sends push notifications to iOS (APNs via Firebase) and
// Android (FCM). Gracefully degrades if Firebase not configured.
// Marks expired tokens inactive automatically.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let firebaseAdmin = null;

function getFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  if (!process.env.FIREBASE_PROJECT_ID) return null;

  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
        })
      });
    }
    firebaseAdmin = admin;
    return admin;
  } catch (err) {
    console.warn('[PUSH] Firebase init failed:', err.message);
    return null;
  }
}

async function sendPush(userId, title, body, data = {}) {
  try {
    const tokens = await pool.query(
      'SELECT push_token, platform FROM push_device_tokens WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    if (tokens.rows.length === 0) return { sent: 0 };

    const admin = getFirebase();
    if (!admin) {
      console.log(`[PUSH SIM] → user ${userId}: "${title}" — "${body}"`);
      return { sent: 0, simulated: true };
    }

    let sent = 0;
    for (const token of tokens.rows) {
      try {
        await admin.messaging().send({
          token: token.push_token,
          notification: { title, body },
          data: { ...data, type: data.type || 'general' },
          android: { priority: 'high' },
          apns: { payload: { aps: { badge: 1, sound: 'default' } } }
        });
        sent++;

        await pool.query('UPDATE push_device_tokens SET last_used_at = NOW() WHERE push_token = $1', [token.push_token]);
      } catch (err) {
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          await pool.query('UPDATE push_device_tokens SET is_active = false WHERE push_token = $1', [token.push_token]);
          console.log(`[PUSH] Token expired, marked inactive: ${token.push_token.substring(0, 20)}...`);
        } else {
          console.error('[PUSH] Send failed:', err.message);
          Sentry.captureException(err);
        }
      }
    }

    return { sent };
  } catch (err) {
    console.error('[PUSH] sendPush failed:', err.message);
    Sentry.captureException(err);
    return { sent: 0, error: err.message };
  }
}

async function sendPushToFamily(familyUnitId, title, body, data = {}, excludeUserId = null) {
  try {
    const members = await pool.query(
      'SELECT user_id FROM family_memberships WHERE family_unit_id = $1',
      [familyUnitId]
    );

    let sent = 0;
    for (const m of members.rows) {
      if (excludeUserId && m.user_id === excludeUserId) continue;
      const result = await sendPush(m.user_id, title, body, data);
      sent += result.sent || 0;
    }

    return { sent };
  } catch (err) {
    return { sent: 0 };
  }
}

async function registerToken(userId, platform, pushToken) {
  try {
    await pool.query(
      `INSERT INTO push_device_tokens (user_id, platform, push_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, push_token) DO UPDATE SET is_active = true, last_used_at = NOW()`,
      [userId, platform, pushToken]
    );
    return { registered: true };
  } catch (err) {
    console.error('[PUSH] registerToken failed:', err.message);
    return { error: true, message: 'Failed to register token' };
  }
}

async function unregisterToken(pushToken) {
  try {
    await pool.query('UPDATE push_device_tokens SET is_active = false WHERE push_token = $1', [pushToken]);
    return { unregistered: true };
  } catch (err) {
    return { error: true };
  }
}

module.exports = { sendPush, sendPushToFamily, registerToken, unregisterToken };
