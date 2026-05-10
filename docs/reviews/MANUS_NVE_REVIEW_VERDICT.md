# Phase 3 Verdict — Manus NVE Delivery

**Date:** 2026-05-10
**Inputs:**
- Phase 1: [`MANUS_NVE_REVIEW_PHASE_1.md`](./MANUS_NVE_REVIEW_PHASE_1.md) — static review (sonnet-4.6 deep inspection + main-thread spot-checks)
- Phase 2: smoke test, May 10 1:49 PM — local harness, file://, mocked SSM/BioBridge/DepthEngine, real Manus NVE module
- Spec: `narrativeVisualsEngine_Build_Handoff_v3.md`

---

## Decision: **REFACTOR**

Not REWRITE. Not KEEP-as-is. The engine's architectural integrity holds and the centerpiece visual works at runtime, but two findings need to be addressed before NVE can be treated as production-ready and the bridge sprint can build against a stable contract.

---

## Rationale

### What Phase 2 confirmed about the engine

The `gap_reveal` smoke test is the highest-stakes signal in this whole review — it's the centerpiece S10 moment, the implementation's most architecturally complex flow, and the spot where the late-night audit was loudest about a defect that didn't exist. It passed cleanly:

- Freeze fired at 61ms (target <200ms)
- Resume fired at 6051ms (target 5500–7500ms)
- Particles froze visually, Luno paused drift, both resumed gently
- DepthEngine RAF was correctly cancelled and resumed
- Console output matched expected lifecycle

This validates two things that mattered for the verdict: (1) the snapshot/restore math is correct, and the late-night audit's claim that easing was inverted is dismissed by both static review and runtime; (2) the locked architectural principle — "biofeedback layer always wins, narrative visuals are objects within the underwater world" — is observable at runtime. The DepthEngine's `freeze`/`unfreeze` boundary is clean.

### What Phase 2 also confirmed about the standalone module

Test 2 hit `Uncaught ReferenceError: lerp is not defined` at module:246, deterministically across four invocations. This is exactly Phase 1 finding N1. The standalone file works inside the integrated HTML (where `lerp` is defined at HTML:435) but throws the moment any consumer imports it independently — which is what the local harness did, and what the bridge sprint will do for testing. Tests 3, 4, and 5 weren't executed because they share the same root dependency.

This is not an architectural defect. It's a missing utility. But it means the "engine is ready, bridge can build against it" framing from the late-night audit overstated the engine's portability.

### Phase 1 findings the smoke test did not directly exercise

Several Phase 1 concerns remain unverified at runtime:

- **N5 (live H10 path silently no-ops):** smoke test was mocked, not real H10. Cannot confirm whether coherence-driven particle behaviors lose live data. Verifying requires a real Polar H10 session, which the bridge sprint will provide naturally.
- **N7 (`gap_practice` flicker):** requires running through an S10 breathing phase with breath-sync events firing repeatedly. Local harness did not exercise this.
- **NS3 gate on `trigger_flash` (spec §7 line 673):** still missing. Crosses the NVE/ABI boundary and needs explicit integration-design scoping before lock.

These are reasonable to defer to the bridge sprint's hardware smoke test cycle, with the cleanup items below addressed first.

### Why not KEEP-with-cleanup-PR

A KEEP verdict would say "bridge can build in parallel with cleanup." Two things argue against that:

1. The lerp gap means the bridge sprint cannot meaningfully unit-test the engine in isolation until the standalone file is fixed. That's a 5-minute fix but it has to happen before bridge tests can run.
2. The NS3-gate clinical concern is not "cleanup" — it's an integration-design decision that crosses the NVE/ABI boundary. Whoever builds the bridge needs to know whether NS3 state arrives in the postMessage payload (bridge resolves it) or whether the engine reads NS3 from BioBridge directly. That decision should be locked before the engine is "production-ready."

### Why not REWRITE

The Decision Matrix in the handoff says "Blockers found → REWRITE," but the late-night audit's blocker list (`B2 easing inverted`) was the only entry that would have justified a rewrite, and it didn't survive verification. Everything else on Phase 1's list is mechanical — utility additions, switch cases, timer hygiene, naming. The architecture is sound, the locked principles are observed, and the centerpiece visual is correct. Rebuilding from spec would discard correct work.

---

## Cleanup Scope (Sequenced)

Two priority bands. **Band A must complete before NVE locks and the bridge sprint starts;** Band B can run in parallel with bridge work.

### Band A — must fix before lock

| # | Item | Phase 1 ref | Effort | Why band A |
|---|---|---|---|---|
| 1 | Add `lerp(a,b,t){return a+(b-a)*t}` at top of NVE module IIFE | N1 | <5 min | Unblocks all standalone testing including bridge unit tests |
| 2 | Add NS3 gate to `_triggerFlash` — engine reads `_bioBridge.getCurrentBiometrics().coherence`, suppresses fire if below regulation window | spec §7 / Phase 1 §4 | 15–30 min | Clinical safety. Crosses NVE/ABI boundary and needs the integration shape locked before bridge fires triggers. |
| 3 | Rename `getCurrentSample` → `getCurrentBiometrics` at module:1140 (or add `getCurrentSample` alias in BioBridge) | N5 | <5 min | Live H10 breath sync silently no-ops without this. The smoke test couldn't catch it because mocks were used. |

