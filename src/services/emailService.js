// ============================================================
// Email & SMS Service — Pilot Console Logging
// File: src/services/emailService.js
//
// For pilot: logs codes to console. Interface ready for real
// providers (Resend, SendGrid, Twilio) via env vars.
// ============================================================

async function sendVerificationEmail(email, code) {
  if (process.env.EMAIL_API_KEY) {
    // TODO: implement real email via Resend/SendGrid when provider chosen
    console.log(`[EMAIL] Would send verification to ${email}: ${code}`);
  } else {
    console.log(`[EMAIL] Verification code for ${email}: ${code}`);
  }
}

async function sendPasswordResetEmail(email, code) {
  if (process.env.EMAIL_API_KEY) {
    console.log(`[EMAIL] Would send reset to ${email}: ${code}`);
  } else {
    console.log(`[EMAIL] Password reset code for ${email}: ${code}`);
  }
}

async function sendSMS(phone, message) {
  if (process.env.SMS_API_KEY) {
    // TODO: implement real SMS via Twilio when provider chosen
    console.log(`[SMS] Would send to ${phone}: ${message}`);
  } else {
    console.log(`[SMS] To ${phone}: ${message}`);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendSMS };
