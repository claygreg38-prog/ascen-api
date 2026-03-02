// ================================================================
// BREATHMATCH + PROGRESS ENDPOINT — Complete Integration
// Paste this entire block BEFORE the final app.listen() line in server.js
// ================================================================

// Session Progress Tracking
app.post('/api/fr/progress', async (req, res) => {
  try {
    const { user_id, session_number, completed, coherence_score, duration_seconds, session_type } = req.body;

    // Insert progress record
    await pool.query(`
      INSERT INTO progress (user_id, session_number, completed, coherence_score, duration_seconds, session_type, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [user_id, session_number, completed, coherence_score, duration_seconds, session_type || 'breathing']);

    // Fire-and-forget BreathMatch analyzer
    void analyzeBreathProfile(user_id).catch(console.error);

    res.json({ 
      success: true, 
      message: 'Progress saved successfully' 
    });
  } catch (err) {
    console.error('Progress save error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── BREATHMATCH ANALYZER ────────────────────────────────────────
// Fires after session completion. Fire-and-forget, never awaited.
async function analyzeBreathProfile(participantId) {
  try {
    // Need minimum 5 sessions before building a profile
    const completions = await pool.query(`
      SELECT session_number, coherence_score, duration_seconds, session_type
      FROM progress
      WHERE user_id = $1 AND completed = true
      ORDER BY id DESC
      LIMIT 20
    `, [participantId]);

    if (completions.rows.length < 5) return;

    const rows = completions.rows;

    // Rolling baseline: avg coherence across last 10 sessions
    const recent10 = rows.slice(0, 10);
    const baselineCoherence = recent10.reduce((sum, r) =>
      sum + (parseFloat(r.coherence_score) || 0), 0) / recent10.length;

    // Best performing session: highest coherence
    const best = rows.reduce((a, b) =>
      (parseFloat(a.coherence_score) || 0) > (parseFloat(b.coherence_score) || 0) ? a : b
    );

    // Look up session content for best session to get its ratio
    const sessionContent = await pool.query(`
      SELECT ratio, breath_mode FROM session_templates
      WHERE session_number = $1 LIMIT 1
    `, [best.session_number]);

    const bestSession = sessionContent.rows[0] || {};

    // Adjustment factor: clamped to [0.75, 1.25]
    const adjustmentFactor = baselineCoherence > 0
      ? Math.min(1.25, Math.max(0.75,
          (parseFloat(best.coherence_score) || 1) / baselineCoherence))
      : 1.0;

    // Check retroactive replay eligibility (15+ sessions)
    const replayEligible = rows.length >= 15;

    // Upsert breath profile
    await pool.query(`
      INSERT INTO breath_profiles (
        participant_id, baseline_coherence, best_ratio, best_mode,
        best_duration_seconds, adjustment_factor, sessions_analyzed,
        last_analyzed_at, replay_eligible, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,NOW())
      ON CONFLICT (participant_id) DO UPDATE SET
        baseline_coherence    = EXCLUDED.baseline_coherence,
        best_ratio            = EXCLUDED.best_ratio,
        best_mode             = EXCLUDED.best_mode,
        best_duration_seconds = EXCLUDED.best_duration_seconds,
        adjustment_factor     = EXCLUDED.adjustment_factor,
        sessions_analyzed     = EXCLUDED.sessions_analyzed,
        last_analyzed_at      = NOW(),
        replay_eligible       = EXCLUDED.replay_eligible,
        updated_at            = NOW()
    `, [
      participantId,
      baselineCoherence,
      bestSession.ratio || null,
      bestSession.breath_mode || null,
      best.duration_seconds || null,
      adjustmentFactor,
      rows.length,
      replayEligible
    ]);

    console.log(`[BreathMatch] Profile updated for ${participantId} — factor: ${adjustmentFactor.toFixed(3)}`);
  } catch (err) {
    console.error('[BreathMatch] Analyzer error:', err.message);
  }
}

// ── GET PROFILE ──────────────────────────────────────────────────
// Returns a participant's BreathMatch profile
app.get('/api/fr/breathmatch/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM breath_profiles WHERE participant_id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.json({ success: true, profile: null, message: 'No profile yet — need 5+ sessions' });
    }
    res.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── SESSION LOAD WITH BREATHMATCH ADJUSTMENT ─────────────────────
// Returns session content with ratio adjusted for this participant
app.get('/api/fr/sessions/:sessionNumber/adjusted/:userId', async (req, res) => {
  try {
    const { sessionNumber, userId } = req.params;

    // Get base session
    const sessionResult = await pool.query(
      'SELECT * FROM session_templates WHERE session_number = $1 LIMIT 1',
      [parseInt(sessionNumber)]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const session = { ...sessionResult.rows[0] };

    // Normalize ratio format: colons to dashes (5:5:5:5 → 5-5-5-5)
    // Database stores colons, breath engine expects dashes
    if (session.ratio) {
      session.ratio = session.ratio.replace(/:/g, '-');
    }

    // Get BreathMatch profile
    const profileResult = await pool.query(
      'SELECT * FROM breath_profiles WHERE participant_id = $1',
      [userId]
    );
    const profile = profileResult.rows[0];

    // Apply BreathMatch if profile exists, 5+ sessions analyzed, not locked
    if (profile &&
        profile.sessions_analyzed >= 5 &&
        !profile.profile_locked &&
        session.ratio) {

      // ratio is already normalized to dashes at this point
      const parts = session.ratio.split('-').map(Number);
      if (parts.length >= 2) {
        const inhale  = parts[0];
        const hold    = parts.length === 3 ? parts[1] : 0;
        const exhale  = parts.length === 3 ? parts[2] : parts[1];

        // Apply adjustment to exhale only (per spec)
        // Cap compound exhale at 12 seconds max
        const adjustedExhale = Math.min(12, Math.round(exhale * profile.adjustment_factor));

        session.ratio = hold > 0
          ? `${inhale}-${hold}-${adjustedExhale}`
          : `${inhale}-${adjustedExhale}`;

        session.breathmatch_applied = true;
        session.adjustment_factor = profile.adjustment_factor;
      }
    }

    res.json({ success: true, session, profile: profile || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── COORDINATOR: VIEW ALL PROFILES (Clinical tier) ───────────────
app.get('/api/fr/breathmatch/cohort/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        participant_id,
        baseline_coherence,
        adjustment_factor,
        sessions_analyzed,
        best_ratio,
        replay_eligible,
        last_analyzed_at
      FROM breath_profiles
      ORDER BY last_analyzed_at DESC
    `);
    res.json({ success: true, profiles: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
