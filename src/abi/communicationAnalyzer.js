// ============================================================
// [ABI] Communication Pattern Analyzer — Clinical Kitchen Table
// File: src/abi/communicationAnalyzer.js
//
// Computed at kitchen table session completion. Per-member
// communication metrics stored for multi-session trending.
//
// Correction #4: getSessionEngagementEvents reads from the
// WebSocket engagement event log (coBreathWebSocket.js).
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Analyze communication patterns for a completed kitchen table session.
 * Called from kitchenTableRoutes.js session/complete handler (non-blocking).
 */
async function analyzeSessionCommunication(sessionId, memberIds) {
  try {
    const events = await getSessionEngagementEvents(sessionId);

    const totalDuration = events.length > 0
      ? (events[events.length - 1].timestamp - events[0].timestamp) / 1000
      : 0;

    for (const userId of memberIds) {
      const memberEvents = events.filter(e => e.user_id === userId);

      // Speaking percentage: time this member was actively engaging
      const activeTime = memberEvents
        .filter(e => e.status === 'reflecting')
        .reduce((sum, e) => sum + (e.duration_ms || 3000), 0) / 1000;
      const speakingPct = totalDuration > 0 ? (activeTime / totalDuration * 100) : 0;

      // Listening quality: average HRV stability while others were speaking
      // Higher = better listener (HRV stable = regulated while receiving)
      const listeningEvents = memberEvents.filter(e => e.status === 'listening');
      const listeningQuality = listeningEvents.length > 0
        ? listeningEvents.reduce((sum, e) => sum + (e.hrv_stability || 0.5), 0) / listeningEvents.length
        : 0;

      // Engagement duration
      const engagementDuration = Math.round(
        memberEvents.filter(e => e.status !== 'disengaged').length * 3
      );

      // Interruption count: engaged within 3 seconds of another member engaging
      let interruptions = 0;
      for (const event of memberEvents.filter(e => e.status === 'reflecting')) {
        const otherActiveAt = events.filter(e =>
          e.user_id !== userId &&
          e.status === 'reflecting' &&
          Math.abs(e.timestamp - event.timestamp) < 3000
        );
        if (otherActiveAt.length > 0) interruptions++;
      }

      // Co-regulation events: biometrics synchronized with another member
      const coRegEvents = memberEvents.filter(e => e.type === 'co_regulation').length;

      await pool.query(`
        INSERT INTO kitchen_table_communication
        (session_id, user_id, speaking_pct, listening_quality_avg, engagement_duration_sec, interruption_count, co_regulation_events)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [sessionId, userId, speakingPct.toFixed(2), listeningQuality.toFixed(2), engagementDuration, interruptions, coRegEvents]);
    }
  } catch (err) {
    console.error('[CommunicationAnalyzer] analyzeSessionCommunication failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Get multi-session communication history for a family unit.
 */
async function getCommunicationHistory(familyUnitId, limit = 20) {
  try {
    const result = await pool.query(`
      SELECT kc.*, u.display_name
      FROM kitchen_table_communication kc
      JOIN users u ON kc.user_id = u.id
      JOIN kitchen_table_sessions kts ON kc.session_id = kts.id
      WHERE kts.family_unit_id = $1
      ORDER BY kc.created_at DESC
      LIMIT $2
    `, [familyUnitId, limit]);

    return result.rows;
  } catch (err) {
    console.error('[CommunicationAnalyzer] getCommunicationHistory failed:', err.message);
    Sentry.captureException(err);
    return [];
  }
}

/**
 * Correction #4: Reads from actual WebSocket engagement event storage.
 * coBreathWebSocket.js stores engagement events per session in memory.
 */
async function getSessionEngagementEvents(sessionId) {
  try {
    const coBreathWS = require('../services/coBreathWebSocket');
    if (coBreathWS.getEngagementEvents) {
      return coBreathWS.getEngagementEvents(sessionId) || [];
    }
    return [];
  } catch (err) {
    console.error('[CommunicationAnalyzer] getSessionEngagementEvents failed:', err.message);
    Sentry.captureException(err);
    return [];
  }
}

module.exports = { analyzeSessionCommunication, getCommunicationHistory };
