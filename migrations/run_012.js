// Run migration 012 — somatic exercises + personalized closes
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const sql = fs.readFileSync(__dirname + '/012_somatic_and_closes.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 012 complete');

    const ex = await pool.query('SELECT COUNT(*) as c FROM somatic_exercises');
    console.log('Somatic exercises seeded:', ex.rows[0].c);

    const cl = await pool.query('SELECT COUNT(*) as c FROM personalized_closes');
    console.log('Personalized closes:', cl.rows[0].c);

    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'session_completions'
       AND (column_name LIKE 'somatic%' OR column_name LIKE 'personalized%')
       ORDER BY column_name`
    );
    console.log('New columns on session_completions:', cols.rows.map(x => x.column_name).join(', '));
  } catch (e) {
    console.error('Migration 012 FAILED:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
