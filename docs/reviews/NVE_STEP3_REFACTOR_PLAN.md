# NVE Step-3 Refactor Plan — Definitive

**Status:** Plan only. No code changed by this document. Read-only reconciliation of three sources.
**Date:** 2026-06-10
**Author:** Claude (Opus 4.8), at Clay's direction.

## Sources reconciled
1. **Manus delivery** — `Downloads/AscenBreathWorx_v8.2_NVE_integrated.html` (4071 lines, 5/9/2026, **not in repo**) + the module, imported alone by commit `39573c7` into `public/modules/narrativeVisualsEngine.js`.
2. **Production** — `public/index_v8.html` / `index_v8_production.html` (MD5-identical): same VisualDNA + DepthEngine lineage as the integrated HTML, **minus** the DepthEngine NVE hooks, with the module **unwired**.
3. **Review** — `docs/reviews/MANUS_NVE_REVIEW_PHASE_1.md` + `MANUS_NVE_REVIEW_VERDICT.md` (verdict: **REFACTOR**; gap_reveal validated at runtime in the integrated HTML).

---

## FRAMING (read this first)

- **Items 1–3, 6, 7, 8, 10 are verdict-validated or already done.** The DepthEngine freeze/snapshot hooks are Manus's own, runtime-validated in a near-identical engine; Band A (lerp, NS3 gate, `getCurrentBiometrics`) is **already present in the committed module** (`lerp`@17, NS3 gate@526, `getCurrentBiometrics`@1155); Band B is verdict-listed cleanup.
- **Items 4 (water → own overlay) and 5 (cede plankton) are NOT backed by the REFACTOR verdict.** The verdict/Phase 1 **passed NVE on both behaviors** — Phase 1 §6 defined "biofeedback layer" as DepthEngine's *canvas `_drawLoop`* only, so NVE writing `oceanBg` and restyling `.particle` was never flagged. Items 4 and 5 are grounded in **CLAUDE.md's stricter locked separation rule** — *"biofeedback controls water state… NVE never sets water clarity, light, turbulence; HARD SEPARATION"* — which the review applied more loosely.

### Decision recorded
**HOLD the CLAUDE.md locked rule. Execute B (item 4) and C (item 5).**
- `storm_surface` / `warmth_layer` / `arc_complete_horizon` / `environment_settled` / `body_memory_glow` background-warmth visuals move to a **dedicated NVE overlay element `#nveBgOverlay`** (z between plankton z4 and Luno, `pointer-events:none`). NVE stops writing `oceanBg`.
- **VisualDNA retains SOLE ownership of the DOM `.particle` plankton** (creation `genPlankton`, ambient per-frame modulation). NVE stops continuously restyling `.particle`. The only sanctioned NVE touch of shared plankton is the **transient gap_reveal pause/resume** (whole-scene freeze, reversible) and **read-only** position sampling for blueprint lines.

---

## ADOPT / FIX / DISCARD (items 1–10)

| # | Component | Action | Basis | Risk |
|---|---|---|---|---|
| 1 | DepthEngine `freeze`/`unfreeze`/`getParticleSnapshot`/`restoreParticleSnapshot` (integrated HTML:1513–1567) | **ADOPT / PORT** into prod inlined DepthEngine (both HTML files); additive only — no `_drawLoop` body edit; merge into export list; drop 2 dead vars (`_frozenDepthRAF`, `_particleSnapshotData`) | Manus, runtime-validated (freeze@61ms/resume@6051ms) | **LOW** |
| 2 | NS3 gate on `_triggerFlash` | **CONFIRMED DONE** in committed module (`isInRegulationWindow` @526) | Verdict Band A #2 | none |
| 3 | `lerp` + `getCurrentBiometrics` | **CONFIRMED DONE** (`lerp`@17, `getCurrentBiometrics`@1155) | Verdict Band A #1/#3 | none |
| 4 | `_applyBgState` water write (`oceanBg.style.background`, module:246–270) | **FIX** → render on NVE-owned `#nveBgOverlay`; stop writing `oceanBg` | **Locked rule** (verdict silent) | **MED** |
| 5 | `_applyFieldState` + per-breath/pulse `.particle` restyle | **FIX** → cede DOM `.particle` to VisualDNA; NVE keeps own overlays + gap-freeze only (see deep-dive) | **Locked rule** (verdict silent) | **MED–HIGH** |
| 6 | Timer hygiene — bare timers, `reset()` clears, gap_practice guard, blueprint `_pulseRAF`, warmth zeroing | **ADOPT** | Verdict Band B 4–9 | LOW–MED |
| 7 | postMessage origin allowlist + schema; reduced-tier 500→1000ms; missing visuals | **ADOPT** | Verdict Band B 10/12, Phase 1 §4 | LOW–MED |
| 8 | Load + wire module (`<script src>` + `init`/`connectTo*`, behind a flag) | **ADOPT** wiring pattern | Manus HTML:3964–3982 | LOW |
| 9 | Swap production for the integrated HTML wholesale | **DISCARD** — port hooks/wiring from it; don't replace (it's a diverged 5/9 fork) | divergence | n/a |
| 10 | Dual-file identity | Apply ALL edits to **both** HTML files; re-verify MD5 equal | CLAUDE.md rule | LOW (mandatory) |

