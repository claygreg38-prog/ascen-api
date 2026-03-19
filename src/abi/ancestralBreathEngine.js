// ============================================================
// [ABI] Ancestral Breath Engine — Ancestral sessions from capsule data
// File: src/abi/ancestralBreathEngine.js
//
// When a child unlocks a capsule and taps "Breathe with [Parent Name]",
// this engine creates a session using the parent's breathing parameters.
// The child generates their OWN art from this session.
// Flows through ABI orchestrator.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// ── createAncestralSession ──────────────────────────────────

async function createAncestralSession(designeeId, capsuleId) {
  // 1. Fetch capsule and verify designee has unlocked it
  const designee = await pool.query(
    `SELECT cd.id, cd.has_unlocked, cd.designee_name
     FROM capsule_designees cd
     WHERE cd.id = $1 AND cd.capsule_id = $2`,
    [designeeId, capsuleId]
  );

  if (designee.rows.length === 0) {
    throw new Error('Designee not authorized for this capsule');
  }

  if (!designee.rows[0].has_unlocked) {
    throw new Error('Capsule must be unlocked before starting ancestral session');
  }

  // 2. Fetch capsule breath_cadence and art
  const capsule = await pool.query(
    `SELECT lc.breath_cadence, lc.art_token_id, u.first_name as creator_name
     FROM legacy_capsules lc
     JOIN users u ON lc.creator_participant_id = u.id
     WHERE lc.id = $1`,
    [capsuleId]
  );

  if (capsule.rows.length === 0) {
    throw new Error('Capsule not found');
  }

  const cap = capsule.rows[0];
  const cadence = typeof cap.breath_cadence === 'string'
    ? JSON.parse(cap.breath_cadence)
    : cap.breath_cadence;

  // 3. Format session parameters for the breath pacer
  return {
    session_type: 'ancestral',
    ancestral_capsule_id: capsuleId,
    ancestor_name: cap.creator_name,
    ancestor_art_url: cap.art_token_id ? `${PINATA_GATEWAY}/${cap.art_token_id}` : null,
    breath_params: {
      inhale_seconds: cadence.inhale_seconds || 4,
      exhale_seconds: cadence.exhale_seconds || 6,
      total_duration_seconds: cadence.duration_seconds || 480
    },
    is_ancestral_session: true
  };
}

module.exports = {
  createAncestralSession
};
