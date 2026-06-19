const { Pool } = require('pg');
const fs = require('fs');
// Local runs go through Railway's PUBLIC TCP proxy — the injected DATABASE_URL
// uses postgres.railway.internal, which only resolves inside Railway's network.
// `railway run` injects DATABASE_PUBLIC_URL from the linked service. Prefer it,
// fall back to DATABASE_URL for in-network execution.
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/084_breath_echo.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 084: Breath Echo — legacy_capsules columns + echo_sessions table'); process.exit(0); }).catch(err => { console.error('Migration 084 failed:', err.message); process.exit(1); });
