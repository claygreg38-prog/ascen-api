-- Migration 060: Add date_of_birth to users
-- Required by: personaEngine.computeAgeBracket(), contextRoute /api/auth/context,
-- childSessionRoutes, ageFilter middleware
-- Missing from prior migrations — column was assumed to exist but never created.

ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
