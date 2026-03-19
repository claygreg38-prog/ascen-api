// ============================================================
// Premium Routes — Guided Bridge Endpoints
// File: src/routes/premiumRoutes.js
//
// Mount at /api/premium. Requires JWT + premiumGate middleware.
// 18 premium endpoints + 4 clinical endpoints.
// ============================================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { requireTier } = require('../middleware/premiumGate');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════
// FACILITATED MESSAGING
// ═══════════════════════════════════════════════════════════════

// Send facilitated message
router.post('/message/send', requireTier('guided_bridge'), async (req, res) => {
  try {
    const facilitatedMessaging = require('../abi/facilitatedMessaging');
    const { recipient_id, message_text, channel_type, family_unit_id } = req.body;

    if (!recipient_id || !message_text || !channel_type) {
      return res.status(400).json({ error: 'recipient_id, message_text, and channel_type required' });
    }

    // Resolve sender DB ID
    const senderRow = await pool.query('SELECT id, first_name FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (senderRow.rows.length === 0) return res.status(404).json({ error: 'Sender not found' });
    const senderId = senderRow.rows[0].id;

    // Resolve recipient
    const recipientRow = await pool.query('SELECT id, first_name FROM users WHERE id = $1', [recipient_id]);
    if (recipientRow.rows.length === 0) return res.status(404).json({ error: 'Recipient not found' });

    // Build family context
    const familyContext = await buildFamilyContext(family_unit_id, senderId, recipient_id, req.tenantId);

    // Determine direction (inbound = child→parent, outbound = parent→child/partner/coparent)
    let result;
    if (familyContext.senderType === 'child') {
      result = await facilitatedMessaging.evaluateInbound(senderId, recipient_id, message_text, channel_type, familyContext);
    } else {
      result = await facilitatedMessaging.evaluateOutbound(senderId, recipient_id, message_text, channel_type, familyContext);
    }

    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Premium] message/send failed:', err.message);
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Respond to coaching suggestion
router.post('/message/respond-to-coaching', requireTier('guided_bridge'), async (req, res) => {
  try {
    const facilitatedMessaging = require('../abi/facilitatedMessaging');
    const { message_id, accepted, edited_text } = req.body;

    const senderRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (senderRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await facilitatedMessaging.respondToCoaching(message_id, senderRow.rows[0].id, accepted, edited_text);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to respond to coaching' });
  }
});

// Message history for channel
router.get('/messages/:channelType', requireTier('guided_bridge'), async (req, res) => {
  try {
    const facilitatedMessaging = require('../abi/facilitatedMessaging');
    const familyUnitId = req.query.family_unit_id;
    if (!familyUnitId) return res.status(400).json({ error: 'family_unit_id query param required' });

    const messages = await facilitatedMessaging.getMessages(familyUnitId, req.params.channelType);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Unread message count
router.get('/messages/unread', requireTier('guided_bridge'), async (req, res) => {
  try {
    const facilitatedMessaging = require('../abi/facilitatedMessaging');
    const senderRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (senderRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const counts = await facilitatedMessaging.getUnreadCount(senderRow.rows[0].id);
    res.json({ unread: counts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONFLICT RESOLUTION
// ═══════════════════════════════════════════════════════════════

// Respond to conflict pause offer
router.post('/conflict/:eventId/respond', requireTier('guided_bridge'), async (req, res) => {
  try {
    const conflictResolution = require('../abi/conflictResolution');
    const { response } = req.body;

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await conflictResolution.respondToPause(req.params.eventId, userRow.rows[0].id, response);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to respond to conflict' });
  }
});

// Complete conflict breathing
router.post('/conflict/:eventId/complete-breathing', requireTier('guided_bridge'), async (req, res) => {
  try {
    const conflictResolution = require('../abi/conflictResolution');
    const result = await conflictResolution.completeBreathing(req.params.eventId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete breathing' });
  }
});

// ═══════════════════════════════════════════════════════════════
// LETTER WRITING ASSISTANT
// ═══════════════════════════════════════════════════════════════

// Submit letter draft
router.post('/letter/draft', requireTier('guided_bridge'), async (req, res) => {
  try {
    const letterAssistant = require('../abi/letterAssistant');
    const { recipient_id, recipient_type, draft_text, family_unit_id } = req.body;

    if (!draft_text || !recipient_type) {
      return res.status(400).json({ error: 'draft_text and recipient_type required' });
    }

    const authorRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (authorRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const familyContext = await buildFamilyContext(family_unit_id, authorRow.rows[0].id, recipient_id, req.tenantId);

    const result = await letterAssistant.createDraft(
      authorRow.rows[0].id, recipient_id, recipient_type, draft_text, familyContext
    );
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// Update draft
router.put('/letter/:id/edit', requireTier('guided_bridge'), async (req, res) => {
  try {
    const letterAssistant = require('../abi/letterAssistant');
    const { draft_text, family_unit_id } = req.body;

    const authorRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (authorRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const familyContext = await buildFamilyContext(family_unit_id, authorRow.rows[0].id, null, req.tenantId);

    const result = await letterAssistant.updateDraft(req.params.id, authorRow.rows[0].id, draft_text, familyContext);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

// Finalize and deliver
router.post('/letter/:id/finalize', requireTier('guided_bridge'), async (req, res) => {
  try {
    const letterAssistant = require('../abi/letterAssistant');
    const { delivery_method } = req.body;

    const authorRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (authorRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await letterAssistant.finalizeLetter(req.params.id, authorRow.rows[0].id, delivery_method);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to finalize letter' });
  }
});

// ═══════════════════════════════════════════════════════════════
// THERAPY REPORTS
// ═══════════════════════════════════════════════════════════════

// Generate/get therapy report
router.get('/therapy-report/:familyUnitId', requireTier('guided_bridge'), async (req, res) => {
  try {
    const therapyReportService = require('../services/therapyReportService');
    const { period_start, period_end, channels } = req.query;

    if (!period_start || !period_end) {
      return res.status(400).json({ error: 'period_start and period_end query params required' });
    }

    let consentChannels = { parent_child: true, partner: true, coparent: true };
    if (channels) {
      try { consentChannels = JSON.parse(channels); } catch {}
    }

    const result = await therapyReportService.generateReport(
      req.params.familyUnitId, period_start, period_end, consentChannels, req.tenantId
    );
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Submit per-channel consent
router.post('/therapy-report/:id/consent', requireTier('guided_bridge'), async (req, res) => {
  try {
    const therapyReportService = require('../services/therapyReportService');
    const { channels } = req.body;

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await therapyReportService.submitConsent(req.params.id, userRow.rows[0].id, channels);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit consent' });
  }
});

// Preview report before sending
router.get('/therapy-report/:id/preview', requireTier('guided_bridge'), async (req, res) => {
  try {
    const therapyReportService = require('../services/therapyReportService');
    const { family_unit_id } = req.query;
    if (!family_unit_id) return res.status(400).json({ error: 'family_unit_id required' });

    const result = await therapyReportService.previewReport(req.params.id, family_unit_id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to preview report' });
  }
});

// Send to therapist
router.post('/therapy-report/:id/send', requireTier('guided_bridge'), async (req, res) => {
  try {
    const therapyReportService = require('../services/therapyReportService');
    const { therapist_email } = req.body;

    if (!therapist_email) return res.status(400).json({ error: 'therapist_email required' });

    const userRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await therapyReportService.sendToTherapist(req.params.id, therapist_email, userRow.rows[0].id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send report' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADVANCED VAULT
// ═══════════════════════════════════════════════════════════════

// Upload video capsule
router.post('/vault/video', requireTier('guided_bridge'), async (req, res) => {
  try {
    const { family_unit_id, transcript, session_completion_id, designee_name, designee_relationship } = req.body;

    if (!transcript) return res.status(400).json({ error: 'Video transcript required' });

    const creatorRow = await pool.query('SELECT id, participant_id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (creatorRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Create capsule with pending review status
    const result = await pool.query(
      `INSERT INTO legacy_capsules
       (creator_participant_id, capsule_type, video_review_status, affirmation_encrypted, seed_phrase_hash)
       VALUES ($1, 'video', 'pending_review', 'pending_review', 'pending_review')
       RETURNING id`,
      [creatorRow.rows[0].participant_id || creatorRow.rows[0].id]
    );

    const capsuleId = result.rows[0].id;

    // Sonnet evaluates transcript (same safety checks as letter assistant)
    const letterAssistant = require('../abi/letterAssistant');
    const familyContext = await buildFamilyContext(family_unit_id, creatorRow.rows[0].id, null, req.tenantId);
    const feedback = await letterAssistant.evaluate(transcript, 'child', familyContext);

    console.log(`[Premium] Video capsule ${capsuleId} queued for clinical review`);

    res.json({
      capsuleId,
      videoReviewStatus: 'pending_review',
      transcriptFeedback: feedback,
      message: 'Video capsule queued for clinical team review. You will be notified when approved.'
    });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to upload video capsule' });
  }
});

// Check video review status
router.get('/vault/video/:id/status', requireTier('guided_bridge'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, video_review_status, capsule_type FROM legacy_capsules WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Capsule not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Create story arc
router.post('/vault/story-arc', requireTier('guided_bridge'), async (req, res) => {
  try {
    const { family_unit_id, title, description, total_chapters } = req.body;

    if (!title) return res.status(400).json({ error: 'Title required' });
    if (total_chapters && total_chapters > 10) return res.status(400).json({ error: 'Maximum 10 chapters' });

    const creatorRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    if (creatorRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      `INSERT INTO story_arcs (creator_id, family_unit_id, tenant_id, title, description, total_chapters)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [creatorRow.rows[0].id, family_unit_id, req.tenantId, title, description, total_chapters || 1]
    );

    res.json({ arcId: result.rows[0].id, title, totalChapters: total_chapters || 1 });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Failed to create story arc' });
  }
});

// Add chapter to story arc
router.post('/vault/story-arc/:id/chapter', requireTier('guided_bridge'), async (req, res) => {
  try {
    const { capsule_id } = req.body;
    if (!capsule_id) return res.status(400).json({ error: 'capsule_id required' });

    const arc = await pool.query('SELECT * FROM story_arcs WHERE id = $1', [req.params.id]);
    if (arc.rows.length === 0) return res.status(404).json({ error: 'Story arc not found' });

    const a = arc.rows[0];
    const currentChapters = a.capsule_ids || [];

    if (currentChapters.length >= a.total_chapters) {
      return res.status(400).json({ error: 'Story arc is full' });
    }

    currentChapters.push(capsule_id);

    await pool.query(
      `UPDATE story_arcs SET capsule_ids = $1, is_complete = $2 WHERE id = $3`,
      [currentChapters, currentChapters.length >= a.total_chapters, req.params.id]
    );

    // Link capsule to arc
    await pool.query(
      'UPDATE legacy_capsules SET story_arc_id = $1, capsule_type = $2 WHERE id = $3',
      [req.params.id, 'story_arc', capsule_id]
    );

    res.json({
      arcId: req.params.id,
      chapterNumber: currentChapters.length,
      totalChapters: a.total_chapters,
      isComplete: currentChapters.length >= a.total_chapters
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add chapter' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TIER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// Get current tier
router.get('/tier/:familyUnitId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, premium_tier FROM family_units WHERE id = $1',
      [req.params.familyUnitId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Family unit not found' });

    res.json({
      familyUnitId: req.params.familyUnitId,
      currentTier: result.rows[0].premium_tier || 'base',
      availableTiers: ['base', 'guided_bridge', 'family_compass'],
      pricing: {
        guided_bridge: { monthly: 14.99, description: 'Guided Bridge — AI-coached family communication' },
        family_compass: { monthly: 24.99, description: 'Family Compass — Predictive family analytics' }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tier' });
  }
});

// Upgrade tier (pilot: manual, production: Stripe)
router.post('/upgrade/:familyUnitId', async (req, res) => {
  try {
    const { tier } = req.body;
    const validTiers = ['guided_bridge', 'family_compass'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    // For pilot: direct upgrade. For production: Stripe integration
    await pool.query(
      'UPDATE family_units SET premium_tier = $1 WHERE id = $2',
      [tier, req.params.familyUnitId]
    );

    res.json({
      familyUnitId: req.params.familyUnitId,
      newTier: tier,
      message: `Upgraded to ${tier.replace(/_/g, ' ')}. Welcome to premium features!`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upgrade' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CLINICAL ROUTES
// ═══════════════════════════════════════════════════════════════

// View pending disclosures
router.get('/clinical/disclosures', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cd.*, u.first_name as sender_name
       FROM clinical_disclosures cd
       LEFT JOIN users u ON cd.sender_id = u.id
       WHERE cd.review_status IN ('pending', 'reviewing')
       ORDER BY cd.created_at ASC`
    );
    res.json({ disclosures: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get disclosures' });
  }
});

// Review and act on disclosure
router.post('/clinical/disclosures/:id/review', async (req, res) => {
  try {
    const { review_status, review_notes, mandatory_reporting_flag } = req.body;

    const validStatuses = ['reviewing', 'reported', 'resolved', 'false_positive'];
    if (!validStatuses.includes(review_status)) {
      return res.status(400).json({ error: 'Invalid review_status' });
    }

    const clinicianRow = await pool.query('SELECT id FROM users WHERE user_id = $1 OR participant_id = $1', [req.user.userId]);
    const clinicianId = clinicianRow.rows.length > 0 ? clinicianRow.rows[0].id : null;

    await pool.query(
      `UPDATE clinical_disclosures SET
         review_status = $1, review_notes = $2, reviewing_clinician_id = $3,
         reviewed_at = NOW(), mandatory_reporting_flag = COALESCE($4, mandatory_reporting_flag)
       WHERE id = $5`,
      [review_status, review_notes, clinicianId, mandatory_reporting_flag, req.params.id]
    );

    res.json({ success: true, disclosureId: req.params.id, reviewStatus: review_status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review disclosure' });
  }
});

// Pending video capsule reviews
router.get('/clinical/video-review', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, creator_participant_id, video_review_status, created_at
       FROM legacy_capsules
       WHERE capsule_type = 'video' AND video_review_status = 'pending_review'
       ORDER BY created_at ASC`
    );
    res.json({ pendingVideos: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pending videos' });
  }
});

// Approve/reject/request re-record video
router.post('/clinical/video-review/:id', async (req, res) => {
  try {
    const { decision } = req.body;
    const validDecisions = ['approved', 'rejected', 're_record_requested'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ error: 'decision must be approved, rejected, or re_record_requested' });
    }

    // Check current status
    const capsule = await pool.query(
      'SELECT video_review_status FROM legacy_capsules WHERE id = $1',
      [req.params.id]
    );
    if (capsule.rows.length === 0) return res.status(404).json({ error: 'Capsule not found' });

    const currentStatus = capsule.rows[0].video_review_status;

    // One review, one re-record max
    if (currentStatus === 're_record_requested' && decision === 're_record_requested') {
      return res.status(400).json({ error: 'Re-record already requested once. No further re-records allowed.' });
    }

    await pool.query(
      'UPDATE legacy_capsules SET video_review_status = $1 WHERE id = $2',
      [decision, req.params.id]
    );

    let message = '';
    if (decision === 'approved') message = 'Video approved. Ready for encryption and IPFS upload.';
    if (decision === 'rejected') message = 'Video rejected. Parent notified.';
    if (decision === 're_record_requested') message = 'Re-record requested. Parent can submit one more attempt.';

    res.json({ capsuleId: req.params.id, decision, message });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review video' });
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPER: Build family context from DB
// ═══════════════════════════════════════════════════════════════

async function buildFamilyContext(familyUnitId, senderDbId, recipientDbId, tenantId) {
  const context = {
    familyUnitId,
    tenantId,
    senderType: 'parent',
    senderAge: null,
    recipientType: 'child',
    recipientAge: null,
    recipientState: null,
    recoveryPhase: null,
    redFlagKeywords: [],
    patternHistory: null,
    caregiverId: null,
    authorId: senderDbId
  };

  try {
    // Get sender info
    if (senderDbId) {
      const sender = await pool.query('SELECT id, role, first_name FROM users WHERE id = $1', [senderDbId]);
      if (sender.rows.length > 0) {
        const s = sender.rows[0];
        if (s.role === 'participant') context.senderType = 'parent';
      }
    }

    // Get family membership to determine relationship
    if (familyUnitId && senderDbId) {
      const membership = await pool.query(
        'SELECT role FROM family_memberships WHERE family_unit_id = $1 AND user_id = $2',
        [familyUnitId, senderDbId]
      );
      if (membership.rows.length > 0) {
        const role = membership.rows[0].role;
        if (role === 'child') context.senderType = 'child';
        if (role === 'partner') context.senderType = 'partner';
        if (role === 'coparent') context.senderType = 'coparent';
      }
    }

    // Get recipient membership
    if (familyUnitId && recipientDbId) {
      const recipMembership = await pool.query(
        'SELECT role FROM family_memberships WHERE family_unit_id = $1 AND user_id = $2',
        [familyUnitId, recipientDbId]
      );
      if (recipMembership.rows.length > 0) {
        context.recipientType = recipMembership.rows[0].role || 'child';
      }
    }

    // Get caregiver for minor safety
    if (familyUnitId) {
      const caregiver = await pool.query(
        `SELECT fm.user_id FROM family_memberships fm
         WHERE fm.family_unit_id = $1 AND fm.role IN ('parent', 'caregiver')
         LIMIT 1`,
        [familyUnitId]
      );
      if (caregiver.rows.length > 0) {
        context.caregiverId = caregiver.rows[0].user_id;
      }
    }

    // Get red flag keywords from family patterns
    if (familyUnitId) {
      const patterns = await pool.query(
        `SELECT pattern_data FROM family_patterns
         WHERE family_unit_id = $1 AND pattern_type = 'red_flags'`,
        [familyUnitId]
      );
      if (patterns.rows.length > 0 && patterns.rows[0].pattern_data?.keywords) {
        context.redFlagKeywords = patterns.rows[0].pattern_data.keywords;
      }
    }
  } catch (err) {
    // Non-blocking — return context with defaults
    console.error('[Premium] buildFamilyContext failed:', err.message);
  }

  return context;
}

module.exports = router;
