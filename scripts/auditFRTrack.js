// Read-only FR track audit query — content correction status check.
const { Pool } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });

  try {
    const userQuery = await pool.query(`
      SELECT session_number, title, LEFT(dialogue_phases::text, 200) AS dialogue_preview
        FROM session_templates
       WHERE track='fr_apprentice'
       ORDER BY session_number LIMIT 5
    `);
    console.log('=== FR USER QUERY (first 5) ===');
    for (const r of userQuery.rows) {
      console.log(`\nFR${r.session_number} | "${r.title}"`);
      console.log(`  ${r.dialogue_preview}...`);
    }

    const fullCount = await pool.query(`
      SELECT COUNT(*) AS n,
             SUM(CASE WHEN dialogue_phases IS NOT NULL THEN 1 ELSE 0 END) AS with_dialogue,
             SUM(CASE WHEN family_recording_prompt = true THEN 1 ELSE 0 END) AS with_recording_prompt,
             SUM(CASE WHEN yaml_data IS NOT NULL THEN 1 ELSE 0 END) AS with_yaml_data,
             SUM(CASE WHEN abi_mode IS NOT NULL THEN 1 ELSE 0 END) AS with_abi_mode,
             SUM(CASE WHEN coherence_target IS NOT NULL THEN 1 ELSE 0 END) AS with_coh_target,
             SUM(CASE WHEN station_unlock IS NOT NULL THEN 1 ELSE 0 END) AS with_station,
             COUNT(DISTINCT arc) AS distinct_arcs,
             array_agg(DISTINCT arc ORDER BY arc) AS arcs
        FROM session_templates
       WHERE track='fr_apprentice'
    `);
    console.log('\n=== FR TRACK FULL TOTALS ===');
    console.log(`  rows: ${fullCount.rows[0].n}`);
    console.log(`  with_dialogue: ${fullCount.rows[0].with_dialogue}`);
    console.log(`  with_recording_prompt: ${fullCount.rows[0].with_recording_prompt}`);
    console.log(`  with_yaml_data: ${fullCount.rows[0].with_yaml_data}`);
    console.log(`  with_abi_mode: ${fullCount.rows[0].with_abi_mode}`);
    console.log(`  with_coherence_target: ${fullCount.rows[0].with_coh_target}`);
    console.log(`  with_station_unlock: ${fullCount.rows[0].with_station}`);
    console.log(`  distinct_arcs: ${fullCount.rows[0].distinct_arcs}`);
    console.log(`  arcs: ${JSON.stringify(fullCount.rows[0].arcs)}`);

    const recordingPromptRows = await pool.query(`
      SELECT session_number, title, family_recording_prompt
        FROM session_templates
       WHERE track='fr_apprentice'
         AND family_recording_prompt = true
       ORDER BY session_number
    `);
    console.log(`\n=== FR ROWS WITH family_recording_prompt = true ===`);
    console.log(`  count: ${recordingPromptRows.rowCount}`);
    for (const r of recordingPromptRows.rows) {
      console.log(`  FR${r.session_number} | ${r.title} | flag=${r.family_recording_prompt}`);
    }

    // Check for any FR-receiver / invite tables
    const tables = ['ripple_signals', 'fr_invites', 'family_recordings', 'fr_receivers', 'invites'];
    console.log('\n=== TABLE EXISTENCE ===');
    for (const t of tables) {
      const r = await pool.query(`SELECT to_regclass($1) AS r`, [t]);
      console.log(`  ${t}: ${r.rows[0].r ? 'EXISTS' : 'MISSING'}`);
    }

    // Ripple signal usage
    const rippleRows = await pool.query(`SELECT COUNT(*) AS n, status FROM ripple_signals GROUP BY status`).catch(() => ({ rows: [] }));
    console.log(`\n=== ripple_signals BY STATUS ===`);
    if (rippleRows.rows.length === 0) console.log('  (no rows)');
    else for (const r of rippleRows.rows) console.log(`  ${r.status}: ${r.n}`);

    // Check FR contamination cleanup — does FR01 dialogue still contain foundation-track phrases?
    const contaminationCheck = await pool.query(`
      SELECT session_number, title,
             dialogue_phases::text ILIKE '%session 1%' AS has_session_1_phrase,
             dialogue_phases::text ILIKE '%foundation%' AS has_foundation_phrase,
             dialogue_phases::text ILIKE '%for you%' AS has_fr_voice_phrase
        FROM session_templates
       WHERE track='fr_apprentice' AND session_number = 1
    `);
    console.log(`\n=== FR01 VOICE CHECK ===`);
    if (contaminationCheck.rows[0]) {
      const r = contaminationCheck.rows[0];
      console.log(`  contains "session 1" phrase: ${r.has_session_1_phrase}`);
      console.log(`  contains "foundation" phrase: ${r.has_foundation_phrase}`);
      console.log(`  contains "for you" phrase: ${r.has_fr_voice_phrase}`);
    }
  } catch (e) {
    console.error('Query failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
