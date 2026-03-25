// ============================================================
// [ABI] LACE Engine — Legacy ACE Assessment
// File: src/abi/laceEngine.js
//
// Breath-first diagnostic. Biometric reading between question
// clusters, not during. Intelligence before disclosure.
//
// 15 domains (LACE_001-LACE_014 + LACE_OPP) from legacy-ace-v2-dual-axis.yaml
// 6 clusters from breath-first-onboarding-and-actions.yaml
// 8 firmware types from YAML firmware_sequence arrays
//
// LACE NEVER produces a SCORE. It produces a MAP.
// Armor strength named BEFORE cost. Always.
// ============================================================

const Sentry = require('../instrument');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════
// 15 LACE DOMAINS — from legacy-ace-v2-dual-axis.yaml
// Each has: armor, strength, cost, firmware_sequence
// ═══════════════════════════════════════════════════════════════

const DOMAINS = [
  {
    id: 'LACE_001', name: 'War / Conflict', cluster: 1,
    armor: 'The Sentinel', strength: 'Kept the family alert and alive under threat',
    cost: 'Hypervigilance that never turns off — even when safe',
    firmware_sequence: ['cache_clearing', 'baseline_reboot', 'file_recovery'],
  },
  {
    id: 'LACE_002', name: 'Persecution / Genocide', cluster: 1,
    armor: 'The Fortress', strength: 'Built impenetrable walls to preserve the family line',
    cost: 'Walls so thick that connection cannot pass through',
    firmware_sequence: ['cache_clearing', 'baseline_reboot', 'cultural_source_code_recovery'],
  },
  {
    id: 'LACE_003', name: 'Natural Disaster', cluster: 1,
    armor: 'The Scanner', strength: 'Reads every environment for danger before entering',
    cost: 'Exhaustion from constant environmental assessment',
    firmware_sequence: ['cache_clearing', 'baseline_reboot'],
  },
  {
    id: 'LACE_004', name: 'Enslavement', cluster: 2,
    armor: 'The Atlas', strength: 'Carried impossible weight so the family could survive',
    cost: 'Cannot put the weight down — rest feels like abandonment',
    firmware_sequence: ['cache_clearing', 'file_recovery', 'legacy_code_deprecation'],
  },
  {
    id: 'LACE_005', name: 'Incarceration', cluster: 2,
    armor: 'The Ghost', strength: 'Learned to disappear to survive confined systems',
    cost: 'Presence feels dangerous — invisibility became identity',
    firmware_sequence: ['cache_clearing', 'file_recovery', 'network_expansion_protocol'],
  },
  {
    id: 'LACE_006', name: 'Medical Trauma', cluster: 2,
    armor: 'The Override', strength: 'Overrode pain signals to keep functioning',
    cost: 'Cannot feel body signals — disconnected from own needs',
    firmware_sequence: ['cache_clearing', 'baseline_reboot', 'legacy_thread'],
  },
  {
    id: 'LACE_007', name: 'Domestic Violence', cluster: 3,
    armor: 'The Chameleon', strength: 'Read moods instantly to stay safe',
    cost: 'Lost sense of self — always performing someone else\'s version of safe',
    firmware_sequence: ['cache_clearing', 'baseline_reboot', 'file_recovery'],
  },
  {
    id: 'LACE_008', name: 'Parentification', cluster: 3,
    armor: 'The Atlas', strength: 'Carried others\' burdens before having language for their own',
    cost: 'Cannot identify own needs — caregiving became the only identity',
    firmware_sequence: ['cache_clearing', 'legacy_code_deprecation', 'legacy_thread'],
  },
  {
    id: 'LACE_009', name: 'Addiction', cluster: 3,
    armor: 'The Hoarder', strength: 'Held tightly to anything stable when chaos was normal',
    cost: 'Cannot release — even things that no longer serve',
    firmware_sequence: ['cache_clearing', 'baseline_reboot', 'legacy_code_deprecation'],
  },
  {
    id: 'LACE_010', name: 'Famine / Scarcity', cluster: 4,
    armor: 'The Hoarder', strength: 'Preserved resources when none were guaranteed',
    cost: 'Scarcity thinking runs even in abundance',
    firmware_sequence: ['cache_clearing', 'gratitude_patch', 'legacy_thread'],
  },
  {
    id: 'LACE_011', name: 'Economic Exploitation', cluster: 4,
    armor: 'The Spender', strength: 'Spent quickly because saving was never rewarded',
    cost: 'Cannot hold — releases too quickly out of learned urgency',
    firmware_sequence: ['cache_clearing', 'legacy_code_deprecation', 'network_expansion_protocol'],
  },
  {
    id: 'LACE_012', name: 'Displacement', cluster: 4,
    armor: 'The Nomad', strength: 'Survived by never attaching to place',
    cost: 'Cannot root — belonging feels temporary',
    firmware_sequence: ['cache_clearing', 'baseline_reboot', 'cultural_source_code_recovery'],
  },
  {
    id: 'LACE_013', name: 'Religious Harm', cluster: 5,
    armor: 'The Refuser', strength: 'Protected the self by rejecting corrupt authority',
    cost: 'Cannot accept guidance — all authority reads as threat',
    firmware_sequence: ['cache_clearing', 'file_recovery', 'cultural_source_code_recovery'],
  },
  {
    id: 'LACE_014', name: 'Unknown Lineage', cluster: 6,
    armor: 'The Wanderer', strength: 'Built identity without inherited maps',
    cost: 'Rootlessness — the body searches for a home that has no address',
    firmware_sequence: ['cache_clearing', 'file_recovery', 'cultural_source_code_recovery'],
  },
  {
    id: 'LACE_OPP', name: 'Oppressor Lineage', cluster: 6,
    armor: 'The Inheritor', strength: 'Carries the awareness that harm was done in the family name',
    cost: 'Guilt that calcifies into paralysis or denial',
    firmware_sequence: ['cache_clearing', 'file_recovery', 'legacy_code_deprecation', 'gratitude_patch'],
  },
];

