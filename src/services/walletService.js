// ============================================================
// Wallet Service — Silent Embedded Wallet Generation
// File: src/services/walletService.js
//
// Generates Polygon wallets at registration. Participant never
// sees their wallet. Private keys encrypted at rest with
// WALLET_ENCRYPTION_KEY (separate from all other encryption keys).
// ============================================================

const { ethers } = require('ethers');
const crypto = require('crypto');
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Generate and store an embedded wallet for a user.
 * @param {number} userDbId - users.id
 * @returns {Promise<Object>} { walletAddress }
 */
async function generateWallet(userDbId) {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 64) {
    console.warn('[Wallet] WALLET_ENCRYPTION_KEY not set or too short — skipping wallet generation');
    return { walletAddress: null };
  }

  try {
    const wallet = ethers.Wallet.createRandom();

    // Encrypt private key
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Store wallet address on user
    await pool.query('UPDATE users SET wallet_address = $1 WHERE id = $2', [wallet.address, userDbId]);

    // Store encrypted private key separately
    await pool.query(
      `INSERT INTO user_wallets (user_id, encrypted_private_key, iv, wallet_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET encrypted_private_key = EXCLUDED.encrypted_private_key, iv = EXCLUDED.iv, wallet_address = EXCLUDED.wallet_address`,
      [userDbId, encrypted, iv.toString('hex'), wallet.address]
    );

    return { walletAddress: wallet.address };
  } catch (err) {
    console.error('[Wallet] Generation failed:', err.message);
    Sentry.captureException(err);
    return { walletAddress: null };
  }
}

/**
 * Recover wallet for signing transactions.
 * @param {number} userDbId
 * @returns {Promise<ethers.Wallet>}
 */
async function getWalletForSigning(userDbId) {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('WALLET_ENCRYPTION_KEY not set');

  const result = await pool.query(
    'SELECT encrypted_private_key, iv FROM user_wallets WHERE user_id = $1',
    [userDbId]
  );

  if (!result.rows.length) throw new Error('No wallet found for user');

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(encryptionKey, 'hex'),
    Buffer.from(result.rows[0].iv, 'hex')
  );
  let decrypted = decipher.update(result.rows[0].encrypted_private_key, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return new ethers.Wallet(decrypted);
}

module.exports = { generateWallet, getWalletForSigning };
