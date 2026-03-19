// ============================================================
// [ABI] Legacy Vault Engine — Capsule creation, review, edit, lock
// File: src/abi/legacyVaultEngine.js
//
// Flows through ABI orchestrator. BIP39 mnemonic returned ONCE
// to the client, NEVER stored in plaintext on server.
// 42 CFR Part 2 protected.
// ============================================================

const crypto = require('crypto');
const bip39 = require('bip39');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── AES-256-CBC encrypt/decrypt (capsule-specific key) ──────

function encryptWithKey(plaintext, keyBuffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptWithKey(encryptedString, keyBuffer) {
  const [ivHex, ciphertext] = encryptedString.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function deriveCapsuleKey(mnemonic) {
  return crypto.createHash('sha256').update(mnemonic).digest();
}

function hashMnemonic(mnemonic) {
  return crypto.createHash('sha256').update(mnemonic).digest('hex');
}

// ── createCapsule ───────────────────────────────────────────

async function createCapsule(params) {
  const {
    creatorParticipantId,
    sessionCompletionId,
    personalizedArtId,
    affirmation,
    releaseType,
    releaseSchedule,
    designees,
    recoveryOptIn
  } = params;

  // Validate affirmation
  if (!affirmation || affirmation.length > 280) {
    throw new Error('Affirmation required, max 280 characters');
  }

  // Validate release type
  const validReleaseTypes = ['immediate', 'drip', 'date_locked', 'on_request'];
  if (!validReleaseTypes.includes(releaseType)) {
    throw new Error('Invalid release_type');
  }

  // Validate designees
  if (!designees || designees.length === 0) {
    throw new Error('At least one designee required');
  }

  const validRelationships = ['child', 'grandchild', 'sibling', 'partner', 'other'];
  for (const d of designees) {
    if (!d.name || !validRelationships.includes(d.relationship)) {
      throw new Error('Each designee needs name and valid relationship');
    }
  }

  // 1. Validate session exists and belongs to creator
  const sessionResult = await pool.query(
    `SELECT id, user_id, session_number, art_token_id,
            ns3_peak, ns3_floor, ns3_mean, coherence_peak,
            optimal_zone_pct, approaching_zone_pct, below_window_zone_pct,
            breath_ratio, breath_duration_seconds
     FROM session_completions
     WHERE id = $1 AND user_id = $2`,
    [sessionCompletionId, creatorParticipantId]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error('Session not found or does not belong to creator');
  }

  const session = sessionResult.rows[0];

  // 2. Validate eligibility (milestone piece OR session_number >= 30)
  const isMilestone = [10, 30, 50, 75, 100, 150].includes(session.session_number);
  if (!isMilestone && session.session_number < 30) {
    throw new Error('Session not eligible for legacy capsule (requires milestone or session >= 30)');
  }

  // 3. Build breath_cadence from session data
  const ratioParts = (session.breath_ratio || '4:6').split(':').map(Number);
  const inhaleSeconds = ratioParts[0] || 4;
  const exhaleSeconds = ratioParts[1] || 6;
  const cycleLength = inhaleSeconds + exhaleSeconds;
  const bpm = cycleLength > 0 ? Math.round(60 / cycleLength) : 6;

  const breathCadence = {
    ratio: session.breath_ratio || '4:6',
    bpm,
    duration_seconds: session.breath_duration_seconds || 480,
    coherence_peak: parseFloat(session.coherence_peak) || 0,
    inhale_seconds: inhaleSeconds,
    exhale_seconds: exhaleSeconds
  };

  // 4. Build NS3 snapshot
  const ns3Snapshot = {
    ns3_peak: parseFloat(session.ns3_peak) || 0,
    ns3_floor: parseFloat(session.ns3_floor) || 0,
    ns3_mean: parseFloat(session.ns3_mean) || 0,
    coherence_peak: parseFloat(session.coherence_peak) || 0,
    zone_profile: {
      optimal_pct: parseFloat(session.optimal_zone_pct) || 0,
      approaching_pct: parseFloat(session.approaching_zone_pct) || 0,
      below_window_pct: parseFloat(session.below_window_zone_pct) || 0
    },
    trajectory: session.ns3_mean > session.ns3_floor ? 'ascending' : 'stable'
  };

  // 5. Generate BIP39 mnemonic (128-bit entropy = 12 words)
  const mnemonic = bip39.generateMnemonic(128);

  // 6. Derive capsule key from mnemonic
  const capsuleKey = deriveCapsuleKey(mnemonic);

  // 7. Encrypt affirmation
  const affirmationEncrypted = encryptWithKey(affirmation, capsuleKey);

  // 8. Encrypt NS3 snapshot
  const ns3SnapshotEncrypted = encryptWithKey(JSON.stringify(ns3Snapshot), capsuleKey);

  // 9. Hash mnemonic for verification
  const seedPhraseHash = hashMnemonic(mnemonic);

  // 10. Recovery backup (if opted in)
  let recoveryBackupEncrypted = null;
  if (recoveryOptIn) {
    const recoveryKey = process.env.RECOVERY_ENCRYPTION_KEY;
    if (!recoveryKey) {
      throw new Error('RECOVERY_ENCRYPTION_KEY not configured');
    }
    const recoveryKeyBuffer = Buffer.from(recoveryKey, 'hex');
    recoveryBackupEncrypted = encryptWithKey(mnemonic, recoveryKeyBuffer);
  }

  // 11-12. Insert capsule
  const capsuleResult = await pool.query(
    `INSERT INTO legacy_capsules (
      creator_participant_id, session_completion_id, art_token_id, personalized_art_id,
      affirmation_encrypted, breath_cadence, ns3_snapshot_encrypted,
      seed_phrase_hash, recovery_backup_encrypted, recovery_opted_in,
      release_type, release_schedule
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      creatorParticipantId, sessionCompletionId, session.art_token_id, personalizedArtId || null,
      affirmationEncrypted, JSON.stringify(breathCadence), ns3SnapshotEncrypted,
      seedPhraseHash, recoveryBackupEncrypted, recoveryOptIn || false,
      releaseType, releaseSchedule ? JSON.stringify(releaseSchedule) : null
    ]
  );

  const capsuleId = capsuleResult.rows[0].id;

  // 13. Insert designees
  for (const d of designees) {
    await pool.query(
      `INSERT INTO capsule_designees (capsule_id, designee_name, relationship)
       VALUES ($1, $2, $3)`,
      [capsuleId, d.name, d.relationship]
    );
  }

  // 14. Return capsuleId + mnemonic (displayed ONCE, never stored)
  return { capsuleId, mnemonic };
}

// ── reviewCapsule ───────────────────────────────────────────

async function reviewCapsule(capsuleId, creatorId, seedPhrase) {
  // 1. Verify capsule belongs to creator
  const capsule = await pool.query(
    `SELECT id, creator_participant_id, affirmation_encrypted, breath_cadence,
            ns3_snapshot_encrypted, seed_phrase_hash, review_count, is_locked,
            art_token_id, personalized_art_id
     FROM legacy_capsules
     WHERE id = $1 AND creator_participant_id = $2`,
    [capsuleId, creatorId]
  );

  if (capsule.rows.length === 0) {
    throw new Error('Capsule not found or does not belong to you');
  }

  const cap = capsule.rows[0];

  // 2. Verify review_count === 0
  if (cap.review_count >= 1) {
    throw new Error('Review already used (maximum 1 review allowed)');
  }

  if (cap.is_locked) {
    throw new Error('Capsule is locked — no further reviews');
  }

  // 3. Verify seed phrase
  if (!seedPhrase) {
    throw new Error('Seed phrase required for review');
  }

  const hash = hashMnemonic(seedPhrase.trim());
  if (hash !== cap.seed_phrase_hash) {
    throw new Error('Seed phrase does not match');
  }

  // 4. Decrypt preview
  const capsuleKey = deriveCapsuleKey(seedPhrase.trim());
  const affirmation = decryptWithKey(cap.affirmation_encrypted, capsuleKey);

  // 5. Increment review_count
  await pool.query(
    `UPDATE legacy_capsules SET review_count = review_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [capsuleId]
  );

  return {
    affirmation,
    breathCadence: cap.breath_cadence,
    artTokenId: cap.art_token_id,
    personalizedArtId: cap.personalized_art_id
  };
}

// ── editCapsule ─────────────────────────────────────────────

async function editCapsule(capsuleId, creatorId, seedPhrase, newAffirmation) {
  // Validate new affirmation
  if (!newAffirmation || newAffirmation.length > 280) {
    throw new Error('Affirmation required, max 280 characters');
  }

  // 1. Verify capsule belongs to creator
  const capsule = await pool.query(
    `SELECT id, seed_phrase_hash, edit_count, is_locked
     FROM legacy_capsules
     WHERE id = $1 AND creator_participant_id = $2`,
    [capsuleId, creatorId]
  );

  if (capsule.rows.length === 0) {
    throw new Error('Capsule not found or does not belong to you');
  }

  const cap = capsule.rows[0];

  // 2. Verify edit_count === 0 AND is_locked === false
  if (cap.edit_count >= 1) {
    throw new Error('Edit already used (maximum 1 edit allowed)');
  }

  if (cap.is_locked) {
    throw new Error('Capsule is locked — no further edits');
  }

  // 3. Verify seed phrase
  const hash = hashMnemonic(seedPhrase.trim());
  if (hash !== cap.seed_phrase_hash) {
    throw new Error('Seed phrase does not match');
  }

  // 4. Re-derive capsule key
  const capsuleKey = deriveCapsuleKey(seedPhrase.trim());

  // 5. Re-encrypt new affirmation
  const affirmationEncrypted = encryptWithKey(newAffirmation, capsuleKey);

  // 6. Update
  await pool.query(
    `UPDATE legacy_capsules
     SET affirmation_encrypted = $1, edit_count = edit_count + 1, updated_at = NOW()
     WHERE id = $2`,
    [affirmationEncrypted, capsuleId]
  );

  return { success: true };
}

// ── lockCapsule ─────────────────────────────────────────────

async function lockCapsule(capsuleId, creatorId) {
  const capsule = await pool.query(
    `SELECT id, is_locked FROM legacy_capsules
     WHERE id = $1 AND creator_participant_id = $2`,
    [capsuleId, creatorId]
  );

  if (capsule.rows.length === 0) {
    throw new Error('Capsule not found or does not belong to you');
  }

  if (capsule.rows[0].is_locked) {
    throw new Error('Capsule is already locked');
  }

  await pool.query(
    `UPDATE legacy_capsules
     SET is_locked = true, locked_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [capsuleId]
  );

  return { success: true, locked: true };
}

module.exports = {
  createCapsule,
  reviewCapsule,
  editCapsule,
  lockCapsule,
  // Exported for use by capsuleUnlockEngine
  encryptWithKey,
  decryptWithKey,
  deriveCapsuleKey,
  hashMnemonic
};
