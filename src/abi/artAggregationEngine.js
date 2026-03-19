// ============================================================
// [ABI] Art Aggregation Engine — Cumulative Mandalas & Constellations
// File: src/abi/artAggregationEngine.js
//
// Flows through ABI orchestrator. Generates milestone art from
// aggregate session data. Deterministic: same history = same art.
//
// Exports:
//   checkMilestone(participantId, sessionNumber)
//   generateMandala(participantId, aggregationType)
//   checkFamilyMilestone(familyUnitId)
//   generateConstellation(familyUnitId, triggerType)
// ============================================================

const crypto = require('crypto');
const { Pool } = require('pg');
const breathArtEngine = require('./breathArtEngine');
const ipfsService = require('../services/ipfsService');
const Sentry = require('../instrument');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── MILESTONE DETECTION ─────────────────────────────────────

/**
 * Check if a session number triggers an art aggregation.
 *
 * @param {string} participantId
 * @param {number} sessionNumber - Total sessions completed
 * @returns {Promise<string|null>} aggregation type or null
 */
async function checkMilestone(participantId, sessionNumber) {
  // Capstone milestones (highest priority)
  if (sessionNumber === 365 || sessionNumber === 1000) {
    return 'capstone';
  }

  // Annual ring: exactly 365 days from first session
  try {
    const firstSession = await pool.query(
      `SELECT completed_at FROM session_completions
       WHERE user_id = $1 ORDER BY completed_at ASC LIMIT 1`,
      [participantId]
    );
    if (firstSession.rows.length > 0) {
      const firstDate = new Date(firstSession.rows[0].completed_at);
      const now = new Date();
      const daysSinceFirst = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));
      if (daysSinceFirst === 365) {
        return 'annual_ring';
      }
    }
  } catch (err) {
    console.error('[ArtAggregation] Annual ring check failed:', err.message);
  }

  // Arc completion check
  try {
    const lastSession = await pool.query(
      `SELECT arc_id FROM session_completions
       WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1`,
      [participantId]
    );
    if (lastSession.rows.length > 0 && lastSession.rows[0].arc_id) {
      const currentArc = lastSession.rows[0].arc_id;
      // Check if this is the last session in the arc
      const arcTemplate = await pool.query(
        `SELECT MAX(session_number) as max_session FROM session_templates
         WHERE arc = $1`,
        [currentArc]
      );
      if (arcTemplate.rows.length > 0) {
        const arcSessions = await pool.query(
          `SELECT COUNT(*) as c FROM session_completions
           WHERE user_id = $1 AND arc_id = $2`,
          [participantId, currentArc]
        );
        const maxInArc = await pool.query(
          `SELECT COUNT(*) as c FROM session_templates WHERE arc = $1`,
          [currentArc]
        );
        if (parseInt(arcSessions.rows[0].c) >= parseInt(maxInArc.rows[0].c) && parseInt(maxInArc.rows[0].c) > 0) {
          return 'arc_completion';
        }
      }
    }
  } catch (err) {
    console.error('[ArtAggregation] Arc completion check failed:', err.message);
  }

  // Epoch milestones
  if (sessionNumber % 100 === 0) return 'mandala_100';
  if (sessionNumber % 50 === 0) return 'mandala_50';

  return null;
}

// ── MANDALA GENERATION ──────────────────────────────────────

/**
 * Generate a cumulative mandala from aggregate session data.
 *
 * @param {string} participantId
 * @param {string} aggregationType - mandala_50, mandala_100, arc_completion, annual_ring, capstone
 * @returns {Promise<Object>} { aggregationId, artIpfsHash, tokenId }
 */
