const express = require('express');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

app.get('/api/health', async (req, res) => {
  let dbStatus = 'no DATABASE_URL set';
  if (pool) {
    try { await pool.query('SELECT 1'); dbStatus = 'connected'; }
    catch (e) { dbStatus = 'error: ' + e.message; }
  }
  res.json({ status: 'healthy', message: 'CHOS + AOT System Online', timestamp: new Date().toISOString(), system: 'Maryland AOT Ready', database: dbStatus });
});

app.get('/', (req, res) => {
  res.json({ system: 'CHOS + AOT Unified System', status: 'Live and Ready' });
});

app.get('/api/schema', async (req, res) => {
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

app.get('/api/clinical/dashboard', (req, res) => {
  res.json({ participants: [{ id: 'p001', name: 'Marcus J.', compliance: 89, status: 'Engaged', sessions_completed: 24 }, { id: 'p002', name: 'Kevin T.', compliance: 61, status: 'Needs Support', sessions_completed: 12 }], metrics: { total_participants: 12, avg_compliance: 78, sessions_this_week: 45 }, timestamp: new Date().toISOString() });
});

app.get('/api/court/participants', (req, res) => {
  res.json({ participants: [{ id: 'p001', initials: 'M.J.', compliance_rate: 89 }, { id: 'p002', initials: 'K.T.', compliance_rate: 61 }], compliance_note: 'Protected per 42 CFR Part 2', timestamp: new Date().toISOString() });
});

app.get('/api/lightbridge/activate', (req, res) => {
  res.json({ message: 'LightBridge Family Connection System', system_status: 'Ready', timestamp: new Date().toISOString() });
});

app.post('/api/lightbridge/activate', (req, res) => {
  res.json({ activation_id: 'lb_' + Date.now(), participant_id: req.body.participant_id, connection_established: true, timestamp: new Date().toISOString() });
});

app.post('/api/blockchain/verify-session', async (req, res) => {
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

app.listen(PORT, () => { console.log('Server running on port', PORT); });
