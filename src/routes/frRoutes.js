/**
 * ASCEN BreathWorx — FR (Family Receiver) API Routes
 * 
 * Serves FR Apprentice sessions from session_templates (track = 'fr_apprentice').
 * All routes flow through ABI orchestrator — no direct DB bypass.
 * 
 * Mount in server.js:
 *   const frRoutes = require('./src/routes/frRoutes');
 *   app.use('/api/abi/fr', authenticateOrApiKey('participant'));
 *   app.use('/api/abi/fr', frRoutes);
 */

const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// FR HEALTH CHECK — Public
// ═══════════════════════════════════════════════════════════════
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'FR Apprentice API',
    track: 'fr_apprentice',
    sessions: 25,
    arcs: ['fr_connection', 'fr_neuroception', 'fr_holding_space', 'fr_own_foundation', 'fr_bridge_to_mastery']
  });
});

// ═══════════════════════════════════════════════════════════════
// GET ALL FR SESSIONS — List with ABI config
// GET /api/abi/fr/sessions
// ═══════════════════════════════════════════════════════════════
router.get('/sessions', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const { arc, mode } = req.query;

    let query = `
      SELECT session_number, track, title, arc,
             breath_mode, ratio, duration_seconds,
             luno_arrival, luno_mid, luno_close,
             vault_enabled, vault_prompt,
             family_recording_prompt, station_unlock,
             abi_mode, coherence_target, axis_dashboard_category
      FROM session_templates
      WHERE track = 'fr_apprentice'
    `;
    const params = [];

    // Optional arc filter
    if (arc) {
      params.push(arc);
      query += ` AND arc = $${params.length}`;
    }

    // Optional ABI mode filter
    if (mode) {
      params.push(mode);
      query += ` AND abi_mode = $${params.length}`;
    }

    query += ' ORDER BY session_number ASC';

    const result = await pool.query(query, params);

    res.json({
      track: 'fr_apprentice',
      count: result.rows.length,
      sessions: result.rows
    });
  } catch (err) {
    console.error('[FR] List sessions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET SINGLE FR SESSION — Full YAML data with ABI + AXIS config
// GET /api/abi/fr/sessions/:number
// ═══════════════════════════════════════════════════════════════
router.get('/sessions/:number', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const sessionNumber = parseInt(req.params.number, 10);
    if (isNaN(sessionNumber) || sessionNumber < 1 || sessionNumber > 25) {
      return res.status(400).json({ error: 'Session number must be 1-25' });
    }

    const result = await pool.query(
      `SELECT session_number, track, title, arc,
              breath_mode, ratio, duration_seconds,
              luno_arrival, luno_mid, luno_close,
              vault_enabled, vault_prompt,
              family_recording_prompt, station_unlock,
              abi_mode, coherence_target, axis_dashboard_category,
              yaml_data
       FROM session_templates
       WHERE session_number = $1 AND track = 'fr_apprentice'`,
      [sessionNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `FR session ${sessionNumber} not found` });
    }

    const row = result.rows[0];
    const yamlData = typeof row.yaml_data === 'string' ? JSON.parse(row.yaml_data) : row.yaml_data;

    res.json({
      track: 'fr_apprentice',
      session: {
        ...row,
        // Expand YAML data into top-level fields for frontend consumption
        abi_config: yamlData?.abi_config || null,
        axis_config: yamlData?.axis_config || null,
        vault_structured_prompts: yamlData?.vault_structured_prompts || null,
        mirror_screen: yamlData?.mirror_screen || null,
        curriculum_merge: yamlData?.curriculum_merge || null,
        metadata: yamlData?.metadata || null,
      }
    });
  } catch (err) {
    console.error('[FR] Get session error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET FR ARCS — Summary of all 5 therapeutic arcs
// GET /api/abi/fr/arcs
// ═══════════════════════════════════════════════════════════════
router.get('/arcs', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const result = await pool.query(`
      SELECT arc,
             MIN(session_number) as first_session,
             MAX(session_number) as last_session,
             COUNT(*) as session_count,
             MIN(coherence_target) as coherence_start,
             MAX(coherence_target) as coherence_end,
             array_agg(DISTINCT abi_mode) as abi_modes
      FROM session_templates
      WHERE track = 'fr_apprentice'
      GROUP BY arc
      ORDER BY MIN(session_number)
    `);

    res.json({
      track: 'fr_apprentice',
      arcs: result.rows
    });
  } catch (err) {
    console.error('[FR] Arcs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET FR USER PROGRESS — Participant's FR journey state
// GET /api/abi/fr/progress
// Reads from x-session-key header or JWT user context
// ═══════════════════════════════════════════════════════════════
router.get('/progress', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    // Get user ID from JWT (set by auth middleware) or header
    const userId = req.user?.userId || req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Get completed FR sessions for this user
    const completions = await pool.query(`
      SELECT session_number, completed_at, score
      FROM sessions
      WHERE participant_id = $1
        AND session_number BETWEEN 1 AND 25
        AND completed = true
      ORDER BY session_number ASC
    `, [userId]);

    const completedNumbers = completions.rows.map(r => r.session_number);
    const currentSession = completedNumbers.length > 0
      ? Math.max(...completedNumbers) + 1
      : 1;

    // Determine current arc
    let currentArc = 'fr_connection';
    if (currentSession > 20) currentArc = 'fr_bridge_to_mastery';
    else if (currentSession > 15) currentArc = 'fr_own_foundation';
    else if (currentSession > 10) currentArc = 'fr_holding_space';
    else if (currentSession > 5) currentArc = 'fr_neuroception';

    // Station unlocks
    const stations = [];
    if (completedNumbers.includes(5)) stations.push('FR Station 01: The Foundation');
    if (completedNumbers.includes(10)) stations.push('FR Station 02: The Map');
    if (completedNumbers.includes(15)) stations.push('FR Station 03: Halfway');
    if (completedNumbers.includes(25)) stations.push('FR Station 04: The Bridge');

    // Merge readiness (FR25 complete?)
    const mergeReady = completedNumbers.includes(25);

    res.json({
      track: 'fr_apprentice',
      user_id: userId,
      completed_sessions: completedNumbers.length,
      total_sessions: 25,
      current_session: Math.min(currentSession, 26), // Cap at 26 (merge)
      current_arc: currentArc,
      stations_unlocked: stations,
      merge_ready: mergeReady,
      merge_target: mergeReady ? { track: 'main_curriculum', session: 26 } : null,
      completions: completions.rows
    });
  } catch (err) {
    console.error('[FR] Progress error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET FR SESSION FOR ABI — Returns session config the ABI engine
// needs to start a session (abi_config + breath params)
// GET /api/abi/fr/engine/:number
// ═══════════════════════════════════════════════════════════════
router.get('/engine/:number', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) return res.status(503).json({ error: 'Database not available' });

    const sessionNumber = parseInt(req.params.number, 10);
    if (isNaN(sessionNumber) || sessionNumber < 1 || sessionNumber > 25) {
      return res.status(400).json({ error: 'Session number must be 1-25' });
    }

    const result = await pool.query(
      `SELECT yaml_data FROM session_templates
       WHERE session_number = $1 AND track = 'fr_apprentice'`,
      [sessionNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `FR session ${sessionNumber} not found` });
    }

    const yamlData = typeof result.rows[0].yaml_data === 'string'
      ? JSON.parse(result.rows[0].yaml_data)
      : result.rows[0].yaml_data;

    // Return only what ABI engine needs — no clinical/vault data
    res.json({
      track: 'fr_apprentice',
      session_number: sessionNumber,
      title: yamlData.title,
      arc: yamlData.arc,
      breathwork_mode: yamlData.breathwork_mode,
      breathwork_ratio: yamlData.breathwork_ratio,
      breathwork_duration_sec: yamlData.breathwork_duration_sec,
      abi_config: yamlData.abi_config,
      // Dialogue for the session engine
      luno_arrival: yamlData.luno_arrival,
      luno_mid: yamlData.luno_mid,
      luno_close: yamlData.luno_close,
      // Vault config (needed at session start to prep the UI)
      vault_enabled: yamlData.vault_enabled,
      vault_structured_prompts: yamlData.vault_structured_prompts,
      // Family recording
      family_recording_prompt: yamlData.family_recording_prompt,
      family_recording_prompt_text: yamlData.family_recording_prompt_text || null,
      // Merge trigger on FR25
      curriculum_merge: yamlData.curriculum_merge || null,
    });
  } catch (err) {
    console.error('[FR] Engine config error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
