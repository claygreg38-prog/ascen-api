// ============================================================
// Quilting Engine — ABI Module (System Weave)
// File: src/abi/quiltingEngine.js
//
// Manages the 4-session graduated quilt assembly with AXIS
// evaluation between each session.
//
// Session 1: Elder as Witness → Parent receives
// Session 2: Parent as Bridge → Elder acknowledges
// Session 3: Child as Mirror → Parent + Elder receive (Sonnet monitored)
// Session 4: Full family weave → quilted pattern emerges
//
// Co-breath bookends EVERY session. Receipt before response.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const pool = require('../db/pool');
const { evaluateGate, evaluateAllGates, getGateStatus } = require('../axis/gateEvaluationEngine');
const { runAsymmetricVulnerabilityCheck } = require('../axis/asymmetricVulnerabilityCheck');
const lineageService = require('../services/lineageService');
// FIX #9: Import age config for child mirror format
const { getAgeConfig } = require('../middleware/ageFilter');
const { computeAgeBracket } = require('../services/personaEngine');
// FIX #10: Import existing disclosure routing system (battle-tested, 4/4 scenarios verified)
const { classifyDisclosure, routeDisclosure } = require('./facilitatedMessaging');

// ── SESSION MANAGEMENT ────────────────────────────────────────

async function startQuiltSession(familyUnitId, sessionNumber, tenantId) {
  // Pre-session AXIS check: evaluate the required gate
  const requiredGate = getRequiredGate(sessionNumber);
  const gateResult = await evaluateGate(familyUnitId, requiredGate);

  if (gateResult.status !== 'open') {
    return {
      error: 'gate_locked',
      gate: requiredGate,
      criteria: gateResult.criteria,
      // Family never knows gates exist — Luno says "Let's keep building"
      luno_says: "Your family is building something beautiful. Let's keep strengthening the foundation."
    };
  }

  // Session 3: Re-run asymmetric vulnerability check even if Gate 3 passed days ago
  if (sessionNumber === 3) {
    const vulnCheck = await runAsymmetricVulnerabilityCheck(familyUnitId);
    if (!vulnCheck.met) {
      return {
        error: 'vulnerability_check_failed',
        details: vulnCheck,
        luno_says: "Let's do some more work together first. There's no rush."
      };
    }
  }

  // Get participants
  const members = await pool.query(
    `SELECT fm.user_id, fm.role, u.date_of_birth FROM family_memberships fm
     JOIN users u ON u.id = fm.user_id WHERE fm.family_unit_id = $1`,
    [familyUnitId]
  );

  const participants = buildParticipants(members.rows, sessionNumber);
  if (!participants.length) {
    return { error: 'insufficient_participants', luno_says: "We need your family together for this." };
  }

  // FIX #9: For Session 3, determine child's mirror format based on age bracket
  let threadContent = {};
  if (sessionNumber === 3) {
    const childMember = members.rows.find(m => m.role === 'child');
    if (childMember && childMember.date_of_birth) {
      const bracket = computeAgeBracket(childMember.date_of_birth);
      const ageConfig = getAgeConfig(bracket);
      // Elementary (6-10): mirror is a DRAWING, not spoken testimony
      // Middle school (11-13): mirror is WRITTEN, read aloud by Luno
      // High school (14-17): mirror is SPOKEN directly
      threadContent.mirror_format = ageConfig.contentFormat === 'drawing' ? 'drawing'
        : ageConfig.contentFormat === 'writing' ? 'written'
        : 'spoken';
      threadContent.child_age_bracket = bracket;
    }
  }

  const result = await pool.query(`
    INSERT INTO quilting_sessions (family_unit_id, tenant_id, session_number, participants, thread_content, status)
    VALUES ($1, $2, $3, $4, $5, 'in_progress')
    RETURNING *
  `, [familyUnitId, tenantId, sessionNumber, JSON.stringify(participants), JSON.stringify(threadContent)]);

  return {
    session: result.rows[0],
    participants,
    luno_says: getSessionOpeningPrompt(sessionNumber, threadContent.mirror_format)
  };
}

function getRequiredGate(sessionNumber) {
  if (sessionNumber === 1) return 1;
  if (sessionNumber === 2) return 2;
  if (sessionNumber === 3) return 3;
  if (sessionNumber === 4) return 3; // Session 4 requires same gate as 3
  return 0;
}

