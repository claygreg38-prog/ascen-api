// ============================================================
// [ABI] Co-Breath Engine — Synchronized Family Breathing
// File: src/abi/coBreathEngine.js
//
// ABI module. 3 modes (sync, adaptive, silent). Sync mode uses
// LOWER of two baselines (never push the less-ready person).
// Floor: 2:3 minimum enforced. Connection score is separate
// from NS3 — it measures synchronization, not clinical quality.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const crypto = require('crypto');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const RATIO_FLOOR = { inhale: 2, exhale: 3 };

// ── SESSION INITIATION ──────────────────────────────────────

async function initiateSession(initiatorUserId, partnerUserId, familyUnitId, mode) {
  try {
    // Resolve DB IDs
    const initiatorRow = await pool.query('SELECT id, tenant_id FROM users WHERE user_id = $1 OR participant_id = $1', [initiatorUserId]);
    const partnerRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [partnerUserId]);
    if (initiatorRow.rows.length === 0 || partnerRow.rows.length === 0) {
      return { error: true, message: 'Participant not found' };
    }
    const initiatorDbId = initiatorRow.rows[0].id;
    const partnerDbId = partnerRow.rows[0].id;
    const tenantId = initiatorRow.rows[0].tenant_id;

    // Verify same family unit
    const membership = await pool.query(
      'SELECT user_id FROM family_memberships WHERE family_unit_id = $1 AND user_id IN ($2, $3)',
      [familyUnitId, initiatorDbId, partnerDbId]
    );
    if (membership.rows.length < 2) {
      return { error: true, message: 'Both participants must be in the same family unit' };
    }

    // Verify Gate 3 unlocked
    const family = await pool.query('SELECT gate_state FROM family_units WHERE family_unit_id = $1', [familyUnitId]);
    if (family.rows.length === 0 || !family.rows[0].gate_state?.gate_3) {
      return { error: true, message: 'Co-breath requires Gate 3 to be unlocked' };
    }

    // Check capacity
    let initiatorState = 'steady', partnerState = 'steady';
    try {
      const capacityCurrency = require('./capacityCurrency');
      const iBal = await capacityCurrency.getBalance(initiatorUserId);
      const pBal = await capacityCurrency.getBalance(partnerUserId);
      initiatorState = iBal.state;
      partnerState = pBal.state;
    } catch (e) { /* default steady */ }

    if (initiatorState === 'depleted' || partnerState === 'depleted') {
      return { error: true, message: 'Solo session recommended when capacity is depleted' };
    }

    // Determine if investment
    const isInvestment = ['full', 'steady'].includes(initiatorState) && ['low', 'drawing_down'].includes(partnerState);

    // Determine breath params by mode
    let syncRatio = null, initiatorRatio = null, partnerRatio = null;

    if (mode === 'sync') {
      // Use lower of two baselines
      const iBaseline = await getLatestBaseline(initiatorDbId);
      const pBaseline = await getLatestBaseline(partnerDbId);
      const lowerInhale = Math.min(iBaseline.inhale || 4, pBaseline.inhale || 4);
      const lowerExhale = Math.min(iBaseline.exhale || 6, pBaseline.exhale || 6);
      // Enforce floor
      const inhale = Math.max(RATIO_FLOOR.inhale, lowerInhale);
      const exhale = Math.max(RATIO_FLOOR.exhale, lowerExhale);
      syncRatio = `${inhale}:${exhale}`;
    } else if (mode === 'adaptive') {
      const iBaseline = await getLatestBaseline(initiatorDbId);
      const pBaseline = await getLatestBaseline(partnerDbId);
      initiatorRatio = `${Math.max(RATIO_FLOOR.inhale, iBaseline.inhale || 4)}:${Math.max(RATIO_FLOOR.exhale, iBaseline.exhale || 6)}`;
      partnerRatio = `${Math.max(RATIO_FLOOR.inhale, pBaseline.inhale || 4)}:${Math.max(RATIO_FLOOR.exhale, pBaseline.exhale || 6)}`;
    }
    // Silent mode: no sync ratios

    // Create session
    const result = await pool.query(
      `INSERT INTO cobreath_sessions (family_unit_id, tenant_id, initiator_id, partner_id, session_mode,
         sync_ratio, initiator_ratio, partner_ratio, is_investment, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'waiting')
       RETURNING id`,
      [familyUnitId, tenantId, initiatorDbId, partnerDbId, mode,
       syncRatio, initiatorRatio, partnerRatio, isInvestment]
    );
    const sessionId = result.rows[0].id;

    // Create room
    const roomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    await pool.query(
      'INSERT INTO cobreath_rooms (cobreath_session_id, room_code) VALUES ($1, $2)',
      [sessionId, roomCode]
    );

    // Process investment if applicable
    let investmentId = null;
    if (isInvestment) {
      try {
        const capacityCurrency = require('./capacityCurrency');
        const inv = await capacityCurrency.processInvestment(initiatorUserId, partnerUserId, familyUnitId);
        if (!inv.error) {
          investmentId = inv.investmentId;
          await pool.query('UPDATE cobreath_sessions SET investment_id = $1 WHERE id = $2', [investmentId, sessionId]);
        }
      } catch (e) { /* non-blocking */ }
    }

    // LightBridge: co_breath_active
    try {
      const lightBridgeEngine = require('./lightBridgeEngine');
      await lightBridgeEngine.triggerSessionEvent(initiatorUserId, familyUnitId, 'co_breath_active');
    } catch (e) { /* non-blocking */ }

    console.log(`[CoBreach] Session ${sessionId} initiated: ${mode} mode, room ${roomCode}`);

    return {
      sessionId,
      roomCode,
      mode,
      syncRatio,
      initiatorRatio,
      partnerRatio,
      isInvestment,
      investmentId
    };
  } catch (err) {
    console.error('[CoBreath] Initiate failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to initiate session' };
  }
}

