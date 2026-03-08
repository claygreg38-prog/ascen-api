# CLAUDE.md — Ascen BreathWorx

> **Owner:** Clay Gregory, COO — Mettle Works Behavioral Health
> **Repo:** `claygreg38-prog/ascen-breathworx` (also `ascen-api`)
> **Last Updated:** March 2026

---

## PRIMARY DIRECTIVE — NON-NEGOTIABLE

**All new work MUST flow through the ABI orchestrator (14 systems) and AXIS brain stem.**

- No features, routes, or data flows may bypass ABI/AXIS.
- Auth/security layers sit ON TOP of ABI/AXIS, never around them.
- If a feature doesn't fit through ABI/AXIS, the architecture must be EXTENDED — not bypassed.
- Every PR, every endpoint, every frontend action must trace back to an ABI lifecycle call.

Violating this directive breaks the entire system architecture. No exceptions.

---

## WHAT THIS IS

Ascen BreathWorx is a therapeutic breathwork platform for justice-involved individuals and their families. It is NOT a meditation app. It is NOT a wellness toy. It is a clinical-grade nervous system regulation tool built for people in the criminal justice system — incarcerated individuals, people on probation/parole, AOT (Assisted Outpatient Treatment) participants, and their families.

**The philosophy:** "The breath is the tool. The body is the master."

**The population:** People who have been through trauma, incarceration, systemic violence. Many are court-mandated. The language must be direct, warm, non-clinical, written at a 6th grade reading level. No toxic positivity. No spiritual bypassing.

**The parent organization:** Mettle Works Behavioral Health — Maryland-based, providing OMHC and EB-SEP/IPS services. Has a $6.7M Crisis Stabilization Center partnership with Prince George's County. Established relationships with county courts, corrections, probation/parole, and the sheriff's office.

---

## ARCHITECTURE — ABI + AXIS

### ABI (Adaptive Breath Intelligence) — The Orchestrator

ABI is a 14-system orchestrator that manages the entire session lifecycle. Every user interaction flows through it.

**The 14 ABI Systems:**

1. **Session Lifecycle Manager** — Start, tick, complete, exit
2. **Coaching Engine** — Luno/Luna dialogue delivery, effectiveness tracking
3. **LunoIntelligence** — Companion AI personality, context packets, emotional awareness
4. **Immune System** — Pattern detection (NOT diagnosis), anomaly flagging, safety rails
5. **Trend Analyzer** — Cross-session pattern tracking, trajectory analysis
6. **Homeostatic Regulator** — Baseline management, nervous system state tracking
7. **Biometric Processor** — HRV, coherence scoring, rPPG camera detection, Polar H10 BLE
8. **State Engine** — Zone tracking (green/yellow/red), TTR (time-to-regulation), coherence momentum, personalized pacer
9. **Pre-Session Intelligence** — Emotional load assessment, contextual gaps, baseline comparison, cumulative detection
10. **Post-Session Intelligence** — Session comparison, trend persistence, immune forwarding, state-aware affirmations
11. **Vault Pattern Analyzer** — Exposure therapy tracking, temporal orientation, drill recommendations, safety rails
12. **Victory Lap Engine** — Anchor sessions, family sharing, clinical stats
13. **BreathMatch** — Analyzes last 20 sessions to identify optimal breath ratios per user
14. **Cross-System Synergy** — Immune + trends + coaching triangle, biometric quality weighting

**ABI Lifecycle (every session):**
```
abi.startSession() → abi.arrivalSample() → abi.arrivalComplete() → abi.tick() [repeating] → abi.completeSession(metrics) → abi.verifyOnChain()
```

### AXIS (Adaptive eXperience Intelligence System) — The Brain Stem

AXIS runs nightly refinement cycles at 2am EST via `node-cron`. It:
- Feeds context packets to the coaching engine and LunoIntelligence
- Recalibrates progression thresholds based on population data
- Updates the Value Engine (Wellness Index, Family Impact Score, Healing Value Ledger)
- Generates cohort metrics for court reporting

**AXIS cron:** `0 2 * * *` America/New_York
**AXIS refinement:** `POST /api/axis/refine`

**AXIS Value Routes (7 endpoints):**
- Economic reporting for Social Impact Bond / Pay for Success models
- Court-ready reports (42 CFR Part 2 compliant)
- Cohort comparison metrics

---

## DEPLOYMENT INFRASTRUCTURE

### Railway Services

| Service | Project | URL | Purpose |
|---------|---------|-----|---------|
| hearty-optimism | loyal-alignment | `hearty-optimism-production-2eb6.up.railway.app` | Main API server |
| PostgreSQL | resourceful-wisdom | `caboose.proxy.rlwy.net:29763/railway` | Session database (185 sessions) |

**CRITICAL GAP (may still exist):** The `hearty-optimism` API service needs `DATABASE_URL` pointing to the `resourceful-wisdom` PostgreSQL database. They are in DIFFERENT Railway projects, so the internal `postgres.railway.internal` hostname does NOT work. Must use the external/public URL.

**Environment Variables (hearty-optimism):**
- `DATABASE_URL` — PostgreSQL connection string (external URL to resourceful-wisdom)
- `POLYGON_RPC_URL` — Polygon network RPC endpoint
- `VERIFICATION_SERVICE_PRIVATE_KEY` — Blockchain signing key
- `NODE_ENV` — Should be `production`
- `JWT_SECRET` — For auth tokens

### GitHub Repos

- `claygreg38-prog/ascen-breathworx` — Main application code, connected to Railway
- `claygreg38-prog/ascen-api` — API layer, connected to Railway (hearty-optimism)

