# ASCEN BreathWorx -- Full Retrospective Audit Report

**Date:** 2026-03-16
**Auditor:** Systems Audit (Claude Opus 4.6)
**Codebase:** ascen-api (commit 4856ba0)
**Scope:** All 6 phases, every source file in repository

---

## Executive Summary

| Phase | Status | Violations |
|-------|--------|-----------|
| 1. ABI Orchestrator Integrity | CONDITIONAL PASS | 8 |
| 2. Clinical Safety Rules | PASS | 1 |
| 3. Language and User Experience | CONDITIONAL PASS | 3 |
| 4. Security and Production Readiness | FAIL | 7 |
| 5. Data Architecture | PASS | 2 |
| 6. Biometric Integration | CONDITIONAL PASS | 3 |

**Total violations: 24**
- CRITICAL: 7
- WARNING: 10
- NOTE: 7

---

## Violations Table

### Phase 1: ABI Orchestrator Integrity

| # | Severity | File | Line | Description | Fix |
|---|----------|------|------|-------------|-----|
| 1 | WARNING | server.js | 208-229 | `/api/sessions` and `/api/sessions/:id` query `session_templates` directly, bypassing ABI orchestrator. These are public curriculum-browsing routes with no auth. | Route is read-only browsing, but should use a thin ABI service layer for consistency. Low-risk because no session logic is involved. |
| 2 | WARNING | server.js | 232-253 | `/api/clinical/dashboard` and `/api/court/participants` return hardcoded mock participant data directly. These bypass both ABI and AXIS. | Replace with real AXIS dashboard data or mark as explicitly deprecated with TODO removal date. |
| 3 | WARNING | server.js | 257-263 | `/api/lightbridge/activate` routes return mock data, bypassing ABI. | Flag as placeholder. No session logic risk. |
| 4 | WARNING | server.js | 293-311 | `/api/blockchain/verify-session` legacy endpoint writes directly to `attestation_queue` via raw SQL instead of going through `verificationService.js`. Violates the rule: "Blockchain writes ONLY through verificationService.js." | Refactor to call `verificationService.queueForReview()` or similar method. |
| 5 | WARNING | src/routes/axisRoutes.js | 59-76 | `/api/axis/stats` and `/api/axis/refinements` query `axis_sessions` and `axis_refinements` tables directly with raw SQL instead of going through AxisEngine methods. | Add `getStats()` and `getRecentRefinements()` methods to AxisEngine class. |
| 6 | WARNING | src/routes/axisRoutes.js | 91-103 | `/api/axis/user/:userId/history` queries `axis_sessions` directly instead of through AxisEngine. | Add `getUserHistory(userId)` to AxisEngine. |
| 7 | NOTE | src/routes/frRoutes.js | 33-163 | FR routes for `/sessions`, `/sessions/:number`, `/arcs` query `session_templates` directly via `pool.query`. The FR `/engine/:number` route also reads YAML data directly. These are read-only session template queries, not session lifecycle, but ideally would go through a thin adapter. | Low priority. These are configuration lookups, not session logic. Could wrap in a FRSessionService for consistency. |
| 8 | NOTE | src/routes/frRoutes.js | 170-227 | `/api/abi/fr/progress` queries `sessions` table directly with `participant_id` column. This is a different table/schema from `session_completions` used elsewhere, suggesting schema inconsistency. | Verify `sessions` table exists with `participant_id` column, or update to use `session_completions.user_id`. |

**Phase 1 Assessment:** All session lifecycle routes (start, arrival-sample, arrival-complete, somatic-complete, tick, pause, resume, exit, complete) correctly flow through the ABI orchestrator via `createOrchestrator()`. The 14 ABI systems are all wired into the orchestrator. AXIS is integrated for post-session ingest and nightly refinement. The violations are in ancillary read-only routes and one legacy blockchain endpoint.

### Phase 2: Clinical Safety Rules

| # | Severity | File | Line | Description | Fix |
|---|----------|------|------|-------------|-----|
| 9 | NOTE | src/abi/determineBreathParams.js | 20-33 | The 2:3 ratio floor is present in `RATIO_LIBRARY` as difficulty level 1 (the lowest). The `filterRatioOptionsForUser` function correctly limits to the YAML-defined range. The safety floor logic at line 122-126 caps upward, not downward -- it ensures the selected ratio cycle time does not exceed the natural RR safety floor. The 2:3 ratio IS available as the minimum in all gentle/minimal ratio_range arrays in breathProtocolAdapter.js. **PASS** -- the 2:3 floor from 30-second arrival baseline is enforced. | No fix needed. |