function buildParticipants(members, sessionNumber) {
  const elder = members.find(m => m.role === 'elder');
  const parents = members.filter(m => ['parent', 'founder', 'adult'].includes(m.role));
  const children = members.filter(m => m.role === 'child');

  switch (sessionNumber) {
    case 1: // Elder → Parent (child not present)
      if (!parents.length) return [];
      return [
        ...(elder ? [{ user_id: elder.user_id, role: 'elder', generation: -2 }] : []),
        ...parents.map(p => ({ user_id: p.user_id, role: 'parent', generation: -1 }))
      ];
    case 2: // Parent → Elder (child not present)
      if (!parents.length) return [];
      return [
        ...parents.map(p => ({ user_id: p.user_id, role: 'parent', generation: -1 })),
        ...(elder ? [{ user_id: elder.user_id, role: 'elder', generation: -2 }] : [])
      ];
    case 3: // Child → Parent + Elder (all present, Sonnet monitored)
      if (!parents.length || !children.length) return [];
      return [
        ...children.map(c => ({ user_id: c.user_id, role: 'child', generation: 0 })),
        ...parents.map(p => ({ user_id: p.user_id, role: 'parent', generation: -1 })),
        ...(elder ? [{ user_id: elder.user_id, role: 'elder', generation: -2 }] : [])
      ];
    case 4: // Full family weave
      return [
        ...(elder ? [{ user_id: elder.user_id, role: 'elder', generation: -2 }] : []),
        ...parents.map(p => ({ user_id: p.user_id, role: 'parent', generation: -1 })),
        ...children.map(c => ({ user_id: c.user_id, role: 'child', generation: 0 }))
      ];
    default:
      return [];
  }
}

function getSessionOpeningPrompt(sessionNumber, mirrorFormat) {
  const prompts = {
    1: "Let's begin with a breath together. [Elder's name], when you're ready, share what you've carried.",
    2: "Breathe together first. [Parent's name], share the bridge — what you received and what you chose differently.",
    3: mirrorFormat === 'drawing'
      ? "Let's breathe together. [Child's name], when you're ready, show us your drawing of what you see in this family."
      : mirrorFormat === 'written'
      ? "Let's breathe together. [Child's name], Luno will read what you wrote. Everyone listen."
      : "Let's breathe together. [Child's name], when you're ready, tell them what you see.",
    4: "One last breath together. Today we weave it all into one pattern. What do we keep? What do we release? What do we build?"
  };
  return prompts[sessionNumber] || '';
}

// ── THREAD RECORDING ──────────────────────────────────────────

async function recordThread(sessionId, role, content) {
  const session = await pool.query('SELECT * FROM quilting_sessions WHERE id = $1', [sessionId]);
  if (!session.rows.length) return { error: 'session_not_found' };

  const threadContent = session.rows[0].thread_content || {};

  switch (session.rows[0].session_number) {
    case 1:
      if (role === 'elder') threadContent.elder_testimony = content;
      if (role === 'parent') threadContent.parent_receipt = content;
      break;
    case 2:
      if (role === 'parent') threadContent.parent_bridge = content;
      if (role === 'elder') threadContent.elder_acknowledgment = content;
      break;
    case 3:
      if (role === 'child') threadContent.child_mirror = content;
      if (role === 'parent') threadContent.parent_receipt = content;
      if (role === 'elder') threadContent.elder_honoring = content;
      break;
    case 4:
      if (content.type === 'weave') threadContent.weave_discussion = content.text;
      if (content.type === 'pattern') threadContent.quilted_pattern = content.text;
      if (content.type === 'kmd') threadContent.keep_modify_deprecate = content.data;
      break;
  }

  await pool.query(
    'UPDATE quilting_sessions SET thread_content = $1 WHERE id = $2',
    [JSON.stringify(threadContent), sessionId]
  );

  return { thread_content: threadContent };
}

// ── BIOMETRIC RECORDING ───────────────────────────────────────

async function recordBiometrics(sessionId, userId, phase, biometrics) {
  const session = await pool.query('SELECT per_member_biometrics FROM quilting_sessions WHERE id = $1', [sessionId]);
  if (!session.rows.length) return { error: 'session_not_found' };

  const perMember = session.rows[0].per_member_biometrics || {};
  if (!perMember[userId]) perMember[userId] = {};
  perMember[userId][phase] = { ...biometrics, recorded_at: new Date() };

  await pool.query(
    'UPDATE quilting_sessions SET per_member_biometrics = $1 WHERE id = $2',
    [JSON.stringify(perMember), sessionId]
  );

  return { recorded: true };
}

// ── INTERVENTION RECORDING ────────────────────────────────────

async function recordIntervention(sessionId, signal, action, memberId) {
  await pool.query(
    'UPDATE quilting_sessions SET interventions = interventions || $1::jsonb WHERE id = $2',
    [JSON.stringify([{ signal, action, member: memberId, timestamp: Date.now() }]), sessionId]
  );
  return { recorded: true };
}

// ── SESSION COMPLETION ────────────────────────────────────────

