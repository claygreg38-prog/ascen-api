// Static server for ASCEN PWA on Railway
// Serves the Vite build output with SPA fallback
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
  '.wav':  'audio/wav',
};

const INDEX = path.join(DIST, 'index.html');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;

  // Root redirect → /app/
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/app/' });
    res.end();
    return;
  }

  // Health check for Railway
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'ascen-frontend' }));
    return;
  }

  // Strip /app prefix to map to dist directory
  // /app/assets/index-abc.js → dist/assets/index-abc.js
  // /app/ → dist/index.html
  let filePath;
  if (pathname.startsWith('/app')) {
    const subpath = pathname.slice(4) || '/';
    filePath = path.join(DIST, subpath);
  } else {
    // Non /app paths: try dist directly (unlikely but safe)
    filePath = path.join(DIST, pathname);
  }

  // Prevent directory traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Try to serve the static file
  const ext = path.extname(filePath);
  if (ext && fs.existsSync(filePath)) {
    const contentType = MIME[ext] || 'application/octet-stream';
    const cacheControl = filePath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'  // Hashed Vite bundles — cache forever
      : 'public, max-age=0, must-revalidate';   // HTML, manifest, SW — always fresh
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // SPA fallback: any /app/* route serves index.html (React Router handles it)
  if (pathname.startsWith('/app')) {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    });
    fs.createReadStream(INDEX).pipe(res);
    return;
  }

  // 404 for anything else
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ASCEN-FRONTEND] Serving PWA on port ${PORT}`);
});