async function generateMandala(participantId, aggregationType) {
  // 1. Determine session range
  const range = await getSessionRange(participantId, aggregationType);

  // 2. Fetch sessions in range
  const sessions = await pool.query(
    `SELECT session_number, packet_hash, coherence_score, coherence_end,
            ns3_mean, ns3_peak, sustained_optimal, regulatory_trajectory,
            arc_id, breath_track_at_completion, cycle_completion_rate,
            completed_at
     FROM session_completions
     WHERE user_id = $1 AND session_number >= $2 AND session_number <= $3
     ORDER BY session_number ASC`,
    [participantId, range.start, range.end]
  );

  if (sessions.rows.length === 0) {
    console.warn(`[ArtAggregation] No sessions found for ${participantId} range ${range.start}-${range.end}`);
    return null;
  }

  // 3. Compute aggregate visual parameters
  const aggregateParams = computeAggregateParams(sessions.rows);

  // 4. Generate deterministic seed from concatenated packetHashes
  const sessionPacketHashes = sessions.rows
    .filter(s => s.packet_hash)
    .sort((a, b) => a.session_number - b.session_number);

  const concatenated = sessionPacketHashes.map(s => s.packet_hash).join('');
  const seed = crypto.createHash('sha256').update(concatenated).digest('hex');

  // 5. Build aggregate summary matching breathArtEngine.generate() format
  const aggregateSummary = {
    ns3: {
      mean: aggregateParams.avgNS3Mean,
      peak: aggregateParams.avgNS3Peak,
      floor: aggregateParams.minNS3Mean
    },
    clinical: {
      regulatoryTrajectory: aggregateParams.dominantTrajectory,
      sustainedOptimal: aggregateParams.sustainedOptimalPct > 0.5
    },
    verificationPayload: {
      peakCoherence: aggregateParams.meanCoherencePeak
    }
  };

  const artOptions = {
    session_count: sessions.rows.length,
    track: aggregateParams.dominantTrack || 'standard',
    arc_name: aggregateParams.dominantArc || 'aggregate',
    time_to_regulation_sec: null,
    breath_accuracy: aggregateParams.avgCompletionRate,
    milestone_session: aggregationType === 'capstone' ? 1000 : 50
  };

  // 6. Generate deterministic SVG
  const { svgString, metadataJSON } = breathArtEngine.generate(aggregateSummary, seed, artOptions);

  // Override metadata for aggregation
  metadataJSON.name = getAggregationName(aggregationType, range);
  metadataJSON.description = getAggregationDescription(aggregationType, sessions.rows.length, range);
  metadataJSON.attributes.push({ trait_type: 'Aggregation', value: aggregationType });
  metadataJSON.attributes.push({ trait_type: 'Sessions Included', value: sessions.rows.length });

  // 7. Render at 1200x1200 (larger than session art 800x800)
  const sharp = require('sharp');
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(1200, 1200)
    .png()
    .toBuffer();

  // 8. Upload to IPFS
  const clinicalPayload = {
    aggregation_type: aggregationType,
    session_range: `${range.start}-${range.end}`,
    session_count: sessions.rows.length,
    aggregate_ns3_mean: aggregateParams.avgNS3Mean,
    dominant_trajectory: aggregateParams.dominantTrajectory,
    zone_distribution: aggregateParams.zoneDistribution
  };

  let imageHash = null;
  let metadataHash = null;
  try {
    const ipfsResult = await ipfsService.upload(
      pngBuffer, metadataJSON, clinicalPayload,
      { sessionNumber: `agg_${aggregationType}`, firstName: 'Aggregate' }
    );
    imageHash = ipfsResult.imageHash;
    metadataHash = ipfsResult.metadataHash;
  } catch (err) {
    console.error('[ArtAggregation] IPFS upload failed:', err.message);
    Sentry.captureException(err);
  }

  // 9. Store in art_aggregations table
  const participantRow = await pool.query(
    `SELECT id FROM users WHERE user_id = $1`,
    [participantId]
  );
  const participantDbId = participantRow.rows[0]?.id || null;

  const insertResult = await pool.query(
    `INSERT INTO art_aggregations (
       participant_id, aggregation_type, session_range_start, session_range_end,
       arc_name, seed_hash, art_ipfs_hash, aggregate_parameters
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      participantDbId,
      aggregationType,
      range.start,
      range.end,
      aggregateParams.dominantArc,
      seed,
      metadataHash,
      JSON.stringify(aggregateParams)
    ]
  );

  const aggregationId = insertResult.rows[0].id;

  console.log(`[ArtAggregation] Generated ${aggregationType} for ${participantId}: sessions ${range.start}-${range.end}, IPFS: ${metadataHash}`);

  return {
    aggregationId,
    artIpfsHash: metadataHash,
    imageHash,
    tokenId: null, // Mint separately if blockchain writes active
    aggregationType,
    sessionRange: range,
    sessionCount: sessions.rows.length
  };
}

// ── SESSION RANGE HELPERS ───────────────────────────────────

async function getSessionRange(participantId, aggregationType) {
  if (aggregationType === 'capstone') {
    const result = await pool.query(
      `SELECT MIN(session_number) as min_s, MAX(session_number) as max_s
       FROM session_completions WHERE user_id = $1`,
      [participantId]
    );
    return { start: result.rows[0].min_s || 1, end: result.rows[0].max_s || 1 };
  }

  if (aggregationType === 'annual_ring') {
    const result = await pool.query(
      `SELECT MIN(session_number) as min_s, MAX(session_number) as max_s
       FROM session_completions
       WHERE user_id = $1 AND completed_at > NOW() - INTERVAL '365 days'`,
      [participantId]
    );
    return { start: result.rows[0].min_s || 1, end: result.rows[0].max_s || 1 };
  }

  if (aggregationType === 'arc_completion') {
    const lastArc = await pool.query(
      `SELECT arc_id FROM session_completions
       WHERE user_id = $1 AND arc_id IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [participantId]
    );
    if (lastArc.rows.length > 0) {
      const arcId = lastArc.rows[0].arc_id;
      const arcRange = await pool.query(
        `SELECT MIN(session_number) as min_s, MAX(session_number) as max_s
         FROM session_completions WHERE user_id = $1 AND arc_id = $2`,
        [participantId, arcId]
      );
      return { start: arcRange.rows[0].min_s || 1, end: arcRange.rows[0].max_s || 1 };
    }
  }

  // mandala_50 or mandala_100
  const epochSize = aggregationType === 'mandala_100' ? 100 : 50;
  const total = await pool.query(
    `SELECT MAX(session_number) as max_s FROM session_completions WHERE user_id = $1`,
    [participantId]
  );
  const maxSession = total.rows[0].max_s || epochSize;
  const epochStart = maxSession - epochSize + 1;
  return { start: Math.max(1, epochStart), end: maxSession };
}

