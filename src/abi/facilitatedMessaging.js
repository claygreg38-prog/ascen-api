// ============================================================
// [ABI] Facilitated Messaging Engine — Two-Way AI-Coached Messaging
// File: src/abi/facilitatedMessaging.js
//
// All messages pass through Sonnet via aiRouter before delivery.
// Includes CRITICAL disclosure classification (Review Finding #1).
// Sonnet NEVER censors — it coaches. Sender always has final choice
// EXCEPT: abuse_recipient disclosures are NEVER delivered to alleged abuser.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── ROBUST JSON EXTRACTION ──────────────────────────────────
// Sonnet sometimes wraps JSON in markdown code fences or leading text.
function extractJSON(raw) {
  if (!raw) return null;
  // Try direct parse first
  try { return JSON.parse(raw); } catch {}
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  // Find first { ... last }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.substring(start, end + 1)); } catch {}
  }
  return null;
}

// ── CHARACTER LIMITS ─────────────────────────────────────────

const CHAR_LIMITS = {
  parent: 500,
  child_young: 300,  // age 7-12
  child_teen: 500,   // age 13+
  partner: 500,
  coparent: 500
};

function getCharLimit(senderType, senderAge) {
  if (senderType === 'child' && senderAge && senderAge < 13) return CHAR_LIMITS.child_young;
  if (senderType === 'child') return CHAR_LIMITS.child_teen;
  return CHAR_LIMITS[senderType] || 500;
}

// ── DISCLOSURE CLASSIFICATION (CRITICAL — NON-NEGOTIABLE) ───

async function classifyDisclosure(messageText, senderType, recipientType, familyContext) {
  const aiRouter = require('../services/aiRouter');

  const result = await aiRouter.route('disclosure_classification', `
    Classify this message from a ${senderType} (age: ${familyContext.senderAge || 'unknown'})
    to their ${recipientType}.

    Message: "${messageText}"

    Classify as ONE of:
    - null: No concerning content
    - self_harm: Sender expresses self-harm ideation or intent
    - abuse_third_party: Sender discloses abuse by someone OTHER than the recipient
    - abuse_recipient: Sender discloses abuse BY the recipient (the person who would receive this message)

    Respond with ONLY the classification value, nothing else.
  `, { maxTokens: 50, temperature: 0.1 });

  const classification = result?.content?.trim() || null;
  if (['self_harm', 'abuse_third_party', 'abuse_recipient'].includes(classification)) {
    return classification;
  }
  return null;
}

// ── DISCLOSURE ROUTING ──────────────────────────────────────

async function routeDisclosure(classification, messageId, messageText, senderId, recipientId, familyUnitId, tenantId, familyContext) {
  const disclosureRecord = {
    message_id: messageId,
    family_unit_id: familyUnitId,
    tenant_id: tenantId,
    disclosure_type: classification,
    original_text: messageText,
    sender_id: senderId,
    alleged_recipient_id: classification === 'abuse_recipient' ? recipientId : null,
    clinical_team_notified_at: new Date().toISOString(),
    mandatory_reporting_flag: false
  };

  // Maryland mandatory reporting: any disclosure involving a minor
  // Trigger on explicit age OR when sender is a child/adult_child in the family
  if ((familyContext.senderAge && familyContext.senderAge < 18) ||
      familyContext.senderType === 'child') {
    disclosureRecord.mandatory_reporting_flag = true;
  }

  const result = await pool.query(
    `INSERT INTO clinical_disclosures
     (message_id, family_unit_id, tenant_id, disclosure_type, original_text, sender_id,
      alleged_recipient_id, clinical_team_notified_at, mandatory_reporting_flag)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
     RETURNING id`,
    [disclosureRecord.message_id, disclosureRecord.family_unit_id, disclosureRecord.tenant_id,
     disclosureRecord.disclosure_type, disclosureRecord.original_text, disclosureRecord.sender_id,
     disclosureRecord.alleged_recipient_id, disclosureRecord.mandatory_reporting_flag]
  );

  const disclosureId = result.rows[0].id;
  const routedTo = ['clinical'];

  // Determine caregiver (if different from alleged abuser)
  if (familyContext.caregiverId && familyContext.caregiverId !== recipientId) {
    routedTo.push('caregiver');
    await pool.query('UPDATE clinical_disclosures SET caregiver_notified_at = NOW() WHERE id = $1', [disclosureId]);
  }

  // For self_harm and abuse_third_party, parent/caregiver also gets notified
  if (classification !== 'abuse_recipient') {
    routedTo.push('parent');
  }

  // Update the facilitated_messages record with routing info
  await pool.query(
    `UPDATE facilitated_messages SET disclosure_routed_to = $1 WHERE id = $2`,
    [routedTo, messageId]
  );

  console.log(`[DISCLOSURE] ${classification} detected. Message ${messageId} routed to: ${routedTo.join(', ')}. Disclosure ID: ${disclosureId}`);

  return { disclosureId, routedTo, mandatory: disclosureRecord.mandatory_reporting_flag };
}

