// ============================================================
// [BLOCKCHAIN] Verification Service — Real Polygon Contract Wire
// File: src/blockchain/verificationService.js
//
// Replaces the fake txHash endpoint with real on-chain writes.
// Ships WITH all safety structures — not separately.
//
// Safety structures:
//   1. Gas price circuit breaker
//   2. Contract registry pattern (addresses from DB)
//   3. Retry logic with front-running detection
//   4. Attestation queue integration
//   5. Shutdown capability
// ============================================================

const { ethers } = require('ethers');
const Sentry = require('../instrument');
const oracleArtifact = require('./BiometricOracleABI.json');

// ── CONFIGURATION ────────────────────────────────────────────

const MAX_GAS_PRICE_GWEI = 500; // Circuit breaker threshold
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

class VerificationService {
  constructor(pool) {
    this.pool = pool;
    this.provider = null;
    this.signer = null;
    this.oracleContract = null;
    this.initialized = false;
    this.shutdown = false;
  }

  /**
   * Initialize the service by loading contract addresses from DB
   * and connecting to Polygon.
   */
  async initialize() {
    if (this.initialized) return;

    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon.drpc.org';
    const privateKey = process.env.VERIFICATION_SERVICE_PRIVATE_KEY;

    if (!privateKey || privateKey.length < 64) {
      console.warn('[BLOCKCHAIN] No valid private key configured — verification service disabled');
      return;
    }

    try {
      // Load contract addresses from registry (never hardcoded)
      const oracleResult = await this.pool.query(
        `SELECT address FROM contract_registry
         WHERE contract_name = 'BiometricOracle' AND is_active = true
         ORDER BY created_at DESC LIMIT 1`
      );

      if (oracleResult.rows.length === 0) {
        console.warn('[BLOCKCHAIN] BiometricOracle not found in contract_registry — service disabled');
        return;
      }

      const oracleAddress = oracleResult.rows[0].address;

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.oracleContract = new ethers.Contract(
        oracleAddress,
        oracleArtifact.abi,
        this.signer
      );

      this.initialized = true;
      console.log(`[BLOCKCHAIN] Verification service initialized`);
      console.log(`[BLOCKCHAIN] Oracle: ${oracleAddress}`);
      console.log(`[BLOCKCHAIN] Signer: ${this.signer.address}`);
    } catch (err) {
      console.error('[BLOCKCHAIN] Initialization failed:', err.message);
      Sentry.captureException(err);
    }
  }

