# Scope & Complexity Critic — Plan Review (HOSTILE)

**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Role:** Scope & Complexity Critic (red-team)  
**Date:** 2026-07-09  
**Verdict:** **FAIL — rewrite scope before cook**  
**Findings:** 5 (max). All blockers for “ship full SLA in one plan.”

---

## Executive attack

This plan sells a **PowerPoint clone import stack** (OOXML scene graph + native charts + SmartArt + EMF + masters/themes/animations + hybrid round-trip + SSIM 0.99) as an 8-phase TDD track with **5–12d chart/SmartArt slices** and a **12–24 week** envelope. That is not optimistic — it is **calendar fraud**. Existing product already has a working mapper, locked corpus baselines, golden snapshots, and **intentional** degrade paths (chart→shape, diagram→flatten shapes, EMF→placeholder). The plan treats those as “bugs to clear in a sprint” without an MVP cut line or a migration strategy for the test/schema surface it will detonate.

Prior red-team (`red-team-and-validation.md`) only waved “effort fantasy” as **Low** severity. That is how this plan got a conditional pass. Reverse that ranking.

---

## Finding 1 — CRITICAL: Calendar understated; Phases 05–06 are multi-month products, not 5–12d tickets

### Claim under attack

| Source | Claim |
|--------|--------|
| `plan.md:6` | `effort: "12-24 dev-weeks"` |
| `plan.md:93-96` | Phase 05 charts **5–12d**, Phase 06 SmartArt **5–12d** |
| `phase-05-native-editable-charts.md:6` | `effort: "5-12d"` — full OOXML chart XML + embeddings + editable model + SSIM ≥ 0.97 |
| `phase-06-native-editable-smartart.md:6` | `effort: "5-12d"` — diagram data/layout/drawing + editable structure + SSIM ≥ 0.98 |

### Evidence of real gap

- Corpus today treats chart decks as **shapes only**, not charts:

```125:141:server/services/pptx-import/corpus-baseline.json
    "chart-bars-lines.pptx": {
      "semanticFidelity": 1,
      "roundTripStability": 1,
      ...
        "sourceByType": {
          "shape": 2
        },
        "navByType": {
          "shape": 2
        }
```

- Same for SmartArt fixture: **18 shapes**, zero diagram elements (`corpus-baseline.json:161-177`).
- Mapper already has a chart path, but only when **pptxtojson emits `type: 'chart'`** — and corpus proves real chart PPTX often never hits that path (`map-presentation.js:26-38`). Phase 05 requires a **new OOXML chart parser + xlsx embedding path** (`phase-05:19-38`) — that is ECMA-376 chart space, not a mapper tweak.
- Phase 06 prefers a **new `diagram` element type** (`phase-06:21-41`) while `ELEMENT_DEFAULTS` has **no `diagram` key** (`client/src/data/element-defaults.js:7-93` has `chart` but no diagram). Golden master freezes diagram → **shape flatten**:

