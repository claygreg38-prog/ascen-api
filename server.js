const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// GET all sessions
app.get('/api/fr/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM session_templates ORDER BY session_number'
    );
    res.json({
      success: true,
      total_sessions: result.rows.length,
      sessions: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single session by id
app.get('/api/fr/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM session_templates WHERE session_number = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// F-4: POST vault entry
app.post('/api/fr/vault', async (req, res) => {
  try {
    const { user_id, session_number, vault_response, session_type } = req.body;
    if (!user_id || !session_number || !vault_response) {
      return res.status(400).json({ success: false, error: 'user_id, session_number, and vault_response are required' });
    }
    const result = await pool.query(
      `INSERT INTO vault_entries (user_id, session_number, vault_response, session_type, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [user_id, session_number, vault_response, session_type || 'individual']
    );
    res.json({ success: true, vault_entry_id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET vault entries for a user
app.get('/api/fr/vault/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM vault_entries WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
    res.json({ success: true, entries: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// F-5: POST session progress
app.post('/api/fr/progress', async (req, res) => {
  try {
    const { user_id, session_number, completed, coherence_score, duration_seconds, session_type } = req.body;
    if (!user_id || !session_number) {
      return res.status(400).json({ success: false, error: 'user_id and session_number are required' });
    }
    const result = await pool.query(
      `INSERT INTO session_progress (user_id, session_number, completed, coherence_score, duration_seconds, session_type, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, session_number) DO UPDATE
       SET completed = $3, coherence_score = $4, duration_seconds = $5, completed_at = NOW()
       RETURNING id`,
      [user_id, session_number, completed || true, coherence_score || null, duration_seconds || null, session_type || 'individual']
    );
    res.json({ success: true, progress_id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET progress for a user
app.get('/api/fr/progress/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      `SELECT sp.*, st.title, st.arc 
       FROM session_progress sp
       JOIN session_templates st ON sp.session_number = st.session_number
       WHERE sp.user_id = $1 ORDER BY sp.session_number`,
      [user_id]
    );
    res.json({ success: true, total_completed: result.rows.length, progress: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log('ASCEN API running on port ' + port);
});

