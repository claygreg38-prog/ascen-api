# CLAUDE.md — ASCEN BreathWorx
# Updated: March 13, 2026

## Rules
- All logic flows through ABI orchestrator. No bypasses.
- Blockchain writes ONLY through verificationService.js.
- Contract addresses from contract_registry table. Never hardcoded.
- ABI selects breath ratios at runtime. YAMLs define ranges only.
- First Spiral (S121-S150) LOCKED to 6:6.
- Users never see: NFT, crypto, blockchain, token, wallet, mint.
- Silent biometric detection only. Never ask about breathing capacity.
- Produce code, not explanations. List files changed. No summaries.
- Do not search codebase extensively. Ask user if unsure.

## Deployed (DO NOT REDEPLOY)
- SCT: 0x98A57899C9B34d59FEe484F4e28547E9ebb0c5e5
- Oracle: 0xBEf693a0d3F72728c9bFe7EB10FD2ED0831bC06A
- Network: Polygon Mainnet (137)
- API: hearty-optimism-production-2eb6.up.railway.app
- DB: resourceful-wisdom (Railway PostgreSQL)
- ABI 14/14, AXIS active, verificationService live
- Migration 011 done. FR YAMLs re-seeded. Test harness at /test.

## Do NOT Build Unless Assigned
- ns3Engine.js / ns3AxisBridge.js
- Facilitator Protocol (somatic reset, personalized closes)
- onSomaticComplete() lifecycle method
- personalized_closes or somatic_exercises tables

## Key Files
- src/abi/sessionOrchestrator.js — spine
- src/abi/breathProtocolAdapter.js — arc x track
- src/abi/determineBreathParams.js — ratio selection
- src/abi/lunoIntelligence.js — Luno
- src/abi/axisEngine.js — AXIS
- src/blockchain/verificationService.js — blockchain
- public/test.html — throwaway test harness
