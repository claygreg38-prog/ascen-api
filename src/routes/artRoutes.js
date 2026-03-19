// ============================================================
// [ABI] Art Routes — Breath Art API
// File: src/routes/artRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { decryptClinicalPayload } = require('../services/ipfsService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { tenantWhere } = require('../utils/tenantHelper');

const VALID_CROWNS = ['flower_of_life', 'metatrons_cube', 'sri_yantra', 'seed_of_life', 'vesica_piscis'];
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// ── Helper: determine milestone/victory/arc ──────────────────
function enrichPiece(row) {
  const sessionNum = row.session_number || 0;
  return {
    session_id: row.session_id || row.id,
    session_number: sessionNum,
    date: row.completed_at ? new Date(row.completed_at).toISOString().split('T')[0] : null,
    art_ipfs_hash: row.art_ipfs_hash,
    art_token_id: row.art_token_id,
    art_encoding_version: row.art_encoding_version || 1,
    crown_id: row.crown_id,
    has_photo_palette: !!(row.photo_palette),
    has_intention: !!(row.intention_hash),
    is_milestone: [10, 30, 50].includes(sessionNum),
    is_victory_lap: row.sustained_optimal === true,
    arc_name: row.arc_id || null,
    ipfs_image_url: row.art_ipfs_hash ? `${PINATA_GATEWAY}/${row.art_ipfs_hash}` : null
  };
}

// ── GET /session/:id — Single session art piece ──────────────
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const t = tenantWhere(req.tenantId, 1);
    const result = await pool.query(
      `SELECT session_id, session_number, completed_at, art_ipfs_hash, art_token_id,
              art_encoding_version, crown_id, photo_palette, intention_hash,
              sustained_optimal, arc_id
       FROM session_completions WHERE session_id = $1${t.clause}
       ORDER BY completed_at DESC LIMIT 1`,
      [id, ...t.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session art not found' });
    }

    res.json(enrichPiece(result.rows[0]));
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ART] GET /session/:id failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /gallery/:participantId — Full gallery, paginated ────
router.get('/gallery/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const t = tenantWhere(req.tenantId, 1);
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM session_completions
       WHERE user_id = $1 AND art_ipfs_hash IS NOT NULL${t.clause}`,
      [participantId, ...t.params]
    );
    const total = parseInt(countResult.rows[0].total);

    const t2 = tenantWhere(req.tenantId, 3);
    const result = await pool.query(
      `SELECT session_id, session_number, completed_at, art_ipfs_hash, art_token_id,
              art_encoding_version, crown_id, photo_palette, intention_hash,
              sustained_optimal, arc_id
       FROM session_completions
       WHERE user_id = $1 AND art_ipfs_hash IS NOT NULL${t2.clause}
       ORDER BY completed_at DESC
       LIMIT $2 OFFSET $3`,
      [participantId, limit, offset, ...t2.params]
    );

    res.json({
      participant_id: participantId,
      total_pieces: total,
      page,
      pages: Math.ceil(total / limit),
      pieces: result.rows.map(enrichPiece)
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ART] GET /gallery/:participantId failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /decode/:tokenId — Clinical readout (requires key) ──
router.get('/decode/:tokenId', async (req, res) => {
  try {
    const clinicalKey = req.headers['x-clinical-key'];
    if (!clinicalKey || clinicalKey !== process.env.ART_ENCRYPTION_KEY) {
      return res.status(403).json({ error: 'Invalid or missing X-Clinical-Key' });
    }

    const { tokenId } = req.params;

    const t = tenantWhere(req.tenantId, 1);
    const result = await pool.query(
      `SELECT art_token_id, art_encoding_version, art_ipfs_hash,
              ns3_peak, ns3_floor, ns3_mean, coherence_score as coherence_peak,
              optimal_zone_pct, regulatory_trajectory, sustained_optimal,
              zone_time_profile
       FROM session_completions WHERE art_token_id = $1${t.clause}
       ORDER BY completed_at DESC LIMIT 1`,
      [tokenId, ...t.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const row = result.rows[0];
    const zoneProfile = row.zone_time_profile || {};

    res.json({
      token_id: tokenId,
      encoding_version: row.art_encoding_version || 1,
      clinical_readout: {
        ns3_peak: row.ns3_peak || 0,
        ns3_floor: row.ns3_floor || 0,
        ns3_mean: row.ns3_mean || 0,
        coherence_peak: row.coherence_peak || 0,
        zone_profile: zoneProfile,
        trajectory: row.regulatory_trajectory || 'stable',
        somatic_reset_used: false,
        breath_accuracy: 0
      }
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ART] GET /decode/:tokenId failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /session/:id/crown — Update crown selection ────────
router.patch('/session/:id/crown', async (req, res) => {
  try {
    const { id } = req.params;
    const { crown_id } = req.body;

    if (!crown_id || !VALID_CROWNS.includes(crown_id)) {
      return res.status(400).json({ error: 'Invalid crown_id', valid: VALID_CROWNS });
    }

    const result = await pool.query(
      `UPDATE session_completions SET crown_id = $1
       WHERE session_id = $2 RETURNING session_id`,
      [crown_id, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session_id: id, crown_id, updated: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ART] PATCH /session/:id/crown failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /session/:id/intention — Store intention hash ──────
router.patch('/session/:id/intention', async (req, res) => {
  try {
    const { id } = req.params;
    const { intention_hash } = req.body;

    if (!intention_hash || !/^[a-f0-9]{64}$/i.test(intention_hash)) {
      return res.status(400).json({ error: 'intention_hash must be a 64-char hex string (SHA-256)' });
    }

    const result = await pool.query(
      `UPDATE session_completions SET intention_hash = $1
       WHERE session_id = $2 RETURNING session_id`,
      [intention_hash, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session_id: id, intention_hash, updated: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ART] PATCH /session/:id/intention failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /session/:id/photo-palette — Photo abstraction ──────
router.post('/session/:id/photo-palette', express.raw({ type: 'image/*', limit: '10mb' }), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'Image data required' });
    }

    const { extractPalette } = require('../services/photoAbstractionService');
    const { palette } = await extractPalette(req.body);

    await pool.query(
      `UPDATE session_completions SET photo_palette = $1
       WHERE session_id = $2`,
      [JSON.stringify(palette), id]
    );

    // Original image is NEVER stored — only the palette
    res.json({ session_id: id, palette, updated: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ART] POST /session/:id/photo-palette failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TODO Session 10+: Screenshot protection (dummyArtEngine.js)
// Replace real art with dummy on screenshot detection
// iOS: UIApplicationUserDidTakeScreenshotNotification
// Android: FileObserver on screenshot directories
// Web: visibilitychange + clipboard API monitoring

// TODO Session 10+: Offset clinical display values
// When metrics shown on mirror screen, offset by ±3% (deterministic per session)
// Env var: DISPLAY_OFFSET_ENABLED=true|false
// See Review Finding #2 — spec says ±2-5%, code produces ±3%. Aligned to ±3%.

module.exports = router;