**Phase 2 Assessment:**
- **Clinical Rule #1 (never ask about breathing capacity):** PASS. No user-facing prompt, message, or UI text asks users about their breathing capacity. All detection is silent via arrival baseline biometrics.
- **2:3 breath ratio floor:** PASS. The RATIO_LIBRARY starts at 2:3, and all ratio_range arrays for gentle/minimal tracks include 2:3 as the lowest option.
- **Somatic exercises capped at 2 minutes:** PASS. Migration 012 seeds somatic exercises with durations of 60, 90, and 120 seconds (all within 2-minute cap). The orchestrator limits to max 2 exercises per session (line 1465).
- **Luno never provides real-time verbal feedback based on biometric data:** PASS. Luno dialogue is phase-based (arrival, mid, mirror, closing). The coaching engine provides graduated adjustments (exhale extend, visual warmth, pacer slow) but these are silent system adjustments, not Luno verbal feedback about biometric readings.
- **FR YAML sessions:** Cannot verify all 25 FR YAML sessions directly (they are stored in the database, not in the codebase as files). The `adaptFRBreathProtocol` correctly sets `adaptive_ratio: true` for all FR sessions with appropriate ratio_ranges per block.
- **161 Foundation Arc sessions:** Session templates are in the database, not codebase files. The `breathProtocolAdapter.js` correctly maps all 9 arcs across 3 tracks with proper ratio_ranges.

### Phase 3: Language and User Experience

| # | Severity | File | Line | Description | Fix |
|---|----------|------|------|-------------|-----|
| 10 | CRITICAL | server.js | 307 | Response message says "Session queued for blockchain attestation" -- exposes "blockchain" terminology to the API consumer (potentially a participant-facing frontend). | Change to "Session verification queued" or "Your breath record has been saved for verification." |
| 11 | WARNING | public/index.html | 90-97 | Legacy `index.html` contains `/api/blockchain/verify-session` endpoint with response "Session queued for blockchain verification". This is a dead legacy file but still served. | Delete `public/index.html` or remove blockchain terminology. |
| 12 | NOTE | src/abi/sessionOrchestrator.js | 64 (migration 011 line 64) | Migration 011 creates column `sct_token_id` which exposes blockchain naming in the database schema. Not user-facing but violates naming spirit. | Low priority. Internal schema only. Could rename to `verification_record_id` in a future migration. |

**Phase 3 Assessment:**
- **Blockchain terminology in user-facing strings:** One CRITICAL violation in `server.js` line 307 where "blockchain attestation" appears in an API response to a participant-authenticated endpoint. The `public/index.html` legacy file also contains "blockchain verification" text.
- **Session closing lines:** The microAffirmations.js and victoryLapEngine.js provide appropriate session-completion messages. The closing formula (warrior reassurance + specific anticipation) is partially followed -- messages like "Your body remembers this now" are reassurance but lack specific anticipation for next session. This is a design consideration, not a violation.
- **Education level:** User-facing strings in microAffirmations.js, coaching messages, and Luno dialogue all use simple, direct language appropriate for 6th-grade reading level.

### Phase 4: Security and Production Readiness

