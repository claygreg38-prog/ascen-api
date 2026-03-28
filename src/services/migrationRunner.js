// ============================================================
// Migration Runner — Auto-apply pending migrations on startup
// File: src/services/migrationRunner.js
//
// Reads migrations/ directory, compares against schema_migrations
// table, applies unapplied ones in order inside a transaction.
// Never crashes the server — logs errors and continues.
// ============================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function runPendingMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Read all .sql files, sorted by leading number
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    // 3. Get already-applied migrations
    const applied = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    // 4. Find unapplied
    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log('[MIGRATE] All migrations up to date');
      return;
    }

    console.log(`[MIGRATE] ${pending.length} pending migration(s) found`);

    // 5. Apply each in its own transaction (so one failure doesn't block all)
    for (const filename of pending) {
      try {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');

        console.log(`[MIGRATE] Applied ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATE] FAILED ${filename}: ${err.message}`);
        // Don't crash — log and continue to next migration
        // Dependent migrations will likely also fail, which is correct
      }
    }

    console.log('[MIGRATE] Migration run complete');
  } catch (err) {
    console.error('[MIGRATE] Migration runner error:', err.message);
    // Never crash the server
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { runPendingMigrations };
