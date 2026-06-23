const { Pool } = require('pg');
const fs = require('fs');
// Local runs go through Railway's PUBLIC TCP proxy (DATABASE_PUBLIC_URL).
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/088_cobreath_abandoned.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 088: Coupling L4 — partnership_sessions.abandoned_at'); process.exit(0); }).catch(err => { console.error('Migration 088 failed:', err.message); process.exit(1); });
