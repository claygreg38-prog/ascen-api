// ============================================================
// Isolation Prevention — Post-Quilting Safety
// File: src/services/isolationPrevention.js
//
// No family member is left alone with what surfaces.
// The most dangerous moment is not the disclosure —
// it is the moment AFTER when the person who spoke
// looks around and feels alone.
//
// Fires after EVERY quilting session (completed or converted).
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');

async function postSessionCheckins(quiltingSessionId) {
  const session = await pool.query(
    'SELECT participants, family_unit_id FROM quilting_sessions WHERE id = $1',
    [quiltingSessionId]
  );
  if (!session.rows.length) return;

  const participants = session.rows[0].participants || [];
  const familyUnitId = session.rows[0].family_unit_id;

  for (const participant of participants) {
    const message = 'You shared something important today. How are you feeling right now?';

    // Schedule check-in (2 hours after session)
    await pool.query(`
      INSERT INTO quilting_checkins (quilting_session_id, user_id, message_sent)
      VALUES ($1, $2, $3)
    `, [quiltingSessionId, participant.user_id, message]);

    // Queue notification via existing notification system
    await pool.query(`
      INSERT INTO notification_queue (user_id, type, content, scheduled_for)
      VALUES ($1, 'quilting_checkin', $2, NOW() + INTERVAL '2 hours')
    `, [participant.user_id, JSON.stringify({ message, quilting_session_id: quiltingSessionId })]);
  }

  // Priority co-breath invitations for 48 hours
  await pool.query(`
    UPDATE family_units SET co_breath_priority = true, co_breath_priority_until = NOW() + INTERVAL '48 hours'
    WHERE family_unit_id = $1
  `, [familyUnitId]);

  // FIX #7: LightBridge hardware integration — future build.
  // The lightbridge_devices table exists (Migration 020) but does NOT have
  // override_pattern or override_until columns. Querying them would log errors
  // to Sentry on every quilting session even inside try/catch.
  // TODO: LightBridge warm pattern integration — add override columns in future migration,
  // then wire: UPDATE lightbridge_devices SET override_pattern = 'quilting_warmth',
  // override_until = NOW() + INTERVAL '24 hours' WHERE family_unit_id = $1 AND is_active = true
}

async function processCheckinResponse(checkinId, response) {
  // FIX #5: Reduce false positives in distress detection.
  // Single keyword match = flag for facilitator review but NOT marked as distress_detected.
  // Require 2+ keyword matches to flag as distress. Prevents false Sentry warnings
  // from "I hurt my toe" or "it felt worse than expected but I'm okay."
  const distressKeywords = ['scared', 'alone', 'hurt', 'broken', 'mistake', 'shouldn\'t have', 'regret', 'worse'];
  const lowerResponse = response.toLowerCase();
  const matchCount = distressKeywords.filter(kw => lowerResponse.includes(kw)).length;
  const distressDetected = matchCount >= 2;
  const facilitatorReview = matchCount >= 1;

  await pool.query(`
    UPDATE quilting_checkins SET response = $1, distress_detected = $2, responded_at = NOW()
    WHERE id = $3
  `, [response, distressDetected, checkinId]);

  if (facilitatorReview) {
    // Always notify facilitator on any keyword match (single or multiple)
    const checkin = await pool.query(
      `SELECT qc.user_id, qs.family_unit_id FROM quilting_checkins qc
       JOIN quilting_sessions qs ON qs.id = qc.quilting_session_id WHERE qc.id = $1`,
      [checkinId]
    );

    await pool.query(
      'UPDATE quilting_checkins SET facilitator_notified = true WHERE id = $1',
      [checkinId]
    );

    if (distressDetected) {
      // 2+ keywords: full distress flag + Sentry warning
      Sentry.captureMessage(`Quilting check-in distress detected: user ${checkin.rows[0]?.user_id}`, 'warning');
    }
    // Single keyword: facilitator notified but no Sentry alert — reduces noise
  }

  return { distress_detected: distressDetected, facilitator_review: facilitatorReview };
}

module.exports = { postSessionCheckins, processCheckinResponse };
