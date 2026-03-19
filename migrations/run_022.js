const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '022_kitchen_table_cobreath.sql'), 'utf8');
  console.log('Running migration 022: Kitchen Table + Co-Breath tables...');
  await pool.query(sql);
  console.log('Migration 022 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 022 failed:', err.message); process.exit(1); });
