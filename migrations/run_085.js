const { Pool } = require('pg');
const fs = require('fs');
// Local runs go through Railway's PUBLIC TCP proxy (DATABASE_PUBLIC_URL); the
// injected DATABASE_URL uses the in-network host. Prefer the public proxy locally.
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/085_dv_screening.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 085: Coupling B1 — dv_screening_status on partnership_practices'); process.exit(0); }).catch(err => { console.error('Migration 085 failed:', err.message); process.exit(1); });
