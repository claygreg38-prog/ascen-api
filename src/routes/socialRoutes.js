// ============================================================
// [ABI] Social Routes — Breath Art Showcase
// File: src/routes/socialRoutes.js
//
// Privacy: ONLY first names. ONLY personalized art.
// NEVER clinical originals. NEVER biometric data.
// ============================================================

const Sentry = require('../instrument');
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { filterCaption } = require('../services/contentFilter');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// ── GET / — Paginated showcase feed ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const requesterId = req.user?.userId || null;

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM showcase_posts WHERE is_active = true`
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT sp.id, u.first_name as participant_first_name,
              pa.personalized_ipfs_hash,
              sp.caption, sp.session_number, sp.arc_name,
              sp.is_milestone, sp.is_family_piece, sp.likes_count, sp.created_at,
              EXISTS(SELECT 1 FROM showcase_likes sl WHERE sl.post_id = sp.id AND sl.participant_id = $1) as liked_by_me
       FROM showcase_posts sp
       JOIN personalized_art pa ON sp.personalized_art_id = pa.id
       JOIN users u ON sp.participant_id = u.id
       WHERE sp.is_active = true
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [requesterId, limit, offset]
    );

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      posts: result.rows.map(r => ({
        ...r,
        personalized_art_url: r.personalized_ipfs_hash ? `${PINATA_GATEWAY}/${r.personalized_ipfs_hash}` : null
      }))
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] GET / failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST / — Share to showcase ───────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { personalized_art_id, caption, session_number, arc_name, is_milestone } = req.body;
    const participantId = req.body.participant_id || req.user?.userId;

    if (!personalized_art_id || !participantId) {
      return res.status(400).json({ error: 'personalized_art_id and participant_id required' });
    }

    // Validate ownership
    const artCheck = await pool.query(
      `SELECT id FROM personalized_art WHERE id = $1 AND participant_id = $2`,
      [personalized_art_id, participantId]
    );
    if (artCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Personalized art does not belong to participant' });
    }

    // Caption validation
    if (caption && caption.length > 140) {
      return res.status(400).json({ error: 'Caption must be 140 characters or fewer' });
    }

    if (caption) {
      const filter = filterCaption(caption);
      if (!filter.allowed) {
        return res.status(400).json({ error: filter.reason });
      }
    }

    const result = await pool.query(
      `INSERT INTO showcase_posts (participant_id, personalized_art_id, caption, session_number, arc_name, is_milestone, is_family_piece)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [participantId, personalized_art_id, caption || null, session_number || null, arc_name || null, is_milestone || false, false]
    );

    res.json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] POST / failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/like — Like a post ────────────────────────────
router.post('/:id/like', async (req, res) => {
  try {
    const postId = req.params.id;
    const participantId = req.body.participant_id || req.user?.userId;

    await pool.query(
      `INSERT INTO showcase_likes (post_id, participant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, participantId]
    );

    await pool.query(
      `UPDATE showcase_posts SET likes_count = (SELECT COUNT(*) FROM showcase_likes WHERE post_id = $1) WHERE id = $1`,
      [postId]
    );

    const updated = await pool.query(`SELECT likes_count FROM showcase_posts WHERE id = $1`, [postId]);
    res.json({ post_id: postId, likes_count: updated.rows[0]?.likes_count || 0 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] POST /:id/like failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /:id/like — Unlike a post ─────────────────────────
router.delete('/:id/like', async (req, res) => {
  try {
    const postId = req.params.id;
    const participantId = req.body.participant_id || req.user?.userId;

    await pool.query(
      `DELETE FROM showcase_likes WHERE post_id = $1 AND participant_id = $2`,
      [postId, participantId]
    );

    await pool.query(
      `UPDATE showcase_posts SET likes_count = (SELECT COUNT(*) FROM showcase_likes WHERE post_id = $1) WHERE id = $1`,
      [postId]
    );

    const updated = await pool.query(`SELECT likes_count FROM showcase_posts WHERE id = $1`, [postId]);
    res.json({ post_id: postId, likes_count: updated.rows[0]?.likes_count || 0 });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] DELETE /:id/like failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /milestones — Milestone pieces only ──────────────────
router.get('/milestones', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const requesterId = req.user?.userId || null;

    const result = await pool.query(
      `SELECT sp.id, u.first_name as participant_first_name,
              pa.personalized_ipfs_hash,
              sp.caption, sp.session_number, sp.arc_name,
              sp.is_milestone, sp.is_family_piece, sp.likes_count, sp.created_at,
              EXISTS(SELECT 1 FROM showcase_likes sl WHERE sl.post_id = sp.id AND sl.participant_id = $1) as liked_by_me
       FROM showcase_posts sp
       JOIN personalized_art pa ON sp.personalized_art_id = pa.id
       JOIN users u ON sp.participant_id = u.id
       WHERE sp.is_active = true AND sp.is_milestone = true
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [requesterId, limit, offset]
    );

    res.json({ posts: result.rows.map(r => ({
      ...r,
      personalized_art_url: r.personalized_ipfs_hash ? `${PINATA_GATEWAY}/${r.personalized_ipfs_hash}` : null
    })) });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] GET /milestones failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /family — Family pieces only ─────────────────────────
router.get('/family', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const requesterId = req.user?.userId || null;

    const result = await pool.query(
      `SELECT sp.id, u.first_name as participant_first_name,
              pa.personalized_ipfs_hash,
              sp.caption, sp.session_number, sp.arc_name,
              sp.is_milestone, sp.is_family_piece, sp.likes_count, sp.created_at,
              EXISTS(SELECT 1 FROM showcase_likes sl WHERE sl.post_id = sp.id AND sl.participant_id = $1) as liked_by_me
       FROM showcase_posts sp
       JOIN personalized_art pa ON sp.personalized_art_id = pa.id
       JOIN users u ON sp.participant_id = u.id
       WHERE sp.is_active = true AND sp.is_family_piece = true
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [requesterId, limit, offset]
    );

    res.json({ posts: result.rows.map(r => ({
      ...r,
      personalized_art_url: r.personalized_ipfs_hash ? `${PINATA_GATEWAY}/${r.personalized_ipfs_hash}` : null
    })) });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] GET /family failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /:id — Soft delete own post ───────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const participantId = req.body.participant_id || req.user?.userId;

    const result = await pool.query(
      `UPDATE showcase_posts SET is_active = false WHERE id = $1 AND participant_id = $2 RETURNING id`,
      [req.params.id, participantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Post not found or not yours' });
    }

    res.json({ id: req.params.id, deleted: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] DELETE /:id failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/report — Report a post ────────────────────────
router.post('/:id/report', async (req, res) => {
  try {
    const reporterId = req.body.reporter_id || req.user?.userId;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'reason required' });
    }

    await pool.query(
      `INSERT INTO showcase_reports (post_id, reporter_id, reason) VALUES ($1, $2, $3)`,
      [req.params.id, reporterId, reason]
    );

    res.json({ reported: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[SHOWCASE] POST /:id/report failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
