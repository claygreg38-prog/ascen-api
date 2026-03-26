// ============================================================
// Session Monitoring Routes — Phase 1
// File: src/routes/monitorRoutes.js
//
// SSE live stream + session report endpoints for facilitator/
// developer analysis. No raw biometrics exposed to participants.
//
// Endpoints:
//   GET /session-stream?session_key=:key  — SSE live stream
//   GET /session-report/:sessionKey       — session snapshot
//   GET /session-report/latest/:userId    — most recent session
// ============================================================

'use strict';

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { requireRole } = require('../middleware/auth');
const sessionStateManager = require('../services/sessionStateManager');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// All monitor routes require clinician+ (facilitator minimum)
router.use(requireRole('clinician'));


// ═══════════════════════════════════════════════════════════════
// SSE LIVE STREAM — GET /session-stream?session_key=:key
// ═══════════════════════════════════════════════════════════════

router.get('/session-stream', async (req, res) => {
  const sessionKey = req.query.session_key;
  if (!sessionKey) {
    return res.status(400).json({ error: 'session_key query parameter required' });
  }

  // Verify session exists
  const session = await sessionStateManager.getSession(sessionKey);
  if (!session) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Session not found or inactive', session_key: sessionKey })}\n\n`);
    res.end();
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ session_key: sessionKey, started: new Date().toISOString() })}\n\n`);

  let lastNs3Score = null;
  let lastNs3Time = Date.now();
  let lastBleTime = Date.now();

  const interval = setInterval(async () => {
    try {
      const state = await sessionStateManager.getSession(sessionKey);

      if (!state) {
        res.write(`event: session_ended\ndata: ${JSON.stringify({ session_key: sessionKey, reason: 'session_inactive' })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

      const now = Date.now();
      const warnings = [];

      // Extract biometrics from session state
      const samples = state.arrivalSamples || [];
      const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;
      const hr = latestSample?.heart_rate || null;
      const rmssd = latestSample?.hrv || null;
      const coherence = latestSample?.coherence || state.coherencePeak || null;

      // NS3 data from adapted session or state
      const adapted = state.adaptedSession || {};
      const ns3Score = adapted.ns3?.score || state.ns3Score || null;
      const ns3Zone = adapted.ns3?.zone || state.ns3Zone || null;

      // Breath ratio from adapted session (or current stepped-down ratio)
      const breathRatio = state.current_ratio || adapted.ratio || adapted.breath_ratio || adapted._ratio || null;

      // Checkpoint statuses
      const arrivalStarted = state.arrivalStartedAt ? true : false;
      const arrivalComplete = state.phase === 'breathing' || state.phase === 'done';
      const breathingActive = state.phase === 'breathing';
      const sessionDone = state.phase === 'done' || state.phase === 'exited';

      const checkpoints = {
        CP1_ble_data: arrivalStarted && samples.length > 0,
        CP2_tick_active: breathingActive,
        CP3_ns3_computed: ns3Score !== null,
        CP4_weather_sent: arrivalComplete && breathRatio !== null,
        CP5_messages_triggered: (state.events || []).length > 0 || state.breathCount > 0,
      };

      // ── WARNING DETECTION ──

      // BLE gap > 5s
      if (latestSample?.ts) {
        const sampleAge = now - latestSample.ts;
        if (sampleAge > 5000 && !sessionDone) {
          warnings.push({ type: 'ble_gap', detail: `Last BLE sample ${Math.round(sampleAge / 1000)}s ago` });
        }
        lastBleTime = latestSample.ts;
      } else if (!sessionDone && arrivalStarted) {
        const gap = now - lastBleTime;
        if (gap > 5000) {
          warnings.push({ type: 'ble_gap', detail: `No BLE samples for ${Math.round(gap / 1000)}s` });
        }
      }

      // NS3 null or unchanged > 30s
      if (breathingActive) {
        if (ns3Score === null) {
          warnings.push({ type: 'ns3_null', detail: 'NS3 score is null during breathing phase' });
        } else if (ns3Score === lastNs3Score && (now - lastNs3Time) > 30000) {
          warnings.push({ type: 'ns3_stale', detail: `NS3 unchanged at ${ns3Score} for ${Math.round((now - lastNs3Time) / 1000)}s` });
        } else if (ns3Score !== lastNs3Score) {
          lastNs3Score = ns3Score;
          lastNs3Time = now;
        }
      }

      // Coherence outside 0-1
      if (coherence !== null && (coherence < 0 || coherence > 1)) {
        warnings.push({ type: 'coherence_out_of_range', detail: `Coherence ${coherence} outside valid 0-1 range` });
      }

      // Breath ratio mismatch check
      if (breathRatio && breathingActive) {
        try {
          const { RATIO_LIBRARY } = require('../abi/determineBreathParams');
          const validRatio = RATIO_LIBRARY.find(r => r.ratio === breathRatio);
          if (!validRatio) {
            warnings.push({ type: 'breath_ratio_unknown', detail: `Ratio ${breathRatio} not in standard library` });
          }
        } catch (e) {
          // Non-blocking
        }
      }

      // Message fired mid-breath (check events for coaching during breathing)
      const events = state.events || [];
      const recentCoachingEvent = events.find(e =>
        e.type === 'coaching' && e.ts && (now - e.ts) < 2000
      );
      if (recentCoachingEvent && breathingActive) {
        warnings.push({ type: 'message_mid_breath', detail: 'Coaching message fired during active breathing' });
      }

      const payload = {
        timestamp: new Date().toISOString(),
        session_key: sessionKey,
        phase: state.phase || 'unknown',
        elapsed_seconds: state.startedAt ? Math.round((now - state.startedAt) / 1000) : 0,
        checkpoints,
        biometrics: {
          hr,
          rmssd,
          coherence,
          ns3_score: ns3Score,
          ns3_zone: ns3Zone,
          breath_ratio: breathRatio,
        },
        breath_count: state.breathCount || 0,
        samples_collected: samples.length,
        message_triggered: recentCoachingEvent ? true : false,
        // Ratio step-down monitoring
        current_ratio: state.current_ratio || breathRatio,
        arrival_ratio: state.arrival_ratio || breathRatio,
        ratio_history: state.ratio_history || [],
        step_down_count: state.step_down_count || 0,
        somatic_reset_active: state.somatic_reset_triggered && !state.somatic_reset_completed || false,
        graceful_end_triggered: state.graceful_end_triggered || false,
        warnings,
      };

      res.write(`event: session_state\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  }, 2000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});


// ═══════════════════════════════════════════════════════════════
// SESSION REPORT — GET /session-report/:sessionKey
// ═══════════════════════════════════════════════════════════════

router.get('/session-report/:sessionKey', async (req, res) => {
  const { sessionKey } = req.params;

  try {
    // Try active session first
    const active = await sessionStateManager.getSession(sessionKey);
    if (active) {
      return res.json(await buildActiveReport(sessionKey, active));
    }

    // Try completed session
    const completed = await pool.query(
      `SELECT sc.*, u.first_name, u.breath_track
       FROM session_completions sc
       LEFT JOIN users u ON sc.user_id = u.user_id
       WHERE sc.session_key = $1
       LIMIT 1`,
      [sessionKey]
    );

    if (!completed.rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(await buildCompletedReport(completed.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// LATEST SESSION REPORT — GET /session-report/latest/:userId
// ═══════════════════════════════════════════════════════════════

router.get('/session-report/latest/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Check for active session first
    const activeResult = await pool.query(
      `SELECT session_key FROM session_completions
       WHERE user_id = $1 AND session_active = true
       ORDER BY arrival_started_at DESC LIMIT 1`,
      [userId]
    );

    if (activeResult.rows.length) {
      const sk = activeResult.rows[0].session_key;
      const active = await sessionStateManager.getSession(sk);
      if (active) {
        return res.json(await buildActiveReport(sk, active));
      }
    }

    // Most recent completed session
    const completed = await pool.query(
      `SELECT sc.*, u.first_name, u.breath_track
       FROM session_completions sc
       LEFT JOIN users u ON sc.user_id = u.user_id
       WHERE sc.user_id = $1
       ORDER BY sc.completed_at DESC NULLS LAST, sc.arrival_started_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!completed.rows.length) {
      return res.status(404).json({ error: 'No sessions found for user' });
    }

    return res.json(await buildCompletedReport(completed.rows[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// REPORT BUILDERS
// ═══════════════════════════════════════════════════════════════

async function buildActiveReport(sessionKey, state) {
  const now = Date.now();
  const samples = state.arrivalSamples || [];
  const last30 = samples.slice(-30);
  const adapted = state.adaptedSession || {};
  const events = state.events || [];

  // Compute arrival means
  const meanHr = last30.length ? last30.reduce((s, x) => s + (x.heart_rate || 0), 0) / last30.length : null;
  const meanHrv = last30.length ? last30.reduce((s, x) => s + (x.hrv || 0), 0) / last30.length : null;
  const initialCoherence = last30.length ? last30.reduce((s, x) => s + (x.coherence || 0), 0) / last30.length : null;

  // Current biometrics from latest sample
  const latest = samples.length ? samples[samples.length - 1] : {};

  // NS3 data
  const ns3Score = adapted.ns3?.score || state.ns3Score || null;
  const ns3Zone = adapted.ns3?.zone || state.ns3Zone || null;
  const breathRatio = adapted.ratio || adapted.breath_ratio || adapted._ratio || null;

  // Messaging state from events
  const somaticResetFired = events.some(e => e.type === 'somatic' || e.type === 'somatic_reset');
  const midSessionHaikuFired = events.some(e => e.type === 'haiku' || e.type === 'mid_session_haiku');
  const driftingWords = events
    .filter(e => e.type === 'drifting_word')
    .map(e => e.text || e.word);

  // Look up user info
  let firstName = null;
  if (state.userId) {
    try {
      const userResult = await pool.query('SELECT first_name FROM users WHERE user_id = $1', [state.userId]);
      if (userResult.rows.length) firstName = userResult.rows[0].first_name;
    } catch (e) { /* non-blocking */ }
  }

  return {
    status: 'active',
    session_key: sessionKey,
    participant: {
      first_name: firstName,
      session_number: state.sessionNumber || null,
      elapsed_seconds: state.startedAt ? Math.round((now - state.startedAt) / 1000) : 0,
    },
    arrival: {
      mean_hr: meanHr ? Math.round(meanHr * 10) / 10 : null,
      mean_hrv: meanHrv ? Math.round(meanHrv * 10) / 10 : null,
      initial_coherence: initialCoherence ? Math.round(initialCoherence * 1000) / 1000 : null,
      ns3_score: ns3Score,
      ns3_zone: ns3Zone,
      breath_ratio_assigned: breathRatio,
    },
    current: {
      hr: latest.heart_rate || null,
      rmssd: latest.hrv || null,
      coherence: latest.coherence || state.coherencePeak || null,
      ns3_score: ns3Score,
      ns3_zone: ns3Zone,
      breath_count: state.breathCount || 0,
      samples_collected: samples.length,
    },
    trajectory: {
      ns3_trend: [],  // Populated in real-time only if NS3 history available
      coherence_trend: samples.slice(-20).map(s => s.coherence).filter(Boolean),
      zone_transitions: [],
    },
    messaging: {
      somatic_reset_fired: somaticResetFired,
      mid_session_haiku_fired: midSessionHaikuFired,
      drifting_words_delivered: driftingWords,
    },
    ratio_adaptation: {
      arrival_ratio: state.arrival_ratio || breathRatio,
      current_ratio: state.current_ratio || breathRatio,
      step_down_count: state.step_down_count || 0,
      ratio_history: state.ratio_history || [],
      somatic_reset_triggered: state.somatic_reset_triggered || false,
      graceful_end_triggered: state.graceful_end_triggered || false,
    },
    systems_fired: buildSystemsFired(state, adapted, events, samples),
    warnings: [],
  };
}

async function buildCompletedReport(row) {
  const state = row.session_state || {};
  const samples = state.arrivalSamples || [];
  const last30 = samples.slice(-30);
  const adapted = state.adaptedSession || {};
  const events = state.events || [];

  // Arrival means
  const meanHr = last30.length ? last30.reduce((s, x) => s + (x.heart_rate || 0), 0) / last30.length : null;
  const meanHrv = last30.length ? last30.reduce((s, x) => s + (x.hrv || 0), 0) / last30.length : null;
  const initialCoherence = last30.length ? last30.reduce((s, x) => s + (x.coherence || 0), 0) / last30.length : null;

  // Arrival NS3 (first available)
  const arrivalNs3 = state.arrivalNs3 || null;

  // Landing from DB columns
  const landingNs3 = row.ns3_mean || null;
  const ns3Peak = row.ns3_peak || null;
  const ns3Floor = row.ns3_floor || null;

  // Zone time from DB
  const optimalPct = row.optimal_zone_pct || 0;

  // Duration
  const duration = row.active_duration_seconds || 0;

  // Coherence
  const coherencePeak = parseFloat(row.coherence_score) || state.coherencePeak || 0;
  const coherenceEnd = parseFloat(row.coherence_end) || 0;

  // Breath params
  const breathRatio = adapted.ratio || adapted.breath_ratio || adapted._ratio || null;
  const breathMode = adapted.breathwork_mode || adapted._breathwork_mode || adapted._mode || null;
  const breathTrack = adapted.track || adapted._track || row.track || null;

  // NS3 trajectory from DB
  const trajectory = row.regulatory_trajectory || null;

  // Messaging
  const somaticResetFired = events.some(e => e.type === 'somatic' || e.type === 'somatic_reset');
  const midSessionHaikuFired = events.some(e => e.type === 'haiku' || e.type === 'mid_session_haiku');
  const driftingWords = events
    .filter(e => e.type === 'drifting_word')
    .map(e => e.text || e.word);
  const closingMessage = events.find(e => e.type === 'closing' || e.type === 'mirror');

  // Historical context
  let historicalContext = null;
  if (row.user_id) {
    try {
      const hist = await pool.query(
        `SELECT
           COUNT(*) AS total_sessions,
           AVG(CASE WHEN completed_at > NOW() - INTERVAL '7 days' THEN ns3_mean END) AS avg_ns3_7d,
           AVG(CASE WHEN completed_at > NOW() - INTERVAL '30 days' THEN ns3_mean END) AS avg_ns3_30d,
           MAX(coherence_score) AS best_coherence,
           AVG(active_duration_seconds) AS typical_duration
         FROM session_completions
         WHERE user_id = $1 AND completed_at IS NOT NULL`,
        [row.user_id]
      );
      if (hist.rows.length) {
        const h = hist.rows[0];
        historicalContext = {
          total_sessions: parseInt(h.total_sessions) || 0,
          avg_arrival_ns3_7d: h.avg_ns3_7d ? Math.round(parseFloat(h.avg_ns3_7d)) : null,
          avg_arrival_ns3_30d: h.avg_ns3_30d ? Math.round(parseFloat(h.avg_ns3_30d)) : null,
          trend_direction: trajectory || 'unknown',
          best_coherence_ever: h.best_coherence ? parseFloat(h.best_coherence) : null,
          typical_session_duration: h.typical_duration ? Math.round(parseFloat(h.typical_duration)) : null,
        };
      }
    } catch (e) { /* non-blocking */ }
  }

  // Journey distance
  const journeyDistance = (arrivalNs3 !== null && landingNs3 !== null)
    ? Math.round(landingNs3 - arrivalNs3)
    : null;

  // Expected vs actual
  const expectedVsActual = buildExpectedVsActual(
    coherencePeak, coherenceEnd, landingNs3, arrivalNs3,
    historicalContext, row.session_number
  );

  return {
    status: 'completed',
    session_key: row.session_key,
    participant: {
      first_name: row.first_name || null,
      session_number: row.session_number || null,
      duration_seconds: duration,
    },
    arrival: {
      mean_hr: meanHr ? Math.round(meanHr * 10) / 10 : null,
      mean_hrv: meanHrv ? Math.round(meanHrv * 10) / 10 : null,
      initial_coherence: initialCoherence ? Math.round(initialCoherence * 1000) / 1000 : null,
      ns3_score: arrivalNs3,
      ns3_zone: arrivalNs3 !== null ? classifyZoneLabel(arrivalNs3) : null,
      breath_ratio_assigned: breathRatio,
    },
    landing: {
      final_hr: null,  // Not stored separately; derive from last sample if needed
      final_hrv: null,
      final_coherence: coherenceEnd || null,
      ns3_score: landingNs3,
      ns3_zone: landingNs3 !== null ? classifyZoneLabel(landingNs3) : null,
    },
    journey: {
      arrival_ns3: arrivalNs3,
      landing_ns3: landingNs3,
      journey_distance: journeyDistance,
      arrival_zone: arrivalNs3 !== null ? classifyZoneLabel(arrivalNs3) : null,
      landing_zone: landingNs3 !== null ? classifyZoneLabel(landingNs3) : null,
    },
    session_quality: {
      coherence_peak: coherencePeak,
      coherence_mean: coherenceEnd || null,
      ns3_peak: ns3Peak ? parseFloat(ns3Peak) : null,
      ns3_mean: landingNs3 ? parseFloat(landingNs3) : null,
      time_in_optimal_pct: parseFloat(optimalPct) || 0,
      time_in_approaching_pct: null,  // Not stored separately yet
      time_in_below_pct: null,
    },
    trajectory: {
      ns3_samples: [],    // Full array would come from session aggregator; not persisted post-session
      coherence_samples: samples.map(s => s.coherence).filter(Boolean),
      zone_transitions: [],
    },
    messaging: {
      somatic_reset_fired: somaticResetFired,
      mid_session_haiku_fired: midSessionHaikuFired,
      closing_message_text: closingMessage?.text || null,
      drifting_words_delivered: driftingWords,
    },
    breath_params: {
      mode: breathMode,
      ratio: breathRatio,
      track: breathTrack,
      adapted_from_arrival: adapted.detection_mode !== 'hardcoded',
    },
    ratio_adaptation: {
      arrival_ratio: state.arrival_ratio || breathRatio,
      current_ratio: state.current_ratio || breathRatio,
      step_down_count: state.step_down_count || 0,
      ratio_history: state.ratio_history || [],
      somatic_reset_triggered: state.somatic_reset_triggered || false,
      graceful_end_triggered: state.graceful_end_triggered || false,
    },
    expected_vs_actual: expectedVsActual,
    historical_context: historicalContext,
    systems_fired: buildSystemsFired(state, adapted, events, samples),
  };
}


// ═══════════════════════════════════════════════════════════════
// SYSTEMS FIRED CHECKLIST
// ═══════════════════════════════════════════════════════════════

function buildSystemsFired(state, adapted, events, samples) {
  const phase = state.phase || 'unknown';
  const breathCount = state.breathCount || 0;

  return {
    ble_connected: state.bleConnected !== false,
    arrival_samples_collected: samples.length,
    arrival_baseline_computed: phase !== 'arrival' && samples.length > 0,
    ns3_computed: (adapted.ns3?.score || state.ns3Score) !== undefined,
    breath_params_adapted: adapted.detection_mode !== 'hardcoded' && adapted.detection_mode !== undefined,
    breath_ratio_assigned: adapted.ratio || adapted.breath_ratio || adapted._ratio || null,
    somatic_reset_offered: events.some(e => e.type === 'somatic' || e.type === 'somatic_reset' || e.type === 'offer_drill'),
    somatic_reset_completed: events.some(e => e.type === 'somatic_complete'),
    capacity_track_detected: adapted.capacity_track || state.capacityTrack || false,
    descent_completed: phase === 'breathing' || phase === 'done' || phase === 'exited',
    tts_arrival_played: events.some(e => e.type === 'tts_arrival'),
    ticks_received: breathCount,
    zone_transitions: events
      .filter(e => e.type === 'zone_transition')
      .map(e => ({ from: e.from, to: e.to, at_second: e.at_second || null })),
    coaching_intervention_fired: events.some(e => e.type === 'coaching' && e.action === 'intervention'),
    drifting_words_injected: events
      .filter(e => e.type === 'drifting_word')
      .map(e => e.text || e.word),
    mid_session_haiku_fired: events.some(e => e.type === 'haiku' || e.type === 'mid_session_haiku'),
    closing_message_delivered: events.some(e => e.type === 'closing' || e.type === 'mirror'),
    tts_closing_played: events.some(e => e.type === 'tts_closing'),
    ascent_completed: phase === 'done' || phase === 'exited',
    mirror_displayed: events.some(e => e.type === 'mirror'),
    vagal_journey_displayed: events.some(e => e.type === 'vagal_journey'),
    breathart_generated: state.breathArtGenerated || events.some(e => e.type === 'breath_art'),
    ipfs_uploaded: state.ipfsUploaded || events.some(e => e.type === 'ipfs_upload'),
    vault_prompted: events.some(e => e.type === 'vault_prompt'),
    vault_sealed: events.some(e => e.type === 'vault_sealed'),
    progress_saved: events.some(e => e.type === 'progress_saved'),
    blockchain_queued: events.some(e => e.type === 'blockchain_queued' || e.type === 'attestation_queued'),
    lightbridge_triggered: events.some(e => e.type === 'lightbridge'),
    capacity_updated: events.some(e => e.type === 'capacity_deposit'),
    lineage_entry_recorded: events.some(e => e.type === 'lineage_entry'),
    // Ratio step-down tracking
    ratio_step_down_evaluated: state.current_ratio !== undefined,
    ratio_step_down_fired: (state.step_down_count || 0) > 0,
    ratio_step_down_count: state.step_down_count || 0,
    arrival_ratio: state.arrival_ratio || null,
    current_ratio: state.current_ratio || null,
    ratio_history: state.ratio_history || [],
    somatic_reset_at_floor: state.somatic_reset_triggered || false,
    graceful_end_triggered: state.graceful_end_triggered || false,
  };
}


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function classifyZoneLabel(score) {
  if (score === null || score === undefined) return null;
  if (score <= 35) return 'below_window';
  if (score <= 55) return 'approaching';
  if (score <= 80) return 'optimal';
  return 'overdrive';
}

function buildExpectedVsActual(coherencePeak, coherenceEnd, landingNs3, arrivalNs3, historical, sessionNumber) {
  if (!historical || !historical.total_sessions) return null;

  const totalSessions = historical.total_sessions;
  const avgNs3_30d = historical.avg_arrival_ns3_30d;

  // Simple expected ranges based on session count
  let expectedCoherenceRange;
  if (totalSessions < 10) {
    expectedCoherenceRange = '0.2-0.5 for early sessions';
  } else if (totalSessions < 30) {
    expectedCoherenceRange = '0.3-0.7 for developing practice';
  } else {
    expectedCoherenceRange = '0.4-0.8 for established practice';
  }

  const actualCoherenceMean = coherenceEnd || coherencePeak || null;

  // NS3 improvement expectation
  let expectedNs3Improvement = null;
  let actualNs3Improvement = null;
  let assessment = null;

  if (arrivalNs3 !== null && landingNs3 !== null) {
    actualNs3Improvement = Math.round(landingNs3 - arrivalNs3);

    if (avgNs3_30d) {
      expectedNs3Improvement = '+5 to +15 based on 30-day trend';
    } else {
      expectedNs3Improvement = '+3 to +10 for early sessions';
    }

    if (actualNs3Improvement > 15) assessment = 'above_expected';
    else if (actualNs3Improvement >= 3) assessment = 'within_expected';
    else assessment = 'below_expected';
  }

  return {
    expected_coherence_range: expectedCoherenceRange,
    actual_coherence_mean: actualCoherenceMean,
    expected_ns3_improvement: expectedNs3Improvement,
    actual_ns3_improvement: actualNs3Improvement,
    assessment,
  };
}


module.exports = router;
