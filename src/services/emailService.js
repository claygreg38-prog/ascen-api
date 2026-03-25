// ============================================================
// Email Service — Resend Integration + Notification Queue
// File: src/services/emailService.js
//
// Production-grade: sends via Resend, queues failures for retry.
// No console-only delivery. Every notification sent or queued.
// ============================================================

const { Resend } = require('resend');
const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let resend = null;

function initEmail() {
  if (!process.env.RESEND_API_KEY) {
    console.error('[EMAIL] CRITICAL: No RESEND_API_KEY — email delivery non-functional');
    Sentry.captureMessage('Production running without RESEND_API_KEY', 'error');
    return false;
  }
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('[EMAIL] Resend initialized');
  return true;
}

function isEmailAvailable() {
  return !!resend;
}

// ── CORE SEND ───────────────────────────────────────────────

async function sendEmail({ to, subject, html, text, templateName, templateData }) {
  // Always attempt real delivery first
  if (resend) {
    try {
      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'ASCEN BreathWorx <noreply@ascenbreath.com>',
        to,
        subject,
        html: html || undefined,
        text: text || undefined
      });
      console.log(`[EMAIL] Sent to ${to}: ${subject}`);
      return { id: result.data?.id, sent: true };
    } catch (err) {
      console.error('[EMAIL] Send failed:', err.message);
      Sentry.captureException(err);
      // Fall through to queue
    }
  }

  // Queue for retry — NEVER silently drop
  await queueNotification({
    type: 'email',
    recipient: to,
    subject,
    body_html: html,
    body_text: text,
    template_name: templateName,
    template_data: templateData,
    last_error: resend ? 'Send failed' : 'RESEND_API_KEY not configured'
  });

  return { queued: true, sent: false };
}

// ── QUEUE ───────────────────────────────────────────────────

async function queueNotification(notification) {
  try {
    await pool.query(`
      INSERT INTO notification_queue
      (type, recipient, subject, body_html, body_text, template_name, template_data, status, last_error, last_attempt_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'retrying', $8, NOW())
    `, [
      notification.type,
      notification.recipient,
      notification.subject || null,
      notification.body_html || null,
      notification.body_text || null,
      notification.template_name || null,
      JSON.stringify(notification.template_data || {}),
      notification.last_error || null
    ]);
  } catch (err) {
    // Last resort — if DB is also down, at least log + Sentry
    console.error('[EMAIL] Queue insert failed:', err.message);
    Sentry.captureException(err);
  }
}

// ── RETRY CRON ──────────────────────────────────────────────

async function retryFailedNotifications() {
  if (!resend) return; // Can't retry without API key

  try {
    const pending = await pool.query(`
      SELECT * FROM notification_queue
      WHERE status IN ('pending', 'retrying')
      AND attempts < max_attempts
      AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '5 minutes' * power(2, attempts))
      ORDER BY created_at ASC
      LIMIT 20
    `);

    for (const item of pending.rows) {
      try {
        if (item.type === 'email') {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || 'ASCEN BreathWorx <noreply@ascenbreath.com>',
            to: item.recipient,
            subject: item.subject,
            html: item.body_html || undefined,
            text: item.body_text || undefined
          });
        }
        // SMS retry handled by smsService

        await pool.query(
          'UPDATE notification_queue SET status = $1, sent_at = NOW(), attempts = attempts + 1 WHERE id = $2',
          ['sent', item.id]
        );
        console.log(`[EMAIL] Retry succeeded for ${item.recipient}: ${item.subject}`);
      } catch (err) {
        const newAttempts = item.attempts + 1;
        const newStatus = newAttempts >= item.max_attempts ? 'failed' : 'retrying';

        await pool.query(
          'UPDATE notification_queue SET status = $1, attempts = $2, last_error = $3, last_attempt_at = NOW() WHERE id = $4',
          [newStatus, newAttempts, err.message, item.id]
        );

        if (newStatus === 'failed') {
          Sentry.captureMessage(`Notification permanently failed for ${item.recipient}: ${item.subject}`, 'error');
        }
      }
    }

    // Alert if 3+ consecutive failures for same recipient in 24h
    const repeatedFailures = await pool.query(`
      SELECT recipient, COUNT(*) as fail_count FROM notification_queue
      WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY recipient HAVING COUNT(*) >= 3
    `);

    for (const row of repeatedFailures.rows) {
      Sentry.captureMessage(`3+ email failures in 24h for ${row.recipient}`, 'warning');
    }
  } catch (err) {
    console.error('[EMAIL] Retry cron error:', err.message);
    Sentry.captureException(err);
  }
}

// ── TEMPLATES ───────────────────────────────────────────────

async function sendVerificationCode(email, code) {
  return sendEmail({
    to: email,
    subject: 'ASCEN BreathWorx \u2014 Your Verification Code',
    html: `
      <div style="background:#061a2a;color:white;padding:40px;font-family:Arial,sans-serif;">
        <h1 style="color:#5ffce0;">ASCEN BreathWorx</h1>
        <p>Your verification code is:</p>
        <h2 style="color:#f0b860;font-size:36px;letter-spacing:8px;">${code}</h2>
        <p>This code expires in 15 minutes.</p>
        <p style="color:#8899aa;margin-top:30px;">Your breath. Your healing. Your art.</p>
      </div>
    `,
    text: `Your ASCEN verification code is: ${code}. Expires in 15 minutes.`,
    templateName: 'verification_code',
    templateData: { code }
  });
}

