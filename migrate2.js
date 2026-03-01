// Migration 2 — Create vault_entries and session_progress tables

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate2() {
  const client = await pool.connect();
  try {
    console.log('Starting migration 2...');

    // Create vault_entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vault_entries (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        session_number INTEGER NOT NULL,
        vault_response TEXT NOT NULL,
        session_type VARCHAR(50) DEFAULT 'individual',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('vault_entries table ready');

    // Create session_progress table
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_progress (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        session_number INTEGER NOT NULL,
        completed BOOLEAN DEFAULT true,
        coherence_score NUMERIC(5,2),
        duration_seconds INTEGER,
        session_type VARCHAR(50) DEFAULT 'individual',
        completed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, session_number)
      )
    `);
    console.log('session_progress table ready');

    // Indexes for fast user lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vault_user_id ON vault_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_progress_user_id ON session_progress(user_id);
    `);
    console.log('Indexes created');

    console.log('Migration 2 complete.');
  } catch (err) {
    console.error('Migration 2 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate2();
