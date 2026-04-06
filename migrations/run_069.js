const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/069_seed_dialogue_s01_s15.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 069: dialogue_phases seeded for S01-S15'); process.exit(0); }).catch(err => { console.error('Migration 069 failed:', err.message); process.exit(1); });
