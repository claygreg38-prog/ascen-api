// ============================================================
// Auth Service — Registration, Login, JWT, Refresh Tokens
// File: src/services/authService.js
//
// Three auth methods (facility code, email, phone) produce
// identical JWT claims. Downstream code doesn't care how
// you authenticated.
//
// Sits ON TOP of ABI/AXIS, never around them.
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');
const Sentry = require('../instrument');
const walletService = require('./walletService');
const emailService = require('./emailService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '1h';
const REFRESH_EXPIRY_DAYS = 30;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 30;

// ── CODE GENERATION ─────────────────────────────────────────

const ENROLLMENT_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No 0,O,1,I,L

function generateEnrollmentCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += ENROLLMENT_CHARS[crypto.randomInt(ENROLLMENT_CHARS.length)];
  return code;
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// ── JWT GENERATION ──────────────────────────────────────────

function generateJWT(user) {
  return jwt.sign({
    sub: user.id || user.user_id,
    userId: user.id,
    user_id: user.user_id,
    participant_id: user.user_id,
    tenantId: user.tenant_id || null,
    role: user.role || 'participant',
    firstName: user.first_name,
    familyUnitId: user.family_unit_id || null
  }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function generateLimitedJWT(user) {
  return jwt.sign({
    sub: user.id || user.user_id,
    userId: user.id,
    user_id: user.user_id,
    role: user.role || 'participant',
    scope: 'change_password'
  }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

async function generateRefreshToken(userDbId, deviceInfo) {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userDbId, hash, deviceInfo || null, expiresAt]
  );

  return raw;
}

// ── AUDIT LOGGING ───────────────────────────────────────────

async function logAuthEvent(userId, eventType, req, metadata = {}) {
  try {
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const device = req?.headers?.['user-agent']?.slice(0, 255) || null;
    await pool.query(
      'INSERT INTO auth_audit_log (user_id, event_type, ip_address, device_info, metadata) VALUES ($1, $2, $3, $4, $5)',
      [userId, eventType, ip, device, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('[Auth] Audit log failed:', err.message);
  }
}

// ── LOCKOUT CHECK ───────────────────────────────────────────

async function checkLockout(userDbId) {
  const user = await pool.query('SELECT failed_login_count, locked_until FROM users WHERE id = $1', [userDbId]);
  if (user.rows.length === 0) return false;

  const { locked_until } = user.rows[0];
  if (locked_until && new Date(locked_until) > new Date()) {
    return true; // Still locked
  }

  // Reset if lockout expired
  if (locked_until) {
    await pool.query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [userDbId]);
  }
  return false;
}

async function recordFailedLogin(userDbId, req) {
  const result = await pool.query(
    'UPDATE users SET failed_login_count = COALESCE(failed_login_count, 0) + 1 WHERE id = $1 RETURNING failed_login_count',
    [userDbId]
  );

  const count = result.rows[0]?.failed_login_count || 0;
  if (count >= MAX_FAILED_LOGINS) {
    const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    await pool.query('UPDATE users SET locked_until = $1 WHERE id = $2', [lockUntil, userDbId]);
    await logAuthEvent(userDbId, 'account_locked', req, { failed_attempts: count });
  }

  await logAuthEvent(userDbId, 'login_failed', req);
}

async function resetFailedLogins(userDbId) {
  await pool.query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [userDbId]);
}

// ── REGISTRATION ────────────────────────────────────────────

async function registerWithFacilityCode(code, pin, firstName, req) {
  // Verify enrollment code
  const codeRow = await pool.query(
    "SELECT * FROM enrollment_codes WHERE code = $1 AND status = 'active' AND expires_at > NOW()",
    [code]
  );
  if (codeRow.rows.length === 0) return { error: true, message: 'Invalid or expired enrollment code.' };

  const enrollment = codeRow.rows[0];

  // Validate PIN
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return { error: true, message: 'PIN must be exactly 6 digits.' };
  }

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  const participantId = 'P' + code.slice(0, 4) + crypto.randomInt(100, 999);

  // Create user
  const userResult = await pool.query(
    `INSERT INTO users (user_id, first_name, pin_hash, auth_method, tenant_id, role, is_active, is_verified, participant_id,
                        onboarding_state, password_changed, created_at)
     VALUES ($1, $2, $3, 'facility_code', $4, 'participant', true, true, $5, $6, false, NOW())
     RETURNING *`,
    [
      participantId, firstName, pinHash, enrollment.tenant_id, participantId,
      JSON.stringify({ step: 'consent', consent_art: false, consent_gallery: false, consent_data: false })
    ]
  );
  const user = userResult.rows[0];

  // Mark code used
  await pool.query("UPDATE enrollment_codes SET status = 'used', used_by = $1 WHERE id = $2", [user.id, enrollment.id]);

  // Generate wallet
  const wallet = await walletService.generateWallet(user.id);
  await logAuthEvent(user.id, 'register', req, { auth_method: 'facility_code' });
  await logAuthEvent(user.id, 'wallet_generated', req, { wallet_address: wallet.walletAddress });
  await logAuthEvent(null, 'code_used', req, { code, used_by: user.id });

  // Lock disadvantage index at enrollment (non-blocking)
  try {
    const countyCode = 'PG'; // Default county — updated by facilitator if needed
    const census = await pool.query(
      "SELECT disadvantage_index FROM census_data WHERE geographic_level = 'county' AND geographic_code = $1",
      [countyCode]
    );
    const di = parseFloat(census.rows[0]?.disadvantage_index) || 0.5;
    const multiplier = Math.round((1.0 + di * 1.5) * 100) / 100;
    await pool.query(
      'UPDATE users SET county_code = $1, disadvantage_index_at_enrollment = $2, disadvantage_index_multiplier = $3 WHERE id = $4',
      [countyCode, di, multiplier, user.id]
    );
  } catch (err) {
    console.error('[AUTH] Disadvantage index setup failed (non-blocking):', err.message);
  }

  // Generate tokens
  const accessToken = generateJWT(user);
  const refreshToken = await generateRefreshToken(user.id, req?.headers?.['user-agent']);

  return {
    userId: user.user_id,
    participantId: user.participant_id,
    jwt: accessToken,
    refreshToken,
    onboardingState: user.onboarding_state
  };
}

async function registerWithEmail(email, password, firstName, lastName, req) {
  // Check email not taken
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) return { error: true, message: 'Email already registered.' };

  // Validate password
  if (!password || password.length < 8 || !/\d/.test(password)) {
    return { error: true, message: 'Password must be at least 8 characters with at least 1 number.' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = 'U' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const userResult = await pool.query(
    `INSERT INTO users (user_id, email, password_hash, first_name, last_name, auth_method, role, is_active, is_verified,
                        onboarding_state, created_at)
     VALUES ($1, $2, $3, $4, $5, 'email', 'participant', true, false, $6, NOW())
     RETURNING *`,
    [
      userId, email.toLowerCase(), passwordHash, firstName, lastName,
      JSON.stringify({ step: 'verify_email', consent_art: false, consent_gallery: false, consent_data: false })
    ]
  );
  const user = userResult.rows[0];

  // Send verification code
  const verifyCode = generateVerificationCode();
  await pool.query(
    "INSERT INTO verification_codes (user_id, email, code, purpose) VALUES ($1, $2, $3, 'email_verify')",
    [user.id, email.toLowerCase(), verifyCode]
  );

  await emailService.sendVerificationEmail(email, verifyCode);
  await logAuthEvent(user.id, 'register', req, { auth_method: 'email' });

  return { userId: user.user_id, message: 'Verification code sent to email.' };
}

async function registerWithPhone(phone, firstName, req) {
  const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) return { error: true, message: 'Phone already registered.' };

  const userId = 'U' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const userResult = await pool.query(
    `INSERT INTO users (user_id, phone, first_name, auth_method, role, is_active, is_verified,
                        onboarding_state, created_at)
     VALUES ($1, $2, $3, 'phone', 'participant', true, false, $4, NOW())
     RETURNING *`,
    [userId, phone, firstName, JSON.stringify({ step: 'verify_phone', consent_art: false, consent_gallery: false, consent_data: false })]
  );
  const user = userResult.rows[0];

  const otpCode = generateVerificationCode();
  await pool.query(
    "INSERT INTO verification_codes (user_id, phone, code, purpose) VALUES ($1, $2, $3, 'phone_verify')",
    [user.id, phone, otpCode]
  );

  await emailService.sendSMS(phone, `Your ASCEN verification code: ${otpCode}`);
  await logAuthEvent(user.id, 'register', req, { auth_method: 'phone' });

  return { userId: user.user_id, message: 'Verification code sent to phone.' };
}

// ── VERIFICATION ────────────────────────────────────────────

async function verifyCode(userId, code, purpose, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  if (userRow.rows.length === 0) return { error: true, message: 'User not found.' };
  const user = userRow.rows[0];

  const codeRow = await pool.query(
    "SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2 AND purpose = $3 AND used = false AND expires_at > NOW()",
    [user.id, code, purpose]
  );
  if (codeRow.rows.length === 0) return { error: true, message: 'Invalid or expired code.' };

  // Mark used
  await pool.query('UPDATE verification_codes SET used = true WHERE id = $1', [codeRow.rows[0].id]);

  // Activate user
  await pool.query(
    "UPDATE users SET is_verified = true, onboarding_state = jsonb_set(onboarding_state, '{step}', '\"consent\"') WHERE id = $1",
    [user.id]
  );

  // Generate wallet
  const wallet = await walletService.generateWallet(user.id);
  await logAuthEvent(user.id, 'wallet_generated', req, { wallet_address: wallet.walletAddress });

  // Lock disadvantage index at enrollment (non-blocking)
  try {
    const countyCode = 'PG';
    const census = await pool.query(
      "SELECT disadvantage_index FROM census_data WHERE geographic_level = 'county' AND geographic_code = $1",
      [countyCode]
    );
    const di = parseFloat(census.rows[0]?.disadvantage_index) || 0.5;
    const multiplier = Math.round((1.0 + di * 1.5) * 100) / 100;
    await pool.query(
      'UPDATE users SET county_code = $1, disadvantage_index_at_enrollment = $2, disadvantage_index_multiplier = $3 WHERE id = $4',
      [countyCode, di, multiplier, user.id]
    );
  } catch (err) {
    console.error('[AUTH] Disadvantage index setup failed (non-blocking):', err.message);
  }

  // Generate tokens
  const updatedUser = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
  const accessToken = generateJWT(updatedUser.rows[0]);
  const refreshToken = await generateRefreshToken(user.id, req?.headers?.['user-agent']);

  return { jwt: accessToken, refreshToken, onboardingState: { step: 'consent' } };
}

// ── LOGIN ───────────────────────────────────────────────────

async function loginWithFacilityPin(participantId, pin, req) {
  const userRow = await pool.query(
    'SELECT * FROM users WHERE (participant_id = $1 OR user_id = $1) AND is_active = true',
    [participantId]
  );
  if (userRow.rows.length === 0) return { error: true, message: 'Participant not found.' };
  const user = userRow.rows[0];

  if (await checkLockout(user.id)) {
    return { error: true, message: 'Account temporarily locked. Try again in 30 minutes.' };
  }

  if (!user.pin_hash) return { error: true, message: 'No PIN set for this account.' };

  const match = await bcrypt.compare(pin, user.pin_hash);
  if (!match) {
    await recordFailedLogin(user.id, req);
    return { error: true, message: 'Invalid PIN.' };
  }

  await resetFailedLogins(user.id);
  await pool.query('UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1', [user.id]);
  await logAuthEvent(user.id, 'login', req, { auth_method: 'facility_pin' });

  // Check forced password change
  if (user.password_changed === false) {
    const limitedToken = generateLimitedJWT(user);
    return { authenticated: true, must_change_password: true, jwt: limitedToken, user: { userId: user.user_id, firstName: user.first_name, role: user.role } };
  }

  const accessToken = generateJWT(user);
  const refreshToken = await generateRefreshToken(user.id, req?.headers?.['user-agent']);

  return { jwt: accessToken, refreshToken, user: { userId: user.user_id, firstName: user.first_name, role: user.role } };
}

async function loginWithEmail(email, password, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
  if (userRow.rows.length === 0) return { error: true, message: 'Invalid email or password.' };
  const user = userRow.rows[0];

  if (await checkLockout(user.id)) {
    return { error: true, message: 'Account temporarily locked. Try again in 30 minutes.' };
  }

  if (!user.password_hash) return { error: true, message: 'Invalid email or password.' };

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await recordFailedLogin(user.id, req);
    return { error: true, message: 'Invalid email or password.' };
  }

  if (!user.is_verified) return { error: true, message: 'Please verify your email first.' };

  await resetFailedLogins(user.id);
  await pool.query('UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1', [user.id]);
  await logAuthEvent(user.id, 'login', req, { auth_method: 'email' });

  // Check forced password change
  if (user.password_changed === false) {
    const limitedToken = generateLimitedJWT(user);
    return { authenticated: true, must_change_password: true, jwt: limitedToken, user: { userId: user.user_id, firstName: user.first_name, role: user.role } };
  }

  const accessToken = generateJWT(user);
  const refreshToken = await generateRefreshToken(user.id, req?.headers?.['user-agent']);

  return { jwt: accessToken, refreshToken, user: { userId: user.user_id, firstName: user.first_name, role: user.role } };
}

async function loginWithPhone(phone, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE phone = $1 AND is_active = true', [phone]);
  if (userRow.rows.length === 0) return { error: true, message: 'Phone not registered.' };

  const otpCode = generateVerificationCode();
  await pool.query(
    "INSERT INTO verification_codes (user_id, phone, code, purpose) VALUES ($1, $2, $3, 'phone_verify')",
    [userRow.rows[0].id, phone, otpCode]
  );

  await emailService.sendSMS(phone, `Your ASCEN login code: ${otpCode}`);
  return { message: 'OTP sent to phone.' };
}

async function verifyPhoneLogin(phone, otp, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE phone = $1 AND is_active = true', [phone]);
  if (userRow.rows.length === 0) return { error: true, message: 'Phone not registered.' };
  const user = userRow.rows[0];

  const codeRow = await pool.query(
    "SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2 AND purpose = 'phone_verify' AND used = false AND expires_at > NOW()",
    [user.id, otp]
  );
  if (codeRow.rows.length === 0) return { error: true, message: 'Invalid or expired code.' };

  await pool.query('UPDATE verification_codes SET used = true WHERE id = $1', [codeRow.rows[0].id]);
  await pool.query('UPDATE users SET is_verified = true, last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1', [user.id]);

  const accessToken = generateJWT(user);
  const refreshToken = await generateRefreshToken(user.id, req?.headers?.['user-agent']);
  await logAuthEvent(user.id, 'login', req, { auth_method: 'phone_otp' });

  return { jwt: accessToken, refreshToken };
}

// ── TOKEN MANAGEMENT ────────────────────────────────────────

async function refreshAccessToken(rawRefreshToken, req) {
  const hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const tokenRow = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()',
    [hash]
  );
  if (tokenRow.rows.length === 0) return { error: true, message: 'Invalid or expired refresh token.' };

  const userRow = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [tokenRow.rows[0].user_id]);
  if (userRow.rows.length === 0) return { error: true, message: 'User not found.' };

  const accessToken = generateJWT(userRow.rows[0]);

  // Rotate refresh token
  await pool.query("UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE id = $1", [tokenRow.rows[0].id]);
  const newRefreshToken = await generateRefreshToken(userRow.rows[0].id, req?.headers?.['user-agent']);
  await logAuthEvent(userRow.rows[0].id, 'token_refresh', req);

  return { jwt: accessToken, refreshToken: newRefreshToken };
}

