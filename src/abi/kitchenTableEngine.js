// ============================================================
// [ABI] Kitchen Table Engine — Topic Discussion Phase
// File: src/abi/kitchenTableEngine.js
//
// ABI module. Capacity-aware topic selection, biometric monitoring
// during engagement, dysregulation detection, journal encryption.
// Feeds topic_response patterns to Family Intelligence.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const crypto = require('crypto');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CAPACITY_RANK = { full: 4, steady: 3, drawing_down: 2, low: 1, depleted: 0 };
const DYSREGULATION_THRESHOLD = 0.30; // 30% HRV drop from session start

// ── TOPIC SELECTION ─────────────────────────────────────────

async function selectTopic(userId, familyUnitId, tenantId) {
  try {
    // 1. Get capacity state
    let capacityState = 'steady';
    try {
      const capacityCurrency = require('./capacityCurrency');
      const balance = await capacityCurrency.getBalance(userId);
      capacityState = balance.state;
    } catch (e) { /* default to steady */ }

    // 2. Skip if low or depleted
    if (capacityState === 'low' || capacityState === 'depleted') {
      return { skip: true, reason: 'low_capacity', proceedToBreath: true };
    }

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [userId]);
    if (userRow.rows.length === 0) return { skip: true, reason: 'user_not_found' };
    const userDbId = userRow.rows[0].id;

    // 3. Get recently completed topics (last 7 days)
    const recent = await pool.query(
      `SELECT topic_id FROM kitchen_table_sessions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days' AND skipped = false`,
      [userDbId]
    );
    const recentTopicIds = recent.rows.map(r => r.topic_id);

    // 4. Get topic sensitivity from family_patterns
    let sensitiveTopics = [];
    if (familyUnitId) {
      try {
        const patterns = await pool.query(
          `SELECT pattern_key, pattern_data FROM family_patterns
           WHERE family_unit_id = $1 AND pattern_type = 'topic_response'
             AND observation_count >= 2`,
          [familyUnitId]
        );
        sensitiveTopics = patterns.rows
          .filter(p => p.pattern_data?.dysregulation_rate > 0.5)
          .map(p => p.pattern_key);
      } catch (e) { /* no patterns yet */ }
    }

    // 5. Query available topics
    const capacityRank = CAPACITY_RANK[capacityState] || 3;
    const minStates = Object.entries(CAPACITY_RANK)
      .filter(([, rank]) => rank <= capacityRank)
      .map(([state]) => state);

    let topics = await pool.query(
      `SELECT * FROM kitchen_table_topics
       WHERE is_active = true
         AND min_capacity_state = ANY($1)
         AND ($2::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $2)
       ORDER BY difficulty_level ASC, RANDOM()`,
      [minStates, tenantId]
    );

    // 6. Filter out recent and sensitive (unless full capacity)
    let available = topics.rows.filter(t => !recentTopicIds.includes(t.id));
    if (capacityState !== 'full') {
      available = available.filter(t => !sensitiveTopics.includes(t.category + ':' + t.title));
    }

    if (available.length === 0) {
      return { skip: true, reason: 'no_available_topics', proceedToBreath: true };
    }

    const selected = available[0];
    return {
      skip: false,
      topic: {
        id: selected.id,
        category: selected.category,
        title: selected.title,
        promptText: selected.prompt_text,
        journalPrompt: selected.journal_prompt,
        difficultyLevel: selected.difficulty_level,
        estimatedMinutes: selected.estimated_minutes
      }
    };
  } catch (err) {
    console.error('[KitchenTable] Topic selection failed:', err.message);
    Sentry.captureException(err);
    return { skip: true, reason: 'error', proceedToBreath: true };
  }
}

// ── SESSION MANAGEMENT ──────────────────────────────────────

