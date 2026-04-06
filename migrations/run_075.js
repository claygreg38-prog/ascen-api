const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/075_fix_fr_contamination_and_seed.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 075: FR contamination cleared + 25 FR sessions seeded from corrected source'); process.exit(0); }).catch(err => { console.error('Migration 075 failed:', err.message); process.exit(1); });
