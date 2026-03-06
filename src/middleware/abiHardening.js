// ============================================================
// abiHardening.js — Production Hardening
// Rate limiter, input validation, audit logging,
// 42 CFR Part 2 guard, session cleanup, graceful degradation
// ============================================================

const { Pool } = require('pg');

// ── 1. RATE LIMITER ─────────────────────────────────────────
const rateLimitStore = new Map();

function rateLimiter(opts = {}) {
  const windowMs = opts.windowMs || 60000;
  const max = opts.max || 100;
  const keyFn = opts.keyFn || ((req) => req.ip);

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    if (entry.count > max) {
      return res.status(429).json({ error: 'Rate limit exceeded', retry_after: Math.ceil((entry.resetAt - now) / 1000) });
    }
    next();
  };
}

// ── 2. INPUT VALIDATION ─────────────────────────────────────
function validateBiometrics(req, res, next) {
  const bio = req.body.biometrics;
  if (!bio) return next();

  // Biometric range checks
  if (bio.heart_rate !== undefined && (bio.heart_rate < 30 || bio.heart_rate > 220)) {
    return res.status(400).json({ error: 'heart_rate out of range (30-220)' });
  }
  if (bio.respiratory_rate !== undefined && (bio.respiratory_rate < 4 || bio.respiratory_rate > 60)) {
    return res.status(400).json({ error: 'respiratory_rate out of range (4-60)' });
  }
  if (bio.coherence !== undefined && (bio.coherence < 0 || bio.coherence > 1)) {
    return res.status(400).json({ error: 'coherence out of range (0-1)' });
  }
  if (bio.hrv !== undefined && (bio.hrv < 0 || bio.hrv > 300)) {
    return res.status(400).json({ error: 'hrv out of range (0-300)' });
  }

  next();
}

// ── 3. AUDIT LOGGER (42 CFR Part 2) ─────────────────────────
let auditPool = null;

function initAuditPool() {
  if (!auditPool && process.env.DATABASE_URL) {
    auditPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
  }
}

function auditLogger(req, res, next) {
  if (!process.env.DATABASE_URL) return next();
  initAuditPool();

  const originalEnd = res.end;
  res.end = function (...args) {
    // Log access asynchronously — never block the response
    if (auditPool) {
      auditPool.query(
        `INSERT INTO audit_log (method, path, user_agent, ip, status_code, logged_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [req.method, req.path, (req.headers['user-agent'] || '').substring(0, 255), req.ip, res.statusCode]
      ).catch(() => {}); // Non-blocking
    }
    originalEnd.apply(res, args);
  };
  next();
}

// ── 4. CFR GUARD ────────────────────────────────────────────
// Strips vault/protected data from non-clinical routes
const PROTECTED_FIELDS = ['vault_entries', 'vault_content', 'vault_text', 'therapy_notes', 'clinical_notes'];

function cfrGuard(req, res, next) {
  // Only apply to court/compliance endpoints
  if (!req.path.includes('/court') && !req.path.includes('/compliance')) {
    return next();
  }

  const originalJson = res.json;
  res.json = function (data) {
    if (typeof data === 'object' && data !== null) {
      const stripped = stripProtectedFields(data);
      return originalJson.call(this, stripped);
    }
    return originalJson.call(this, data);
  };
  next();
}

function stripProtectedFields(obj) {
  if (Array.isArray(obj)) return obj.map(stripProtectedFields);
  if (typeof obj !== 'object' || obj === null) return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PROTECTED_FIELDS.includes(key)) continue;
    result[key] = typeof value === 'object' ? stripProtectedFields(value) : value;
  }
  return result;
}

// ── 5. SESSION CLEANUP ──────────────────────────────────────
// Runs every 15 minutes, removes stale sessions
function startSessionCleanup(activeSessions, intervalMs = 900000) {
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    let cleaned = 0;
    activeSessions.forEach((data, key) => {
      if (now - data.lastActivity > staleThreshold) {
        activeSessions.delete(key);
        cleaned++;
      }
    });
    if (cleaned > 0) console.log(`[Cleanup] Removed ${cleaned} stale sessions`);
  }, intervalMs);
}

// ── 6. GRACEFUL DEGRADATION ─────────────────────────────────
function gracefulDegradation(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  // Database errors — don't crash the server
  if (err.code === 'ECONNREFUSED' || err.code === '57P01') {
    return res.status(503).json({ error: 'Database temporarily unavailable', retry: true });
  }

  // Orchestrator errors — return degraded response
  if (req.path.includes('/abi/session')) {
    return res.status(500).json({ error: 'Session error', degraded: true, message: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
}

// ── 7. DEEP HEALTH CHECK ────────────────────────────────────
async function deepHealthCheck(pool) {
  const checks = { database: 'unknown', tables: 'unknown', sessions: 'unknown' };

  try {
    await pool.query('SELECT 1');
    checks.database = 'connected';
  } catch (err) {
    checks.database = 'error: ' + err.message;
  }

  try {
    const tables = await pool.query(`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`);
    checks.tables = parseInt(tables.rows[0].count);
  } catch (err) {
    checks.tables = 'error';
  }

  try {
    const sessions = await pool.query(`SELECT COUNT(*) as count FROM session_templates`);
    checks.sessions = parseInt(sessions.rows[0].count);
  } catch (err) {
    checks.sessions = 'error';
  }

  return checks;
}

module.exports = {
  rateLimiter,
  validateBiometrics,
  auditLogger,
  cfrGuard,
  startSessionCleanup,
  gracefulDegradation,
  deepHealthCheck
};
