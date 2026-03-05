const express = require('express');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Database connection
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

// ─── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbStatus = 'no DATABASE_URL set';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'error: ' + e.message;
    }
  }
  res.json({
    status: 'healthy',
    message: 'CHOS + AOT System Online',
    timestamp: new Date().toISOString(),
    system: 'Maryland AOT Ready',
    database: dbStatus
  });
});

// ─── ROOT ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    system: 'CHOS + AOT Unified System',
    status: 'Live and Ready',
    message: 'Maryland AOT Deployment Successful',
    endpoints: [
      '/api/health',
      '/api/sessions',
      '/api/sessions/:id',
      '/api/clinical/dashboard',
      '/api/court/participants',
      '/api/lightbridge/activate',
      '/api/blockchain/verify-session'
    ]
  });
});

// ─── SESSIONS ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const schema = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'session_templates' ORDER BY ordinal_position`);
    const sample = await pool.query('SELECT * FROM session_templates LIMIT 3');
    res.json({ columns: schema.rows.map(r => r.column_name), sample: sample.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const result = await pool.query(
      'SELECT id, session_id, title, arc, session_number FROM session_templates ORDER BY session_number ASC'
    );
    res.json({ count: result.rows.length, sessions: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database connection' });
  try {
    const { id } = req.params;
    // Accept both numeric id and session_id like S001
    const result = await pool.query(
      'SELECT * FROM session_templates WHERE session_id = $1 OR id::text = $1',
      [id.toUpperCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CLINICAL DASHBOARD ────────────────────────────────────────────────────────
app.get('/api/clinical/dashboard', (req, res) => {
  res.json({
    participants: [
      { id: 'p001', name: 'Marcus J.', compliance: 89, status: 'Engaged', sessions_completed: 24, hrv_improvement: 15, family_engagement: 'Active', next_session: '2026-03-02T10:00:00Z' },
      { id: 'p002', name: 'Kevin T.', compliance: 61, status: 'Needs Support', sessions_completed: 12, hrv_improvement: 8, family_engagement: 'Building', next_session: '2026-03-02T14:00:00Z' }
    ],
    metrics: { total_participants: 12, avg_compliance: 78, sessions_this_week: 45, success_predictions: 87 },
    timestamp: new Date().toISOString()
  });
});

// ─── COURT DASHBOARD (42 CFR Part 2) ──────────────────────────────────────────
app.get('/api/court/participants', (req, res) => {
  res.json({
    participants: [
      { id: 'p001', initials: 'M.J.', compliance_rate: 89, engagement_status: 'Engaged', milestones_completed: 8, total_milestones: 10, last_update: '2026-03-01T14:30:00Z' },
      { id: 'p002', initials: 'K.T.', compliance_rate: 61, engagement_status: 'Needs Support', milestones_completed: 4, total_milestones: 8, last_update: '2026-03-01T16:15:00Z' }
    ],
    summary: { total_active: 12, avg_compliance: 78, engaged_participants: 9, needs_support: 3 },
    compliance_note: 'Data abstracted for court reporting - clinical details protected per 42 CFR Part 2',
    timestamp: new Date().toISOString()
  });
});

// ─── LIGHTBRIDGE ───────────────────────────────────────────────────────────────
app.get('/api/lightbridge/activate', (req, res) => {
  res.json({ message: 'LightBridge Family Connection System', system_status: 'Ready for activation', timestamp: new Date().toISOString() });
});

app.post('/api/lightbridge/activate', (req, res) => {
  res.json({
    activation_id: 'lb_' + Date.now(),
    participant_id: req.body.participant_id,
    light_duration: '30_minutes',
    family_members_notified: true,
    connection_established: true,
    child_bedtime_protected: true,
    co_regulation_session: 'active',
    timestamp: new Date().toISOString()
  });
});

// ─── BLOCKCHAIN VERIFY ─────────────────────────────────────────────────────────
app.post('/api/blockchain/verify-session', async (req, res) => {
  try {
    const { participantId, sessionNumber, sessionType, durationMinutes, coherenceScore, breathCount, familyWitnessed, notes } = req.body;
    fetch('https://mettle-verifcation-ledger-production.up.railway.app/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, sessionNumber, sessionType, durationMinutes, coherenceScore, breathCount, familyWitnessed, notes })
    }).catch(err => console.error('Blockchain verify error:', err));
    res.json({ success: true, message: 'Session queued for blockchain verification', participantId, sessionNumber, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});

