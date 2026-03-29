// ============================================================
// [ABI] Family Intelligence Layer — ABI System #15
// File: src/abi/familyIntelligence.js
//
// Relational reasoning engine. Reads ONLY structured metadata
// (session events, NS3 zones, engagement patterns). NEVER
// accesses raw biometrics, journal entries, or clinical payloads.
//
// Flows through ABI orchestrator. No bypasses.
//
// Exports:
//   onFamilyMemberSessionComplete(userId, sessionData, familyUnitId)
//   analyzePatterns(familyUnitId, userId, sessionData)
//   evaluateResponseRules(familyUnitId, userId, sessionData, patterns)
//   checkEscalation(familyUnitId, patterns, recentSessions)
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');
let capacityCurrency = null;
try { capacityCurrency = require('./capacityCurrency'); } catch (e) { /* loaded lazily */ }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── COOLDOWN CONFIGURATION ──────────────────────────────────

const COOLDOWNS = {
  disagreement: 4 * 60 * 60 * 1000,    // 4 hours
  avoidance: 48 * 60 * 60 * 1000,       // 48 hours
  milestone: 0,                           // immediate
  dropout: 72 * 60 * 60 * 1000,          // 72 hours
  breakthrough: 0,                        // immediate
  overdraft: 24 * 60 * 60 * 1000,        // 24 hours
  cascade: 24 * 60 * 60 * 1000           // 24 hours
};

const DAILY_MESSAGE_CAP = 3;
const MIN_OBSERVATIONS = 3;

// ── MASTER HANDLER ──────────────────────────────────────────

/**
 * Called from sessionOrchestrator after individual session processing.
 * Triggers all family intelligence analysis.
 *
 * @param {string} userId - user_id
 * @param {Object} sessionData - { sessionNumber, ns3Zone, trajectory, coherenceEnd, exitType }
 * @param {string} familyUnitId
 * @returns {Promise<Object>} { messages, escalations, gateChanges, milestones }
 */
async function onFamilyMemberSessionComplete(userId, sessionData, familyUnitId) {
  const result = { messages: [], escalations: [], gateChanges: [], milestones: [] };

  try {
    // 1. Update collective metrics
    await updateCollectiveMetrics(familyUnitId, sessionData);

    // 2. Update member progress
    await updateMemberProgress(userId, familyUnitId);

    // 3. Pattern analysis
    const patterns = await analyzePatterns(familyUnitId, userId, sessionData);

    // 4. Response rule evaluation
    const messages = await evaluateResponseRules(familyUnitId, userId, sessionData, patterns);
    result.messages = messages;

    // 5. Escalation check
    const escalations = await checkEscalation(familyUnitId, patterns);
    result.escalations = escalations;

    // 6. Gate progression (delegated to familyUnitEngine)
    // Caller handles this via familyUnitEngine.evaluateGates()

    // 7. Family milestone check (for constellation triggers)
    const milestone = await checkFamilyMilestoneMessage(familyUnitId);
    if (milestone) {
      result.milestones.push(milestone);
      // LightBridge: family milestone celebration
      try {
        const lightBridgeEngine = require('./lightBridgeEngine');
        await lightBridgeEngine.triggerCelebration(familyUnitId, 'family_milestone');
      } catch (lbErr) {
        // Non-blocking
      }
    }

  } catch (err) {
    console.error('[FamilyIntel] Processing failed:', err.message);
    Sentry.captureException(err);
  }

  return result;
}

// ── COLLECTIVE METRICS UPDATE ───────────────────────────────

