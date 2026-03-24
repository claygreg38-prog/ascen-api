const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '037_blockchain_columns.sql'), 'utf8');
  console.log('Running migration 037: Blockchain tracking columns...');
  await pool.query(sql);
  console.log('Migration 037 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 037 failed:', err.message); process.exit(1); });
