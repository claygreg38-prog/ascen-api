// ============================================================
// [ABI] Canvas Routes — Co-Creation Canvas
// File: src/routes/canvasRoutes.js
//
// Personalized art has NO clinical encoding — safe to share.
// The clinical credential lives in the original soulbound token.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { tenantWhere } = require('../utils/tenantHelper');

const PINATA_BASE = 'https://api.pinata.cloud';

// ── Upload personalized PNG to Pinata (NO clinical payload) ──
async function uploadPersonalizedArt(base64Data, name) {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_KEY;
  if (!apiKey || !secretKey) return null;

  const pngBuffer = Buffer.from(base64Data, 'base64');
  const boundary = '----CanvasBoundary' + Date.now();
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(header), pngBuffer, Buffer.from(footer)]);

  const response = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.IpfsHash;
}

// ── POST /save — Save personalized art ───────────────────────
router.post('/save', async (req, res) => {
  try {
    const { session_completion_id, participant_id, original_token_id, canvas_state } = req.body;

    if (!participant_id || !canvas_state) {
      return res.status(400).json({ error: 'participant_id and canvas_state required' });
    }

    // Validate session_completion belongs to participant (if provided)
    if (session_completion_id) {
      const check = await pool.query(
        `SELECT id FROM session_completions WHERE id = $1 AND user_id = $2`,
        [session_completion_id, participant_id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Session completion does not belong to participant' });
      }
    }

    // Upload composited PNG to Pinata if provided (NO clinical data)
    let ipfsHash = null;
    if (canvas_state.composited_png) {
      ipfsHash = await uploadPersonalizedArt(
        canvas_state.composited_png,
        `personalized_${participant_id}_${Date.now()}.png`
      );
    }

    // Strip the base64 PNG from stored canvas_state (save space)
    const storeState = { ...canvas_state };
    delete storeState.composited_png;

    const result = await pool.query(
      `INSERT INTO personalized_art (session_completion_id, participant_id, original_token_id, personalized_ipfs_hash, canvas_state)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, personalized_ipfs_hash`,
      [session_completion_id || null, participant_id, original_token_id || null, ipfsHash, JSON.stringify(storeState)]
    );

    res.json({ id: result.rows[0].id, personalized_ipfs_hash: result.rows[0].personalized_ipfs_hash });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[CANVAS] POST /save failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /:id — Retrieve saved canvas ─────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, session_completion_id, participant_id, original_token_id, personalized_ipfs_hash, canvas_state, created_at, updated_at
       FROM personalized_art WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Canvas not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    Sentry.captureException(err);
    console.error('[CANVAS] GET /:id failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /:id — Update canvas ─────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { canvas_state } = req.body;
    if (!canvas_state) {
      return res.status(400).json({ error: 'canvas_state required' });
    }

    // Re-upload if composited PNG updated
    let ipfsHash = null;
    if (canvas_state.composited_png) {
      ipfsHash = await uploadPersonalizedArt(
        canvas_state.composited_png,
        `personalized_update_${req.params.id}_${Date.now()}.png`
      );
    }

    const storeState = { ...canvas_state };
    delete storeState.composited_png;

    const updateFields = ['canvas_state = $1', 'updated_at = NOW()'];
    const params = [JSON.stringify(storeState)];
    let paramIdx = 2;

    if (ipfsHash) {
      updateFields.push(`personalized_ipfs_hash = $${paramIdx}`);
      params.push(ipfsHash);
      paramIdx++;
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE personalized_art SET ${updateFields.join(', ')} WHERE id = $${paramIdx} RETURNING id, personalized_ipfs_hash`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Canvas not found' });
    }

    res.json({ id: result.rows[0].id, personalized_ipfs_hash: result.rows[0].personalized_ipfs_hash, updated: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[CANVAS] PUT /:id failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
