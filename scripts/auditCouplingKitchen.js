// Read-only audit query — Coupling track + session_templates schema introspection.
// No writes. No connection-string logging.
const { Pool } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(2); }
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });

  try {
    const cols = await pool.query(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_name = 'session_templates'
       ORDER BY ordinal_position
    `);
    console.log('=== session_templates SCHEMA ===');
    for (const r of cols.rows) console.log(`  ${r.column_name}: ${r.data_type}`);

    const colNames = cols.rows.map(r => r.column_name);
    const hasIdCol = colNames.includes('id');
    console.log(`\n  has 'id' column: ${hasIdCol}`);

    if (hasIdCol) {
      const literal = await pool.query(`
        SELECT id, title FROM session_templates
         WHERE id::text LIKE 'C%' ORDER BY id::text
      `).catch(e => ({ error: e.message, rows: [] }));
      console.log(`\n=== USER QUERY: SELECT id,title WHERE id LIKE 'C%' ===`);
      if (literal.error) console.log(`  query errored: ${literal.error}`);
      else console.log(`  rows: ${literal.rows.length}`);
      for (const r of literal.rows) console.log(`  ${r.id} | ${r.title}`);
    } else {
      console.log(`\n  user's literal query (id LIKE 'C%') would error: 'id' is not a column`);
    }

    const coupling = await pool.query(`
      SELECT session_number, track, title,
             (dialogue_phases IS NOT NULL) AS has_dialogue,
             (breath_mode) AS breath_mode,
             (ratio) AS ratio,
             (duration_seconds) AS duration_seconds
        FROM session_templates
       WHERE track = 'coupling'
       ORDER BY session_number
    `);
    console.log(`\n=== COUPLING TRACK ROWS ===`);
    console.log(`  count: ${coupling.rowCount}`);
    for (const r of coupling.rows) {
      console.log(`  ${r.track}/${r.session_number} | "${r.title}" | dialogue=${r.has_dialogue} | breath=${r.breath_mode || '-'} | ratio=${r.ratio || '-'} | dur=${r.duration_seconds || '-'}`);
    }

    const trackBreakdown = await pool.query(`
      SELECT track, COUNT(*) AS n,
             SUM(CASE WHEN dialogue_phases IS NOT NULL THEN 1 ELSE 0 END) AS with_dialogue
        FROM session_templates
       GROUP BY track ORDER BY track NULLS FIRST
    `);
    console.log(`\n=== TRACK BREAKDOWN ===`);
    for (const r of trackBreakdown.rows) {
      console.log(`  ${r.track || '(null)'} : ${r.n} rows, ${r.with_dialogue} with dialogue`);
    }

    const partnershipExists = await pool.query(`
      SELECT to_regclass('partnership_practices') IS NOT NULL AS exists
    `);
    const partnershipCount = await pool.query(`
      SELECT COUNT(*) AS n FROM partnership_practices
    `).catch(() => ({ rows: [{ n: 'TABLE MISSING' }] }));
    console.log(`\n=== partnership_practices ===`);
    console.log(`  table exists: ${partnershipExists.rows[0].exists}`);
    console.log(`  rows: ${partnershipCount.rows[0].n}`);

    const ktSessions = await pool.query(`
      SELECT to_regclass('kitchen_table_sessions') IS NOT NULL AS exists
    `);
    const ktCount = await pool.query(`
      SELECT COUNT(*) AS n FROM kitchen_table_sessions
    `).catch(() => ({ rows: [{ n: 'TABLE MISSING' }] }));
    console.log(`\n=== kitchen_table_sessions ===`);
    console.log(`  table exists: ${ktSessions.rows[0].exists}`);
    console.log(`  rows: ${ktCount.rows[0].n}`);
  } catch (e) {
    console.error('Query failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
