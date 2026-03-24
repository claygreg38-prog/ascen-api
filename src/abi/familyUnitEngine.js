// ============================================================
// [ABI] Family Unit Engine — ABI System #14
// File: src/abi/familyUnitEngine.js
//
// Family creation, gate progression, invitations.
// Flows through ABI orchestrator. No bypasses.
//
// Exports:
//   createFamilyUnit(elderUserId, familyName, tenantId)
//   evaluateGates(familyUnitId)
//   sendInvitation(familyUnitId, invitedByUserId, inviteeName, relationship, gateNumber)
//   acceptInvitation(invitationCode, userId)
//   getFamilyUnit(familyUnitId)
// ============================================================

const { Pool } = require('pg');
const crypto = require('crypto');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── DEFAULT GATE THRESHOLDS ─────────────────────────────────
// Overridable per tenant via config JSONB
const DEFAULT_GATE_CONFIG = {
  gate_1: { min_sessions: 5, min_days: 7 },
  gate_2: { min_sessions_each: 20, min_days_each: 14 },
  gate_3: { min_combined_sessions: 30, min_active_days: 21 }
};

function getGateConfig(tenantConfig) {
  const gates = tenantConfig?.gate_thresholds || {};
  return {
    gate_1: { ...DEFAULT_GATE_CONFIG.gate_1, ...gates.gate_1 },
    gate_2: { ...DEFAULT_GATE_CONFIG.gate_2, ...gates.gate_2 },
    gate_3: { ...DEFAULT_GATE_CONFIG.gate_3, ...gates.gate_3 }
  };
}

// ── CREATE FAMILY UNIT ──────────────────────────────────────

/**
 * Create a new family unit with the elder as the founding member.
 *
 * @param {string} elderUserId - user_id of the elder (founding parent)
 * @param {string} familyName - Display name for the family unit
 * @param {string} tenantId - Tenant UUID
 * @param {Object} tenantConfig - Tenant config for gate thresholds
 * @returns {Promise<Object>} { familyUnitId, gateState }
 */