async function completeSession(sessionId) {
  const session = await pool.query('SELECT * FROM quilting_sessions WHERE id = $1', [sessionId]);
  if (!session.rows.length) return { error: 'session_not_found' };

  const s = session.rows[0];
  if (s.status !== 'in_progress') return { error: 'session_not_in_progress' };

  // Co-breath bookend: verify closing co-breath was recorded for all participants.
  // If any participant is missing a post_cobreathe phase, block completion.
  const perMemberBio = s.per_member_biometrics || {};
  const participants = s.participants || [];
  const missingClosingBreath = participants.filter(p => {
    const bio = perMemberBio[p.user_id];
    return !bio || !bio.post_cobreathe;
  });
  if (missingClosingBreath.length > 0) {
    return {
      error: 'closing_cobreath_required',
      missing_members: missingClosingBreath.map(p => p.user_id),
      luno_says: "Let's close with a breath together before we finish."
    };
  }

  // AXIS post-evaluation: determine if next session proceeds
  const nextSession = s.session_number + 1;
  let axisEval = { proceed: true, reason: 'session_completed_normally' };

  if (nextSession <= 4) {
    const nextGate = getRequiredGate(nextSession);
    const gateResult = await evaluateGate(s.family_unit_id, nextGate);
    axisEval = {
      proceed: gateResult.status === 'open',
      reason: gateResult.status === 'open' ? 'gate_open' : 'gate_locked',
      next_session_ready: gateResult.status === 'open',
      gate_details: gateResult.criteria
    };
  }

  // Mark complete
  await pool.query(`
    UPDATE quilting_sessions SET status = 'completed', completed_at = NOW(), axis_post_evaluation = $1
    WHERE id = $2
  `, [JSON.stringify(axisEval), sessionId]);

  // Session 4 completion: record quilted pattern and trigger crest/lineage
  if (s.session_number === 4) {
    await onQuiltComplete(s);
  }

  // Fire isolation prevention for every session
  const { postSessionCheckins } = require('../services/isolationPrevention');
  await postSessionCheckins(sessionId);

  // Notify facilitator if exists
  await notifyFacilitator(s.family_unit_id, s.session_number, sessionId);

  return {
    completed: true,
    session_number: s.session_number,
    axis_evaluation: axisEval,
    luno_says: s.session_number === 4
      ? "You've woven something that didn't exist before. This pattern is yours."
      : axisEval.proceed
      ? "You held that together. When you're ready, there's more to weave."
      : "You did important work today. Let's keep building before the next step."
  };
}

async function onQuiltComplete(session) {
  const familyUnitId = session.family_unit_id;
  const tenantId = session.tenant_id;
  const threadContent = session.thread_content || {};

  // Record quilted pattern on lineage_profiles
  try {
    await pool.query(
      `UPDATE lineage_profiles SET quilted_insight = $1 WHERE family_unit_id = $2`,
      [JSON.stringify(threadContent.quilted_pattern || threadContent), familyUnitId]
    );
  } catch (e) {
    Sentry.captureException(e);
  }

  // Lineage ledger entry
  const participants = session.participants || [];
  for (const p of participants) {
    await lineageService.recordEntry(
      p.user_id, familyUnitId, tenantId, 'quilting_completed',
      { session_id: session.id, role: p.role, session_number: 4 }
    );
  }

  // Trigger crest version advancement eligibility
  try {
    const { evaluateVersion } = require('./familyCrestEngine');
    await evaluateVersion(familyUnitId);
  } catch (e) {
    Sentry.captureException(e);
  }
}

async function notifyFacilitator(familyUnitId, sessionNumber, sessionId) {
  try {
    const fac = await pool.query(
      'SELECT facilitator_id FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (fac.rows[0]?.facilitator_id) {
      await pool.query(`
        INSERT INTO notification_queue (user_id, type, content, scheduled_for)
        VALUES ($1, 'quilting_facilitator_alert', $2, NOW())
      `, [fac.rows[0].facilitator_id, JSON.stringify({
        family_unit_id: familyUnitId,
        session_number: sessionNumber,
        quilting_session_id: sessionId
      })]);
    }
  } catch (e) {
    Sentry.captureException(e);
  }
}

// ── SESSION CONVERSION ────────────────────────────────────────

// FIX #6: Function name corrected from handleAbuseDIsclosure to handleAbuseDisclosure
async function convertToCoBreath(sessionId, reason) {
  await pool.query(`
    UPDATE quilting_sessions SET status = 'converted',
    axis_post_evaluation = $1, completed_at = NOW()
    WHERE id = $2
  `, [JSON.stringify({ converted_reason: reason, converted_at: new Date() }), sessionId]);

  // Fire isolation prevention even on converted sessions
  const { postSessionCheckins } = require('../services/isolationPrevention');
  await postSessionCheckins(sessionId);

  return {
    converted: true,
    reason,
    luno_says: "We've done powerful work today. Let's close with a long breath together."
  };
}

// ── CHILD ABUSE DISCLOSURE PROTOCOL (CRITICAL SAFETY) ─────────