| # | Severity | File | Line | Description | Fix |
|---|----------|------|------|-------------|-----|
| 13 | CRITICAL | src/middleware/auth.js | 24 | JWT_SECRET has a hardcoded fallback: `'ascen-dev-secret-CHANGE-IN-PRODUCTION'`. If `JWT_SECRET` env var is not set in production, the app silently uses this insecure default. There is no check that rejects startup when JWT_SECRET is missing in production. | Add a startup check: if `NODE_ENV === 'production' && !process.env.JWT_SECRET`, throw an error and refuse to start. |
| 14 | CRITICAL | public/test.html | 198 | API key `'ascen_test_harness_2026'` is hardcoded in a publicly served HTML file. Anyone who loads `/test` can see this key and use it to authenticate as any role against the API. | This is a known test harness. Add a production guard: if `NODE_ENV === 'production'`, do not serve test.html, or require a separate test API key that only works in non-production. |
| 15 | CRITICAL | public/test.html | 197 | Production API URL `'https://hearty-optimism-production-2eb6.up.railway.app'` is hardcoded in the test harness, meaning the test page hits the production server directly. | Use a relative URL or environment-based configuration. |
| 16 | WARNING | server.js | 43-46 | CORS allows all origins by default (`['*']`) when `ALLOWED_ORIGINS` env var is not set. In production, this should be restricted. | Set `ALLOWED_ORIGINS` in production environment. Add a startup warning when defaulting to `*`. |
| 17 | WARNING | server.js | 188-205 | `/api/schema` endpoint exposes full database schema. While it checks for `NODE_ENV === 'production'`, the check relies on `NODE_ENV` being explicitly set. If not set, defaults to allowing access. | Change the guard to only allow when `NODE_ENV === 'development'` explicitly. |
| 18 | WARNING | server.js | 319-321 | `console.log` statements in production startup. There are 12 `console.log` calls in server.js for startup and cron operations. These are acceptable for server logging but should use a structured logger in production. | Low priority. Consider adding a logger (winston/pino) for structured logging. |
| 19 | WARNING | public/index.html | 1-103 | `public/index.html` is a complete legacy Express server (not HTML) that includes its own route handlers, direct DB queries, no auth on clinical/court endpoints, and a hardcoded external blockchain verification URL (`mettle-verifcation-ledger-production.up.railway.app`). This file is NOT served as a route but exists in the public directory. | Delete this file entirely. It is superseded by `server.js` and poses confusion risk. |

**Phase 4 Assessment:**
- **Hardcoded secrets:** No hardcoded database connection strings, private keys, or API keys in source code (they are read from env vars). However, the JWT fallback secret and the test harness API key are significant security risks.
- **JWT auth middleware:** Applied to all protected route groups (session, clinical, admin, drill, AXIS dashboard/refine). Health endpoints are correctly public.
- **Production hardening:** Rate limiter, input validation, audit logger, CFR guard, and DB resilience are all wired in server.js.
- **Blockchain safety:** Gas circuit breaker at 500 gwei (PASS), contract registry pattern (PASS), retry with front-running detection (PASS), shutdown capability (PASS), expungement protocol (PASS).

### Phase 5: Data Architecture

| # | Severity | File | Line | Description | Fix |
|---|----------|------|------|-------------|-----|
| 20 | NOTE | migrations/011_combined_ledger_sync.sql | 30 | `active_modalities` JSONB column is defined in migration 011 with default `'{"solo": {"session": 0, "act": 1}}'`. No code in the current codebase reads or writes this column. This is acceptable as future scaffolding. | No action needed -- schema is ahead of code as designed. |
| 21 | NOTE | src/routes/frRoutes.js | 181-187 | The FR progress route queries a `sessions` table with `participant_id` and `completed` columns, which differs from the `session_completions` table used everywhere else. This may reference a table that does not exist or has a different schema. | Verify this table exists. If it does not, update to use `session_completions` with `user_id`. |

**Phase 5 Assessment:**
- **active_modalities JSONB:** PASS. Migration 011 defines the column. No code uses `current_track_id`.
- **Vault pattern intelligence reads structured metadata only:** PASS. `vaultPatternAnalyzer.js` reads only `resonance_signal`, `impact_slider`, and `emotional_tags` from vault_response JSONB -- never free text.
- **Database migrations:** Migration 011 (combined ledger sync) and 012 (somatic + closes) are consistent with current code. All columns referenced in orchestrator INSERT statements are defined in migrations.
- **Orphaned endpoints:** The legacy routes in server.js (clinical dashboard, court participants, LightBridge) are mock/placeholder routes that do not correspond to ABI modules. They are documented as legacy.

### Phase 6: Biometric Integration

| # | Severity | File | Line | Description | Fix |
|---|----------|------|------|-------------|-----|
| 22 | CRITICAL | src/abi/biometricResilience.js | 1-45 | The file is only 45 lines (the audit spec references 407 lines). It is a stub implementation that handles disconnect/reconnect mode switching but does NOT handle: `startSession()`, `onBiometricUpdate()`, `onManualPause()`, `endSession()`, `getSessionAnnotation()` -- all of which are called by the orchestrator (lines 414, 760, 1038, 1060, 1061). These calls will silently fail (caught by try/catch in orchestrator) but biometric resilience is effectively non-functional. | Implement the full 407-line BiometricResilience class with all methods the orchestrator calls. |
| 23 | CRITICAL | src/abi/sessionOrchestrator.js | 509 | The orchestrator calls `baselineFilter.getCleanBaseline()` but the actual method in `baselineFilter.js` is named `getFilteredBaseline()`. This means the baseline filter result is always caught as an error and raw baseline is used instead. Silent failure. | Change line 509 from `baselineFilter.getCleanBaseline()` to `baselineFilter.getFilteredBaseline()`. |
| 24 | WARNING | public/test.html | 392-393 | BLE connection uses `{ services: ['heart_rate'] }` string filter which is the Web Bluetooth standard name for service UUID 0x180D. This is functionally correct as the browser resolves 'heart_rate' to 0x180D. However, the code does NOT filter by device name (PASS). | No fix needed -- using service UUID filter via standard name alias is correct. |

