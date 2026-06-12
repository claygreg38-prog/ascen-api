# NVE Production-Wiring Prerequisite

**Status:** SPEC — design only. No wiring code in this document.
**Date:** 2026-06-11
**Scope:** Establish the *routing decision* and the wiring design that must be
agreed **before** the Narrative Visuals Engine (NVE) is connected into the live
session UI (`index_v8`). Wiring itself is a separate, reviewed change.

**Hard constraints carried from the C2 work:**
- `public/modules/narrativeVisualsEngine.js` is a **locked file** (modification
  requires Plan Mode + verify-ascen).
- `public/index_v8.html` and `public/index_v8_production.html` are under the
  **dual-file rule** — every edit must land in both, byte-identical.
- **Two-layer separation (locked):** biofeedback controls water state; NVE
  controls objects/events *within* the water. NVE never sets water clarity,
  light, or turbulence.

---

## 0. Prerequisite-of-the-prerequisite (blocker)

This spec assumes the NVE C2 engine + intensity/floor layer has landed on
`main`. **As of writing it has NOT** — `origin/main` is at `d998054` and none of
the four C2 commits (`0642ba9` engine, `032a806` harness, `47d1adc` step-3a,
`b216b1c` intensity/floor) are ancestors of `main`. The wiring follow-up cannot
begin until that engine line is merged. Resolve the merge first.

---

## 1. THE ROUTING QUESTION (resolve before any wiring design)

> **Does NVE attach to the session through the ABI orchestrator / AXIS, or via
> the same `connectToStateMachine(SSM)` browser-event-bus path DepthEngine and
> Dialogue use?**

### 1.1 Established answer: the SSM path bypasses ABI/AXIS today

Investigated in code (citations are current as of the C2 branch):

- **Phase is decided in the browser SSM**, autonomously, by timers and session
  milestones — `public/index_v8.html` `PHASE_ORDER` (~753), `_setPhase()` (~811)
  which fires `_ssmEmit('onPhaseChange', phase)` (~816), advanced by
  `advancePhase()` (~839–853).
- **DepthEngine, SessionUI, Dialogue, Integration** all bind directly to that
  browser bus via `*.connectToStateMachine(SSM)` (`index_v8.html` ~3239–3248).
  This is a **browser-only event bus** — it does **not** traverse the backend.
- **The backend ABI orchestrator is NOT in that phase-signal path.**
  `src/abi/sessionOrchestrator.js` keeps a `sessionPhase` that **mirrors** the
  browser (set when the browser reports lifecycle); it never *originates* or
  *pushes* phase to the client. The ABI tick response
  (`src/routes/abiRoutes.js` ~624–640) returns `coherence`, `ns3`, `events[]`,
  `drifting_word`, ratio fields — **no `phase`, no `intensity`, no visual
  directive**. ABI event types today (`abiRoutes.js` ~118–163): `luno_speak`,
  `pacer_update`, `pacer_pause/resume`, `session_end`, `mirror_data`,
  `offer_exit`, `offer_drill`, `identity_challenge`, `state_change` — none carry
  phase/visual/intensity.
- **AXIS (`src/axis/axisEngine.js`) is NOT in the real-time tick/phase path.**
  Its only runtime touchpoints are a non-blocking `ingestSessionData` at **session
  close** (`sessionOrchestrator.js` ~1936), the nightly refinement cron
  (`server.js` ~893, gated by `ENABLE_AXIS_CRON`), and clinician/admin analytics
  routes (`axisRoutes.js`). The `'AXIS: active'` boot line (`server.js` ~881) is a
  **static banner string** = mounted/available, **not** a runtime path indicator
  and **not** computed (the same banner reads `21/21` while `/health` reads
  `14/14`). AXIS has no per-tick or per-phase control and never carries
  phase/visual/intensity to the browser. "Through ABI/AXIS" in real time therefore
  means **through ABI**; AXIS participates only as an optional offline baseline
  source (see §1.4).
