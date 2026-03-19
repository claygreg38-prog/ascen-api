// ============================================================
// Premium Gate Middleware — Tier Enforcement
// File: src/middleware/premiumGate.js
//
// Returns 402 (Payment Required), NEVER 403.
// Never hide features — show them grayed out with upgrade prompt.
// The clinical floor is sacred — base tier quality never reduced.
// Family Compass requires Guided Bridge — no tier skipping.
//
// Checks BOTH family_units.premium_tier AND subscriptions table.
// Expired trials return 402. Past_due within grace period still grants access.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TIER_HIERARCHY = { base: 0, guided_bridge: 1, family_compass: 2 };
const GRACE_PERIOD_DAYS = 7;

function requireTier(minimumTier) {
  return async (req, res, next) => {
    const familyUnitId = req.params.familyUnitId || req.body.family_unit_id || req.user?.familyUnitId;

    if (!familyUnitId) {
      return res.status(400).json({ error: 'Family unit required for premium features' });
    }

    try {
      // Check subscription status (primary source of truth)
      const sub = await pool.query(
        `SELECT tier, status, trial_end_date, is_trial, current_period_end
         FROM subscriptions
         WHERE family_unit_id = $1 AND status IN ('active', 'trial', 'past_due')
         ORDER BY created_at DESC LIMIT 1`,
        [familyUnitId]
      );

      let currentTier = 'base';

      if (sub.rows.length > 0) {
        const s = sub.rows[0];

        if (s.is_trial && s.trial_end_date && new Date(s.trial_end_date) < new Date()) {
          // Trial expired
          currentTier = 'base';
        } else if (s.status === 'past_due') {
          // Grace period: still grant access if within grace window
          const graceEnd = new Date(s.current_period_end);
          graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);
          currentTier = new Date() <= graceEnd ? s.tier : 'base';
        } else {
          currentTier = s.tier;
        }
      } else {
        // Fallback to family_units.premium_tier (for manual/pilot tier setting)
        const family = await pool.query(
          'SELECT premium_tier FROM family_units WHERE family_unit_id = $1',
          [familyUnitId]
        );

        if (family.rows.length === 0) {
          return res.status(404).json({ error: 'Family unit not found' });
        }

        currentTier = family.rows[0]?.premium_tier || 'base';
      }

      if ((TIER_HIERARCHY[currentTier] || 0) >= (TIER_HIERARCHY[minimumTier] || 0)) {
        req.premiumTier = currentTier;
        return next();
      }

      return res.status(402).json({
        error: 'upgrade_required',
        current_tier: currentTier,
        required_tier: minimumTier,
        message: `This feature requires ${minimumTier.replace(/_/g, ' ')} or higher.`,
        upgrade_url: '/api/subscription/tiers'
      });
    } catch (err) {
      console.error('[PremiumGate] Error checking tier:', err.message);
      return res.status(500).json({ error: 'Failed to verify premium tier' });
    }
  };
}

// Validate tier upgrade — Family Compass requires Guided Bridge
function validateUpgrade(currentTier, requestedTier) {
  if (requestedTier === 'family_compass' && currentTier !== 'guided_bridge' && currentTier !== 'family_compass') {
    return { valid: false, message: 'Family Compass requires Guided Bridge. Please upgrade to Guided Bridge first.' };
  }
  if ((TIER_HIERARCHY[requestedTier] || 0) <= (TIER_HIERARCHY[currentTier] || 0)) {
    return { valid: false, message: 'Already at this tier or higher.' };
  }
  return { valid: true };
}

module.exports = { requireTier, validateUpgrade, TIER_HIERARCHY };
