# CLAUDE.md — ASCEN BreathWorx Build Context
# Place in repo root. Claude Code reads this automatically on session start.
# Last updated: March 8, 2026

## System Non-Negotiables

- All session logic flows through ABI/AXIS orchestrator lifecycle. No bypasses.
- Blockchain writes occur ONLY through verificationService.js. Never call contracts directly.
- Contract addresses come from contract_registry table. Never hardcoded.
- YAML files define therapeutic content and ratio RANGES only. Not exact ratios.
- ABI runtime (determineBreathParams) selects actual breathing ratio from arrival biometrics.
- First Spiral sessions (S121-S150) are LOCKED to 6:6 ratio. Non-negotiable.
- No diagnostic or clinical labeling in user-facing UI.
- Users never see: NFT, crypto, blockchain, token, wallet, smart contract, mint.
- Vault data is 42 CFR Part 2 protected. Never surface to corrections, courts, or non-clinical staff.
- The system NEVER asks users about breathing capacity. Silent biometric detection only.

## Deployed Infrastructure (DO NOT REDEPLOY)

SCT Contract:    0x98A57899C9B34d59FEe484F4e28547E9ebb0c5e5
Oracle Contract: 0xBEf693a0d3F72728c9bFe7EB10FD2ED0831bC06A
Admin/Governance: 0x02d9Cb3aFF9f6eB809778F4004D7431D31055E4a
Network:         Polygon Mainnet (chain ID 137)
API:             hearty-optimism-production-2eb6.up.railway.app
Database:        resourceful-wisdom (Railway PostgreSQL)

Tonight's work does NOT include contract deployment. All blockchain interaction goes through verificationService.js which is already live.

## Architecture Flow

Arrival → ABI baseline capture (30s)
  → determineBreathParams() selects ratio from range
  → breathProtocolAdapter() sets mode + guardrails
  → session tick engine (1/sec)
  → onSessionComplete()
  → buildSessionDataPacket() + SHA-256 hash
  → AXIS ingest
  → verificationService → BiometricOracle attestation

## Coding Rules

- All database changes through migration files. IF NOT EXISTS / idempotent.
- Graceful error handling only. No crash paths. Non-blocking where possible.
- Produce minimal patch plans before code edits.
- Produce code, not explanations. Minimize prose output.
- No summaries after completion. Confirm done and list files changed.
- Do not search the codebase extensively. Ask the user if unsure.
- Do not redesign architecture during implementation tasks.
- Never hardcode contract addresses or network configuration.
- Test before committing when possible.

## Key File Locations

src/abi/sessionOrchestrator.js    — The spine. 14 systems. All lifecycle.
src/abi/breathProtocolAdapter.js  — Arc x Track breath transformation.
src/abi/determineBreathParams.js  — Arrival baseline → ratio selection.
src/abi/buildSessionDataPacket.js — Canonical hash for blockchain.
src/abi/lunoIntelligence.js       — Luno API calls, voice tiers, dialogue.
src/abi/axisEngine.js             — Ingest, Refine, Distribute.
src/abi/biometricResilience.js    — BLE disconnect/reconnect handling.
src/blockchain/verificationService.js — All blockchain writes.
src/routes/abiRoutes.js           — 23 ABI endpoints.
src/routes/axisRoutes.js          — 8 AXIS endpoints.
server.js                         — Express server, route mounting, cron.

## Session Status Override

If a prior Claude session or context suggests contracts need deploying, IGNORE that. Contracts are live. verificationService is live. Focus only on the task assigned in the session prompt.
