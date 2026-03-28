#!/usr/bin/env node
// ============================================================
// Seed PGC-CRC Clinician Accounts
// Site: Prince George's County Community Resource Center
//
// DO NOT RUN until Clay provides credentials for:
//   1. Jenae (Clinical Director, LCPC) — clinician role
//   2. Dr. Astrada (Medical Director, MD) — clinician role
//
// Required per account: full name, email, temporary password
// Then: generate bcrypt hashes and fill in the placeholders below.
//
// Generate hashes:
//   node -e "require('bcryptjs').hash('PASSWORD', 12).then(h => console.log(h))"
// ============================================================

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const BCRYPT_ROUNDS = 12;

// ── FILL THESE IN WHEN CLAY PROVIDES CREDENTIALS ─────────────
const ACCOUNTS = [
  {
    label: 'Jenae — Clinical Director, LCPC',
    firstName: null,   // e.g. 'Jenae'
    lastName: null,     // e.g. 'LastName'
    email: null,        // e.g. 'jenae@pgc-crc.org'
    password: null,     // e.g. 'TempPassword123!'
    role: 'clinician',
  },
  {
    label: 'Dr. Astrada — Medical Director, MD',
    firstName: null,   // e.g. 'FirstName'
    lastName: null,     // e.g. 'Astrada'
    email: null,        // e.g. 'astrada@pgc-crc.org'
    password: null,     // e.g. 'TempPassword123!'
    role: 'clinician',
  },
];
// ──────────────────────────────────────────────────────────────

async function seed() {
  // Validate all accounts have credentials before touching DB
  for (const acct of ACCOUNTS) {
    if (!acct.firstName || !acct.lastName || !acct.email || !acct.password) {
      console.error(`ABORT: Missing credentials for "${acct.label}".`);
      console.error('Fill in firstName, lastName, email, and password in this script first.');
      console.error('Do NOT run until Clay provides these values.');
      process.exit(1);
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify ASCEN tenant
    const tenantRow = await client.query("SELECT id FROM tenants WHERE slug = 'ascen'");
    if (tenantRow.rows.length === 0) throw new Error('ASCEN tenant not found');
    const tenantId = tenantRow.rows[0].id;
    console.log('[1] ASCEN tenant:', tenantId);

    const onboardingComplete = JSON.stringify({
      step: 'complete', consent_art: true, consent_gallery: true, consent_data: true
    });

    const results = [];

    for (let i = 0; i < ACCOUNTS.length; i++) {
      const acct = ACCOUNTS[i];
      const step = i + 2;

      const existing = await client.query(
        'SELECT id, user_id, email, role FROM users WHERE email = $1',
        [acct.email.toLowerCase()]
      );

      let user;
      if (existing.rows.length > 0) {
        user = existing.rows[0];
        console.log(`[${step}] ${acct.label} already exists: ${user.user_id}`);
      } else {
        const hash = await bcrypt.hash(acct.password, BCRYPT_ROUNDS);
        const userId = 'UCLN' + crypto.randomBytes(3).toString('hex').toUpperCase();

        const result = await client.query(
          `INSERT INTO users (user_id, first_name, last_name, email, password_hash,
                              auth_method, role, is_active, is_verified,
                              tenant_id, onboarding_state, jurisdiction_code, county_code, created_at)
           VALUES ($1, $2, $3, $4, $5, 'email', $6, true, true, $7, $8, 'MD-PG', 'PG', NOW())
           RETURNING id, user_id, email, role`,
          [userId, acct.firstName, acct.lastName, acct.email.toLowerCase(), hash,
           acct.role, tenantId, onboardingComplete]
        );
        user = result.rows[0];
        console.log(`[${step}] ${acct.label} created: ${user.user_id}`);
      }

      results.push({ ...acct, dbId: user.id, userId: user.user_id });
    }

    await client.query('COMMIT');

    console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
    console.log(' PGC-CRC CLINICIAN ACCOUNTS');
    console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
    for (const r of results) {
      console.log(`\n ${r.label}`);
      console.log(`   DB ID:    ${r.dbId}`);
      console.log(`   user_id:  ${r.userId}`);
      console.log(`   Email:    ${r.email}`);
      console.log(`   Password: ${r.password}`);
      console.log(`   Role:     ${r.role}`);
    }
    console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('SEED FAILED:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
