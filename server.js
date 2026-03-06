 const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── DATABASE ────────────────────────────────────────────────
// Declared FIRST so all middleware and routes can reference it
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

// ── HARDENING MIDDLEWARE ────────────────────────────────────
const {
  rateLimiter, validateABI, auditLogger, cfrGuard,
  createResilientPool, createHealthCheck
} = require('./src/middleware/abiHardening');

// ── AUTH MIDDLEWARE ─────────────────────────────────────────
const {
  authenticate,
  requireRole,
  authenticateOrApiKey,
  optionalAuth,
  authRoutes
} = require('./src/middleware/auth');

// DB resilience — retry transient connection failures
if (pool) createResilientPool(pool);

// CORS — allow frontend origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['*'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-session-key, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (public — token generation, verification)
// ═══════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes);

// ═══════════════════════════════════════════════════════════════
// ABI ROUTES — Session lifecycle, clinical, admin
// ═══════════════════════════════════════════════════════════════
const abiRoutes = require('./src/routes/abiRoutes');

// Hardening on all ABI routes
app.use('/api/abi', rateLimiter);
app.use('/api/abi', validateABI);
app.use('/api/abi', auditLogger);

// Session lifecycle — accepts JWT or API key (transition period)
// Participants use JWT, legacy frontend uses API key
app.use('/api/abi/session', authenticateOrApiKey('participant'));

// Clinical routes — requires clinician role + 42 CFR Part 2 guard
app.use('/api/abi/clinical', authenticateOrApiKey('clinician'));
app.use('/api/abi/clinical', cfrGuard);

// Admin routes — requires admin role
app.use('/api/abi/admin', authenticateOrApiKey('admin'));

// Drill routes — accepts JWT or API key
app.use('/api/abi/drills', authenticateOrApiKey('participant'));

// Health — public (no auth)
// /api/abi/health is handled by abiRoutes, no auth middleware above it

app.use('/api/abi', abiRoutes);

// ═══════════════════════════════════════════════════════════════
// AXIS ROUTES — Brain stem analytics
// ═══════════════════════════════════════════════════════════════
const axisRoutes = require('./src/routes/axisRoutes');

// Dashboard/protocols/insights — clinician or above
app.use('/api/axis/dashboard', authenticateOrApiKey('clinician'));
app.use('/api/axis/protocols', authenticateOrApiKey('clinician'));
app.use('/api/axis/insights', authenticateOrApiKey('clinician'));
app.use('/api/axis/difficulty-map', authenticateOrApiKey('clinician'));
app.use('/api/axis/refinement-history', authenticateOrApiKey('clinician'));
app.use('/api/axis/context', authenticateOrApiKey('clinician'));
app.use('/api/axis/user', authenticateOrApiKey('clinician'));

// Refinement trigger — admin only
app.use('/api/axis/refine', authenticateOrApiKey('admin'));
app.use('/api/axis/ingest', authenticateOrApiKey('admin'));

// Health — public
// /api/axis/health has no auth middleware

app.use('/api/axis', axisRoutes);

// ═══════════════════════════════════════════════════════════════
// CAPACITY INTAKE ROUTES
// ═══════════════════════════════════════════════════════════════
const capacityIntakeRoutes = require('./src/routes/capacityIntake');
app.use('/api', capacityIntakeRoutes);


// ═══════════════════════════════════════════════════════════════
// EXISTING ROUTES
// ═══════════════════════════════════════════════════════════════

// ── Health (public) ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'no DATABASE_URL set';
  if (pool) {
    try { await pool.query('SELECT 1'); dbStatus = 'connected'; }
    catch (e) { dbStatus = 'error: ' + e.message; }
  }
  res.json({
    status: 'healthy',
    message: 'CHOS + AOT System Online',
    timestamp: new Date().toISOString(),
    system: 'Maryland AOT Ready',
    database: dbStatus,
    abi_version: '2.1 — 14/14 systems wired',
    auth: 'JWT + API key (transition)',
    hardening: 'rate_limit + validation + audit + cfr_guard + db_resilience'
  });
});

app.get('/api/health/deep', createHealthCheck(pool));

app.get('/', (req, res) => {
  res.json({
    system: 'CHOS + AOT Unified System',
    status: 'Live and Ready',
    abi: '14/14 systems connected',
    auth: 'JWT required on clinical/admin routes',
    routes: {
      auth_token: 'POST /api/auth/token',
      auth_verify: 'GET /api/auth/verify',
      health: '/api/health',
      abi_health: '/api/abi/health',
      abi_session: '/api/abi/session/* (JWT or API key)',
      abi_clinical: '/api/abi/clinical/* (clinician+)',
      abi_admin: '/api/abi/admin/* (admin only)',
      axis_dashboard: '/api/axis/dashboard (clinician+)',
      axis_refine: 'POST /api/axis/refine (admin only)',
      axis_health: '/api/axis/health',
      sessions: '/api/sessions',
    }
  });
});

