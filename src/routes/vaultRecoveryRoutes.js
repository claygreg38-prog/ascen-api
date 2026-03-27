// ============================================================
// [ABI] Vault Recovery Routes — Dual-Key Recovery API
// File: src/routes/vaultRecoveryRoutes.js
//
// All endpoints require JWT + clinician or admin role.
// Mounted at /api/vault/recovery
// 42 CFR Part 2 protected.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const vaultRecoveryService = require('../services/vaultRecoveryService');

// ── POST /backup — Create backup during enrollment ──────────
// Clinician + admin must both be authenticated.
// seed_phrase is received, encrypted, and NEVER stored in plaintext.
router.post('/backup', async (req, res) => {
  try {
    const { user_id, seed_phrase, clinician_id, admin_id, tenant_id } = req.body;

    if (!user_id || !seed_phrase || !clinician_id || !admin_id) {
      return res.status(400).json({
        error: 'user_id, seed_phrase, clinician_id, and admin_id required'
      });
    }

    const result = await vaultRecoveryService.createRecoveryBackup(
      user_id, seed_phrase, clinician_id, admin_id, tenant_id || null
    );

    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[VAULT_RECOVERY] POST /backup failed:', err.message);
    res.status(err.message.includes('not configured') ? 500 : 400)
      .json({ error: err.message });
  }
});

// ── POST /recover — Recover seed phrase (dual approval) ─────
// Both approvers must be authenticated in the same request.
// Response contains seed_phrase — displayed ONCE, cleared immediately.
router.post('/recover', async (req, res) => {
  try {
    const { user_id, clinician_id, admin_id, reason, reason_notes } = req.body;

    if (!user_id || !clinician_id || !admin_id || !reason) {
      return res.status(400).json({
        error: 'user_id, clinician_id, admin_id, and reason required'
      });
    }

    const validReasons = [
      'facility_transfer', 'lost_phrase', 'confiscated',
      'damaged', 'facility_policy', 'other'
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        error: `reason must be one of: ${validReasons.join(', ')}`
      });
    }

    // Recover — returns { recovered, recovery_count }
    const recoveryResult = await vaultRecoveryService.recoverSeedPhrase(
      user_id, clinician_id, admin_id, reason, reason_notes,
      req.ip || req.headers['x-forwarded-for'] || null
    );

    // The seed phrase must be re-derived for the response.
    // recoverSeedPhrase returns metadata only — the route must
    // call the internal decrypt to get the phrase for display.
    // We re-derive here to keep the service layer clean.
    const pool = require('../db/pool');
    const backup = await pool.query(
      'SELECT * FROM vault_recovery_backups WHERE user_id = $1 AND status = $2',
      [user_id, 'active']
    );

    if (!backup.rows.length) {
      return res.status(404).json({ error: 'No active backup' });
    }

    const b = backup.rows[0];
    const dualKey = vaultRecoveryService.deriveDualKey(clinician_id, admin_id);
    const seedPhrase = vaultRecoveryService.decryptWithDualKey(b.encrypted_backup, dualKey);

    // Return seed phrase — displayed ONCE by client, then cleared
    res.json({
      recovered: true,
      seed_phrase: seedPhrase,
      recovery_count: recoveryResult.recovery_count
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[VAULT_RECOVERY] POST /recover failed:', err.message);
    const status = err.message.includes('No active') ? 404
      : err.message.includes('mismatch') ? 403
      : err.message.includes('not configured') ? 500 : 400;
    res.status(status).json({ error: err.message });
  }
});

// ── GET /history/:userId — Recovery event history ───────────
// Admin only. Shows dates, reasons, approvers, recovery count.
// Does NOT show the seed phrase.
router.get('/history/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user_id' });
    }

    const result = await vaultRecoveryService.getRecoveryHistory(userId);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[VAULT_RECOVERY] GET /history/:userId failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /revoke/:userId — Revoke backup ────────────────────
// Admin only, with reason. Sets status = 'revoked'.
// Participant must re-enroll with new seed phrase.
router.post('/revoke/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user_id' });
    }

    const adminId = req.body.admin_id || req.user?.userId;
    const reason = req.body.reason;

    if (!adminId || !reason) {
      return res.status(400).json({ error: 'admin_id and reason required' });
    }

    const result = await vaultRecoveryService.revokeBackup(userId, adminId, reason);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[VAULT_RECOVERY] POST /revoke/:userId failed:', err.message);
    const status = err.message.includes('No active') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── POST /rotate — Rotate approver (approver leaves org) ────
// Re-encrypts backup with new approver pair.
// Requires old approvers for decryption.
router.post('/rotate', async (req, res) => {
  try {
    const { user_id, old_clinician_id, old_admin_id, new_clinician_id, new_admin_id } = req.body;

    if (!user_id || !old_clinician_id || !old_admin_id || !new_clinician_id || !new_admin_id) {
      return res.status(400).json({
        error: 'user_id, old_clinician_id, old_admin_id, new_clinician_id, and new_admin_id required'
      });
    }

    const result = await vaultRecoveryService.rotateApprover(
      user_id, old_clinician_id, old_admin_id, new_clinician_id, new_admin_id
    );
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[VAULT_RECOVERY] POST /rotate failed:', err.message);
    const status = err.message.includes('mismatch') ? 403
      : err.message.includes('No active') ? 404
      : err.message.includes('not configured') ? 500 : 400;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
