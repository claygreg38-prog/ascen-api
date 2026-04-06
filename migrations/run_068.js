const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/068_dialogue_phases.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 068: dialogue_phases JSONB column added to session_templates'); process.exit(0); }).catch(err => { console.error('Migration 068 failed:', err.message); process.exit(1); });
