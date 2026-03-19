const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '017_art_aggregation.sql'), 'utf8');
  console.log('Running migration 017: Art Aggregation & Key Audit tables...');
  await pool.query(sql);
  console.log('Migration 017 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 017 failed:', err.message); process.exit(1); });
