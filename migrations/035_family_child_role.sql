-- Migration 035: Add 'child' and 'adult' to family_memberships role CHECK
-- Safety-critical: enables proper disclosure routing for child members.
-- The 'child' role triggers evaluateInbound path and mandatory_reporting_flag.

ALTER TABLE family_memberships DROP CONSTRAINT IF EXISTS family_memberships_role_check;
ALTER TABLE family_memberships ADD CONSTRAINT family_memberships_role_check
  CHECK (role IN ('elder', 'adult', 'adult_child', 'child', 'grandchild', 'extended'));
