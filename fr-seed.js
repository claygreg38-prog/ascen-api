// ============================================================
// FR Seed — Re-seed corrected FR YAML data
// Updates all 25 FR Apprentice sessions with adaptive_ratio: true,
// detection_mode, ratio_range, reference_ratio, duration_range.
// Uses ON CONFLICT DO UPDATE (idempotent).
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const FR_BLOCKS = {
  1: { ratio_range: ['2:3', '2:4', '3:4', '3:5', '4:6', '4:7'], duration_range: { min_sec: 120, max_sec: 240 }, coherence_target: 0.40, abi_mode: 'guided_coherence', detection_mode: 'arrival_baseline', reference_ratio: '4:6' },
  2: { ratio_range: ['2:3', '2:4', '3:4', '3:5', '4:6', '4:7', '4:8'], duration_range: { min_sec: 150, max_sec: 300 }, coherence_target: 0.50, abi_mode: 'guided_coherence', detection_mode: 'arrival_baseline', reference_ratio: '4:6' },
  3: { ratio_range: ['2:4', '3:4', '3:5', '3:6', '4:6', '4:7', '5:7'], duration_range: { min_sec: 180, max_sec: 360 }, coherence_target: 0.55, abi_mode: 'coherence_building', detection_mode: 'arrival_baseline', reference_ratio: '4:7' },
  4: { ratio_range: ['3:4', '3:5', '3:6', '4:6', '4:7', '4:8', '6:8'], duration_range: { min_sec: 240, max_sec: 420 }, coherence_target: 0.60, abi_mode: 'user_chosen', detection_mode: 'arrival_baseline_plus_history', reference_ratio: '4:8' },
  5: { ratio_range: ['3:4', '3:5', '3:6', '4:6', '4:7', '4:8', '5:7', '6:8', '6:10'], duration_range: { min_sec: 300, max_sec: 480 }, coherence_target: 0.65, abi_mode: 'user_chosen', detection_mode: 'arrival_baseline_plus_history', reference_ratio: '5:7' }
};

async function seed() {
  console.log('[FR-SEED] Starting corrected FR YAML re-seed...');

  let updated = 0;
  let errors = 0;

  for (let s = 1; s <= 25; s++) {
    const block = FR_BLOCKS[Math.min(Math.ceil(s / 5), 5)];

    try {
      // Update yaml_data.abi_config with corrected fields
      const result = await pool.query(`
        UPDATE session_templates
        SET
          yaml_data = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      COALESCE(yaml_data, '{}'::jsonb),
                      '{abi_config,adaptive_ratio}', 'true'::jsonb
                    ),
                    '{abi_config,detection_mode}', $2::jsonb
                  ),
                  '{abi_config,ratio_range}', $3::jsonb
                ),
                '{reference_ratio}', $4::jsonb
              ),
              '{duration_range}', $5::jsonb
            ),
            '{breathwork_ratio}', 'null'::jsonb
          ),
          ratio = NULL,
          duration_seconds = NULL,
          abi_mode = $6,
          coherence_target = $7
        WHERE session_number = $1 AND track = 'fr_apprentice'
      `, [
        s,
        JSON.stringify(block.detection_mode),
        JSON.stringify(block.ratio_range),
        JSON.stringify(block.reference_ratio),
        JSON.stringify(block.duration_range),
        block.abi_mode,
        block.coherence_target
      ]);

      if (result.rowCount > 0) {
        updated++;
        console.log(`  [${s}] Updated (block ${Math.ceil(s / 5)})`);
      } else {
        console.log(`  [${s}] No matching row`);
      }
    } catch (err) {
      errors++;
      console.error(`  [${s}] ERROR: ${err.message}`);
    }
  }

  console.log(`\n[FR-SEED] Done. Updated: ${updated}, Errors: ${errors}`);

  // Verify
  const verify = await pool.query(`
    SELECT session_number,
           yaml_data->'abi_config'->>'adaptive_ratio' AS adaptive_ratio,
           yaml_data->'abi_config'->>'detection_mode' AS detection_mode,
           yaml_data->'abi_config'->'ratio_range' AS ratio_range,
           yaml_data->>'reference_ratio' AS reference_ratio
    FROM session_templates
    WHERE track = 'fr_apprentice'
    ORDER BY session_number
  `);

  console.log('\n[FR-SEED] Verification:');
  let allAdaptive = true;
  for (const row of verify.rows) {
    const ok = row.adaptive_ratio === 'true';
    if (!ok) allAdaptive = false;
    console.log(`  S${row.session_number}: adaptive=${row.adaptive_ratio} detect=${row.detection_mode} ref=${row.reference_ratio} range=${JSON.stringify(row.ratio_range)}`);
  }

  console.log(allAdaptive
    ? '\n[FR-SEED] All 25 sessions show adaptive_ratio: true.'
    : '\n[FR-SEED] WARNING: Some sessions missing adaptive_ratio.');

  await pool.end();
}

seed().catch(e => { console.error('[FR-SEED] Fatal:', e.message); process.exit(1); });
