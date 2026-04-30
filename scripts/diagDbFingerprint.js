#!/usr/bin/env node
// DB fingerprint — runs the SAME SQL the deployed /api/auth/diag/db-fingerprint
// endpoint runs, against process.env.DATABASE_URL.
//
// Run: node scripts/diagDbFingerprint.js
//
// Compare output side-by-side with the API endpoint's JSON response.
// Different db_name / server_ip / user_count / pg_start = different databases.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const dbHost = (process.env.DATABASE_URL || '').match(/@([^:/?]+)/)?.[1] || 'unknown';
  const client = await pool.connect();
  try {
    const fp = await client.query(`
      SELECT
        current_database() AS db_name,
        inet_server_addr()::text AS server_ip,
        inet_server_port() AS server_port,
        (SELECT count(*) FROM users) AS user_count,
        (SELECT count(*) FROM users WHERE email = 'clayg@mettle-works.com') AS clay_row_count,
        (SELECT id FROM users WHERE email = 'clayg@mettle-works.com' LIMIT 1) AS clay_id,
        (SELECT MAX(created_at) FROM auth_audit_log) AS latest_audit_at,
        (SELECT count(*) FROM auth_audit_log WHERE created_at > NOW() - INTERVAL '24 hours') AS audit_24h_count,
        pg_postmaster_start_time() AS pg_start,
        version() AS pg_version
    `);
    const out = { source: 'local_shell', db_host_from_env: dbHost, ...fp.rows[0] };
    console.log(JSON.stringify(out, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
