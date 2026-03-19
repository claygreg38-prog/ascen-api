// ============================================================
// Premium Gate Middleware — Tier Enforcement
// File: src/middleware/premiumGate.js
//
// Returns 402 (Payment Required), NEVER 403.
// Never hide features — show them grayed out with upgrade prompt.
// The clinical floor is sacred — base tier quality never reduced.
// Family Compass requires Guided Bridge — no tier skipping.
// ============================================================

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TIER_HIERARCHY = { base: 0, guided_bridge: 1, family_compass: 2 };

function requireTier(minimumTier) {
  return async (req, res, next) => {
    const familyUnitId = req.params.familyUnitId || req.body.family_unit_id || req.user?.familyUnitId;

    if (!familyUnitId) {
      return res.status(400).json({ error: 'Family unit required for premium features' });
    }

    try {
      const family = await pool.query(
        'SELECT premium_tier FROM family_units WHERE family_unit_id = $1',
        [familyUnitId]
      );

      if (family.rows.length === 0) {
        return res.status(404).json({ error: 'Family unit not found' });
      }

      const currentTier = family.rows[0]?.premium_tier || 'base';

      if ((TIER_HIERARCHY[currentTier] || 0) >= (TIER_HIERARCHY[minimumTier] || 0)) {
        req.premiumTier = currentTier;
        return next();
      }

      return res.status(402).json({
        error: 'upgrade_required',
        current_tier: currentTier,
        required_tier: minimumTier,
        message: `This feature requires ${minimumTier.replace(/_/g, ' ')} or higher.`
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
