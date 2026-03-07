// ============================================================
// src/middleware/auth.js — Authentication & Authorization
// JWT validation, API key auth, role-based access control
// ============================================================

// ── JWT TOKEN VALIDATION ────────────────────────────────────
function authenticateToken(req, res, next) {
  // Check Authorization header first
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // Check HttpOnly cookie as fallback
  const cookieToken = req.cookies?.ascen_token;

  const jwt = token || cookieToken;

  if (!jwt) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // TODO: Replace with real JWT verification (jsonwebtoken library)
  // For now, validate against API key as interim auth
  if (process.env.ASCEN_API_KEY && jwt === process.env.ASCEN_API_KEY) {
    req.user = { role: 'admin', authenticated: true };
    return next();
  }

  // Placeholder: accept tokens in development
  if (process.env.NODE_ENV !== 'production') {
    req.user = { role: 'participant', authenticated: true, user_id: req.body?.user_id };
    return next();
  }

  return res.status(401).json({ error: 'Invalid or expired token' });
}

// ── API KEY AUTH (for facility tablets, clinical dashboards) ─
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) {
    return res.status(401).json({ error: 'API key required' });
  }
  if (process.env.CLINICAL_API_KEY && key !== process.env.CLINICAL_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

// ── ROLE-BASED AUTHORIZATION ────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

module.exports = { authenticateToken, requireApiKey, requireRole };
