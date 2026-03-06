// ============================================================
// src/db/pool.js — Shared Database Pool
// Single connection pool for the entire application.
// Every module imports this instead of creating its own Pool.
// ============================================================

const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })
  : null;

module.exports = pool;
