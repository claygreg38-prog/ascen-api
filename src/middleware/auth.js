// ============================================================
// ASCEN Auth Middleware
// File: src/middleware/auth.js
//
// JWT-based authentication + role-based authorization.
// Supports transition period: accepts either JWT or x-api-key.
//
// Roles:
//   participant — session lifecycle, own data
//   clinician   — clinical dashboards, participant profiles, trends
//   admin       — immune overrides, active sessions, AXIS refine
//
// Environment variables required:
//   JWT_SECRET          — secret key for signing/verifying tokens
//   CLINICAL_API_KEY    — legacy API key (transition period)
//   API_KEY             — general API key (transition period)
//
// Wire into server.js:
//   const { authenticate, requireRole, authenticateOrApiKey, generateToken } = require('./src/middleware/auth');
// ============================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ascen-dev-secret-CHANGE-IN-PRODUCTION';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Known API keys (transition period — remove when full JWT is adopted)
const VALID_API_KEYS = new Set([
  process.env.CLINICAL_API_KEY,
  process.env.API_KEY
].filter(Boolean));


// ═══════════════════════════════════════════════════════════════
// TOKEN GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a JWT for a user.
 * @param {Object} payload - { userId, role, facilityId? }
 * @param {Object} options - { expiresIn? }
 * @returns {string} JWT token
 */
function generateToken(payload, options = {}) {
  if (!payload.userId || !payload.role) {
    throw new Error('Token payload must include userId and role');
  }

  const validRoles = ['participant', 'clinician', 'admin'];
  if (!validRoles.includes(payload.role)) {
    throw new Error(`Invalid role: ${payload.role}. Must be: ${validRoles.join(', ')}`);
  }

  return jwt.sign(
    {
      sub: payload.userId,
      role: payload.role,
      facility_id: payload.facilityId || null,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: options.expiresIn || JWT_EXPIRY }
  );
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {Object} decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}


// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

/**
 * authenticate — Requires a valid JWT.
 * Reads from: Authorization: Bearer <token>
 * Sets: req.user = { userId, role, facilityId }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      hint: 'Send Authorization: Bearer <token>'
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.sub,
      role: decoded.role,
      facilityId: decoded.facility_id || null
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * requireRole — Requires the authenticated user to have a specific role.
 * Must be used AFTER authenticate middleware.
 *
 * Role hierarchy: admin > clinician > participant
 * An admin can access clinician routes. A clinician can access participant routes.
 *
 * Usage: router.get('/path', authenticate, requireRole('clinician'), handler)
 */
function requireRole(...roles) {
  const ROLE_LEVEL = { participant: 1, clinician: 2, admin: 3 };

  // Find the minimum required level
  const minLevel = Math.min(...roles.map(r => ROLE_LEVEL[r] || 99));

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = ROLE_LEVEL[req.user.role] || 0;

    if (userLevel >= minLevel) {
      return next();
    }

    return res.status(403).json({
      error: 'Insufficient permissions',
      required: roles,
      your_role: req.user.role
    });
  };
}

/**
 * authenticateOrApiKey — Transition middleware.
 * Accepts EITHER a valid JWT OR a valid x-api-key header.
 * Use this during the migration period. Replace with `authenticate` when ready.
 *
 * If JWT present → validates and sets req.user
 * If x-api-key present → validates key and sets req.user with role from key context
 * If neither → 401
 */
function authenticateOrApiKey(defaultRole = 'clinician') {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];

    // Try JWT first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = verifyToken(token);
        req.user = {
          userId: decoded.sub,
          role: decoded.role,
          facilityId: decoded.facility_id || null,
          authMethod: 'jwt'
        };
        return next();
      } catch (err) {
        // JWT present but invalid — don't fall through to API key
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // Try API key
    if (apiKey && VALID_API_KEYS.has(apiKey)) {
      req.user = {
        userId: 'api-key-user',
        role: defaultRole,
        facilityId: null,
        authMethod: 'api-key'
      };
      return next();
    }

    // Neither
    return res.status(401).json({
      error: 'Authentication required',
      hint: 'Send Authorization: Bearer <token> or x-api-key header'
    });
  };
}

/**
 * optionalAuth — Extracts user from JWT if present, but doesn't require it.
 * Useful for routes that work for both authenticated and anonymous users
 * (e.g., session lifecycle where participant might not have a token yet).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = verifyToken(token);
      req.user = {
        userId: decoded.sub,
        role: decoded.role,
        facilityId: decoded.facility_id || null
      };
    } catch (err) {
      // Token present but invalid — continue without user
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}


// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (mount these in server.js)
// ═══════════════════════════════════════════════════════════════

const router = require('express').Router();

/**
 * POST /api/auth/token
 * Generate a JWT token.
 *
 * For now: requires a valid API key + userId + role.
 * In production: replace with real credential verification
 * (username/password, facility SSO, PIN for participants).
 *
 * Body: { userId, role, facilityId? }
 * Headers: x-api-key (required)
 */
router.post('/token', (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !VALID_API_KEYS.has(apiKey)) {
    return res.status(401).json({ error: 'Valid API key required to generate tokens' });
  }

  const { userId, role, facilityId } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: 'userId and role required' });
  }

  try {
    const token = generateToken({ userId, role, facilityId });
    const decoded = jwt.decode(token);

    res.json({
      token,
      token_type: 'Bearer',
      expires_in: JWT_EXPIRY,
      expires_at: new Date(decoded.exp * 1000).toISOString(),
      user: { userId, role, facilityId: facilityId || null }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/auth/verify
 * Verify a token and return the decoded payload.
 * Useful for frontend to check if token is still valid.
 */
router.get('/verify', authenticate, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/auth/refresh
 * Get a new token with extended expiry.
 * Requires a valid (non-expired) existing token.
 */
router.post('/refresh', authenticate, (req, res) => {
  try {
    const token = generateToken({
      userId: req.user.userId,
      role: req.user.role,
      facilityId: req.user.facilityId
    });
    const decoded = jwt.decode(token);

    res.json({
      token,
      token_type: 'Bearer',
      expires_in: JWT_EXPIRY,
      expires_at: new Date(decoded.exp * 1000).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = {
  // Middleware
  authenticate,
  requireRole,
  authenticateOrApiKey,
  optionalAuth,

  // Token utilities
  generateToken,
  verifyToken,

  // Auth routes (mount with app.use('/api/auth', authRoutes))
  authRoutes: router
};