### Band B — parallel with bridge sprint

| # | Item | Phase 1 ref | Effort |
|---|---|---|---|
| 4 | Add `case 'anchor_set_bg'` to switch dispatcher | N2 | 10 min |
| 5 | Store bare timers in cancellable handles, clear from `reset()`: `_triggerFlash` 2500ms, `gap_installed` 500ms+3500ms, `_pulseAlignmentRings`, `_addAlignmentRing` | N4 / table §5 | 30–45 min |
| 6 | Clear `_breathSyncInterval` from `reset()` body | N3 | 5 min |
| 7 | Guard `_gapPracticeTimer` against overlapping schedules | N7 | 15 min |
| 8 | Fix `_blueprintCanvas._pulseRAF` capture-before-assign — move assignment inside `pulseDraw` after the RAF call | N6 | 10 min |
| 9 | Zero `_warmthAccumulated` and `_bgState.warmth` in `reset()` body | N8 | 5 min |
| 10 | postMessage origin allowlist + payload schema validation | N9 | 30–60 min |
| 11 | Module 7 → Module 9 header rename in standalone file (and reconcile HTML:2651 body comment) | spec deviations / Phase 1 §1 | <5 min |
| 12 | Add missing visuals to catalog + dispatcher: `middle_rung_glow`, `bottom_rung_dark`, `breath_gap_pulse`, `gap_persist` | spec §8 trigger map | per-visual scope |
| 13 | Sentry context tagging on `getState()` — current visual name + performance tier | spec §7 / Phase 1 §4 | 30 min |
| 14 | Add `_interpolateFrame` 60fps GPU loop separate from 500ms breath sync interval | spec §5 | larger — defer to bridge sprint scoping |

Band A is intentionally tight. Items 1–3 are the gates between "engine looks correct in isolation" and "engine is ready for the bridge to build against."

---

## Architectural Notes for the Bridge Sprint

These are not cleanup items — they're integration-design decisions the bridge author needs to know going in:

1. **The IIFE-vs-class shape difference.** Spec defines `class NarrativeVisualsEngine` with constructor element references. Manus delivered an IIFE that resolves elements via `document.getElementById` at trigger time. The IIFE matches v8.2 convention; this is correct. Spec should be updated to reflect implementation reality, not the other way around.

2. **NS3 gating is an NVE/ABI boundary question.** The clinical safety rule "trigger_flash does NOT fire if NS3 < window" can be enforced two ways: (a) bridge reads NS3 from ABI's StateEngine and suppresses the trigger before postMessage, or (b) engine reads NS3 from BioBridge and self-suppresses. Option (b) keeps the clinical rule local to the visual layer; option (a) keeps NVE pure (no clinical state awareness). Recommend (b) for keeping NVE self-contained — but lock this decision before Band A item #2 is implemented.

3. **postMessage payload schema is currently lenient.** The engine accepts any well-formed `NARRATIVE_VISUAL` message and falls through to `default: console.log('[NVE] Unknown visual')` for unknown names. The bridge should validate visual names against `VISUAL_PRIORITY_MAP` before sending — silent default is bad observability. Add a logged warning on unknown name to help bridge debug.

4. **Breath-phase event path vs 500ms interval path.** Two distinct routes feed `_onBreathFrame`: (a) `ssm.on('onBreathPhase')` at module:1151 fires on phase boundary with `phase` data only, (b) the 500ms interval at module:1138 fires with full biometric data. Path (a) works correctly today; path (b) silently no-ops because of N5. Coherence-driven visuals (`hrv_expand`, `refund_accumulate` per-exhale, `gap_practice` peak detection) will have degraded behavior until Band A item #3 lands.

5. **The standalone module file is the artifact, the integrated HTML is the deployment.** N1 (lerp) only matters because consumers import the standalone file. After Band A item #1, the standalone becomes self-contained and bridge unit tests can rely on it.

---

## What Happens Next

1. Open cleanup PR with Band A items (1, 2, 3). Single commit OK; three separate commits OK; whichever pattern fits the review cadence.
2. After Band A merges and a quick re-test confirms `depth_pulse` and the other particle visuals render without throwing, NVE locks as production-ready.
3. Band B items can be a follow-up cleanup PR, or interleaved with bridge sprint commits — the decision tree there is "does this block bridge testing for the next session being authored?" If yes, pull it forward; if no, defer.
4. The bridge sprint scope and timeline are not in this verdict's scope per Clay's note that v1.2's "1.5 weeks" was wishful — engineering scopes after the verdict.

---

## On the Manus question (workflow / external agent)

Per the handoff: "If verdict is KEEP with minor cleanup, Manus may stay in the workflow. If REFACTOR or REWRITE, Manus likely doesn't return."

The architectural quality of the delivery is genuinely good — the locked principles are observed, the IIFE pattern is the right choice for v8.2, the priority queue and phase mapping are well-structured, and the centerpiece visual works correctly at runtime. The defects cluster in two areas (timer hygiene + missing utility) that are characteristic of "wrote it, didn't unit-test it standalone" rather than fundamental misunderstanding. A second pass with a stronger test harness would likely have caught most of Band A and B before delivery.

That's a workflow data point, not a verdict input. Strategic call on Manus's role going forward stays with Clay.