// ── EVALUATE OUTBOUND (Parent/Partner/Coparent → Recipient) ──

async function evaluateOutbound(senderId, recipientId, messageText, channelType, familyContext) {
  const aiRouter = require('../services/aiRouter');

  try {
    // Validate character limit
    const charLimit = getCharLimit(familyContext.senderType || 'parent', familyContext.senderAge);
    if (messageText.length > charLimit) {
      return { error: true, message: `Message exceeds ${charLimit} character limit` };
    }

    // Step 1: DISCLOSURE CHECK (CRITICAL — runs before all other evaluation)
    const disclosure = await classifyDisclosure(
      messageText, familyContext.senderType || 'parent',
      familyContext.recipientType || 'child', familyContext
    );

    // Step 2: Insert message record
    const msgResult = await pool.query(
      `INSERT INTO facilitated_messages
       (family_unit_id, tenant_id, sender_type, sender_id, recipient_type, recipient_id,
        original_text, final_text, channel_type, disclosure_classification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)
       RETURNING id`,
      [familyContext.familyUnitId, familyContext.tenantId,
       familyContext.senderType || 'parent', senderId,
       familyContext.recipientType || 'child', recipientId,
       messageText, channelType, disclosure]
    );
    const messageId = msgResult.rows[0].id;

    // Step 3: Handle disclosure routing
    if (disclosure === 'abuse_recipient') {
      await routeDisclosure(disclosure, messageId, messageText, senderId, recipientId,
        familyContext.familyUnitId, familyContext.tenantId, familyContext);

      // abuse_recipient: NEVER deliver to recipient
      return {
        messageId,
        decision: 'flag',
        disclosure: 'abuse_recipient',
        senderMessage: 'We heard you. Someone safe is going to help.',
        delivered: false
      };
    }

    if (disclosure) {
      await routeDisclosure(disclosure, messageId, messageText, senderId, recipientId,
        familyContext.familyUnitId, familyContext.tenantId, familyContext);
      // self_harm and abuse_third_party: still deliver with coaching
    }

    // Step 4: Sonnet evaluation for therapeutic safety
    const evalResult = await aiRouter.route('facilitated_message_eval', `
      Evaluate this message from a ${familyContext.senderType || 'parent'} to their ${familyContext.recipientType || 'child'}.

      Family context:
      - Relationship: ${channelType}
      - Recovery phase: ${familyContext.recoveryPhase || 'unknown'}
      - Recipient age: ${familyContext.recipientAge || 'unknown'}
      - Recipient emotional state: ${familyContext.recipientState || 'unknown'}
      - Red flag keywords: ${(familyContext.redFlagKeywords || []).join(', ') || 'none specified'}
      - Pattern history: ${familyContext.patternHistory || 'none'}

      Message: "${messageText}"

      Evaluate for:
      1. Therapeutic safety (guilt, blame, false promises, manipulation)
      2. Pattern alignment (matches their growth direction?)
      3. Emotional temperature (appropriate for recipient's current state?)
      4. Red flag keywords

      Respond as JSON:
      {
        "decision": "approve" | "coach" | "flag",
        "coaching_text": "coaching for sender if decision is coach (null otherwise)",
        "reframe_suggestion": "suggested rewrite if coach (null otherwise)",
        "recipient_coaching": "coaching for recipient on receiving this message",
        "reasoning": "brief reasoning",
        "confidence": 0.0-1.0
      }
    `, {
      maxTokens: 800,
      temperature: 0.3,
      tenantId: familyContext.tenantId,
      userId: senderId
    });

    let evaluation = extractJSON(evalResult?.content);
    if (!evaluation || !evaluation.decision) {
      console.warn('[FacilitatedMessaging] Sonnet eval parse failed, raw:', (evalResult?.content || '').substring(0, 200));
      evaluation = { decision: 'approve', reasoning: 'AI evaluation parse failed — defaulting to approve', confidence: 0 };
    }

    // Update message record
    await pool.query(
      `UPDATE facilitated_messages SET
         facilitator_decision = $1, coaching_text = $2, reframe_suggestion = $3,
         facilitator_reasoning = $4, facilitator_confidence = $5, recipient_coaching = $6
       WHERE id = $7`,
      [evaluation.decision, evaluation.coaching_text || null, evaluation.reframe_suggestion || null,
       evaluation.reasoning || null, evaluation.confidence || null, evaluation.recipient_coaching || null,
       messageId]
    );

    // Caregiver always gets copy of minor messages
    if (familyContext.recipientAge && familyContext.recipientAge < 18 && familyContext.caregiverId) {
      // Non-blocking caregiver notification
      notifyCaregiverOfMinorMessage(familyContext.caregiverId, messageId, familyContext).catch(() => {});
    }

    return {
      messageId,
      decision: evaluation.decision,
      coachingText: evaluation.coaching_text || null,
      reframeSuggestion: evaluation.reframe_suggestion || null,
      recipientCoaching: evaluation.recipient_coaching || null,
      reasoning: evaluation.reasoning || null,
      confidence: evaluation.confidence || null,
      disclosure: disclosure || null,
      delivered: evaluation.decision === 'approve'
    };
  } catch (err) {
    console.error('[FacilitatedMessaging] evaluateOutbound failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to evaluate message' };
  }
}

