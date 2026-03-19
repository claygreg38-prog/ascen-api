const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '023_tenant_enforcement.sql'), 'utf8');
  console.log('Running migration 023: Tenant Enforcement + AI Usage...');
  await pool.query(sql);
  console.log('Migration 023 complete.');
  await pool.end();
}

run().catch(err => { console.error('Migration 023 failed:', err.message); process.exit(1); });
