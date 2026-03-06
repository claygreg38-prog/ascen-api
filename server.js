const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const pool = require('./src/db/pool');
app.use(express.json({ limit: '1mb' }));
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean).concat(['http://localhost:5173', 'http://localhost:3000']);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error('CORS: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true
}));
const { requireApiKey } = require('./src/middleware/auth');
let hardening = null;
try {
  hardening = require('./src/middleware/abiHardening');
  app.use('/api/abi', hardening.rateLimiter({ windowMs: 60000, max: 100 }));
  app.use('/api/abi/session', hardening.validateBiometrics);
  app.use(hardening.auditLogger);
  app.use(hardening.cfrGuard);
  console.log('[Hardening] All middleware loaded');
} catch (err) { console.warn('[Hardening] Could not load:', err.message); }

app.get('/', (req, res) => {
  res.json({ system: 'ASCEN BreathWorx — CHOS + AOT Unified System', version: '2.1.0', status: 'Live and Ready', layers: { ABI: '14/14 systems connected', ANS: 'Real-time state engine', AXIS: 'Brain stem operational' } });
});

app.get('/api/health', async (req, res) => {
  let dbStatus = 'no DATABASE_URL set', deepChecks = null;
  if (pool) { try { await pool.query('SELECT 1'); dbStatus = 'connected'; } catch (e) { dbStatus = 'error: ' + e.message; } }
  if (req.query.deep === 'true' && pool && hardening) { try { deepChecks = await hardening.deepHealthCheck(pool); } catch (err) { deepChecks = { error: err.message }; } }
  res.json({ status: 'healthy', message: 'CHOS + AOT System Online', version: '2.1.0', timestamp: new Date().toISOString(), system: 'Maryland AOT Ready', database: dbStatus, layers: { abi: 'online', ans: 'online', axis: 'online' }, deep: deepChecks });
});

// /api/schema — GATED: dev only (FIXED: was public)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/schema', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'No database connection' });
    try {
      const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
      const tableNames = tables.rows.map(r => r.table_name);
      const columns = {};
      for (const t of tableNames) { const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]); columns[t] = cols.rows; }
      res.json({ tables: tableNames, table_count: tableNames.length, columns });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

app.get('/api/sessions', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try { const result = await pool.query('SELECT session_number, title, arc, breath_mode, ratio, duration_seconds FROM session_templates ORDER BY session_number ASC'); res.json({ count: result.rows.length, sessions: result.rows }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/sessions/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try { const num = parseInt(req.params.id.replace(/\D/g, '')) || 1; const result = await pool.query('SELECT * FROM session_templates WHERE session_number = $1', [num]); if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' }); res.json(result.rows[0]); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Clinical — FIXED: auth required
app.get('/api/clinical/dashboard', requireApiKey, async (req, res) => {
  if (!pool) return res.json({ participants: [], metrics: { note: 'Database not connected' }, timestamp: new Date().toISOString() });
  try { const r = await pool.query(`SELECT u.user_id as id, u.display_name as name, u.breath_track, u.current_session_number, u.active FROM users u WHERE u.active = true LIMIT 50`); res.json({ participants: r.rows, timestamp: new Date().toISOString() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Court — FIXED: auth required
app.get('/api/court/participants', requireApiKey, async (req, res) => {
  if (!pool) return res.json({ participants: [], compliance_note: 'Protected per 42 CFR Part 2', timestamp: new Date().toISOString() });
  try { const r = await pool.query(`SELECT u.user_id as id, CONCAT(LEFT(u.display_name, 1), '.') as initials, COUNT(sc.id) as sessions_30d FROM users u LEFT JOIN session_completions sc ON sc.user_id = u.user_id AND sc.completed_at > NOW() - INTERVAL '30 days' WHERE u.active = true GROUP BY u.user_id, u.display_name`); res.json({ participants: r.rows, compliance_note: 'Protected per 42 CFR Part 2 — no clinical or vault data disclosed', timestamp: new Date().toISOString() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/lightbridge/activate', (req, res) => { res.json({ message: 'LightBridge Family Connection System', system_status: 'Ready', timestamp: new Date().toISOString() }); });
app.post('/api/lightbridge/activate', (req, res) => { res.json({ activation_id: 'lb_' + Date.now(), participant_id: req.body.participant_id, connection_established: true, timestamp: new Date().toISOString() }); });

// Blockchain — FIXED: await fetch, handle failures
app.post('/api/blockchain/verify-session', async (req, res) => {
  try {
    const { participantId, sessionNumber, sessionType, durationMinutes, coherenceScore, breathCount, familyWitnessed, notes } = req.body;
    const verifyRes = await fetch('https://mettle-verifcation-ledger-production.up.railway.app/api/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, sessionNumber, sessionType, durationMinutes, coherenceScore, breathCount, familyWitnessed, notes })
    });
    if (!verifyRes.ok) { console.error(`Blockchain verify returned ${verifyRes.status}`); return res.json({ success: false, message: `Ledger returned ${verifyRes.status}`, participantId, sessionNumber }); }
    res.json({ success: true, message: 'Session verified on blockchain', participantId, sessionNumber, timestamp: new Date().toISOString() });
  } catch (error) { console.error('Blockchain verify error:', error.message); res.status(500).json({ success: false, error: error.message }); }
});

// ABI Routes — with activeSessions export for cleanup
let abiActiveSessions = null;
try {
  const abiModule = require('./src/routes/abiRoutes');
  const router = abiModule.router || abiModule;
  abiActiveSessions = abiModule.activeSessions || null;
  app.use('/api/abi', router);
  console.log('[ABI] Routes mounted at /api/abi');
} catch (err) { console.warn('[ABI] Could not mount:', err.message); app.use('/api/abi', (req, res) => res.status(503).json({ error: 'ABI loading', message: err.message })); }

// AXIS Routes
try { const axisRoutes = require('./src/routes/axisRoutes'); app.use('/api/axis', axisRoutes); console.log('[AXIS] Routes mounted at /api/axis'); }
catch (err) { console.warn('[AXIS] Could not mount:', err.message); app.use('/api/axis', (req, res) => res.status(503).json({ error: 'AXIS loading', message: err.message })); }

if (hardening) app.use(hardening.gracefulDegradation);
app.use((err, req, res, next) => { console.error('[Unhandled]', err.message); res.status(500).json({ error: 'Internal server error' }); });

app.listen(PORT, () => {
  if (abiActiveSessions && hardening && hardening.startSessionCleanup) { hardening.startSessionCleanup(abiActiveSessions); console.log('[Cleanup] Session cleanup wired'); }
  console.log(`ASCEN BreathWorx v2.1 | Port ${PORT} | DB: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'} | Env: ${process.env.NODE_ENV || 'development'}`);
});
