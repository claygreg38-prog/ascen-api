const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '038_prevention_impact.sql'), 'utf8');
  console.log('Running migration 038: Prevention Impact Score...');
  await pool.query(sql);
  console.log('Migration 038 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 038 failed:', err.message); process.exit(1); });
