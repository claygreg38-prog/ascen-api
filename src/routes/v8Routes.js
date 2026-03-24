// ============================================================
// ASCEN v8 Immersive Frontend Routes
// File: src/routes/v8Routes.js
//
// Progress + Vault endpoints for the v8 breathing session engine.
// All flows through ABI — no bypasses.
// ============================================================

const Sentry = require('../instrument');
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { tenantWhere, tenantInsert } = require('../utils/tenantHelper');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── AES-256-CBC ENCRYPTION (same pattern as ipfsService.js) ──

function encryptVault(plaintext, key) {
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(key, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptVault(encryptedString, key) {
  const [ivHex, ciphertext] = encryptedString.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/fr/progress — Save session progress
// ═══════════════════════════════════════════════════════════════

router.post('/progress', async (req, res) => {
  try {
    const { user_id, session_number, completed, coherence_score, duration_seconds, session_type } = req.body;

    if (!user_id || !session_number) {
      return res.status(400).json({ error: 'user_id and session_number required' });
    }

    const t = tenantInsert(req.tenantId, 5);

    await pool.query(`
      INSERT INTO session_completions (user_id, session_number, coherence_score, active_duration_seconds, exit_type${t.columns}, completed_at)
      VALUES ($1, $2, $3, $4, $5${t.values}, NOW())
      ON CONFLICT (user_id, session_number)
      DO UPDATE SET
        coherence_score = COALESCE($3, session_completions.coherence_score),
        active_duration_seconds = COALESCE($4, session_completions.active_duration_seconds),
        exit_type = COALESCE($5, session_completions.exit_type),
        completed_at = CASE WHEN $6 = true THEN NOW() ELSE session_completions.completed_at END
    `, [user_id, session_number, coherence_score || null, duration_seconds || null, completed ? 'completed' : 'in_progress', ...t.params, completed || false]);

    res.json({ success: true, session_number });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/fr/vault — Save encrypted vault response
// ═══════════════════════════════════════════════════════════════

router.post('/vault', async (req, res) => {
  try {
    const { user_id, session_number, vault_response, session_type } = req.body;

    if (!user_id || !session_number || !vault_response) {
      return res.status(400).json({ error: 'user_id, session_number, and vault_response required' });
    }

    const encryptionKey = process.env.ART_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return res.status(500).json({ error: 'Encryption key not configured' });
    }

    // Encrypt vault response at rest — NEVER store plaintext
    const encrypted = encryptVault(
      typeof vault_response === 'string' ? vault_response : JSON.stringify(vault_response),
      encryptionKey
    );

    const t = tenantWhere(req.tenantId, 3);
    await pool.query(`
      UPDATE session_completions
      SET vault_response_encrypted = $1
      WHERE user_id = $2 AND session_number = $3${t.clause}
    `, [encrypted, user_id, session_number, ...t.params]);

    res.json({ sealed: true });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/fr/vault/:sessionNumber — Clinician-only vault read
// ═══════════════════════════════════════════════════════════════

router.get('/vault/:sessionNumber', async (req, res) => {
  try {
    // Clinician role check
    if (!req.user || (req.user.role !== 'clinician' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Clinician access required' });
    }

    const sessionNumber = parseInt(req.params.sessionNumber, 10);
    const userId = req.query.user_id || req.user.userId;

    const t = tenantWhere(req.tenantId, 2);
    const result = await pool.query(
      `SELECT vault_response_encrypted FROM session_completions WHERE user_id = $1 AND session_number = $2${t.clause}`,
      [userId, sessionNumber, ...t.params]
    );

    if (!result.rows.length || !result.rows[0].vault_response_encrypted) {
      return res.status(404).json({ error: 'No vault response found' });
    }

    const encryptionKey = process.env.ART_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return res.status(500).json({ error: 'Encryption key not configured' });
    }

    const decrypted = decryptVault(result.rows[0].vault_response_encrypted, encryptionKey);

    res.json({ vault_response: decrypted, session_number: sessionNumber });
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
