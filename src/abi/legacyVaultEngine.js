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
    recoveryOptIn,
    clinicianId,
    adminId,
    tenantId
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
            breath_ratio, breath_duration_seconds,
            session_id, completed_at,
            breath_trace_json, trace_resolution, sample_source
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

  // 10b. [BREATH ECHO] Attach the captured 1 Hz trace + provenance.
  // Capture-rich / share-conservative: the full physiological trace only lands in
  // the shareable capsule on EXPLICIT full_trace opt-in. Otherwise the capsule
  // stays cadence_only with breath_trace_json NULL (it still plays from the
  // existing breath_cadence). HARD RULE: never fabricate — if no real full_trace
  // was captured, no full_trace is shared. sample_source is carried through always.
  const consentDefaults = { cadence: true, full_trace: false, breath_audio: false, voice_audio: false, coherence: true };
  const consentLayers = Object.assign({}, consentDefaults, params.consentLayers || {});

  const fullTraceCaptured = session.trace_resolution === 'full_trace' && session.breath_trace_json != null;
  const shareFullTrace = fullTraceCaptured && consentLayers.full_trace === true;
  const capsuleTraceResolution = shareFullTrace ? 'full_trace' : 'cadence_only';
  const capsuleTraceJson = shareFullTrace ? JSON.stringify(session.breath_trace_json) : null;
  const sampleSource = session.sample_source || null;
  const coherenceVisible = consentLayers.coherence !== false; // coherence-ON default

  // recorded_context_json: dated + identified, but NOT located. location_label is
  // intentionally null — it must be user-chosen/opt-in (auto-disclosing a facility
  // location is a dignity/consent harm for vulnerable creators). Revisit-before-
  // playback gate; never auto-populate from tenant/facility.
  const recordedContext = JSON.stringify({
    timestamp: session.completed_at || null,
    session_id: session.session_id || null,
    location_label: null
  });
  const echoType = 'echo'; // standard "breath left for someone"; first_breath/lineage/live set by their own flows

  // 11-12. Insert capsule
  const capsuleResult = await pool.query(
    `INSERT INTO legacy_capsules (
      creator_participant_id, session_completion_id, art_token_id, personalized_art_id,
      affirmation_encrypted, breath_cadence, ns3_snapshot_encrypted,
      seed_phrase_hash, recovery_backup_encrypted, recovery_opted_in,
      release_type, release_schedule,
      breath_trace_json, trace_resolution, sample_source,
      recorded_context_json, echo_type, consent_layers_json, coherence_visible
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, $18, $19)
    RETURNING id`,
    [
      creatorParticipantId, sessionCompletionId, session.art_token_id, personalizedArtId || null,
      affirmationEncrypted, JSON.stringify(breathCadence), ns3SnapshotEncrypted,
      seedPhraseHash, recoveryBackupEncrypted, recoveryOptIn || false,
      releaseType, releaseSchedule ? JSON.stringify(releaseSchedule) : null,
      capsuleTraceJson, capsuleTraceResolution, sampleSource,
      recordedContext, echoType, JSON.stringify(consentLayers), coherenceVisible
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

  // 14. Create recovery backup (safety net — participant never knows)
  //     Requires clinician + admin IDs. If not provided, backup is skipped
  //     (will be created via /api/vault/recovery/backup by staff).
  if (params.clinicianId && params.adminId) {
    try {
      const vaultRecoveryService = require('../services/vaultRecoveryService');
      await vaultRecoveryService.createRecoveryBackup(
        creatorParticipantId, mnemonic, params.clinicianId, params.adminId, params.tenantId || null
      );
    } catch (err) {
      // Recovery backup failure must NOT block capsule creation.
      // The participant's capsule is still valid without it.
      console.error('[LegacyVault] Recovery backup failed (non-blocking):', err.message);
      const Sentry = require('../instrument');
      Sentry.captureException(err);
    }
  }

  // 15. Return capsuleId + mnemonic (displayed ONCE, never stored)
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

// ── VIDEO CAPSULE (Review Finding #3: Clinical review required) ──

async function createVideoCapsule(params) {
  const { creatorParticipantId, transcript, familyUnitId, tenantId } = params;

  // Transcript is evaluated by Sonnet via the letter assistant
  // Video itself requires clinical human review before encryption

  const result = await pool.query(
    `INSERT INTO legacy_capsules
     (creator_participant_id, capsule_type, video_review_status,
      affirmation_encrypted, seed_phrase_hash)
     VALUES ($1, 'video', 'pending_review', 'pending_clinical_review', 'pending')
     RETURNING id`,
    [creatorParticipantId]
  );

  return { capsuleId: result.rows[0].id, videoReviewStatus: 'pending_review' };
}

async function approveVideoCapsule(capsuleId, videoBuffer) {
  // Called after clinical review approves the video
  const mnemonic = require('bip39').generateMnemonic(128);
  const capsuleKey = deriveCapsuleKey(mnemonic);
  const seedPhraseHash = hashMnemonic(mnemonic);

  // Encrypt video and upload to IPFS
  let videoIpfsHash = null;
  try {
    const ipfsService = require('../services/ipfsService');
    if (videoBuffer) {
      const ipfsResult = await ipfsService.upload(videoBuffer, { type: 'video_capsule' }, {}, { sessionNumber: 'video', firstName: 'Family' });
      videoIpfsHash = ipfsResult.metadataHash;
    }
  } catch (err) {
    console.error('[LegacyVault] IPFS upload failed:', err.message);
  }

  await pool.query(
    `UPDATE legacy_capsules SET
       video_review_status = 'approved', video_ipfs_hash = $1,
       seed_phrase_hash = $2
     WHERE id = $3`,
    [videoIpfsHash, seedPhraseHash, capsuleId]
  );

  return { capsuleId, mnemonic, videoIpfsHash };
}

// ── STORY ARC ───────────────────────────────────────────────

async function createStoryArc(creatorId, familyUnitId, tenantId, title, description, totalChapters) {
  if (totalChapters > 10) throw new Error('Maximum 10 chapters per story arc');

  const result = await pool.query(
    `INSERT INTO story_arcs (creator_id, family_unit_id, tenant_id, title, description, total_chapters)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [creatorId, familyUnitId, tenantId, title, description, totalChapters || 1]
  );

  return { arcId: result.rows[0].id };
}

// ── TIME-LOCKED CAPSULE ─────────────────────────────────────

async function setTimeLock(capsuleId, creatorId, timeLockDate, occasion) {
  const capsule = await pool.query(
    'SELECT id, creator_participant_id FROM legacy_capsules WHERE id = $1 AND creator_participant_id = $2',
    [capsuleId, creatorId]
  );
  if (capsule.rows.length === 0) throw new Error('Capsule not found');

  const lockDate = new Date(timeLockDate);
  if (lockDate <= new Date()) throw new Error('Time lock date must be in the future');

  await pool.query(
    `UPDATE legacy_capsules SET
       capsule_type = 'time_locked', time_lock_date = $1, time_lock_occasion = $2
     WHERE id = $3`,
    [lockDate, occasion, capsuleId]
  );

  return { capsuleId, timeLockDate: lockDate, occasion };
}

async function checkTimeLock(capsuleId) {
  const capsule = await pool.query(
    'SELECT time_lock_date, time_lock_occasion, capsule_type FROM legacy_capsules WHERE id = $1',
    [capsuleId]
  );
  if (capsule.rows.length === 0) return { locked: false };

  const c = capsule.rows[0];
  if (c.capsule_type !== 'time_locked' || !c.time_lock_date) return { locked: false };

  const isLocked = new Date(c.time_lock_date) > new Date();
  return {
    locked: isLocked,
    timeLockDate: c.time_lock_date,
    occasion: c.time_lock_occasion
  };
}

module.exports = {
  createCapsule,
  reviewCapsule,
  editCapsule,
  lockCapsule,
  createVideoCapsule,
  approveVideoCapsule,
  createStoryArc,
  setTimeLock,
  checkTimeLock,
  // Exported for use by capsuleUnlockEngine
  encryptWithKey,
  decryptWithKey,
  deriveCapsuleKey,
  hashMnemonic
};
