# ASCEN BreathWorx — CLAUDE.md
# Last updated: June 24, 2026 (Item 7 — couples co-breath LIVE in prod)
# Source of truth: handoff docs in Clay's Downloads + /docs/concepts/ + /docs/reviews/
# Update this file at the end of every build session.

## PRIMARY DIRECTIVE
All work flows through ABI orchestrator (14 systems) and AXIS brain stem. No bypasses. No exceptions.

## Tooling
Codebase map (Graphify): a prebuilt code graph lives in graphify-out/. For locating files/symbols or understanding structure, delegate to the ascen-map subagent rather than grepping source. The graph is CODE-ONLY — reliable for file/symbol existence, NOT for dependency/routing (not drawn until the resolved-import build). Rebuild after structural changes; the graph is stamped with its build SHA so staleness is detectable.

## Rules
- HOS vocabulary everywhere participant-facing (Armor, Firmware, Heritage/Price, System Code). No clinical terminology.
- 5th grade reading level on all participant content.
- Blockchain writes via verificationService.js ONLY. Never direct ethers calls.
- First Spiral coherence 6:6 LOCKED at S121+.
- 720-second breathing PHASE ceiling across all sessions. Total session can run longer.
- Luno = silver orb with progressive face. NOT the pufferfish.
- Two-layer visual architecture: biofeedback controls water state, narrativeVisualsEngine controls objects/events within water. HARD SEPARATION. NVE never sets water clarity, light, turbulence.
- Every handoff doc includes pre-build Context7 library resolution step.
- Dual-file deploy rule: public/index_v8.html and public/index_v8_production.html must remain byte-identical.
- External agent deliveries (Manus, future agents) run through Phase 1 (static review) → Phase 2 (smoke test) → Phase 3 (verdict) before merging. See /docs/reviews/ for precedent.

## Locked Files (modification requires Plan Mode + verify-ascen)
- src/art/breathArtEngine.js (Stage 1, art pipeline)
- src/art/galleryHarmonicsEngine.js (Stage 2, art pipeline)
- src/art/userPersonalizationLayer.js (Stage 3, art pipeline)
- public/modules/depthEngine.js — biofeedback rendering only (water state, coherence-driven visuals)
- public/modules/narrativeVisualsEngine.js — Module 9 (locked post-Band-A merge, May 10 2026)

## Infrastructure — Railway Topology (CRITICAL)
Two SEPARATE Railway projects connected via external proxy URL:

Project 1: loyal-alignment
  - hearty-optimism (API): hearty-optimism-production-2eb6.up.railway.app
  - ascen-frontend: ascen-frontend-production.up.railway.app
  - ascen-staging-db (Postgres — staging, NOT production)

Project 2: resourceful-wisdom
  - Postgres (PRODUCTION database)

CONNECTION: hearty-optimism connects to resourceful-wisdom Postgres via external proxy URL in DATABASE_URL env var. Internal hostnames (postgres.railway.internal) do NOT work cross-project. Password rotation on resourceful-wisdom silently breaks the connection. No alerting.

GitHub: claygreg38-prog/ascen-api (production code)
Local: C:\Users\clayg\ascen-api

## Deployed Contracts (DO NOT REDEPLOY)
- SCT: 0x98A57899C9B34d59FEe484F4e28547E9ebb0c5e5
- BiometricOracle: 0xBEf693a0d3F72728c9bFe7EB10FD2ED0831bC06A
- Network: Polygon Mainnet (137)
- ORACLE_ROLE granted, block 84319510
- Blockchain attestation cron: */30 processQueue, */15 processRetries
- Signer balance monitor: daily 9 AM UTC, Sentry alert below 0.1 POL

## Voice IDs (LOCKED)
- Luno: 7FZFrYtZRrKLHTp9VJka
- Luna: qSeXEcewz7tA0Q0qk9fH
- TTS returns raw audio/mpeg bytes, NOT JSON with URL (commit a10bb00)
- Timing: EMPTY_LINE_PAUSE 800ms, POST_TTS_HOLD_MS 600ms
- Luna voice routing keyed on tenant.luno_variant === 'spiritual_companion' (NOT track-keyed)

## NS3 Engine (Option E — commits 9bc575e + bc5aa13)
- Compute every tick, persist every 5 as mean aggregate to ns3_snapshots
- Migration 083 executed
- Zones: below_window 0-35, approaching 36-55, optimal 56-80, overdrive 81-100
- Device confidence: H10=1.0, Kyto=0.75 (scores capped at 75)
- Coherence ramp: rising 0.15/frame, falling 0.03/frame, floor 0.05

