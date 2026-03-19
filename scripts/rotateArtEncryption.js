#!/usr/bin/env node
// ============================================================
// Key Rotation Script — Art Encryption
// File: scripts/rotateArtEncryption.js
//
// Standalone script. NOT an API endpoint. Run manually.
//
// Usage:
//   DATABASE_URL=<url> ART_ENCRYPTION_KEY=<v1> ART_ENCRYPTION_KEY_V2=<v2> \
//     node scripts/rotateArtEncryption.js --version 2
//
// Operational protocol:
//   1. Breach detected or suspected
//   2. Generate new key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   3. Add to Railway as ART_ENCRYPTION_KEY_V2
//   4. Run this script
//   5. After completion: update ART_ENCRYPTION_KEY to v2 value in Railway
//   6. Retire v1 (archive, do not destroy — needed for audit)
//
// Important: Does NOT modify on-chain tokenURI. For pilot this is
// acceptable. Production would need a tokenURI update function.
//
// Estimated runtime: ~2 hours for 10,000 pieces (IPFS rate-limited).
// ============================================================

const { Pool } = require('pg');
const crypto = require('crypto');

// Parse args
const args = process.argv.slice(2);
let newVersion = 2;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--version' && args[i + 1]) {
    newVersion = parseInt(args[i + 1]);
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
const OLD_KEY = process.env.ART_ENCRYPTION_KEY;
const NEW_KEY = process.env.ART_ENCRYPTION_KEY_V2 || process.env[`ART_ENCRYPTION_KEY_V${newVersion}`];

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL required');
  process.exit(1);
}
if (!OLD_KEY || OLD_KEY.length < 32) {
  console.error('ERROR: ART_ENCRYPTION_KEY required (current key, min 32 hex chars)');
  process.exit(1);
}
if (!NEW_KEY || NEW_KEY.length < 32) {
  console.error(`ERROR: ART_ENCRYPTION_KEY_V2 required (new key, min 32 hex chars)`);
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error('ERROR: Old and new keys are identical');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── ENCRYPTION HELPERS ──────────────────────────────────────

function decrypt(encryptedString, key) {
  const [ivHex, cipherHex] = encryptedString.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const keyBuf = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

function encrypt(payload, key) {
  const iv = crypto.randomBytes(16);
  const keyBuf = Buffer.from(key, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
  const jsonStr = JSON.stringify(payload);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// ── IPFS HELPERS ────────────────────────────────────────────

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

async function fetchIPFSMetadata(ipfsHash) {
  const url = `${PINATA_GATEWAY}/${ipfsHash}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`IPFS fetch failed: ${response.status}`);
  return response.json();
}

async function uploadJSONToPinata(metadata, name) {
  const PINATA_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET = process.env.PINATA_SECRET_KEY;

  if (!PINATA_KEY || !PINATA_SECRET) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY required for IPFS upload');
  }

  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: { name, keyvalues: { app: 'ascen-breathworx', type: 'rotated-metadata' } }
  });

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: PINATA_KEY,
      pinata_secret_api_key: PINATA_SECRET
    },
    body
  });

  if (!response.ok) throw new Error(`Pinata upload failed: ${response.status}`);
  const data = await response.json();
  return data.IpfsHash;
}

// ── MAIN ROTATION ───────────────────────────────────────────

async function rotate() {
  const startTime = Date.now();
  const currentVersion = newVersion - 1;
  let totalRotated = 0;
  let totalErrors = 0;

  console.log('=== ART ENCRYPTION KEY ROTATION ===');
  console.log(`Rotating from version ${currentVersion} to version ${newVersion}`);
  console.log(`Old key: ${OLD_KEY.slice(0, 8)}...`);
  console.log(`New key: ${NEW_KEY.slice(0, 8)}...`);
  console.log('');

  // Log rotation start
  await pool.query(
    `INSERT INTO encryption_key_audit (key_version, action, initiated_by)
     VALUES ($1, 'rotation_started', $2)`,
    [newVersion, 'scripts/rotateArtEncryption.js']
  );

  // Fetch all records to rotate
  const countResult = await pool.query(
    `SELECT COUNT(*) as c FROM session_completions
     WHERE art_ipfs_hash IS NOT NULL AND (art_encoding_version = $1 OR art_encoding_version IS NULL)`,
    [currentVersion]
  );
  const totalRecords = parseInt(countResult.rows[0].c);
  console.log(`Total records to rotate: ${totalRecords}`);
  console.log('');

  if (totalRecords === 0) {
    console.log('No records to rotate. Exiting.');
    await pool.end();
    return;
  }

  // Process in batches of 100
  const BATCH_SIZE = 100;
  let offset = 0;

  while (offset < totalRecords) {
    const batch = await pool.query(
      `SELECT id, user_id, session_id, art_ipfs_hash, art_encoding_version
       FROM session_completions
       WHERE art_ipfs_hash IS NOT NULL AND (art_encoding_version = $1 OR art_encoding_version IS NULL)
       ORDER BY completed_at ASC
       LIMIT $2 OFFSET $3`,
      [currentVersion, BATCH_SIZE, offset]
    );

    for (const row of batch.rows) {
      try {
        // 1. Fetch metadata from IPFS
        const metadata = await fetchIPFSMetadata(row.art_ipfs_hash);

        if (!metadata.clinical_payload) {
          console.warn(`  [SKIP] ${row.session_id}: no clinical_payload in metadata`);
          offset++;
          continue;
        }

        // 2. Decrypt with old key
        const clinicalData = decrypt(metadata.clinical_payload, OLD_KEY);

        // 3. Re-encrypt with new key
        const newEncrypted = encrypt(clinicalData, NEW_KEY);

        // 4. Build new metadata
        const newMetadata = { ...metadata, clinical_payload: newEncrypted };

        // 5. Upload to IPFS
        const newMetadataHash = await uploadJSONToPinata(
          newMetadata,
          `rotated-v${newVersion}-${row.session_id || row.id}`
        );

        // 6. Update PostgreSQL
        await pool.query(
          `UPDATE session_completions
           SET art_ipfs_hash = $1, art_encoding_version = $2
           WHERE id = $3`,
          [newMetadataHash, newVersion, row.id]
        );

        totalRotated++;
      } catch (err) {
        totalErrors++;
        console.error(`  [ERROR] ${row.session_id || row.id}: ${err.message}`);
      }
    }

    offset += batch.rows.length;

    // Progress log every batch
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  Progress: ${Math.min(offset, totalRecords)}/${totalRecords} (${elapsed}s elapsed, ${totalErrors} errors)`);

    // Rate limit: 500ms between batches to avoid IPFS throttling
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Log rotation completion
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  await pool.query(
    `INSERT INTO encryption_key_audit (key_version, action, affected_records, initiated_by, completed_at)
     VALUES ($1, 'rotation_completed', $2, $3, NOW())`,
    [newVersion, totalRotated, 'scripts/rotateArtEncryption.js']
  );

  console.log('');
  console.log('=== ROTATION COMPLETE ===');
  console.log(`Total rotated: ${totalRotated}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Time elapsed: ${totalElapsed}s`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Update ART_ENCRYPTION_KEY to v${newVersion} value in Railway`);
  console.log(`  2. Set ART_ENCRYPTION_KEY_V${currentVersion} to the old key value (for decode fallback)`);
  console.log(`  3. Archive v${currentVersion} key — do NOT destroy (audit trail)`);

  await pool.end();
}

rotate().catch(err => {
  console.error('ROTATION FAILED:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