// ── Schema (dev only) ───────────────────────────────────────
app.get('/api/schema', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Schema endpoint disabled in production' });
  }
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    const tableNames = tables.rows.map(r => r.table_name);
    const columns = {};
    for (const t of tableNames) {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
      columns[t] = cols.rows;
    }
    res.json({ tables: tableNames, columns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sessions (public — curriculum browsing) ─────────────────
app.get('/api/sessions', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const result = await pool.query('SELECT session_number, title, arc, breath_mode, ratio, duration_seconds FROM session_templates ORDER BY session_number ASC');
    res.json({ count: result.rows.length, sessions: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const { id } = req.params;
    const num = parseInt(id.replace(/\D/g, '')) || 1;
    const result = await pool.query('SELECT * FROM session_templates WHERE session_number = $1', [num]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Clinical dashboard (legacy — requires auth) ─────────────
app.get('/api/clinical/dashboard', authenticateOrApiKey('clinician'), (req, res) => {
  res.json({
    participants: [
      { id: 'p001', name: 'Marcus J.', compliance: 89, status: 'Engaged', sessions_completed: 24 },
      { id: 'p002', name: 'Kevin T.', compliance: 61, status: 'Needs Support', sessions_completed: 12 }
    ],
    metrics: { total_participants: 12, avg_compliance: 78, sessions_this_week: 45 },
    note: 'For real-time ABI clinical data, use /api/abi/clinical/profile/:userId',
    timestamp: new Date().toISOString()
  });
});

// ── Court participants (legacy — requires auth + 42 CFR) ────
app.get('/api/court/participants', authenticateOrApiKey('clinician'), (req, res) => {
  res.json({
    participants: [
      { id: 'p001', initials: 'M.J.', compliance_rate: 89 },
      { id: 'p002', initials: 'K.T.', compliance_rate: 61 }
    ],
    compliance_note: 'Protected per 42 CFR Part 2',
    timestamp: new Date().toISOString()
  });
});

// ── LightBridge ─────────────────────────────────────────────
app.get('/api/lightbridge/activate', (req, res) => {
  res.json({ message: 'LightBridge Family Connection System', system_status: 'Ready', timestamp: new Date().toISOString() });
});

app.post('/api/lightbridge/activate', authenticateOrApiKey('participant'), (req, res) => {
  res.json({ activation_id: 'lb_' + Date.now(), participant_id: req.body.participant_id, connection_established: true, timestamp: new Date().toISOString() });
});

// ── Blockchain verification ─────────────────────────────────
app.post('/api/blockchain/verify-session', authenticateOrApiKey('participant'), async (req, res) => {
  try {
    const { participantId, sessionNumber, sessionType, durationMinutes, coherenceScore, breathCount, familyWitnessed, notes } = req.body;
    fetch('https://mettle-verifcation-ledger-production.up.railway.app/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, sessionNumber, sessionType, durationMinutes, coherenceScore, breathCount, familyWitnessed, notes })
    }).catch(err => console.error('Blockchain verify error:', err));
    res.json({ success: true, message: 'Session queued for blockchain verification', participantId, sessionNumber, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// SERVER START + CRON
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
  console.log('ABI: 14/14 systems wired | AXIS: active | Auth: JWT + API key');
  console.log('Hardening: rate_limit + validation + audit + cfr_guard');
});

// ── AXIS NIGHTLY REFINEMENT CRON ────────────────────────────
let isRefinementRunning = false;

if (process.env.ENABLE_AXIS_CRON === 'true') {
  const cronSchedule = process.env.AXIS_CRON_SCHEDULE || '0 2 * * *';

  cron.schedule(cronSchedule, async () => {
    if (isRefinementRunning) {
      console.log('[AXIS CRON] Skipping: previous cycle still running.');
      return;
    }

    isRefinementRunning = true;
    console.log('[AXIS CRON] Starting nightly refinement cycle...');
    const startTime = Date.now();
    let cronPool = null;

    try {
      const { AxisEngine } = require('./src/axis/axisEngine');
      cronPool = new Pool({ connectionString: process.env.DATABASE_URL });
      const axis = new AxisEngine(cronPool);

      const results = await axis.runRefinementCycle();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AXIS CRON] Refinement complete in ${duration}s`);
      console.log('[AXIS CRON] Results:', JSON.stringify({
        sessions_processed: results?.sessions_processed || 0,
        profiles_updated: results?.profiles_updated || 0,
        insights_generated: results?.insights_generated || 0,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[AXIS CRON] Refinement failed:', error.message);
    } finally {
      isRefinementRunning = false;
      if (cronPool) await cronPool.end().catch(() => {});
      console.log('[AXIS CRON] Cycle finished. Lock released.');
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  console.log(`[AXIS CRON] Scheduled: ${cronSchedule} America/New_York`);
} else {
  console.log('[AXIS CRON] Disabled (set ENABLE_AXIS_CRON=true to activate)');
}
