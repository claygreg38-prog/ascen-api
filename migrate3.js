// migrate3.js — BreathMatch: breath_profiles table
// Run once: node migrate3.js

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  console.log('Running BreathMatch migration...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS breath_profiles (
        id                      SERIAL PRIMARY KEY,
        participant_id          VARCHAR(64) NOT NULL UNIQUE,
        baseline_coherence      FLOAT,
        best_ratio              VARCHAR(32),
        best_mode               VARCHAR(64),
        best_duration_seconds   INT,
        adjustment_factor       FLOAT NOT NULL DEFAULT 1.0,
        best_pathway            VARCHAR(32),
        sessions_analyzed       INT NOT NULL DEFAULT 0,
        last_analyzed_at        TIMESTAMP,
        profile_locked          BOOLEAN NOT NULL DEFAULT false,
        profile_locked_until    TIMESTAMP,
        replay_eligible         BOOLEAN NOT NULL DEFAULT false,
        created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ breath_profiles table created');

    // Index for fast lookups by participant
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_breath_profiles_participant
      ON breath_profiles(participant_id);
    `);
    console.log('✓ Index created');

    console.log('\nBreathMatch migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
