// ============================================================
// drillAdapter.js — Grounding drill selection & adaptation
// ============================================================

const DRILLS = [
  { id: 'five_senses', name: '5-4-3-2-1 Grounding', duration: 120, intensity: 'low', description: 'Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste.' },
  { id: 'body_scan', name: 'Quick Body Scan', duration: 90, intensity: 'low', description: 'Notice your feet on the floor. Your hands. Your breath.' },
  { id: 'cold_anchor', name: 'Temperature Anchor', duration: 60, intensity: 'medium', description: 'Press your palms together firmly. Feel the warmth.' },
  { id: 'bilateral', name: 'Bilateral Tap', duration: 90, intensity: 'medium', description: 'Alternate tapping your knees. Left, right, left, right.' }
];

function adaptDrill(drillId, track) {
  const drill = DRILLS.find(d => d.id === drillId);
  if (!drill) return null;
  const adapted = { ...drill };
  if (track === 'minimal') adapted.duration = Math.round(adapted.duration * 0.7);
  if (track === 'gentle') adapted.duration = Math.round(adapted.duration * 0.85);
  return adapted;
}

function filterDrillRecommendation(stateResult) {
  const { response_level } = stateResult;
  if (response_level >= 4) return DRILLS.filter(d => d.intensity === 'low');
  return DRILLS;
}

function getAllDrillsForUser(track) {
  return DRILLS.map(d => adaptDrill(d.id, track));
}

module.exports = { adaptDrill, filterDrillRecommendation, getAllDrillsForUser, DRILLS };
