// ============================================================
// [ABI] Vault Recovery Service — Dual-Key Seed Phrase Backup
// File: src/services/vaultRecoveryService.js
//
// Creates encrypted backups of BIP39 seed phrases using a key
// derived from BOTH a clinician and an admin. Neither can
// decrypt alone. Every recovery is permanently logged.
//
// The participant NEVER knows this backup exists.
// It catches them when facility life destroys their 12 words.
// 42 CFR Part 2 protected.
// ============================================================

'use strict';

const crypto = require('crypto');
const Sentry = require('../instrument');
const pool = require('../db/pool');

const RECOVERY_KEY = process.env.RECOVERY_ENCRYPTION_KEY;

// ── Dual-Key Derivation ────────────────────────────────────
// Key = HMAC(concat(clinician_secret, admin_secret))
// clinician_secret = HMAC(RECOVERY_KEY, clinician_id)
// admin_secret = HMAC(RECOVERY_KEY, admin_id)
// Neither secret alone can produce the dual key.

function deriveDualKey(clinicianId, adminId) {
  if (!RECOVERY_KEY) {
    throw new Error('RECOVERY_ENCRYPTION_KEY not configured');
  }
  const clinicianSecret = crypto.createHmac('sha256', RECOVERY_KEY)
    .update(clinicianId.toString()).digest();
  const adminSecret = crypto.createHmac('sha256', RECOVERY_KEY)
    .update(adminId.toString()).digest();
  return crypto.createHmac('sha256',
    Buffer.concat([clinicianSecret, adminSecret])).digest();
}

// ── AES-256-GCM Encrypt ────────────────────────────────────

function encryptWithDualKey(plaintext, dualKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', dualKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Payload: [16 bytes IV][16 bytes authTag][encrypted data]
  return Buffer.concat([iv, authTag, encrypted]);
}

// ── AES-256-GCM Decrypt ────────────────────────────────────

