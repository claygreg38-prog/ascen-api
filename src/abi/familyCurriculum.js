// ============================================================
// [ABI] Family Curriculum Engine — Sonnet-Generated 12-Week Healing Curriculum
// File: src/abi/familyCurriculum.js
//
// Generates personalized adaptive curriculum for each family.
// Difficulty: simple (1-4) → moderate (5-8) → complex (9-12).
// Adaptive: extends struggling weeks, offers enrichment on success.
// Reassessment at weeks 6 and 12.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GENERATE CURRICULUM ─────────────────────────────────────

async function generateCurriculum(familyUnitId, tenantId) {
  const aiRouter = require('../services/aiRouter');

  try {
    // Gather context for Sonnet
    const context = await gatherCurriculumContext(familyUnitId);

    const result = await aiRouter.route('curriculum_generation', `
      Generate a 12-week personalized family healing curriculum.

      Family context:
      - Parent recovery phase: ${context.recoveryPhase}
      - Child age: ${context.childAge || 'unknown'}
      - Communication themes: ${(context.communicationThemes || []).join(', ') || 'none yet'}
      - Conflict frequency: ${context.conflictFrequency}
      - Conflict resolution rate: ${context.conflictResolutionRate}
      - Caregiver hope: "${context.caregiverHope || 'rebuilding trust'}"
      - Current engagement: ${context.engagementLevel}
      - Co-breath sessions completed: ${context.coBreathCount}
      - Kitchen table sessions: ${context.kitchenTableCount}

      Generate a JSON curriculum with:
      - 12 weeks, each with a theme and 2-3 assignments per family member
      - Difficulty progression: simple (weeks 1-4, level 1-2) → moderate (5-8, level 3) → complex (9-12, level 4-5)
      - Assignment types: communication, breathing, reflection, shared_activity, journaling, listening
      - Celebratory milestones at weeks 4, 8, 12
      - Built-in reassessment points at week 6 and week 12

      Format:
      {
        "total_weeks": 12,
        "weeks": [
          {
            "number": 1,
            "theme": "...",
            "milestone": false,
            "reassessment": false,
            "assignments": [
              { "for": "parent", "text": "...", "type": "communication", "difficulty": 1 },
              { "for": "child", "text": "...", "type": "reflection", "difficulty": 1 }
            ]
          }
        ]
      }

      Respond ONLY with valid JSON.
    `, {
      maxTokens: 3000,
      temperature: 0.7,
      tenantId
    });

    let curriculumData;
    try {
      curriculumData = JSON.parse(result?.content || '{}');
    } catch {
      curriculumData = generateFallbackCurriculum();
    }

    if (!curriculumData.weeks || curriculumData.weeks.length === 0) {
      curriculumData = generateFallbackCurriculum();
    }

    // Store curriculum
    const curResult = await pool.query(
      `INSERT INTO family_curricula
       (family_unit_id, tenant_id, curriculum_data, generation_context, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [familyUnitId, tenantId, JSON.stringify(curriculumData), JSON.stringify(context)]
    );
    const curriculumId = curResult.rows[0].id;

    // Create individual assignments for week 1
    await createWeekAssignments(curriculumId, tenantId, curriculumData.weeks[0], familyUnitId);

    console.log(`[FamilyCurriculum] Generated 12-week curriculum ${curriculumId} for family ${familyUnitId}`);

    return { curriculumId, curriculumData, currentWeek: 1 };
  } catch (err) {
    console.error('[FamilyCurriculum] generateCurriculum failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to generate curriculum' };
  }
}

// ── GET CURRENT WEEK ────────────────────────────────────────

async function getCurrentWeek(familyUnitId) {
  try {
    const curriculum = await pool.query(
      `SELECT * FROM family_curricula
       WHERE family_unit_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [familyUnitId]
    );
    if (curriculum.rows.length === 0) return null;

    const cur = curriculum.rows[0];
    const weekData = cur.curriculum_data?.weeks?.find(w => w.number === cur.current_week);

    const assignments = await pool.query(
      `SELECT * FROM curriculum_assignments
       WHERE curriculum_id = $1 AND week_number = $2
       ORDER BY created_at`,
      [cur.id, cur.current_week]
    );

    return {
      curriculumId: cur.id,
      currentWeek: cur.current_week,
      totalWeeks: cur.curriculum_data?.total_weeks || 12,
      theme: weekData?.theme || null,
      milestone: weekData?.milestone || false,
      reassessment: weekData?.reassessment || false,
      assignments: assignments.rows,
      status: cur.status
    };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ── COMPLETE ASSIGNMENT ─────────────────────────────────────

async function completeAssignment(assignmentId, participantFeedback, userId) {
  const aiRouter = require('../services/aiRouter');

  try {
    const assignment = await pool.query(
      'SELECT * FROM curriculum_assignments WHERE id = $1',
      [assignmentId]
    );
    if (assignment.rows.length === 0) return { error: true, message: 'Assignment not found' };

    const a = assignment.rows[0];
    if (a.completed) return { error: true, message: 'Assignment already completed' };

    // Sonnet assessment of participant feedback
    let sonnetAssessment = null;
    if (participantFeedback) {
      const assessResult = await aiRouter.route('curriculum_generation', `
        A family member just completed a healing assignment.

        Assignment: "${a.assignment_text}"
        Type: ${a.assignment_type}
        Their reflection: "${participantFeedback}"

        Provide a brief (2-3 sentences), warm assessment. Acknowledge their effort.
        Note any growth signals. If they're struggling, normalize it gently.

        Respond with just the assessment text, no JSON.
      `, { maxTokens: 200, temperature: 0.6 });

      sonnetAssessment = assessResult?.content || null;
    }

    await pool.query(
      `UPDATE curriculum_assignments SET
         completed = true, completed_at = NOW(),
         participant_feedback = $1, sonnet_assessment = $2
       WHERE id = $3`,
      [participantFeedback, sonnetAssessment, assignmentId]
    );

    // Check if all assignments for this week are complete
    const weekStatus = await pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE completed) as done
       FROM curriculum_assignments
       WHERE curriculum_id = $1 AND week_number = $2`,
      [a.curriculum_id, a.week_number]
    );

    const { total, done } = weekStatus.rows[0];
    const weekComplete = parseInt(done) >= parseInt(total);

    if (weekComplete) {
      await advanceWeek(a.curriculum_id);
    }

    return {
      assignmentId,
      completed: true,
      sonnetAssessment,
      weekComplete,
      participantFeedback
    };
  } catch (err) {
    console.error('[FamilyCurriculum] completeAssignment failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to complete assignment' };
  }
}

// ── ADVANCE WEEK ────────────────────────────────────────────

async function advanceWeek(curriculumId) {
  try {
    const cur = await pool.query('SELECT * FROM family_curricula WHERE id = $1', [curriculumId]);
    if (cur.rows.length === 0) return;

    const c = cur.rows[0];
    const nextWeek = c.current_week + 1;
    const totalWeeks = c.curriculum_data?.total_weeks || 12;

    if (nextWeek > totalWeeks) {
      // Curriculum complete
      await pool.query(
        "UPDATE family_curricula SET status = 'completed', completed_at = NOW() WHERE id = $1",
        [curriculumId]
      );
      console.log(`[FamilyCurriculum] Curriculum ${curriculumId} completed`);
      return;
    }

    await pool.query(
      'UPDATE family_curricula SET current_week = $1 WHERE id = $2',
      [nextWeek, curriculumId]
    );

    // Create assignments for next week
    const weekData = c.curriculum_data?.weeks?.find(w => w.number === nextWeek);
    if (weekData) {
      await createWeekAssignments(curriculumId, c.tenant_id, weekData, c.family_unit_id);
    }

    console.log(`[FamilyCurriculum] Advanced to week ${nextWeek}`);
  } catch (err) {
    console.error('[FamilyCurriculum] advanceWeek failed:', err.message);
  }
}

// ── ADAPT CURRICULUM ────────────────────────────────────────

async function adaptCurriculum(curriculumId) {
  const aiRouter = require('../services/aiRouter');

  try {
    const cur = await pool.query('SELECT * FROM family_curricula WHERE id = $1', [curriculumId]);
    if (cur.rows.length === 0) return { error: true, message: 'Curriculum not found' };

    const c = cur.rows[0];

    // Gather completion rates
    const completionData = await pool.query(
      `SELECT week_number,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE completed) as done,
              AVG(difficulty_level) as avg_difficulty
       FROM curriculum_assignments
       WHERE curriculum_id = $1
       GROUP BY week_number ORDER BY week_number`,
      [curriculumId]
    );

    // Gather conflict data since curriculum started
    const conflictData = await pool.query(
      `SELECT COUNT(*) as conflicts,
              COUNT(*) FILTER (WHERE resolution_outcome = 'resolved') as resolved
       FROM conflict_events
       WHERE family_unit_id = $1 AND created_at > $2`,
      [c.family_unit_id, c.started_at]
    );

    const completionRates = completionData.rows.map(r => ({
      week: r.week_number,
      rate: parseInt(r.total) > 0 ? parseInt(r.done) / parseInt(r.total) : 0,
      avgDifficulty: parseFloat(r.avg_difficulty) || 1
    }));

    const avgCompletion = completionRates.length > 0
      ? completionRates.reduce((s, r) => s + r.rate, 0) / completionRates.length
      : 0;

    const result = await aiRouter.route('curriculum_generation', `
      A family is at week ${c.current_week} of their 12-week healing curriculum.

      Completion rates by week: ${JSON.stringify(completionRates)}
      Average completion: ${(avgCompletion * 100).toFixed(0)}%
      Conflicts since start: ${conflictData.rows[0]?.conflicts || 0}
      Conflicts resolved: ${conflictData.rows[0]?.resolved || 0}
      Current curriculum: ${JSON.stringify(c.curriculum_data.weeks.slice(c.current_week - 1))}

      Assess progress and adjust remaining weeks (${c.current_week} through 12).

      If struggling (completion < 60%): simplify assignments, extend current themes
      If excelling (completion > 85%): add enrichment, deepen challenges

      Return adjusted weeks as JSON:
      { "adjusted_weeks": [...], "assessment": "brief progress assessment" }
    `, { maxTokens: 2000, temperature: 0.5, tenantId: c.tenant_id });

    let adaptation;
    try {
      adaptation = JSON.parse(result?.content || '{}');
    } catch {
      adaptation = { assessment: 'AI assessment unavailable', adjusted_weeks: [] };
    }

    // Update curriculum with adapted weeks if provided
    if (adaptation.adjusted_weeks && adaptation.adjusted_weeks.length > 0) {
      const updatedData = { ...c.curriculum_data };
      const startIdx = c.current_week - 1;
      for (let i = 0; i < adaptation.adjusted_weeks.length && (startIdx + i) < updatedData.weeks.length; i++) {
        updatedData.weeks[startIdx + i] = {
          ...updatedData.weeks[startIdx + i],
          ...adaptation.adjusted_weeks[i]
        };
      }

      await pool.query(
        'UPDATE family_curricula SET curriculum_data = $1 WHERE id = $2',
        [JSON.stringify(updatedData), curriculumId]
      );
    }

    return {
      curriculumId,
      currentWeek: c.current_week,
      avgCompletion,
      assessment: adaptation.assessment,
      adapted: adaptation.adjusted_weeks?.length > 0
    };
  } catch (err) {
    console.error('[FamilyCurriculum] adaptCurriculum failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to adapt curriculum' };
  }
}

// ── HELPERS ─────────────────────────────────────────────────

async function createWeekAssignments(curriculumId, tenantId, weekData, familyUnitId) {
  if (!weekData?.assignments) return;

  // Resolve family members
  const members = await pool.query(
    `SELECT fm.user_id, fm.role FROM family_memberships fm
     WHERE fm.family_unit_id = $1`,
    [familyUnitId]
  );
  const memberMap = {};
  members.rows.forEach(m => { memberMap[m.role] = m.user_id; });

  for (const a of weekData.assignments) {
    const participantId = memberMap[a.for] || memberMap.parent || null;
    await pool.query(
      `INSERT INTO curriculum_assignments
       (curriculum_id, tenant_id, week_number, participant_id, assignment_text, assignment_type, difficulty_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [curriculumId, tenantId, weekData.number, participantId,
       a.text, a.type || 'reflection', a.difficulty || 1]
    );
  }
}

