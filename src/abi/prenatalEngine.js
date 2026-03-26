// ============================================================
// [ABI] Prenatal Engine — System Preparation Module
// File: src/abi/prenatalEngine.js
//
// The parent's nervous system IS the child's environment.
// Every breath session during pregnancy is already a
// co-regulation session — the parent regulates, the child
// experiences safety.
//
// Three phases:
//   T1 (1-12): Foundation. Gentle sessions only. 3:5 ratio, 10 min max.
//   T2 (13-27): Deepening. Heritage/Price mapping. 4:6 ratio, 15 min max.
//   T3 (28-40): Preparation. Birth breath plan + LightBridge. 4:6, 12 min max.
//
// Architecture:
//   - Concurrent with solo spine (not replacement)
//   - Fetal environment estimation is REFLECTION, not medical diagnosis
//   - Pregnancy loss handled with absolute dignity
//   - Post-natal: LightBridge activates, child joins family unit
// ============================================================

'use strict';

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════
// TRIMESTER PHASES
// ═══════════════════════════════════════════════════════════════

const TRIMESTER_PHASES = {
  1: {
    name: 'Foundation',
    weeks: [1, 12],
    max_session_minutes: 10,
    breath_ratio: '3:5',  // Gentle — body is adapting
    focus: 'What code am I running that I want to change before this child arrives?',
    session_adaptations: {
      no_prone_exercises: true,
      shorter_holds: true,
      gentle_somatic_only: true,
      capacity_extra_cautious: true
    }
  },
  2: {
    name: 'Deepening',
    weeks: [13, 27],
    max_session_minutes: 15,
    breath_ratio: '4:6',
    focus: 'What code will this child inherit if I don\'t change it?',
    session_adaptations: {
      heritage_price_available: true,
      partner_triad_available: true,
      kitchen_table_topics: 'prenatal_filtered'
    }
  },
  3: {
    name: 'Preparation',
    weeks: [28, 40],
    max_session_minutes: 12,  // Shorter — body is preparing
    breath_ratio: '4:6',
    focus: 'How do I stay regulated during the hardest moments?',
    session_adaptations: {
      birth_breath_practice: true,
      lightbridge_setup: true,
      transition_planning: true,
      nesting_content: true
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// GESTATIONAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Compute gestational week from due date.
 * Standard: 280 days (40 weeks) total gestation.
 */
function computeGestationalWeek(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const totalDays = 280;
  const daysUntilDue = Math.floor((due - now) / (24 * 60 * 60 * 1000));
  const daysPregnant = totalDays - daysUntilDue;
  return Math.max(1, Math.min(42, Math.ceil(daysPregnant / 7)));
}

function computeTrimester(gestationalWeek) {
  if (gestationalWeek <= 12) return 1;
  if (gestationalWeek <= 27) return 2;
  return 3;
}

// ═══════════════════════════════════════════════════════════════
// ENROLLMENT
// ═══════════════════════════════════════════════════════════════

async function enroll(userId, partnerId, familyUnitId, dueDate, tenantId) {
  const gestationalWeek = computeGestationalWeek(dueDate);
  const trimester = computeTrimester(gestationalWeek);

  try {
    const result = await pool.query(`
      INSERT INTO prenatal_enrollments (user_id, partner_id, family_unit_id, tenant_id,
        due_date, current_trimester, weeks_at_enrollment)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [userId, partnerId || null, familyUnitId || null, tenantId || null,
        dueDate, trimester, gestationalWeek]);

    return {
      enrollment_id: result.rows[0].id,
      trimester,
      gestational_week: gestationalWeek,
      phase: TRIMESTER_PHASES[trimester]
    };
  } catch (err) {
    console.error('[PRENATAL] Enrollment failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Get active enrollment for a user.
 */
async function getEnrollment(userId) {
  const result = await pool.query(
    `SELECT * FROM prenatal_enrollments WHERE user_id = $1 AND status = 'active' ORDER BY enrolled_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Add partner to existing enrollment.
 */
async function addPartner(enrollmentId, partnerId) {
  await pool.query(
    'UPDATE prenatal_enrollments SET partner_id = $1, updated_at = NOW() WHERE id = $2',
    [partnerId, enrollmentId]
  );
  return { partner_added: true };
}

// ═══════════════════════════════════════════════════════════════
// SESSION ADAPTATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get trimester-appropriate session adaptations.
 * Called by session orchestrator to modify session parameters.
 */
function getSessionAdaptations(dueDate) {
  const week = computeGestationalWeek(dueDate);
  const trimester = computeTrimester(week);
  const phase = TRIMESTER_PHASES[trimester];

  // Fix #10: If week > 42 and no birth recorded, flag for facilitator review.
  // Do NOT automate any messages — human facilitator contact only.
  const overdue = week > 42;

  // Fix #3: CRITICAL — prenatal breath_ratio OVERRIDES determineBreathParams output.
  // T1 requires 3:5 regardless of arrival biometrics. A strong arrival
  // does not mean the pregnant body should do 4:7. The session orchestrator
  // must apply this override AFTER determineBreathParams runs, not before.

  return {
    trimester,
    gestational_week: week,
    phase_name: phase.name,
    max_session_minutes: phase.max_session_minutes,
    breath_ratio: phase.breath_ratio,
    breath_ratio_override: true,  // Signal to orchestrator: this ratio overrides determineBreathParams
    focus: phase.focus,
    adaptations: phase.session_adaptations,
    overdue,
    facilitator_review_needed: overdue
  };
}

// ═══════════════════════════════════════════════════════════════
// TRIMESTER CONTENT
// ═══════════════════════════════════════════════════════════════

/**
 * Get content for the current gestational week.
 */
async function getContent(dueDate) {
  const week = computeGestationalWeek(dueDate);
  const trimester = computeTrimester(week);

  try {
    const content = await pool.query(
      `SELECT * FROM trimester_content
       WHERE trimester = $1 AND week_start <= $2 AND week_end >= $2
       ORDER BY sort_order`,
      [trimester, week]
    );

    return {
      trimester,
      week,
      phase: TRIMESTER_PHASES[trimester],
      content: content.rows
    };
  } catch (err) {
    console.error('[PRENATAL] Content fetch failed:', err.message);
    Sentry.captureException(err);
    return { trimester, week, phase: TRIMESTER_PHASES[trimester], content: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// FETAL ENVIRONMENT ESTIMATION
// This is a REFLECTION tool, NOT medical diagnosis.
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate fetal environment quality from parent biometrics.
 * Language is always body-centered and supportive — never clinical.
 */
function estimateFetalEnvironment(parentBiometrics) {
  const { mean_hr, mean_hrv, coherence, sustained_elevated_minutes } = parentBiometrics || {};

  // Order: calm → settling → stressed → activated (stressed = higher threshold than activated)
  if ((coherence || 0) > 0.6 && (mean_hrv || 0) > 40 && (mean_hr || 99) < 85) {
    return { state: 'calm', description: 'Your body is creating a peaceful environment.' };
  }
  if ((coherence || 0) > 0.3 && (mean_hrv || 0) > 25) {
    return { state: 'settling', description: 'Your body is finding its rhythm. The little one feels that.' };
  }
  // Fix #2: stressed state — higher threshold than activated, body-focused language
  if ((mean_hr || 0) > 100 || (sustained_elevated_minutes || 0) > 10) {
    return { state: 'stressed', description: 'Your system is under a lot of pressure right now. Let\'s slow everything down. One breath at a time.' };
  }
  if ((mean_hr || 0) > 95 || (sustained_elevated_minutes || 0) > 5) {
    return { state: 'activated', description: 'Your system is working hard today. A few deep breaths help both of you.' };
  }
  return { state: 'settling', description: 'Your body is doing important work. Keep breathing.' };
}

// ═══════════════════════════════════════════════════════════════
// PRENATAL HERITAGE/PRICE FOCUS
// ═══════════════════════════════════════════════════════════════

/**
 * Get Heritage/Price data focused through prenatal lens.
 * "Which code do I NOT want to install in this child?"
 */
async function getPrenatalHeritageFocus(userId) {
  try {
    // Get confirmed armors from LACE
    const lace = await pool.query(
      `SELECT confirmed_armors FROM lace_assessments
       WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    if (!lace.rows.length) return null;

    const armors = (lace.rows[0].confirmed_armors || []).filter(a => a.confirmed);

    // Get Heritage/Price high-cost dimensions
    const hp = await pool.query(
      `SELECT high_cost_dimensions, dimensions FROM heritage_price_sessions
       WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    return {
      armors: armors.map(a => a.name),
      high_cost_dimensions: hp.rows.length ? hp.rows[0].high_cost_dimensions : [],
      prenatal_question: 'Which of these patterns do you NOT want your child to inherit?',
      per_armor: armors.map(a => ({
        armor: a.name,
        question: `The ${a.name} protected you. What would it look like if your child never needed it?`,
        transmission_risk: 'If this code is still running when the baby arrives, they will learn it through your nervous system — not your words.'
      }))
    };
  } catch (err) {
    console.error('[PRENATAL] Heritage focus failed:', err.message);
    Sentry.captureException(err);
    return null;
  }
}

/**
 * Record patterns the parent wants to deprecate before birth.
 */
async function recordCodesToDeprecate(enrollmentId, codes) {
  await pool.query(
    'UPDATE prenatal_enrollments SET codes_to_deprecate = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(codes), enrollmentId]
  );
  return { recorded: true, count: codes.length };
}

// ═══════════════════════════════════════════════════════════════
// LIFECYCLE — BIRTH + LOSS
// ═══════════════════════════════════════════════════════════════

/**
 * Record birth. Transitions enrollment to completed.
 */
async function recordBirth(enrollmentId, birthDate, childName) {
  try {
    await pool.query(`
      UPDATE prenatal_enrollments
      SET birth_date = $1, child_name = $2, status = 'completed',
          postnatal_transition_date = $1, updated_at = NOW()
      WHERE id = $3
    `, [birthDate, childName, enrollmentId]);

    // Lineage entry for the birth
    try {
      const lineageService = require('../services/lineageService');
      const enrollment = await pool.query('SELECT user_id, family_unit_id, tenant_id FROM prenatal_enrollments WHERE id = $1', [enrollmentId]);
      const e = enrollment.rows[0];
      await lineageService.recordEntry(e.user_id, e.family_unit_id, e.tenant_id, 'prenatal_completed', {
        child_name: childName,
        birth_date: birthDate,
        note: 'Prenatal practice completed. The work before birth is honored in the lineage record.'
      });
    } catch (lineageErr) {
      console.error('[PRENATAL] Lineage entry failed (non-blocking):', lineageErr.message);
      Sentry.captureException(lineageErr);
    }

    return { transitioned: true, birth_date: birthDate, child_name: childName };
  } catch (err) {
    console.error('[PRENATAL] Birth recording failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Handle pregnancy loss with absolute dignity.
 *
 * 1. Status set to 'loss'. Enrollment NOT deleted. The work was real.
 * 2. All prenatal-specific notifications stop immediately.
 * 3. No automated messages about pregnancy. Ever again.
 * 4. Lineage record honors sessions completed during pregnancy.
 * 5. Human facilitator contact only — NOT AI.
 */
async function recordLoss(enrollmentId) {
  try {
    const enrollment = await pool.query(
      'SELECT user_id, family_unit_id, tenant_id, partner_id, child_name FROM prenatal_enrollments WHERE id = $1',
      [enrollmentId]
    );
    if (!enrollment.rows.length) throw new Error('Enrollment not found');
    const e = enrollment.rows[0];

    // Set status to loss — do NOT delete
    await pool.query(
      'UPDATE prenatal_enrollments SET status = $1, updated_at = NOW() WHERE id = $2',
      ['loss', enrollmentId]
    );

    // Stop all pending prenatal notifications immediately
    try {
      await pool.query(
        `DELETE FROM notification_queue WHERE user_id = $1 AND payload::text LIKE '%prenatal%' AND status = 'pending'`,
        [e.user_id]
      );
      if (e.partner_id) {
        await pool.query(
          `DELETE FROM notification_queue WHERE user_id = $1 AND payload::text LIKE '%prenatal%' AND status = 'pending'`,
          [e.partner_id]
        );
      }
    } catch (notifErr) {
      // notification_queue may not have payload column — non-blocking
      console.error('[PRENATAL] Notification cleanup failed (non-blocking):', notifErr.message);
      Sentry.captureException(notifErr);
    }

    // Lineage entry honoring the work
    try {
      const lineageService = require('../services/lineageService');
      const childRef = e.child_name || 'the one we carried';
      await lineageService.recordEntry(e.user_id, e.family_unit_id, e.tenant_id, 'prenatal_honored', {
        enrollment_id: enrollmentId,
        note: `Sessions completed during this pregnancy are honored in the lineage record. This practice was for ${childRef}.`
      });
    } catch (lineageErr) {
      console.error('[PRENATAL] Lineage entry failed (non-blocking):', lineageErr.message);
      Sentry.captureException(lineageErr);
    }

    // Log for facilitator notification (human contact required, not AI)
    Sentry.captureMessage(`Pregnancy loss recorded: enrollment ${enrollmentId}, user ${e.user_id}`, 'info');

    // Fix #5: Engine returns data only. Dignity message in route response layer.
    return { acknowledged: true };
  } catch (err) {
    console.error('[PRENATAL] Loss recording failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Get prenatal dashboard data.
 */
async function getDashboard(userId) {
  const enrollment = await getEnrollment(userId);
  if (!enrollment) return null;

  const week = computeGestationalWeek(enrollment.due_date);
  const trimester = computeTrimester(week);
  const phase = TRIMESTER_PHASES[trimester];

  // Get content for current week
  const contentResult = await getContent(enrollment.due_date);

  // Get triad session history
  const triads = await pool.query(
    `SELECT triad_quality, gestational_week, created_at FROM triad_sessions
     WHERE prenatal_enrollment_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [enrollment.id]
  );

  // Fetal environment trend from triad sessions
  const envTrend = triads.rows
    .filter(t => t.triad_quality?.estimated_fetal_environment)
    .map(t => ({
      state: t.triad_quality.estimated_fetal_environment.state,
      week: t.gestational_week,
      date: t.created_at
    }));

  return {
    enrollment_id: enrollment.id,
    due_date: enrollment.due_date,
    trimester,
    gestational_week: week,
    phase_name: phase.name,
    focus: phase.focus,
    partner_enrolled: !!enrollment.partner_id,
    codes_to_deprecate: enrollment.codes_to_deprecate || [],
    content: contentResult.content,
    triad_sessions_completed: triads.rows.length,
    fetal_environment_trend: envTrend,
    days_until_due: Math.max(0, Math.floor((new Date(enrollment.due_date) - new Date()) / (24 * 60 * 60 * 1000)))
  };
}

module.exports = {
  enroll,
  getEnrollment,
  addPartner,
  getSessionAdaptations,
  getContent,
  estimateFetalEnvironment,
  getPrenatalHeritageFocus,
  recordCodesToDeprecate,
  recordBirth,
  recordLoss,
  getDashboard,
  computeGestationalWeek,
  computeTrimester,
  TRIMESTER_PHASES
};
