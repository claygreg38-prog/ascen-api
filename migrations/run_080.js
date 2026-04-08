const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/080_seed_capacity_track.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 080: capacity track seeded (5 rows, track=capacity, S0.5-S4.5)'); process.exit(0); }).catch(err => { console.error('Migration 080 failed:', err.message); process.exit(1); });