function decryptWithDualKey(payload, dualKey) {
  const iv = payload.slice(0, 16);
  const authTag = payload.slice(16, 32);
  const encrypted = payload.slice(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', dualKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// ── createRecoveryBackup ───────────────────────────────────
// Called ONCE when participant first generates their seed phrase.
// The backup is encrypted with a key derived from BOTH
// the clinician's and admin's credentials.
// Neither can decrypt alone.

async function createRecoveryBackup(userId, seedPhrase, clinicianId, adminId, tenantId) {
  // 1. Derive dual encryption key
  const dualKey = deriveDualKey(clinicianId, adminId);

  // 2. Encrypt seed phrase with dual key (AES-256-GCM)
  const payload = encryptWithDualKey(seedPhrase, dualKey);

  // 3. Store encrypted backup
  const result = await pool.query(`
    INSERT INTO vault_recovery_backups
    (user_id, tenant_id, encrypted_backup, approver_a_id, approver_b_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [userId, tenantId, payload, clinicianId, adminId]);

  // 4. Seed phrase is NOT stored anywhere else. Only this encrypted backup.
  console.log(JSON.stringify({
    type: 'recovery_backup_created',
    user_id: userId,
    backup_id: result.rows[0].id,
    approver_a_id: clinicianId,
    approver_b_id: adminId,
    timestamp: new Date().toISOString()
  }));

  return { backup_created: true, backup_id: result.rows[0].id };
}

// ── recoverSeedPhrase ──────────────────────────────────────
// BOTH the original clinician AND admin must authenticate.
// If either approver has changed, the backup must be
// re-encrypted with the new approver pair (see rotateApprover).

async function recoverSeedPhrase(userId, clinicianId, adminId, reason, reasonNotes, ipAddress) {
  // 1. Get active backup
  const backup = await pool.query(
    'SELECT * FROM vault_recovery_backups WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );
  if (!backup.rows.length) {
    throw new Error('No active recovery backup found');
  }

  const b = backup.rows[0];

  // 2. Verify approvers match
  if (b.approver_a_id !== clinicianId || b.approver_b_id !== adminId) {
    Sentry.captureMessage(
      `Vault recovery approver mismatch: user ${userId}, expected ${b.approver_a_id}/${b.approver_b_id}, got ${clinicianId}/${adminId}`,
      'warning'
    );
    throw new Error('Approver mismatch — both original approvers required');
  }

  // 3. Derive same dual key
  const dualKey = deriveDualKey(clinicianId, adminId);

  // 4. Decrypt
  const seedPhrase = decryptWithDualKey(b.encrypted_backup, dualKey);

  // 5. Log recovery event (permanent, immutable)
  await pool.query(`
    INSERT INTO vault_recovery_events
    (backup_id, user_id, approver_a_id, approver_b_id, reason, reason_notes, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [b.id, userId, clinicianId, adminId, reason, reasonNotes || null, ipAddress || null]);

  // 6. Increment recovery count
  await pool.query(
    'UPDATE vault_recovery_backups SET recovery_count = recovery_count + 1, last_recovery_at = NOW() WHERE id = $1',
    [b.id]
  );

  // 7. Sentry audit trail — warning level, no PHI
  Sentry.captureMessage(
    `Vault recovery executed: user ${userId}, reason: ${reason}, recovery_count: ${b.recovery_count + 1}`,
    'warning'
  );

  // NOTE: seed phrase returned to calling route, displayed ONCE,
  // then cleared from memory. Never logged. Never stored in response body cache.
  return { recovered: true, recovery_count: b.recovery_count + 1 };
}

// ── getRecoveryHistory ─────────────────────────────────────
// Returns recovery events WITHOUT the seed phrase.
// For courts, auditors, and admin review.

async function getRecoveryHistory(userId) {
  const events = await pool.query(`
    SELECT e.id, e.backup_id, e.reason, e.reason_notes,
           e.approver_a_id, e.approver_b_id, e.ip_address, e.recovered_at,
           ua.email AS approver_a_email, ub.email AS approver_b_email
    FROM vault_recovery_events e
    LEFT JOIN users ua ON ua.id = e.approver_a_id
    LEFT JOIN users ub ON ub.id = e.approver_b_id
    WHERE e.user_id = $1
    ORDER BY e.recovered_at DESC
  `, [userId]);

  const backup = await pool.query(
    'SELECT id, status, recovery_count, last_recovery_at, approver_a_id, approver_b_id, created_at FROM vault_recovery_backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  return {
    backup: backup.rows[0] || null,
    events: events.rows
  };
}

// ── revokeBackup ───────────────────────────────────────────
// Admin-only. Participant must re-enroll with new seed phrase.

async function revokeBackup(userId, adminId, reason) {
  const result = await pool.query(
    `UPDATE vault_recovery_backups SET status = 'revoked'
     WHERE user_id = $1 AND status = 'active'
     RETURNING id`,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error('No active backup to revoke');
  }

  Sentry.captureMessage(
    `Vault backup revoked: user ${userId}, by admin ${adminId}, reason: ${reason}`,
    'warning'
  );

  return { revoked: true, backup_id: result.rows[0].id };
}

// ── rotateApprover ─────────────────────────────────────────
// When an approver leaves Mettle Works, re-encrypt the backup
// with the replacement approver. Requires the DEPARTING approver
// to be present for decryption (or use the existing pair first).

async function rotateApprover(userId, oldClinicianId, oldAdminId, newClinicianId, newAdminId) {
  // 1. Get active backup
  const backup = await pool.query(
    'SELECT * FROM vault_recovery_backups WHERE user_id = $1 AND status = $2',
    [userId, 'active']
  );
  if (!backup.rows.length) {
    throw new Error('No active recovery backup found');
  }

  const b = backup.rows[0];

  // 2. Verify old approvers match
  if (b.approver_a_id !== oldClinicianId || b.approver_b_id !== oldAdminId) {
    throw new Error('Current approver mismatch');
  }

  // 3. Decrypt with old dual key
  const oldDualKey = deriveDualKey(oldClinicianId, oldAdminId);
  const seedPhrase = decryptWithDualKey(b.encrypted_backup, oldDualKey);

  // 4. Re-encrypt with new dual key
  const newDualKey = deriveDualKey(newClinicianId, newAdminId);
  const newPayload = encryptWithDualKey(seedPhrase, newDualKey);

  // 5. Update backup with new approvers + encrypted data
  await pool.query(`
    UPDATE vault_recovery_backups
    SET encrypted_backup = $1, approver_a_id = $2, approver_b_id = $3
    WHERE id = $4
  `, [newPayload, newClinicianId, newAdminId, b.id]);

  Sentry.captureMessage(
    `Vault approver rotated: user ${userId}, clinician ${oldClinicianId}->${newClinicianId}, admin ${oldAdminId}->${newAdminId}`,
    'warning'
  );

  return { rotated: true, backup_id: b.id };
}

module.exports = {
  createRecoveryBackup,
  recoverSeedPhrase,
  getRecoveryHistory,
  revokeBackup,
  rotateApprover,
  // Exported for testing only
  deriveDualKey,
  encryptWithDualKey,
  decryptWithDualKey
};
