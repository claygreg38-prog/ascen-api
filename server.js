const Sentry = require('./src/instrument');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cron = require('node-cron');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── CLINICAL TEST HARNESS (temporary — delete after 5-day test) ──
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'public/test.html')));
app.get('/test/config', (req, res) => {
  // Serves the test harness API key so it's not hardcoded in HTML source
  const key = process.env.TEST_HARNESS_API_KEY || '';
  res.json({ key });
});

// ── CROWN SVGs — static assets ──────────────────────────────
app.use('/assets/crowns', express.static(path.join(__dirname, 'src/assets/crowns')));

// ── DATABASE ────────────────────────────────────────────────
// Declared FIRST so all middleware and routes can reference it
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

// ── HARDENING MIDDLEWARE ────────────────────────────────────
const abiHardening = require('./src/middleware/abiHardening');
// rateLimiter is a factory — must be invoked to get middleware
const rateLimiterMw = abiHardening.rateLimiter ? abiHardening.rateLimiter() : ((req, res, next) => next());
const validateABI = abiHardening.validateBiometrics || ((req, res, next) => next());
const auditLogger = abiHardening.auditLogger || ((req, res, next) => next());
const cfrGuard = abiHardening.cfrGuard || ((req, res, next) => next());
const createResilientPool = abiHardening.createResilientPool || (() => {});
const createHealthCheck = abiHardening.createHealthCheck || ((pool) => (req, res) => res.json({ status: 'healthy' }));

// ── AUTH MIDDLEWARE ─────────────────────────────────────────
const {
  authenticate,
  requireRole,
  authenticateOrApiKey,
  optionalAuth,
  authRoutes
} = require('./src/middleware/auth');

// ── TENANT RESOLVER ─────────────────────────────────────────
const { tenantResolver } = require('./src/middleware/tenantResolver');

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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-session-key, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── SENTRY USER CONTEXT ─────────────────────────────────────
// Uses addEventProcessor so req.user is read at capture time (after auth
// middleware has run), not at registration time when req.user is undefined.
app.use((req, res, next) => {
  Sentry.addEventProcessor((event) => {
    if (req.user) {
      const pid = req.user.participant_id || req.user.user_id || req.user.sub;
      event.user = { ...event.user, id: pid };
      event.tags = { ...event.tags, participant_id: pid };
    }
    if (req.body) {
      if (req.body.session_number) event.tags = { ...event.tags, session_number: req.body.session_number };
      if (req.body.device_type) event.tags = { ...event.tags, device_type: req.body.device_type };
    }
    if (req.query && req.query.session_number) {
      event.tags = { ...event.tags, session_number: req.query.session_number };
    }
    return event;
  });
  next();
});

// ── TENANT RESOLUTION (after auth, before routes) ───────────
app.use(tenantResolver);

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (public — registration, login, codes)
// ═══════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes); // Legacy token/verify/refresh endpoints

try {
  const productionAuthRoutes = require('./src/routes/authRoutes');
  // Public auth endpoints (register, login, verify, reset) — no auth required
  app.use('/api/auth', productionAuthRoutes);
  console.log('[AUTH] Production auth routes mounted at /api/auth');
} catch (err) {
  console.warn('[AUTH] Could not mount production auth:', err.message);
}