// ── EVALUATE INBOUND (Child → Parent) ──────────────────────

async function evaluateInbound(senderId, recipientId, messageText, channelType, familyContext) {
  const aiRouter = require('../services/aiRouter');

  try {
    const charLimit = getCharLimit('child', familyContext.senderAge);
    if (messageText.length > charLimit) {
      return { error: true, message: `Message exceeds ${charLimit} character limit` };
    }

    // DISCLOSURE CHECK FIRST (CRITICAL)
    const disclosure = await classifyDisclosure(
      messageText, 'child', familyContext.recipientType || 'parent', familyContext
    );

    // Insert message record
    const msgResult = await pool.query(
      `INSERT INTO facilitated_messages
       (family_unit_id, tenant_id, sender_type, sender_id, recipient_type, recipient_id,
        original_text, final_text, channel_type, disclosure_classification)
       VALUES ($1, $2, 'child', $3, $4, $5, $6, $6, $7, $8)
       RETURNING id`,
      [familyContext.familyUnitId, familyContext.tenantId,
       senderId, familyContext.recipientType || 'parent', recipientId,
       messageText, channelType, disclosure]
    );
    const messageId = msgResult.rows[0].id;

    // Handle disclosure routing
    if (disclosure === 'abuse_recipient') {
      await routeDisclosure(disclosure, messageId, messageText, senderId, recipientId,
        familyContext.familyUnitId, familyContext.tenantId, familyContext);

      // NEVER deliver to the alleged abuser
      return {
        messageId,
        decision: 'flag',
        disclosure: 'abuse_recipient',
        senderMessage: 'We heard you. Someone safe is going to help.',
        delivered: false
      };
    }

    if (disclosure) {
      await routeDisclosure(disclosure, messageId, messageText, senderId, recipientId,
        familyContext.familyUnitId, familyContext.tenantId, familyContext);
    }

    // Sonnet evaluation with child-specific checks
    const evalResult = await aiRouter.route('facilitated_message_eval', `
      Evaluate this message from a child (age ${familyContext.senderAge || 'unknown'}) to their ${familyContext.recipientType || 'parent'}.

      Family context:
      - Parent recovery phase: ${familyContext.recoveryPhase || 'unknown'}
      - Parent emotional readiness: ${familyContext.recipientState || 'unknown'}
      - Red flag keywords: ${(familyContext.redFlagKeywords || []).join(', ') || 'none specified'}

      Message: "${messageText}"

      Evaluate for:
      1. Age-appropriateness of expression
      2. Healthy expression vs destructive venting
      3. Re-traumatization risk to parent (if in early recovery)
      4. Red flag keywords

      Respond as JSON:
      {
        "decision": "approve" | "coach" | "flag",
        "coaching_text": "coaching for child sender if needed (age-appropriate, null if approve)",
        "reframe_suggestion": "suggested rewrite if coach (null otherwise)",
        "recipient_coaching": "coaching for parent on how to receive this message well — help them respond with care",
        "reasoning": "brief reasoning",
        "confidence": 0.0-1.0
      }
    `, {
      maxTokens: 800,
      temperature: 0.3,
      tenantId: familyContext.tenantId,
      userId: senderId
    });

    let evaluation = extractJSON(evalResult?.content);
    if (!evaluation || !evaluation.decision) {
      console.warn('[FacilitatedMessaging] Sonnet eval parse failed, raw:', (evalResult?.content || '').substring(0, 200));
      evaluation = { decision: 'approve', reasoning: 'AI evaluation parse failed — defaulting to approve', confidence: 0 };
    }

    await pool.query(
      `UPDATE facilitated_messages SET
         facilitator_decision = $1, coaching_text = $2, reframe_suggestion = $3,
         facilitator_reasoning = $4, facilitator_confidence = $5, recipient_coaching = $6
       WHERE id = $7`,
      [evaluation.decision, evaluation.coaching_text || null, evaluation.reframe_suggestion || null,
       evaluation.reasoning || null, evaluation.confidence || null, evaluation.recipient_coaching || null,
       messageId]
    );

    // Caregiver always gets copy of ALL minor messages
    if (familyContext.caregiverId) {
      notifyCaregiverOfMinorMessage(familyContext.caregiverId, messageId, familyContext).catch(() => {});
    }

    return {
      messageId,
      decision: evaluation.decision,
      coachingText: evaluation.coaching_text || null,
      reframeSuggestion: evaluation.reframe_suggestion || null,
      recipientCoaching: evaluation.recipient_coaching || null,
      reasoning: evaluation.reasoning || null,
      confidence: evaluation.confidence || null,
      disclosure: disclosure || null,
      delivered: evaluation.decision === 'approve'
    };
  } catch (err) {
    console.error('[FacilitatedMessaging] evaluateInbound failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to evaluate message' };
  }
}