// ═══════════════════════════════════════════════════════════════
// 6 CLUSTERS — from breath-first-onboarding-and-actions.yaml
// Breath baseline captured between each cluster
// ═══════════════════════════════════════════════════════════════

const CLUSTERS = [
  { number: 1, name: 'External Threat', domains: ['LACE_001', 'LACE_002', 'LACE_003'] },
  { number: 2, name: 'System Contact', domains: ['LACE_004', 'LACE_005', 'LACE_006'] },
  { number: 3, name: 'Household / Relational', domains: ['LACE_007', 'LACE_008', 'LACE_009'] },
  { number: 4, name: 'Economic / Material', domains: ['LACE_010', 'LACE_011', 'LACE_012'] },
  { number: 5, name: 'Identity / Cultural', domains: ['LACE_013'] },
  { number: 6, name: 'Unknown', domains: ['LACE_014', 'LACE_OPP'] },
];

// ═══════════════════════════════════════════════════════════════
// 15 ARMOR DEFINITIONS — strength named BEFORE cost. Always.
// ═══════════════════════════════════════════════════════════════

const ARMORS = {
  'The Sentinel':   { strength: 'Kept the family alert and alive under threat', cost: 'Hypervigilance that never turns off' },
  'The Fortress':   { strength: 'Built impenetrable walls to preserve the family line', cost: 'Walls so thick that connection cannot pass through' },
  'The Ghost':      { strength: 'Learned to disappear to survive', cost: 'Presence feels dangerous' },
  'The Atlas':      { strength: 'Carried impossible weight so the family could survive', cost: 'Cannot put the weight down' },
  'The Override':   { strength: 'Overrode pain signals to keep functioning', cost: 'Disconnected from own needs' },
  'The Chameleon':  { strength: 'Read moods instantly to stay safe', cost: 'Lost sense of self' },
  'The Scanner':    { strength: 'Reads every environment for danger', cost: 'Exhaustion from constant assessment' },
  'The Hoarder':    { strength: 'Preserved resources when none were guaranteed', cost: 'Cannot release even what no longer serves' },
  'The Spender':    { strength: 'Spent quickly because saving was never rewarded', cost: 'Cannot hold — releases too quickly' },
  'The Nomad':      { strength: 'Survived by never attaching to place', cost: 'Cannot root — belonging feels temporary' },
  'The Wanderer':   { strength: 'Built identity without inherited maps', cost: 'The body searches for a home with no address' },
  'The Refuser':    { strength: 'Protected the self by rejecting corrupt authority', cost: 'All authority reads as threat' },
  'The Doubter':    { strength: 'Questioned everything — survived by never trusting blindly', cost: 'Cannot receive trust even when earned' },
  'The Inventor':   { strength: 'Created new systems when inherited ones failed', cost: 'Cannot follow — must always build from scratch' },
  'The Inheritor':  { strength: 'Carries awareness that harm was done in the family name', cost: 'Guilt calcifies into paralysis or denial' },
};