// FIX #10: Wired into existing disclosure routing system (disclosureRouter from facilitatedMessaging.js).
// Uses the battle-tested classifyDisclosure + routeDisclosure that were verified 4/4 scenarios
// in thread handoff. Gets existing abuse_recipient blocking, mandatory_reporting_flag,
// and role constraints from migration 035. Quilting-specific additions layer ON TOP.
async function handleAbuseDisclosure(sessionId, childUserId, familyUnitId, disclosureText) {
  // IMMEDIATE: Session stops. No family member sees this content.
  await pool.query(
    `UPDATE quilting_sessions SET status = 'converted',
     axis_post_evaluation = $1 WHERE id = $2`,
    [JSON.stringify({ converted_reason: 'disclosure_protocol', child_protected: true }), sessionId]
  );

  // Get family context for disclosure routing
  const familyContext = await buildDisclosureContext(childUserId, familyUnitId);

  // Route through the existing disclosure routing service
  // This gets: abuse_recipient blocking, mandatory_reporting_flag, role constraints from migration 035
  const classification = await classifyDisclosure(
    disclosureText,
    familyContext.senderType,
    familyContext.recipientType,
    familyContext
  );

  if (classification) {
    // Use existing routing — DO NOT reimplement
    await routeDisclosure(
      classification,
      null, // no facilitated_message ID in quilting context
      disclosureText,
      childUserId,
      familyContext.recipientId,
      familyUnitId,
      familyContext.tenantId,
      familyContext
    );
  }

  // Quilting-specific: create immune flag for session protection
  await pool.query(`
    INSERT INTO immune_flags (user_id, family_unit_id, flag_type, severity, details)
    VALUES ($1, $2, 'disclosure', 'critical', $3)
  `, [childUserId, familyUnitId, JSON.stringify({
    session_id: sessionId,
    source: 'quilting_session_3',
    requires_mandatory_reporting_review: true,
    classification
  })]);

  Sentry.captureMessage(`Child disclosure protocol activated: session ${sessionId}`, 'critical');

  return { disclosed: true, classification, child_protected: true };
}

async function buildDisclosureContext(childUserId, familyUnitId) {
  const child = await pool.query(
    `SELECT u.id, u.date_of_birth, fm.role FROM users u
     JOIN family_memberships fm ON fm.user_id = u.id
     WHERE u.id = $1 AND fm.family_unit_id = $2`,
    [childUserId, familyUnitId]
  );

  const parents = await pool.query(
    `SELECT fm.user_id FROM family_memberships fm
     WHERE fm.family_unit_id = $1 AND fm.role IN ('parent', 'founder', 'adult')`,
    [familyUnitId]
  );

  const family = await pool.query(
    'SELECT tenant_id, facilitator_id FROM family_units WHERE family_unit_id = $1',
    [familyUnitId]
  );

  const childAge = child.rows[0]?.date_of_birth
    ? Math.floor((Date.now() - new Date(child.rows[0].date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return {
    senderType: 'child',
    senderAge: childAge,
    recipientType: 'parent',
    recipientId: parents.rows[0]?.user_id || null,
    caregiverId: family.rows[0]?.facilitator_id || parents.rows[0]?.user_id || null,
    tenantId: family.rows[0]?.tenant_id || null
  };
}

// ── PROGRESS ──────────────────────────────────────────────────

async function getQuiltProgress(familyUnitId) {
  const sessions = await pool.query(
    `SELECT session_number, status, completed_at, axis_post_evaluation
     FROM quilting_sessions WHERE family_unit_id = $1 ORDER BY session_number`,
    [familyUnitId]
  );

  const gates = await getGateStatus(familyUnitId);
  const completed = sessions.rows.filter(s => s.status === 'completed');
  const nextSession = completed.length > 0
    ? Math.min(completed[completed.length - 1].session_number + 1, 4)
    : 1;

  return {
    sessions: sessions.rows,
    completed_count: completed.length,
    next_session: nextSession > 4 ? null : nextSession,
    quilt_complete: completed.some(s => s.session_number === 4),
    gates
  };
}

// ── GENERATIONAL ACTIVITIES ───────────────────────────────────

async function recordGenerationalActivity(userId, familyUnitId, activityType, content, biometricSummary) {
  const result = await pool.query(`
    INSERT INTO generational_activities (user_id, family_unit_id, activity_type, content, biometric_summary)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  `, [userId, familyUnitId, activityType, JSON.stringify(content), JSON.stringify(biometricSummary || {})]);

  return result.rows[0];
}

module.exports = {
  startQuiltSession,
  recordThread,
  recordBiometrics,
  recordIntervention,
  completeSession,
  convertToCoBreath,
  handleAbuseDisclosure,
  getQuiltProgress,
  recordGenerationalActivity
};
