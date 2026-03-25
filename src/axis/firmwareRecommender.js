// ============================================================
// [AXIS] Firmware Recommender — Armor-targeted firmware selection
// File: src/axis/firmwareRecommender.js
//
// AXIS reads confirmed armors from LACE assessment and recommends
// a firmware sequence. Decision tree math — no AI needed.
//
// Rules:
// 1. Cache Clearing always first (every system needs a restart)
// 2. Score firmware by armor match count
// 3. Respect prerequisites
// 4. Max 3 recommendations at a time
// ============================================================

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function recommendFirmware(userId) {
  try {
    // Get confirmed armors from most recent completed LACE
    const lace = await pool.query(
      "SELECT confirmed_armors, domain_responses FROM lace_assessments WHERE user_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1",
      [userId]
    );

    if (!lace.rows.length) {
      return { recommended: [], reason: 'No completed system scan' };
    }

    const confirmedArmors = (lace.rows[0].confirmed_armors || [])
      .filter(a => a.confirmed)
      .map(a => a.name);

    if (confirmedArmors.length === 0) {
      return { recommended: [], reason: 'No confirmed armors from system scan' };
    }

    // Get already completed firmware (by user)
    const completed = await pool.query(
      'SELECT DISTINCT firmware_number FROM session_completions WHERE user_id = $1 AND firmware_number IS NOT NULL',
      [userId]
    );
    const completedNumbers = new Set(completed.rows.map(r => r.firmware_number));

    // Get all firmware templates
    const templates = await pool.query('SELECT * FROM firmware_templates ORDER BY firmware_number');

    // Score each firmware by armor match
    const scored = templates.rows
      .filter(fw => !completedNumbers.has(fw.firmware_number))
      .map(fw => {
        const targetArmors = fw.target_armors || [];
        let score = 0;

        if (targetArmors.includes('all')) {
          score = 1; // Cache Clearing is always relevant
        } else {
          score = targetArmors.filter(a => confirmedArmors.includes(a)).length;
        }

        // Check prerequisite
        if (fw.prerequisite_firmware) {
          const prereqTemplate = templates.rows.find(t => t.firmware_key === fw.prerequisite_firmware);
          if (prereqTemplate && !completedNumbers.has(prereqTemplate.firmware_number)) {
            score = 0; // Can't recommend without prerequisite
          }
        }

        return { ...fw, match_score: score };
      })
      .filter(fw => fw.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score);

    // Cache Clearing always first if not completed
    if (!completedNumbers.has(1)) {
      const cacheClearing = scored.find(fw => fw.firmware_number === 1);
      if (cacheClearing) {
        const rest = scored.filter(fw => fw.firmware_number !== 1).slice(0, 2);
        return {
          recommended: [cacheClearing, ...rest].map(formatRecommendation),
          reason: 'Cache Clearing first, then armor-targeted firmware',
        };
      }
    }

    return {
      recommended: scored.slice(0, 3).map(formatRecommendation),
      reason: 'Based on your confirmed armor profile',
    };
  } catch (err) {
    console.error('[AXIS/Firmware] Recommendation failed:', err.message);
    Sentry.captureException(err);
    return { recommended: [], reason: 'Recommendation unavailable' };
  }
}

function formatRecommendation(fw) {
  return {
    firmware_number: fw.firmware_number,
    firmware_key: fw.firmware_key,
    name: fw.name,
    description: fw.description,
    target_armors: fw.target_armors,
    match_score: fw.match_score,
    session_count: fw.session_count,
    breath_mode: fw.breath_mode,
    breath_ratio: fw.breath_ratio,
    duration_minutes: fw.duration_minutes,
    luno_opening: fw.luno_opening,
    field_test_prompts: fw.field_test_prompts,
  };
}

async function getFirmwareTemplate(firmwareNumber) {
  const result = await pool.query(
    'SELECT * FROM firmware_templates WHERE firmware_number = $1',
    [firmwareNumber]
  );
  return result.rows[0] || null;
}

async function getFirmwareProgress(userId) {
  const result = await pool.query(
    `SELECT firmware_number, firmware_name, COUNT(*) as sessions_completed,
            MAX(coherence_peak) as best_coherence, MAX(created_at) as last_session
     FROM session_completions
     WHERE user_id = $1 AND firmware_number IS NOT NULL
     GROUP BY firmware_number, firmware_name
     ORDER BY firmware_number`,
    [userId]
  );
  return result.rows;
}

module.exports = { recommendFirmware, getFirmwareTemplate, getFirmwareProgress };