async function logout(rawRefreshToken, req) {
  if (!rawRefreshToken) return { error: true, message: 'Refresh token required.' };
  const hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const result = await pool.query(
    "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1 RETURNING user_id",
    [hash]
  );
  if (result.rows.length > 0) {
    await logAuthEvent(result.rows[0].user_id, 'logout', req);
  }
  return { success: true };
}

// ── PASSWORD RESET ──────────────────────────────────────────

async function resetPassword(email, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
  if (userRow.rows.length === 0) return { message: 'If this email exists, a reset code has been sent.' };

  const code = generateVerificationCode();
  await pool.query(
    "INSERT INTO verification_codes (user_id, email, code, purpose) VALUES ($1, $2, $3, 'password_reset')",
    [userRow.rows[0].id, email.toLowerCase(), code]
  );

  await emailService.sendPasswordResetEmail(email, code);
  await logAuthEvent(userRow.rows[0].id, 'password_reset', req);

  return { message: 'If this email exists, a reset code has been sent.' };
}

async function completePasswordReset(email, code, newPassword, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (userRow.rows.length === 0) return { error: true, message: 'Invalid request.' };
  const user = userRow.rows[0];

  const codeRow = await pool.query(
    "SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2 AND purpose = 'password_reset' AND used = false AND expires_at > NOW()",
    [user.id, code]
  );
  if (codeRow.rows.length === 0) return { error: true, message: 'Invalid or expired code.' };

  if (!newPassword || newPassword.length < 8 || !/\d/.test(newPassword)) {
    return { error: true, message: 'Password must be at least 8 characters with at least 1 number.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
  await pool.query('UPDATE verification_codes SET used = true WHERE id = $1', [codeRow.rows[0].id]);

  // Revoke all refresh tokens
  await pool.query("UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE user_id = $1 AND revoked = false", [user.id]);

  return { success: true, message: 'Password updated. Please log in again.' };
}

// ── ENROLLMENT CODE MANAGEMENT ──────────────────────────────

async function generateCodes(createdByDbId, tenantId, assignedToName, programName, count, req) {
  const codes = [];
  for (let i = 0; i < (count || 1); i++) {
    const code = generateEnrollmentCode();
    const result = await pool.query(
      `INSERT INTO enrollment_codes (code, tenant_id, created_by, assigned_to_name, program_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING code, expires_at`,
      [code, tenantId, createdByDbId, assignedToName, programName]
    );
    codes.push(result.rows[0]);
    await logAuthEvent(createdByDbId, 'code_generated', req, { code, assigned_to: assignedToName });
  }
  return codes;
}

async function listCodes(createdByDbId, tenantId) {
  const result = await pool.query(
    'SELECT code, assigned_to_name, program_name, status, expires_at, created_at FROM enrollment_codes WHERE created_by = $1 OR tenant_id = $2 ORDER BY created_at DESC',
    [createdByDbId, tenantId]
  );
  return result.rows;
}

async function revokeCode(code) {
  const result = await pool.query(
    "UPDATE enrollment_codes SET status = 'revoked' WHERE code = $1 AND status = 'active' RETURNING code",
    [code]
  );
  if (result.rows.length === 0) return { error: true, message: 'Code not found or already used.' };
  return { revoked: true, code };
}

// ── GET CURRENT USER ────────────────────────────────────────

async function getCurrentUser(userDbId) {
  const result = await pool.query(
    `SELECT id, user_id, email, phone, first_name, last_name, role, is_active, is_verified,
            onboarding_state, participant_id, wallet_address, family_unit_id, tenant_id,
            total_sessions_completed, last_login_at, login_count, created_at
     FROM users WHERE id = $1`,
    [userDbId]
  );
  if (result.rows.length === 0) return null;
  const u = result.rows[0];
  // Never return password_hash, pin_hash, or wallet details
  return u;
}

// ── CHANGE PASSWORD (forced change gate) ────────────────────

async function changePassword(userId, currentPassword, newPassword, req) {
  const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userRow.rows.length === 0) return { error: true, message: 'User not found.' };
  const user = userRow.rows[0];

  // Validate current password (check both password_hash and pin_hash)
  let match = false;
  if (user.password_hash) {
    match = await bcrypt.compare(currentPassword, user.password_hash);
  }
  if (!match && user.pin_hash) {
    match = await bcrypt.compare(currentPassword, user.pin_hash);
  }
  if (!match) return { error: true, message: 'Current password is incorrect.' };

  // Validate new password
  if (!newPassword || newPassword.length < 8) {
    return { error: true, message: 'New password must be at least 8 characters.' };
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password_hash and mark password_changed = true
  await pool.query(
    'UPDATE users SET password_hash = $1, password_changed = true WHERE id = $2',
    [newHash, user.id]
  );

  await logAuthEvent(user.id, 'password_changed', req, { forced: true });

  // Return full-scope JWT
  const updatedUser = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
  const accessToken = generateJWT(updatedUser.rows[0]);
  const refreshToken = await generateRefreshToken(user.id, req?.headers?.['user-agent']);

  return { jwt: accessToken, refreshToken, user: { userId: user.user_id, firstName: user.first_name, role: user.role } };
}

module.exports = {
  registerWithFacilityCode,
  registerWithEmail,
  registerWithPhone,
  verifyCode,
  loginWithFacilityPin,
  loginWithEmail,
  loginWithPhone,
  verifyPhoneLogin,
  refreshAccessToken,
  logout,
  resetPassword,
  completePasswordReset,
  changePassword,
  generateCodes,
  listCodes,
  revokeCode,
  getCurrentUser,
  generateJWT
};