### Server Startup Confirmation

When the server boots correctly, you should see:
```
[AXIS CRON] Scheduled: 0 2 * * * America/New_York
Server running on port 8000
ABI: 14/14 systems wired | AXIS: active | Auth: JWT + API key
Hardening: rate_limit + validation + audit + cfr_guard
```

---

## SESSION ENGINE

### Content Architecture

- **186 total therapeutic sessions** (161 foundation + 25 FR apprentice)
- **YAML-direct architecture** — Sessions stored as YAML, parsed and seeded into `session_templates` table with `yaml_data` JSONB column
- **Two-layer file system:** `ff` files (machine-readable parameters for the app engine) and `em` files (full narrative scripts, clinical source of truth). FR `em` files do NOT yet exist — content gap to close in parallel with engineering.
- **Zero interpretation errors** — YAML is the single source of truth for all therapeutic content
- **Composite primary key:** `session_templates` keyed on (`session_number`, `track`) — track column backfilled to `'foundation'` for main sessions
- **6th grade reading level** — All Luno/Luna dialogue

### Session Arcs (160 Main Sessions)

| Sessions | Arc | Theme |
|----------|-----|-------|
| S001–S030 | Foundation | Inherited Blueprint, nervous system awareness |
| S031–S060 | Sovereignty | Identity reclamation, emotional triggers |
| S061–S090 | Relational Somatics | Body awareness in relationships |
| S091–S120 | Somatic Mastery | Environmental body reading, leadership |
| S121–S150 | The First Spiral | Integration (6:6 coherence ratio LOCKED) |
| S151–S160 | Service | Full circle, teaching others |

### 25 FR (Family Receiver) Sessions

Stored in `session_templates` alongside main sessions (track = `fr_apprentice`). Luna-guided (not Luno). Warmer amber palette.

**CRITICAL — FR ABI CORRECTION (March 8, 2026):**

The original FR sessions 1-15 had `adaptive_ratio: false` with hardcoded `breathwork_ratio: '4:6'`. This violated Clinical Rule #1 because a grandmother with 40 years of smoking would fail at 4:6. **All 25 FR sessions are now corrected:**

- `adaptive_ratio: true` on ALL sessions
- `breathwork_ratio: null` — ABI determines from 30-second arrival baseline
- `reference_ratio` preserved (original design intent, NOT served to user)
- `ratio_range` with floor/ceiling per session group
- `duration_range` with min/max (was fixed duration)

**The corrected files are `fr_sessions_abi_corrected.zip` — supersedes the old `fr_sessions_abi_axis_ready.zip`.**

**Corrected ABI Progression Map:**

| Sessions | ABI Mode | Detection | Ratio Range | Duration Range | Coherence Target |
|----------|----------|-----------|-------------|----------------|-----------------|
| FR01-05 | guided_coherence | arrival_baseline | 2:3 → 4:7 | 120-240s | 0.40 |
| FR06-10 | guided_coherence | arrival_baseline | 2:3 → 4:8 | 150-300s | 0.50 |
| FR11-15 | coherence_building | arrival_baseline | 2:4 → 5:7 | 180-360s | 0.55 |
| FR16-20 | user_chosen | baseline+history | 3:4 → 6:8 | 240-420s | 0.60 |
| FR21-25 | user_chosen | baseline+history | 3:4 → 6:10 | 300-480s | 0.65 |

**Detection modes:**
- `arrival_baseline` (FR01-15) — ABI has limited history, relies on 30s arrival read
- `arrival_baseline_plus_history` (FR16-25) — ABI uses arrival + full session history

**User-chosen sessions (FR16-25):** ABI presents ratio selection overlay BUT `ratio_options_filtered_by_capacity: true` — users only see options they can safely handle.

**The principle:** The breath meets the person. The YAML provides guardrails. ABI decides.

### Session Phases (each session follows this structure)

```
arrival → opening → resistance → breathing_pattern → shift → close → mirror → vault
```

Plus `integration` and `transmission` tiers for depth progression.

### 6 Breathwork Modes × 3 Tracks

**Modes:**
1. **Momentum** — Balanced, energizing (4-4-6-2 pattern)
2. **Grief** — Slower, gentler (4-7-8-3 pattern)
3. **Freeze** — Micro-effort, voice-activated (3-2-5-1 pattern)
4. **Conflict Repair** — De-escalation focused (4-2-6-0 pattern)
5. **Challenge** — Higher intensity for progression
6. **Companionship** — For court-mandated users who won't engage. Luno waits.

**Tracks:** Foundation / Integration / Transmission (depth layers within each mode)

---

## COMPANION CHARACTERS

### Luno (Primary — Individual Path)
- Ocean-themed organism, NOT a cartoon rabbit
- Bioluminescent, ambient resting state
- Evolution: basic → evolved → mastery (based on session count)
- **LOCKED RULE:** Luno NEVER provides real-time verbal feedback based on biometric data
- Dialogue is pre-authored in YAML, not generated
- Companionship Mode: Luno waits silently for users who won't engage