async function createFamilyUnit(elderUserId, familyName, tenantId, tenantConfig = {}) {
  const gateConfig = getGateConfig(tenantConfig);

  // Verify elder has completed minimum sessions
  const elderStats = await pool.query(
    `SELECT COUNT(*) as total, MIN(completed_at) as first_session
     FROM session_completions WHERE user_id = $1`,
    [elderUserId]
  );

  const totalSessions = parseInt(elderStats.rows[0].total) || 0;
  const firstSession = elderStats.rows[0].first_session;
  const daysSinceFirst = firstSession
    ? Math.floor((Date.now() - new Date(firstSession).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (totalSessions < gateConfig.gate_1.min_sessions) {
    return {
      error: true,
      message: `Complete at least ${gateConfig.gate_1.min_sessions} sessions before creating a family unit.`,
      current_sessions: totalSessions,
      required_sessions: gateConfig.gate_1.min_sessions
    };
  }

  if (daysSinceFirst < gateConfig.gate_1.min_days) {
    return {
      error: true,
      message: `Practice for at least ${gateConfig.gate_1.min_days} days before creating a family unit.`,
      current_days: daysSinceFirst,
      required_days: gateConfig.gate_1.min_days
    };
  }

  // Get elder's DB id
  const elderRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [elderUserId]);
  if (elderRow.rows.length === 0) throw new Error('Elder user not found');
  const elderDbId = elderRow.rows[0].id;

  // Check if elder already has a family unit
  const existing = await pool.query(
    'SELECT family_unit_id FROM family_memberships WHERE user_id = $1 AND role = $2',
    [elderDbId, 'elder']
  );
  if (existing.rows.length > 0) {
    return { error: true, message: 'You already have a family unit.' };
  }

  // Gate 1 auto-unlocked (elder qualifies by reaching this point)
  const gateState = { gate_1: true, gate_2: false, gate_3: false };

  // Create family unit
  const result = await pool.query(
    `INSERT INTO family_units (family_unit_id, elder_user_id, name, tenant_id, gate_state, status, collective_metrics)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', '{"total_sessions": 0, "collective_regulated_hours": 0, "co_breath_count": 0}')
     RETURNING family_unit_id`,
    [elderDbId, familyName, tenantId, JSON.stringify(gateState)]
  );

  const familyUnitId = result.rows[0].family_unit_id;

  // Create elder membership
  await pool.query(
    `INSERT INTO family_memberships (family_unit_id, user_id, role, generation_level, individual_progress)
     VALUES ($1, $2, 'elder', 0, $3)`,
    [familyUnitId, elderDbId, JSON.stringify({ session_count: totalSessions, curriculum_position: 1, streak_days: 0 })]
  );

  // Update user's family_unit_id
  await pool.query(
    'UPDATE users SET family_unit_id = $1 WHERE id = $2',
    [familyUnitId, elderDbId]
  );

  console.log(`[FamilyUnit] Created ${familyUnitId} by elder ${elderUserId}`);

  return { familyUnitId, gateState };
}

// ── EVALUATE GATES ──────────────────────────────────────────

/**
 * Re-evaluate gate state for a family unit.
 * Called on every session completion for family members.
 *
 * @param {string} familyUnitId
 * @param {Object} tenantConfig
 * @returns {Promise<Object>} Updated gate state
 */
async function evaluateGates(familyUnitId, tenantConfig = {}) {
  const gateConfig = getGateConfig(tenantConfig);

  const family = await pool.query(
    'SELECT gate_state, elder_user_id FROM family_units WHERE family_unit_id = $1',
    [familyUnitId]
  );
  if (family.rows.length === 0) return null;

  const currentGates = family.rows[0].gate_state || { gate_1: false, gate_2: false, gate_3: false };
  const elderDbId = family.rows[0].elder_user_id;
  const newGates = { ...currentGates };

  // Gate 1: Elder completed N sessions + M days
  if (!currentGates.gate_1) {
    const elderStats = await pool.query(
      `SELECT COUNT(*) as total, MIN(completed_at) as first_session
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.user_id
       WHERE u.id = $1`,
      [elderDbId]
    );
    const total = parseInt(elderStats.rows[0].total) || 0;
    const firstDate = elderStats.rows[0].first_session;
    const days = firstDate ? Math.floor((Date.now() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    if (total >= gateConfig.gate_1.min_sessions && days >= gateConfig.gate_1.min_days) {
      newGates.gate_1 = true;
    }
  }

  // Gate 2: Elder + first invitee BOTH sustain practice
  if (currentGates.gate_1 && !currentGates.gate_2) {
    const members = await pool.query(
      `SELECT fm.user_id, fm.role,
              (SELECT COUNT(*) FROM session_completions sc
               JOIN users u ON sc.user_id = u.user_id
               WHERE u.id = fm.user_id) as sessions,
              (SELECT MIN(completed_at) FROM session_completions sc
               JOIN users u ON sc.user_id = u.user_id
               WHERE u.id = fm.user_id) as first_session
       FROM family_memberships fm WHERE fm.family_unit_id = $1`,
      [familyUnitId]
    );

    if (members.rows.length >= 2) {
      const allQualify = members.rows.slice(0, 2).every(m => {
        const sessions = parseInt(m.sessions) || 0;
        const firstDate = m.first_session;
        const days = firstDate ? Math.floor((Date.now() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return sessions >= gateConfig.gate_2.min_sessions_each && days >= gateConfig.gate_2.min_days_each;
      });

      if (allQualify) newGates.gate_2 = true;
    }
  }

  // Gate 3: Collective milestone
  if (currentGates.gate_2 && !currentGates.gate_3) {
    const collective = await pool.query(
      `SELECT COUNT(*) as total FROM session_completions sc
       JOIN users u ON sc.user_id = u.user_id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1`,
      [familyUnitId]
    );

    const totalSessions = parseInt(collective.rows[0].total) || 0;

    // Check distinct active days
    const activeDays = await pool.query(
      `SELECT COUNT(DISTINCT DATE(sc.completed_at)) as days FROM session_completions sc
       JOIN users u ON sc.user_id = u.user_id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1`,
      [familyUnitId]
    );
    const days = parseInt(activeDays.rows[0].days) || 0;

    if (totalSessions >= gateConfig.gate_3.min_combined_sessions && days >= gateConfig.gate_3.min_active_days) {
      newGates.gate_3 = true;
    }
  }

  // Update if changed
  if (JSON.stringify(newGates) !== JSON.stringify(currentGates)) {
    await pool.query(
      'UPDATE family_units SET gate_state = $1 WHERE family_unit_id = $2',
      [JSON.stringify(newGates), familyUnitId]
    );
  }

  return newGates;
}

// ── SEND INVITATION ─────────────────────────────────────────

/**
 * Send a family invitation. Respects gate locks.
 *
 * @param {string} familyUnitId
 * @param {number} invitedByDbId - users.id of inviter
 * @param {string} inviteeName
 * @param {string} relationship
 * @param {number} gateNumber - Which gate this goes through
 * @returns {Promise<Object>} { invitationCode, expiresAt }
 */
async function sendInvitation(familyUnitId, invitedByDbId, inviteeName, relationship, gateNumber) {
  // Verify gate is unlocked
  const family = await pool.query(
    'SELECT gate_state FROM family_units WHERE family_unit_id = $1',
    [familyUnitId]
  );
  if (family.rows.length === 0) return { error: true, message: 'Family unit not found' };

  const gates = family.rows[0].gate_state || {};
  const gateKey = `gate_${gateNumber}`;
  if (!gates[gateKey]) {
    return { error: true, message: `Gate ${gateNumber} is not yet unlocked.` };
  }

  // Verify inviter is a member
  const membership = await pool.query(
    'SELECT id FROM family_memberships WHERE family_unit_id = $1 AND user_id = $2',
    [familyUnitId, invitedByDbId]
  );
  if (membership.rows.length === 0) {
    return { error: true, message: 'You are not a member of this family unit.' };
  }

  // Check invitation limits per gate
  if (gateNumber === 1) {
    const existingInvites = await pool.query(
      `SELECT COUNT(*) as c FROM family_invitations
       WHERE family_unit_id = $1 AND gate_number = 1 AND status IN ('pending', 'accepted')`,
      [familyUnitId]
    );
    if (parseInt(existingInvites.rows[0].c) >= 1) {
      return { error: true, message: 'Gate 1 allows only 1 invitation.' };
    }
  } else if (gateNumber === 2) {
    const existingInvites = await pool.query(
      `SELECT COUNT(*) as c FROM family_invitations
       WHERE family_unit_id = $1 AND gate_number = 2 AND status IN ('pending', 'accepted')`,
      [familyUnitId]
    );
    if (parseInt(existingInvites.rows[0].c) >= 4) {
      return { error: true, message: 'Gate 2 allows up to 4 additional invitations.' };
    }
  }

  // Generate 6-character invitation code
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();

  const result = await pool.query(
    `INSERT INTO family_invitations (family_unit_id, invited_by, invitee_name, invitee_relationship, invitation_code, gate_number)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING invitation_code, expires_at`,
    [familyUnitId, invitedByDbId, inviteeName, relationship, code, gateNumber]
  );

  console.log(`[FamilyUnit] Invitation ${code} created for ${familyUnitId}`);

  // Send invitation email if invitee email provided
  if (inviteeName && inviteeName.includes('@')) {
    // inviteeName might be an email — send invitation
    try {
      const emailService = require('../services/emailService');
      // Look up inviter name
      const inviter = await pool.query('SELECT first_name FROM users WHERE id = $1', [invitedByDbId]);
      const inviterName = inviter.rows[0]?.first_name || 'Your family';
      await emailService.sendFamilyInvitation(inviteeName, inviterName, code);
    } catch (err) {
      console.error('[FamilyUnit] Invitation email failed:', err.message);
      // Don't fail the invitation — email is best-effort
    }
  }

  return {
    invitationCode: result.rows[0].invitation_code,
    expiresAt: result.rows[0].expires_at
  };
}

// ── ACCEPT INVITATION ───────────────────────────────────────

/**
 * Accept a family invitation by code.
 *
 * @param {string} invitationCode
 * @param {string} userId - user_id (not DB id) of accepting user
 * @returns {Promise<Object>} { familyUnitId, role, generationLevel }
 */
async function acceptInvitation(invitationCode, userId) {
  // Find invitation
  const invite = await pool.query(
    `SELECT * FROM family_invitations WHERE invitation_code = $1`,
    [invitationCode]
  );

  if (invite.rows.length === 0) {
    return { error: true, message: 'Invalid invitation code.' };
  }

  const inv = invite.rows[0];

  if (inv.status !== 'pending') {
    return { error: true, message: `Invitation is ${inv.status}.` };
  }

  if (new Date(inv.expires_at) < new Date()) {
    await pool.query(
      "UPDATE family_invitations SET status = 'expired' WHERE id = $1",
      [inv.id]
    );
    return { error: true, message: 'Invitation has expired.' };
  }

  // Get user DB id
  const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
  if (userRow.rows.length === 0) return { error: true, message: 'User not found.' };
  const userDbId = userRow.rows[0].id;

  // Check not already a member
  const existingMembership = await pool.query(
    'SELECT id FROM family_memberships WHERE family_unit_id = $1 AND user_id = $2',
    [inv.family_unit_id, userDbId]
  );
  if (existingMembership.rows.length > 0) {
    return { error: true, message: 'You are already a member of this family unit.' };
  }

  // Determine role and generation level based on relationship
  let role = 'adult_child';
  let generationLevel = 1;
  const rel = (inv.invitee_relationship || '').toLowerCase();
  if (rel.includes('grandchild') || rel.includes('grandson') || rel.includes('granddaughter')) {
    role = 'grandchild';
    generationLevel = 2;
  } else if (rel.includes('extended') || rel.includes('cousin') || rel.includes('friend')) {
    role = 'extended';
    generationLevel = 1;
  }

  // Create membership
  await pool.query(
    `INSERT INTO family_memberships (family_unit_id, user_id, role, generation_level, invited_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [inv.family_unit_id, userDbId, role, generationLevel, inv.invited_by]
  );

  // Update invitation
  await pool.query(
    "UPDATE family_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1",
    [inv.id]
  );

  // Update user's family_unit_id
  await pool.query(
    'UPDATE users SET family_unit_id = $1 WHERE id = $2',
    [inv.family_unit_id, userDbId]
  );

  // Re-evaluate gates
  await evaluateGates(inv.family_unit_id);

  console.log(`[FamilyUnit] ${userId} joined family ${inv.family_unit_id} as ${role}`);

  return { familyUnitId: inv.family_unit_id, role, generationLevel };
}

// ── GET FAMILY UNIT ─────────────────────────────────────────

/**
 * Get full family unit with members, gate state, and metrics.
 *
 * @param {string} familyUnitId
 * @returns {Promise<Object>}
 */
async function getFamilyUnit(familyUnitId) {
  const family = await pool.query(
    'SELECT * FROM family_units WHERE family_unit_id = $1',
    [familyUnitId]
  );
  if (family.rows.length === 0) return null;

  const members = await pool.query(
    `SELECT fm.*, u.user_id, u.first_name, u.total_sessions_completed
     FROM family_memberships fm
     JOIN users u ON fm.user_id = u.id
     WHERE fm.family_unit_id = $1
     ORDER BY fm.generation_level ASC, fm.joined_at ASC`,
    [familyUnitId]
  );

  const pendingInvites = await pool.query(
    `SELECT invitee_name, invitee_relationship, invitation_code, gate_number, expires_at
     FROM family_invitations
     WHERE family_unit_id = $1 AND status = 'pending' AND expires_at > NOW()`,
    [familyUnitId]
  );

  return {
    ...family.rows[0],
    members: members.rows.map(m => ({
      userId: m.user_id,
      firstName: m.first_name,
      role: m.role,
      generationLevel: m.generation_level,
      joinedAt: m.joined_at,
      sessionsCompleted: m.total_sessions_completed || 0,
      progress: m.individual_progress
    })),
    pendingInvitations: pendingInvites.rows
  };
}

module.exports = {
  createFamilyUnit,
  evaluateGates,
  sendInvitation,
  acceptInvitation,
  getFamilyUnit,
  DEFAULT_GATE_CONFIG
};