async function getLatestBaseline(userDbId) {
  try {
    const result = await pool.query(
      `SELECT arrival_hr, arrival_hrv FROM session_completions sc
       JOIN users u ON sc.user_id = u.participant_id
       WHERE u.id = $1 AND sc.arrival_hr IS NOT NULL
       ORDER BY sc.completed_at DESC LIMIT 1`,
      [userDbId]
    );
    if (result.rows.length === 0) return { inhale: 4, exhale: 6 };

    const hrv = parseFloat(result.rows[0].arrival_hrv) || 30;
    // Simple ratio derivation from HRV: higher HRV = capable of longer ratio
    if (hrv >= 50) return { inhale: 5, exhale: 7 };
    if (hrv >= 30) return { inhale: 4, exhale: 6 };
    return { inhale: 3, exhale: 4 };
  } catch (err) {
    return { inhale: 4, exhale: 6 };
  }
}

// ── ROOM MANAGEMENT ────────────────────────────────────────

async function connectToRoom(roomCode, userId) {
  try {
    const room = await pool.query(
      `SELECT cr.*, cs.initiator_id, cs.partner_id FROM cobreath_rooms cr
       JOIN cobreath_sessions cs ON cr.cobreath_session_id = cs.id
       WHERE cr.room_code = $1 AND cr.state != 'expired'`,
      [roomCode]
    );
    if (room.rows.length === 0) return { error: true, message: 'Room not found or expired' };

    const r = room.rows[0];
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [userId]);
    if (userRow.rows.length === 0) return { error: true, message: 'User not found' };
    const userDbId = userRow.rows[0].id;

    const isInitiator = userDbId === r.initiator_id;
    const isPartner = userDbId === r.partner_id;
    if (!isInitiator && !isPartner) return { error: true, message: 'You are not a participant in this session' };

    const field = isInitiator ? 'initiator_connected' : 'partner_connected';
    await pool.query(`UPDATE cobreath_rooms SET ${field} = true WHERE id = $1`, [r.id]);

    // Check if both connected
    const updated = await pool.query('SELECT initiator_connected, partner_connected FROM cobreath_rooms WHERE id = $1', [r.id]);
    const bothConnected = updated.rows[0].initiator_connected && updated.rows[0].partner_connected;

    if (bothConnected) {
      await pool.query("UPDATE cobreath_rooms SET state = 'countdown' WHERE id = $1", [r.id]);
      await pool.query("UPDATE cobreath_sessions SET status = 'connecting' WHERE id = $1", [r.cobreath_session_id]);
    }

    return { roomState: bothConnected ? 'countdown' : 'waiting', bothConnected };
  } catch (err) {
    console.error('[CoBreath] Connect failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to connect' };
  }
}

