# FR Track — Ship-State Status

Audit date: 2026-05-08
Audit scope: Family Receiver (`fr_apprentice`) track end-to-end, from inmate-side invitation through FR25 merge ceremony.

This doc captures what shipped, what didn't, and where the implementation diverges from the spec. It is a snapshot — verify against current code before relying on any specific line number.

---

## What's Built

### FR session content (25 sessions)
- `session_templates` rows for `track = 'fr_apprentice'` are seeded (Migration 080 per project memory; 194 total sessions across 4 tracks).
- All 25 FR session YAMLs are in repo: per the rewrites in `migrations/075_fix_fr_contamination_and_seed.sql`, blocks `FR01`–`FR25` cover lines 7 → 7746.
- Five therapeutic arcs declared in `src/routes/frRoutes.js:25`: `fr_connection`, `fr_neuroception`, `fr_holding_space`, `fr_own_foundation`, `fr_bridge_to_mastery`.
- Adaptive ratio config seeded via `fr-seed.js` (5 blocks of 5 sessions each, ratio_range expanding S1→S25, coherence_target ramping 0.40→0.65).

### FR API surface (read-only)
- `src/routes/frRoutes.js` mounted at `/api/abi/fr` (server.js:232). Five endpoints:
  - `GET /health` — service ping
  - `GET /sessions` — list 25 FR sessions (filterable by `arc`, `mode`)
  - `GET /sessions/:number` — full YAML data + ABI/AXIS config + vault prompts + mirror screen + curriculum_merge passthrough
  - `GET /arcs` — arc summary (first/last session, count, coherence range)
  - `GET /progress` — user's FR journey (completed sessions, current arc, station unlocks at FR05/FR10/FR15/FR25, merge_ready at FR25)
  - `GET /engine/:number` — minimal config for ABI session start

### Migration 075 — FR contamination cleanup
- Per spec, FR sessions previously had foundation-track dialogue stamped on them. `fr_sessions_rewritten_corrected.zip` was prepared but unapplied for some time.
- `migrations/075_fix_fr_contamination_and_seed.sql` is committed:
  - Step 1 (line 3): `UPDATE session_templates SET dialogue_phases = NULL WHERE track = 'fr_apprentice'` — clears contamination
  - Step 2 (lines 7–8116): re-seeds all 25 FR sessions with corrected FR-voice dialogue
- FR01 spot-check confirms FR-voice (not foundation): opens `"One." / "Welcome." / "This is for you. Not for the person you love. Not for their process."` (`075_fix_fr_contamination_and_seed.sql:1-50`).
- `migrations/run_075.js` exists as the executor.
- **Live-DB application status: not verified from local audit.** Per locked rule #6, migration is "deployed" only after (1) committed ✓, (2) executed ✓ unverified, (3) verification queries run. Verification script ready at `scripts/auditFRTrack.js` — execute against `DATABASE_URL` to confirm.

### Ripple Signal — "They showed up today"
- `migrations/076_ripple_signal.sql` defines `ripple_signals` table.
- `src/services/rippleService.js` (134 lines): `addRecipient`, `confirmRecipient`, `pauseSignal`, `resumeSignal`, `removeSignal`, `getStatus`, `fireRippleIfApplicable`.
- Routes mounted at `/api/ripple` (server.js:821-823).
- Wired into `sessionOrchestrator.js:1808-1811` — fires non-blocking on session completion.
- Message text locked: `"They showed up today."` (rippleService.js:20). Never includes session data, biometrics, or mood.
- One recipient per user. SMS via `smsService.sendSMS`. Recipient confirms via SMS reply.

### Persistence + biometrics (track-agnostic, applies to FR)
- All session-completion infrastructure works for FR sessions: `session_completions` row, NS3 scoring (`ns3Engine.js`), coherence pipeline (commit bb820bf), blockchain attestation (verificationService.js), ABI tick queue (commit 4215a3c), session-state DB persistence (sessionStateManager.js).
- Adaptive breath ratio path resolves through `determineBreathParams.js` for FR rows that have `adaptive_ratio: true` in `yaml_data.abi_config`.
- BLE / H10 / Kyto support, baseline race fixes, biofeedback visual + sound systems all apply to FR sessions identically.

---

## What's Not Built

### Inmate-side invite primitives (Section 1)
- **`lightbridge.generateInvite` mutation: not built.** The repo is REST/Express, not GraphQL. `lightbridge` in this codebase exclusively refers to IoT lights (Migrations 020, 028; `src/abi/lightBridgeEngine.js`) — LIFX/Hue/Wyze device control, unrelated to invitations.
- **Family Recording attachment to invite: not built.** No `family_recordings` table, no recording upload/storage code.
- **16-character invite code generation: not built.** Closest analog is the generic family-unit invite at `src/abi/familyUnitEngine.js:291` — `crypto.randomBytes(3).toString('hex').toUpperCase()`, which produces 6 hex chars (not 16). Stored in `family_invitations.invitation_code VARCHAR(20)`.
- **Practitioner-side "Invite Family" button: not built.** `frontend/src/screens/FamilyScreen.jsx` has the generic family-unit invite UI (gate-based 1/2/3); no FR-specific invite button.

