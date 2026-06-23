const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/089_echo_abandoned.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 089: Phase E — echo_sessions.abandoned_at'); process.exit(0); }).catch(err => { console.error('Migration 089 failed:', err.message); process.exit(1); });