async function getRoomState(roomCode) {
  try {
    const room = await pool.query(
      `SELECT cr.state, cr.initiator_connected, cr.partner_connected, cr.expires_at,
              cs.session_mode, cs.sync_ratio, cs.initiator_ratio, cs.partner_ratio, cs.duration_seconds
       FROM cobreath_rooms cr
       JOIN cobreath_sessions cs ON cr.cobreath_session_id = cs.id
       WHERE cr.room_code = $1`,
      [roomCode]
    );
    if (room.rows.length === 0) return null;
    return room.rows[0];
  } catch (err) {
    return null;
  }
}

// ── SESSION COMPLETION ──────────────────────────────────────

async function completeSession(sessionId, metrics) {
  try {
    const session = await pool.query('SELECT * FROM cobreath_sessions WHERE id = $1', [sessionId]);
    if (session.rows.length === 0) return { error: true, message: 'Session not found' };
    const s = session.rows[0];

    const syncPct = metrics?.synchronization_pct || 0;
    const hrvCorr = metrics?.hrv_correlation || 0;
    const mutualSuccess = metrics?.mutual_regulation || false;

    // Connection score: sync 40%, correlation 30%, mutual improvement 30%
    const connectionScore = Math.round(
      (syncPct * 0.4) + (Math.max(0, hrvCorr * 100) * 0.3) + (mutualSuccess ? 30 : 0)
    * 100) / 100;

    // Warmth language
    let warmthMessage;
    if (connectionScore >= 80) warmthMessage = 'Your connection was strong today.';
    else if (connectionScore >= 60) warmthMessage = 'You found your rhythm together.';
    else warmthMessage = 'Every shared breath builds connection.';

    await pool.query(
      `UPDATE cobreath_sessions SET
         status = 'completed', completed_at = NOW(),
         initiator_hrv_start = $1, initiator_hrv_end = $2,
         partner_hrv_start = $3, partner_hrv_end = $4,
         hrv_correlation = $5, synchronization_pct = $6,
         mutual_regulation_success = $7, connection_score = $8
       WHERE id = $9`,
      [
        metrics?.initiator_hrv_start, metrics?.initiator_hrv_end,
        metrics?.partner_hrv_start, metrics?.partner_hrv_end,
        hrvCorr, syncPct, mutualSuccess, connectionScore, sessionId
      ]
    );

    // Update room state
    await pool.query(
      `UPDATE cobreath_rooms SET state = 'complete' WHERE cobreath_session_id = $1`,
      [sessionId]
    );

    // Generate co-created Breath Art from combined participant data
    let coArtHash = null;
    try {
      const breathArtEngine = require('./breathArtEngine');
      const ipfsService = require('../services/ipfsService');

      // Get most recent packet hashes for both participants
      const iHash = await pool.query(
        `SELECT packet_hash FROM session_completions sc JOIN users u ON sc.user_id = u.participant_id WHERE u.id = $1 AND packet_hash IS NOT NULL ORDER BY sc.completed_at DESC LIMIT 1`,
        [s.initiator_id]
      );
      const pHash = await pool.query(
        `SELECT packet_hash FROM session_completions sc JOIN users u ON sc.user_id = u.participant_id WHERE u.id = $1 AND packet_hash IS NOT NULL ORDER BY sc.completed_at DESC LIMIT 1`,
        [s.partner_id]
      );

      if (iHash.rows.length > 0 && pHash.rows.length > 0) {
        const combinedSeed = crypto.createHash('sha256')
          .update(iHash.rows[0].packet_hash + pHash.rows[0].packet_hash)
          .digest('hex');

        const combinedSummary = {
          ns3: { mean: 55, peak: 65, floor: 45 },
          clinical: { regulatoryTrajectory: 'stable', sustainedOptimal: mutualSuccess },
          verificationPayload: { peakCoherence: connectionScore / 100 }
        };

        const { svgString, metadataJSON } = breathArtEngine.generate(combinedSummary, combinedSeed, {
          session_count: 1, family_unit_active: true, lightbridge_active: true
        });

        metadataJSON.name = 'Co-Breath Art';
        metadataJSON.description = 'You just breathed together.';

        const pngBuffer = await breathArtEngine.renderToPNG(svgString);
        const ipfsResult = await ipfsService.upload(pngBuffer, metadataJSON, {}, { sessionNumber: 'cobreath', firstName: 'Family' });

        coArtHash = ipfsResult.metadataHash;
        await pool.query('UPDATE cobreath_sessions SET co_art_ipfs_hash = $1 WHERE id = $2', [coArtHash, sessionId]);
      }
    } catch (artErr) {
      console.error('[CoBreath] Co-art generation failed (non-blocking):', artErr.message);
    }

    // Feed to Family Intelligence dyadic pattern
    if (s.family_unit_id) {
      try {
        const pairKey = [s.initiator_id, s.partner_id].sort().join('_');
        await pool.query(
          `INSERT INTO family_patterns (family_unit_id, pattern_type, pattern_key, pattern_data)
           VALUES ($1, 'dyadic', $2, $3)
           ON CONFLICT (family_unit_id, pattern_type, pattern_key)
           DO UPDATE SET observation_count = family_patterns.observation_count + 1,
             pattern_data = jsonb_set(family_patterns.pattern_data, '{avgConvergence}',
               to_jsonb((COALESCE((family_patterns.pattern_data->>'avgConvergence')::float, 0) * family_patterns.observation_count + $4) / (family_patterns.observation_count + 1))
             ),
             last_observed = NOW()`,
          [s.family_unit_id, 'dyad_' + pairKey,
           JSON.stringify({ members: [s.initiator_id, s.partner_id], avgConvergence: connectionScore / 100, convergenceScores: [connectionScore / 100] }),
           connectionScore / 100]
        );
      } catch (e) { /* non-blocking */ }
    }

    // Capacity deposits for both
    try {
      const capacityCurrency = require('./capacityCurrency');
      const iUser = await pool.query('SELECT user_id FROM users WHERE id = $1', [s.initiator_id]);
      const pUser = await pool.query('SELECT user_id FROM users WHERE id = $1', [s.partner_id]);
      if (iUser.rows[0]) await capacityCurrency.onSessionComplete(iUser.rows[0].user_id, { ns3Mean: 55, coherencePeak: 0.5, streakDays: 0 });
      if (pUser.rows[0]) await capacityCurrency.onSessionComplete(pUser.rows[0].user_id, { ns3Mean: 55, coherencePeak: 0.5, streakDays: 0 });
    } catch (e) { /* non-blocking */ }

    console.log(`[CoBreath] Session ${sessionId} completed: score=${connectionScore}`);

    return { connectionScore, warmthMessage, completed: true, coArtHash };
  } catch (err) {
    console.error('[CoBreath] Complete failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to complete session' };
  }
}

