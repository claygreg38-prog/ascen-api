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
// Clinical Dashboard API  
app.get('/api/clinical/dashboard', (req, res) => {
  res.json({
    participants: [
      {
        id: 'p001',
        name: 'Marcus J.',
        compliance: 89,
        status: 'Engaged',
        sessions_completed: 24
      }
    ],
    metrics: {
      total_participants: 12,
      avg_compliance: 78
    }
  });
});
