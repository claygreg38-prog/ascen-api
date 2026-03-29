// ============================================================
// [ABI] Merchandise Routes — Export, Poster, Verify
// File: src/routes/merchandiseRoutes.js
//
// All routes flow through ABI orchestrator. No bypasses.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const breathArtEngine = require('../abi/breathArtEngine');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { tenantWhere } = require('../utils/tenantHelper');
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// ── GET /export/:tokenId — High-res PNG export for print ─────

router.get('/export/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const dpi = parseInt(req.query.dpi) || 150;
    const colorspace = req.query.colorspace || 'rgb';
    const size = parseInt(req.query.size) || 800;
    const background = req.query.background || 'dark';

    // Validate params
    if (![150, 300, 600].includes(dpi)) {
      return res.status(400).json({ error: 'dpi must be 150, 300, or 600' });
    }
    if (![800, 1200, 2400].includes(size)) {
      return res.status(400).json({ error: 'size must be 800, 1200, or 2400' });
    }

    // Find the session completion with this art
    const session = await pool.query(
      `SELECT sc.*, u.user_id, u.wallet_address
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.user_id
       WHERE sc.art_token_id = $1 OR sc.art_ipfs_hash = $1
       ORDER BY sc.completed_at DESC LIMIT 1`,
      [tokenId]
    );

    if (session.rows.length === 0) {
      // Check aggregations
      const agg = await pool.query(
        `SELECT * FROM art_aggregations WHERE art_token_id = $1 OR art_ipfs_hash = $1 LIMIT 1`,
        [tokenId]
      );
      if (agg.rows.length === 0) {
        return res.status(404).json({ error: 'Art piece not found' });
      }
    }

    const row = session.rows[0];

    // Verify ownership via participant_id from auth
    const requesterId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    if (row && row.user_id !== requesterId) {
      return res.status(403).json({ error: 'You do not own this art piece' });
    }

    // Re-generate SVG at higher resolution from stored parameters
    // Fetch the metadata from IPFS to get original params
    const ipfsHash = row?.art_ipfs_hash || tokenId;
    let svgString;

    // Re-generate from session data for higher quality
    if (row && row.packet_hash) {
      const ns3Summary = {
        ns3: {
          mean: parseFloat(row.ns3_mean) || 50,
          peak: parseFloat(row.ns3_peak) || 50,
          floor: parseFloat(row.ns3_mean) - 10 || 40
        },
        clinical: {
          regulatoryTrajectory: row.regulatory_trajectory || 'stable',
          sustainedOptimal: row.sustained_optimal || false
        },
        verificationPayload: {
          peakCoherence: parseFloat(row.coherence_score) || 0.5
        }
      };

      const artOptions = {
        session_count: row.session_number || 1,
        track: row.breath_track_at_completion || 'standard',
        arc_name: row.arc_id || 'standard',
        time_to_regulation_sec: row.time_to_regulation_sec || null,
        breath_accuracy: parseFloat(row.cycle_completion_rate) || 50
      };

      const result = breathArtEngine.generate(ns3Summary, row.packet_hash, artOptions);
      svgString = result.svgString;
    } else {
      return res.status(404).json({ error: 'Cannot regenerate art — missing session data' });
    }

    // Render at requested size
    const sharp = require('sharp');
    let pipeline = sharp(Buffer.from(svgString))
      .resize(size, size)
      .png({ quality: 100 });

    if (background === 'transparent') {
      // Remove dark background (note: SVG has dark bg baked in, transparent may not fully work)
      pipeline = pipeline.ensureAlpha();
    }

    // CMYK note: sharp does not natively support CMYK output.
    // For production, use a post-processing service or ICC profile conversion.
    if (colorspace === 'cmyk') {
      res.set('X-Colorspace-Note', 'CMYK conversion requires post-processing. RGB output provided.');
    }

    const pngBuffer = await pipeline.toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="breath-art-${tokenId}-${size}px.png"`);
    res.set('X-DPI', String(dpi));
    res.send(pngBuffer);

  } catch (err) {
    console.error('[Merch] Export failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── GET /poster/:participantId — Multi-piece gallery poster ──

router.get('/poster/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const sessions = req.query.sessions || 'last50';
    const layout = req.query.layout || 'grid';
    const size = parseInt(req.query.size) || 2400;

    if (![2400, 3600].includes(size)) {
      return res.status(400).json({ error: 'size must be 2400 or 3600' });
    }

    // Verify ownership
    const requesterId = req.user?.participant_id || req.user?.user_id || req.user?.sub;
    if (participantId !== requesterId) {
      return res.status(403).json({ error: 'You can only generate posters for your own sessions' });
    }

    // Build query based on session range
    let query, params;
    if (sessions === 'last50') {
      query = `SELECT session_number, packet_hash, ns3_mean, ns3_peak,
                      coherence_score, sustained_optimal, regulatory_trajectory,
                      breath_track_at_completion, arc_id, cycle_completion_rate,
                      art_ipfs_hash
               FROM session_completions
               WHERE user_id = $1 AND packet_hash IS NOT NULL
               ORDER BY session_number DESC LIMIT 50`;
      params = [participantId];
    } else if (sessions === 'last12') {
      query = `SELECT session_number, packet_hash, ns3_mean, ns3_peak,
                      coherence_score, sustained_optimal, regulatory_trajectory,
                      breath_track_at_completion, arc_id, cycle_completion_rate,
                      art_ipfs_hash
               FROM session_completions
               WHERE user_id = $1 AND packet_hash IS NOT NULL
               ORDER BY session_number DESC LIMIT 12`;
      params = [participantId];
    } else if (sessions === 'all') {
      query = `SELECT session_number, packet_hash, ns3_mean, ns3_peak,
                      coherence_score, sustained_optimal, regulatory_trajectory,
                      breath_track_at_completion, arc_id, cycle_completion_rate,
                      art_ipfs_hash
               FROM session_completions
               WHERE user_id = $1 AND packet_hash IS NOT NULL
               ORDER BY session_number ASC`;
      params = [participantId];
    } else if (sessions.includes('-')) {
      const [start, end] = sessions.split('-').map(Number);
      query = `SELECT session_number, packet_hash, ns3_mean, ns3_peak,
                      coherence_score, sustained_optimal, regulatory_trajectory,
                      breath_track_at_completion, arc_id, cycle_completion_rate,
                      art_ipfs_hash
               FROM session_completions
               WHERE user_id = $1 AND session_number >= $2 AND session_number <= $3
                     AND packet_hash IS NOT NULL
               ORDER BY session_number ASC`;
      params = [participantId, start, end];
    } else {
      return res.status(400).json({ error: 'sessions must be last50, last12, all, or a range like 10-60' });
    }

    const result = await pool.query(query, params);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No sessions found for poster generation' });
    }

    // Reverse for chronological order if fetched DESC
    if (sessions === 'last50' || sessions === 'last12') {
      rows.reverse();
    }

    // Generate individual thumbnails
    const sharp = require('sharp');
    const thumbSize = 200;
    const cols = Math.min(rows.length, sessions === 'last12' ? 4 : 5);
    const rowCount = Math.ceil(rows.length / cols);
    const posterWidth = size;
    const posterHeight = Math.round(size * (rowCount / cols));

    // Generate each piece as a small PNG
    const thumbnails = [];
    for (const row of rows) {
      if (!row.packet_hash) continue;

      const summary = {
        ns3: {
          mean: parseFloat(row.ns3_mean) || 50,
          peak: parseFloat(row.ns3_peak) || 50,
          floor: (parseFloat(row.ns3_mean) || 50) - 10
        },
        clinical: {
          regulatoryTrajectory: row.regulatory_trajectory || 'stable',
          sustainedOptimal: row.sustained_optimal || false
        },
        verificationPayload: { peakCoherence: parseFloat(row.coherence_score) || 0.5 }
      };

      const opts = {
        session_count: row.session_number || 1,
        track: row.breath_track_at_completion || 'standard',
        arc_name: row.arc_id || 'standard',
        breath_accuracy: parseFloat(row.cycle_completion_rate) || 50,
        milestone_session: [10, 30, 50].includes(row.session_number) ? row.session_number : 0
      };

      const { svgString } = breathArtEngine.generate(summary, row.packet_hash, opts);
      const thumbBuffer = await sharp(Buffer.from(svgString))
        .resize(thumbSize, thumbSize)
        .png()
        .toBuffer();

      thumbnails.push({ buffer: thumbBuffer, sessionNumber: row.session_number });
    }

    // Compose poster grid
    const cellSize = Math.floor(posterWidth / cols);
    const composites = thumbnails.map((thumb, i) => ({
      input: thumb.buffer,
      left: (i % cols) * cellSize,
      top: Math.floor(i / cols) * cellSize
    }));

    const poster = await sharp({
      create: {
        width: posterWidth,
        height: rowCount * cellSize,
        channels: 4,
        background: { r: 6, g: 26, b: 42, alpha: 1 } // #061a2a
      }
    })
      .composite(composites.map(c => ({
        input: c.input,
        left: c.left,
        top: c.top,
        // Resize each thumbnail to fit cell
      })))
      .resize(posterWidth, rowCount * cellSize, { fit: 'cover' })
      .png()
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="breath-poster-${participantId}.png"`);
    res.send(poster);

  } catch (err) {
    console.error('[Merch] Poster generation failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Poster generation failed' });
  }
});

