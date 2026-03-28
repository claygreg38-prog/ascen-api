-- Migration 062: Add status column to family_memberships
-- Referenced by breathBridgeService, contextRoute, familyDesignRoutes, and existing
-- familyUnitEngine/familyRoutes code. Existed on production but missing from migration 018.

ALTER TABLE family_memberships ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
