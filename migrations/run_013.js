// Run migration 013 — NS3 Engine fields on session_completions
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const sql = fs.readFileSync(__dirname + '/013_ns3_fields.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 013 complete');

    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'session_completions'
       AND column_name IN ('ns3_mean', 'ns3_peak', 'ns3_floor', 'optimal_zone_pct', 'regulatory_trajectory', 'sustained_optimal')
       ORDER BY column_name`
    );
    console.log('NS3 columns added:', cols.rows.map(x => x.column_name).join(', '), `(${cols.rows.length}/6)`);
  } catch (e) {
    console.error('Migration 013 FAILED:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