async function getHistory(familyUnitId, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.session_mode, cs.sync_ratio, cs.connection_score,
              cs.synchronization_pct, cs.mutual_regulation_success, cs.status,
              cs.started_at, cs.completed_at, cs.is_investment,
              i.first_name as initiator_name, p.first_name as partner_name
       FROM cobreath_sessions cs
       JOIN users i ON cs.initiator_id = i.id
       JOIN users p ON cs.partner_id = p.id
       WHERE cs.family_unit_id = $1
       ORDER BY cs.created_at DESC LIMIT $2`,
      [familyUnitId, limit]
    );
    return result.rows;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

async function getRecommendedPairing(familyUnitId) {
  try {
    // Use dyadic patterns to find best pairing
    const patterns = await pool.query(
      `SELECT pattern_key, pattern_data, observation_count FROM family_patterns
       WHERE family_unit_id = $1 AND pattern_type = 'dyadic' AND observation_count >= 2
       ORDER BY (pattern_data->>'avgConvergence')::float DESC`,
      [familyUnitId]
    );

    if (patterns.rows.length > 0) {
      const best = patterns.rows[0];
      const members = best.pattern_data?.members || [];
      return { recommended: true, members, avgConvergence: best.pattern_data?.avgConvergence, observations: best.observation_count };
    }

    return { recommended: false, message: 'Not enough data for recommendation yet' };
  } catch (err) {
    return { recommended: false };
  }
}

module.exports = {
  initiateSession, connectToRoom, getRoomState, completeSession,
  getHistory, getRecommendedPairing
};
