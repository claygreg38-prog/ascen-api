// ============================================================
// Auth Routes — Registration, Login, Codes, Password Reset
// File: src/routes/authRoutes.js
//
// Public routes (register/login) + facilitator routes (codes).
// Three auth methods produce identical JWT claims.
// ============================================================

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── PUBLIC: Registration ────────────────────────────────────

router.post('/register/facility', async (req, res) => {
  try {
    const { code, pin, first_name } = req.body;
    if (!code || !pin || !first_name) return res.status(400).json({ error: 'code, pin, and first_name required' });
    const result = await authService.registerWithFacilityCode(code, pin, first_name, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Facility register failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/register/email', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password || !first_name) return res.status(400).json({ error: 'email, password, and first_name required' });
    const result = await authService.registerWithEmail(email, password, first_name, last_name, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Email register failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/register/phone', async (req, res) => {
  try {
    const { phone, first_name } = req.body;
    if (!phone || !first_name) return res.status(400).json({ error: 'phone and first_name required' });
    const result = await authService.registerWithPhone(phone, first_name, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Phone register failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── PUBLIC: Verification ────────────────────────────────────

router.post('/verify', async (req, res) => {
  try {
    const { user_id, code, purpose } = req.body;
    if (!user_id || !code || !purpose) return res.status(400).json({ error: 'user_id, code, and purpose required' });
    const result = await authService.verifyCode(user_id, code, purpose, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Verify failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── PUBLIC: Login ───────────────────────────────────────────

router.post('/login/facility', async (req, res) => {
  try {
    const { participant_id, pin } = req.body;
    if (!participant_id || !pin) return res.status(400).json({ error: 'participant_id and pin required' });
    const result = await authService.loginWithFacilityPin(participant_id, pin, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Facility login failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/login/email', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const result = await authService.loginWithEmail(email, password, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Email login failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/login/phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const result = await authService.loginWithPhone(phone, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Phone login failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/login/phone/verify', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });
    const result = await authService.verifyPhoneLogin(phone, otp, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Phone verify failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── Token Management ────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
    const result = await authService.refreshAccessToken(refresh_token, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Refresh failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const result = await authService.logout(refresh_token, req);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Logout failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── Password Reset ──────────────────────────────────────────

router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const result = await authService.resetPassword(email, req);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Reset failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

router.post('/reset-password/complete', async (req, res) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) return res.status(400).json({ error: 'email, code, and new_password required' });
    const result = await authService.completePasswordReset(email, code, new_password, req);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Reset complete failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ── Current User (requires JWT) ─────────────────────────────

router.get('/me', async (req, res) => {
  try {
    // This route needs auth — check if JWT present
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check API key fallback
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user?.userId || req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const user = await authService.getCurrentUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('[Auth] Me failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ── Facilitator: Enrollment Code Management ─────────────────

router.post('/codes/generate', async (req, res) => {
  try {
    const { assigned_to_name, program_name, count } = req.body;
    const userRole = req.user?.role;
    if (userRole !== 'facilitator' && userRole !== 'admin' && req.user?.authMethod !== 'api-key') {
      return res.status(403).json({ error: 'Facilitator or admin role required' });
    }

    const userId = req.user?.userId;
    let userDbId = null;
    if (userId && userId !== 'api-key-user') {
      const u = await pool.query('SELECT id FROM users WHERE user_id = $1 OR id = $2', [userId, parseInt(userId) || 0]);
      userDbId = u.rows[0]?.id || null;
    }

    const codes = await authService.generateCodes(userDbId, req.tenantId, assigned_to_name, program_name, count || 1, req);
    res.json({ codes });
  } catch (err) {
    console.error('[Auth] Code generate failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Code generation failed' });
  }
});

router.post('/codes/batch', async (req, res) => {
  try {
    const { program_name, names, count } = req.body;
    const userRole = req.user?.role;
    if (userRole !== 'facilitator' && userRole !== 'admin' && req.user?.authMethod !== 'api-key') {
      return res.status(403).json({ error: 'Facilitator or admin role required' });
    }

    let userDbId = null;
    const userId = req.user?.userId;
    if (userId && userId !== 'api-key-user') {
      const u = await pool.query('SELECT id FROM users WHERE user_id = $1 OR id = $2', [userId, parseInt(userId) || 0]);
      userDbId = u.rows[0]?.id || null;
    }

    const allCodes = [];
    if (names && Array.isArray(names)) {
      for (const name of names) {
        const codes = await authService.generateCodes(userDbId, req.tenantId, name, program_name, 1, req);
        allCodes.push({ name, ...codes[0] });
      }
    } else {
      const codes = await authService.generateCodes(userDbId, req.tenantId, null, program_name, count || 1, req);
      allCodes.push(...codes);
    }

    res.json({ codes: allCodes });
  } catch (err) {
    console.error('[Auth] Batch code failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Batch code generation failed' });
  }
});

router.get('/codes/list', async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'facilitator' && userRole !== 'admin' && req.user?.authMethod !== 'api-key') {
      return res.status(403).json({ error: 'Facilitator or admin role required' });
    }

    let userDbId = null;
    const userId = req.user?.userId;
    if (userId && userId !== 'api-key-user') {
      const u = await pool.query('SELECT id FROM users WHERE user_id = $1 OR id = $2', [userId, parseInt(userId) || 0]);
      userDbId = u.rows[0]?.id || null;
    }

    const codes = await authService.listCodes(userDbId, req.tenantId);
    res.json({ codes });
  } catch (err) {
    console.error('[Auth] List codes failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to list codes' });
  }
});

router.post('/codes/:code/revoke', async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'facilitator' && userRole !== 'admin' && req.user?.authMethod !== 'api-key') {
      return res.status(403).json({ error: 'Facilitator or admin role required' });
    }

    const result = await authService.revokeCode(req.params.code);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Auth] Revoke code failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to revoke code' });
  }
});

module.exports = router;
