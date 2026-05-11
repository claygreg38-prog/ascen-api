# Phase 1 Review — Manus NVE Delivery

**Review date:** 2026-05-09
**Files reviewed:**
- `narrativeVisualsEngine_module.js` (1,238 lines)
- `AscenBreathWorx_v8.2_NVE_integrated.html` (4,071 lines)
- Cross-referenced against `narrativeVisualsEngine_Build_Handoff_v3.md` (728 lines, authoritative spec)

**Method:** sonnet-4.6 deep inspection + main-thread spot-check of every consequential finding. The May 8 late-night audit was treated as informational; all claims re-verified independently.

**This document is Phase 1 only.** No verdict, no sprint estimate. Smoke test (Phase 2) and verdict (Phase 3) deferred to follow-up.

---

## TL;DR

The engine is architecturally compliant with the locked principles (no breathArtEngine / galleryHarmonics / userPersonalization touches; single Luno DOM instance preserved; biofeedback layer never overridden). The IIFE shape diverges from the spec's class-based API but matches the rest of v8.2's vanilla-JS pattern — that's an environment adaptation, not a defect.

The implementation has multiple legitimate timer-hygiene issues, one silent dispatch failure, one API mismatch that breaks live H10 breath sync, and several spec deviations that include a clinical safety gap. **None of the findings are truly blocking** — the centerpiece `gap_reveal` snapshot/restore math is correct (the late-night audit's most consequential alarm was a misreading of the easing formula).

Two findings the late-night audit missed are real and need fixing before bridge work can be trusted: the `lerp` undefined symbol in the standalone module file (portability), and the `anchor_set_bg` visual being registered but never dispatched (silent S04 failure).

---

## 1. Confirmed Findings (Match Late-Night Audit)

| Audit claim | Status | Evidence |
|---|---|---|
| Public API present: `init`, `trigger`, `reset`, `connectToStateMachine`, `connectToBiometricBridge`, `connectToDepthEngine`, `getState` | CONFIRMED | module:1227–1236 (`onBreathFrame` also exported, undocumented in audit) |
| 40+ named visuals with priority levels | CONFIRMED — count is **42** | module:24–69; all six priority levels (`ambient`/`atmosphere`/`narrative_subtle`/`narrative_active`/`breath_sync`/`signature_moment`) populated |
| `gap_reveal` snapshot/restore | CONFIRMED | `_snapshotState()` module:140–165, `_restoreState()` module:167–184 |
| Performance tier detection (full/reduced) | CONFIRMED | module:122–137 — uses `hardwareConcurrency`, `deviceMemory`, `screen.width` |
| postMessage interface | CONFIRMED | module:1188–1203 — handles `NARRATIVE_VISUAL` + `NARRATIVE_VISUAL_CLEAR` |
| Phase default behavior | CONFIRMED | module:1089–1128 — eight phases (`arrival`, `opening`, `resistance`, `before_the_breath`, `breathing`, `shift`, `close`, `vault`) |
| DepthEngine hooks (freeze/unfreeze/getParticleSnapshot/restoreParticleSnapshot) | CONFIRMED | HTML:1518, 1525, 1532, 1538 |
| Startup wiring | CONFIRMED | HTML:3964–3982 — `NVE.init()` followed by all three `connectTo*()` calls |
| `window.NVE` debug handle | CONFIRMED | HTML:3982 |
| Single `id="lunoCon"` in HTML | CONFIRMED | HTML:300 — one occurrence |
| NVE only references existing `#lunoCon` for pause/resume | CONFIRMED | module:200–205 (`_freezeAll`), module:223–228 (`_unfreezeAll`) — operates on existing `.luno` child element only |
| Zero `breathArt` references | CONFIRMED | grep: 0 hits in module |
| Zero `galleryHarmonics` references | CONFIRMED | grep: 0 hits in module |
| Zero `userPersonalization` references | CONFIRMED | grep: 0 hits in module |
| Module 7 vs Module 9 naming inconsistency | CONFIRMED + worse than reported | module:2 says "MODULE 7"; HTML:2649 section header says "MODULE 9"; HTML:2651 body comment reverts to "Module 7". Three different answers across two files. |
| ABI/AXIS routing — NVE has zero ABI/AXIS code paths | CONFIRMED + clean | NVE only consumes events from SSM (`onPhaseChange`, `onBreathPhase`, `onSessionReset`) and BioBridge — never writes session data, never calls ABI endpoints, never modifies biofeedback rendering. SSM/BioBridge route through ABI upstream, so NVE is correctly downstream. |

---

## 2. Late-Night Audit Claim That Did NOT Survive Independent Verification

**Claim (Map v1.2 audit + agent re-verification):** `restoreParticleSnapshot()` easing direction is inverted — particles snap to snapshot positions on frame 1, then animate back to where they currently are, "the opposite of restoration."

**Verdict: claim is WRONG. Math is correct.**

The formula at HTML:1550 is:
```javascript
_depthParticles[i].x = snapshot[i].x + (_depthParticles[i].x - snapshot[i].x) * eased;
```

Algebraically: `new = snap + (cur - snap) * eased = snap*(1-eased) + cur*eased = lerp(snap, cur, eased)`.

- At `eased = 0`: `new = snap` (constrained to snapshot)
- At `eased = 1`: `new = cur` (fully physics-driven)

Combined with `_depthRAF` resuming after unfreeze, the effect over 3 seconds is: particles begin physics-driven motion at the snapshot positions, with the easeStep loop continuously pulling them back toward snapshot — the pull weakens as `eased` grows from 0 toward 1, gradually releasing them into full physics. This matches the spec's "Resume rAF loops from snapshot state, not from recalculated positions" (spec:221) and "When it resumes, it's gentle — not a snap back, a slow thaw" (spec:226).

The misreading (both in the late-night audit and the sonnet-4.6 inspection pass) treated `cur` as "the position the particle should be eased away from." But in this codebase `cur` is the live, physics-mutating reference — the formula isn't easing FROM cur TO snap, it's blending between snapshot-constraint and physics-freedom over time.

**Implication for the verdict:** the centerpiece S10 visual moment is not broken. The late-night audit's strongest alarm doesn't hold.

---

## 3. New Findings (Audit Missed These)

### Issues that need fixing before the bridge sprint can rely on the engine

#### N1 — `lerp()` undefined in standalone module file
**Location:** `narrativeVisualsEngine_module.js:246`
**Evidence:** Standalone file uses `lerp()` at lines 246–248 and 253. The function is defined only in the integrated HTML at line 435. Grep of standalone file for `function lerp|var lerp` returns zero hits.
**Impact:** The standalone module file cannot be imported, unit-tested, or required in isolation. It will throw `ReferenceError: lerp is not defined` the first time `_applyBgState()` is called with a non-zero warmth value. All `background_warmth` shifts (`environment_settled`, `body_memory_glow`, `arc_complete_horizon`, `storm_surface`, `warmth_layer`) silently break in any consumer that is not the integrated HTML.
**Severity:** Real portability bug. NOT a runtime production bug because deployment goes through the integrated HTML where `lerp` exists. But it blocks any test harness or bridge work that imports the standalone file.
**Fix:** Add a 1-line `function lerp(a,b,t){return a+(b-a)*t}` at top of the IIFE. <5 minutes.

#### N2 — `anchor_set_bg` visual silently fails to dispatch
**Location:** `narrativeVisualsEngine_module.js:64` (catalog) + module:744 (`_getActiveLayer` bgVisuals list) + missing case in `_dispatchVisual` switch (module:782–1052)
**Evidence:** `anchor_set_bg` is registered in `VISUAL_PRIORITY_MAP` as `atmosphere` priority and listed in the `bgVisuals` array, but the `switch(name)` block has no `case 'anchor_set_bg'`. Triggering it falls through to `default: console.log('[NVE] Unknown visual: ...')`.
**Impact:** Spec's S04 trigger map (spec:696) lists this as a shift-moment visual. Will silently no-op in production. No error thrown, no Sentry alert.
**Severity:** Silent feature gap. Affects S04 only.
**Fix:** Add a switch case mirroring `anchor_descend_bg`/`storm_surface` patterns. ~10 minutes.

### Issues that increase technical debt but don't block the sprint

#### N3 — `_breathSyncInterval` not cleared by `reset()`
**Location:** module:1138 (creation, on phase=breathing), module:1147 (clear, on phase change AWAY from breathing), module:1063–1087 (`reset()` body — does NOT clear it)
**Impact:** If the session ends abnormally (connection drop, error path) without a phase-change event, the 500ms interval persists. `reset(fadeMs)` will not cancel it. Subsequent sessions could see leftover breath-sync ticks operating on stale `_breathPhase`/`_breathProgress` state.
**Severity:** Real interval leak under failure modes. Not normally observable.
**Fix:** Add `if (_breathSyncInterval) { clearInterval(_breathSyncInterval); _breathSyncInterval = null; }` to `reset()`.

#### N4 — `_triggerFlash` scatter timer is bare; `gap_installed` fires two bare timers
**Location:** module:539–545 (trigger_flash); module:970–971 (gap_installed)
**Evidence:** `setTimeout(function(){ ... }, 2500)` at 539, `setTimeout(function(){ _triggerFlash(); }, 500)` and `setTimeout(function(){ _gapReveal(...); }, 3500)` at 970–971. None stored in cancellable handles.
**Impact:** If `reset()` fires within 2500ms of trigger_flash, or within 3500ms of gap_installed, the bare callbacks still fire post-reset and re-mutate particle state. Worst case (gap_installed): a fresh ambient session gets randomly frozen by a leftover `_gapReveal()` 3.5s after the previous session ended.
**Severity:** Real, but only manifests on rapid trigger→reset sequences. Test harness will hit this readily; production session boundaries less so.
**Fix:** Store handles in module-level state, clear from `reset()`.

#### N5 — Live H10 breath-sync path silently no-ops (API name mismatch)
**Location:** module:1140 calls `_bioBridge.getCurrentSample()`. BioBridge's public API at HTML:1887 exports `getCurrentBiometrics`, not `getCurrentSample`. `getCurrentSample` is undefined anywhere in the file.
**Evidence:** Grep `function getCurrentSample` in HTML — zero hits.
**Impact:** The 500ms interval at module:1138 that is supposed to drive `_onBreathFrame` from live H10 data always reads `null` and never calls `_onBreathFrame()` with `bpm`/`coherence`. The breath-phase event path at module:1151 (via `ssm.on('onBreathPhase')`) still works, but coherence-driven particle behaviors (`hrv_expand`, `refund_accumulate` per-exhale increments, `gap_practice` peak detection) lose their live biometric input.
**Severity:** Clinical quality issue. Engine appears to function in any bench test that doesn't watch for coherence-driven particle response. Actual H10 sessions get degraded behavior.
**Fix:** One-line rename to `getCurrentBiometrics`, OR add `getCurrentSample` as a thin alias in BioBridge. Either is <5 minutes.

#### N6 — `_blueprintCanvas._pulseRAF` is captured before assignment
**Location:** module:471 (pulseRAF assigned inside pulseDraw), module:473 (canvas._pulseRAF = pulseRAF — captures undefined), module:481 (`_clearBlueprintLines` calls `cancelAnimationFrame(undefined)` → no-op)
**Mitigation found during verification:** `_clearBlueprintLines` at module:485–486 also nulls `_blueprintCtx`, and `pulseDraw` at module:458 returns early if `_blueprintCtx` is null. So the loop terminates within ~16ms of the next frame after clear, even though the explicit `cancelAnimationFrame` is broken. Not a true leak; a latent correctness bug masked by the early-return guard.
**Severity:** Style/maintenance — not a runtime defect today. Will become a real leak the moment someone refactors `_clearBlueprintLines` and removes the `_blueprintCtx = null` line.
**Fix:** Move `canvas._pulseRAF = pulseRAF` inside `pulseDraw` after the `requestAnimationFrame` call, or attach the cancel via `pulseRAF` directly in `_clearBlueprintLines` via a closure ref.

#### N7 — `gap_practice` handler fires overlapping setTimeouts on every breath-sync tick
**Location:** module:636–644 (inside `_onBreathFrame`)
**Evidence:** When `_breathPhase === 'hold'` or `_breathProgress > 0.92`, `_onBreathFrame` schedules a 400ms `setTimeout` to set particle animationPlayState back to running. Since `_onBreathFrame` is invoked every 500ms via `_breathSyncInterval` AND on every `onBreathPhase` event, the same condition can fire multiple overlapping 400ms timers within a single inhale-peak window.
**Severity:** Visible flicker risk during S10 `gap_practice` breathing phase. Concrete repro: two pause/run toggles arriving 100ms apart will cause CSS animationPlayState thrash.
**Fix:** Guard with a `_gapPracticeTimer` handle that clears any pending callback before scheduling a new one.

#### N8 — `_warmthAccumulated` and `_bgState.warmth` not cleared by `reset()`
**Location:** module:1063–1087 (`reset()` body); module:1156–1161 (`onSessionReset` clears `_warmthAccumulated` to zero)
**Impact:** If `reset(fadeMs)` is called mid-session for any reason other than `onSessionReset`, accumulated warmth stays in `_bgState.warmth`. Subsequent `trigger()` calls in the same session will compound warmth on top of stale state. The bg gets progressively too warm across reset boundaries.
**Severity:** Visual drift only. Test harnesses and edge cases more than production.
**Fix:** Add explicit warmth zeroing to `reset()` if intent is "return to ambient."

#### N9 — postMessage listener accepts any origin
**Location:** module:1189
**Evidence:** `window.addEventListener('message', function(e) { ... })` with no origin check on `e.origin`.
**Impact:** Any iframe or tab co-loaded with this page can call `NVE.trigger()` for arbitrary visuals or fire `NARRATIVE_VISUAL_CLEAR` to reset the engine. For an in-patient therapeutic platform this is an attack surface — a malicious co-tenant could drive the visual layer.
**Severity:** Real, but mitigated in practice if the iframe is same-origin and the page enforces CSP. Still, the spec's data contract (spec:65–87) implies validated session-orchestrator origin only.
**Fix:** Origin allowlist + payload schema validation.

---

## 4. Spec Deviations

| Spec section | Spec text | Implementation | Impact |
|---|---|---|---|
| §5 (line 472) | "Separate 60fps interpolation loop for smooth visuals (GPU only) — no DOM reads/writes — only CSS custom properties or transform matrix" | No `_interpolateFrame()` exists. Breath sync runs only at 500ms with no smooth between-tick interpolation. | Visual choppiness during long breathing phases. Spec called this an audit fix; not implemented. |
| §5B (line 495) | "Reduced tier: Breath sync DOM updates Every 1000ms" | Module uses 500ms regardless of `_performanceTier`. | Performance risk on CRC tablets. |
| §7 audit checklist (line 673) | "trigger_flash in S10 is gated by coaching system — does NOT fire if NS3 < window" | No NS3 gate in `trigger()` or `_triggerFlash()`. Fires unconditionally. | **Clinical safety gap.** The scatter shockwave should suppress when the user's NS3 is below the regulation window. |
| §7 audit checklist (line 668) | "Sentry context tagging includes current visual state name and performance tier" | No Sentry integration anywhere in the module. `getState()` returns state but is not wired to Sentry. | Operational observability gap. |
| §8 trigger map (lines 707–709) | `middle_rung_glow` (S07), `bottom_rung_dark` (S07), `breath_gap_pulse` (S03), `gap_persist` (S03) | Not registered in `VISUAL_PRIORITY_MAP`; no switch cases. | S03 and S07 will lose multiple beats. Same silent-default behavior as N2. |
| §8 trigger map (line 689) | `text_fade_line` / `text_hidden` / `text_visible` | Catalog has these but no switch implementation visible — text-handling code path needs verification. | Defer to smoke test. |
| Constructor signature (§API spec lines 116–168) | `class NarrativeVisualsEngine { constructor(particleSystem, backgroundLayer, alignmentIndicator, centerOrb) {...} }` | IIFE returning a flat object; no constructor; element references resolved via `document.getElementById` at trigger time. | Adaptation to the v8.2 vanilla-JS pattern. Acceptable deviation, but worth flagging because future spec revisions should match implementation reality. |
| §3A `gap_reveal` audit checklist | `connection_count: 8` max for blueprint_lines | module:425 hardcodes `var maxConnections = 8` | COMPLIANT. |

---

## 5. Timer / RAF / Listener Inventory

| Handle | Type | Created | Cleared | Status |
|---|---|---|---|---|
| `_breathSyncInterval` | setInterval(500ms) | module:1138 (phase=breathing) | module:1147 (phase change away) — NOT cleared by `reset()` | Leak under abnormal exit (N3) |
| `_pacerTimer` | setTimeout chain (100ms recursive) | module:670 (`_startPacerFallback`) | module:684 (`_stopPacerFallback`); called from `reset()`:1075 | Clean |
| `_hrvPulseInterval` | setTimeout chain | module:700 (`_startHrvPulse`) | module:707 (`_stopHrvPulse`); called from `reset()`:1074 | Clean |
| `_gapFreezeTimer` | setTimeout (`dur` ms) | module:557 (`_gapReveal`) | module:1079 (`reset()` clears + nulls) and on natural completion | Clean |
| `_blueprintCanvas._pulseRAF` | RAF chain | module:471 (`pulseDraw`) | module:481 attempt fails (captures undefined) — terminates via `_blueprintCtx = null` early-return | Latent — N6 |
| `restoreParticleSnapshot` ease RAF | RAF chain | HTML:1555 (anonymous closure) | Never cancelled — no module-level handle | Cannot be cancelled if `reset()` fires mid-restore |
| `_triggerFlash` scatter timer | setTimeout(2500ms) | module:539 (bare) | Never cancelled | Leak — N4 |
| `gap_installed` compound timers | 2 × setTimeout (500ms, 3500ms) | module:970–971 (bare) | Never cancelled | Leak — N4 |
| `_pulseAlignmentRings` restore | setTimeout(~800ms) | module:498 | Never cancelled | Minor |
| `_addAlignmentRing` opacity | setTimeout(100ms) | module:511 | Never cancelled | Negligible |
| postMessage listener | window event | module:1189 | Never removed | Permanent (intentional) |

Eight timers and one RAF chain bypass the `reset()` cancellation path. Most are short-lived and self-clear; the bare-timer pattern in N4 is the worst offender because the duration is long enough (2500ms / 3500ms) to outlive a session boundary.

---

## 6. Architectural Assessment

The NVE module is a competent first implementation that correctly stays within its architectural lane. It holds the locked principles cleanly: it never imports or references `breathArtEngine`, `galleryHarmonicsEngine`, or `userPersonalizationLayer`; it preserves the single `#lunoCon` instance and only manipulates the existing element's `animationPlayState`; it never overrides DepthEngine's biofeedback rendering, only adding new freeze/snapshot/restore methods alongside the existing `_drawLoop`; and it sits cleanly downstream of ABI by consuming SSM and BioBridge events without writing session data or invoking ABI endpoints. The IIFE shape is the correct adaptation to v8.2's vanilla-JS module pattern, even though the spec was written for a class-based React-style API.

The priority queue and phase-default-mapping logic are well-structured for the common case. Crossfade, queue-behind, and signature-moment-cancels-everything semantics are implemented at module:710–780 and align with the spec's rules. The `_snapshotState()` / `_restoreState()` pair is the right shape, and the centerpiece `gap_reveal` flow is correct end-to-end despite the late-night audit's alarm — physics resumes from the snapshot state and eases into full motion over the resume duration, exactly as spec'd.

The defects cluster in two areas: timer hygiene (six bare timers across `_triggerFlash`, `gap_installed`, `_pulseAlignmentRings`, `_addAlignmentRing`, plus the `_breathSyncInterval` not cleared by `reset()`) and content gaps (four spec-required visuals registered but never dispatched, plus three more not registered at all). Both categories are mechanical fixes, not architectural rework. The single clinical concern is the missing NS3 gate on `trigger_flash` (§7 audit checklist line 673) — a coaching-system integration that needs explicit scope before sprint kickoff because it crosses the NVE/ABI boundary.

The most consequential discovery in this review is that the late-night audit's strongest alarm — the `restoreParticleSnapshot` easing direction — is not a real defect. The math implements ease-in-cubic correctly. The signature S10 moment will play correctly on first hardware run, assuming the smoke test confirms freeze/unfreeze timing within the spec's ±100ms tolerance.
