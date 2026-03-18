const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '015_cocreation_social.sql'), 'utf8');
  console.log('Running migration 015: Co-Creation & Social tables...');
  await pool.query(sql);
  console.log('Migration 015 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 015 failed:', err.message); process.exit(1); });
