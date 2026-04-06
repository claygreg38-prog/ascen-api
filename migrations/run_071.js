const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/071_seed_dialogue_s41_s70.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 071: dialogue_phases seeded for s41_s70'); process.exit(0); }).catch(err => { console.error('Migration 071 failed:', err.message); process.exit(1); });
