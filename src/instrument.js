// ============================================================
// Sentry Error Monitoring — ASCEN BreathWorx
// File: src/instrument.js
//
// Must be required FIRST in server.js, before all other imports.
// Layers on top of existing error handling — does not replace it.
// ============================================================

const Sentry = require('@sentry/node');

// Keys that may carry raw biometric PII — scrub from all event surfaces
const BIOMETRIC_KEYS = [
  'biometrics', 'rr_intervals', 'rrIntervals', 'heart_rate', 'current_hr',
  'spo2', 'spO2', 'coherence', 'coherence_score', 'respiratory_rate',
  'sdnn', 'hrHistory', 'sdnnHistory', 'rrBuffer',
];

function scrubObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (BIOMETRIC_KEYS.includes(key)) {
      obj[key] = '[redacted]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      scrubObject(obj[key]);
    }
  }
  return obj;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `ascen-api@${process.env.npm_package_version || '2.0.0'}`,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      // Scrub biometric data from all event surfaces
      if (event.breadcrumbs) {
        event.breadcrumbs.forEach(b => { if (b.data) scrubObject(b.data); });
      }
      if (event.extra) scrubObject(event.extra);
      if (event.contexts) scrubObject(event.contexts);
      return event;
    },
  });
  console.log('[SENTRY] Initialized');
} else {
  console.log('[SENTRY] No SENTRY_DSN — monitoring disabled');
}

module.exports = Sentry;
