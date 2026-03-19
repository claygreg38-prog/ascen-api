// ============================================================
// [ABI] Therapeutic Letter Writing Assistant
// File: src/abi/letterAssistant.js
//
// Helps parents write letters to children, partners, or co-parents.
// Sonnet provides paragraph-level feedback.
//
// What Sonnet catches: guilt-loading, blame shifting, false promises,
// manipulation, oversharing, emotional burden, red flag violations.
//
// What Sonnet preserves: authentic voice, genuine vulnerability,
// specific accountability, hope without guarantees, cultural expressions.
//
// Flows through ABI orchestrator. No bypasses.
// ============================================================

const { Pool } = require('pg');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CREATE DRAFT ────────────────────────────────────────────

async function createDraft(authorId, recipientId, recipientType, draftText, familyContext) {
  try {
    const result = await pool.query(
      `INSERT INTO therapeutic_letters
       (author_id, family_unit_id, tenant_id, recipient_type, recipient_id, draft_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [authorId, familyContext.familyUnitId, familyContext.tenantId,
       recipientType, recipientId, draftText]
    );

    const letterId = result.rows[0].id;

    // Evaluate immediately
    const feedback = await evaluate(draftText, recipientType, familyContext);

    await pool.query(
      'UPDATE therapeutic_letters SET facilitator_feedback = $1 WHERE id = $2',
      [JSON.stringify(feedback), letterId]
    );

    return { letterId, feedback };
  } catch (err) {
    console.error('[LetterAssistant] createDraft failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to create draft' };
  }
}

// ── EVALUATE DRAFT ──────────────────────────────────────────

async function evaluate(draftText, recipientType, familyContext) {
  const aiRouter = require('../services/aiRouter');

  try {
    const paragraphs = draftText.split(/\n\n+/).filter(p => p.trim());

    const numberedParagraphs = paragraphs.map((p, i) =>
      `[Paragraph ${i}]: "${p.trim()}"`
    ).join('\n\n');

    const result = await aiRouter.route('letter_evaluation', `
      Evaluate this therapeutic letter from a ${familyContext.senderType || 'parent'} to their ${recipientType}.

      Family context:
      - Recipient age: ${familyContext.recipientAge || 'unknown'}
      - Recovery phase: ${familyContext.recoveryPhase || 'unknown'}
      - Red flag keywords/topics: ${(familyContext.redFlagKeywords || []).join(', ') || 'none specified'}

      Letter:
      ${numberedParagraphs}

      For each paragraph, evaluate and mark as:
      - "safe": therapeutically appropriate, authentic
      - "caution": could be improved (provide reframe suggestion)
      - "blocked": contains red flag topic or harmful content

      Watch for:
      - Guilt-loading ("I can't live without you", "You're the only reason I keep going")
      - Blame shifting ("If you hadn't...", "You made me...")
      - False promises ("I'll never do it again", "Everything will be perfect")
      - Manipulation or emotional coercion
      - Oversharing clinical/incarceration details inappropriate for recipient's age
      - Emotional burden on child
      - Red flag topic violations from family's list

      Preserve:
      - Authentic voice and genuine vulnerability
      - Specific accountability ("I hurt you when I...")
      - Hope without guarantees ("I'm working toward...")
      - Cultural/religious expressions of love

      Respond as JSON:
      {
        "paragraphs": [
          { "index": 0, "status": "safe|caution|blocked", "note": "explanation and/or reframe suggestion" }
        ],
        "overall": "brief overall assessment",
        "strengths": ["what the letter does well"],
        "suggestions": ["general suggestions for improvement"]
      }
    `, {
      maxTokens: 1200,
      temperature: 0.3,
      tenantId: familyContext.tenantId,
      userId: familyContext.authorId
    });

    let feedback;
    try {
      feedback = JSON.parse(result?.content || '{}');
    } catch {
      feedback = {
        paragraphs: paragraphs.map((_, i) => ({ index: i, status: 'safe', note: 'AI evaluation unavailable' })),
        overall: 'AI evaluation unavailable — please review manually',
        strengths: [],
        suggestions: []
      };
    }

    return feedback;
  } catch (err) {
    console.error('[LetterAssistant] evaluate failed:', err.message);
    Sentry.captureException(err);
    return {
      paragraphs: [],
      overall: 'Evaluation temporarily unavailable',
      strengths: [],
      suggestions: []
    };
  }
}

// ── UPDATE DRAFT ────────────────────────────────────────────

async function updateDraft(letterId, authorId, newDraftText, familyContext) {
  try {
    const letter = await pool.query(
      'SELECT * FROM therapeutic_letters WHERE id = $1 AND author_id = $2',
      [letterId, authorId]
    );
    if (letter.rows.length === 0) return { error: true, message: 'Letter not found' };
    if (letter.rows[0].is_finalized) return { error: true, message: 'Letter already finalized' };

    const feedback = await evaluate(newDraftText, letter.rows[0].recipient_type, familyContext);

    await pool.query(
      `UPDATE therapeutic_letters SET
         draft_text = $1, draft_count = draft_count + 1, facilitator_feedback = $2
       WHERE id = $3`,
      [newDraftText, JSON.stringify(feedback), letterId]
    );

    return { letterId, draftCount: letter.rows[0].draft_count + 1, feedback };
  } catch (err) {
    console.error('[LetterAssistant] updateDraft failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to update draft' };
  }
}

// ── FINALIZE LETTER ─────────────────────────────────────────

async function finalizeLetter(letterId, authorId, deliveryMethod) {
  try {
    const validMethods = ['channel', 'vault', 'print', 'therapist'];
    if (!validMethods.includes(deliveryMethod)) {
      return { error: true, message: 'Invalid delivery method' };
    }

    const letter = await pool.query(
      'SELECT * FROM therapeutic_letters WHERE id = $1 AND author_id = $2',
      [letterId, authorId]
    );
    if (letter.rows.length === 0) return { error: true, message: 'Letter not found' };
    if (letter.rows[0].is_finalized) return { error: true, message: 'Letter already finalized' };

    const finalText = letter.rows[0].draft_text;

    await pool.query(
      `UPDATE therapeutic_letters SET
         final_text = $1, is_finalized = true, finalized_at = NOW(),
         delivery_method = $2, delivered_at = NOW()
       WHERE id = $3`,
      [finalText, deliveryMethod, letterId]
    );

    // If delivery via vault, create a capsule stub
    let vaultCapsuleId = null;
    if (deliveryMethod === 'vault') {
      // Vault integration would create a capsule — stub for now
      console.log(`[LetterAssistant] Letter ${letterId} stored in vault`);
    }

    // If delivery via channel, create a facilitated message
    if (deliveryMethod === 'channel') {
      const l = letter.rows[0];
      await pool.query(
        `INSERT INTO facilitated_messages
         (family_unit_id, tenant_id, sender_type, sender_id, recipient_type, recipient_id,
          original_text, final_text, channel_type, facilitator_decision, delivered_at)
         VALUES ($1, $2, 'parent', $3, $4, $5, $6, $6, 'parent_child', 'approve', NOW())`,
        [l.family_unit_id, l.tenant_id, l.author_id, l.recipient_type, l.recipient_id, finalText]
      );
    }

    return { letterId, finalized: true, deliveryMethod, vaultCapsuleId };
  } catch (err) {
    console.error('[LetterAssistant] finalizeLetter failed:', err.message);
    Sentry.captureException(err);
    return { error: true, message: 'Failed to finalize letter' };
  }
}

// ── GET LETTER ──────────────────────────────────────────────

async function getLetter(letterId, authorId) {
  try {
    const result = await pool.query(
      'SELECT * FROM therapeutic_letters WHERE id = $1 AND author_id = $2',
      [letterId, authorId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (err) {
    return null;
  }
}

module.exports = {
  createDraft,
  evaluate,
  updateDraft,
  finalizeLetter,
  getLetter
};
