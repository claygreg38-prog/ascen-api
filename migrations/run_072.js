const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/072_seed_dialogue_s71_s110.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 072: dialogue_phases seeded for s71_s110'); process.exit(0); }).catch(err => { console.error('Migration 072 failed:', err.message); process.exit(1); });
