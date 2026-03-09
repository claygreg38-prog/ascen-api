// ============================================================
// blockchainRetry.js — Retry logic for blockchain writes
// Handles transient failures, gas price spikes, and nonce issues.
// Works with verificationService.js — never calls contracts directly.
// ============================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;

class BlockchainRetry {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Process failed attestations from attestation_queue.
   * Retries up to MAX_RETRIES with exponential backoff.
   */
  async processRetries() {
    const results = { processed: 0, retried: 0, permanently_failed: 0 };

    try {
      const failed = await this.pool.query(
        `SELECT id, session_completion_id, user_id, packet_hash,
                retry_count, error_message
         FROM attestation_queue
         WHERE status = 'failed'
           AND retry_count < $1
         ORDER BY updated_at ASC
         LIMIT 10`,
        [MAX_RETRIES]
      );

      results.processed = failed.rows.length;

      for (const row of failed.rows) {
        const delay = Math.min(
          BASE_DELAY_MS * Math.pow(2, row.retry_count),
          MAX_DELAY_MS
        );

        await this._sleep(delay);

        try {
          // Move back to ready status for verificationService to pick up
          await this.pool.query(
            `UPDATE attestation_queue
             SET status = 'ready',
                 retry_count = retry_count + 1,
                 error_message = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [row.id]
          );
          results.retried++;
        } catch (err) {
          console.error(`[BlockchainRetry] Retry failed for ${row.id}:`, err.message);
        }
      }

      // Mark permanently failed
      const permanent = await this.pool.query(
        `UPDATE attestation_queue
         SET status = 'failed',
             error_message = 'Max retries exceeded',
             updated_at = NOW()
         WHERE status = 'failed'
           AND retry_count >= $1
         RETURNING id`,
        [MAX_RETRIES]
      );
      results.permanently_failed = permanent.rowCount;

    } catch (err) {
      console.error('[BlockchainRetry] processRetries error:', err.message);
      results.error = err.message;
    }

    return results;
  }

  /**
   * Handle gas-deferred attestations.
   * Re-queues when gas prices are acceptable.
   */
  async processGasDeferred() {
    const results = { processed: 0, requeued: 0 };

    try {
      const deferred = await this.pool.query(
        `SELECT id, session_completion_id, user_id, packet_hash, gas_price_gwei
         FROM attestation_queue
         WHERE status = 'gas_deferred'
         ORDER BY created_at ASC
         LIMIT 20`
      );

      results.processed = deferred.rows.length;

      for (const row of deferred.rows) {
        // Re-queue as ready — verificationService will check gas
        await this.pool.query(
          `UPDATE attestation_queue
           SET status = 'ready',
               updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
        results.requeued++;
      }
    } catch (err) {
      console.error('[BlockchainRetry] processGasDeferred error:', err.message);
      results.error = err.message;
    }

    return results;
  }

  /**
   * Get retry queue status.
   */
  async getQueueStatus() {
    try {
      const status = await this.pool.query(
        `SELECT status, COUNT(*) as count
         FROM attestation_queue
         GROUP BY status`
      );
      return {
        queue: status.rows.reduce((acc, r) => {
          acc[r.status] = parseInt(r.count);
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BlockchainRetry };
