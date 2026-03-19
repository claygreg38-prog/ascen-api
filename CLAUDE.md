# CLAUDE.md — ASCEN BreathWorx
Updated: March 18, 2026

## Rules
- All logic flows through ABI orchestrator. No bypasses.
- Blockchain writes ONLY through verificationService.js.
- Contract addresses from contract_registry table. Never hardcoded.
- ABI selects breath ratios at runtime. YAMLs define ranges only.
- First Spiral (S121-S150) LOCKED to 6:6.
- Users never see: NFT, crypto, blockchain, token, wallet, mint.
- Silent biometric detection only. Never ask about breathing capacity.
- Luno does not decide what to say — ABI decides. Luno says it.
- Produce code, not explanations. List files changed. No summaries.
- Do not search codebase extensively. Ask user if unsure.

## Deployed (DO NOT REDEPLOY)
- SCT: 0x98A57899C9B34d59FEe484F4e28547E9ebb0c5e5
- Oracle: 0xBEf693a0d3F72728c9bFe7EB10FD2ED0831bC06A
- Network: Polygon Mainnet (137)
- API: hearty-optimism-production-2eb6.up.railway.app
- DB: resourceful-wisdom (Railway PostgreSQL)
- ABI 14/14, AXIS active, verificationService live
- Blockchain writes LIVE — ORACLE_ROLE granted, block 84319510
- processQueue() cron active every 30 minutes
- Migration 011: wallet, family, attestation fields
- Migration 012: somatic_exercises + personalized_closes tables
- Migration 013: NS3 fields on session_completions
- FR YAMLs re-seeded with adaptive ratio ranges
- breathProtocolAdapter: ratio_range on all arcs x tracks
- determineBreathParams: deployed, wired into onArrivalComplete()
- buildSessionDataPacket: deployed, wired into onSessionComplete()
- 9 somatic exercises seeded. 150 personalized closes seeded.
- Somatic Reset Gateway live in onArrivalComplete()
- onSomaticComplete() lifecycle method live
- computeSessionTags() + selectPersonalizedClose() wired
- NS3 Engine deployed: src/services/ns3Engine.js
- NS3 Bridge deployed: src/services/ns3AxisBridge.js
- Test harness at /test (throwaway — delete after pilot)
- Migration 014: breath art columns on session_completions
- breathArtEngine.js: deterministic sacred geometry generator
- ipfsService.js: Pinata IPFS upload + AES-256 clinical encryption
- Breath art wired into onSessionComplete() (after NS3, before attestation)
- 5 crown SVGs in src/assets/crowns/ (flower_of_life, metatrons_cube, sri_yantra, seed_of_life, vesica_piscis)
- Dependencies: sharp, crypto-js
- Art routes at /api/art (Session 9): gallery, decode, crown, intention, photo-palette
- photoAbstractionService.js: 6x6 palette extraction
- Crown SVGs served statically at /assets/crowns/
- Mirror screen art reveal + gallery UI in test harness
- Migration 015: personalized_art, showcase_posts, showcase_likes, showcase_reports
- canvasRoutes.js at /api/canvas: co-creation canvas save/load/update
- socialRoutes.js at /api/showcase: social gallery feed, like, report, milestones, family
- contentFilter.js: caption moderation keyword blocklist
- Canvas UI + Showcase UI in test harness
- Migration 016: legacy_capsules, capsule_designees, capsule_unlock_log, family_breath_weaves
- legacyVaultEngine.js: capsule creation, review, edit, lock (BIP39 encryption)
- capsuleUnlockEngine.js: unlock, recovery (two-person rule), available capsules
- ancestralBreathEngine.js: ancestral breath sessions from capsule data
- familyBreathWeave.js: composite family breathing patterns (2:3 floor enforced)
- legacyRoutes.js at /api/legacy: all legacy vault API endpoints
- RECOVERY_ENCRYPTION_KEY env var (separate from ART_ENCRYPTION_KEY)
- Dependencies: bip39
- Legacy Vault UI in test harness (create capsule + unlock flows)
- Migration 017: art_aggregations, family_constellations, encryption_key_audit tables
- artAggregationEngine.js: mandala generation, milestone checks, family constellations
- Milestone checks wired into onSessionComplete() (after art, before advancement)
- breathArtEngine.js decode() updated for multi-version encryption keys (getDecryptionKey)
- merchandiseRoutes.js at /api/merch: export, poster, crest (stub), verify endpoints
- scripts/rotateArtEncryption.js: standalone key rotation script (batch 100, audit logged)
- Aggregation art rendered at 1200x1200 (vs session art 800x800)
- Capstone seed = SHA-256 of ALL packetHashes chronologically — irreproducible
- Merchandise verify returns signed JWT (24h) — print partners never see raw wallets
- Gallery + poster UI in test harness (export button, poster generation, aggregation badges)
- Migration 018: tenants, family_memberships, family_invitations, family_patterns, family_messages, family_escalations, message_templates
- Default ASCEN tenant seeded + 19 message templates (warrior reassurance framework)
- tenantResolver.js: multi-tenancy middleware (JWT → header → subdomain → default ASCEN)
- familyUnitEngine.js: ABI System #14 — family creation, 3-gate progression, invitations
- familyIntelligence.js: ABI System #15 — pattern correlation, response rules, escalation
- familyRoutes.js at /api/family: unit CRUD, gates, invite, accept, patterns, messages, escalations
- sessionOrchestrator.js updated: family intelligence processing after art aggregation
- Family Intelligence reads ONLY structured metadata (zones, trajectories, engagement). NEVER raw biometrics.
- Cooldowns enforced per category. Daily cap: 3 messages/individual/24h. Patterns need 3+ observations.
- tenant_id nullable on users, session_completions, family_units (backward compatible)
- Family Management UI in test harness (create, invite, join, gates, patterns, messages, escalations)