// ── AGGREGATE PARAMETER COMPUTATION ─────────────────────────

function computeAggregateParams(sessions) {
  const zoneDistribution = { optimal: 0, approaching: 0, below_window: 0, regulated: 0 };
  let totalNS3Mean = 0, totalNS3Peak = 0, totalCoherence = 0, totalCompletionRate = 0;
  let minNS3Mean = Infinity;
  const trajectoryCounts = {};
  const trackCounts = {};
  const arcCounts = {};
  let sustainedOptimalCount = 0;

  for (const s of sessions) {
    const ns3Mean = parseFloat(s.ns3_mean) || 50;
    const ns3Peak = parseFloat(s.ns3_peak) || 50;

    totalNS3Mean += ns3Mean;
    totalNS3Peak += ns3Peak;
    totalCoherence += parseFloat(s.coherence_score) || 0;
    totalCompletionRate += parseFloat(s.cycle_completion_rate) || 0;

    if (ns3Mean < minNS3Mean) minNS3Mean = ns3Mean;

    // Zone classification
    if (ns3Mean >= 56) zoneDistribution.optimal++;
    else if (ns3Mean >= 36) zoneDistribution.approaching++;
    else if (ns3Mean <= 35) zoneDistribution.below_window++;
    else zoneDistribution.regulated++;

    if (s.sustained_optimal) sustainedOptimalCount++;

    const traj = s.regulatory_trajectory || 'stable';
    trajectoryCounts[traj] = (trajectoryCounts[traj] || 0) + 1;

    const track = s.breath_track_at_completion || 'standard';
    trackCounts[track] = (trackCounts[track] || 0) + 1;

    if (s.arc_id) {
      arcCounts[s.arc_id] = (arcCounts[s.arc_id] || 0) + 1;
    }
  }

  const n = sessions.length || 1;
  const dominantTrajectory = Object.entries(trajectoryCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'stable';
  const dominantTrack = Object.entries(trackCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'standard';
  const dominantArc = Object.entries(arcCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    avgNS3Mean: Math.round((totalNS3Mean / n) * 100) / 100,
    avgNS3Peak: Math.round((totalNS3Peak / n) * 100) / 100,
    minNS3Mean: minNS3Mean === Infinity ? 50 : minNS3Mean,
    meanCoherencePeak: Math.round((totalCoherence / n) * 100) / 100,
    avgCompletionRate: Math.round((totalCompletionRate / n) * 100) / 100,
    sustainedOptimalPct: sustainedOptimalCount / n,
    dominantTrajectory,
    dominantTrack,
    dominantArc,
    zoneDistribution,
    sessionCount: n
  };
}

// ── AGGREGATION NAMING ──────────────────────────────────────

function getAggregationName(type, range) {
  const names = {
    mandala_50: `Mandala — Sessions ${range.start}-${range.end}`,
    mandala_100: `Century Mandala — Sessions ${range.start}-${range.end}`,
    arc_completion: `Arc Completion Mandala`,
    annual_ring: `Annual Ring — Year One`,
    capstone: `Capstone — The Complete Journey`
  };
  return names[type] || `Mandala — ${type}`;
}

function getAggregationDescription(type, count, range) {
  const descs = {
    mandala_50: `A mandala woven from ${count} sessions of healing. Sessions ${range.start} through ${range.end}.`,
    mandala_100: `A century mandala — ${count} sessions compressed into sacred geometry.`,
    arc_completion: `This arc is complete. ${count} sessions form this composition.`,
    annual_ring: `One year of breath. ${count} sessions rendered as concentric rings.`,
    capstone: `The capstone — every session in the journey, compressed into one irreproducible piece.`
  };
  return descs[type] || `Aggregate art from ${count} sessions.`;
}

// ── FAMILY CONSTELLATION ────────────────────────────────────

/**
 * Check if a family unit has reached a combined session milestone.
 *
 * @param {string} familyUnitId
 * @returns {Promise<string|null>} trigger_type or null
 */
async function checkFamilyMilestone(familyUnitId) {
  try {
    const result = await pool.query(
      `SELECT SUM(u.total_sessions_completed) as total
       FROM users u
       WHERE u.family_unit_id = $1`,
      [familyUnitId]
    );

    const total = parseInt(result.rows[0]?.total) || 0;

    // Check if this milestone was already generated
    const milestones = [
      { threshold: 1000, type: 'combined_1000' },
      { threshold: 500, type: 'combined_500' },
      { threshold: 100, type: 'combined_100' }
    ];

    for (const m of milestones) {
      if (total >= m.threshold) {
        const existing = await pool.query(
          `SELECT id FROM family_constellations
           WHERE family_unit_id = $1 AND trigger_type = $2`,
          [familyUnitId, m.type]
        );
        if (existing.rows.length === 0) {
          return m.type;
        }
      }
    }
  } catch (err) {
    console.error('[ArtAggregation] Family milestone check failed:', err.message);
    Sentry.captureException(err);
  }

  return null;
}

/**
 * Generate a family constellation art piece.
 *
 * @param {string} familyUnitId
 * @param {string} triggerType - combined_100, combined_500, combined_1000
 * @returns {Promise<Object>}
 */
async function generateConstellation(familyUnitId, triggerType) {
  // 1. Fetch family unit info
  const familyUnit = await pool.query(
    `SELECT * FROM family_units WHERE id = $1`,
    [familyUnitId]
  );

  if (familyUnit.rows.length === 0) {
    console.warn('[ArtAggregation] Family unit not found:', familyUnitId);
    return null;
  }

  const family = familyUnit.rows[0];
  const elderUserId = family.elder_user_id;

  // 2. Fetch all family members with session data
  const members = await pool.query(
    `SELECT u.user_id, u.first_name, u.total_sessions_completed,
            (SELECT ns3_mean FROM session_completions
             WHERE user_id = u.user_id ORDER BY completed_at DESC LIMIT 1) as last_ns3,
            (SELECT completed_at FROM session_completions
             WHERE user_id = u.user_id ORDER BY completed_at DESC LIMIT 1) as last_session_date,
            (SELECT packet_hash FROM session_completions
             WHERE user_id = u.user_id ORDER BY completed_at DESC LIMIT 1) as last_packet_hash
     FROM users u
     WHERE u.family_unit_id = $1`,
    [familyUnitId]
  );

  if (members.rows.length === 0) return null;

  // 3. Build member contributions
  const totalSessions = members.rows.reduce((s, m) => s + (m.total_sessions_completed || 0), 0);
  const memberContributions = members.rows.map(m => {
    const ns3Mean = parseFloat(m.last_ns3) || 50;
    let dominantZone = 'regulated';
    if (ns3Mean >= 56) dominantZone = 'optimal';
    else if (ns3Mean >= 36) dominantZone = 'approaching';
    else if (ns3Mean <= 35) dominantZone = 'below_window';

    return {
      user_id: m.user_id,
      session_count: m.total_sessions_completed || 0,
      dominant_zone: dominantZone,
      last_session_date: m.last_session_date ? new Date(m.last_session_date).toISOString() : null,
      is_elder: m.user_id === elderUserId
    };
  });

  // 4. Generate seed from all members' most recent packetHashes
  const packetHashes = members.rows
    .filter(m => m.last_packet_hash)
    .map(m => m.last_packet_hash);
  const concatenated = packetHashes.join('');
  const seed = concatenated.length > 0
    ? crypto.createHash('sha256').update(concatenated).digest('hex')
    : crypto.createHash('sha256').update(familyUnitId + triggerType).digest('hex');

  // 5. Build aggregate summary for breathArtEngine
  const avgNS3 = memberContributions.reduce((s, m) => {
    const ns3 = m.dominant_zone === 'optimal' ? 65 : m.dominant_zone === 'approaching' ? 45 : 30;
    return s + ns3;
  }, 0) / memberContributions.length;

  const constellationSummary = {
    ns3: { mean: avgNS3, peak: avgNS3 + 10, floor: avgNS3 - 10 },
    clinical: { regulatoryTrajectory: 'stable', sustainedOptimal: false },
    verificationPayload: { peakCoherence: 0.65 }
  };

  const artOptions = {
    session_count: totalSessions,
    family_unit_active: true,
    lightbridge_active: true,
    track: 'standard',
    arc_name: 'family_constellation'
  };

  // 6. Generate SVG
  const { svgString, metadataJSON } = breathArtEngine.generate(constellationSummary, seed, artOptions);

  metadataJSON.name = `Family Constellation — ${triggerType.replace('combined_', '')} Sessions`;
  metadataJSON.description = `A family constellation representing ${totalSessions} combined sessions across ${members.rows.length} family members.`;
  metadataJSON.attributes.push({ trait_type: 'Family Members', value: members.rows.length });
  metadataJSON.attributes.push({ trait_type: 'Combined Sessions', value: totalSessions });

  // 7. Render at 1200x1200
  const sharp = require('sharp');
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(1200, 1200)
    .png()
    .toBuffer();

  // 8. Upload to IPFS
  let metadataHash = null;
  try {
    const ipfsResult = await ipfsService.upload(
      pngBuffer, metadataJSON, { family_unit_id: familyUnitId, trigger_type: triggerType },
      { sessionNumber: `constellation_${triggerType}`, firstName: 'Family' }
    );
    metadataHash = ipfsResult.metadataHash;
  } catch (err) {
    console.error('[ArtAggregation] Constellation IPFS upload failed:', err.message);
    Sentry.captureException(err);
  }

  // 9. Store in family_constellations
  const insertResult = await pool.query(
    `INSERT INTO family_constellations (
       family_unit_id, trigger_type, combined_session_count,
       member_contributions, constellation_art_ipfs_hash
     ) VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [familyUnitId, triggerType, totalSessions, JSON.stringify(memberContributions), metadataHash]
  );

  console.log(`[ArtAggregation] Family constellation ${triggerType} for ${familyUnitId}, IPFS: ${metadataHash}`);

  return {
    constellationId: insertResult.rows[0].id,
    artIpfsHash: metadataHash,
    triggerType,
    totalSessions,
    memberCount: members.rows.length
  };
}

// ── EXPORTS ─────────────────────────────────────────────────

module.exports = {
  checkMilestone,
  generateMandala,
  checkFamilyMilestone,
  generateConstellation
};
