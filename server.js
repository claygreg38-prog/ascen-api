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

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

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

app.listen(port, () => {
  console.log('ASCEN API running on port ' + port);
});
