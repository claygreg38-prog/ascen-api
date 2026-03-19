// ============================================================
// [ABI] Capsule Unlock Engine — Unlock, recovery, available capsules
// File: src/abi/capsuleUnlockEngine.js
//
// Flows through ABI orchestrator.
// Recovery requires two-person authorization (clinician + admin).
// 42 CFR Part 2 protected.
// ============================================================

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { decryptWithKey, deriveCapsuleKey, hashMnemonic } = require('./legacyVaultEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// ── checkAvailableCapsules ──────────────────────────────────

async function checkAvailableCapsules(designeeWalletAddress) {
  // 1. Query designees matching wallet
  const designees = await pool.query(
    `SELECT cd.id as designee_id, cd.capsule_id, cd.designee_name, cd.relationship,
            cd.has_unlocked, cd.unlocked_at,
            lc.release_type, lc.release_schedule, lc.art_token_id,
            lc.creator_participant_id, lc.created_at as capsule_created_at,
            u.first_name as creator_name
     FROM capsule_designees cd
     JOIN legacy_capsules lc ON cd.capsule_id = lc.id
     JOIN users u ON lc.creator_participant_id = u.id
     WHERE cd.designee_wallet_address = $1`,
    [designeeWalletAddress]
  );

  const available = [];
  const now = new Date();

  for (const row of designees.rows) {
    let isAvailable = false;

    switch (row.release_type) {
      case 'immediate':
        isAvailable = true;
        break;

      case 'drip': {
        const schedule = row.release_schedule || {};
        const maxPerWeek = schedule.max_per_week || 1;
        // Count unlocks in the past 7 days for this capsule
        const recentUnlocks = await pool.query(
          `SELECT COUNT(*) as cnt FROM capsule_unlock_log
           WHERE capsule_id = $1 AND unlocked_at > NOW() - INTERVAL '7 days'`,
          [row.capsule_id]
        );
        isAvailable = parseInt(recentUnlocks.rows[0].cnt) < maxPerWeek;
        break;
      }

      case 'date_locked': {
        const schedule = row.release_schedule || {};
        if (schedule.unlock_date) {
          isAvailable = now >= new Date(schedule.unlock_date);
        }
        break;
      }

      case 'on_request':
        isAvailable = true;
        break;
    }

    if (isAvailable) {
      available.push({
        capsule_id: row.capsule_id,
        designee_id: row.designee_id,
        creator_name: row.creator_name,
        relationship: row.relationship,
        release_type: row.release_type,
        has_unlocked: row.has_unlocked,
        art_preview_url: row.art_token_id ? `${PINATA_GATEWAY}/${row.art_token_id}` : null
      });
    }
  }

  return available;
}

// ── unlockCapsule ───────────────────────────────────────────

async function unlockCapsule(capsuleId, designeeId, seedPhrase) {
  // 1. Verify designee is authorized
  const designee = await pool.query(
    `SELECT cd.id, cd.capsule_id, cd.designee_name, cd.relationship
     FROM capsule_designees cd
     WHERE cd.id = $1 AND cd.capsule_id = $2`,
    [designeeId, capsuleId]
  );

  if (designee.rows.length === 0) {
    throw new Error('Designee not authorized for this capsule');
  }

  // 2. Fetch capsule
  const capsule = await pool.query(
    `SELECT lc.*, u.first_name as creator_name
     FROM legacy_capsules lc
     JOIN users u ON lc.creator_participant_id = u.id
     WHERE lc.id = $1`,
    [capsuleId]
  );

  if (capsule.rows.length === 0) {
    throw new Error('Capsule not found');
  }

  const cap = capsule.rows[0];

  // 3. Verify seed phrase
  const hash = hashMnemonic(seedPhrase.trim());
  if (hash !== cap.seed_phrase_hash) {
    throw new Error('Seed phrase does not match');
  }

  // 4. Decrypt
  const capsuleKey = deriveCapsuleKey(seedPhrase.trim());
  const affirmation = decryptWithKey(cap.affirmation_encrypted, capsuleKey);
  const ns3Context = JSON.parse(decryptWithKey(cap.ns3_snapshot_encrypted, capsuleKey));

  // 5. Mark designee as unlocked
  await pool.query(
    `UPDATE capsule_designees SET has_unlocked = true, unlocked_at = NOW()
     WHERE id = $1`,
    [designeeId]
  );

  // 6. Log unlock
  await pool.query(
    `INSERT INTO capsule_unlock_log (capsule_id, designee_id, unlock_method)
     VALUES ($1, $2, 'seed_phrase')`,
    [capsuleId, designeeId]
  );

  // 7. Return decrypted contents
  return {
    affirmation,
    breathCadence: cap.breath_cadence,
    artUrl: cap.art_token_id ? `${PINATA_GATEWAY}/${cap.art_token_id}` : null,
    ns3Context,
    creatorName: cap.creator_name
  };
}

// ── recoverCapsule ──────────────────────────────────────────
// CRITICAL: Two-person rule — clinician + admin must BOTH authorize

async function recoverCapsule(capsuleId, clinicianJWT, adminJWT) {
  // 1. Verify capsule has recovery_opted_in
  const capsule = await pool.query(
    `SELECT lc.*, u.first_name as creator_name
     FROM legacy_capsules lc
     JOIN users u ON lc.creator_participant_id = u.id
     WHERE lc.id = $1`,
    [capsuleId]
  );

  if (capsule.rows.length === 0) {
    throw new Error('Capsule not found');
  }

  const cap = capsule.rows[0];

  if (!cap.recovery_opted_in) {
    throw new Error('Recovery not enabled for this capsule');
  }

  if (!cap.recovery_backup_encrypted) {
    throw new Error('No recovery backup available');
  }

  // 2. Verify clinician JWT
  let clinicianPayload;
  try {
    clinicianPayload = jwt.verify(clinicianJWT, process.env.JWT_SECRET || 'ascen-jwt-secret');
  } catch (e) {
    throw new Error('Invalid clinician authorization');
  }
  if (clinicianPayload.role !== 'clinician') {
    throw new Error('Clinician role required');
  }

  // 3. Verify admin JWT
  let adminPayload;
  try {
    adminPayload = jwt.verify(adminJWT, process.env.JWT_SECRET || 'ascen-jwt-secret');
  } catch (e) {
    throw new Error('Invalid admin authorization');
  }
  if (adminPayload.role !== 'admin') {
    throw new Error('Admin role required');
  }

  // 4. Two-person rule: BOTH verified
  const recoveryKey = process.env.RECOVERY_ENCRYPTION_KEY;
  if (!recoveryKey) {
    throw new Error('RECOVERY_ENCRYPTION_KEY not configured');
  }

  // 5. Decrypt recovery backup → original mnemonic
  const recoveryKeyBuffer = Buffer.from(recoveryKey, 'hex');
  const mnemonic = decryptWithKey(cap.recovery_backup_encrypted, recoveryKeyBuffer);

  // 6. Re-derive capsule key
  const capsuleKey = deriveCapsuleKey(mnemonic);

  // 7. Decrypt contents
  const affirmation = decryptWithKey(cap.affirmation_encrypted, capsuleKey);
  const ns3Context = JSON.parse(decryptWithKey(cap.ns3_snapshot_encrypted, capsuleKey));

  // 8. Log recovery
  await pool.query(
    `INSERT INTO capsule_unlock_log (capsule_id, unlock_method)
     VALUES ($1, 'recovery')`,
    [capsuleId]
  );

  // 9. Store recovery authorization
  await pool.query(
    `UPDATE legacy_capsules
     SET recovery_authorized_by = $1, recovery_authorized_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [`clinician:${clinicianPayload.userId || clinicianPayload.sub},admin:${adminPayload.userId || adminPayload.sub}`,
     capsuleId]
  );

  // 10. Return to designee (NOT clinician/admin)
  return {
    affirmation,
    breathCadence: cap.breath_cadence,
    artUrl: cap.art_token_id ? `${PINATA_GATEWAY}/${cap.art_token_id}` : null,
    ns3Context,
    creatorName: cap.creator_name,
    recoveryMethod: true
  };
}

module.exports = {
  checkAvailableCapsules,
  unlockCapsule,
  recoverCapsule
};