**Sequence:** 1 → (2,3 confirmed) → 4 → 5 → 6 → 7 → 8 → 10. Items 4 and 5 carry the risk and are the locked-rule work; everything else is adopt-from-Manus or already done.

---

## ITEM 5 DEEP-DIVE — Plankton-ownership boundary (the only MED–HIGH item)

NVE touches the shared DOM `.particle` plankton (owned/created by VisualDNA `genPlankton`, re-modulated every frame at `index_v8.html:660`) in **16 places**. Classification by behavior:

| Site (module line) | Effect on `.particle` | Type | Classify |
|---|---|---|---|
| `_drawBlueprintLines` 418–427 | READS positions → draws on its OWN canvas (z8) | read-only | **KEEP** (already own surface) |
| `_snapshotState` 155–164 | READS pos/opacity/animState into snapshot | read-only | **KEEP** (gap-freeze read) |
| `_freezeAll` 195–200 | `animationPlayState='paused'` | transient | **GAP-FREEZE-ONLY** (keep; reversible) |
| `_unfreezeAll` 226–227 | `animationPlayState='running'` | transient | **GAP-FREEZE-ONLY** (keep) |
| `_restoreState` 183–186 | `animationPlayState='running'` | transient | **GAP-FREEZE-ONLY** (keep) |
| `_applyFieldState` 272–364 | per-call restyle: opacity, `--speed`, animState, bg/boxShadow, `--dx/--dy`, triband, zoneDensity | **continuous** | **CEDE** — strip DOM writes; keep `_fieldState` bookkeeping so queue/getState semantics survive |
| `_cacheParticleColors` 367–377 | saves orig bg/shadow/speed/dx/dy | restyle support | **CEDE** (obsolete once restyle gone) |
| `_restoreParticleColors` 381–393 | restores orig | restyle support | **CEDE** (obsolete) |
| `_onBreathFrame` env_sync 589–609 | `--dx/--dy`/opacity per breath | **continuous** | **CEDE** (or C2 own layer) |
| `_onBreathFrame` ladder_climb 624–629 | `top` per exhale | **continuous** | **CEDE** (or C2) |
| `_onBreathFrame` anchor_deepen 634–640 | `top` per exhale | **continuous** | **CEDE** (or C2) |
| `_onBreathFrame` gap_practice 649–656 | pause/run at inhale peak | breath-driven pause | **CEDE for C1** (transient; keep only if own layer) |
| `_startHrvPulse` 705–712 | `transform:scale` pulse, all particles, ~every 600ms | **continuous** | **CEDE** (or C2) |
| `_triggerFlash` 531–558 | scatter: transition/left/top/opacity on ALL, then restore | one-shot hijack | **C2 own layer** (C1: drop/no-op) |
| `breath_thread` case 832–838 | one middle particle bg/boxShadow | one-shot single | **C2 own layer** (C1: drop) |
| `tax_erosion` case 907–915 | dim edge particles opacity | one-shot | **C2 own layer** (C1: drop) |

**Leverage point:** ~17 dispatch cases funnel through `_applyFieldState`. Neutralizing that one function (strip its DOM block, keep `_fieldState` state) silences the bulk of the continuous contention in a single surgical edit — no VisualDNA change required.

### The clean separation (target state)
- **VisualDNA:** sole owner of `.particle` — creation + every-frame ambient modulation. Unchanged.
- **NVE keeps (already clean / its own surfaces):** blueprint lines (own canvas z8, reads positions only), alignment rings (`#nve-position-ring` it appends to `.coh-rings`), background-warmth (new `#nveBgOverlay`, item 4).
- **NVE gap_reveal:** snapshot (read) → freeze (transient pause of shared plankton + DepthEngine canvas via ported hooks) → restore (resume). This is the one sanctioned, reversible touch of shared plankton, validated by the verdict as the centerpiece. *(Hardening option: replace the direct pause with a `VisualDNA.freezePlankton()`/`resumePlankton()` call so NVE never reaches into `.particle` even transiently — defer to C2.)*
- **NVE drops:** all continuous `.particle` restyle (`_applyFieldState` DOM block, `_onBreathFrame` drift/climb/sink, `_startHrvPulse`).

