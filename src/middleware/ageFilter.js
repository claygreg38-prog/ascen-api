// ============================================================
// Age Filter Middleware — Server-Side Content Gating
// File: src/middleware/ageFilter.js
//
// Adds age filtering context to every request. All content-serving
// endpoints use req.ageFilter to restrict content by age.
//
// Age filtering is SERVER-SIDE. The frontend never decides
// what content a child can see.
// ============================================================

'use strict';

const { computeAgeBracket, computeAge } = require('../services/personaEngine');

/**
 * Middleware that adds age filtering to the request context.
 */
function ageFilter() {
  return (req, res, next) => {
    const dateOfBirth = req.user?.dateOfBirth || req.user?.date_of_birth || null;
    const ageBracket = req.user?.ageBracket || computeAgeBracket(dateOfBirth);
    const actualAge = computeAge(dateOfBirth);

    const ageConfig = getAgeConfig(ageBracket);

    req.ageFilter = {
      bracket: ageBracket,
      actualAge,
      maxSessionMinutes: ageConfig.maxSessionMinutes,
      contentFormat: ageConfig.contentFormat,
      capacityDisplay: ageConfig.capacityDisplay,
      uiStyle: ageConfig.uiStyle,
      // SQL helper: WHERE min_age <= $N
      // Review Fix #1: use actual age from date_of_birth, not bracket ceiling.
      // A 6-year-old filters with min_age <= 6, not min_age <= 10.
      sqlClause: (paramIndex) => `min_age <= $${paramIndex}`,
      sqlValue: actualAge !== null ? actualAge : 99
    };

    next();
  };
}

function getAgeConfig(bracket) {
  switch (bracket) {
    case 'elementary':
      return {
        maxSessionMinutes: 5,
        contentFormat: 'drawing',       // Prompts produce drawing activities
        capacityDisplay: 'energy_bar',  // Gamified: stars
        uiStyle: 'gaming'
      };
    case 'middle_school':
      return {
        maxSessionMinutes: 12,
        contentFormat: 'writing',       // Written prompts, journal-style
        capacityDisplay: 'gaming',      // Gaming language: "Power Level: 72"
        uiStyle: 'gaming'
      };
    case 'high_school':
      return {
        maxSessionMinutes: 12,
        contentFormat: 'speaking',      // Spoken prompts in quilting, direct questions
        capacityDisplay: 'standard',    // Full capacity labels
        uiStyle: 'standard'
      };
    default: // adult
      return {
        maxSessionMinutes: 20,
        contentFormat: 'reflective',
        capacityDisplay: 'standard',
        uiStyle: 'standard'
      };
  }
}

module.exports = { ageFilter, getAgeConfig };