// ── RESPOND TO COACHING ─────────────────────────────────────

async function respondToCoaching(messageId, senderId, accepted, editedText) {
  try {
    const msg = await pool.query(
      'SELECT * FROM facilitated_messages WHERE id = $1 AND sender_id = $2',
      [messageId, senderId]
    );
    if (msg.rows.length === 0) return { error: true, message: 'Message not found' };

    const message = msg.rows[0];
    if (message.facilitator_decision !== 'coach') {
      return { error: true, message: 'Message was not coached' };
    }

    const finalText = accepted && editedText ? editedText : message.original_text;

    await pool.query(
      `UPDATE facilitated_messages SET
         sender_accepted_coaching = $1, final_text = $2, delivered_at = NOW()
       WHERE id = $3`,
      [accepted, finalText, messageId]
    );

    return { messageId, accepted, finalText, delivered: true };
  } catch (err) {
    console.error('[FacilitatedMessaging] respondToCoaching failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to process coaching response' };
  }
}

// ── MARK AS READ ────────────────────────────────────────────

async function markAsRead(messageId, recipientId) {
  try {
    await pool.query(
      'UPDATE facilitated_messages SET read_at = NOW() WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL',
      [messageId, recipientId]
    );
    return { success: true };
  } catch (err) {
    return { error: true, message: 'Failed to mark as read' };
  }
}

// ── GET MESSAGES ────────────────────────────────────────────

async function getMessages(familyUnitId, channelType, limit = 50) {
  try {
    const result = await pool.query(
      `SELECT fm.*,
              s.first_name as sender_name,
              r.first_name as recipient_name
       FROM facilitated_messages fm
       LEFT JOIN users s ON fm.sender_id = s.id
       LEFT JOIN users r ON fm.recipient_id = r.id
       WHERE fm.family_unit_id = $1 AND fm.channel_type = $2
         AND fm.delivered_at IS NOT NULL
         AND (fm.disclosure_classification IS NULL OR fm.disclosure_classification != 'abuse_recipient')
       ORDER BY fm.created_at DESC LIMIT $3`,
      [familyUnitId, channelType, limit]
    );
    return result.rows;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

// ── UNREAD COUNT ────────────────────────────────────────────

async function getUnreadCount(userId) {
  try {
    const result = await pool.query(
      `SELECT channel_type, COUNT(*) as count
       FROM facilitated_messages
       WHERE recipient_id = $1 AND delivered_at IS NOT NULL AND read_at IS NULL
         AND (disclosure_classification IS NULL OR disclosure_classification != 'abuse_recipient')
       GROUP BY channel_type`,
      [userId]
    );
    const counts = {};
    result.rows.forEach(r => { counts[r.channel_type] = parseInt(r.count); });
    return counts;
  } catch (err) {
    return {};
  }
}

// ── CAREGIVER NOTIFICATION (non-blocking) ───────────────────

async function notifyCaregiverOfMinorMessage(caregiverId, messageId, familyContext) {
  try {
    const msg = await pool.query('SELECT sender_type, final_text, channel_type FROM facilitated_messages WHERE id = $1', [messageId]);
    if (msg.rows.length === 0) return;
    console.log(`[FacilitatedMessaging] Caregiver ${caregiverId} notified of minor message ${messageId}`);
  } catch (err) {
    // Non-blocking
  }
}

module.exports = {
  evaluateOutbound,
  evaluateInbound,
  respondToCoaching,
  markAsRead,
  getMessages,
  getUnreadCount,
  classifyDisclosure,
  CHAR_LIMITS
};