## 5-Port Architecture (LOCKED)
All new systems connect through these 5 ports. Never create new ports. Extend interfaces if needed.

Port 1 — Session Lifecycle: sessionStateManager.js
Port 2 — Biometric Stream: biometricBridge — not a standalone file; connectToBiometricBridge() lives as a method inside ABI/NVE (zero userId references lines 1195-1442; blocks RRM)
Port 3 — Content Delivery: dialogueDelivery.js (speakLuno in v8, not standalone yet — methods scattered across routes)
Port 4 — Visual Layer: depthEngine.js + narrativeVisualsEngine.js
Port 5 — Data Persistence: integrationLayer.js (methods scattered across routes, NOT consolidated)

## Port 4 NVE Status (May 10, 2026)
- Built: 1,238-line module (Module 9), integrated into v8.2 HTML (4,071 lines)
- Author: Manus (external agent), verified via Phase 1/Phase 2/Phase 3 review process
- Verdict: REFACTOR — Band A cleanup PR (lerp utility, NS3 gate on trigger_flash, getCurrentSample→getCurrentBiometrics rename) merging tonight (May 10)
- Verified clean: single Luno DOM instance, zero locked-file modifications, biofeedback layer always wins, gap_reveal centerpiece works (freeze@61ms, resume@6051ms)
- Locked principles enforced: no second Luno orb, zero breathArt/galleryHarmonics/userPersonalization references, reversible via reset(), real H10 via SSM onBreathPhase
- NOT YET DEPLOYED to Railway production
- Band B cleanup items pending (~11 smaller fixes, parallel work)
- visualNarrativeBridge.js does NOT need to be separate — bridge logic is inside NVE module (connectToStateMachine + postMessage listener)

## Curriculum
- 155 sessions: S0.5-S4.5 (capacity) + S01-S150 (foundation) + FR01-FR25 (family reconnection)
- Coupling C01-C14 authored
- 8 Dimensions of Wellness mapped to arcs: Body=Physical, Awareness=Intellectual+Emotional, Integration=Social+Emotional, Repatterning=Emotional+Spiritual, Grief=Emotional+Spiritual, Emotional Granularity=Emotional, Somatic Mastery=Environmental+Physical, Existential Grief=Spiritual+Emotional, Family Systems=Social+Financial, First Spiral=All 8
- Breath ratios: 2:3, 2:4, 3:4, 3:5, 4:6, 4:7, 4:8. No holds before S71. No 4-7-8 protocol.
- determineBreathParams() runs once at arrival. NS3 is continuous biometric scoring. Separate systems.

## Database — Key Tables
- users, session_templates (205 rows — 160 foundation + 25 FR + 5 capacity + 15 null-arc), session_completions, ns3_snapshots, breath_art, family_units, vault_entries, blockchain_attestations, contract_registry, tenants

## Env Vars (Required)
- DATABASE_URL — external proxy to resourceful-wisdom Postgres
- JWT_SECRET
- VERIFICATION_SERVICE_PRIVATE_KEY — blockchain signer (missing = simulation mode)
- RECOVERY_ENCRYPTION_KEY — BIP39 capsule + vault recovery
- ART_ENCRYPTION_KEY — AES-256-CBC for breath art + vault
- WALLET_ENCRYPTION_KEY — embedded wallet encryption
- ELEVENLABS_API_KEY — TTS (works without, falls back to speechSynthesis)
- PINATA_API_KEY / PINATA_SECRET — IPFS art storage
- SENTRY_DSN — error monitoring

## Env Vars (Optional)
- TEST_HARNESS_API_KEY — dev fallback alongside JWT
- LIGHTBRIDGE_SIMULATE=true — skip hardware calls
- FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL — push notifications
- ANTHROPIC_MODEL_HAIKU / ANTHROPIC_MODEL_SONNET — aiRouter model IDs
- STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET — billing (not needed for pilot)
- RESEND_API_KEY / EMAIL_FROM — email (missing = Sentry + queue retry)
- TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER — SMS

## CRITICAL Safety Blocker (must fix before premium tier)
- Child abuse disclosure routing: cannot deliver abuse disclosure to alleged abuser
- Six findings documented in GuidedBridge/FamilyCompass review docs
- Blocks: premium tier deployment, Family Compass tier, any feature surfacing disclosed content to family members

