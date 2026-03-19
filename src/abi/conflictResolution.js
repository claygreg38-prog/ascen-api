// ============================================================
// [ABI] Conflict Resolution Protocol — Escalation Detection & De-escalation
// File: src/abi/conflictResolution.js
//
// Monitors facilitated channels for escalation. Offers pause +
// breathing reset. Repair framework after breathing.
//
// REVIEW FINDING #4: Conflict resolution breathing is FIXED 4:6 at 6 BPM.
// NEVER uses determineBreathParams. NEVER uses either party's clinical profile.
// This is a de-escalation tool, not a clinical session.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// REVIEW FINDING #4: Fixed safe ratio — NEVER call determineBreathParams
const CONFLICT_BREATH_PARAMS = {
  inhale_seconds: 4,
  exhale_seconds: 6,
  bpm: 6,
  duration_seconds: 120 // 2 minutes
};

const REPAIR_FRAMEWORK = [
  "Share what you're FEELING (not what they did wrong)",
  "Share what you NEED (specific, not vague)",
  "Listen to what THEY'RE feeling",
  "Listen to what THEY need"
];

// ── DETECT ESCALATION ───────────────────────────────────────

async function detectEscalation(channelType, recentMessages, familyContext) {
  const aiRouter = require('../services/aiRouter');

  try {
    if (!recentMessages || recentMessages.length < 3) {
      return { escalated: false, score: 0, triggerMessageId: null };
    }

    // Check message-level indicators
    const lengths = recentMessages.map(m => (m.final_text || m.original_text || '').length);
    const lengthIncreasing = lengths.length >= 3 &&
      lengths[lengths.length - 1] > lengths[lengths.length - 2] &&
      lengths[lengths.length - 2] > lengths[lengths.length - 3];

    // Check response time pattern (decreasing = reactive)
    const timestamps = recentMessages.map(m => new Date(m.created_at).getTime());
    let responseTimesDecreasing = false;
    if (timestamps.length >= 3) {
      const gaps = [];
      for (let i = 1; i < timestamps.length; i++) {
        gaps.push(timestamps[i] - timestamps[i - 1]);
      }
      responseTimesDecreasing = gaps.length >= 2 &&
        gaps[gaps.length - 1] < gaps[gaps.length - 2] * 0.5;
    }

    // Use Sonnet for sentiment analysis
    const messageTexts = recentMessages.slice(-5).map((m, i) =>
      `Message ${i + 1} (${m.sender_type}): "${m.final_text || m.original_text}"`
    ).join('\n');

    const evalResult = await aiRouter.route('conflict_detection', `
      Analyze this conversation for escalation patterns:

      Channel: ${channelType}
      ${messageTexts}

      Look for:
      1. Negative sentiment escalation
      2. Personal attacks or blame language
      3. Accusation → defense → counter-accusation pattern
      4. Emotional reactivity increasing

      Respond as JSON:
      {
        "escalated": true/false,
        "score": 0.0-1.0,
        "pattern": "brief description of pattern detected"
      }
    `, {
      maxTokens: 200,
      temperature: 0.2,
      tenantId: familyContext?.tenantId
    });

    let analysis;
    try {
      analysis = JSON.parse(evalResult?.content || '{}');
    } catch {
      analysis = { escalated: false, score: 0 };
    }

    // Combine AI analysis with heuristics
    let combinedScore = analysis.score || 0;
    if (lengthIncreasing) combinedScore += 0.15;
    if (responseTimesDecreasing) combinedScore += 0.1;
    combinedScore = Math.min(1.0, combinedScore);

    const escalated = combinedScore >= 0.6 || analysis.escalated;
    const triggerMessageId = escalated ? recentMessages[recentMessages.length - 1]?.id : null;

    return { escalated, score: combinedScore, triggerMessageId, pattern: analysis.pattern || null };
  } catch (err) {
    console.error('[ConflictResolution] detectEscalation failed:', err.message);
    Sentry.captureException(err);
    return { escalated: false, score: 0, triggerMessageId: null };
  }
}

// ── OFFER PAUSE ─────────────────────────────────────────────

