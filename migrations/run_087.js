const { Pool } = require('pg');
const fs = require('fs');
// Local runs go through Railway's PUBLIC TCP proxy (DATABASE_PUBLIC_URL).
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/087_cobreath_params.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 087: Coupling L2 — partnership_sessions.breath_params'); process.exit(0); }).catch(err => { console.error('Migration 087 failed:', err.message); process.exit(1); });
