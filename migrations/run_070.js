const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/070_seed_dialogue_s16_s40.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 070: dialogue_phases seeded for s16_s40'); process.exit(0); }).catch(err => { console.error('Migration 070 failed:', err.message); process.exit(1); });