- **A dormant browser channel already exists:** NVE listens for
  `window.postMessage({type:'NARRATIVE_VISUAL', payload})` and
  `NARRATIVE_VISUAL_CLEAR` (`narrativeVisualsEngine.js` ~1436/1505). **Nothing
  posts these today** — it is unused plumbing, browser-only.

**Conclusion:** `connectToStateMachine(SSM)` is **not** the ABI-sanctioned entry.
It binds the browser event bus and goes **around** ABI/AXIS. Per the PRIMARY
DIRECTIVE ("all flows through ABI/AXIS, no bypasses"), **NVE must not replicate
this bypass.**

### 1.2 The orchestrated path (REQUIRED design)

The directive's own phrasing is the target: *the SSM phase reaches the visual
layer **via** the ABI orchestrator — not read around it.* Design:

```
 browser SSM _setPhase(phase)
      │  (1) phase-change notification → ABI   [extend ABI: new input]
      ▼
 ABI orchestrator (src/abi)  ── owns phase context + NS3/coherence + regulation-window
      │  (2) decides the presence directive (phase→intensity, floor, NS3 gate)
      │      emits a NEW event in the existing events[] stream
      ▼
 ABI tick/lifecycle response → events[]  (abiRoutes drainEvents)
      │  (3) AbiService._processEvents() routes by event.type   (index_v8 ~2741–2743)
      ▼
 bridge callback posts window.postMessage({type:'NARRATIVE_VISUAL'|'NVE_INTENSITY', payload})
      │  (4) same-window post (origin-checked)
      ▼
 NVE postMessage listener → eases intensity / triggers visual   (narrativeVisualsEngine.js ~1436)
```

This reuses **two existing mechanisms** rather than inventing transport:
- ABI's `events[]` → `AbiService._processEvents` callback dispatch (already the
  way `luno_speak`, `pacer_*`, etc. reach the browser).
- NVE's dormant `NARRATIVE_VISUAL` postMessage listener (built for exactly this).

