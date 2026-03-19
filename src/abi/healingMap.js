// ============================================================
// [ABI] Multi-Generational Healing Map
// File: src/abi/healingMap.js
//
// Sonnet-powered visualization of intergenerational patterns.
// Genealogy data is optional and user-provided — system never
// infers genealogy.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GENERATE MAP ────────────────────────────────────────────

async function generateMap(familyUnitId, genealogyInput, tenantId) {
  const aiRouter = require('../services/aiRouter');

  try {
    // Gather current generation data
    const parentPatterns = await getParentPatterns(familyUnitId);
    const breakingPatterns = await getBreakingPatterns(familyUnitId);
    const childEngagement = await getChildEngagement(familyUnitId);
    const capsuleCount = await getCapsuleCount(familyUnitId);

    const result = await aiRouter.route('predictive_analysis', `
      Analyze this family's multi-generational healing journey.

      Known generational data:
      ${JSON.stringify(genealogyInput || 'Not provided — use only current generation data')}

      Current generation patterns:
      - Parent identified patterns: ${JSON.stringify(parentPatterns)}
      - Patterns showing change: ${JSON.stringify(breakingPatterns)}
      - Child engagement evidence: ${JSON.stringify(childEngagement)}
      - Legacy capsules created: ${capsuleCount}

      Generate a healing map with:
      1. generations: array of generation nodes with name, generation_level (0=current, 1=parent, 2=grandparent),
         patterns_identified (array), patterns_broken (array), healing_indicators (array)
      2. pattern_threads: array of patterns traced across generations with:
         pattern_name, origin_generation (level), status ("active"|"breaking"|"broken"), evidence (text)
      3. visualization_data: { layout: "vertical", nodes: [{id, label, level, x, y}], edges: [{from, to, pattern, color}] }

      If genealogy data is not provided, focus on the current generation with inferred
      patterns from the parent's relational behavior. Do NOT fabricate genealogy.

      Respond ONLY with valid JSON.
    `, {
      maxTokens: 2000,
      temperature: 0.6,
      tenantId
    });

    let mapData;
    try {
      mapData = JSON.parse(result?.content || '{}');
    } catch {
      mapData = {
        generations: [{ name: 'Current Family', generation_level: 0, patterns_identified: [], patterns_broken: [], healing_indicators: ['Engagement with healing platform'] }],
        pattern_threads: [],
        visualization_data: { layout: 'vertical', nodes: [{ id: '0', label: 'Current Family', level: 0, x: 50, y: 80 }], edges: [] }
      };
    }

    // Check if map exists, update or create
    const existing = await pool.query(
      'SELECT id FROM family_healing_maps WHERE family_unit_id = $1',
      [familyUnitId]
    );

    let mapId;
    if (existing.rows.length > 0) {
      mapId = existing.rows[0].id;
      await pool.query(
        `UPDATE family_healing_maps SET
           generations = $1, pattern_threads = $2, visualization_data = $3,
           genealogy_data = COALESCE($4, genealogy_data), last_updated = NOW()
         WHERE id = $5`,
        [JSON.stringify(mapData.generations), JSON.stringify(mapData.pattern_threads),
         JSON.stringify(mapData.visualization_data),
         genealogyInput ? JSON.stringify(genealogyInput) : null, mapId]
      );
    } else {
      const insertResult = await pool.query(
        `INSERT INTO family_healing_maps
         (family_unit_id, tenant_id, generations, pattern_threads, visualization_data, genealogy_data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [familyUnitId, tenantId, JSON.stringify(mapData.generations),
         JSON.stringify(mapData.pattern_threads), JSON.stringify(mapData.visualization_data),
         genealogyInput ? JSON.stringify(genealogyInput) : null]
      );
      mapId = insertResult.rows[0].id;
    }

    console.log(`[HealingMap] Map generated/updated for family ${familyUnitId}`);

    return { mapId, ...mapData };
  } catch (err) {
    console.error('[HealingMap] generateMap failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to generate healing map' };
  }
}

// ── GET MAP ─────────────────────────────────────────────────

async function getMap(familyUnitId) {
  try {
    const result = await pool.query(
      'SELECT * FROM family_healing_maps WHERE family_unit_id = $1 ORDER BY last_updated DESC LIMIT 1',
      [familyUnitId]
    );
    return result.rows[0] || null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ── SUBMIT GENEALOGY ────────────────────────────────────────

async function submitGenealogy(familyUnitId, genealogyData, tenantId) {
  try {
    const existing = await pool.query(
      'SELECT id FROM family_healing_maps WHERE family_unit_id = $1',
      [familyUnitId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE family_healing_maps SET genealogy_data = $1, last_updated = NOW() WHERE id = $2',
        [JSON.stringify(genealogyData), existing.rows[0].id]
      );
      return { mapId: existing.rows[0].id, genealogyStored: true };
    }

    // Create minimal map with genealogy — full generation will happen on generateMap
    const result = await pool.query(
      `INSERT INTO family_healing_maps
       (family_unit_id, tenant_id, generations, genealogy_data)
       VALUES ($1, $2, '[]', $3)
       RETURNING id`,
      [familyUnitId, tenantId, JSON.stringify(genealogyData)]
    );

    return { mapId: result.rows[0].id, genealogyStored: true };
  } catch (err) {
    console.error('[HealingMap] submitGenealogy failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to store genealogy' };
  }
}

// ── HELPERS ─────────────────────────────────────────────────

async function getParentPatterns(familyUnitId) {
  try {
    const result = await pool.query(
      `SELECT pattern_type, pattern_key, pattern_data, observation_count
       FROM family_patterns WHERE family_unit_id = $1 AND observation_count >= 2`,
      [familyUnitId]
    );
    return result.rows.map(r => ({
      type: r.pattern_type,
      key: r.pattern_key,
      observations: r.observation_count,
      summary: r.pattern_data
    }));
  } catch { return []; }
}

async function getBreakingPatterns(familyUnitId) {
  try {
    // Patterns that show improvement (positive trend in resolution, engagement)
    const conflicts = await pool.query(
      `SELECT resolution_outcome, COUNT(*) as count
       FROM conflict_events WHERE family_unit_id = $1
       GROUP BY resolution_outcome`,
      [familyUnitId]
    );
    const patterns = [];
    const outcomes = {};
    conflicts.rows.forEach(r => { outcomes[r.resolution_outcome] = parseInt(r.count); });
    if ((outcomes.resolved || 0) > (outcomes.ongoing || 0)) {
      patterns.push({ pattern: 'conflict_resolution', status: 'breaking', evidence: 'More conflicts resolved than ongoing' });
    }
    return patterns;
  } catch { return []; }
}

async function getChildEngagement(familyUnitId) {
  try {
    const messages = await pool.query(
      `SELECT COUNT(*) as count FROM facilitated_messages
       WHERE family_unit_id = $1 AND sender_type = 'child' AND delivered_at IS NOT NULL`,
      [familyUnitId]
    );
    return {
      messages_sent: parseInt(messages.rows[0]?.count) || 0,
      engaged: (parseInt(messages.rows[0]?.count) || 0) > 0
    };
  } catch { return { messages_sent: 0, engaged: false }; }
}

async function getCapsuleCount(familyUnitId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM legacy_capsules lc
       JOIN users u ON lc.creator_participant_id = u.participant_id
       JOIN family_memberships fm ON fm.user_id = u.id
       WHERE fm.family_unit_id = $1`,
      [familyUnitId]
    );
    return parseInt(result.rows[0]?.count) || 0;
  } catch { return 0; }
}

module.exports = {
  generateMap,
  getMap,
  submitGenealogy
};