async function gatherCurriculumContext(familyUnitId) {
  const context = {
    recoveryPhase: 'unknown',
    childAge: null,
    communicationThemes: [],
    conflictFrequency: 'unknown',
    conflictResolutionRate: 'unknown',
    caregiverHope: null,
    engagementLevel: 'moderate',
    coBreathCount: 0,
    kitchenTableCount: 0
  };

  try {
    // Session count as proxy for recovery phase
    const sessions = await pool.query(
      `SELECT COUNT(*) as count FROM session_completions sc
       JOIN users u ON sc.user_id = u.participant_id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1`,
      [familyUnitId]
    );
    const sessionCount = parseInt(sessions.rows[0]?.count) || 0;
    if (sessionCount >= 50) context.recoveryPhase = 'advanced';
    else if (sessionCount >= 20) context.recoveryPhase = 'intermediate';
    else context.recoveryPhase = 'early';

    // Shared goals
    const family = await pool.query(
      'SELECT shared_goals FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (family.rows[0]?.shared_goals?.hope) {
      context.caregiverHope = family.rows[0].shared_goals.hope;
    }

    // Conflict data
    const conflicts = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE resolution_outcome = 'resolved') as resolved
       FROM conflict_events WHERE family_unit_id = $1`,
      [familyUnitId]
    );
    const totalConflicts = parseInt(conflicts.rows[0]?.total) || 0;
    const resolved = parseInt(conflicts.rows[0]?.resolved) || 0;
    context.conflictFrequency = totalConflicts > 5 ? 'high' : totalConflicts > 2 ? 'moderate' : 'low';
    context.conflictResolutionRate = totalConflicts > 0 ? ((resolved / totalConflicts) * 100).toFixed(0) + '%' : 'n/a';

    // Co-breath count
    const coBreath = await pool.query(
      "SELECT COUNT(*) as count FROM cobreath_sessions WHERE family_unit_id = $1 AND status = 'completed'",
      [familyUnitId]
    );
    context.coBreathCount = parseInt(coBreath.rows[0]?.count) || 0;

    // Kitchen table count
    const kt = await pool.query(
      `SELECT COUNT(*) as count FROM kitchen_table_sessions kts
       JOIN users u ON kts.user_id = u.id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND kts.status = 'completed'`,
      [familyUnitId]
    );
    context.kitchenTableCount = parseInt(kt.rows[0]?.count) || 0;
  } catch (err) {
    // Non-blocking — return context with defaults
  }

  return context;
}

function generateFallbackCurriculum() {
  const types = ['communication', 'breathing', 'reflection', 'shared_activity', 'journaling', 'listening'];
  const weeks = [];
  for (let i = 1; i <= 12; i++) {
    const difficulty = i <= 4 ? 1 : i <= 8 ? 3 : 5;
    weeks.push({
      number: i,
      theme: `Week ${i}: ${['Foundation', 'Trust', 'Communication', 'Milestone', 'Vulnerability', 'Understanding', 'Reassessment', 'Milestone', 'Depth', 'Courage', 'Integration', 'Celebration'][i - 1]}`,
      milestone: [4, 8, 12].includes(i),
      reassessment: [6, 12].includes(i),
      assignments: [
        { for: 'parent', text: `Week ${i} parent reflection exercise`, type: types[i % 6], difficulty },
        { for: 'child', text: `Week ${i} child expression exercise`, type: types[(i + 1) % 6], difficulty: Math.max(1, difficulty - 1) }
      ]
    });
  }
  return { total_weeks: 12, weeks };
}

module.exports = {
  generateCurriculum,
  getCurrentWeek,
  completeAssignment,
  adaptCurriculum
};
