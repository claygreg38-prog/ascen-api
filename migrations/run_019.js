const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '019_capacity_currency.sql'), 'utf8');
  console.log('Running migration 019: Capacity Currency tables...');
  await pool.query(sql);
  console.log('Migration 019 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 019 failed:', err.message); process.exit(1); });
