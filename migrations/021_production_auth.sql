-- Migration 021: Production Auth + Onboarding + Embedded Wallets
-- Session 16: Auth tables, enrollment codes, wallets, audit log

-- Expand users table (ADD COLUMN IF NOT EXISTS for safety)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'facility_code';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'participant';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_state JSONB DEFAULT '{"step": "pending", "consent_art": false, "consent_gallery": false, "consent_data": false}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS participant_id VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  device_info VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollment codes (facility-issued)
CREATE TABLE IF NOT EXISTS enrollment_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  facility_id UUID,
  program_name VARCHAR(100),
  created_by INTEGER REFERENCES users(id),
  assigned_to_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  used_by INTEGER REFERENCES users(id),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification codes (email/phone/reset)
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id),
  email VARCHAR(255),
  phone VARCHAR(20),
  code VARCHAR(6) NOT NULL,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('email_verify', 'phone_verify', 'password_reset')),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User wallets (encrypted private keys)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auth audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'register', 'login', 'login_failed', 'logout', 'password_reset',
    'token_refresh', 'code_generated', 'code_used', 'account_locked',
    'wallet_generated'
  )),
  ip_address VARCHAR(45),
  device_info VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_participant_id ON users(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_enrollment_codes_code ON enrollment_codes(code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_verification_codes_active ON verification_codes(user_id, purpose) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id);
