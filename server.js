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
    endpoints: [ '/api/clinical/dashboard', '/api/court/participants', '/api/lightbridge/activate']
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
        hrv_improvement: 15,
        family_engagement: 'Active',
        next_session: '2026-03-02T10:00:00Z'
      },
      {
        id: 'p002', 
        name: 'Kevin T.',
        compliance: 61,
        status: 'Needs Support',
        sessions_completed: 12,
        hrv_improvement: 8,
        family_engagement: 'Building',
        next_session: '2026-03-02T14:00:00Z'
      }
    ],
    metrics: {
      total_participants: 12,
      avg_compliance: 78,
      sessions_this_week: 45,
      success_predictions: 87
    },
    timestamp: new Date().toISOString()
  });
});
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
        total_milestones: 10,
        last_update: '2026-03-01T14:30:00Z'
      },
      {
        id: 'p002',
        initials: 'K.T.',
        compliance_rate: 61,
        engagement_status: 'Needs Support',
        milestones_completed: 4,
        total_milestones: 8,
        last_update: '2026-03-01T16:15:00Z'
      }
    ],
    summary: {
      total_active: 12,
      avg_compliance: 78,
      engaged_participants: 9,
      needs_support: 3
    },
    compliance_note: "Data abstracted for court reporting - clinical details protected per 42 CFR Part 2",
    timestamp: new Date().toISOString()
  });
});// LightBridge Family Connection System - GET endpoint for testing
app.get('/api/lightbridge/activate', (req, res) => {
  res.json({
    message: "LightBridge Family Connection System",
    description: "30-minute therapeutic light sessions for family healing",
    features: [
      "Family member notification system",
      "Child bedtime protection protocols", 
      "Co-regulation session tracking",
      "Connection establishment verification"
    ],
    usage: "Send POST request with participant_id to activate session",
    system_status: "Ready for activation",
    timestamp: new Date().toISOString()
  });
});
// LightBridge Family Connection System
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





