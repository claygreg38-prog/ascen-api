const { Pool } = require('pg');
const fs = require('fs');
// Local runs go through Railway's PUBLIC TCP proxy (DATABASE_PUBLIC_URL).
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/086_coupling_gap.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 086: Coupling B2 — partnership_sessions.completed_at'); process.exit(0); }).catch(err => { console.error('Migration 086 failed:', err.message); process.exit(1); });
