const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '039_artifact_valuation.sql'), 'utf8');
  console.log('Running migration 039: Artifact Valuation Engine...');
  await pool.query(sql);
  console.log('Migration 039 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 039 failed:', err.message); process.exit(1); });
