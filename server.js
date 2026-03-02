const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'CHOS + AOT System Online',
    timestamp: new Date().toISOString(),
    system: 'Maryland AOT Ready'
  });
});

app.get('/', (req, res) => {
  res.json({
    system: 'CHOS + AOT Unified System',
    status: 'Live and Ready',
    message: 'Maryland AOT Deployment Successful',
    endpoints: ['/api/health']
  });
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'CHOS + AOT System Online',
    timestamp: new Date().toISOString(),
    system: 'Maryland AOT Ready'
  });
});
// Clinical Dashboard API  
app.get('/api/clinical/dashboard', (req, res) => {
  res.json({
    participants: [
      {
        id: 'p001',
        name: 'Marcus J.',
        compliance: 89,
        status: 'Engaged',
        sessions_completed: 24,
        next_session: '2026-03-02T10:00:00Z'
      }
    ],
    metrics: {
      total_participants: 12,
      avg_compliance: 78,
      sessions_this_week: 45
    }
  });
});
endpoints: ['/api/health', '/api/clinical/dashboard']
// Court Dashboard API (42 CFR Part 2 compliant)
app.get('/api/court/participants', (req, res) => {
  res.json({
    participants: [
      {
        id: 'p001',
        initials: 'M.J.',
        compliance_rate: 89,
        engagement_status: 'Engaged',
        milestones_completed: 8,
        total_milestones: 10
      }
    ],
    summary: {
      total_active: 12,
      avg_compliance: 78,
      engaged_participants: 9
    },
    compliance_note: "Data abstracted for court reporting - clinical details protected per 42 CFR Part 2"
  });
  endpoints: ['/api/health', '/api/clinical/dashboard', '/api/court/participants']
});