### FR receiver onboarding (Section 2)
- No FR-specific frontend screens. None of these exist in `frontend/src/screens/`:
  - Invite landing page
  - Family Recording experience screen (audio + heartbeat playback)
  - FR Role Confirmation screen
  - FR What to Expect screen
  - FR-tuned account creation flow
  - Age gate / adult consent / biometric consent / safe harbor disclaimer
- `RegisterScreen.jsx` exists but is generic (enrollment-code + name + PIN); not FR-tuned, no FR-track auto-assignment.
- Frontend never calls `/api/abi/fr/*` — zero matches for `fr_apprentice` or `/api/abi/fr` in `frontend/src/`.
- No direct-to-FR01 routing.

### FR-specific UX (Section 4)
- **Surface-mode visual treatment for FR users (sunny start, earned descent): not built.** Depth metaphor in `SurfaceOcean.jsx` / `HomeScreen.jsx` is universal. No `fr_apprentice` references in `frontend/src/`.
- **Luna voice routing for FR sessions: not built as track-keyed.** Luna selection is **tenant-keyed** via `tenant.luno_variant === 'spiritual_companion'` (HomeScreen.jsx:107, KitchenTableScreen.jsx:57, contextRoute.js:149). `sessionOrchestrator.js` has zero `fr_apprentice` references — there is no `track === 'fr_apprentice' → luna` switch.
- **Family Recording prompts at FR12, FR18, FR20, FR24, FR25: scaffolded but broken.** `frRoutes.js:46,98,276` selects `family_recording_prompt` and `station_unlock` columns, but **no migration adds these columns** to `session_templates`. Migration 075 rewrites dialogue but doesn't touch them. Either the prod DB has untracked columns (audit-gate concern) or `/api/abi/fr/sessions` 500s in prod. No migration sets recording prompt = TRUE on FR12/18/20/24/25.

### Merge ceremony at FR25 (Section 5)
- **Track transition `fr_apprentice` → `foundation` at S26: not built.** `frRoutes.js:217-220` returns a static `merge_target: { track: 'main_curriculum', session: 26 }` from `/progress` as a derived display value. No code in `sessionOrchestrator.js` or `onSessionComplete` flips a user's track after FR25. `curriculum_merge` field is passed through from yaml_data only — no consumer.
- **"Crossing the Bridge" celebration UI: not built.** Zero matches for `CrossingBridge`, `crossing_bridge`, `Cross.*Bridge` in repo.
- **v5 Practitioner design language inheritance post-merge: not built.** No design-language toggle keyed on track or post-merge state.

### FR-to-FR recursion (Section 7)
- Former-FR → Practitioner → invites family: **not built.** No graduation / role-promotion code. Roles are static (`participant` / `facilitator` / `clinician` / `admin`). No track-completion → role-grant logic. The merge target at FR25 routes to `main_curriculum` track but doesn't flip `users.role` or unlock invite permissions.

---

## Spec Deviations

### Ripple Signal — scope mismatch
- **Spec:** "30-day window per FR relationship."
- **Built:** 24-hour rate limit per recipient (`rippleService.js:103-105` — `if (hoursSince < 24) return`).
- **Difference:** No 30-day window column on `ripple_signals` (no `window_started_at`, no `expires_at`). Recipient is a phone number; there's no FR-relationship key. Functionally close to the spec's intent ("one quiet ping per day") but the relationship-scoped 30-day window is not modeled.

### Voice routing — wrong axis
- **Spec:** Luna voice for FR sessions, Luno for foundation.
- **Built:** Luno/Luna selection is tenant-keyed, not track-keyed. A tenant configured as `spiritual_companion` gets Luna for *all* sessions (foundation + FR + kitchen-table); a default tenant gets Luno for all.
- **Difference:** The spec's per-track voice switch was never implemented. Building it requires either (a) a track-aware switch in `contextRoute.js` and the frontend character resolver, or (b) routing the FR track through a `spiritual_companion`-flavored tenant variant.

### FR_OVERRIDES — dead constant in integrationLayer.js
- `src/modules/integrationLayer.js:174` defined `FR_OVERRIDES` (warm palette `[28,18,10]/[210,170,110]/[240,220,200]`, `luno_name: 'Luna'`, `crossing_the_bridge_session: 26`).
- The call site at `integrationLayer.js:449` hardcoded `is_fr: false`, making the override unreachable. The constant was also exported (line 803) but had zero external consumers.
- **Decision (this audit):** delete as dead code. FR will be properly rebuilt when the invite/onboarding surface is built; carrying a dead constant creates the illusion of a feature.

### FR session-template columns — undocumented
- `frRoutes.js` reads `family_recording_prompt` and `station_unlock` columns. No migration in `migrations/` creates them.
- If prod has these columns, they were added outside the migration system (audit-gate concern per locked rule #6). Worth a `\d session_templates` check.

---

## Recommended verification before any FR build resumes

1. Run `DATABASE_URL=… node ascen-api/scripts/auditFRTrack.js` to confirm Migration 075 applied and FR01 dialogue is FR-voice (not foundation-stamped).
2. Run `\d session_templates` against prod and confirm whether `family_recording_prompt` and `station_unlock` columns exist. If they do, write a backfill migration that documents them. If they don't, fix `frRoutes.js` to stop selecting them.
3. Decide voice-routing axis: track-keyed (build it) or tenant-keyed (update the spec to match reality).
4. Decide whether the 30-day Ripple window is still desired; if so, add `window_started_at` to `ripple_signals` and update `fireRippleIfApplicable` accordingly.
