-- Migration 061: Add columns assumed by code but missing from prior migrations
-- These existed on production (created manually) but not on fresh staging databases.

-- Issue 2: session_completions.created_at (referenced by sessionStateManager INSERT,
-- preventionImpactEngine, bondMaturationEngine, trendAnalyzer)
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Issue 3: users.total_sessions_completed (referenced by contextRoute, sessionOrchestrator,
-- familyUnitEngine, familyIntelligence, artAggregationEngine, abiRoutes, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_sessions_completed INTEGER DEFAULT 0;
