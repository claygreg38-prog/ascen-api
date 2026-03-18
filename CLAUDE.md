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
- src/routes/axisRoutes.js — AXIS endpoints
- server.js — Express, route mounting, cron
- public/test.html — throwaway test harness

## BLE Devices
- Polar H10: ECG, gold standard, deviceConfidence = 1.0
- Kyto2935: PPG finger clip, deviceConfidence = 0.75
- Both use BLE HR Service UUID 0x180D
- Chrome only. Not iOS Safari.
- Disconnect mid-session: fall back to synthetic, do not crash.
- Pause biometric evaluation during somatic exercises.