// ═══════════════════════════════════════════════════════════════
// ENGINE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function startAssessment(userId, familyUnitId, tenantId) {
  try {
    const result = await pool.query(
      `INSERT INTO lace_assessments (user_id, family_unit_id, tenant_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, familyUnitId, tenantId]
    );
    return { id: result.rows[0].id, domains: DOMAINS, clusters: CLUSTERS };
  } catch (err) {
    console.error('[LACE] Start assessment failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function recordDomainResponse(assessmentId, domainId, response, biometricSnapshot) {
  // response: { acknowledged: boolean, intensity: 'none' | 'some' | 'significant' }
  // biometricSnapshot: { hr, hrv, coherence, ns3 } captured during/after question
  try {
    const assessment = await pool.query(
      'SELECT domain_responses, biometric_snapshots FROM lace_assessments WHERE id = $1',
      [assessmentId]
    );
    if (!assessment.rows.length) throw new Error('Assessment not found');

    const domains = assessment.rows[0].domain_responses || {};
    const snapshots = assessment.rows[0].biometric_snapshots || [];

    domains[domainId] = response;
    if (biometricSnapshot) {
      snapshots.push({ domainId, ...biometricSnapshot, timestamp: Date.now() });
    }

    await pool.query(
      'UPDATE lace_assessments SET domain_responses = $1, biometric_snapshots = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(domains), JSON.stringify(snapshots), assessmentId]
    );
  } catch (err) {
    console.error('[LACE] Record domain response failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function recordBreathBaseline(assessmentId, clusterNumber, baseline) {
  // baseline: { coherence, hr, hrv, ns3, duration_seconds }
  try {
    const assessment = await pool.query(
      'SELECT breath_baselines FROM lace_assessments WHERE id = $1',
      [assessmentId]
    );
    if (!assessment.rows.length) throw new Error('Assessment not found');

    const baselines = assessment.rows[0].breath_baselines || [];
    baselines.push({ cluster: clusterNumber, ...baseline, timestamp: Date.now() });

    await pool.query(
      'UPDATE lace_assessments SET breath_baselines = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(baselines), assessmentId]
    );
  } catch (err) {
    console.error('[LACE] Record breath baseline failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function confirmArmor(assessmentId, armorName, biometricResponse) {
  // biometricResponse: the body's reaction when the armor is named
  // HRV increase (regulated shift) = "felt seen" = confirmed
  // HR spike (activated response) = resonance but not ready to name
  try {
    const assessment = await pool.query(
      'SELECT confirmed_armors FROM lace_assessments WHERE id = $1',
      [assessmentId]
    );
    if (!assessment.rows.length) throw new Error('Assessment not found');

    const armors = assessment.rows[0].confirmed_armors || [];
    armors.push({
      name: armorName,
      confirmed: biometricResponse.hrv_delta > 0,
      biometric: biometricResponse,
      armor_info: ARMORS[armorName] || null,
      timestamp: Date.now(),
    });

    await pool.query(
      'UPDATE lace_assessments SET confirmed_armors = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(armors), assessmentId]
    );
  } catch (err) {
    console.error('[LACE] Confirm armor failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function completeAssessment(assessmentId) {
  try {
    await pool.query(
      "UPDATE lace_assessments SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
      [assessmentId]
    );

    const assessment = await pool.query('SELECT * FROM lace_assessments WHERE id = $1', [assessmentId]);
    const data = assessment.rows[0];

    // Generate armor MAP (NOT a score — this is absolute)
    const domainsActivated = Object.entries(data.domain_responses || {})
      .filter(([, r]) => r.acknowledged || r.intensity !== 'none')
      .map(([id]) => {
        const domain = DOMAINS.find(d => d.id === id);
        return domain ? { id: domain.id, name: domain.name, armor: domain.armor, firmware_sequence: domain.firmware_sequence } : null;
      })
      .filter(Boolean);

    const confirmedArmors = (data.confirmed_armors || [])
      .filter(a => a.confirmed)
      .map(a => ({ name: a.name, ...ARMORS[a.name] }));

    // Aggregate firmware needs from activated domains
    const firmwareNeeds = {};
    domainsActivated.forEach(d => {
      (d.firmware_sequence || []).forEach(fw => {
        firmwareNeeds[fw] = (firmwareNeeds[fw] || 0) + 1;
      });
    });

    return {
      domains_activated: domainsActivated,
      confirmed_armors: confirmedArmors,
      firmware_needs: firmwareNeeds,
      pacing_track: data.pacing_track,
      breath_trajectory: analyzeBreathTrajectory(data.breath_baselines),
    };
  } catch (err) {
    console.error('[LACE] Complete assessment failed:', err.message);
    Sentry.captureException(err);
    throw err;
  }
}

async function getStatus(assessmentId) {
  const result = await pool.query(
    'SELECT id, status, domain_responses, confirmed_armors, pacing_track, created_at, completed_at FROM lace_assessments WHERE id = $1',
    [assessmentId]
  );
  if (!result.rows.length) return null;

  const data = result.rows[0];
  const answeredDomains = Object.keys(data.domain_responses || {}).length;

  return {
    id: data.id,
    status: data.status,
    domains_answered: answeredDomains,
    domains_total: DOMAINS.length,
    armors_confirmed: (data.confirmed_armors || []).filter(a => a.confirmed).length,
    pacing_track: data.pacing_track,
    created_at: data.created_at,
    completed_at: data.completed_at,
  };
}

function analyzeBreathTrajectory(baselines) {
  if (!baselines || baselines.length < 2) return 'insufficient';
  const first = baselines[0];
  const last = baselines[baselines.length - 1];
  if ((last.coherence || 0) > (first.coherence || 0) + 0.1) return 'improving';
  if ((last.coherence || 0) < (first.coherence || 0) - 0.1) return 'declining';
  return 'stable';
}

module.exports = {
  startAssessment,
  recordDomainResponse,
  recordBreathBaseline,
  confirmArmor,
  completeAssessment,
  getStatus,
  DOMAINS,
  CLUSTERS,
  ARMORS,
};