### C1 vs C2

**C1 — NVE keeps overlays + gap-freeze, drops per-frame plankton mutation. (RECOMMENDED for demo)**
- **Scope:** NVE-only. Strip `_applyFieldState` DOM writes (keep state); remove `_onBreathFrame` plankton drift/climb/sink + `_startHrvPulse` scale; delete obsolete `_cache/_restoreParticleColors`; make `_triggerFlash` scatter, `breath_thread`, `tax_erosion` no-op (or overlay-only). No VisualDNA edit, no new particle system.
- **Visual cost:** loses particle-FIELD choreography (depth_pulse erratic, ladder triband, anchor sink, hrv scale-pulse, environment_sync drift, trigger_flash scatter). NVE's visible output = blueprint lines + alignment ring + `#nveBgOverlay` warmth + **gap_reveal freeze (intact)**.
- **Risk:** **LOW–MED.** **Effort:** **MED** (surgical removals, one file).
- **Content dependency:** acceptable only if the foundation demo's authored `visual_narrative` doesn't lean on the dropped field beats. gap_reveal (S10 centerpiece) is preserved.

**C2 — NVE gets its own narrative-particle layer.**
- **Scope:** add an NVE-owned particle surface (`#nveParticleLayer` or NVE canvas, z between plankton z4 and Luno); re-author every field visual against it; VisualDNA keeps `.particle`; NVE freezes its own + DepthEngine canvas.
- **Benefit:** full narrative fidelity, true 3-sovereign-layer separation, no shared-plankton touch at all.
- **Risk:** **HIGH.** **Effort:** **HIGH** (new particle engine + re-author + re-tune all field visuals, larger locked-file diff, more to verify across 10 rehearsals).

### Recommendation
**Do C1 for the demo.** It removes the every-frame contention immediately with an NVE-only, well-bounded change, preserves the centerpiece gap_reveal and the overlay visuals, and is realistically hardenable to 10 clean rehearsals. **C2 is the correct long-term architecture** but is a HIGH-risk/HIGH-effort build that cannot be safely landed in a demo window — schedule it post-demo if particle-field choreography becomes a requirement.

---

## Content verification — S01–S21 authored visuals (addendum, 2026-06-11)

**S01–S10 (particle-centric):** the authored beats *are* the choreography C1 drops (anchor sink S04, foundation build S05, HRV rhythm/expand S08, tax→refund S09, trigger_flash + gap_practice S10). ~27 of ~39 S01–S10 visuals are C1-DROPPED; only the background/gap-centric S02 and S03 survive C1 intact. → If the demo session is somatic (S04/S05/S08/S09/S10) or "the full S01–S10 arc," **C1 guts it and C2 is required**; if the demo is background/gap-centric (S02/S03-style), C1 is fine.

**S11–S21 — CORRECTED finding (earlier "unauthored / UNIMPL" wording was wrong):**
- The `visual_narrative` **content EXISTS and is authored.** Blocks are present at: S11–S15 spec lines **183 / 403 / 627 / 850 / 1122**; S16–S30 spec lines **162 / 330 / 544 / 728 / 906 / 1077** (covering S16–S21). Additional authored visual content also exists in the **S41–S70 Visual Narrative Layer** file and the **S103–S150 Visual Narrative Patch**.
- The gap is **ENGINE-SIDE, not content-side.** The NVE module's `_dispatchVisual` switch implements render cases for the **S01–S10 vocabulary only (~40 handlers)**. S11+ visual names (`two_gears`, `archaeology_layers`, `loop_form`, `shame_weight`, `bridge_form`, …) have **no matching `case`** and fall through to `default: console.log('[NVE] Unknown visual')` (catalog + switch at module:756–763 / 795–1052).
- Therefore S11+ is **implementation-FROM-spec** — build render cases from the existing authored content — **not authoring.**
- This is **orthogonal to the C1/C2 plankton-ownership decision** and is **post-demo expansion**; it does not affect the demo path or the Step-3 refactor.

---

## Honest caveats
- Items 4–5 change a **locked file** (`narrativeVisualsEngine.js`) and the inlined DepthEngine — Plan Mode + verify-ascen + dual-file MD5 apply.
- C1 trades narrative richness for separation + stability. If the authored foundation `visual_narrative` requires field choreography, C1 will under-render those beats — confirm against the S01–S21 authored content before locking C1.
- This plan builds nothing. Execution is a separate, approved step.
