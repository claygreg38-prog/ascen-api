// ============================================================
// src/routes/ttsRoutes.js — TTS API endpoints
//
// GET  /api/tts/generate  — generate or retrieve cached TTS audio
// GET  /api/tts/available — check if TTS is configured
// POST /api/tts/prewarm   — pre-generate audio for upcoming session
// GET  /api/tts/stats     — cache statistics (admin only)
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const ttsService = require('../services/ttsService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// GET /api/tts/generate — generate or retrieve cached TTS audio
router.get('/generate', async (req, res) => {
  try {
    const { session_number, character, phase, text } = req.query;

    if (!phase) {
      return res.status(400).json({ error: 'phase is required (arrival, breathing_milestone, closing)' });
    }

    const tenantId = req.tenantId || req.user?.tenantId;

    // If no text provided, look up from session template
    let spokenText = text;
    if (!spokenText && session_number) {
      const session = await pool.query(
        'SELECT luno_arrival, luno_close FROM session_templates WHERE session_number = $1',
        [parseInt(session_number)]
      );

      if (session.rows.length) {
        if (phase === 'arrival') spokenText = session.rows[0].luno_arrival;
        else if (phase === 'closing') spokenText = session.rows[0].luno_close;
      }
    }

    if (!spokenText) {
      return res.json({ audio_url: null, cached: false, fallback: 'no_text' });
    }

    const result = await ttsService.generateOrCache({
      text: spokenText,
      tenantId,
      character: character || 'luno',
      phase,
      sessionNumber: parseInt(session_number) || null
    });

    res.json(result);
  } catch (err) {
    console.error('[TTS] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate TTS audio' });
  }
});

// GET /api/tts/available — check if TTS is available
router.get('/available', (req, res) => {
  res.json({ available: ttsService.isAvailable() });
});

// POST /api/tts/prewarm — pre-generate audio for upcoming session
router.post('/prewarm', async (req, res) => {
  try {
    const { session_number, character } = req.body;

    if (!session_number) {
      return res.status(400).json({ error: 'session_number required' });
    }

    const tenantId = req.tenantId || req.user?.tenantId;

    await ttsService.prewarmSession(
      parseInt(session_number),
      tenantId,
      character || 'luno'
    );

    res.json({ prewarmed: true });
  } catch (err) {
    console.error('[TTS] Prewarm error:', err.message);
    res.status(500).json({ error: 'Failed to prewarm TTS cache' });
  }
});

// Admin: GET /api/tts/stats — cache statistics
router.get('/stats', async (req, res) => {
  try {
    // Role check
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await pool.query(`
      SELECT phase, COUNT(*) as count, SUM(use_count) as total_uses,
             COUNT(*) FILTER (WHERE generated_at > NOW() - INTERVAL '7 days') as generated_this_week
      FROM tts_cache
      GROUP BY phase
    `);

    const totalSize = await pool.query(`
      SELECT COUNT(*) as total_entries,
             SUM(audio_duration_ms) / 1000 as total_seconds
      FROM tts_cache
    `);

    res.json({
      by_phase: stats.rows,
      totals: totalSize.rows[0]
    });
  } catch (err) {
    console.error('[TTS] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to load TTS stats' });
  }
});

module.exports = router;