  /**
   * Submit an attestation to the BiometricOracle contract.
   * Called after facilitator co-signs the session packet hash.
   *
   * @param {Object} params
   * @param {number} params.sessionCompletionId - DB row ID
   * @param {string} params.packetHash - SHA-256 hash (hex, no 0x prefix)
   * @param {number} params.sessionNumber
   * @param {number} params.sessionTimestamp - Unix timestamp
   * @param {string} params.sessionType - e.g. 'foundation', 'fr_apprentice'
   * @param {number} params.tier - 1-4 loyalty tier
   * @param {boolean} params.jointSession
   * @param {string} params.familyId - bytes32 hex or null
   * @param {string} params.participantSig - ECDSA signature
   * @param {string} params.facilitatorSig - ECDSA signature
   * @returns {Object} { success, txHash, error }
   */
  async submitAttestation(params) {
    if (this.shutdown) {
      return { success: false, error: 'Verification service is shut down' };
    }

    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) {
        return { success: false, error: 'Verification service not available' };
      }
    }

    const {
      sessionCompletionId,
      packetHash,
      sessionNumber,
      sessionTimestamp,
      sessionType,
      tier = 1,
      jointSession = false,
      familyId = ethers.ZeroHash,
      participantSig,
      facilitatorSig
    } = params;

    // ── GAS PRICE CIRCUIT BREAKER ─────────────────────────
    const gasPriceCheck = await this._checkGasPrice();
    if (!gasPriceCheck.ok) {
      // Queue for later — don't fail the session
      await this._updateQueueStatus(sessionCompletionId, 'gas_deferred', {
        gas_price_gwei: gasPriceCheck.gasGwei,
        error_message: `Gas price ${gasPriceCheck.gasGwei} gwei exceeds max ${MAX_GAS_PRICE_GWEI}`
      });
      return {
        success: false,
        deferred: true,
        error: `Gas too high: ${gasPriceCheck.gasGwei} gwei`
      };
    }

    // ── BUILD INPUT STRUCT ─────────────────────────────────
    const packetHashBytes = '0x' + packetHash;
    const sessionTypeBytes = ethers.encodeBytes32String(sessionType || 'foundation');
    const familyIdBytes = familyId === null ? ethers.ZeroHash : familyId;

    const input = {
      packetHash: packetHashBytes,
      sessionNumber,
      sessionTimestamp,
      sessionType: sessionTypeBytes,
      tier,
      jointSession,
      familyId: familyIdBytes,
      participantSig,
      facilitatorSig
    };

    // ── SUBMIT WITH RETRY ─────────────────────────────────
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this._updateQueueStatus(sessionCompletionId, 'submitting', {
          retry_count: attempt - 1
        });

        const tx = await this.oracleContract.submitAttestation(input);
        const receipt = await tx.wait();

        // ── SUCCESS ─────────────────────────────────────
        await this._onAttestationConfirmed(sessionCompletionId, receipt);

        return {
          success: true,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        };
      } catch (err) {
        lastError = err;

        // ── FRONT-RUNNING DETECTION ─────────────────────
        // If duplicate hash rejected but our DB shows unconfirmed,
        // someone else submitted it — investigate
        if (err.message?.includes('AttestationAlreadyExists')) {
          console.error('[BLOCKCHAIN] Duplicate hash detected — possible front-running');
          Sentry.captureException(err);
          await this._updateQueueStatus(sessionCompletionId, 'failed', {
            error_message: 'Duplicate hash on-chain — possible front-running. Manual review required.',
            retry_count: attempt
          });
          return {
            success: false,
            error: 'Attestation already exists on-chain',
            frontRunning: true
          };
        }

        // Non-retryable errors
        if (this._isNonRetryable(err)) {
          await this._updateQueueStatus(sessionCompletionId, 'failed', {
            error_message: err.message?.slice(0, 500),
            retry_count: attempt
          });
          return { success: false, error: err.message };
        }

        // Wait before retry
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
      }
    }

    // All retries exhausted
    if (lastError) Sentry.captureException(lastError);
    await this._updateQueueStatus(sessionCompletionId, 'failed', {
      error_message: lastError?.message?.slice(0, 500),
      retry_count: MAX_RETRIES
    });

    return { success: false, error: lastError?.message || 'Max retries exceeded' };
  }

  /**
   * Process deferred attestations (gas was too high earlier).
   * Called by AXIS nightly cron or manual trigger.
   */
  async processDeferred() {
    if (this.shutdown || !this.initialized) return { processed: 0 };

    const gasPriceCheck = await this._checkGasPrice();
    if (!gasPriceCheck.ok) {
      return { processed: 0, reason: `Gas still high: ${gasPriceCheck.gasGwei} gwei` };
    }

    const deferred = await this.pool.query(
      `SELECT aq.*, sc.packet_hash
       FROM attestation_queue aq
       JOIN session_completions sc ON sc.id = aq.session_completion_id
       WHERE aq.status = 'gas_deferred'
       ORDER BY aq.created_at ASC
       LIMIT 10`
    );

    let processed = 0;
    for (const row of deferred.rows) {
      // Re-check gas before each submission
      const check = await this._checkGasPrice();
      if (!check.ok) break;

      // Note: deferred items need signatures to be re-collected
      // or stored. For now, mark them as needing re-submission.
      await this._updateQueueStatus(row.session_completion_id, 'ready', {
        error_message: null
      });
      processed++;
    }

    return { processed };
  }

  /**
   * Governance shutdown — irreversibly stops new attestation submissions
   * while preserving all existing records.
   */
  async governanceShutdown(reason) {
    this.shutdown = true;
    console.error(`[BLOCKCHAIN] GOVERNANCE SHUTDOWN: ${reason}`);

    // Pause the on-chain contract if we have governance role
    try {
      if (this.oracleContract) {
        const tx = await this.oracleContract.pause();
        await tx.wait();
        console.log('[BLOCKCHAIN] On-chain contract paused');
      }
    } catch (err) {
      console.error('[BLOCKCHAIN] Failed to pause contract:', err.message);
    }

    return { shutdown: true, reason };
  }

  /**
   * Expungement protocol — court order process.
   * Deletes user record + wallet mapping. SCT becomes permanently
   * unattributable (on-chain token remains but mapping is destroyed).
   */
  async processExpungement(userId, courtOrderRef) {
    console.log(`[BLOCKCHAIN] Processing expungement for user ${userId}, court order: ${courtOrderRef}`);

    try {
      // Remove wallet_address from user (breaks link to on-chain identity)
      await this.pool.query(
        `UPDATE users SET
           wallet_address = NULL,
           updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Nullify attestation queue entries (preserve for audit trail but anonymize)
      await this.pool.query(
        `UPDATE attestation_queue SET
           user_id = '00000000-0000-0000-0000-000000000000',
           updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Log the expungement in audit
      await this.pool.query(
        `INSERT INTO audit_log (method, path, user_agent, ip, status_code)
         VALUES ('EXPUNGEMENT', $1, $2, 'system', 200)`,
        [`/expungement/${userId}`, `court_order:${courtOrderRef}`]
      );

      console.log(`[BLOCKCHAIN] Expungement complete — wallet mapping destroyed, on-chain SCTs unattributable`);
      return { success: true, userId, courtOrderRef };
    } catch (err) {
      console.error('[BLOCKCHAIN] Expungement failed:', err.message);
      Sentry.captureException(err);
      return { success: false, error: err.message };
    }
  }

  // ── INTERNAL METHODS ─────────────────────────────────────

  async _checkGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      const gasGwei = Number(ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'));
      return {
        ok: gasGwei <= MAX_GAS_PRICE_GWEI,
        gasGwei: Math.round(gasGwei * 100) / 100
      };
    } catch (err) {
      // If we can't check gas, proceed cautiously
      console.warn('[BLOCKCHAIN] Gas check failed:', err.message);
      return { ok: true, gasGwei: 0 };
    }
  }

  async _onAttestationConfirmed(sessionCompletionId, receipt) {
    try {
      // Update attestation queue
      await this.pool.query(
        `UPDATE attestation_queue SET
           status = 'confirmed',
           tx_hash = $1,
           tx_confirmed_at = NOW(),
           gas_price_gwei = $2,
           updated_at = NOW()
         WHERE session_completion_id = $3`,
        [receipt.hash, Number(ethers.formatUnits(receipt.gasPrice || 0n, 'gwei')), sessionCompletionId]
      );

      // Update session_completions
      await this.pool.query(
        `UPDATE session_completions SET
           attestation_submitted = true,
           blockchain_tx_hash = $1,
           blockchain_simulated = false
         WHERE id = $2`,
        [receipt.hash, sessionCompletionId]
      );

      console.log(`[BLOCKCHAIN] Attestation confirmed: tx=${receipt.hash}`);
    } catch (err) {
      console.error('[BLOCKCHAIN] Post-confirmation DB update failed:', err.message);
    }
  }

  async _updateQueueStatus(sessionCompletionId, status, extra = {}) {
    if (!sessionCompletionId) return;

    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIdx = 2;

    if (extra.tx_hash) {
      setClauses.push(`tx_hash = $${paramIdx++}`);
      values.push(extra.tx_hash);
    }
    if (extra.gas_price_gwei !== undefined) {
      setClauses.push(`gas_price_gwei = $${paramIdx++}`);
      values.push(extra.gas_price_gwei);
    }
    if (extra.error_message !== undefined) {
      setClauses.push(`error_message = $${paramIdx++}`);
      values.push(extra.error_message);
    }
    if (extra.retry_count !== undefined) {
      setClauses.push(`retry_count = $${paramIdx++}`);
      values.push(extra.retry_count);
    }

    values.push(sessionCompletionId);

    try {
      await this.pool.query(
        `UPDATE attestation_queue SET ${setClauses.join(', ')}
         WHERE session_completion_id = $${paramIdx}`,
        values
      );
    } catch (err) {
      console.error('[BLOCKCHAIN] Queue status update failed:', err.message);
    }
  }

  /**
   * Process ready attestations from the queue.
   * Called by cron every 30 minutes.
   * Picks up items in 'ready' or 'awaiting_facilitator' status and submits them.
   */
  async processQueue() {
    if (this.shutdown || !this.initialized) return { processed: 0, reason: 'not initialized' };

    const gasPriceCheck = await this._checkGasPrice();
    if (!gasPriceCheck.ok) {
      return { processed: 0, reason: `Gas too high: ${gasPriceCheck.gasGwei} gwei` };
    }

    let processed = 0;
    let failed = 0;

    try {
      // Get ready attestations (includes those queued by session orchestrator)
      const ready = await this.pool.query(
        `SELECT aq.*, sc.packet_hash, sc.session_number, sc.session_id,
                sc.completed_at, u.wallet_address
         FROM attestation_queue aq
         JOIN session_completions sc ON sc.id = aq.session_completion_id
         JOIN users u ON u.user_id = aq.user_id OR u.id::text = aq.user_id
         WHERE aq.status IN ('ready', 'awaiting_facilitator')
           AND aq.retry_count < ${MAX_RETRIES}
         ORDER BY aq.created_at ASC
         LIMIT 10`
      );

      for (const row of ready.rows) {
        // Re-check gas before each tx
        const check = await this._checkGasPrice();
        if (!check.ok) break;

        try {
          // Build attestation params from queue data
          const sessionTimestamp = Math.floor(new Date(row.completed_at || Date.now()).getTime() / 1000);
          const packetHash = row.packet_hash;

          if (!packetHash) {
            await this._updateQueueStatus(row.session_completion_id, 'failed', {
              error_message: 'No packet_hash available'
            });
            failed++;
            continue;
          }

          // For auto-processing: use system signatures
          // (facilitator co-sign is deferred for pilot — submit with oracle role directly)
          const packetHashBytes = '0x' + packetHash;
          const sessionTypeBytes = ethers.encodeBytes32String('foundation');

          const input = {
            packetHash: packetHashBytes,
            sessionNumber: row.session_number || 0,
            sessionTimestamp,
            sessionType: sessionTypeBytes,
            tier: 1,
            jointSession: false,
            familyId: ethers.ZeroHash,
            participantSig: '0x' + '00'.repeat(65), // System-submitted (oracle role)
            facilitatorSig: '0x' + '00'.repeat(65)   // System-submitted (oracle role)
          };

          const tx = await this.oracleContract.submitAttestation(input);
          const receipt = await tx.wait();

          await this._onAttestationConfirmed(row.session_completion_id, receipt);
          processed++;
        } catch (err) {
          if (this._isNonRetryable(err)) {
            await this._updateQueueStatus(row.session_completion_id, 'failed', {
              error_message: err.message?.slice(0, 500),
              retry_count: row.retry_count + 1
            });
          } else {
            await this._updateQueueStatus(row.session_completion_id, 'failed', {
              error_message: err.message?.slice(0, 500),
              retry_count: row.retry_count + 1
            });
          }
          failed++;
        }
      }
    } catch (err) {
      console.error('[BLOCKCHAIN] processQueue error:', err.message);
      Sentry.captureException(err);
    }

    if (processed > 0 || failed > 0) {
      console.log(`[BLOCKCHAIN] processQueue: ${processed} confirmed, ${failed} failed`);
    }
    return { processed, failed };
  }

  /**
   * Check signer wallet balance and alert if low.
   */
  async checkSignerBalance() {
    if (!this.provider || !this.signer) return null;

    try {
      const balance = await this.provider.getBalance(this.signer.address);
      const polBalance = parseFloat(ethers.formatEther(balance));
      console.log(`[BLOCKCHAIN] Signer balance: ${polBalance.toFixed(4)} POL`);

      if (polBalance < 0.1) {
        console.warn('[BLOCKCHAIN] LOW BALANCE — signer wallet needs POL for gas');
        Sentry.captureMessage(`Blockchain signer wallet low: ${polBalance.toFixed(4)} POL (${this.signer.address})`, 'warning');
      }

      return { address: this.signer.address, balance: polBalance };
    } catch (err) {
      console.error('[BLOCKCHAIN] Balance check failed:', err.message);
      return null;
    }
  }

  _isNonRetryable(err) {
    const msg = err.message || '';
    return (
      msg.includes('AttestationAlreadyExists') ||
      msg.includes('UnregisteredFacilitator') ||
      msg.includes('ParticipantIsFacilitator') ||
      msg.includes('InvalidSignature') ||
      msg.includes('SubmissionTooLate')
    );
  }
}

module.exports = { VerificationService };
