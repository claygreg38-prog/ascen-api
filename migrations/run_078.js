const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/078_seed_coupling_dialogue.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 078: dialogue_phases seeded for Coupling C01-C14'); process.exit(0); }).catch(err => { console.error('Migration 078 failed:', err.message); process.exit(1); });