async function startSession(userId, familyUnitId, topicId, hrvAtStart) {
  try {
    const userRow = await pool.query('SELECT id, tenant_id FROM users WHERE user_id = $1 OR participant_id = $1', [userId]);
    if (userRow.rows.length === 0) return { error: true, message: 'User not found' };

    const dbUserId = userRow.rows[0].id;

    // Solo-before-co-present gate: family sessions require at least one completed solo session
    if (familyUnitId) {
      const soloCount = await pool.query(
        `SELECT COUNT(*) as count FROM kitchen_table_sessions
         WHERE user_id = $1 AND family_unit_id IS NULL AND completed_at IS NOT NULL`,
        [dbUserId]
      );
      if (parseInt(soloCount.rows[0].count) === 0) {
        return {
          error: true,
          message: 'Your individual practice builds the foundation. Start there first, and the family table will be ready when you are.',
          gate: 'solo_before_co_present'
        };
      }
    }

    const result = await pool.query(
      `INSERT INTO kitchen_table_sessions (user_id, family_unit_id, tenant_id, topic_id, hrv_at_start)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [dbUserId, familyUnitId, userRow.rows[0].tenant_id, topicId, hrvAtStart || null]
    );

    const topic = await pool.query('SELECT title, prompt_text, journal_prompt, estimated_minutes FROM kitchen_table_topics WHERE id = $1', [topicId]);

    return {
      sessionId: result.rows[0].id,
      topic: topic.rows[0] || {},
      hrvAtStart
    };
  } catch (err) {
    console.error('[KitchenTable] Start session failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to start session' };
  }
}

async function recordBiometricTick(sessionId, hrvReading) {
  try {
    const session = await pool.query('SELECT hrv_at_start, hrv_min_during, dysregulation_detected, topic_id, user_id, family_unit_id FROM kitchen_table_sessions WHERE id = $1', [sessionId]);
    if (session.rows.length === 0) return { action: 'none' };

    const s = session.rows[0];
    const hrvStart = parseFloat(s.hrv_at_start) || hrvReading;
    const currentMin = parseFloat(s.hrv_min_during) || hrvReading;

    // Update min
    const newMin = Math.min(currentMin, hrvReading);
    await pool.query('UPDATE kitchen_table_sessions SET hrv_min_during = $1 WHERE id = $2', [newMin, sessionId]);

    // Dysregulation detection: 30% drop from start
    if (!s.dysregulation_detected && hrvStart > 0) {
      const dropPct = (hrvStart - hrvReading) / hrvStart;
      if (dropPct >= DYSREGULATION_THRESHOLD) {
        await pool.query(
          'UPDATE kitchen_table_sessions SET dysregulation_detected = true, dysregulation_timestamp = NOW() WHERE id = $1',
          [sessionId]
        );

        // Feed to Family Intelligence topic_response pattern
        if (s.family_unit_id) {
          try {
            const topic = await pool.query('SELECT category, title FROM kitchen_table_topics WHERE id = $1', [s.topic_id]);
            if (topic.rows.length > 0) {
              const patternKey = topic.rows[0].category + ':' + topic.rows[0].title;
              await pool.query(
                `INSERT INTO family_patterns (family_unit_id, pattern_type, pattern_key, pattern_data)
                 VALUES ($1, 'topic_response', $2, $3)
                 ON CONFLICT (family_unit_id, pattern_type, pattern_key)
                 DO UPDATE SET observation_count = family_patterns.observation_count + 1,
                   pattern_data = jsonb_set(
                     family_patterns.pattern_data,
                     '{dysregulation_rate}',
                     to_jsonb((COALESCE((family_patterns.pattern_data->>'dysregulation_rate')::float, 0) * family_patterns.observation_count + 1) / (family_patterns.observation_count + 1))
                   ),
                   last_observed = NOW()`,
                [s.family_unit_id, patternKey, JSON.stringify({ dysregulation_rate: 1.0, last_hrv_drop: dropPct, user_id: s.user_id })]
              );
            }
          } catch (e) { /* non-blocking pattern update */ }
        }

        return { action: 'dysregulation_detected', suggestion: 'Would you like to move to your breathing session?' };
      }
    }

    return { action: 'none' };
  } catch (err) {
    console.error('[KitchenTable] Biometric tick failed:', err.message);
    Sentry.captureException(err);
    return { action: 'none' };
  }
}

async function completeSession(sessionId, journalEntry) {
  try {
    const session = await pool.query('SELECT * FROM kitchen_table_sessions WHERE id = $1', [sessionId]);
    if (session.rows.length === 0) return { error: true, message: 'Session not found' };
    const s = session.rows[0];

    // Encrypt journal if provided
    let journalEncrypted = null;
    if (journalEntry && journalEntry.trim()) {
      const key = process.env.ART_ENCRYPTION_KEY;
      if (key && key.length >= 64) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
        let enc = cipher.update(journalEntry, 'utf8', 'hex');
        enc += cipher.final('hex');
        journalEncrypted = iv.toString('hex') + ':' + enc;
      }
    }

    const duration = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000);

    await pool.query(
      `UPDATE kitchen_table_sessions
       SET completed_at = NOW(), duration_seconds = $1, journal_encrypted = $2, transitioned_to_breath = true
       WHERE id = $3`,
      [duration, journalEncrypted, sessionId]
    );

    // Capacity Currency: +2 for completion without dysregulation, -3 with dysregulation
    try {
      const capacityCurrency = require('./capacityCurrency');
      const userRow = await pool.query('SELECT user_id FROM users WHERE id = $1', [s.user_id]);
      if (userRow.rows.length > 0) {
        if (s.dysregulation_detected) {
          await capacityCurrency.processWithdrawal(userRow.rows[0].user_id, 'topic_stress', 'moderate', { sessionId, topic_id: s.topic_id });
        } else {
          await capacityCurrency.processTransaction(s.user_id, 'deposit', 2, 'kitchen_table_complete', { sessionId, topic_id: s.topic_id });
        }
      }
    } catch (e) { /* non-blocking */ }

    return { completed: true, proceedToBreath: true, duration, dysregulation: s.dysregulation_detected };
  } catch (err) {
    console.error('[KitchenTable] Complete failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to complete session' };
  }
}

async function skipSession(userId, familyUnitId, reason) {
  try {
    const userRow = await pool.query('SELECT id, tenant_id FROM users WHERE user_id = $1 OR participant_id = $1', [userId]);
    if (userRow.rows.length === 0) return { skipped: true, proceedToBreath: true };

    await pool.query(
      `INSERT INTO kitchen_table_sessions (user_id, family_unit_id, tenant_id, skipped, skip_reason)
       VALUES ($1, $2, $3, true, $4)`,
      [userRow.rows[0].id, familyUnitId, userRow.rows[0].tenant_id, reason || 'user_choice']
    );

    // Feed avoidance pattern to Family Intelligence (user_choice only)
    if (reason === 'user_choice' && familyUnitId) {
      try {
        await pool.query(
          `INSERT INTO family_patterns (family_unit_id, pattern_type, pattern_key, pattern_data)
           VALUES ($1, 'topic_response', $2, $3)
           ON CONFLICT (family_unit_id, pattern_type, pattern_key)
           DO UPDATE SET observation_count = family_patterns.observation_count + 1, last_observed = NOW()`,
          [familyUnitId, 'skip:all_topics', JSON.stringify({ skip_count: 1, user_id: userRow.rows[0].id })]
        );
      } catch (e) { /* non-blocking */ }
    }

    return { skipped: true, proceedToBreath: true };
  } catch (err) {
    console.error('[KitchenTable] Skip failed:', err.message);
    Sentry.captureException(err);
    return { skipped: true, proceedToBreath: true };
  }
}

async function getHistory(userId, limit = 20) {
  try {
    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [userId]);
    if (userRow.rows.length === 0) return [];

    const result = await pool.query(
      `SELECT ks.id, ks.started_at, ks.completed_at, ks.duration_seconds, ks.skipped, ks.skip_reason,
              ks.dysregulation_detected, ks.transitioned_to_breath,
              kt.category, kt.title, kt.difficulty_level
       FROM kitchen_table_sessions ks
       LEFT JOIN kitchen_table_topics kt ON ks.topic_id = kt.id
       WHERE ks.user_id = $1
       ORDER BY ks.created_at DESC LIMIT $2`,
      [userRow.rows[0].id, limit]
    );
    return result.rows;
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

module.exports = { selectTopic, startSession, recordBiometricTick, completeSession, skipSession, getHistory };
