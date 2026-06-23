-- Migration 085 — Coupling B1: DV-screening deny-by-default gate (Jenae's framework)
-- Adds the DV-screening status field to the partnership. The gate
-- (gateEvaluationEngine.evaluateCouplingDvGate) denies ALL Coupling module entry
-- unless dv_screening_status IN ('pass','pass_with_support') — structurally
-- impossible to enter ungated, even before the screening intake exists. No
-- screening/scoring logic here (Jenae owns that intake build).
-- Additive + idempotent (IF NOT EXISTS guards). Raw SQL run_NNN; no ORM.
--
-- Fast-follow room (NOT built here): 90-day re-screen expiry keyed on
-- dv_screened_at; active protective-order -> auto clinical_review_required.

ALTER TABLE partnership_practices ADD COLUMN IF NOT EXISTS dv_screening_status VARCHAR(30)
  DEFAULT 'not_screened' CHECK (dv_screening_status IN (
    'not_screened', 'pass', 'pass_with_support', 'clinical_review_required', 'not_appropriate'));

-- Re-screening freshness timestamp (drives the 90-day expiry fast-follow). Nullable.
ALTER TABLE partnership_practices ADD COLUMN IF NOT EXISTS dv_screened_at TIMESTAMPTZ;
-- Audit of who set the status (clinical accountability). Nullable.
ALTER TABLE partnership_practices ADD COLUMN IF NOT EXISTS dv_screened_by VARCHAR(100);
