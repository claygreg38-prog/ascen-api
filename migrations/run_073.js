const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/073_seed_dialogue_s111_s150.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 073: dialogue_phases seeded for s111_s150'); process.exit(0); }).catch(err => { console.error('Migration 073 failed:', err.message); process.exit(1); });
