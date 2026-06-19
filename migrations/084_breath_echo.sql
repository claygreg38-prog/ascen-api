-- Migration 084 — Breath Echo: Async Co-Breath Engine
-- Extends legacy_capsules (migration 016) from a cadence-only artifact into a
-- presence-bearing co-breath engine, and adds echo_sessions for recipient-side
-- co-regulation data. Routes through ABI + AXIS. No new ports. Additive only.
--
-- Idempotent: every ADD COLUMN / CREATE guarded with IF NOT EXISTS — CLAUDE.md
-- notes prior deploys failed on "already applied" migrations lacking guards.
--
-- NOTE ON TOOLING: this codebase is pg + pool.query() (no ORM). The v1 handoff
-- said "Prisma" / "legacy_vault_capsules" — both were crossed wires with another
-- stack (LSA Roster). Real table is legacy_capsules; migration is raw SQL, the
-- next number after 083 (NS3 snapshots).

-- ── 4.0 Per-session capture home (session_completions) ──
-- The 1 Hz trace is captured during EVERY normal session (the source of every
-- Echo) and persisted on the durable per-session row. createCapsule() reads
-- session_completions by id (often in a later request, after orchestrator memory
-- is gone), so the trace must live here to reach a capsule. Same additive ALTER
-- pattern as crown_id / photo_palette / artifact_value_usd.
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS breath_trace_json JSONB;
-- Full-resolution 1 Hz series: [{t_ms, phase, rate, coherence, ns3}]. NULL unless
-- a REAL biometric source was present (no synthetic breath is ever stored here).
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS trace_resolution VARCHAR(20)
  DEFAULT 'cadence_only' CHECK (trace_resolution IN ('cadence_only', 'full_trace'));
-- HARD RULE: synthetic / no-device / uncaptured sessions stay cadence_only.
ALTER TABLE session_completions ADD COLUMN IF NOT EXISTS sample_source VARCHAR(40);
-- Provenance carried through: polar_h10 | kyto2935 | synthetic | none | unknown.

-- ── 4.1 Extend legacy_capsules (existing fields preserved) ──

-- 1 Hz series captured during the session: [{t_ms, phase, rate, coherence, ns3}].
-- The real human signal with its imperfections — never an idealized ratio.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS breath_trace_json JSONB;

-- Resolution actually available for playback. HARD RULE: missing / unconsented /
-- uncaptured full_trace falls back to cadence_only — never synthesized.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS trace_resolution VARCHAR(20)
  DEFAULT 'cadence_only' CHECK (trace_resolution IN ('cadence_only', 'full_trace'));

-- Play the whole settling arc (shallow/jagged -> coherence) vs regulated window only.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS settling_arc BOOLEAN DEFAULT true;

-- Optional, opt-in, encrypted blob / IPFS (fast-follow v1.1).
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS audio_breath_url TEXT;

-- Optional, opt-in, DV-screened (fast-follow v1.1).
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS audio_voice_url TEXT;

-- Drive the partner orb / creature from recorded coherence. Coherence-ON default
-- (HRV-detail OFF) — matches the platform's coherence-ON / HRV-OFF philosophy.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS coherence_visible BOOLEAN DEFAULT true;

-- {timestamp, location_label, session_id} — the honest, dated-and-located framing
-- ("breathed this Tuesday morning, before his shift").
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS recorded_context_json JSONB;

-- live | echo | first_breath | lineage.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS echo_type VARCHAR(20)
  DEFAULT 'echo' CHECK (echo_type IN ('live', 'echo', 'first_breath', 'lineage'));

-- Granular, layer-by-layer SHARING consent from the recording person.
-- Capture rich, share conservative: cadence + coherence ON by default;
-- full_trace / breath_audio / voice_audio are deliberate opt-in only.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS consent_layers_json JSONB
  DEFAULT '{"cadence":true,"full_trace":false,"breath_audio":false,"voice_audio":false,"coherence":true}'::jsonb;

-- Links exchanged Echoes into a breath-letter correspondence.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS reciprocal_thread_id UUID;

-- {ancestor_name, relation, real_trace:bool, tribute_source}. real_trace=false ->
-- clearly-labeled tribute breath, never presented as the person's actual breath.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS lineage_meta_json JSONB;

-- Provenance of the stored breath. HARD RULE §8: carry sample_source through, no
-- silent synthetic. e.g. live_h10 | live_kyto | cadence_only | first_breath | tribute.
ALTER TABLE legacy_capsules ADD COLUMN IF NOT EXISTS sample_source VARCHAR(40);

-- ── 4.2 New table: echo_sessions (recipient-side playback / co-regulation data) ──
-- One row per playback of an Echo, so the lab gets real co-regulation data.
CREATE TABLE IF NOT EXISTS echo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capsule_id UUID REFERENCES legacy_capsules(id),
  recipient_participant_id INTEGER REFERENCES users(id),
  echo_type VARCHAR(20) CHECK (echo_type IN ('live', 'echo', 'first_breath', 'lineage')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Entrainment, NOT live synchrony: how the recipient's coherence/phase converges
  -- toward the recorded trace (0-100). Origin-point ("who shifts first") is N/A in
  -- Echo (one side is fixed) and is suppressed at the dashboard, not stored here.
  entrainment_score NUMERIC(5,2),

  -- Timestamps where the recipient's live breath met the recording within tolerance.
  synchrony_events_json JSONB,

  -- The recipient's OWN NS3 trajectory during playback (their activation can spike).
  recipient_ns3_series_json JSONB,

  -- Recipient is NS3-gated: if NS3 drops below threshold, the somatic-reset path
  -- fires and is logged here.
  somatic_reset_fired BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_echo_sessions_capsule ON echo_sessions(capsule_id);
CREATE INDEX IF NOT EXISTS idx_echo_sessions_recipient ON echo_sessions(recipient_participant_id);
