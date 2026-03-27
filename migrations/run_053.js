const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync(__dirname + '/053_clinical_kitchen_table.sql', 'utf8');
pool.query(sql).then(() => { console.log('✓ Migration 053: kitchen_table_prompt_impacts, kitchen_table_communication, kitchen_table_coaching_logs created + impact_monitoring column added'); process.exit(0); }).catch(err => { console.error('Migration 053 failed:', err.message); process.exit(1); });