**ABI extension required (the directive's "extend ABI" clause):**
1. **Input leg** — ensure ABI is told of *every* phase transition, not just
   breathing. Today `sessionPhase` mirrors the browser only at specific lifecycle
   points; add an explicit lightweight notification (new
   `POST /api/abi/session/phase {session_key, phase}` **or** piggyback the phase
   onto the existing lifecycle calls) so ABI has the authoritative phase as input.
2. **Decision** — ABI resolves the presence directive. Recommended split:
   ABI emits the **phase label + a regulation flag** (it owns NS3 /
   `isInRegulationWindow`), and NVE keeps the `PHASE_INTENSITY` map + the
   `BIOFEEDBACK_MIN_OPACITY` floor **locally** as the single tunable translation
   table. This keeps the presentation constants in one on-device-tunable place
   (the module) while ABI remains the *authority that decides when/what fires*
   and supplies the biometric gate. (Alternative: ABI emits the resolved numeric
   `intensity_target` and the map moves server-side — see §5 Q3.)
3. **Output leg** — new event type, e.g.:
   ```json
   { "type": "nve_directive",
     "data": { "kind": "phase_intensity",
               "phase": "before_the_breath",
               "intensity_target": 0.85,        // optional if NVE maps locally
               "ease_ms": 700,
               "regulation_ok": true } }
   ```
   Registered in the orchestrator callback set (`abiRoutes.js` ~118–163) and
   drained into `events[]`.

**NVE keeps SSM only for the non-phase mechanics it legitimately needs:**
`onBreathPhase` (breath-frame coupling for `environment_sync`), `onSessionStart`,
`onSessionReset`. These are biometric/lifecycle signals, **not** the presence
decision. The intensity ease currently triggered inside `_applyPhaseDefaults`
(on SSM `onPhaseChange`) becomes the **offline fallback only** — gated so that
when an ABI directive is the source of truth, ABI drives intensity and the
SSM-phase ease does not double-drive it (see §5 Q2 for the fallback threshold).

### 1.3 Why not just make ABI the phase authority outright?

Rejected as out of scope and high-risk: moving phase *origination* from the
browser SSM to ABI would break deterministic phase timing and add a network
dependency to the core session clock. The directive is satisfied by routing the
**presence decision** through ABI (SSM phase as *input* to ABI, ABI as the
*emitter* to NVE) — not by relocating the session clock.

### 1.4 AXIS hook (note only)

AXIS is not in the real-time path (§1.1), so it does not carry per-phase
intensity. Future, optional: AXIS trajectory (e.g. high panic-rate history) could
set a per-session **intensity ceiling / floor baseline** delivered to ABI at
session start, which ABI then
folds into its directive. Not required for first wiring.

---

## 2. Exact wiring point in `index_v8` (+ dual-file rule)

All edits below land **identically in both** `public/index_v8.html` **and**
`public/index_v8_production.html`; verify byte-identical after (`cmp -s` / equal
`git hash-object`).

1. **Load the module.** Add `<script src="modules/narrativeVisualsEngine.js"></script>`
   alongside the other module includes. (Today `index_v8.html` has **zero**
   references to NVE.)
2. **Init + non-phase connects**, in the init sequence next to the existing
   `*.connectToStateMachine(SSM)` block (~3239–3257):
   - `NarrativeVisualsEngine.init();`
   - `NarrativeVisualsEngine.connectToDepthEngine(DepthEngine);` — required so
     `gap_reveal` freeze/restore stays coordinated with DepthEngine's RAF.
   - `NarrativeVisualsEngine.connectToBiometricBridge(BioBridge);`
   - `NarrativeVisualsEngine.connectToStateMachine(SSM);` — **for `onBreathPhase`
     / `onSessionStart` / `onSessionReset` only**; its phase→intensity ease runs
     as the offline fallback (see §1.2 / §5 Q2).
3. **The orchestrated bridge (the point of this spec).** Register an ABI event
   handler that forwards directives to NVE via the existing postMessage channel:
   `AbiService.on('nve_directive', fn)` where `fn` posts
   `window.postMessage({type:'NARRATIVE_VISUAL'|'NVE_INTENSITY', payload}, window.location.origin)`.
   This is the leg that makes the signal flow **through ABI**.
4. **Z-order / layer check.** NVE creates `#nveCanvas` (z5) and `#nveBgOverlay`
   (z2) inside `#immersiveView`. Confirm z5 sits **above** `depthCanvas` (z0) and
   `ocean-bg` (z1) but **below** Luno (`#lunoCon` z10) and dialogue (z20), so the
   field reads as objects within the water, behind primary content. Re-assert the
   two-layer lock: NVE must not touch water clarity/light/turbulence.

---

## 3. Pattern this establishes for DepthEngine / Dialogue (note — do NOT migrate now)

Once the ABI→`events[]`→`_processEvents`→postMessage directive channel exists,
it is the **general orchestrated path** for any browser visual/narrative module.
DepthEngine (coherence/depth) and Dialogue (phase-driven text) currently bypass
ABI via `connectToStateMachine(SSM)` and could **later** migrate onto ABI
directives — removing the remaining bypasses and centralizing
phase/visual authority in ABI. **This is explicitly out of scope here.** Each
migration is its own reviewed change with its own regression surface; NVE goes
first precisely because it is not yet wired and carries no production runtime
today. Recorded as the intended direction, not an action item.

---

## 4. On-device tuning step (follows wiring)

After wiring is merged and verified, tune on the **real** `index_v8` session —
**not** the harness (the harness field is a flat mock background):

- Run at real session brightness in **PGC-CRC room lighting**, behind **real
  dialogue text + the real DepthEngine gradient** (surface-sunny → deep-dark).
- Tune `PHASE_INTENSITY` (per-phase presence) and `BIOFEEDBACK_MIN_OPACITY`
  (the legibility floor). Starting placeholders from C2:
  `arrival/opening/resistance 0.25, close 0.30, before_the_breath 0.85,
  breathing 0.90, shift 0.80, gap_reveal 1.0`; `BIOFEEDBACK_MIN_OPACITY = 0.35`.
- If the map stays in NVE (recommended, §1.2), tuning edits module constants
  (locked-file path: Plan Mode + verify-ascen); if moved server-side, tune ABI.
- **Report back:** which layers actually needed the floor, and the final tuned
  constant values.

---

## 5. Open questions / risks

1. **Does ABI already receive every phase transition, or only breathing?**
   Determines whether the input leg (§1.2.1) is a small notification add or a
   broader lifecycle change. Confirm against `sessionOrchestrator.js` set-points
   for `sessionPhase` and which `/api/abi/session/*` calls report phase.
2. **Latency / offline fallback.** The ABI round-trip adds latency vs. the
   instant browser bus. Define a threshold: if no `nve_directive` arrives within
   ~N ms of a phase change (or the device is offline), NVE falls back to the
   local SSM-phase → `PHASE_INTENSITY` ease. The 700 ms ease masks normal
   latency; specify N and ensure the fallback can't double-drive intensity.
3. **Constant ownership.** Map + floor in NVE (on-device tunable, no backend
   redeploy, single source — recommended) vs. resolved server-side in ABI (fully
   orchestrated, but tuning needs a deploy). Decide before wiring.
4. **Biofeedback-floor authority.** ABI owns NS3 / `isInRegulationWindow` (already
   gates `trigger_flash`/`gap_reveal` in NVE). Decide whether ABI should also
   drive/raise the floor and centralize the NS3 gate, or the floor stays purely
   client-side.
5. **postMessage origin / embedding.** NVE currently listens with `'*'`. Specify
   an origin check (`window.location.origin`) and **confirm whether `index_v8`
   runs standalone or inside an iframe** — that determines whether directives
   arrive same-window (via `AbiService`) or cross-frame (parent → child), which
   changes where the bridge in §2.3 lives.
6. **Z-order & dual-file parity.** Verify the z5/z2 placement against live
   `index_v8` stacking, and re-confirm byte-identical dual files after edits.
7. **Performance on device.** NVE field RAF + DepthEngine RAF co-running behind
   real content — validate the frame budget on the actual PGC-CRC hardware
   (harness validated logic, not real-device cost).
8. **Review gates.** NVE module edits = Plan Mode + verify-ascen (locked file);
   `index_v8` edits = dual-file rule + production review discipline
   (cf. `docs/reviews/` Manus Phase 1/2/3 precedent). Wiring ships as its own
   reviewed change, separate from this spec.
9. **Engine not yet on main (§0).** Wiring cannot start until the C2 engine line
   is merged.

---

## Appendix — key citations

| Concern | File | Lines |
|---|---|---|
| Browser SSM phase authority | `public/index_v8.html` | ~753 (PHASE_ORDER), ~811 (`_setPhase`), ~839–853 (`advancePhase`) |
| Direct-bus consumers (the bypass) | `public/index_v8.html` | ~3239–3248 (`*.connectToStateMachine(SSM)`) |
| AbiService transport + event dispatch | `public/index_v8.html` | ~2740–2757 (`_req`, `_processEvents`), ~2839 (tick apply) |
| ABI tick response shape | `src/routes/abiRoutes.js` | ~428, ~624–640 |
| ABI event types (no phase/visual) | `src/routes/abiRoutes.js` | ~118–163 |
| Orchestrator phase mirrors browser | `src/abi/sessionOrchestrator.js` | ~135, 495, 558 |
| AXIS not in real-time path (session-end ingest + cron + clinician routes) | `src/abi/sessionOrchestrator.js` ~1936, `server.js` ~881/~893, `src/axis/axisEngine.js`, `src/routes/axisRoutes.js` | — |
| NVE SSM connection + phase→intensity | `public/modules/narrativeVisualsEngine.js` | `connectToStateMachine`, `_applyPhaseDefaults`, `PHASE_INTENSITY` |
| NVE dormant postMessage channel | `public/modules/narrativeVisualsEngine.js` | ~1436 (`NARRATIVE_VISUAL` listener) |

*Line numbers reference the C2 engine branch; confirm offsets after the engine
merges to main.*
