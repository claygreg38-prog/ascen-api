// ============================================================
// [ABI] Onboarding Engine — Post-Registration Flow
// File: src/abi/onboardingEngine.js
//
// ABI module. Manages consent collection, orientation, and
// onboarding state transitions.
//
// Steps: pending → consent → orientation → first_session → complete
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Collect granular consent.
 * @param {number} userDbId
 * @param {Object} consents - { art_generation, gallery_visible, data_sharing, lightbridge }
 */
async function collectConsent(userDbId, consents) {
  try {
    const onboarding = {
      step: 'orientation',
      consent_art: consents.art_generation !== false,
      consent_gallery: consents.gallery_visible !== false,
      consent_data: consents.data_sharing === true,
      consent_lightbridge: consents.lightbridge !== false,
      consent_collected_at: new Date().toISOString()
    };

    await pool.query(
      'UPDATE users SET onboarding_state = $1 WHERE id = $2',
      [JSON.stringify(onboarding), userDbId]
    );

    return { onboardingState: onboarding };
  } catch (err) {
    console.error('[Onboarding] Consent failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to save consent' };
  }
}

/**
 * Mark orientation viewed.
 */
async function completeOrientation(userDbId) {
  try {
    await pool.query(
      "UPDATE users SET onboarding_state = jsonb_set(onboarding_state, '{step}', '\"first_session\"') WHERE id = $1",
      [userDbId]
    );
    return { onboardingState: { step: 'first_session' } };
  } catch (err) {
    console.error('[Onboarding] Orientation failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to complete orientation' };
  }
}

/**
 * Get current onboarding state.
 */
async function getState(userDbId) {
  try {
    const result = await pool.query('SELECT onboarding_state FROM users WHERE id = $1', [userDbId]);
    return result.rows[0]?.onboarding_state || { step: 'pending' };
  } catch (err) {
    Sentry.captureException(err);
    return { step: 'pending' };
  }
}

/**
 * Finalize onboarding — full platform access.
 */
async function completeOnboarding(userDbId) {
  try {
    await pool.query(
      "UPDATE users SET onboarding_state = jsonb_set(onboarding_state, '{step}', '\"complete\"') WHERE id = $1",
      [userDbId]
    );
    return { onboardingState: { step: 'complete' } };
  } catch (err) {
    console.error('[Onboarding] Complete failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to complete onboarding' };
  }
}

module.exports = { collectConsent, completeOrientation, getState, completeOnboarding };
