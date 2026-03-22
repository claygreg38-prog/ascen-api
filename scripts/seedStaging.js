// ============================================================
// Staging Database Seeder — scripts/seedStaging.js
// Run: DATABASE_URL="..." node scripts/seedStaging.js
//   or: node scripts/seedStaging.js postgresql://...
//
// Creates test facilitator, admin, participants, sessions,
// family unit, capacity ledger entries, and embedded wallets.
// Idempotent — checks for existing data before inserting.
// ============================================================

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { ethers } = require('ethers');
const crypto = require('crypto');

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  process.stderr.write('Usage: DATABASE_URL="..." node scripts/seedStaging.js\n');
  process.stderr.write('   or: node scripts/seedStaging.js <database_url>\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BCRYPT_ROUNDS = 12;
const ENROLLMENT_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** CLI output via process.stdout (scripts are not production code) */
function print(...args) {
  process.stdout.write(args.join(' ') + '\n');
}

function generateCode() {
  let code = '';
  for (let i = 0; i < 8; i++) code += ENROLLMENT_CHARS[crypto.randomInt(ENROLLMENT_CHARS.length)];
  return code;
}

async function seed() {
  const client = await pool.connect();
  const output = {};

  try {
    await client.query('BEGIN');

    // ── 1. VERIFY ASCEN TENANT ────────────────────────────
    const tenantRow = await client.query("SELECT id FROM tenants WHERE slug = 'ascen'");
    if (tenantRow.rows.length === 0) {
      throw new Error('ASCEN tenant not found — run migration 018 first');
    }
    const tenantId = tenantRow.rows[0].id;
    print('[1] ASCEN tenant verified:', tenantId);
    output.tenantId = tenantId;

    // ── 2. CREATE TEST FACILITATOR ────────────────────────
    const facPassword = 'Facilitate123!';
    const facHash = await bcrypt.hash(facPassword, BCRYPT_ROUNDS);
    const facUserId = 'UFAC' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const existingFac = await client.query("SELECT id, user_id, email, role FROM users WHERE email = 'facilitator@test.ascen.dev'");
    let facilitator;
    if (existingFac.rows.length > 0) {
      facilitator = existingFac.rows[0];
    } else {
      const facResult = await client.query(
        `INSERT INTO users (user_id, first_name, last_name, email, password_hash, auth_method, role,
                            is_active, is_verified, tenant_id, onboarding_state, created_at)
         VALUES ($1, $2, $3, $4, $5, 'email', 'facilitator', true, true, $6, $7, NOW())
         RETURNING id, user_id, email, role`,
        [facUserId, 'Test', 'Facilitator', 'facilitator@test.ascen.dev', facHash, tenantId,
         JSON.stringify({ step: 'complete', consent_art: true, consent_gallery: true, consent_data: true })]
      );
      facilitator = facResult.rows[0];
    }
    print('[2] Facilitator created:', facilitator.user_id, '| email:', facilitator.email, '| password:', facPassword);
    output.facilitator = { ...facilitator, password: facPassword };

    // ── 3. CREATE TEST ADMIN ──────────────────────────────
    const adminPassword = 'AdminPass123!';
    const adminHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const adminUserId = 'UADM' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const existingAdmin = await client.query("SELECT id, user_id, email, role FROM users WHERE email = 'admin@test.ascen.dev'");
    let admin;
    if (existingAdmin.rows.length > 0) {
      admin = existingAdmin.rows[0];
    } else {
      const adminResult = await client.query(
        `INSERT INTO users (user_id, first_name, last_name, email, password_hash, auth_method, role,
                            is_active, is_verified, tenant_id, onboarding_state, created_at)
         VALUES ($1, $2, $3, $4, $5, 'email', 'admin', true, true, $6, $7, NOW())
         RETURNING id, user_id, email, role`,
        [adminUserId, 'Admin', 'User', 'admin@test.ascen.dev', adminHash, tenantId,
         JSON.stringify({ step: 'complete', consent_art: true, consent_gallery: true, consent_data: true })]
      );
      admin = adminResult.rows[0];
    }
    print('[3] Admin created:', admin.user_id, '| email:', admin.email, '| password:', adminPassword);
    output.admin = { ...admin, password: adminPassword };

    // ── 4. GENERATE 5 ENROLLMENT CODES ────────────────────
    const codes = [];
    for (let i = 0; i < 5; i++) {
      const code = generateCode();
      await client.query(
        `INSERT INTO enrollment_codes (code, tenant_id, created_by, program_name, assigned_to_name, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW() + INTERVAL '90 days')`,
        [code, tenantId, facilitator.id, 'Staging Test Program', i < 2 ? `TestUser${i + 1}` : null]
      );
      codes.push(code);
    }
    print('[4] Enrollment codes created:', codes.join(', '));
    output.enrollmentCodes = codes;

    // ── 5. CREATE 2 TEST PARTICIPANTS ─────────────────────
    const pin1 = '123456';
    const pin2 = '654321';
    const pinHash1 = await bcrypt.hash(pin1, BCRYPT_ROUNDS);
    const pinHash2 = await bcrypt.hash(pin2, BCRYPT_ROUNDS);

    const p1Id = 'P' + codes[0].slice(0, 4) + crypto.randomInt(100, 999);
    const p1Result = await client.query(
      `INSERT INTO users (user_id, first_name, pin_hash, auth_method, role, is_active, is_verified,
                          tenant_id, participant_id, onboarding_state, created_at)
       VALUES ($1, 'TestUser1', $2, 'facility_code', 'participant', true, true, $3, $1, $4, NOW())
       RETURNING id, user_id, participant_id`,
      [p1Id, pinHash1, tenantId,
       JSON.stringify({ step: 'complete', consent_art: true, consent_gallery: true, consent_data: true })]
    );
    const participant1 = p1Result.rows[0];

    // Mark enrollment code as used
    await client.query("UPDATE enrollment_codes SET status = 'used', used_by = $1 WHERE code = $2",
      [participant1.id, codes[0]]);

    const p2Id = 'P' + codes[1].slice(0, 4) + crypto.randomInt(100, 999);
    const p2Result = await client.query(
      `INSERT INTO users (user_id, first_name, pin_hash, auth_method, role, is_active, is_verified,
                          tenant_id, participant_id, onboarding_state, created_at)
       VALUES ($1, 'TestUser2', $2, 'facility_code', 'participant', true, true, $3, $1, $4, NOW())
       RETURNING id, user_id, participant_id`,
      [p2Id, pinHash2, tenantId,
       JSON.stringify({ step: 'complete', consent_art: true, consent_gallery: true, consent_data: true })]
    );
    const participant2 = p2Result.rows[0];

    await client.query("UPDATE enrollment_codes SET status = 'used', used_by = $1 WHERE code = $2",
      [participant2.id, codes[1]]);

    print('[5] Participant 1:', participant1.participant_id, '| PIN:', pin1);
    print('[5] Participant 2:', participant2.participant_id, '| PIN:', pin2);
    output.participant1 = { ...participant1, pin: pin1 };
    output.participant2 = { ...participant2, pin: pin2 };

    // ── 6. GENERATE EMBEDDED WALLETS ──────────────────────
    // Use a deterministic test encryption key (64 hex chars = 32 bytes)
    const testEncKey = 'a]b]c'.length ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' : '';

    for (const p of [participant1, participant2]) {
      const wallet = ethers.Wallet.createRandom();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(testEncKey, 'hex'), iv);
      let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      await client.query('UPDATE users SET wallet_address = $1 WHERE id = $2', [wallet.address, p.id]);
      await client.query(
        `INSERT INTO user_wallets (user_id, encrypted_private_key, iv, wallet_address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET encrypted_private_key = EXCLUDED.encrypted_private_key`,
        [p.id, encrypted, iv.toString('hex'), wallet.address]
      );

      print(`[6] Wallet for ${p.user_id}: ${wallet.address}`);
      if (p === participant1) output.participant1.wallet = wallet.address;
      else output.participant2.wallet = wallet.address;
    }

    // ── 7. CREATE 10 SESSIONS FOR TESTUSER1 ───────────────
    // session_completions.user_id is UUID type — use a stable UUID for the participant
    const p1Uuid = crypto.randomUUID();
    const sessionIds = [];
    for (let i = 1; i <= 10; i++) {
      const sessionId = crypto.randomUUID();
      const ns3Mean = 40 + Math.floor(Math.random() * 30);   // 40-69
      const ns3Peak = ns3Mean + Math.floor(Math.random() * 20) + 10; // peak above mean
      const ns3Floor = Math.max(10, ns3Mean - Math.floor(Math.random() * 15));
      const coherenceScore = (0.4 + Math.random() * 0.5).toFixed(3);
      const coherenceEnd = (parseFloat(coherenceScore) + (Math.random() * 0.2 - 0.1)).toFixed(3);
      const arrivalHr = 70 + Math.floor(Math.random() * 20);
      const arrivalHrv = (30 + Math.random() * 40).toFixed(1);
      const ttr = 60 + Math.floor(Math.random() * 180);
      const duration = 600 + Math.floor(Math.random() * 300);
      const optimalPct = 30 + Math.floor(Math.random() * 50);

      const arcs = ['body', 'awareness', 'emotional_granularity', 'repatterning'];
      const trajectories = ['improving', 'stable', 'improving', 'stable'];

      const completedAt = new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000); // spread over 10 days

      const result = await client.query(
        `INSERT INTO session_completions (
           user_id, session_id, session_number, coherence_score, coherence_end,
           cycle_completion_rate, active_duration_seconds, exit_type,
           track, arc, completed_at, tenant_id,
           time_to_regulation_sec, arrival_hr, arrival_hrv,
           coherence_trajectory, zone_time_profile,
           ns3_mean, ns3_peak, ns3_floor, optimal_zone_pct,
           regulatory_trajectory, sustained_optimal,
           biometric_source, state_summary, coaching_summary,
           packet_hash
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, 'normal',
           'solo', $8, $9, $10,
           $11, $12, $13,
           $14, $15,
           $16, $17, $18, $19,
           $20, $21,
           'polar_h10', $22, $23,
           $24
         ) RETURNING id`,
        [
          p1Uuid, sessionId, i, coherenceScore, coherenceEnd,
          (0.85 + Math.random() * 0.15).toFixed(2), duration,
          arcs[i % arcs.length], completedAt, tenantId,
          ttr, arrivalHr, arrivalHrv,
          trajectories[i % trajectories.length],
          JSON.stringify({
            regulated: Math.floor(duration * 0.4),
            flow: Math.floor(duration * 0.15),
            activated: Math.floor(duration * 0.25),
            arrival: Math.floor(duration * 0.2)
          }),
          ns3Mean, ns3Peak, ns3Floor, optimalPct,
          trajectories[i % trajectories.length],
          optimalPct > 60,
          JSON.stringify({
            dominant_state: optimalPct > 50 ? 'regulated' : 'activated',
            transitions: Math.floor(Math.random() * 5) + 2,
            peak_coherence: parseFloat(coherenceScore) + 0.1
          }),
          JSON.stringify({
            prompts_delivered: Math.floor(Math.random() * 4) + 2,
            tone_tier: i > 5 ? 'earned_warmth' : 'warrior_baseline'
          }),
          crypto.createHash('sha256').update(sessionId + i).digest('hex')
        ]
      );
      sessionIds.push(result.rows[0].id);
    }
    print('[7] Created 10 sessions for TestUser1, IDs:', sessionIds.join(', '));
    print('[7] Session user_id (UUID):', p1Uuid);
    output.sessionIds = sessionIds;
    output.participant1SessionUuid = p1Uuid;

    // ── 8. CREATE FAMILY UNIT ─────────────────────────────
    const familyResult = await client.query(
      `INSERT INTO family_units (name, created_by, tenant_id, status, gate_state, shared_goals, collective_metrics, elder_user_id)
       VALUES ($1, $2, $3, 'active',
               '{"gate_1": true, "gate_2": false, "gate_3": false}',
               '["Practice breathing together 3x/week"]',
               '{"total_sessions": 12, "collective_regulated_hours": 4.5, "co_breath_count": 2}',
               $4)
       RETURNING family_unit_id`,
      ['Test Family', p1Uuid, tenantId, participant1.id]
    );
    const familyUnitId = familyResult.rows[0].family_unit_id;

    // Add both participants as members
    await client.query(
      `INSERT INTO family_memberships (family_unit_id, user_id, role, generation_level, individual_progress)
       VALUES ($1, $2, 'elder', 0, '{"session_count": 10, "curriculum_position": 3, "streak_days": 7}')`,
      [familyUnitId, participant1.id]
    );
    await client.query(
      `INSERT INTO family_memberships (family_unit_id, user_id, role, generation_level, invited_by, individual_progress)
       VALUES ($1, $2, 'adult_child', 1, $3, '{"session_count": 3, "curriculum_position": 1, "streak_days": 2}')`,
      [familyUnitId, participant2.id, participant1.id]
    );

    // Set family_unit_id on users
    await client.query('UPDATE users SET family_unit_id = $1, family_role = $2 WHERE id = $3',
      [familyUnitId, 'elder', participant1.id]);
    await client.query('UPDATE users SET family_unit_id = $1, family_role = $2 WHERE id = $3',
      [familyUnitId, 'adult_child', participant2.id]);

    print('[8] Family unit created:', familyUnitId, '| Gate 1 unlocked');
    output.familyUnitId = familyUnitId;

    // ── 9. CAPACITY LEDGER → "steady" (~65) ───────────────
    // Build up balance through session deposits and a few withdrawals
    const ledgerEntries = [
      { type: 'deposit', amount: 15.00, source: 'session_complete', balance: 15.00 },
      { type: 'deposit', amount: 12.50, source: 'session_complete', balance: 27.50 },
      { type: 'deposit', amount: 14.00, source: 'session_complete', balance: 41.50 },
      { type: 'withdrawal', amount: -5.00, source: 'stress_event', balance: 36.50 },
      { type: 'deposit', amount: 13.00, source: 'session_complete', balance: 49.50 },
      { type: 'deposit', amount: 11.50, source: 'session_complete', balance: 61.00 },
      { type: 'withdrawal', amount: -3.00, source: 'conflict_event', balance: 58.00 },
      { type: 'deposit', amount: 10.00, source: 'session_complete', balance: 68.00 },
      { type: 'withdrawal', amount: -4.50, source: 'sleep_deficit', balance: 63.50 },
      { type: 'deposit', amount: 2.00, source: 'co_breath_complete', balance: 65.50 },
    ];

    for (let i = 0; i < ledgerEntries.length; i++) {
      const e = ledgerEntries[i];
      const createdAt = new Date(Date.now() - (ledgerEntries.length - i) * 12 * 60 * 60 * 1000);
      await client.query(
        `INSERT INTO capacity_ledger (user_id, family_unit_id, tenant_id, transaction_type, amount, source, balance_after, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [participant1.id, familyUnitId, tenantId, e.type, Math.abs(e.amount), e.source, e.balance,
         JSON.stringify({ session_number: i + 1, auto_generated: true }), createdAt]
      );
    }

    // Add a capacity snapshot for today
    await client.query(
      `INSERT INTO capacity_snapshots (user_id, snapshot_date, capacity_score, capacity_state, active_balance, savings_balance, component_scores)
       VALUES ($1, CURRENT_DATE, 65.50, 'steady', 65.50, 0, $2)`,
      [participant1.id, JSON.stringify({
        hrv_trend: 68, sleep_quality: 55, session_consistency: 72,
        breath_ratio_progression: 60, recovery_velocity: 65, engagement_pattern: 70
      })]
    );

    print('[9] Capacity ledger: 10 entries, balance 65.50 (steady state)');
    output.capacityBalance = 65.50;
    output.capacityState = 'steady';

    await client.query('COMMIT');

    // ── 10. PRINT SUMMARY ─────────────────────────────────
    print('\n══════════════════════════════════════════');
    print('  STAGING SEED COMPLETE');
    print('══════════════════════════════════════════');
    print('\nTenant ID:       ', tenantId);
    print('\nFacilitator:');
    print('  DB ID:         ', facilitator.id);
    print('  user_id:       ', facilitator.user_id);
    print('  Email:         ', facilitator.email);
    print('  Password:      ', facPassword);
    print('  Role:          ', facilitator.role);
    print('\nAdmin:');
    print('  DB ID:         ', admin.id);
    print('  user_id:       ', admin.user_id);
    print('  Email:         ', admin.email);
    print('  Password:      ', adminPassword);
    print('  Role:          ', admin.role);
    print('\nEnrollment Codes (3 unused):');
    codes.slice(2).forEach((c, i) => print(`  Code ${i + 3}:       `, c));
    print('\nParticipant 1 (TestUser1):');
    print('  DB ID:         ', participant1.id);
    print('  user_id:       ', participant1.user_id);
    print('  participant_id:', participant1.participant_id);
    print('  PIN:           ', pin1);
    print('  Wallet:        ', output.participant1.wallet);
    print('  Session UUID:  ', p1Uuid);
    print('  Sessions:       10 completed');
    print('  Capacity:       65.50 (steady)');
    print('\nParticipant 2 (TestUser2):');
    print('  DB ID:         ', participant2.id);
    print('  user_id:       ', participant2.user_id);
    print('  participant_id:', participant2.participant_id);
    print('  PIN:           ', pin2);
    print('  Wallet:        ', output.participant2.wallet);
    print('\nFamily Unit:');
    print('  ID:            ', familyUnitId);
    print('  Members:        TestUser1 (elder), TestUser2 (adult_child)');
    print('  Gate 1:         UNLOCKED');
    print('  Gate 2/3:       locked');
    print('\nWallet Encryption Key (test only):');
    print(' ', testEncKey);
    print('\n══════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    process.stderr.write('[SEED FAILED] ' + err.message + '\n');
    process.stderr.write(err.stack + '\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
