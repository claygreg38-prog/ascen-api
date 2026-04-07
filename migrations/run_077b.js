const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sql = fs.readFileSync(__dirname + '/077b_reseed_coupling_c09.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 077b: C09 re-seeded with full 9-phase content'); process.exit(0); }).catch(err => { console.error('Migration 077b failed:', err.message); process.exit(1); });
