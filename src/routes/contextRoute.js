/**
 * GET /api/auth/context — Full persona context for PWA shell
 * Aggregates: user profile, persona, features, capacity, next session, gate state, tenant
 */
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let ttsService;
try { ttsService = require('../services/ttsService'); } catch (e) { /* TTS not available */ }
const { computeAgeBracket, computeAge } = require('../services/personaEngine');
const { getAgeConfig } = require('../middleware/ageFilter');

router.get('/context', async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Get user profile
    const userResult = await pool.query(
      `SELECT id, user_id, first_name, last_name, role, participant_id,
              family_unit_id, tenant_id, total_sessions_completed, onboarding_state, date_of_birth
       FROM users WHERE id = $1 OR user_id = $2`,
      [parseInt(userId) || 0, userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    // Derive persona from role + family status
    let persona = 'INDV';
    let familyRole = null;
    if (['facilitator', 'clinician', 'admin'].includes(user.role)) {
      persona = 'FCLT';
    } else if (user.family_unit_id) {
      // Check family role
      const memberResult = await pool.query(
        `SELECT role FROM family_memberships WHERE user_id = $1 AND family_unit_id = $2 AND status = 'active'`,
        [user.id, user.family_unit_id]
      ).catch(() => ({ rows: [] }));
      familyRole = memberResult.rows[0]?.role || 'member';
      persona = familyRole === 'elder' ? 'ELDR' : 'AFAM';
    }

    // Check for active partnership (PRTN persona)
    let hasPartnership = false;
    try {
      const partnershipResult = await pool.query(
        `SELECT id FROM partnership_practices
         WHERE (partner_a_id = $1 OR partner_b_id = $1) AND status = 'active' LIMIT 1`,
        [user.id]
      );
      hasPartnership = partnershipResult.rows.length > 0;
      if (hasPartnership && persona === 'INDV') persona = 'PRTN';
    } catch {}

    // Check for active prenatal enrollment (EXPT persona)
    let hasPrenatal = false;
    try {
      const prenatalResult = await pool.query(
        `SELECT id FROM prenatal_enrollments
         WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [user.id]
      );
      hasPrenatal = prenatalResult.rows.length > 0;
      if (hasPrenatal && (persona === 'INDV' || persona === 'PRTN')) persona = 'EXPT';
    } catch {}

    // Feature flags based on persona
    const features = {
      family_hub: persona === 'ELDR' || persona === 'AFAM',
      partner_hub: hasPartnership,
      co_breath: persona === 'ELDR' || persona === 'AFAM' || hasPartnership || hasPrenatal,
      lightbridge: persona === 'ELDR',
      facilitator_dashboard: persona === 'FCLT',
      prenatal_dashboard: hasPrenatal,
      triad_breath: hasPrenatal,
      trimester_content: hasPrenatal,
      vault: true,
      gallery: true,
      curriculum: true
    };

    // Premium tier
    let premiumTier = 'base';
    if (user.family_unit_id) {
      const tierResult = await pool.query(
        `SELECT premium_tier FROM family_units WHERE id = $1`,
        [user.family_unit_id]
      ).catch(() => ({ rows: [] }));
      premiumTier = tierResult.rows[0]?.premium_tier || 'base';
    }

    // Capacity state
    let capacityState = 'steady';
    try {
      const capResult = await pool.query(
        `SELECT balance, state FROM capacity_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [user.participant_id || user.user_id]
      );
      if (capResult.rows.length > 0) capacityState = capResult.rows[0].state || 'steady';
    } catch {}

    // Next session
    let nextSession = { number: 1, title: 'Session 1', arc: 'foundation', duration_minutes: 12 };
    try {
      const lastResult = await pool.query(
        `SELECT MAX(session_number) as last FROM session_completions
         WHERE (user_id = $1 OR user_id = $2) AND session_active = false`,
        [user.participant_id || user.user_id, user.id.toString()]
      );
      const nextNum = (lastResult.rows[0]?.last || 0) + 1;

      const sessResult = await pool.query(
        `SELECT session_number, title, arc, duration_seconds FROM session_templates WHERE session_number = $1`,
        [nextNum]
      );
      if (sessResult.rows.length > 0) {
        const s = sessResult.rows[0];
        nextSession = {
          number: s.session_number,
          title: s.title || `Session ${s.session_number}`,
          arc: s.arc || 'foundation',
          duration_minutes: Math.round((s.duration_seconds || 720) / 60)
        };
      } else {
        nextSession.number = nextNum;
        nextSession.title = `Session ${nextNum}`;
      }
    } catch {}

    // Fire-and-forget TTS prewarm (don't block the context response)
    if (ttsService && ttsService.isAvailable() && nextSession.number && user.tenant_id) {
      ttsService.prewarmSession(nextSession.number, user.tenant_id, 'luno').catch(() => {});
    }

    // Gate state (family only)
    let gateState = null;
    if (user.family_unit_id) {
      try {
        const gateResult = await pool.query(
          `SELECT current_gate FROM family_units WHERE id = $1`,
          [user.family_unit_id]
        );
        gateState = gateResult.rows[0]?.current_gate || 0;
      } catch {}
    }

    // Tenant config
    let tenant = { name: 'ASCEN', luno_variant: 'default' };
    if (user.tenant_id) {
      try {
        const tenantResult = await pool.query(
          `SELECT name, config FROM tenants WHERE id = $1`,
          [user.tenant_id]
        );
        if (tenantResult.rows.length > 0) {
          tenant = {
            name: tenantResult.rows[0].name,
            ...(tenantResult.rows[0].config || {})
          };
        }
      } catch {}
    }

    // Session streak
    let streak = 0;
    try {
      const streakResult = await pool.query(
        `SELECT completed_at::date as d FROM session_completions
         WHERE (user_id = $1 OR user_id = $2) AND session_active = false
         ORDER BY completed_at DESC LIMIT 30`,
        [user.participant_id || user.user_id, user.id.toString()]
      );
      if (streakResult.rows.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);
        // Allow today or yesterday as start
        for (const row of streakResult.rows) {
          const d = new Date(row.d);
          d.setHours(0, 0, 0, 0);
          const diff = Math.round((checkDate - d) / (1000 * 60 * 60 * 24));
          if (diff <= 1) {
            streak++;
            checkDate = d;
          } else {
            break;
          }
        }
      }
    } catch {}

    // Age bracket + config
    const ageBracket = computeAgeBracket(user.date_of_birth);
    const ageConfig = getAgeConfig(ageBracket);

    res.json({
      user_id: user.user_id || user.participant_id,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      persona,
      family_role: familyRole,
      family_unit_id: user.family_unit_id,
      features,
      capacity_state: capacityState,
      next_session: nextSession,
      gate_state: gateState,
      premium_tier: premiumTier,
      streak,
      total_sessions: user.total_sessions_completed || 0,
      ui_mode: 'participant',
      tenant,
      age_config: {
        bracket: ageBracket,
        max_session_minutes: ageConfig.maxSessionMinutes,
        content_format: ageConfig.contentFormat,
        capacity_display: ageConfig.capacityDisplay,
        ui_style: ageConfig.uiStyle
      }
    });
  } catch (err) {
    console.error('[CONTEXT] Error:', err.message);
    res.status(500).json({ error: 'Failed to load context' });
  }
});

module.exports = router;