async function sendPasswordReset(email, code) {
  return sendEmail({
    to: email,
    subject: 'ASCEN BreathWorx \u2014 Reset Your PIN',
    html: `
      <div style="background:#061a2a;color:white;padding:40px;font-family:Arial,sans-serif;">
        <h1 style="color:#5ffce0;">ASCEN BreathWorx</h1>
        <p>Your PIN reset code is:</p>
        <h2 style="color:#f0b860;font-size:36px;letter-spacing:8px;">${code}</h2>
        <p>This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
    text: `Your ASCEN PIN reset code is: ${code}. Expires in 15 minutes.`,
    templateName: 'password_reset',
    templateData: { code }
  });
}

async function sendTherapyReport(therapistEmail, familyName, reportPeriod, reportData, legalDisclaimer) {
  return sendEmail({
    to: therapistEmail,
    subject: `ASCEN Therapy Prep Report \u2014 ${familyName} \u2014 ${reportPeriod}`,
    html: `
      <div style="background:#061a2a;color:white;padding:40px;font-family:Arial,sans-serif;">
        <h1 style="color:#5ffce0;">ASCEN BreathWorx \u2014 Therapy Prep Report</h1>
        <p><strong>Family:</strong> ${familyName}</p>
        <p><strong>Period:</strong> ${reportPeriod}</p>
        <hr style="border-color:#1a7a6d;">
        <div style="background:#0a2540;padding:20px;border-radius:8px;">
          ${formatReportHtml(reportData)}
        </div>
        <p style="color:#f07050;margin-top:20px;font-size:12px;">
          ${legalDisclaimer || 'This report is generated by AI analysis of communication patterns and is intended for system work context only. It is not a formal evaluation and should not be used in legal proceedings.'}
        </p>
      </div>
    `,
    text: `ASCEN System Report for ${familyName}, ${reportPeriod}. See full report in the ASCEN app.`,
    templateName: 'therapy_report',
    templateData: { familyName, reportPeriod }
  });
}

async function sendFamilyInvitation(email, inviterName, inviteCode) {
  return sendEmail({
    to: email,
    subject: `${inviterName} invited you to ASCEN BreathWorx`,
    html: `
      <div style="background:#061a2a;color:white;padding:40px;font-family:Arial,sans-serif;">
        <h1 style="color:#5ffce0;">ASCEN BreathWorx</h1>
        <p>${inviterName} has invited you to join their family's healing journey.</p>
        <p>Your invitation code is:</p>
        <h2 style="color:#f0b860;font-size:28px;">${inviteCode}</h2>
        <p>Download the ASCEN app and enter this code to join.</p>
        <p style="color:#8899aa;margin-top:30px;">Your breath. Your healing. Your art.</p>
      </div>
    `,
    text: `${inviterName} invited you to ASCEN BreathWorx. Your invitation code: ${inviteCode}`,
    templateName: 'family_invitation',
    templateData: { inviterName, inviteCode }
  });
}

function formatReportHtml(data) {
  if (!data) return '<p>Report data available in app.</p>';
  let html = '';
  if (data.communication_volume) {
    html += `<p><strong>Messages this period:</strong> ${data.communication_volume.total || 0}</p>`;
  }
  if (data.emotional_themes?.top_themes) {
    html += `<p><strong>Top themes:</strong> ${data.emotional_themes.top_themes.join(', ')}</p>`;
  }
  if (data.facilitator_insights?.positive_signals) {
    html += '<p><strong>Positive signals:</strong></p><ul>';
    data.facilitator_insights.positive_signals.forEach(s => { html += `<li>${s}</li>`; });
    html += '</ul>';
  }
  return html || '<p>Report data available in app.</p>';
}

// ── BACKWARD COMPAT (old function names used by authService) ─

async function sendVerificationEmail(email, code) {
  return sendVerificationCode(email, code);
}

async function sendPasswordResetEmail(email, code) {
  return sendPasswordReset(email, code);
}

async function sendSMS(phone, message) {
  // Delegate to smsService — but keep export for backward compat
  try {
    const smsService = require('./smsService');
    return smsService.sendSMS(phone, message);
  } catch {
    // smsService not yet loaded — queue it
    await queueNotification({
      type: 'sms',
      recipient: phone,
      body_text: message,
      template_name: 'sms_fallback',
      last_error: 'smsService not available'
    });
    return { queued: true, sent: false };
  }
}

module.exports = {
  initEmail,
  isEmailAvailable,
  sendEmail,
  sendVerificationCode,
  sendPasswordReset,
  sendTherapyReport,
  sendFamilyInvitation,
  retryFailedNotifications,
  queueNotification,
  // Backward compat — used by authService.js
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSMS
};