## Do NOT Build Unless Assigned
- Screenshot protection (dummyArtEngine.js) — Session 10+
- Invisible watermark injection — Session 10+
- Display offset for clinical values — Session 10+
- Terra API wearable integration
- Frequent Flyer Scoring Engine
- Family Platform (18-section spec)

## Session Status Override
Contracts are live. verificationService is live. Do NOT redeploy.
Focus only on the task assigned in the session prompt.

## Key Files
- src/abi/sessionOrchestrator.js — spine, 14 systems, all lifecycle
- src/abi/breathProtocolAdapter.js — arc x track transformation
- src/abi/determineBreathParams.js — arrival baseline → ratio selection
- src/abi/buildSessionDataPacket.js — canonical hash for blockchain
- src/abi/lunoIntelligence.js — Luno API calls, voice tiers
- src/abi/axisEngine.js — AXIS ingest, refine, distribute
- src/abi/biometricResilience.js — BLE disconnect handling
- src/services/ns3Engine.js — NS3 scoring engine
- src/services/ns3AxisBridge.js — NS3 → AXIS bridge
- src/abi/breathArtEngine.js — deterministic breath art generator
- src/services/ipfsService.js — Pinata IPFS upload + AES-256
- src/assets/crowns/ — 5 sacred geometry crown SVGs
- src/blockchain/verificationService.js — all blockchain writes
- src/routes/abiRoutes.js — ABI endpoints
- src/routes/artRoutes.js — art gallery/decode/crown/intention API
- src/services/photoAbstractionService.js — 6x6 palette extraction
- src/routes/canvasRoutes.js — co-creation canvas save/load/update
- src/routes/socialRoutes.js — showcase feed/like/report
- src/services/contentFilter.js — caption moderation
- src/abi/legacyVaultEngine.js — capsule creation, review, edit, lock
- src/abi/capsuleUnlockEngine.js — unlock, recovery, available capsules
- src/abi/ancestralBreathEngine.js — ancestral breath sessions
- src/abi/familyBreathWeave.js — composite family breathing patterns
- src/routes/legacyRoutes.js — legacy vault API endpoints
- src/routes/axisRoutes.js — AXIS endpoints
- src/abi/artAggregationEngine.js — mandala + constellation generation
- src/routes/merchandiseRoutes.js — export, poster, verify endpoints
- scripts/rotateArtEncryption.js — key rotation script
- src/middleware/tenantResolver.js — multi-tenancy resolution
- src/abi/familyUnitEngine.js — family creation, gates, invitations
- src/abi/familyIntelligence.js — pattern correlation, response rules, escalation
- src/routes/familyRoutes.js — family API endpoints
- server.js — Express, route mounting, cron
- public/test.html — throwaway test harness

## BLE Devices
- Polar H10: ECG, gold standard, deviceConfidence = 1.0
- Kyto2935: PPG finger clip, deviceConfidence = 0.75
- Both use BLE HR Service UUID 0x180D
- Chrome only. Not iOS Safari.
- Disconnect mid-session: fall back to synthetic, do not crash.
- Pause biometric evaluation during somatic exercises.