## Known Bugs
- Bug A: Kyto BLE cadence too sparse (~0.5/s) — coherence freezes. H10 works. Diagnostic written, fix not applied.
- Session auto-advancement (S1→S2→S3): LIVE-CONFIRMED (pilot). Stateless MAX(session_number)+1 derivation via contextRoute (/api/auth/context); no stored pointer. The ?s= parameter is the internal iframe launch mechanism, not a manual step.
- Capacity track routing (S0.5-S4.5): Content seeded, routing NOT WIRED. routeToTrackSelector is a console.log stub.
- 5 failing migrations on deploy (030, 058, 067, 077, 080-082): likely "already applied" — need IF NOT EXISTS guards.
- session_templates has 205 rows with ambiguous arc values (body/Body/null overlap on S01-S05). Loader determinism unverified.

## FR Track — Concrete Gaps (audit May 8, 2026)
- FR invitation primitive on inmate side: NOT BUILT (lightbridge.generateInvite mutation doesn't exist; "lightbridge" in this codebase = IoT lights, not invites)
- Family Recording attachment to invite: NOT BUILT (no family_recordings table)
- 16-character invite code generation: NOT BUILT (closest is 6-hex family-unit code)
- Practitioner "Invite Family" button: NOT BUILT
- FR receiver onboarding (6-screen flow): NOT BUILT — invite landing, family recording playback, role confirmation, what-to-expect, FR-tuned account creation, consent flows
- Direct-to-FR01 routing: NOT BUILT
- Surface-mode visual treatment for FR users (sunny start, earned descent): NOT BUILT
- Luna voice routing per-track: NOT BUILT (tenant-keyed only, no track→luna switch)
- FR_OVERRIDES dead code: REMOVED (commit May 10)
- Family Recording prompts FR12/18/20/24/25: scaffolded but broken (no migration adds family_recording_prompt column; /api/abi/fr/sessions may 500 in prod)
- Track transition fr_apprentice → foundation at S26: NOT BUILT (read signal exists at frRoutes.js:217-220, no write code)
- "Crossing the Bridge" celebration UI: NOT BUILT
- FR-to-FR recursion (graduation → invite permission): NOT BUILT
- Ripple Signal: BUILT but spec-deviated (24-hour rate limit, user-scoped, not 30-day relationship-scoped per spec)
- Migration 075 (FR contamination fix): committed, application status unverified — run scripts/auditFRTrack.js to confirm

## Couples Co-Breath — LIVE IN PROD (Item 7, shipped June 24, 2026 — feat/coupling @ e45a842)
VERIFIED against prod (resourceful-wisdom Postgres da971b88, host :29763) + the live hearty-optimism deploy.
CAVEAT: synthetic-bio plumbing proof only so far — no real-strap session has run (see NOT YET DONE).

- System is COUPLES-ONLY. Entry + gating: A1 S15 unlock, B1 DV 5-state deny-by-default, B2 48h gap.
- DV clinician setter: POST /api/partnership/dv-screening (clinician/admin role) — the key-issuer for the
  deny-by-default DV gate. Valid statuses: not_screened | pass | pass_with_support | clinical_review_required | not_appropriate. Only pass / pass_with_support open entry.
- Live co-breath (L1-L4): gated WS rooms keyed to partnership_sessions.id (the room token IS the gated
  session id — a room can't exist ungated); server-derived breathParams (client params never trusted);
  REST tick-bio carries raw HRV to the SERVER only — raw HRV NEVER crosses the WS, only the regulation
  CATEGORY is forwarded to the partner; idempotent completion + stale-room reaper.
- Async Echo: breathe with a recorded capsule trace (single recipient + server trace-player); same substrate, mode-aware (live | echo).
- Frontend client lives in index_v8 (public/, dual-file byte-identical), reached via the embedded launcher
  CoupleSessionScreen at /app/couple (real per-partner JWT handed in via postMessage, never URL). enter() → gated mint → live single-orb surface.
- Two-browser pairing: GET /api/partnership/active-session — partner B auto-joins the token A minted (same
  room; resolvePartnership-scoped, no cross-partnership leakage). Double-mint race closed by migration 090's
  partial unique index one_open_session_per_partnership (UNIQUE on partnership_id WHERE completed_at IS NULL
  AND abandoned_at IS NULL); startSession catches the 23505 and reuses the winner's token.
- PROD MIGRATIONS: 085-090 ALL applied (090 verified present w/ correct partial-unique predicate; 0
  partnerships with >1 open session). server.js runs STARTUP migrations on boot (~line 870) → migrations
  auto-apply on each deploy. Run order if ever manual: 085 → 086 → 087 → 088 → 089 → 090.
- frontend/dist is a COMMITTED static artifact, NOT built on deploy (Dockerfile = npm install --production
  + node server.js; nixpacks build phase is a no-op echo; server.js serves /app via express.static(frontend/dist)).
  Rebuild (cd frontend && npm run build) + commit frontend/dist whenever frontend/ changes ship, or it won't reach prod.
- NOT YET DONE — the real-world milestone: NO two-person session with real Polar H10 straps has run. Every
  validation to date is synthetic-bio plumbing proof (Playwright two-context + node socket harnesses in scripts/capstone_*).
  Before ANY couple can complete a session, a clinician MUST set dv_screening_status='pass' via the setter — gate is deny-by-default (missing/not_screened DENIES).

### RETIRED (Item 7 Phase 4, git revert e711d12 to restore)
- Old family co-breath stack REMOVED: src/routes/coBreathRoutes.js, src/abi/coBreathEngine.js, frontend
  CoBreathScreen.jsx + the /app/cobreath/:roomCode route, and the FamilyScreen "Co-Breath" tab. Was COLD
  (0 prod rows ever in cobreath_sessions / cobreath_rooms / family_patterns). /api/cobreath/* now 404.
- New co-breath is COUPLES-ONLY — there is currently NO family co-breath entry point.
- KEPT (these are the NEW stack, not the old): src/services/coBreathWebSocket.js (the /ws/cobreath WS) + coBreathSession.js (L3).

### PARKED / expansion (NOT built)
- Dual-signature visual (live surface is single-orb only today).
- Parent/child track (relationship_type on the partnership).
- Track-scoped currency ("Presence").
- Terra ambient awareness layer — consent model gated on Crystal + Jenae; collect-nothing in v1.
- Family-as-multiple-dyads question for 3+ person families (how a family unit maps to pairwise co-breath).

## Coupling — Concrete Gaps (audit May 8, 2026 — PRE-SHIP historical; superseded by "Couples Co-Breath — LIVE IN PROD" above)
- 14 sessions seeded in session_templates with dialogue_phases populated
- breath_mode, ratio, duration_seconds NULL on all 14 (cannot run breathing)
- Partnership backend SCAFFOLDED (15 endpoints in partnershipEngine.js, migration 048), frontend MISSING
- Production rows: 0
- Action 4.6 Gate System: NOT BUILT (clinical authority work, blocks safe rollout — gated on Jenae)
- Co-breath: SUPERSEDED — the participant CoBreathScreen.jsx was RETIRED (Phase 4); live couples co-breath now runs in index_v8 (see "Couples Co-Breath — LIVE IN PROD"). New WS stack = src/services/coBreathWebSocket.js + coBreathSession.js (clinician trigger ClinicianDashboardScreen.jsx:107 still references the WS).
- Kitchen Table frontend: BUILT at /app/family/kitchen-table
- 6 Coupling modules missing visual_narrative blocks: C01, C02, C03, C05, C06, C07, C09

## Shipped Infrastructure (often not realized)
- LightBridge v1.0: Wyze smart bulb ambient signaling, caregiver authority model, child practice engine. Demo spike proven end-to-end (ns3_mean → Wyze amber → SendGrid email 0.48s). 5 [DECISION REQUIRED] items pending.
- Couples co-breath LIVE in prod (Item 7): gated WS rooms + REST tick-bio + async Echo (see "Couples Co-Breath — LIVE IN PROD"). Old family /api/cobreath retired.
- BLE H10 + Kyto support
- ABI 14/14 orchestrator, AXIS active
- verificationService blockchain writes LIVE (block 84319510)
- IPFS art storage via Pinata
- ElevenLabs TTS with speechSynthesis fallback

## What's NOT Built (commonly assumed to exist)
- visualNarrativeBridge.js as separate file — bridge logic is INSIDE the NVE module
- Ports 3 and 5 as standalone consolidated modules — methods scattered across routes
- Port 2 userId-keyed storage — blocks RRM (Relational Resonance Monitor) Phase 4
- RRM (Relational Resonance Monitor): spec complete, blocked on Port 2
- Family invitation → onboarding workflow — specced in Family Communication Architecture, not wired
- Coherence-driven water clarity/light/currents — lost in v8 refactor. Only plankton reads coherence. v6 lerp chain needs porting.
- Crisis routing on real user path — coded, never tested
- Gallery endpoint — untested with real JWT post-auth-fix

## BLE Devices
- Polar H10: chest strap, 1 RR/notification typical, confidence 1.0
- Kyto2935: ear clip, ~0.5 RR/s, confidence 0.75, Bug A active

## Tenant Model
- Default participant tenant (Apprentice variant)
- Practitioner tenant (clinical-focused, Demere/Quinten at PGC-CRC)
- Spiritual Companion tenant (Iyanla white-label priority)
- Voice variant selection via tenant.luno_variant field

## verify-ascen Acceptance Criteria (from Map v1.2 appendix)
When any agent (CC, Manus, future) modifies NVE or Port 4 work, these must all pass:
- NVE.trigger('gap_reveal', { duration_ms: 6000 }) freezes particles within ±100ms
- DepthEngine RAF cancels during freeze, resumes after with ease-in-cubic interpolation
- Existing Luno orb (#lunoCon) pauses drift during freeze, resumes after
- No console errors during full session run
- NS3 / coherence / biofeedback rendering continue uninterrupted by NVE
- Priority queue handles overlap correctly (signature_moment cancels narrative_active, breath_sync persists)
- NVE.reset(2000) returns to ambient state cleanly
- Bridge resolves opening.dialogue[2] to correct dialogue index
- Bridge handles unknown visual names gracefully
- grep "breathArt|galleryHarmonics|userPersonalization" in NVE-related files returns zero hits
- Single #lunoCon DOM instance (no duplicate Luno orbs introduced)

## Key File Paths (condensed)
### Core Engine
- src/abi/sessionOrchestrator.js, breathProtocolAdapter.js, determineBreathParams.js
- src/abi/buildSessionDataPacket.js, lunoIntelligence.js
- src/axis/axisEngine.js
- src/ns3/ns3Engine.js, ns3AxisBridge.js
### Biometrics + Art
- src/biometrics/biometricResilience.js
- src/art/breathArtEngine.js, ipfsService.js, crowns/
### Blockchain
- src/blockchain/verificationService.js
### Routes
- src/routes/abiRoutes.js, artRoutes.js, authRoutes.js, familyRoutes.js
- src/routes/kitchenTableRoutes.js, crisisRoutes.js, partnershipRoutes.js (couples co-breath; coBreathRoutes.js RETIRED Item 7 Phase 4)
- src/routes/v8Routes.js, nextSessionRoute.js, frRoutes.js
### Frontend
- public/index_v8.html (production v8.2, ~2743 lines + NVE integration)
- public/index_v8_production.html (mirror, dual-file deploy rule)
- public/modules/narrativeVisualsEngine.js (Module 9, locked)
- frontend/ (React PWA shell)
### Auth + Services
- src/services/authService.js, emailService.js, smsService.js, pushService.js
- src/services/ttsService.js, rippleService.js
### Family
- src/family/familyUnitEngine.js, familyIntelligence.js
- src/family/legacyVaultEngine.js, capsuleUnlockEngine.js
- src/family/kitchenTableEngine.js (coBreathEngine.js RETIRED Item 7 Phase 4; couples co-breath lives in src/abi/partnershipEngine.js + src/services/coBreathWebSocket.js + coBreathSession.js)
### Clinical
- src/clinical/crisisEngine.js, therapyReportService.js
- src/premium/premiumGate.js, facilitatedMessaging.js
### LightBridge
- src/abi/lightBridgeEngine.js
### Audit Scripts (committed May 10)
- scripts/auditFRTrack.js, scripts/auditCouplingKitchen.js, scripts/verifyBugB.js
### Documentation
- docs/FR_TRACK_STATUS.md
- docs/concepts/ASCEN_MVP_Readiness_Map_v1_2.md
- docs/concepts/ASCEN_Workflow_Upgrade_Plan_v1_2.md
- docs/reviews/MANUS_NVE_REVIEW_PHASE_1.md
- docs/reviews/MANUS_NVE_REVIEW_VERDICT.md

## Staff Accounts (Production)
- Clay Gregory (admin)
- Demere Coker LGPC (clinician, PGC-CRC)
- Quinten Carter (clinician, PGC-CRC)
- 4th account: unknown — verify with SELECT id, email, role FROM users

## IP
- Ascen System provisional: App #64/032,477 (April 7, 2026)
- Legal inventor name: Henry Gregory (Clay is middle name)
- Entity: HCG Family Life LLC
- Attorney: Crystal Williams
- Mettle Impact Ledger non-provisional conversion: URGENT, ~May 2026 deadline
