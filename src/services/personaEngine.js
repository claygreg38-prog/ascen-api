// ============================================================
// Persona Engine — Age Bracket + Persona Resolution
// File: src/services/personaEngine.js
//
// Computes age brackets from date_of_birth for content filtering.
// Elementary (6-10), Middle School (11-13), High School (14-17), Adult (18+).
// No date_of_birth = adult (safe default).
// ============================================================

'use strict';

/**
 * Compute age bracket from date of birth.
 * @param {string|Date|null} dateOfBirth
 * @returns {string} 'elementary' | 'middle_school' | 'high_school' | 'adult'
 */
function computeAgeBracket(dateOfBirth) {
  if (!dateOfBirth) return 'adult';

  const age = computeAge(dateOfBirth);
  if (age === null || age >= 18) return 'adult';
  if (age >= 14) return 'high_school';
  if (age >= 11) return 'middle_school';
  if (age >= 6) return 'elementary';

  // Under 6 — treat as elementary (floor)
  return 'elementary';
}

/**
 * Compute age in years from date of birth.
 * @param {string|Date|null} dateOfBirth
 * @returns {number|null} Age in years, or null if invalid
 */
function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

module.exports = { computeAgeBracket, computeAge };
