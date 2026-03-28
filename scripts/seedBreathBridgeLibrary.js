// ============================================================
// Seed: Breath Bridge Message Library
// File: scripts/seedBreathBridgeLibrary.js
//
// 30 preset message templates across 3 age brackets.
// Every entry: parent's effort, never child's engagement,
// no obligation, half-full mindfulness.
//
// Usage: node scripts/seedBreathBridgeLibrary.js
// Or: require and use BREATH_BRIDGE_LIBRARY directly.
// ============================================================

'use strict';

const BREATH_BRIDGE_LIBRARY = [
  // ── ELEMENTARY (10 entries) — simple, concrete ──
  {
    id: 'bb_presence_001',
    template: '{parent_name} took {breath_count} big breaths today. Each one was for you.',
    age_brackets: ['elementary'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_002',
    template: '{parent_name} sat very still and breathed for {duration}. That takes a lot of practice.',
    age_brackets: ['elementary'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_003',
    template: 'Guess what? {parent_name} took {breath_count} breaths today. That is a lot of breaths!',
    age_brackets: ['elementary'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_004',
    template: '{parent_name} was thinking about you today while taking deep breaths.',
    age_brackets: ['elementary'],
    tags: ['presence', 'thinking_of_you'],
  },
  {
    id: 'bb_presence_005',
    template: '{parent_name} practiced breathing today. Slow in, slow out — just like you can do too if you want.',
    age_brackets: ['elementary'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_006',
    template: '{parent_name} did some breathing work today. It made the day a little brighter.',
    age_brackets: ['elementary'],
    tags: ['presence', 'warmth'],
  },
  {
    id: 'bb_presence_007',
    template: 'Today {parent_name} took {breath_count} breaths. Each breath was calm and steady.',
    age_brackets: ['elementary'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_008',
    template: '{parent_name} spent {duration} just breathing today. That is real strength.',
    age_brackets: ['elementary'],
    tags: ['presence', 'strength'],
  },
  {
    id: 'bb_presence_009',
    template: '{parent_name} breathed in and out, nice and slow, {breath_count} times today.',
    age_brackets: ['elementary'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_010',
    template: '{parent_name} worked on staying calm today. One breath at a time.',
    age_brackets: ['elementary'],
    tags: ['presence', 'calm'],
  },

  // ── MIDDLE SCHOOL (10 entries) — slightly more nuanced ──
  {
    id: 'bb_presence_011',
    template: '{parent_name} took {breath_count} breaths today. Showing up like that takes real commitment.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'commitment'],
  },
  {
    id: 'bb_presence_012',
    template: '{parent_name} spent {duration} breathing today — building something steady, one breath at a time.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'building'],
  },
  {
    id: 'bb_presence_013',
    template: '{parent_name} did the work today. {breath_count} breaths, no shortcuts.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_014',
    template: '{parent_name} was thinking of you while breathing today. That is real.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'thinking_of_you'],
  },
  {
    id: 'bb_presence_015',
    template: '{parent_name} put in {duration} of focused breathing today. Consistency matters.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'consistency'],
  },
  {
    id: 'bb_presence_016',
    template: '{parent_name} kept going today — {breath_count} breaths. That kind of effort adds up.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_017',
    template: 'Today {parent_name} chose to sit down and breathe. That choice matters.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'choice'],
  },
  {
    id: 'bb_presence_018',
    template: '{parent_name} showed up for the breathing work again today. {breath_count} breaths in.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'showing_up'],
  },
  {
    id: 'bb_presence_019',
    template: '{parent_name} spent time today working on being steady. {duration} of focused effort.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'steady'],
  },
  {
    id: 'bb_presence_020',
    template: '{parent_name} is building a rhythm. Today was {breath_count} breaths strong.',
    age_brackets: ['middle_school'],
    tags: ['presence', 'rhythm'],
  },

  // ── HIGH SCHOOL (10 entries) — more reflective ──
  {
    id: 'bb_presence_021',
    template: '{parent_name} completed a breathing session today — {breath_count} breaths, {duration}. The work continues.',
    age_brackets: ['high_school'],
    tags: ['presence', 'continuity'],
  },
  {
    id: 'bb_presence_022',
    template: '{parent_name} put in the time today. {duration} of intentional breathing. That is not easy work.',
    age_brackets: ['high_school'],
    tags: ['presence', 'effort'],
  },
  {
    id: 'bb_presence_023',
    template: '{parent_name} was thinking about you during today\'s breathing session. {breath_count} breaths, each one deliberate.',
    age_brackets: ['high_school'],
    tags: ['presence', 'thinking_of_you'],
  },
  {
    id: 'bb_presence_024',
    template: '{parent_name} showed up again today. {breath_count} breaths. The consistency speaks for itself.',
    age_brackets: ['high_school'],
    tags: ['presence', 'consistency'],
  },
  {
    id: 'bb_presence_025',
    template: '{parent_name} is doing the quiet work. Today was {duration} of focused breathing.',
    age_brackets: ['high_school'],
    tags: ['presence', 'quiet_work'],
  },
  {
    id: 'bb_presence_026',
    template: 'Today {parent_name} chose to breathe instead of just getting through the day. That choice matters more than it seems.',
    age_brackets: ['high_school'],
    tags: ['presence', 'choice'],
  },
  {
    id: 'bb_presence_027',
    template: '{parent_name} completed {breath_count} breaths today. Building capacity one session at a time.',
    age_brackets: ['high_school'],
    tags: ['presence', 'capacity'],
  },
  {
    id: 'bb_presence_028',
    template: '{parent_name} sat with the breathing work for {duration} today. There is strength in that stillness.',
    age_brackets: ['high_school'],
    tags: ['presence', 'strength'],
  },
  {
    id: 'bb_presence_029',
    template: '{parent_name} has been putting in steady work. Today: {breath_count} breaths. The rhythm is real.',
    age_brackets: ['high_school'],
    tags: ['presence', 'rhythm'],
  },
  {
    id: 'bb_presence_030',
    template: '{parent_name} breathed through another session today. {duration}, intentional and focused. That adds up.',
    age_brackets: ['high_school'],
    tags: ['presence', 'focus'],
  },
];

/**
 * Get library entries filtered by age bracket.
 * @param {string} ageBracket - 'elementary', 'middle_school', 'high_school'
 * @returns {Array} matching entries
 */
function getLibraryForBracket(ageBracket) {
  return BREATH_BRIDGE_LIBRARY.filter(e => e.age_brackets.includes(ageBracket));
}

/**
 * Apply fallback template substitution (when Haiku fails).
 * @param {string} template
 * @param {Object} vars - { parent_name, breath_count, duration }
 * @returns {string}
 */
function applyTemplate(template, vars) {
  let result = template;
  result = result.replace(/\{parent_name\}/g, vars.parent_name || 'Your parent');
  result = result.replace(/\{breath_count\}/g, vars.breath_count || 'some');
  result = result.replace(/\{duration\}/g, vars.duration || 'a few minutes');
  return result;
}

module.exports = { BREATH_BRIDGE_LIBRARY, getLibraryForBracket, applyTemplate };