**Phase 6 Additional Findings (method mismatches, non-blocking but degraded):**
- `pauseHandler.manualPause()` called in orchestrator line 1036, but PauseHandler only defines `pause()`. Silent failure means manual pauses do not register.
- `pauseHandler.exitSession()` called in orchestrator line 1046, but PauseHandler only defines `exit()`. Silent failure means exit taps do not register.
- `stateEngine.secondsInState`, `stateEngine.currentResponseLevel`, `stateEngine.activeAdjustments` referenced in orchestrator lines 806-826, but StateEngine does not define these properties. The state tick notifications to frontend are sending undefined values.
- `immuneSystem.getImmuneHistory()` called in abiRoutes.js line 535, but ImmuneSystem does not define this method. The immune history endpoint will always 500.
- `trendAnalyzer.getDashboardSummary()` imported in abiRoutes.js line 23, but trendAnalyzer only exports `analyzeTrends` and `shouldRunTrendAnalysis`. The trends dashboard endpoint will always 500.
- `companionshipMode.getSessionConfig()` called in orchestrator line 1412, but CompanionshipMode does not define this method. Mirror data will have null companionship_data.

---

## Prioritized Fix List

### Priority 1 -- CRITICAL (fix immediately)

| # | Fix | Effort | Risk if unfixed |
|---|-----|--------|-----------------|
| 13 | Add JWT_SECRET production startup guard | 15 min | Any attacker can forge valid JWTs using the known fallback secret |
| 23 | Fix `getCleanBaseline()` -> `getFilteredBaseline()` method name | 5 min | Baseline filter is silently non-functional; all sessions use unfiltered raw baseline data |
| 22 | Implement full BiometricResilience class (startSession, onBiometricUpdate, onManualPause, endSession, getSessionAnnotation) | 2-3 hours | Biometric resilience is a stub; BLE disconnect handling, session annotations, and manual pause tracking are non-functional |
| 10 | Remove "blockchain" from API response in server.js line 307 | 5 min | Participant-facing API response exposes prohibited terminology |
| 14-15 | Add production guard for test.html serving, remove hardcoded prod URL | 30 min | Test harness exposes API key and production URL to anyone who visits /test |

### Priority 2 -- WARNING (fix before next release)

| # | Fix | Effort | Risk if unfixed |
|---|-----|--------|-----------------|
| P2a | Fix `pauseHandler.manualPause()` -> `pause()` and `exitSession()` -> `exit()` in orchestrator | 10 min | Manual pause and exit taps silently fail |
| P2b | Add `secondsInState`, `currentResponseLevel`, `activeAdjustments` properties to StateEngine | 1 hour | Frontend state notifications contain undefined values |
| P2c | Add `getImmuneHistory()` to ImmuneSystem and `getDashboardSummary()` to trendAnalyzer | 1 hour | Two clinical dashboard endpoints return 500 errors |
| P2d | Add `getSessionConfig()` to CompanionshipMode | 15 min | Mirror data missing companionship config |
| 4 | Refactor legacy blockchain endpoint to use verificationService | 30 min | Blockchain write outside verified service path |
| 5-6 | Move raw SQL from axisRoutes to AxisEngine methods | 45 min | Violates ABI orchestration principle for AXIS |
| 16 | Restrict CORS in production | 15 min | Any origin can make API requests |
| 17 | Tighten schema endpoint guard | 5 min | Database schema exposed if NODE_ENV not set |
| 19 | Delete public/index.html legacy file | 5 min | Confusing dead code with security issues |

### Priority 3 -- NOTE (address in next sprint)