async function updateCollectiveMetrics(familyUnitId, sessionData) {
  try {
    const family = await pool.query(
      'SELECT collective_metrics FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    if (family.rows.length === 0) return;

    const metrics = family.rows[0].collective_metrics || {};
    metrics.total_sessions = (metrics.total_sessions || 0) + 1;

    // Track regulated hours (NS3 optimal zone time)
    if (sessionData.ns3Zone === 'optimal') {
      const durationHours = (sessionData.activeDurationSeconds || 600) / 3600;
      metrics.collective_regulated_hours = Math.round(((metrics.collective_regulated_hours || 0) + durationHours) * 100) / 100;
    }

    await pool.query(
      'UPDATE family_units SET collective_metrics = $1 WHERE family_unit_id = $2',
      [JSON.stringify(metrics), familyUnitId]
    );
  } catch (err) {
    console.error('[FamilyIntel] Metrics update failed:', err.message);
    Sentry.captureException(err);
  }
}

// ── MEMBER PROGRESS UPDATE ──────────────────────────────────

async function updateMemberProgress(userId, familyUnitId) {
  try {
    const userRow = await pool.query('SELECT id, total_sessions_completed FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return;

    const userDbId = userRow.rows[0].id;
    const sessionCount = userRow.rows[0].total_sessions_completed || 0;

    // Calculate streak
    const recentSessions = await pool.query(
      `SELECT DISTINCT DATE(completed_at) as d FROM session_completions
       WHERE user_id = $1 ORDER BY d DESC LIMIT 30`,
      [userId]
    );

    let streakDays = 0;
    const dates = recentSessions.rows.map(r => r.d);
    if (dates.length > 0) {
      streakDays = 1;
      for (let i = 1; i < dates.length; i++) {
        const diff = (new Date(dates[i - 1]) - new Date(dates[i])) / (1000 * 60 * 60 * 24);
        if (diff <= 1) streakDays++;
        else break;
      }
    }

    await pool.query(
      `UPDATE family_memberships
       SET individual_progress = jsonb_set(
         jsonb_set(individual_progress, '{session_count}', $1::text::jsonb),
         '{streak_days}', $2::text::jsonb
       )
       WHERE family_unit_id = $3 AND user_id = $4`,
      [sessionCount.toString(), streakDays.toString(), familyUnitId, userDbId]
    );
  } catch (err) {
    console.error('[FamilyIntel] Member progress update failed:', err.message);
    Sentry.captureException(err);
  }
}

// ── PATTERN ANALYSIS ────────────────────────────────────────

/**
 * Analyze patterns across family members. Updates family_patterns table.
 * Reads ONLY structured metadata (zones, trajectories, timestamps).
 *
 * @param {string} familyUnitId
 * @param {string} userId
 * @param {Object} sessionData
 * @returns {Promise<Array>} Actionable patterns (observation >= 3)
 */
async function analyzePatterns(familyUnitId, userId, sessionData) {
  const actionablePatterns = [];

  try {
    // Temporal correlation: session time-of-day + quality
    await analyzeTemporalPattern(familyUnitId, userId, sessionData);

    // Dyadic correlation: compare with other members' recent sessions
    await analyzeDyadicPattern(familyUnitId, userId, sessionData);

    // Cascade correlation: dysregulation spread
    await analyzeCascadePattern(familyUnitId, userId, sessionData);

    // Fetch all actionable patterns
    const patterns = await pool.query(
      'SELECT * FROM family_patterns WHERE family_unit_id = $1 AND observation_count >= $2',
      [familyUnitId, MIN_OBSERVATIONS]
    );

    actionablePatterns.push(...patterns.rows);
  } catch (err) {
    console.error('[FamilyIntel] Pattern analysis failed:', err.message);
    Sentry.captureException(err);
  }

  return actionablePatterns;
}

async function analyzeTemporalPattern(familyUnitId, userId, sessionData) {
  const hour = new Date().getHours();
  const timeSlot = hour < 6 ? 'early_morning' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const patternKey = `${userId}_${timeSlot}_${dayOfWeek}`;

  const qualityScore = sessionData.ns3Zone === 'optimal' ? 1.0
    : sessionData.ns3Zone === 'approaching' ? 0.7
    : sessionData.ns3Zone === 'regulated' ? 0.5
    : 0.3;

  await upsertPattern(familyUnitId, 'temporal', patternKey, {
    userId,
    timeSlot,
    dayOfWeek,
    qualityScores: [qualityScore],
    avgQuality: qualityScore
  });
}

async function analyzeDyadicPattern(familyUnitId, userId, sessionData) {
  try {
    // Find other family members who completed sessions within 24h
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return;
    const userDbId = userRow.rows[0].id;

    const recentFamilySessions = await pool.query(
      `SELECT sc.user_id as uid, u.id as db_id, sc.ns3_mean, sc.regulatory_trajectory
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND u.id != $2
         AND sc.completed_at > NOW() - INTERVAL '24 hours'
       ORDER BY sc.completed_at DESC`,
      [familyUnitId, userDbId]
    );

    for (const other of recentFamilySessions.rows) {
      const pairKey = [userDbId, other.db_id].sort().join('_');
      const patternKey = `dyad_${pairKey}`;

      const otherNS3 = parseFloat(other.ns3_mean) || 50;
      const myNS3 = sessionData.ns3Mean || 50;
      const convergence = 1.0 - Math.abs(myNS3 - otherNS3) / 100;

      await upsertPattern(familyUnitId, 'dyadic', patternKey, {
        members: [userDbId, other.db_id],
        convergenceScores: [convergence],
        avgConvergence: convergence
      });
    }
  } catch (err) {
    console.error('[FamilyIntel] Dyadic analysis failed:', err.message);
    Sentry.captureException(err);
  }
}

async function analyzeCascadePattern(familyUnitId, userId, sessionData) {
  try {
    // Only track if this member showed dysregulation
    if (sessionData.ns3Zone !== 'below_window') return;

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return;
    const userDbId = userRow.rows[0].id;

    // Check if another member showed dysregulation within the last 48 hours
    const recentDysregulation = await pool.query(
      `SELECT sc.user_id as uid, u.id as db_id
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND u.id != $2
         AND sc.completed_at > NOW() - INTERVAL '48 hours'
         AND sc.ns3_mean IS NOT NULL AND sc.ns3_mean <= 35`,
      [familyUnitId, userDbId]
    );

    for (const other of recentDysregulation.rows) {
      const cascadeKey = `cascade_${other.db_id}_to_${userDbId}`;
      await upsertPattern(familyUnitId, 'cascade', cascadeKey, {
        source_member: other.db_id,
        affected_member: userDbId,
        occurrences: [new Date().toISOString()]
      });
    }
  } catch (err) {
    console.error('[FamilyIntel] Cascade analysis failed:', err.message);
    Sentry.captureException(err);
  }
}

async function upsertPattern(familyUnitId, patternType, patternKey, patternData) {
  try {
    const existing = await pool.query(
      'SELECT id, pattern_data, observation_count FROM family_patterns WHERE family_unit_id = $1 AND pattern_type = $2 AND pattern_key = $3',
      [familyUnitId, patternType, patternKey]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const merged = { ...row.pattern_data, ...patternData };

      // Merge array fields
      for (const key of Object.keys(patternData)) {
        if (Array.isArray(patternData[key]) && Array.isArray(row.pattern_data[key])) {
          merged[key] = [...row.pattern_data[key], ...patternData[key]].slice(-20); // Keep last 20
        }
      }

      // Recalculate averages
      if (merged.qualityScores) merged.avgQuality = merged.qualityScores.reduce((a, b) => a + b, 0) / merged.qualityScores.length;
      if (merged.convergenceScores) merged.avgConvergence = merged.convergenceScores.reduce((a, b) => a + b, 0) / merged.convergenceScores.length;

      await pool.query(
        `UPDATE family_patterns SET pattern_data = $1, observation_count = observation_count + 1, last_observed = NOW()
         WHERE id = $2`,
        [JSON.stringify(merged), row.id]
      );
    } else {
      await pool.query(
        `INSERT INTO family_patterns (family_unit_id, pattern_type, pattern_key, pattern_data)
         VALUES ($1, $2, $3, $4)`,
        [familyUnitId, patternType, patternKey, JSON.stringify(patternData)]
      );
    }
  } catch (err) {
    // Unique constraint race condition — ignore
    if (!err.message.includes('duplicate key')) {
      console.error('[FamilyIntel] Pattern upsert failed:', err.message);
      Sentry.captureException(err);
    }
  }
}

// ── RESPONSE RULE EVALUATION ────────────────────────────────

/**
 * Condition-action engine. Checks each rule category.
 * Enforces cooldowns and daily message caps.
 *
 * @param {string} familyUnitId
 * @param {string} userId
 * @param {Object} sessionData
 * @param {Array} patterns - Actionable patterns
 * @returns {Promise<Array>} Messages to queue
 */
async function evaluateResponseRules(familyUnitId, userId, sessionData, patterns) {
  const messages = [];

  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1', [userId]);
    if (userRow.rows.length === 0) return messages;
    const userDbId = userRow.rows[0].id;

    // Milestone check
    const metrics = await pool.query('SELECT collective_metrics FROM family_units WHERE family_unit_id = $1', [familyUnitId]);
    const totalSessions = metrics.rows[0]?.collective_metrics?.total_sessions || 0;

    if ([10, 25, 50, 100, 250, 500, 1000].includes(totalSessions)) {
      const msg = await buildMessage(familyUnitId, null, 'family_unit', 'milestone', 'gentle', totalSessions);
      if (msg) messages.push(msg);
    }

    // Breakthrough check: sustained regulation improvement
    if (sessionData.trajectory === 'improving' && sessionData.ns3Zone === 'optimal') {
      const recentOptimal = await pool.query(
        `SELECT COUNT(*) as c FROM session_completions
         WHERE user_id = $1 AND sustained_optimal = true
         AND completed_at > NOW() - INTERVAL '72 hours'`,
        [userId]
      );
      if (parseInt(recentOptimal.rows[0].c) >= 3) {
        if (await canSendMessage(userDbId, 'breakthrough')) {
          const msg = await buildMessage(familyUnitId, userDbId, 'individual', 'breakthrough', 'gentle');
          if (msg) messages.push(msg);
        }
      }
    }

    // Cascade detection from patterns
    const cascadePatterns = patterns.filter(p => p.pattern_type === 'cascade' && p.observation_count >= MIN_OBSERVATIONS);
    if (cascadePatterns.length > 0) {
      if (await canSendMessage(null, 'cascade', familyUnitId)) {
        const msg = await buildMessage(familyUnitId, null, 'family_unit', 'cascade', 'urgent');
        if (msg) messages.push(msg);
      }
    }

    // Overdraft check using real capacity data
    if (capacityCurrency) {
      try {
        const capacity = await capacityCurrency.getBalance(userId);
        if (capacity.state === 'depleted' || capacity.state === 'low') {
          if (await canSendMessage(userDbId, 'overdraft')) {
            const severity = capacity.state === 'depleted' ? 'urgent' : 'moderate';
            const msg = await buildMessage(familyUnitId, userDbId, 'individual', 'overdraft', severity);
            if (msg) messages.push(msg);
          }
        }
      } catch (capErr) {
        // Non-blocking — overdraft check is supplementary
      }
    }

  } catch (err) {
    console.error('[FamilyIntel] Response rules failed:', err.message);
    Sentry.captureException(err);
  }

  return messages;
}

// ── COOLDOWN ENFORCEMENT ────────────────────────────────────

async function canSendMessage(userDbId, category, familyUnitId) {
  try {
    // Check category cooldown
    const cooldown = COOLDOWNS[category] || 0;
    if (cooldown > 0) {
      const whereClause = userDbId
        ? 'target_user_id = $1'
        : 'family_unit_id = $1';
      const paramVal = userDbId || familyUnitId;

      const lastMsg = await pool.query(
        `SELECT sent_at FROM family_messages WHERE ${whereClause} AND category = $2 ORDER BY sent_at DESC LIMIT 1`,
        [paramVal, category]
      );

      if (lastMsg.rows.length > 0) {
        const elapsed = Date.now() - new Date(lastMsg.rows[0].sent_at).getTime();
        if (elapsed < cooldown) return false;
      }
    }

    // Check daily cap (individual messages only)
    if (userDbId) {
      const dailyCount = await pool.query(
        `SELECT COUNT(*) as c FROM family_messages
         WHERE target_user_id = $1 AND sent_at > NOW() - INTERVAL '24 hours'`,
        [userDbId]
      );
      if (parseInt(dailyCount.rows[0].c) >= DAILY_MESSAGE_CAP) return false;
    }

    return true;
  } catch (err) {
    console.error('[FamilyIntel] Cooldown check failed:', err.message);
    return false;
  }
}

// ── MESSAGE BUILDER ─────────────────────────────────────────

async function buildMessage(familyUnitId, targetUserId, targetType, category, severity, contextValue) {
  try {
    // Fetch a template (rotation)
    const template = await pool.query(
      `SELECT id, message_text FROM message_templates
       WHERE category = $1 AND severity = $2 AND target_type = $3 AND tenant_slug = 'ascen'
       ORDER BY RANDOM() LIMIT 1`,
      [category, severity, targetType]
    );

    if (template.rows.length === 0) return null;

    let text = template.rows[0].message_text;
    // Replace placeholders
    if (contextValue !== undefined) {
      text = text.replace(/\[N\]/g, String(contextValue));
    }

    const cooldownMs = COOLDOWNS[category] || 0;
    const cooldownUntil = cooldownMs > 0 ? new Date(Date.now() + cooldownMs).toISOString() : null;

    return {
      familyUnitId,
      targetUserId,
      targetType,
      category,
      severity,
      templateId: template.rows[0].id,
      text,
      cooldownUntil
    };
  } catch (err) {
    console.error('[FamilyIntel] Message build failed:', err.message);
    Sentry.captureException(err);
    return null;
  }
}

// ── ESCALATION CHECK ────────────────────────────────────────

/**
 * Triggers facilitator intervention when automated responses aren't working.
 *
 * @param {string} familyUnitId
 * @param {Array} patterns
 * @returns {Promise<Array>} Escalations to create
 */
async function checkEscalation(familyUnitId, patterns) {
  const escalations = [];

  try {
    // 1. Sustained dysregulation: 3+ sessions with below_window despite interventions
    const dysregMembers = await pool.query(
      `SELECT u.id, COUNT(*) as below_count
       FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1
         AND sc.completed_at > NOW() - INTERVAL '14 days'
         AND sc.ns3_mean IS NOT NULL AND sc.ns3_mean <= 35
       GROUP BY u.id
       HAVING COUNT(*) >= 3`,
      [familyUnitId]
    );

    if (dysregMembers.rows.length > 0) {
      // Check if already escalated recently
      const recentEsc = await pool.query(
        `SELECT id FROM family_escalations
         WHERE family_unit_id = $1 AND escalation_type = 'sustained_system_load'
         AND created_at > NOW() - INTERVAL '7 days' AND status != 'resolved'`,
        [familyUnitId]
      );

      if (recentEsc.rows.length === 0) {
        escalations.push({
          type: 'sustained_system_load',
          triggerData: { affected_members: dysregMembers.rows.map(r => r.id), period: '14 days' },
          routeTo: 'facilitator'
        });
      }
    }

    // 2. Cascade pattern repeating 3+ times
    const repeatingCascades = patterns.filter(
      p => p.pattern_type === 'cascade' && p.observation_count >= 3
    );
    if (repeatingCascades.length > 0) {
      const recentCascadeEsc = await pool.query(
        `SELECT id FROM family_escalations
         WHERE family_unit_id = $1 AND escalation_type = 'cascade_repeat'
         AND created_at > NOW() - INTERVAL '7 days' AND status != 'resolved'`,
        [familyUnitId]
      );

      if (recentCascadeEsc.rows.length === 0) {
        escalations.push({
          type: 'cascade_repeat',
          triggerData: { patterns: repeatingCascades.map(p => p.pattern_key) },
          routeTo: 'facilitator'
        });
      }
    }

    // 3. Engagement drop: family active sessions < 40% of baseline for 2+ weeks
    const recentActivity = await pool.query(
      `SELECT COUNT(*) as recent FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1 AND sc.completed_at > NOW() - INTERVAL '14 days'`,
      [familyUnitId]
    );
    const baselineActivity = await pool.query(
      `SELECT COUNT(*) as baseline FROM session_completions sc
       JOIN users u ON sc.user_id = u.id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1
         AND sc.completed_at BETWEEN NOW() - INTERVAL '42 days' AND NOW() - INTERVAL '14 days'`,
      [familyUnitId]
    );

    const recent = parseInt(recentActivity.rows[0].recent) || 0;
    const baseline = parseInt(baselineActivity.rows[0].baseline) || 0;

    if (baseline > 0 && recent < baseline * 0.4) {
      const recentDropEsc = await pool.query(
        `SELECT id FROM family_escalations
         WHERE family_unit_id = $1 AND escalation_type = 'engagement_drop'
         AND created_at > NOW() - INTERVAL '14 days' AND status != 'resolved'`,
        [familyUnitId]
      );

      if (recentDropEsc.rows.length === 0) {
        escalations.push({
          type: 'engagement_drop',
          triggerData: { recent_sessions: recent, baseline_sessions: baseline, ratio: baseline > 0 ? (recent / baseline).toFixed(2) : 0 },
          routeTo: 'facilitator'
        });
      }
    }
  } catch (err) {
    console.error('[FamilyIntel] Escalation check failed:', err.message);
    Sentry.captureException(err);
  }

  return escalations;
}

// ── FAMILY MILESTONE MESSAGE ────────────────────────────────

async function checkFamilyMilestoneMessage(familyUnitId) {
  try {
    const metrics = await pool.query(
      'SELECT collective_metrics FROM family_units WHERE family_unit_id = $1',
      [familyUnitId]
    );
    const total = metrics.rows[0]?.collective_metrics?.total_sessions || 0;
    if ([10, 25, 50, 100, 250, 500, 1000].includes(total)) {
      return { type: 'collective_milestone', totalSessions: total };
    }
  } catch (err) {
    // Non-blocking
  }
  return null;
}

module.exports = {
  onFamilyMemberSessionComplete,
  analyzePatterns,
  evaluateResponseRules,
  checkEscalation
};