```3:31:server/services/pptx-import/__snapshots__/mapper-golden-master.test.js.snap
exports[`pptx mapper golden masters > maps diagram deterministically 1`] = `
[
  {
    ...
    "type": "shape",
    ...
    "text": "Node",
```

- SmartArt layouts are a combinatorial layout engine problem. Plan’s “mitigation” is “process/list first; others fail strict” (`phase-06:92`) while simultaneously demanding **`smartArtCoverageGapCount === 0` on corpus** (`phase-06:15`, `plan.md:123`). Those two sentences cannot both be true unless corpus SmartArt is only process/list — **not proven**.

### Why 12–24 weeks is still understated

Sum of phase guide days (`plan.md:89-96`): **36–78 calendar work-days** ≈ 7–16 weeks **if** estimates are honest and serial. Plan then pads to 12–24 weeks — still treating charts/SmartArt/masters as ordinary features.

Honest ranges for Option B “editable 1:1”:

| Workstream | Honest solo-dev range |
|------------|----------------------|
| Visual oracle + CI LO | 2–4 weeks (flakes, fonts, viewport) |
| OOXML scene graph inventory | 3–6 weeks (namespaces, groups, masters stubs) |
| Native charts (data + visual + editor) | **2–4 months** |
| Native SmartArt (even subset) | **2–4 months** |
| Master/layout/theme + animation + hybrid export | **2–4 months** |
| EMF/WMF conversion ops | 1–3 weeks |

**Total realistic envelope for full SLA row (`plan.md:98`, `plan.md:111`): 6–12+ months**, not 12–24 weeks. Plan risk register admits “Multi-month effort” (`plan.md:203`) then still ships 5–12d phase labels. Incoherent.

### Required plan rewrite

- Split Phase 05 into: **05a chart inventory+data**, **05b Chart.js visual**, **05c exotic types matrix** — each with independent ship criteria.
- Split Phase 06 into **layout allowlist** with explicit non-zero gap until each layout lands.
- Replace frontmatter effort with **months**, or cut SLA.

---

## Finding 2 — CRITICAL: Phase 08 is unimplementable as one phase; dependency graph is wrong

### Claim under attack

```1:9:plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd/phase-08-master-layout-theme-animation-and-roundtrip.md
phase: 8
title: "Master layout theme animation and roundtrip"
effort: "8-16d"
dependencies: [4, 5, 6, 7]
```

Phase 08 **single phase** owns: full master/layout placeholder inheritance, theme fonts/colors, transitions, animations, macro/OLE classification, **hybrid original-part re-export**, dirty tracking, raise round-trip 0.70→0.90+, **mean SSIM ≥ 0.99**, and composite `test:pptx:sla-1to1` (`phase-08:19-29`, `phase-08:59-69`).

### Why this cannot land

1. **Four product surfaces in one gate.** Layout inheritance ≠ animation timeline ≠ zip part-reuse export ≠ 0.99 SSIM. Plan itself mumbles “split 08a/08b/08c if needed” (`phase-08:107`) — so authors already know 08 is a grab-bag. Do not ship grab-bag as cook phase.
2. **Export hybrid does not exist.** Grep of `server/services/pptx-exporter.js` shows **no** master/layout/theme/animation/dirty/round-trip part reuse hooks today. Phase 08 invents a second exporter architecture (`phase-08:37-43`) in 8–16d after 4–7 complete — fantasy sequencing.
3. **Wrong dependency fan-in.** Layout/theme work does **not** need EMF conversion (Phase 07) or full SmartArt (Phase 06) to start. Forcing `dependencies: [4,5,6,7]` (`phase-08:7`, `plan.md:96`) **serializes unrelated work** and guarantees critical path = sum of everything.
4. **Phase 04 already steals “minimal layout placeholder”** (`phase-04:23-24`) then Phase 08 “full” — no boundary test for what “minimal” vs “full” means; cook will thrash the same files twice.
5. **SSIM 0.99 as hard claim** (`plan.md:111`, `phase-08:69`) after admitting font/AA ceiling risk (`phase-08:103`) with only “amend frontmatter” as escape — that is not a phase; it is a research program.

### Required plan rewrite

- Kill Phase 08 monolith → **08-layout-theme**, **09-animation-MVP**, **10-roundtrip-policy**, **11-SLA-claim-gate**.
- Allow layout/theme to depend on **03 + partial 04 only**.
- Cap animation to a **fixed allowlist** with permanent classified debt — not “unmapped → strict debt list” while still claiming full SLA (`phase-08:23`).

---

## Finding 3 — CRITICAL: Cook-from-Phase-01 stalls; no MVP cut line for user value

### Claim under attack

- `plan.md:246`: “Start at **Phase 01** only”
- `plan.md:89-91`: Phase 01–02 foundation before any fidelity map work
- `plan.md:203`: mitigation “partial product value after 01–04”
- User SLA locked as **all-or-nothing** (`plan.md:32-34`, `plan.md:98`)

### Stall chain

| Phase | User-visible import quality | Cook output |
|-------|----------------------------|-------------|
| 01 | **None** — sidecar `original.pptx` + SLA constants | Storage/API plumbing (`phase-01:15`, `phase-01:20-29`) |
| 02 | **None** — oracle **records fail baseline** (`phase-02:15`, `phase-02:84`) | New CLI + LO dependency + Playwright capture |
| 03 | **None** — inventory truth; content still pptxtojson (`phase-03:46-47`) | Dual pipeline + strict fail on unmapped |
| 04 | First possible primitives win | Only after 02 **and** 03 (`phase-04:7`) |

So `/ck:cook` from Phase 01 burns **≥2–4 weeks** (plan’s own 01+02+03 min days: 2+3+5=10d optimistic) before a single slide looks better. Phase 04 further **blocks primitives on the oracle** (`dependencies: [2, 3]` at `phase-04:7`) even though theme/color sanitize does not need SSIM machinery.

### No MVP cut line

- Success criteria whole plan: “All 8 phases” + “Full SLA row green” (`plan.md:227-228`).
- Progressive thresholds table (`plan.md:104-111`) is **CI ratchet**, not product ship points (no “release note / user story / feature flag ship”).
- One buried sentence “partial product value after 01–04” (`plan.md:203`) is not a cut line: no definition of what users can rely on, what remains fail, or whether charts stay degraded without failing marketing “1:1”.
- Phase 06 is **P1** (`plan.md:95`) yet **required** for full claim (`plan.md:98`, E3 at `plan.md:123`). Priority labels lie.

### YAGNI: dual truth pipeline

Phase 03 adds full scene graph **and** keeps pptxtojson for content (`phase-03:46-47`, `phase-03:107`). That is a **second importer** until “later phases move fields.” Cook will maintain two models for months. Inventory-only could extend `ooxml-inspection.js` (already chart/SmartArt evidence at `ooxml-inspection.js:53-99`) without a 5–10d scene-graph package tree (`phase-03:50-54`).

### Required plan rewrite

- Define **MVP-0 ship** (e.g. original.pptx + no silent chart drop **or** primitives SSIM 0.95) as **releaseable product**, not intermediate debt.
- Reorder cook: **fidelity-first path** (chart gap on known fixtures / EMF convert) may start without Phase 02 LO CI.
- Decouple Phase 04 from Phase 02; oracle is a gate, not a prerequisite for mapper edits.
- Delete dual-pipeline “later” — either replace pptxtojson per type in the same phase that claims E1, or keep pptxtojson and stop calling graph “source of truth.”

---

## Finding 4 — HIGH: Schema / baseline / golden detonation — plan ignores locked suite

### Claim under attack

- Risk register: “Schema explosion → Prefer extend existing types” (`plan.md:206`) — hand-wave only.
- Phase 04: “Golden master snapshots updated intentionally” (`phase-04:49`, T4.7).
- Phase 05–06 change element class inventory without baseline migration plan.

### Concrete conflicts (will break G0/G1 on first real chart/diagram fix)

1. **Corpus baseline locks chart decks as shape:2** (`corpus-baseline.json:125-158`). Mapping to `type: 'chart'` flips `navByType` while **source** still comes from pptxtojson class counts — strict class-drop gates (`corpus-baseline.test.js:7`, `74-85`) and per-deck floors will fire until baseline + semantic scorer rewritten **together**.
2. **Round-trip floor locked at 0.99** in baseline (`corpus-baseline.json:8`, `corpus-baseline.test.js:69`) while plan narrative claims round-trip **70%** (`plan.md:67`) and Phase 08 “raises floor from 0.50” (`plan.md:125`). **Plan baseline evidence contradicts checked-in baseline.** Cook cannot reconcile SLA R1 with G1 without a deliberate baseline policy rewrite — plan never owns that as a phase task.
3. **EMF tests encode placeholder as correct behavior:**

```37:48:server/services/pptx-import/mapper/map-image.js
  if (media.unsupportedBrowserImage) {
    // ... Rasterization is a future plan.
    return [placeholder(
      ...
      'unsupported-image',
      'EMF/WMF not supported'
    )]
```

   `map-image.test.js:169-183` asserts `importPlaceholderType === 'unsupported-image'`. Phase 07 forbids that success path (`phase-07:25-26`) — must rewrite tests + semantic tester special-case (`pptx-import-semantic-and-roundtrip-fidelity-tester.js:348-352` treats unsupported-image as image retention).
4. **Diagram golden + flatten** (`map-presentation.js:25`, `map-diagram.js:38` `type: 'shape'`, snapshot above). Phase 06 “editable structure” invalidates golden and any client that expects flat shapes.
5. **New presentation schema fields** (`pptxOriginal`, sceneGraph stats, `_pptxSource`, dirty hashes, optional `diagram` type) span storage, client HomePage, element-defaults count guard (`Claude.md` element count rules), export — plan lists them as drive-by touches (`plan.md:139-152`) without schema versioning or migration tests.

### Required plan rewrite

- Add explicit **“Baseline & golden migration”** work item before Phase 05/06 claim E2/E3.
- Resolve plan vs `corpus-baseline.json` round-trip contradiction **in plan.md** with measured re-run numbers.
- Forbid new canonical element types unless MVP requires them; prefer `_pptxDiagram` sidecar on groups (`phase-06:41` already offers this — make it **mandatory** default, not optional).

---

## Finding 5 — HIGH: npm script / gate surface explosion; YAGNI on tooling before product

### Claim under attack

New scripts demanded:

| Script | Where |
|--------|--------|
| `test:pptx:oracle` | `plan.md:219`, `phase-02:20` |
| `test:pptx:sla-1to1` | `plan.md:222`, `phase-08:29` |
| milestone flags | `phase-04:87`, `phase-05:87`, `phase-06:83`, `phase-08:95` |

### Existing surface already thick

```51:55:package.json
    "test:corpus": "node server/services/pptx-import/pptx-import-corpus-cli.js --roundtrip --strict",
    "test:pptx:browser-audit": "node scripts/run-pptx-browser-audit.js --strict --scope=smoke",
    "test:pptx:browser-audit:headed": "node scripts/run-pptx-browser-audit.js --strict --scope=full --headed",
    "test:pptx:browser-audit:full": "node scripts/run-pptx-browser-audit.js --strict --scope=full",
    "test:pptx:strict": "npm run test:corpus && npm run test:pptx:browser-audit",
```

Plus G0 vitest path, corpus CLI, browser audit, semantic tester, acceptance-criteria, ooxml-inspection — plan stacks **oracle CLI module tree**, baseline JSON, Playwright capture, LO install CI, `PPTX_ORACLE`, `PPTX_SLA_STRICT`, `PPTX_ALLOW_EMF_PLACEHOLDER` (`phase-02`, `phase-03:25`, `phase-07:40`).

### Why this is complexity debt

- Phase 02 is **P0 sequential** before primitives (`plan.md:90`, `phase-04:7`) but produces **no import quality** — only measurement of failure.
- Browser audit **already** screenshots import results (`test:pptx:browser-audit*`). Oracle should **extend one CLI**, not invent parallel `server/services/pptx-import/oracle/**` package (`phase-02:52-57`) and a third “strict” composite.
- Five pptx npm scripts today → plan adds ≥2 more + milestone args. CI matrix grows LO image size (`plan.md:236` open question still unresolved) while cook is told to start Phase 01 immediately (`plan.md:83`, `plan.md:246`).

### Required plan rewrite

- **One** fidelity entrypoint: e.g. extend `test:pptx:strict` with optional `--oracle` / `--sla`; kill separate `sla-1to1` until Phase claim week.
- Defer LO-required CI to after first **user-visible** milestone (MVP), not Phase 02 blocking cook.
- Cap new env flags to ≤2 (`PPTX_SLA_STRICT`, oracle on/off).

---

## Cross-cutting YAGNI ledger (not separate findings)

| Plan invents | Already exists / cheaper |
|--------------|---------------------------|
| `ooxml-scene-graph/**` package | Extend `ooxml-inspection.js` |
| New `diagram` element type | Flatten + `_pptxDiagram` sidecar (golden already shape) |
| Expand chart model when Chart.js insufficient (`phase-05:15`) | Data-preserving chart + documented visual debt |
| Hybrid original-part export (`phase-08`) | Keep original.pptx download (Phase 01 alone) as zero-loss; re-export fidelity separate product |
| Permanent placeholder ban as universal law | Class-scoped allowlist with product signed carve-outs **before** cook |

---

## Dependency graph (as planned) — critical path

```text
01 ──► 02 ──┐
 │          ├──► 04 ──► 05 ──┐
 └──► 03 ───┘         06 ──┼──► 08 (monolith SLA claim)
                    07 ──┘
```

- Critical path ≈ 01+02+03+04+05+08 (or 06 if longer) — **no parallel escape for SLA claim**.
- Cook start at 01 maximizes time-to-value.
- Phase 08 fan-in maximizes schedule risk.

---

## Required amendments before `/ck:cook` (planner must do)

1. **Rewrite effort:** months, not 5–12d for charts/SmartArt; frontmatter 12–24w → honest range or cut scope.
2. **Define MVP cut line** with user-visible ship (what works / what fails / what marketing may claim). Full SLA = **Plan v2** or multi-quarter roadmap, not one cook.
3. **Explode Phase 08**; fix deps so layout/theme ≠ wait on EMF/SmartArt.
4. **Own golden/baseline migration** as sequenced work; fix 70% vs 0.99 contradiction with a fresh measured corpus run written into plan.
5. **Collapse tooling:** one gate script family; do not block mapper work on LO oracle.

---

## Verdict

| Dimension | Score |
|-----------|-------|
| Scope honesty | **F** |
| Phase sizing | **F** |
| Dependency graph | **D** |
| MVP / user value sequencing | **F** |
| Test/schema coexistence | **D** |
| Tooling YAGNI | **D** |
| Prior red-team severity ranking | **Rejected** (effort was Low; should be Critical) |

**Do not cook this plan as written.** Conditional-pass in `plan.md:21` and `red-team-and-validation.md:20` is unsafe for implementation agents — they will thrash Phase 01–03 for weeks, then die on charts/SmartArt/08 with detonated goldens and no shippable user story.

---

## Unresolved questions (planner)

1. Is product willing to ship **partial** import fidelity (e.g. primitives + original.pptx) under non-“1:1” marketing, or is all-or-nothing non-negotiable?
2. Which chart types and SmartArt layouts are **must-have for v1**? Name them; delete “gap count === 0 on entire corpus” until allowlist complete.
3. Re-measure corpus round-trip today and publish number that matches either plan (70%) or `corpus-baseline.json` (0.99) — which is truth?
4. Is LibreOffice CI image approved for required jobs before any code (open Q at `plan.md:236`)?
5. Can zero-loss be **only** original.pptx download (Phase 01) without native chart/SmartArt in the same plan?

---

*Critic: scope/complexity only. No code changes. Evidence from plan files + `server/services/pptx-import/**` + `package.json` + `client/src/data/element-defaults.js` as of 2026-07-09.*
