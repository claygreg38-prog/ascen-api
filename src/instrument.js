// ============================================================
// Sentry Error Monitoring — ASCEN BreathWorx
// File: src/instrument.js
//
// Must be required FIRST in server.js, before all other imports.
// Layers on top of existing error handling — does not replace it.
// ============================================================

const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `ascen-api@${process.env.npm_package_version || '2.0.0'}`,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      // Strip any PII from breadcrumbs — never send raw biometric values
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.data && b.data.biometrics) {
            b.data.biometrics = '[redacted]';
          }
          return b;
        });
      }
      return event;
    },
  });
  console.log('[SENTRY] Initialized');
} else {
  console.log('[SENTRY] No SENTRY_DSN — monitoring disabled');
}

module.exports = Sentry;
