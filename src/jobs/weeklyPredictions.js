// ============================================================
// Weekly Prediction Cron Job — Family Compass
// File: src/jobs/weeklyPredictions.js
//
// Runs every Monday at 6 AM UTC for all Family Compass families.
// Generates relationship predictions with two-tier output.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runAll() {
  let processed = 0;
  let errors = 0;

  try {
    // Get all active Family Compass families
    const families = await pool.query(
      "SELECT family_unit_id FROM family_units WHERE premium_tier = 'family_compass'"
    );

    console.log(`[WeeklyPredictions] Processing ${families.rows.length} Family Compass families`);

    const predictiveRelationship = require('../abi/predictiveRelationship');

    for (const family of families.rows) {
      try {
        const tenantResult = await pool.query(
          'SELECT tenant_id FROM family_units WHERE family_unit_id = $1',
          [family.family_unit_id]
        );
        const tenantId = tenantResult.rows[0]?.tenant_id || null;

        await predictiveRelationship.generatePrediction(family.family_unit_id, tenantId);
        processed++;
      } catch (err) {
        console.error(`[WeeklyPredictions] Failed for family ${family.family_unit_id}:`, err.message);
        errors++;
      }
    }

    console.log(`[WeeklyPredictions] Complete: ${processed} processed, ${errors} errors`);
  } catch (err) {
    console.error('[WeeklyPredictions] Fatal error:', err.message);
  }

  return { processed, errors };
}

module.exports = { runAll };
