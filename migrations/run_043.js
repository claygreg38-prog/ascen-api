const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/043_tts_cache.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 043: tts_cache table created'); process.exit(0); }).catch(err => { console.error('Migration 043 failed:', err.message); process.exit(1); });
