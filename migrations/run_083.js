const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/083_ns3_snapshots.sql', 'utf8');
pool.query(sql).then(r => { console.log('✓ Migration 083: ns3_snapshots table created'); process.exit(0); }).catch(err => { console.error('Migration 083 failed:', err.message); process.exit(1); });
