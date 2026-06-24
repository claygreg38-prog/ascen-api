const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/090_one_open_session.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 090: Phase 2 — one_open_session_per_partnership (partial unique index)'); process.exit(0); }).catch(err => { console.error('Migration 090 failed:', err.message); process.exit(1); });