async function offerPause(familyUnitId, channelType, partyAId, partyBId, triggerMessageId, escalationScore, tenantId) {
  try {
    const result = await pool.query(
      `INSERT INTO conflict_events
       (family_unit_id, tenant_id, channel_type, trigger_message_id, escalation_score,
        pause_offered_at, party_a_id, party_b_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
       RETURNING id`,
      [familyUnitId, tenantId, channelType, triggerMessageId, escalationScore, partyAId, partyBId]
    );

    const eventId = result.rows[0].id;

    console.log(`[ConflictResolution] Pause offered: event ${eventId}, score ${escalationScore}`);

    return {
      eventId,
      message: "It seems like this conversation is getting heated. Would you like to pause and try a 2-minute breathing reset before continuing?",
      options: ['pause', 'continue'],
      breathParams: CONFLICT_BREATH_PARAMS
    };
  } catch (err) {
    console.error('[ConflictResolution] offerPause failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to offer pause' };
  }
}

// ── RESPOND TO PAUSE ────────────────────────────────────────

async function respondToPause(eventId, userId, response) {
  try {
    if (!['pause', 'continue'].includes(response)) {
      return { error: true, message: 'Response must be "pause" or "continue"' };
    }

    const event = await pool.query('SELECT * FROM conflict_events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) return { error: true, message: 'Conflict event not found' };

    const ev = event.rows[0];
    const isPartyA = ev.party_a_id === userId;
    const isPartyB = ev.party_b_id === userId;
    if (!isPartyA && !isPartyB) return { error: true, message: 'You are not a party to this conflict' };

    const field = isPartyA ? 'party_a_response' : 'party_b_response';
    await pool.query(`UPDATE conflict_events SET ${field} = $1 WHERE id = $2`, [response, eventId]);

    // Re-fetch to check both responses
    const updated = await pool.query('SELECT * FROM conflict_events WHERE id = $1', [eventId]);
    const upEv = updated.rows[0];

    const bothResponded = upEv.party_a_response && upEv.party_b_response;
    const bothPaused = upEv.party_a_response === 'pause' && upEv.party_b_response === 'pause';

    if (bothPaused) {
      // Create co-breath session with FIXED conflict ratio
      const breathingSessionId = await createConflictBreathingSession(
        upEv.family_unit_id, upEv.party_a_id, upEv.party_b_id, upEv.tenant_id
      );

      await pool.query(
        'UPDATE conflict_events SET breathing_session_id = $1 WHERE id = $2',
        [breathingSessionId, eventId]
      );

      return {
        eventId,
        bothPaused: true,
        breathingSessionId,
        breathParams: CONFLICT_BREATH_PARAMS,
        message: "Both of you chose to pause. Let's breathe together for 2 minutes."
      };
    }

    if (bothResponded && !bothPaused) {
      // One or both chose continue — channel stays open, coaching intensifies
      return {
        eventId,
        bothPaused: false,
        message: "The conversation will continue. Coaching will be more active to help keep things constructive."
      };
    }

    // Waiting for other party
    return { eventId, waiting: true, message: 'Waiting for the other person to respond.' };
  } catch (err) {
    console.error('[ConflictResolution] respondToPause failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to process response' };
  }
}

// ── CREATE CONFLICT BREATHING SESSION ───────────────────────

async function createConflictBreathingSession(familyUnitId, partyAId, partyBId, tenantId) {
  try {
    // Insert directly with FIXED params — do NOT use coBreathEngine or determineBreathParams
    const result = await pool.query(
      `INSERT INTO cobreath_sessions
       (family_unit_id, tenant_id, initiator_id, partner_id, session_mode,
        sync_ratio, duration_seconds, status)
       VALUES ($1, $2, $3, $4, 'sync', $5, $6, 'active')
       RETURNING id`,
      [familyUnitId, tenantId, partyAId, partyBId,
       `${CONFLICT_BREATH_PARAMS.inhale_seconds}:${CONFLICT_BREATH_PARAMS.exhale_seconds}`,
       CONFLICT_BREATH_PARAMS.duration_seconds]
    );
    return result.rows[0].id;
  } catch (err) {
    console.error('[ConflictResolution] createConflictBreathingSession failed:', err.message);
    return null;
  }
}

// ── COMPLETE BREATHING ──────────────────────────────────────

async function completeBreathing(eventId) {
  const aiRouter = require('../services/aiRouter');

  try {
    await pool.query(
      'UPDATE conflict_events SET breathing_session_completed = true, repair_framework_offered = true WHERE id = $1',
      [eventId]
    );

    // Offer structured repair framework via Sonnet
    const event = await pool.query('SELECT * FROM conflict_events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) return { error: true, message: 'Event not found' };

    const ev = event.rows[0];

    // Get the trigger message for context
    let triggerContext = '';
    if (ev.trigger_message_id) {
      const trigMsg = await pool.query('SELECT original_text, channel_type FROM facilitated_messages WHERE id = $1', [ev.trigger_message_id]);
      if (trigMsg.rows.length > 0) {
        triggerContext = `The conversation was about: "${trigMsg.rows[0].original_text.substring(0, 200)}"`;
      }
    }

    const repairResult = await aiRouter.route('conflict_detection', `
      A couple/family just completed a 2-minute breathing pause after an escalating conversation.
      ${triggerContext}

      Provide a warm, brief opening message to guide them into the repair framework.
      The framework steps are:
      1. Share what you're FEELING (not what they did wrong)
      2. Share what you NEED (specific, not vague)
      3. Listen to what THEY'RE feeling
      4. Listen to what THEY need

      Respond with just the opening message (2-3 sentences, warm and encouraging).
    `, { maxTokens: 200, temperature: 0.5 });

    return {
      eventId,
      breathingCompleted: true,
      repairFramework: REPAIR_FRAMEWORK,
      openingMessage: repairResult?.content || "You both chose to pause and breathe together. That takes real courage. Here's a framework to help you reconnect:",
      breathParams: CONFLICT_BREATH_PARAMS
    };
  } catch (err) {
    console.error('[ConflictResolution] completeBreathing failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to complete breathing' };
  }
}

// ── CHECK EXTENDED ESCALATION ───────────────────────────────

async function checkExtendedEscalation(familyUnitId, channelType) {
  try {
    // Count messages since last conflict event
    const lastEvent = await pool.query(
      `SELECT created_at FROM conflict_events
       WHERE family_unit_id = $1 AND channel_type = $2
       ORDER BY created_at DESC LIMIT 1`,
      [familyUnitId, channelType]
    );

    const since = lastEvent.rows.length > 0
      ? lastEvent.rows[0].created_at
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const messageCount = await pool.query(
      `SELECT COUNT(*) as count FROM facilitated_messages
       WHERE family_unit_id = $1 AND channel_type = $2 AND created_at > $3`,
      [familyUnitId, channelType, since]
    );

    const count = parseInt(messageCount.rows[0]?.count) || 0;

    if (count >= 5) {
      // Flag for clinical review
      if (lastEvent.rows.length > 0) {
        await pool.query(
          `UPDATE conflict_events SET clinical_flag = true,
             resolution_outcome = 'referred_to_therapist'
           WHERE family_unit_id = $1 AND channel_type = $2
           ORDER BY created_at DESC LIMIT 1`,
          [familyUnitId, channelType]
        );
      }

      return {
        extended: true,
        message: "This conversation may benefit from a therapist's guidance. Would you like to save this exchange for your next session?",
        clinicalFlag: true
      };
    }

    return { extended: false };
  } catch (err) {
    return { extended: false };
  }
}

// ── GET CONFLICT HISTORY ────────────────────────────────────

async function getConflictHistory(familyUnitId, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT * FROM conflict_events
       WHERE family_unit_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [familyUnitId, limit]
    );
    return result.rows;
  } catch (err) {
    return [];
  }
}

module.exports = {
  detectEscalation,
  offerPause,
  respondToPause,
  completeBreathing,
  checkExtendedEscalation,
  getConflictHistory,
  CONFLICT_BREATH_PARAMS,
  REPAIR_FRAMEWORK
};
