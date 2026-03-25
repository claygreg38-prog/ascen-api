const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/044_family_design.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 044: heritage_price_sessions, family_blueprints, sandbox_sessions, vision_board_entries, preset_scenarios created'); process.exit(0); }).catch(err => { console.error('Migration 044 failed:', err.message); process.exit(1); });
