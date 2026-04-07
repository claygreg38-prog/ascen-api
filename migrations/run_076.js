const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/076_ripple_signal.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 076: ripple_signals table created'); process.exit(0); }).catch(err => { console.error('Migration 076 failed:', err.message); process.exit(1); });