### Luna (Family Receiver Path)
- Warmer amber palette (vs Luno's ocean blue)
- Guides FR sessions independently
- Separate content, parallel but distinct experience

---

## LIGHTBRIDGE — Family Connection System

LightBridge connects incarcerated parents with their children. When a parent completes a breathwork session, it triggers a light in their child's home device.

### Three-Gate Progression

| Gate | Requirement | What Unlocks |
|------|-------------|--------------|
| Gate 1 | Session 5 + 7 consecutive days | Basic LightBridge activation |
| Gate 2 | Session 20 + 14 of 18 days | Dynamic Duo — 10 Tier 1 FR sessions |
| Gate 3 | Session 30 + 21 of 30 days | 5 Tier 2 Family Systems sessions |

### Family Receiver (FR) Progression

Family members transform from co-breathing participants into independent practitioners:
**Guest → Apprentice → Practitioner**

The FR system is parallel but distinct — family members have their own curriculum, their own guide (Luna), and their own progression path.

---

## MODALITY MODEL (Replaces Track Model — Thread 3 Decision)

**The system does NOT have three separate tracks.** It has ONE continuous healing journey with concurrent modalities.

**Old model (DISCARDED):** `current_track_id` — user is on ONE track at a time. FR merge overwrites track.

**New model:** `active_modalities` (JSONB on `users`) — user has a solo spine that never stops, plus modalities they pick up and put down:

```json
{
  "solo": { "session": 47, "act": 2 },
  "fr_supporter": { "session": 8, "connected_to": "user_mom" },
  "fr_inviter": { "connected_to": "user_daughter", "lightbridge_active": true },
  "pod": null
}
```

**Why this matters:**
- A person at solo session 45 can become an FR supporter without starting over
- A pod member can invite family into FR simultaneously
- A completed FR modality enriches the solo journey — it doesn't replace a track
- ABI sees ALL active modalities and creates 1+1=3 value
- `trauma_pathway` is user-level, not track-level — ABI uses it everywhere across all modalities
- Pods, Calm Circles, the 6-level connection ladder all plug into `active_modalities` when built — no restructuring needed

**DB status:** `active_modalities` JSONB column needs to be added to `users` table (part of Migration 011). `modality_completion_profiles` table needs to be created.

---

## NON-LINEAR HEALING ARCHITECTURE — Locked Rules

### 3-Session Daily Limit
Maximum 3 NEW (never-completed) sessions per day. Unlimited revisits. When limit reached, user sees options: revisit, Calm Dome, Vault, LightBridge, Progress Map, or Rest.

### Spiral Depth Model (Same Session, Multiple Altitudes)
Every session exists at three depth levels based on `total_sessions_completed`:

| Level | Threshold | Luno Voice | Reflection Focus |
|-------|-----------|------------|------------------|
| Foundation | < 50 sessions | Directive | Individual awareness |
| Integration | 50-149 sessions | Collaborative | Relational: "How does your calm affect others?" |
| Transmission | 150+ sessions | Peer | Legacy: "What do you want to pass on?" |

### 80% Act Completion Gates
Must complete 80% of an Act's sessions before unlocking next Act. Within each Act, sessions can be completed in any order. System tracks avoidance patterns (clinical insight data) but never forces vulnerability.

### Smart Revisit Recognition
- 3+ revisits to same session in 7 days → Luno notices pattern (optional reflection)
- Completed Act III but revisiting Act I 5+ times → Luno affirms ("not regression — knowing what you need")
- Avoiding a specific session 3+ times → Luno gives permission ("it'll still be here when you're ready")
- These prompts never block progress, don't require response, reinforce agency

### Visual: Spiral Staircase (Not a Progress Bar)
Vertical spiral winding upward. Completed sessions = solid gold steps. Revisited sessions = glowing (reinforced, not gray). Current position = "You Are Here" marker. Next Act visible but locked until 80%.

---

## MASTERY UNITS — Dual-Track Scoring (Approved Design)

### Track 1: Personal Sovereignty (Individual — MVP)
- Session completion: +100 units (challenge: +150)
- Revisit bonuses: 50 → 25 → 15 → 10 (floor, never zero)
- Deep integration revisit (50+ session gap): +75
- Pacing bonus (24-72hr spacing): +25
- Vault entry: +25, Reflection: +15, Calm Dome: +10
- Pod registration (one-time): +100
- LightBridge moment sent (max 5/day): +50

### Track 2: Collective Stewardship (Family/Pod — MVP+)
- Shared breathwork: +150 personal, +200 collective pool
- Co-Regulation Sacrifice Bonus: +500 (pausing own advancement to stabilize pod member)
- Pattern interruption (witnessed by pod member): +500 personal, +1,000 collective
- Rupture-repair celebrated MORE than never disconnecting

### Anti-Gaming Protections
- 3 new sessions/day cap
- Pacing bonus only in 24-72hr window
- Fake pods detected (no interaction in 30 days → collective bonuses disappear)
- Teaching mode requires 10,000 personal units

### Act Milestones
500 → Calm Dome customization | 3,000 → Act II | 5,000 → LightBridge | 7,500 → Act III | 10,000 → Teaching Mode | 15,000 → Act IV | 25,000 → Act V (requires 5,000 collective too)

**Gating rule:** "You can't give what you don't have. Sovereignty before stewardship."

---

## TRAUMA PATHWAY VARIANTS — S16-20 (P1 — Not Yet Written)

Conditional Luno dialogue based on declared `trauma_pathway` (neglect vs violence). The variant table is approved but YAMLs not yet authored:

| Session | Subject | Neglect Variant | Violence Variant |
|---------|---------|----------------|-----------------|
| S16 | Your Origin Story | Over-functioning to earn love | Hypervigilance as caring |
| S17 | Secondary Trauma | Carrying others' weight as familiar | NS reactivation from threat history |
| S18 | Your Grief | Grief as luxury not allowed | Grief as dangerous softening |
| S19 | Your Anger | Anger as "too much" — suppressed | Anger as dangerous — suppressed |
| S20 | Refilling the Well | Self-care as burden to others | Rest as unsafe |

**`trauma_pathway` already exists on users table** with timestamps. It's user-level, not track-level — informs dialogue across ALL modalities.

---

## SESSION 26 — "Crossing the Bridge" (P1 — Not Yet Built)

When FR modality completes (FR25), ABI builds the ramp dynamically — NOT a static Session 26 variant:

1. **Dialogue adaptation** — ABI reads `trauma_pathway` + FR completion data → injects bridge line: Luna says "You came here for someone else. Now the work turns inward."
2. **Coherence recalibration** — FR user exited at 0.65 target. ABI adjusts S26-35 based on actual last-5-session performance.
3. **AXIS transition flags** — Nightly cron knows user merged from FR. Coherence dips in S26-28 flagged as "transition adjustment" not "regression."

This becomes a `modality_completion_profile` — built by ABI when ANY modality completes, stored on user, consulted for sessions in the ramp window.

---

## BLOCKCHAIN VERIFICATION LAYER

### Mettle Verification Ledger

- **Old Contract Address:** `0xd9145CCE52D386f254917e481eB44e9943F39138` — **This was Remix IDE only. Never deployed to real Polygon. Does not exist on any blockchain.**
- **New Contracts:** SessionCompletionToken (soulbound ERC-721/ERC-5192) + BiometricOracle (dual-signature attestation). Written, tested (24 passing tests), NOT yet deployed.
- **Decision locked:** Deploy to Polygon Amoy testnet first, then mainnet when validated.
- **Repo/Service:** `mettle-verifcation-ledger` (note: typo in original name, keep as-is)

### Current Status: SIMULATED

The `/api/verify` endpoint currently returns a **fake txHash**. Real Polygon writes are NOT yet wired.

### Pending Task (2-3 hours when ready)

Wire real Polygon contract writes:
1. Add `ethers.js` dependency
2. Call `enrollParticipant()` on contract
3. Call `verifySession()` on contract
4. Return real txHash from Polygonscan

**Do NOT do this until:** scaling beyond pilot OR courts require independent Polygonscan verification.

### What the Blockchain Proves

Session completion is independently verifiable on-chain. Courts, probation officers, and funders can verify participation without accessing clinical data (42 CFR Part 2 compliant).

---

## BIOMETRIC INTEGRATION

### Primary: Polar H10 Heart Rate Monitor
- Web Bluetooth BLE connection
- Real RR interval extraction (not just BPM)
- FFT-based coherence scoring — LF/HF power ratio, peak frequency detection, 0-100 score
- RMSSD, SDNN calculations
- 120-second rolling RR buffer
- Minimum 30 seconds before FFT fires

### Secondary: rPPG Camera-Based Detection
- Camera-based breath detection using phone camera
- No hardware required
- Lower accuracy than Polar H10 but zero barrier to entry

### Coherence Zones
- Low / Medium / High
- Fed into ABI State Engine for zone tracking
- Used by coaching engine to adapt Luno's guidance

---

## CLINICAL RULES — NON-NEGOTIABLE

1. **The system NEVER asks users about their breathing capacity.** Silent biometric detection only.
2. **Vault data is 42 CFR Part 2 protected.** Never surfaced to corrections, courts, or non-clinical staff.
3. **The 6:6 coherence ratio in The First Spiral (S121-S150) is LOCKED.** Do not modify.
4. **The immune system detects, it does not diagnose.** No clinical labels on users.
5. **The breath is the tool. The body is the master.** This philosophy drives every design decision.
6. **Companionship Mode** — For court-mandated users who won't engage. Luno waits. No pressure. No guilt.
7. **FR experience is parallel but distinct** — Warmer amber palette, Luna guide, separate content.
8. **No toxic positivity.** Language is direct, warm, honest. Written at 6th grade reading level.
9. **No spiritual bypassing.** This is somatic work, not meditation branding.
10. **FR sessions MUST use adaptive ratios.** Never hardcode `breathwork_ratio` in FR YAMLs. ABI reads the arrival baseline and determines the ratio from the session's `ratio_range`. The YAML provides guardrails, ABI decides.

---

## AUTH & SECURITY

### JWT Role System

| Role | Access |
|------|--------|
| Participant | Session lifecycle (start, tick, complete, exit) |
| Clinician | Clinical dashboards (read from ABI immune system, trend analyzer, homeostatic regulator) |
| Admin | Immune overrides, AXIS refinement, system configuration |

### Security Layers (sit ON TOP of ABI/AXIS)

- `rate_limit` — Request throttling
- `validation` — Input sanitization
- `audit` — Action logging
- `cfr_guard` — 42 CFR Part 2 compliance on clinical routes

### API Authentication

- JWT tokens with embedded therapeutic parameters
- API key headers for service-to-service calls
- Session keys for ABI lifecycle binding

---

## FRONTEND — BREATH SCREEN

### Visual Elements

- **Ocean-themed** immersive environment
- **Luno organism** — bioluminescent, breathes with user
- **Plankton particles** — ambient bioluminescent particles
- **Alignment rings** — Serve as both breath pacer AND biofeedback tool
- **Human figure emergence** — Over 365 sessions, a human figure gradually emerges (compressed from original 10,000-session arc)

### ABI Integration in Frontend

Every user action maps to an ABI orchestrator call:
```javascript
abi.startSession()        // Session begins
abi.arrivalSample()       // 60-second baseline read
abi.arrivalComplete()     // Transition to breathing
abi.tick()                // Each breath cycle
abi.completeSession()     // Session end + metrics
abi.verifyOnChain()       // Blockchain verification (fire and forget)
abi.selectDrill()         // Grounding exercises (e.g., five_senses)
abi.exit()                // Early exit (no shame)
abi.resume()              // Return from coaching check-in
```

---

## DATABASE SCHEMA

### Key Tables

- `session_templates` — 185 sessions, `yaml_data` JSONB column
- `curriculum_tracks` — Multiple therapeutic progression pathways
- `users` — Participant profiles with role assignments
- `session_logs` — Completed session records with metrics
- `connections` — LightBridge family connections
- `victory_lap_anchors` — Milestone anchor sessions
- `anchor_returns` — Return visits to anchor sessions

### Recent Migration (Thread 3 build)

19 new columns + 4 new tables + modality backfill. Includes vault pattern analysis, victory lap tracking, and AXIS value metrics.

---

## CLINICAL TOOLS (Separate from main app)

These tools exist alongside the main platform:

- **RS-7o PDF Generator** — Clinical documentation
- **Compliance Dashboard** — Regulatory tracking
- **DAP Progress Note Builder** — Clinical session notes
- **ITP Workflow Builder** — Individual Treatment Plans
- **Monthly IPS Summary** — Employment support reporting
- **PRP Visit Tracker** — Psychiatric Rehabilitation visits

---

## PENDING WORK QUEUE

### IMPORTANT: BUILD TASKS vs. APPROVED DESIGNS

**Build tasks** = code to write this sprint. Do them.
**Approved designs** = vetted and locked architecture references. They inform decisions but are NOT build tasks yet. Do NOT start building them unless explicitly instructed. They wait their turn.

---

### BUILT BUT NOT YET DEPLOYED — 14-File Enhancement Build

`ascen-complete-build-v2.zip` contains 4,862 lines across 14 files covering Phases A-F of the Enhancement Spec. All Manus audit bugs fixed. **This is the next deployment priority.**

| File | Location | Phase | Lines |
|------|----------|-------|-------|
| lunoIntelligence.js | src/abi/ | A | 423 |
| axisEngine.js | src/axis/ | B | 669 |
| stateEngineEnhancements.js | src/abi/ | A | 333 |
| preSessionIntelligence.js | src/abi/ | A | 398 |
| coachingEnhancements.js | src/abi/ | A | 238 |
| postSessionIntelligence.js | src/abi/ | A | 206 |
| crossSystemSynergy.js | src/abi/ | A | 196 |
| vaultPatternAnalyzer.js | src/abi/ | D | 444 |
| victoryLapEngine.js | src/abi/ | E | 372 |
| valueEngine.js | src/axis/ | F | 429 |
| axisValueRoutes.js | src/routes/ | F | 187 |
| blockchainRetry.js | src/utils/ | E | 104 |
| migration_complete.js | root | C-F | 277 |
| orchestrator_patch_complete.js | reference | All | 586 |

**Deployment sequence:** migration → new modules → replacements → orchestrator patch → route mounting → env vars → verification. Full sequence in DEPLOYMENT GUIDE.md inside the zip.

### MANUS CLINICAL REVIEW RECOMMENDATIONS (March 7, 2026)

High-impact, low-architecture-change improvements:

**1. Time-to-Regulation Metric (The Missing Vital Sign)**
- `StateEngine` classifies states every second but `sessionOrchestrator` never saves `time_to_regulation` to `session_completions`
- Fix: Add `time_to_regulation_sec` column, update `onSessionComplete()` to pull from StateEngine

**2. Luno Intelligence Upgrade (The Context Gap)**
- Structured system prompt with voice_tier (Directive → Peer → Sovereignty), arc_name, coaching_bias
- 3 context-aware calls per session: Arrival, Mirror, Closing
- Claude Haiku 4.5 with Prompt Caching (~$54.60/month for 1,000 users)
- Env vars: `LUNO_MODEL`, `LUNO_MAX_TOKENS`, `LUNO_TIMEOUT_MS`, `LUNO_API_VERSION`, `LUNO_CALLS_PER_SESSION` (0 = zero-cost fallback)

**3. Victory Lap as Somatic Anchor**
- `victory_lap` session type — bypasses progression, pure affirmation
- `anchor_return` — replays best biometric session parameters

**4. LLM Cost Model:** ~$0.0037/session optimized. 1K users = ~$54.60/month. 10K users = ~$6,552/year.

### Known Issue: FR 502

`/api/abi/fr/sessions` returns 502 intermittently. Deploy logs show clean startup. May be Railway cold-start or circular dependency. Enhancement build deployment may resolve.

---

## ACTIVE BUILD TASKS — THIS SPRINT

These are the tasks to execute now. In priority order.

### Must-Build-Now (Prevent Future Surgery — ~5-6 hrs)

These prevent hundreds of hours of rework if done after real users start generating data.

1. **Migration 011 — Combined Ledger Sync Schema** (~2-3 hrs)
   - `wallet_address` on users — every user without this needs individual retrofit later
   - `family_unit_id`, `family_role`, `fis_consent` as nullable on users — 15 minutes now saves weeks later
   - `packet_hash`, `facilitator_attested`, `attestation_submitted`, `sct_token_id` on session_instances
   - `family_units` table (empty — foreign key references need it to exist)
   - `attestation_queue` table (status workflow: awaiting_facilitator → ready → submitting → confirmed → failed)
   - `contract_registry` table (addresses in DB, never hardcoded)
   - Enrichment columns from Enhancement Spec Assignment 3: `time_to_regulation_sec`, `arrival_hr`, `arrival_hrv`, `coherence_trajectory`, `zone_time_profile` — orchestrator already computes these and throws them away. Once real sessions run without these columns, that data is **gone forever**.
   - **Merge with migration_complete.js from Enhancement Spec** — ONE migration, not two parallel tracks.

2. **SessionDataPacket builder inside onSessionComplete()** (~2-3 hrs)
   - Canonical hash format for on-chain attestation
   - `buildSessionDataPacket()` function called by existing `onSessionComplete()` — NOT a parallel flow
   - Assembles packet from data already computed by 14 ABI systems, hashes it (SHA-256), stores `packet_hash`
   - Even if blockchain writes aren't live yet, every session from day one is retroactively attestable
   - **If you change the schema later, old hashes become incompatible — lock it now**

3. **Strip URL params from ABI GET endpoints** (~30 min)
   - `/session/state`, `/session/adapted`, `/session/events` — read ONLY from `x-session-key` header
   - Remove backward-compatible URL param support before anyone depends on it

4. **Jurisdiction tag on deployment config** (~30 min)
   - Add to Railway env vars: `ASCEN_JURISDICTION=MD-PG`, `ASCEN_JURISDICTION_NAME`, `ASCEN_JURISDICTION_LEVEL`, `ASCEN_DATA_RESIDENCY`
   - Document the pattern: when a new jurisdiction comes online, it gets its own instance with its own tag
   - Not code — just a decision. Prevents emergency data separation when you go multi-county.

### Breath Fix Chain (Completes the FR ABI Correction)

The corrected YAMLs say `breathwork_ratio: null` with `ratio_range`. But nothing currently reads those fields and selects a ratio. Without these, corrected YAMLs break sessions.

5. **Deploy `determineBreathParams.js`** to `src/abi/`
   - Reads 30-second arrival baseline from BaselineFilter
   - Maps natural breathing rate to closest safe ratio in `ratio_range`
   - Maps capacity to duration within `duration_range`
   - Returns selected ratio + duration with confidence score
   - Works for both FR and Foundation sessions

6. **Deploy updated `breathProtocolAdapter.js`**
   - Adapter stays as MODULE SELECTOR (mode, arc settings, duration range)
   - RATIO selection moves to `determineBreathParams()`
   - Reconciles so adapter and corrected YAMLs don't conflict
   - Main 160 sessions: adapter has 3 tracks (standard/gentle/minimal) but floor was 3:4 — now extended down to 2:3

7. **Apply orchestrator breath params patch**
   - Wires `determineBreathParams()` into `onArrivalComplete()`
   - Passes breath selection to Luno context (~30 extra tokens, same cost tier)

8. **Re-seed FR sessions** — Use `fr_sessions_abi_corrected.zip` ONLY. `ON CONFLICT DO UPDATE` — safe to re-run.

### Blockchain Work (Deploy as One Package — All Safety Structures Together)

The old contract address (`0xd9145CCE52D386f254917e481eB44e9943F39138`) was Remix IDE only — never deployed to real Polygon. Starting clean with the new SCT + BiometricOracle contracts (24 passing tests).

**Decision locked:** Testnet first (Polygon Amoy), then mainnet when validated.

9. **Deploy SCT + BiometricOracle to Polygon Amoy testnet**
   - Contracts: SessionCompletionToken (soulbound ERC-721/ERC-5192) + BiometricOracle (dual-signature attestation)
   - Free test MATIC from faucet. Zero risk.
   - Deploy script exists: `scripts/deploy.js` in ascen-contracts
   - Manual attestation test against real testnet before connecting to API

10. **Wire mettle-verification-ledger to real contracts** (ships WITH all safety structures below — not separately)
    - Gas price circuit breaker — check gas before every write, queue if too high with `gas_deferred` status
    - Contract registry pattern — addresses in env vars / DB, never hardcoded in code
    - `shutdown()` capability — governance pause that irreversibly stops new minting while preserving records
    - Retry logic with front-running detection — if duplicate hash rejected but DB shows unconfirmed, investigate
    - Expungement protocol — court order → delete user record → delete wallet mapping → SCT becomes permanently unattributable
    - Key management protocol — where keys are stored, rotation procedure, compromise response chain

11. **When testnet validates clean → redeploy to Polygon mainnet** (same script, different network flag, real MATIC)

### P1 — Important (This Sprint If Time Allows)

12. **Deploy 14-file enhancement build** — Follow DEPLOYMENT GUIDE.md sequence
13. **Full JWT auth** — `auth.js` may still be a stub
14. **Author 25 FR `em` files** — Full narrative scripts (content task, not engineering)
15. **BreathMatch integration** — Connect personalization engine to session selection
16. **AXIS nightly cron verification** — Confirm `node-cron` is running in production
17. **S16-20 Trauma Pathway YAML Variants** — Write neglect/violence/other conditional dialogue, re-seed 5 sessions
18. **Session 26 "Crossing the Bridge"** — ABI dynamic ramp: bridge dialogue, coherence recalibration, AXIS transition flags, modality_completion_profile

### P2 — Enhancement (Next Sprint)

17. **WebSocket relay bridge** — Polar H10 data on iOS (iOS blocks Web Bluetooth)
18. **Supply chain resilience doc** — Alternatives for Polar H10, Railway, Polygon
19. **Deliver 4 Iyanla one-pager versions** to Crystal Williams
20. **Document "Caveman nervous system / Star Wars technology" pitch framing**

---

## APPROVED DESIGNS — PHASE 2+ ROADMAP

**These are vetted and locked architecture references. They inform current decisions but are NOT active build tasks. Do NOT start building them unless Clay explicitly assigns them to the current sprint.**

A 56-item extraction was vetted on March 7, 2026. 24 items were removed (redundant, architecture mismatch, or premature). 32 were kept. Of the 32: 8 are MVP-scope (listed above as active tasks), 10 are Phase 2, 14 are Phase 3+.

### Proof of Healing Protocol (Phase 2)

- **Session Completion Token (SCT)** — Soulbound ERC-721 (ERC-5192), non-transferable, non-burnable. Contracts written and tested.
- **BiometricOracle** — Dual-signature attestation (participant + facilitator ECDSA). Anti-gaming: no self-facilitation, 30-min minimum interval, 24-hr submission window, no duplicate hashes. Clinical reviewer role.
- **Two-Token Economy** — ASCN (utility, dollar-pegged, local circulation) + HEAL (impact, minted at 30-session verified outcomes, tradeable)
- **FACCs (Future Avoided Cost Credits)** — Securitized against $45K-$70K annual avoided cost per stabilized participant. Smart contract: verification → credit activation → redemption. 2-5% origination fee.
- **SessionDataPacket Schema** — Canonical data format hashed for on-chain attestation. Biometrics (pre/post RMSSD, HR, coherence), session metadata, completion flags. RR intervals on-device only, hash on-chain.
- **Embedded Wallet** — Silent ethers.js keypair at onboarding. User never sees it. Private key in secure enclave. Wallet address = participantId. No seed phrases, no blockchain UI. **NOTE: Current implementation spec assumes React Native mobile app. Must be redesigned for actual architecture (Express + single-file HTML).**
- **Impact Certificates** — Transferable tokens at verified milestones. Full attestation chain. 1.5-3% transaction fee.
- **Healing Score** — Composite biometric measure: session completions, biometric trajectory, family engagement, peer support, streaks. Privacy-preserving (tier disclosure only). Portable across jurisdictions.
- **Four-Tier Loyalty** — Foundation (S1-10) → Regulation (S11-20) → Integration (S21-30) → Mastery (S31+). Non-revocable. Escalating ASCN rates.
- **Anti-Extraction Covenant** — Smart contract: ASCN redeemable only by registered local Healing Economy Partners. Community governance sets parameters.
- **Micro Social Bond Market** — Community stakes $25-$100 into cohort bonds. HEAL tokens trigger settlement. 1-2% fee.

### Family Impact Score — FIS™ (Phase 3)

- **FIS Algorithm** — Five-input composite: trajectory convergence, biometric synchrony, engagement reciprocity, cross-generational depth (1x/1.5x/2x multiplier), family economic activation. **Trade secret — runs on-device, only ZK tier proofs leave device.**
- **Family Tiers** — Reconnecting → Rebuilding → Thriving → Generative. Non-revocable.
- **Family FACC** — $83K-$152K annual avoided cost for 4-member household. Activates at Thriving for 90 consecutive days.
- **Family Account Linking** — `familyId`, `familyRole`, `fisConsentGranted` on users. Multi-sig family wallet. Consent revocable. **Nullable fields scaffolded in Migration 011 (active task) to prevent painful migration later.**
- **Joint Session Architecture** — Multi-device BLE, synchrony coefficient from cross-correlated RR streams. FamilySCT. **Requires single-device Polar H10 to ship first.**

### Governance & Legal Framework (Phase 2-3)

- **Polycentric Governance** — 4 bodies: Stewardship Council (3, operational), Community Advisory Board (7-11, elected, parameter/veto), Protocol Guardian Council (5, technical, smart contract security), Constitutional Assembly (all participants, Charter ratification). Mutual checks, staggered terms.
- **Founder Constraints** — Compensation cap 25x median participant income. Multi-sig required for unilateral action. Governance vesting: full authority years 1-3, reduced 4-6, advisory-only after year 7.
- **Dead Hand Provisions** — Immutable smart contract: AGPL can't be relicensed, User Data Bill of Rights can't be revoked, ZK architecture can't be centralized, Anti-Extraction Covenant can't be removed, Charter can't be abolished.
- **Insider Threat Governance Protocol** — 2-of-3 emergency removal across other councils + 30-day community veto window.
- **Six-Layer Legal Framework** — Founder IP (copyright + trade secret + trademark), AGPL-3.0 copyleft (dual license), user data sovereignty, business protections (HEPA + Anti-Extraction), SPV public-private partnership, enabling legislation.
- **Community Consent for Ownership Transfer** — Controlling ownership change triggers 60-day CAB review. Consent denied → county MOUs terminate.
- **Crypto Distancing** — Approved vocabulary: NEVER say crypto/blockchain/NFT/Web3 to users. Dollar denomination. Invisible infrastructure. Government technology framing.

### Pod & Calm Circle Architecture (Phase 3)

- **Pod Modality** — Symmetric co-regulation (2-5 peers breathing as equals). Concurrent with solo + FR, never replacing them. Both self-selected (invite link) AND facility-assigned (clinician creates). People can join late at any point in solo journey.
- **6-Level Connection Ladder** — Parallel Presence (S1, awareness only) → Anonymous Witnessing (S10) → Buddy Pairing (S20) → Pod Group Sessions (S31) → Mentor Pairing (S75, 10K units) → Legacy Contribution (S150, 25K personal + 5K collective). Maps to `connection_level` integer already on users table.
- **Calm Circles** — Practice spaces for regulated connection. NOT therapy, NOT group counseling. 4 non-negotiable principles: Presence Over Words, Your Regulation Is the Gift, No Fixing, Breath Is the Response. 4 progression-gated roles: Observer (S31+) → Supporter (S51+) → Holder (S71+) → Guide (100+ days). Full guide training for handling activation, dysregulation, conflict. Circle scoring feeds Collective Stewardship track.
- **ABI Multi-Participant Coherence** — ABI recognizes co-regulation effects across connected nervous systems. "B's session buffered A's stress response" → flags, adjusts, awards collective pool bonus. Predictive support: "User C struggles Mondays — D's Tuesday sessions stabilize the group."

### Healing Economy Infrastructure (Phase 3+)

- **Certified Healing Economy Partner** — Certification mark for businesses. Procurement preference in county/municipal bids.
- **Healing Economy Family Corporations (HEFCs)** — Maryland LLC for Integration/Mastery-tier participants.
- **Creator Marketplace** — Six contributor categories, three quality tiers, 70-85% revenue share. Cultural lineage content tracks.
- **Universal Access Tiers** — Justice-Involved (subsidized) → Community → Employer-Sponsored → Family Subscription ($29-$99/mo).

### Long-Term Vision (Phase 4-5)

- **Geolocation Jurisdiction Mapping** — Technology infrastructure mirrors state lines. Railway instances, PostgreSQL databases, smart contracts jurisdictionally bound. Digital grid mapped to human geographic boundaries. **(Pattern documented now in active task #4; full implementation later.)**
- **Locally-Owned AI Per State** — "Farm to plate" model. Each state's healing intelligence locally trained, locally owned. Requires 5,000+ labeled real sessions.
- **Inter-County Equity Modeling** — State FACC reserve pool (15-20%), geographic Healing Score normalization, inter-county micro-bond reciprocity.
- **Frequent Flyer Scoring Engine** — Business scoring for Healing Economy Partners. Needs Monte Carlo simulation. Pilot PG County 6 months before statewide.
- **Social ANS (Autonomic Nervous System)** — AI community immune system. Detects disinformation, regulatory capture, corporate predation. Interactive prototype built (.jsx).
- **State Federation Architecture** — Multi-state deployment with data sovereignty per jurisdiction.
- **Post-Quantum Migration** — Crypto-agile design, hash-based anchoring (SPHINCS+), hybrid signatures during transition.

### Revenue Model (Reference — Not Build Tasks)

- Eight channels: county contracts, content licensing ($500-$1,200/participant/yr), protocol licensing ($50K-$250K/yr), FACC fees (2-5%), micro-bond fees (1-2%), Impact Certificate marketplace (1.5-3%), training/certification, grants
- Five-year projection: $3.6-$7.1M Year 1 → $35.8-$66.9M Year 5
- Proof-to-Sale pipeline: PG County → County Deployment Kit → MD/VA/DC corridor → state-level → national

### Transcript-Only Items (Not in Any Formal Doc)

- **"Caveman nervous system / Star Wars technology"** — Pitch tagline concept for investor/partner materials
- **4 Iyanla Vanzant one-pager versions** — Visionary, Community, Family, Business frames for Crystal Williams. Original tagline locked: "Modern technology. Rooted in neuroscience. Real transformation."
- **Annual red team exercises** — Budget for quantum/synthetic biometrics experts to break the system
- **Pre-positioned legal counsel** — MD/VA/PA emergency injunction readiness
- **Proactive narrative inoculation** — Community education before launch on disinformation patterns

---

## COLLABORATION CONTEXT

### How Clay Works

- Clay calls Claude "Claudia"
- "Wdr" = "What do you recommend?"
- Clay often works from his phone — not always at a laptop
- Has a young child who may be present during work sessions
- Demo timeline is open — building when ready, not to a date
- Prefers direct communication, no fluff

### IP & Partnerships

- **IP ownership is non-negotiable** — Ascen has existing patents
- **SplashMD partnership** — Corey from SplashMD, discussing Ascen MVP build. IP stays with Clay.
- **Iyanla Vanzant** — Visited Mettle Works, expressed interest in supporting incarcerated families. Potential advisor/content contributor.

### Related Projects (separate repos)

- **TransCheck Pro (Uncle Earl's)** — Consumer vehicle diagnostic app. Backend v5 live at `enc-earls-api-production.up.railway.app`. React Native app needs connecting to live backend. BlueDriver MAX hardware integration. Warm salmon rose / dusty plum color palette. "Earl's voice" plain-English explanations.

---

## CODE STANDARDS

- **Node.js** backend (Express)
- **PostgreSQL** database (Railway-hosted)
- **YAML** for all therapeutic content (single source of truth)
- **Vanilla JS** frontend (no React in main app — single HTML file architecture)
- **42 CFR Part 2** compliance on all clinical data routes
- **Comment format:** `[ABI]`, `[AXIS]`, `[LIGHTBRIDGE]`, `[BLOCKCHAIN]` prefixes for system attribution
- **Error handling:** Always graceful — the user is in a therapeutic session. No crashes, no ugly errors.
- **Logging:** Console logs with system prefix for debugging: `[ABI] Starting session`, `[AXIS CRON] Running refinement`

---

## WHAT NOT TO DO

- **Never bypass ABI/AXIS** — Extend the architecture, don't route around it
- **Never surface vault data** to non-clinical roles
- **Never modify the 6:6 ratio** in The First Spiral
- **Never add real-time verbal biometric feedback** to Luno
- **Never use clinical/diagnostic language** in user-facing text
- **Never shame a user** for exiting early, skipping sessions, or not engaging
- **Never treat the blockchain as required** for session completion — it's verification, not a gate
- **Never hardcode breathwork_ratio in FR sessions** — `fr_sessions_abi_corrected.zip` fixed this. ABI determines ratios from arrival baseline. The old `fr_sessions_abi_axis_ready.zip` is DEAD — do not use it.
- **Never use the old FR zip** (`fr_sessions_abi_axis_ready.zip`) — it has `adaptive_ratio: false` which is clinically unsafe
- **Never guess email addresses** or personal info
- **Never create routes that skip the ABI orchestrator**
