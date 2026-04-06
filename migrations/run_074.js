const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/074_seed_dialogue_skipped_sessions.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 074: dialogue_phases seeded for 29 previously-skipped sessions'); process.exit(0); }).catch(err => { console.error('Migration 074 failed:', err.message); process.exit(1); });