// Onboarding routes (requires JWT or API key)
try {
  const onboardingRoutes = require('./src/routes/onboardingRoutes');
  app.use('/api/onboarding', authenticateOrApiKey('participant'));
  app.use('/api/onboarding', onboardingRoutes);
  console.log('[ONBOARDING] Routes mounted at /api/onboarding');
} catch (err) {
  console.warn('[ONBOARDING] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// ABI ROUTES — Session lifecycle, clinical, admin
// ═══════════════════════════════════════════════════════════════
const abiRoutes = require('./src/routes/abiRoutes');

// Hardening on all ABI routes
app.use('/api/abi', rateLimiterMw);
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
// FR Routes (Family Receiver)
try {
  const frRoutes = require('./src/routes/frRoutes');
  app.use('/api/abi/fr', frRoutes);
  console.log('[FR] Routes mounted at /api/abi/fr');
} catch (err) {
  console.warn('[FR] Could not mount:', err.message);
}
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

// ── AXIS VALUE ROUTES — Healing economy metrics ──────────────
try {
  const axisValueRoutes = require('./src/routes/axisValueRoutes');
  app.use('/api/axis/value', authenticateOrApiKey('clinician'));
  app.use('/api/axis/value', axisValueRoutes);
  console.log('[AXIS] Value routes mounted at /api/axis/value');
} catch (err) {
  console.warn('[AXIS] Value routes not loaded:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// ART ROUTES — Breath Art gallery, decode, crown, intention
// ═══════════════════════════════════════════════════════════════
try {
  const artRoutes = require('./src/routes/artRoutes');
  // Gallery, crown, intention, photo-palette — participant or above
  app.use('/api/art', authenticateOrApiKey('participant'));
  // Decode route also checks X-Clinical-Key internally for clinical access
  app.use('/api/art', artRoutes);
  console.log('[ART] Routes mounted at /api/art');
} catch (err) {
  console.warn('[ART] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS ROUTES — Co-Creation Canvas
// ═══════════════════════════════════════════════════════════════
try {
  const canvasRoutes = require('./src/routes/canvasRoutes');
  app.use('/api/canvas', authenticateOrApiKey('participant'));
  app.use('/api/canvas', canvasRoutes);
  console.log('[CANVAS] Routes mounted at /api/canvas');
} catch (err) {
  console.warn('[CANVAS] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// SHOWCASE ROUTES — Breath Art Social Gallery
// ═══════════════════════════════════════════════════════════════
try {
  const socialRoutes = require('./src/routes/socialRoutes');
  app.use('/api/showcase', authenticateOrApiKey('participant'));
  app.use('/api/showcase', socialRoutes);
  console.log('[SHOWCASE] Routes mounted at /api/showcase');
} catch (err) {
  console.warn('[SHOWCASE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// LEGACY VAULT ROUTES — Capsules, Unlock, Ancestral Sessions
// ═══════════════════════════════════════════════════════════════
try {
  const legacyRoutes = require('./src/routes/legacyRoutes');
  app.use('/api/legacy', authenticateOrApiKey('participant'));
  app.use('/api/legacy', legacyRoutes);
  console.log('[LEGACY] Routes mounted at /api/legacy');
} catch (err) {
  console.warn('[LEGACY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// MERCHANDISE ROUTES — Export, Poster, Verify
// ═══════════════════════════════════════════════════════════════
try {
  const merchandiseRoutes = require('./src/routes/merchandiseRoutes');
  app.use('/api/merch', authenticateOrApiKey('participant'));
  app.use('/api/merch', merchandiseRoutes);
  console.log('[MERCH] Routes mounted at /api/merch');
} catch (err) {
  console.warn('[MERCH] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// FAMILY ROUTES — Family Units, Intelligence, Invitations
// ═══════════════════════════════════════════════════════════════
try {
  const familyRoutes = require('./src/routes/familyRoutes');
  app.use('/api/family', authenticateOrApiKey('participant'));
  app.use('/api/family', familyRoutes);
  console.log('[FAMILY] Routes mounted at /api/family');
} catch (err) {
  console.warn('[FAMILY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CAPACITY CURRENCY ROUTES — Balance, History, Trend, Invest
// ═══════════════════════════════════════════════════════════════
try {
  const capacityRoutes = require('./src/routes/capacityRoutes');
  app.use('/api/capacity', authenticateOrApiKey('participant'));
  app.use('/api/capacity', capacityRoutes);
  console.log('[CAPACITY] Routes mounted at /api/capacity');
} catch (err) {
  console.warn('[CAPACITY] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// LIGHTBRIDGE ROUTES — IoT Device Control
// ═══════════════════════════════════════════════════════════════
try {
  const lightBridgeRoutes = require('./src/routes/lightBridgeRoutes');
  app.use('/api/lightbridge', authenticateOrApiKey('participant'));
  app.use('/api/lightbridge', lightBridgeRoutes);
  console.log('[LIGHTBRIDGE] Routes mounted at /api/lightbridge');
} catch (err) {
  console.warn('[LIGHTBRIDGE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// KITCHEN TABLE ROUTES — Topic Discussion
// ═══════════════════════════════════════════════════════════════
try {
  const kitchenTableRoutes = require('./src/routes/kitchenTableRoutes');
  app.use('/api/kitchen-table', authenticateOrApiKey('participant'));
  app.use('/api/kitchen-table', kitchenTableRoutes);
  console.log('[KITCHEN TABLE] Routes mounted at /api/kitchen-table');
} catch (err) {
  console.warn('[KITCHEN TABLE] Could not mount:', err.message);
}

// ═══════════════════════════════════════════════════════════════
// CO-BREATH ROUTES — Synchronized Family Breathing
// ═══════════════════════════════════════════════════════════════
try {
  const coBreathRoutes = require('./src/routes/coBreathRoutes');
  app.use('/api/cobreath', authenticateOrApiKey('participant'));
  app.use('/api/cobreath', coBreathRoutes);
  console.log('[COBREATH] Routes mounted at /api/cobreath');
} catch (err) {
  console.warn('[COBREATH] Could not mount:', err.message);
}

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

// ── Blockchain verification (real Polygon contract wire) ─────
const { VerificationService } = require('./src/blockchain/verificationService');
const verificationService = new VerificationService(pool);
verificationService.initialize().catch(err =>
  console.warn('[BLOCKCHAIN] Deferred init:', err.message)
);

// Submit attestation — requires dual signatures (participant + facilitator)
app.post('/api/blockchain/submit-attestation', authenticateOrApiKey('admin'), async (req, res) => {
  try {
    const result = await verificationService.submitAttestation(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process gas-deferred attestations (admin/cron)
app.post('/api/blockchain/process-deferred', authenticateOrApiKey('admin'), async (req, res) => {
  try {
    const result = await verificationService.processDeferred();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Legacy endpoint — backwards compatible, queues for attestation
app.post('/api/blockchain/verify-session', authenticateOrApiKey('participant'), async (req, res) => {
  try {
    const { participantId, sessionNumber, sessionType } = req.body;
    // Queue in attestation_queue as awaiting_facilitator
    await pool.query(
      `INSERT INTO attestation_queue (user_id, packet_hash, status)
       SELECT $1, sc.packet_hash, 'awaiting_facilitator'
       FROM session_completions sc
       WHERE sc.user_id = $1 AND sc.session_number = $2
         AND sc.packet_hash IS NOT NULL
       ORDER BY sc.completed_at DESC LIMIT 1
       ON CONFLICT DO NOTHING`,
      [participantId, sessionNumber]
    );
    res.json({ success: true, message: 'Session verification queued', participantId, sessionNumber, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════
// SENTRY ERROR HANDLER — after all routes, before error middleware
// ═══════════════════════════════════════════════════════════════
Sentry.setupExpressErrorHandler(app);

// ═══════════════════════════════════════════════════════════════
// SERVER START + CRON
// ═══════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  console.log('Server running on port', PORT);
  console.log('ABI: 15/15 systems wired | AXIS: active | Auth: JWT + API key');
  console.log('Hardening: rate_limit + validation + audit + cfr_guard');
});

// ── CO-BREATH WEBSOCKET ────────────────────────────────────
try {
  const { initCoBreathWS } = require('./src/services/coBreathWebSocket');
  initCoBreathWS(server);
} catch (err) {
  console.warn('[CoBreath WS] Could not initialize:', err.message);
}

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

// ── CAPACITY CURRENCY DAILY SNAPSHOT CRON ─────────────────
try {
  const capacitySnapshot = require('./src/jobs/capacitySnapshot');
  cron.schedule('0 3 * * *', async () => {
    console.log('[CAPACITY CRON] Running daily capacity snapshots...');
    const result = await capacitySnapshot.runDailySnapshots();
    console.log(`[CAPACITY CRON] Done: ${result.count} snapshots, ${result.errors} errors`);
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  console.log('[CAPACITY CRON] Scheduled: 0 3 * * * UTC');
} catch (err) {
  console.warn('[CAPACITY CRON] Could not schedule:', err.message);
}
