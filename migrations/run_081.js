const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/081_seed_dev_harness_user.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 081: dev harness user seeded (user_dev_harness)'); process.exit(0); }).catch(err => { console.error('Migration 081 failed:', err.message); process.exit(1); });
