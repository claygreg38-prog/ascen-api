const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate2() {
  const client = await pool.connect();
  try {
    console.log('Starting migration 2...');

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
