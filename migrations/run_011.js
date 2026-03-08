// ============================================================
// Migration 011 Runner — Combined Ledger Sync Schema
// Run: node migrations/run_011.js
//
// Reads and executes 011_combined_ledger_sync.sql against DATABASE_URL
// ============================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const sqlPath = path.join(__dirname, '011_combined_ledger_sync.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('[MIGRATION 011] Starting Combined Ledger Sync Schema...');

  try {
    await pool.query(sql);
    console.log('[MIGRATION 011] Schema applied successfully.');

    // Verification
    const verify = await pool.query(`
      SELECT
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'wallet_address') AS users_wallet,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'active_modalities') AS users_modalities,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'session_completions' AND column_name = 'packet_hash') AS sc_packet_hash,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'session_completions' AND column_name = 'time_to_regulation_sec') AS sc_ttr,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'session_completions' AND column_name = 'zone_time_profile') AS sc_zones,
        (SELECT count(*) FROM information_schema.tables WHERE table_name = 'family_units') AS family_units,
        (SELECT count(*) FROM information_schema.tables WHERE table_name = 'attestation_queue') AS attestation_queue,
        (SELECT count(*) FROM information_schema.tables WHERE table_name = 'contract_registry') AS contract_registry,
        (SELECT count(*) FROM information_schema.tables WHERE table_name = 'modality_completion_profiles') AS modality_profiles
    `);

    const r = verify.rows[0];
    const checks = [
      ['users.wallet_address', r.users_wallet],
      ['users.active_modalities', r.users_modalities],
      ['session_completions.packet_hash', r.sc_packet_hash],
      ['session_completions.time_to_regulation_sec', r.sc_ttr],
      ['session_completions.zone_time_profile', r.sc_zones],
      ['family_units table', r.family_units],
      ['attestation_queue table', r.attestation_queue],
      ['contract_registry table', r.contract_registry],
      ['modality_completion_profiles table', r.modality_profiles]
    ];

    console.log('\n[MIGRATION 011] Verification:');
    let allGood = true;
    for (const [name, val] of checks) {
      const ok = parseInt(val) > 0;
      console.log(`  ${ok ? '✓' : '✗'} ${name}`);
      if (!ok) allGood = false;
    }

    if (allGood) {
      console.log('\n[MIGRATION 011] All checks passed. Migration complete.');
    } else {
      console.error('\n[MIGRATION 011] Some checks failed — review output above.');
      process.exit(1);
    }
  } catch (err) {
    console.error('[MIGRATION 011] Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
