// Run migration 014 — Breath Art columns on session_completions
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const sql = fs.readFileSync(__dirname + '/014_breath_art.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 014 complete');

    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'session_completions'
       AND column_name IN ('art_ipfs_hash', 'art_token_id', 'art_encoding_version', 'crown_id', 'photo_palette', 'intention_hash')
       ORDER BY column_name`
    );
    console.log('Breath Art columns added:', cols.rows.map(x => x.column_name).join(', '), `(${cols.rows.length}/6)`);
  } catch (e) {
    console.error('Migration 014 FAILED:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
