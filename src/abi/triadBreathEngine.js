// ============================================================
// [ABI] Triad Breath Engine — Three-System Sync
// File: src/abi/triadBreathEngine.js
//
// Parent + Partner + Unborn Child
//
// We cannot measure the child directly. But we CAN optimize
// the environment the child is living in. The triad breath:
//   1. Parent regulation (the child's direct environment)
//   2. Partner sync (supporting the parent's regulation)
//   3. The child as the third presence (acknowledged, not measured)
//
// The partner's role: co-regulate the parent.
// The parent's role: create the calmest possible inner environment.
// The child's role: exist. Be welcomed. Be breathed for.
// ============================================================

'use strict';

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { computeGestationalWeek, computeTrimester, estimateFetalEnvironment } = require('./prenatalEngine');

// ═══════════════════════════════════════════════════════════════
// TRIAD SESSION LIFECYCLE
// ═══════════════════════════════════════════════════════════════

/**
 * Start a triad breath session.
 */
async function startTriadSession(enrollmentId, sessionCompletionId) {
  try {
    const enrollment = await pool.query(
      'SELECT * FROM prenatal_enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enrollment.rows.length) throw new Error('Enrollment not found');

    const data = enrollment.rows[0];
    const week = computeGestationalWeek(data.due_date);
    const trimester = computeTrimester(week);

    const result = await pool.query(`
      INSERT INTO triad_sessions (prenatal_enrollment_id, session_completion_id, trimester, gestational_week)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [enrollmentId, sessionCompletionId || null, trimester, week]);

    return {
      session_id: result.rows[0].id,
      trimester,
      week,
      luno_opening: getTriadOpening(trimester, week)
    };
  } catch (err) {
    console.error('[TRIAD] Session start failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// TRIAD OPENINGS — Trimester + week sensitive
// ═══════════════════════════════════════════════════════════════

function getTriadOpening(trimester, week) {
  if (trimester === 1) {
    return 'Three of you are here. One of you is listening through the rhythm of your heartbeat. Let\'s breathe for all three.';
  }
  if (trimester === 2) {
    if (week >= 20) {
      return 'Your baby can hear your heartbeat now. When you slow your breath, they feel it. Let\'s create the calmest room in the world.';
    }
    return 'Your baby is growing in the rhythm you create. Today, you and your partner build that rhythm together.';
  }
  // Trimester 3
  if (week >= 36) {
    return 'Soon you\'ll hold them. Right now, you\'re already holding them — with every breath. Let\'s practice the breath you\'ll use when they arrive.';
  }
  return 'Your baby knows your breath. They\'ve been listening to it for months. Today, show them what calm feels like.';
}

// ═══════════════════════════════════════════════════════════════
// BIOMETRIC RECORDING
// ═══════════════════════════════════════════════════════════════

/**
 * Record biometrics for a triad session tick.
 * Partner may be absent — parent can do triad solo (the child is always present).
 */
async function recordTriadBiometrics(sessionId, parentBio, partnerBio) {
  try {
    const fetalEnv = estimateFetalEnvironment(parentBio);

    // Partner sync quality (if partner present)
    let partnerSync = null;
    if (partnerBio && partnerBio.mean_hr) {
      partnerSync = computeTriadSync(parentBio, partnerBio);
    }

    const triadQuality = {
      parent_regulation: {
        hr: parentBio.mean_hr || parentBio.hr,
        hrv: parentBio.mean_hrv || parentBio.hrv,
        coherence: parentBio.coherence,
        ns3: parentBio.ns3
      },
      partner_sync: partnerSync,
      estimated_fetal_environment: fetalEnv,
      timestamp: new Date().toISOString()
    };

    await pool.query(
      `UPDATE triad_sessions SET
        parent_biometrics = $1, partner_biometrics = $2, triad_quality = $3
       WHERE id = $4`,
      [JSON.stringify(parentBio), JSON.stringify(partnerBio || {}), JSON.stringify(triadQuality), sessionId]
    );

    return triadQuality;
  } catch (err) {
    console.error('[TRIAD] Biometric recording failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Compute sync quality between parent and partner during triad.
 * Weighted toward parent regulation — the partner supports, not leads.
 */
function computeTriadSync(parentBio, partnerBio) {
  const pHr = parentBio.mean_hr || parentBio.hr || 72;
  const pHrv = parentBio.mean_hrv || parentBio.hrv || 0;
  const pCoh = parentBio.coherence || 0;
  const bHr = partnerBio.mean_hr || partnerBio.hr || 72;
  const bHrv = partnerBio.mean_hrv || partnerBio.hrv || 0;
  const bCoh = partnerBio.coherence || 0;

  const hrStability = 1 - (Math.abs(pHr - bHr) / 100);
  const hrvProximity = 1 - Math.abs(pHrv - bHrv) / Math.max(pHrv, bHrv, 1);
  const coherenceProximity = 1 - Math.abs(pCoh - bCoh);

  // Weight: parent regulation (40%) + sync (40%) + partner regulation (20%)
  // Partner's role is to SUPPORT the parent's regulation, not lead
  const parentReg = Math.min(1, (pCoh + (pHrv / 60)) / 2);
  const sync = (hrStability * 0.3 + hrvProximity * 0.4 + coherenceProximity * 0.3);

  return Math.round((parentReg * 0.4 + sync * 0.4 + (bCoh * 0.2)) * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
// DRIFTING WORDS — Triad-specific
// ═══════════════════════════════════════════════════════════════

const TRIAD_DRIFTING_WORDS = {
  low: ['Breathe.', 'Together.', 'Three.'],
  medium: ['All here.', 'Their world.', 'Your calm.'],
  high: ['Safe inside.', 'They feel you.', 'Already home.'],
  peak: []  // Silence. The breath speaks.
};

/**
 * Select a triad drifting word based on parent coherence.
 */
function getTriadDriftingWord(parentCoherence) {
  if (parentCoherence >= 0.85) return null;  // Peak: silence
  let tier = 'low';
  if (parentCoherence >= 0.6) tier = 'high';
  else if (parentCoherence >= 0.3) tier = 'medium';

  const words = TRIAD_DRIFTING_WORDS[tier];
  if (!words.length) return null;
  return words[Math.floor(Math.random() * words.length)];
}

// ═══════════════════════════════════════════════════════════════
// SESSION HISTORY
// ═══════════════════════════════════════════════════════════════

async function getTriadHistory(enrollmentId, limit) {
  try {
    const result = await pool.query(
      `SELECT id, trimester, gestational_week, triad_quality, created_at
       FROM triad_sessions WHERE prenatal_enrollment_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [enrollmentId, limit || 20]
    );
    return result.rows;
  } catch (err) {
    console.error('[TRIAD] History fetch failed:', err.message);
    Sentry.captureException(err);
    return [];
  }
}

module.exports = {
  startTriadSession,
  getTriadOpening,
  recordTriadBiometrics,
  computeTriadSync,
  getTriadDriftingWord,
  getTriadHistory,
  TRIAD_DRIFTING_WORDS
};
