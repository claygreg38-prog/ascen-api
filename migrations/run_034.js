const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '034_v8_session_state.sql'), 'utf8');
  console.log('Running migration 034: V8 session state...');
  await pool.query(sql);
  console.log('Migration 034 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 034 failed:', err.message); process.exit(1); });