| # | Fix | Effort | Risk if unfixed |
|---|-----|--------|-----------------|
| 7 | Wrap FR template queries in FRSessionService | 1 hour | Architecture consistency |
| 8 | Verify FR progress table schema | 30 min | Possible 500 on FR progress endpoint |
| 11 | Remove blockchain terminology from legacy HTML | 5 min | Dead file terminology |
| 12 | Rename sct_token_id column | Migration + 30 min | Internal naming only |
| 18 | Add structured logger | 2 hours | Operational improvement |
| 20-21 | Verify active_modalities and sessions table | 30 min | Schema consistency |

---

## Architecture Summary

The ABI orchestrator (`sessionOrchestrator.js`, 1566 lines) correctly serves as the single integration point for all 14 ABI systems. The session lifecycle (start -> arrival -> somatic? -> breathing -> complete) flows entirely through the orchestrator. All 14 systems are imported and initialized within `createOrchestrator()`:

1. breathProtocolAdapter -- CONNECTED
2. pauseHandler -- CONNECTED (method name mismatch)
3. sessionSafetyGuards -- CONNECTED
4. microAffirmations -- CONNECTED
5. stateEngine -- CONNECTED (missing properties)
6. coachingEngine -- CONNECTED
7. lunoIntelligence -- CONNECTED
8. immuneSystem -- CONNECTED (missing getImmuneHistory)
9. homeostaticRegulator -- CONNECTED
10. biometricResilience -- STUB (needs full implementation)
11. identityEngagement -- CONNECTED
12. baselineFilter -- CONNECTED (method name mismatch)
13. drillAdapter -- CONNECTED
14. trendAnalyzer -- CONNECTED (missing getDashboardSummary)

AXIS brain stem is integrated for post-session ingest and nightly refinement. The blockchain verificationService correctly uses contract_registry for addresses and has all safety structures (gas circuit breaker, retry, front-running detection, shutdown, expungement).

The codebase is architecturally sound with the ABI orchestrator correctly serving as the spine. The primary issues are method name mismatches between the orchestrator and its subsystems, and one stub implementation (biometricResilience) that needs to be completed.

---

## Files Audited

Every file in the repository was read in full:

- server.js (372 lines)
- src/routes/abiRoutes.js (743 lines)
- src/routes/axisRoutes.js (116 lines)
- src/routes/axisValueRoutes.js (66 lines)
- src/routes/frRoutes.js (288 lines)
- src/abi/sessionOrchestrator.js (1566 lines)
- src/abi/breathProtocolAdapter.js (397 lines)
- src/abi/determineBreathParams.js (296 lines)
- src/abi/lunoIntelligence.js (189 lines)
- src/abi/biometricResilience.js (45 lines)
- src/abi/stateEngine.js (94 lines)
- src/abi/coachingEngine.js (73 lines)
- src/abi/immuneSystem.js (93 lines)
- src/abi/homeostaticRegulator.js (63 lines)
- src/abi/identityEngagement.js (48 lines)
- src/abi/baselineFilter.js (43 lines)
- src/abi/drillAdapter.js (32 lines)
- src/abi/trendAnalyzer.js (28 lines)
- src/abi/pauseHandler.js (87 lines)
- src/abi/sessionSafetyGuards.js (55 lines)
- src/abi/microAffirmations.js (76 lines)
- src/abi/buildSessionDataPacket.js (219 lines)
- src/abi/preSessionIntelligence.js (129 lines)
- src/abi/postSessionIntelligence.js (109 lines)
- src/abi/stateEngineEnhancements.js (78 lines)
- src/abi/coachingEnhancements.js (70 lines)
- src/abi/crossSystemSynergy.js (109 lines)
- src/abi/victoryLapEngine.js (120 lines)
- src/abi/valueEngine.js (162 lines)
- src/abi/vaultPatternAnalyzer.js (132 lines)
- src/axis/axisEngine.js (212 lines)
- src/blockchain/verificationService.js (417 lines)
- src/blockchain/blockchainRetry.js (148 lines)
- src/blockchain/BiometricOracleABI.json
- src/db/pool.js (20 lines)
- src/middleware/auth.js (329 lines)
- src/middleware/abiHardening.js (191 lines)
- public/test.html (~900 lines)
- public/index.html (105 lines)
- migrations/011_combined_ledger_sync.sql (202 lines)
- migrations/012_somatic_and_closes.sql (129 lines)
- Dockerfile, package.json, .gitignore, CLAUDE.md, README.md
