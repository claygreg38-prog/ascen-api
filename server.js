const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'CHOS + AOT System Online',
    timestamp: new Date().toISOString(),
    system: 'Maryland AOT Ready'
  });
});

// Root endpoint
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
