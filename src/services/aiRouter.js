// ============================================================
// AI Router — Hybrid Haiku/Sonnet Task Routing
// File: src/services/aiRouter.js
//
// Routes AI calls to the appropriate model based on task type.
// Fallback chain: Sonnet → Haiku → null (caller uses canned).
// Defaults to Haiku for unknown tasks. Never defaults to Sonnet.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── TASK ROUTING TABLE ──────────────────────────────────────

const TASK_ROUTING = {
  // Haiku tasks — fast, cheap, pattern-based
  luno_arrival: 'haiku',
  luno_coaching: 'haiku',
  luno_mirror: 'haiku',
  pattern_matching: 'haiku',
  library_selection: 'haiku',
  content_filtering: 'haiku',
  caption_moderation: 'haiku',
  topic_selection: 'haiku',

  // Sonnet tasks — deep reasoning, clinical, nuanced
  axis_clinical_reasoning: 'sonnet',
  track_shift_decision: 'sonnet',
  multi_session_interpretation: 'sonnet',
  crisis_response: 'sonnet',
  luno_deep_dialogue: 'sonnet',
  family_dynamics_assessment: 'sonnet',
  facilitated_message_eval: 'sonnet',
  letter_evaluation: 'sonnet',
  conflict_detection: 'sonnet',
  therapy_report: 'sonnet',
  curriculum_generation: 'sonnet',
  predictive_analysis: 'sonnet',
  disclosure_classification: 'sonnet',
  quilting_session_monitoring: 'sonnet',

  // Clinical Kitchen Table — coaching engine
  clinical_biometric_classification: 'haiku',
  clinical_coaching_card: 'sonnet'
};

const MODEL_MAP = {
  haiku: process.env.ANTHROPIC_MODEL_HAIKU || 'claude-haiku-4-5-20251001',
  sonnet: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-6-20250514'
};

const COST_PER_1K_TOKENS = {
  haiku: { input: 0.001, output: 0.005 },
  sonnet: { input: 0.003, output: 0.015 }
};

// ── MAIN ROUTER ─────────────────────────────────────────────

/**
 * Route an AI call to the appropriate model.
 *
 * @param {string} taskType - key from TASK_ROUTING
 * @param {string} prompt - user message content
 * @param {Object} options
 * @param {string} options.systemPrompt
 * @param {number} options.maxTokens
 * @param {number} options.temperature
 * @param {number} options.timeout - ms
 * @param {string} options.tenantId
 * @param {number} options.userId
 * @param {string} options._forceTier - override tier (for fallback)
 * @returns {Promise<Object|null>} { content, model, tier, usage, elapsed } or null
 */
async function route(taskType, prompt, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const tier = options._forceTier || TASK_ROUTING[taskType] || 'haiku';
  const model = MODEL_MAP[tier];
  const startTime = Date.now();
  const isFallback = !!options._forceTier;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || (tier === 'sonnet' ? 15000 : 5000));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || (tier === 'sonnet' ? 1500 : 500),
        temperature: options.temperature || (tier === 'sonnet' ? 0.7 : 0.6),
        system: options.systemPrompt || '',
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    const elapsed = Date.now() - startTime;

    // Log usage
    await logAIUsage(taskType, tier, model, data.usage, elapsed, options.tenantId, options.userId, isFallback);

    return {
      content: data.content?.[0]?.text || '',
      model,
      tier,
      usage: data.usage,
      elapsed
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;

    // Fallback chain: Sonnet → Haiku → null
    if (tier === 'sonnet' && !options._forceTier) {
      console.warn(`[AI Router] Sonnet failed for ${taskType}, falling back to Haiku: ${err.message}`);
      return route(taskType, prompt, { ...options, _forceTier: 'haiku' });
    }

    console.error(`[AI Router] ${tier} failed for ${taskType}: ${err.message}`);
    Sentry.captureException(err);
    return null; // Caller handles null (canned fallback)
  }
}

// ── USAGE LOGGING ───────────────────────────────────────────

async function logAIUsage(taskType, tier, model, usage, elapsed, tenantId, userId, isFallback) {
  try {
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const rates = COST_PER_1K_TOKENS[tier] || COST_PER_1K_TOKENS.haiku;
    const costCents = ((inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output) * 100;

    await pool.query(
      `INSERT INTO ai_usage_log (tenant_id, user_id, task_type, model_tier, model_name,
         input_tokens, output_tokens, total_tokens, estimated_cost_cents, elapsed_ms, is_fallback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [tenantId || null, userId || null, taskType, tier, model,
       inputTokens, outputTokens, totalTokens, costCents, elapsed, isFallback || false]
    );
  } catch (err) {
    console.error('[AI Router] Usage log failed:', err.message);
  }
}

// ── USAGE DASHBOARD ─────────────────────────────────────────

async function getUsageStats(tenantId, periodDays = 7) {
  try {
    const interval = `${periodDays} days`;

    const byTier = await pool.query(
      `SELECT model_tier, COUNT(*) as calls, SUM(total_tokens) as tokens, SUM(estimated_cost_cents) as cost
       FROM ai_usage_log WHERE ($1::uuid IS NULL OR tenant_id = $1) AND created_at > NOW() - $2::interval
       GROUP BY model_tier`,
      [tenantId, interval]
    );

    const byTask = await pool.query(
      `SELECT task_type, COUNT(*) as calls, AVG(elapsed_ms)::int as avg_ms
       FROM ai_usage_log WHERE ($1::uuid IS NULL OR tenant_id = $1) AND created_at > NOW() - $2::interval
       GROUP BY task_type ORDER BY calls DESC`,
      [tenantId, interval]
    );

    const total = await pool.query(
      `SELECT COUNT(*) as calls, SUM(estimated_cost_cents) as cost,
              COUNT(*) FILTER (WHERE is_fallback) as fallbacks
       FROM ai_usage_log WHERE ($1::uuid IS NULL OR tenant_id = $1) AND created_at > NOW() - $2::interval`,
      [tenantId, interval]
    );

    const sessionCount = await pool.query(
      `SELECT COUNT(*) as c FROM session_completions WHERE ($1::uuid IS NULL OR tenant_id = $1) AND completed_at > NOW() - $2::interval`,
      [tenantId, interval]
    );

    const totalCalls = parseInt(total.rows[0]?.calls) || 0;
    const totalCost = parseFloat(total.rows[0]?.cost) || 0;
    const sessions = parseInt(sessionCount.rows[0]?.c) || 1;
    const fallbacks = parseInt(total.rows[0]?.fallbacks) || 0;

    return {
      period: `${periodDays} days`,
      total_calls: totalCalls,
      by_tier: Object.fromEntries(byTier.rows.map(r => [r.model_tier, {
        calls: parseInt(r.calls), tokens: parseInt(r.tokens) || 0, cost_cents: parseFloat(r.cost) || 0
      }])),
      by_task: Object.fromEntries(byTask.rows.map(r => [r.task_type, {
        calls: parseInt(r.calls), avg_ms: r.avg_ms
      }])),
      estimated_cost_per_session: '$' + (totalCost / sessions / 100).toFixed(3),
      fallback_rate: totalCalls > 0 ? (fallbacks / totalCalls * 100).toFixed(1) + '%' : '0%'
    };
  } catch (err) {
    Sentry.captureException(err);
    return { error: 'Failed to compute usage stats' };
  }
}

module.exports = {
  route,
  getUsageStats,
  TASK_ROUTING,
  MODEL_MAP,
  COST_PER_1K_TOKENS
};
