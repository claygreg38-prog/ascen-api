// ============================================================
// Capacity Display Mapping — Age-Appropriate State Labels
// File: src/utils/capacityDisplay.js
//
// Maps capacity state to age-appropriate display format.
// Gaming display for children is respectful, not condescending.
// ============================================================

'use strict';

const GAMING_DISPLAY = {
  full:         { label: 'Maxed Out!', power: 100, bar: '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588', color: '#5CE0D0' },
  steady:       { label: 'Powered Up', power: 75,  bar: '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591', color: '#A8CCE8' },
  drawing_down: { label: 'Using Energy', power: 50, bar: '\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591', color: '#E8BE6A' },
  low:          { label: 'Recharging', power: 25,  bar: '\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591', color: '#E09878' },
  depleted:     { label: 'Rest Mode', power: 10,   bar: '\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591', color: '#D88AA0' }
};

const ENERGY_BAR_DISPLAY = {
  full:         { label: 'Full Energy!', stars: 5, color: '#5CE0D0' },
  steady:       { label: 'Good Energy', stars: 4, color: '#A8CCE8' },
  drawing_down: { label: 'Getting Tired', stars: 3, color: '#E8BE6A' },
  low:          { label: 'Need Rest', stars: 2, color: '#E09878' },
  depleted:     { label: 'Resting', stars: 1, color: '#D88AA0' }
};

function getCapacityDisplay(state, displayType) {
  if (displayType === 'energy_bar') return ENERGY_BAR_DISPLAY[state] || ENERGY_BAR_DISPLAY.steady;
  if (displayType === 'gaming') return GAMING_DISPLAY[state] || GAMING_DISPLAY.steady;
  return null; // Standard display handled by existing CAPACITY_STATES map
}

module.exports = { getCapacityDisplay, GAMING_DISPLAY, ENERGY_BAR_DISPLAY };