// ── GET /crest/:familyUnitId — Family crest (stub) ───────────

router.get('/crest/:familyUnitId', async (req, res) => {
  // Family Crest generation coming in a future release.
  // Full algorithm: fetch family constellation art + individual member mandalas,
  // compose into heraldic-style crest with family name banner, member count badge,
  // combined session total, and interlocking breath ring patterns.
  // Each member's dominant NS3 zone contributes a quadrant color.
  // Elder's capstone (if exists) forms the central shield.
  res.status(501).json({
    error: 'Family Crest generation coming in a future release',
    planned_features: [
      'Heraldic composition from member mandalas',
      'Elder capstone as central shield',
      'Quadrant coloring by NS3 zone',
      'Combined session total badge'
    ]
  });
});

// ── GET /verify/:tokenId — Ownership verification for print ──

router.get('/verify/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const wallet = req.query.wallet;

    if (!wallet) {
      return res.status(400).json({ error: 'wallet query parameter required' });
    }

    // Check DB: does this wallet hold this token?
    const session = await pool.query(
      `SELECT sc.art_token_id, sc.art_ipfs_hash, u.wallet_address
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.user_id
       WHERE (sc.art_token_id = $1 OR sc.art_ipfs_hash = $1)
         AND u.wallet_address = $2
       LIMIT 1`,
      [tokenId, wallet]
    );

    if (session.rows.length === 0) {
      // Check aggregations
      const agg = await pool.query(
        `SELECT aa.art_token_id, aa.art_ipfs_hash, u.wallet_address
         FROM art_aggregations aa
         JOIN users u ON aa.participant_id = u.id
         WHERE (aa.art_token_id = $1 OR aa.art_ipfs_hash = $1)
           AND u.wallet_address = $2
         LIMIT 1`,
        [tokenId, wallet]
      );

      if (agg.rows.length === 0) {
        return res.status(403).json({ verified: false, reason: 'Wallet does not hold this token' });
      }
    }

    // Generate signed merchandise license JWT (24-hour expiry)
    const encryptionKey = process.env.ART_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const license = jwt.sign(
      {
        tokenId,
        wallet,
        type: 'merchandise_license',
      },
      encryptionKey,
      { expiresIn: '24h' }
    );

    res.json({ verified: true, license });

  } catch (err) {
    console.error('[Merch] Verify failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
