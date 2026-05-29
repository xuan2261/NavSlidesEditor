---
title: "PPTX Import Parser-Convention Fidelity Fixes — Deep TDD Plan"
description: "Fix 11 PPTX import fidelity bugs across 6 root causes, all stemming from mapper code written for pptxtojson 0.x (raw px / raw values) while the lib is now 2.0.2 (pt lengths, fractional filters, string gradient pos). Includes a real-parser regression fixture as the meta-fix."
status: completed
priority: P0
effort: "7-11 dev-days"
branch: master
tags: [pptx-import, fidelity, units, gradient, parser-drift, tdd, deep]
created: 2026-05-29
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
blockedBy: []
blocks: []
related_plans:
  - 260524-1729-pptx-import-review (complete — image loss, geometry drift, mapper split)
  - 260525-1450-pptx-import-unit-conversion-and-scale-fixes (implemented — INTRODUCED the 96/72 font bug this plan reverses; see Cross-Plan Note)
  - 260527-1131-pptx-import-real-browser-fidelity-fixes (complete — real-browser audit harness this plan reuses)
---

# PPTX Import Parser-Convention Fidelity Fixes

Fix 11 PPTX-import fidelity bugs (3 debug rounds, verified against current code). Meta-root-cause: mappers assume **pptxtojson 0.x** conventions (raw px, raw filter values, numeric gradient pos) but the lib is **2.0.2** (pt lengths, `/1e5` fractions, `"50%"` string pos). Unit tests stayed green because fixtures fabricated parser values matching the *old* assumptions, and the acceptance gate hard-codes the wrong invariant.

## Cross-Plan Note (verified reversal, not silent flip)

Plan `260525` is marked **implemented** and claims its `pt × 96/72` conversion fixed "text 33% too large". New evidence reverses it: `CANVAS_SIZE = 960×540` (`constants.js:10`) means the canvas is **72 DPI** (960px ÷ 13.333in), so **1pt = 1px** on canvas and box geometry already uses `scale = 960/960 = 1.0` (`geometry.js:25`). Multiplying font by `96/72` makes text 1.333× larger than its own box. `260525`'s synthetic tests had no explicit `font-size`, so the overflow path was never exercised. This is a new-data reversal per the verified-decision rule, backed by geometry + real decks — not an audit-only flip.

## Phases

| # | Title | Status | Priority | Effort | Depends on |
|---|---|---|---|---|---|
| 1 | TDD foundation + real-parser regression fixture | complete | P0 | 1.5d | — |
| 2 | R1 length-unit fix (font, table font, insets, acceptance gate) | complete | P0 | 2d | 1 |
| 3 | R2 image-filter fraction fix (brightness/contrast/saturation) | complete | P0 | 1d | 1 |
| 4 | R3 gradient parse + shape SVG render + angle | complete | P0 | 2d | 1 |
| 5 | R4 group affine double-rotation (shape + line) | complete | P1 | 1.5d | 1 |
| 6 | R5 chart stacked/area + diagram fit-meta + font scale | complete | P1 | 1.5d | 1,2 |
| 7 | R6 EMF/WMF browser-unsupported placeholder | complete | P2 | 0.5d | 1 |
| 8 | Integration verification + release gate | complete | P0 | 1d | 2,3,4,5,6,7 |

Total nominal: ~11 days. Phases 2,3,4,5,7 parallelizable after Phase 1. Phase 6 waits on Phase 2 (shared `utils-text.js` font helper). Phase 8 last.

## Dependency Graph

```
        ┌──────────────── 1 (fixture + honest gate) ───────────────┐
        ▼        ▼        ▼        ▼                    ▼           ▼
        2        3        4        5                    7           │
        │        │        │        │                    │           │
        └──► 6 ◄─┘        │        │                    │           │
             │            │        │                    │           │
             └────────────┴────────┴──► 8 (corpus + browser audit) ◄┘
```

## Bug → Root Cause → Phase Map (11 bugs)

| Bug | Symptom | Root cause | Phase |
|---|---|---|---|
| #1 text font +33% overflow | text larger than its box | R1: `parseCssLengthToPx` pt×96/72 vs box scale=1.0 | 2 |
| #5 table font +33%, no fit clamp | table cells overflow worse | R1: `map-table.js:111` `×96/72`, bypasses fit-meta | 2 |
| #G text insets +33% | padding too big | R1: `utils-text.js:157` `×96/72` | 2 |
| #F acceptance gate pins wrong invariant | fix would throw | R1: `acceptance-criteria.js:22` enforces `×96/72` | 2 |
| #2 image filter black/gray | corrected images break | R2: parser `/1e5` fraction vs mapper `/1000` | 3 |
| #3 gradient stops collapse to 0% | gradient → solid color | R3: `Number("50%") = NaN` | 4 |
| #4 shape gradient invalid paint | gradient shape mis-renders | R3: `fill="gradient"` literal; `fillGradient` dead | 4 |
| #8 gradient angle off ~90° | wrong gradient direction | R3: OOXML vs CSS angle reference | 4 |
| #7 group shape double-rotation | rotated shapes mis-placed/bloated | R4: AABB + re-applied rotate | 5 |
| #E group line double-rotation | rotated lines wrong | R4: same, line endpoints | 5 |
| #6 chart stacked/area → grouped | wrong data semantics | R5: `_pptxChartMeta.grouping` not consumed | 6 |
| #9 diagram font no scale, no fit-meta | diagram text overflow | R5: `map-diagram.js` skips fit-meta | 6 |
| #H EMF/WMF broken image | image missing | R6: browser can't render EMF/WMF | 7 |

(13 rows, 11 distinct bugs: R1 bundles #1/#5/#G/#F; R3 bundles #3/#4/#8; R4 bundles #7/#E.)

## Key Constraints

- TDD: every phase is Red → Green → Refactor with explicit verification.
- The Phase 1 fixture mirrors **real** pptxtojson@2.0.2 output shape (string `pos`, `/1e5` fractions, pt font); it is the regression lock against future parser-convention drift.
- Do not change global `parseCssLengthToPx` without auditing non-import callers (Phase 2 investigation step).
- No plan-artifact references in code/comments/test names (domain terms only).
- Files stay < 200 LOC; shared logic in `shared/`.

## Decisions (captured)

- **Shape gradient (#4):** render proper SVG `<linearGradient>` (consume `fillGradient`), not a solid-color fallback. Touches `shared/src/shapeUtils.js` + `client/src/components/canvas/element-renderers/shape-element-renderer.jsx`.
- **EMF/WMF (#H):** clear placeholder + warning this plan; rasterization deferred to a future plan.
- **Font scale axis (non-uniform decks):** use `scale.y` (height-proportional). Both 16:9 (960×540) and 4:3 (720×540) have height 540pt → `scale.y = 1.0`, so common decks get `font_px = font_pt`. Documented default.
- **R1 blast radius (added after verification):** `utils-base.js scaleLength` (`PT_TO_PX = 96/72`) also inflates **border width + shadow** (`map-image.js:37`, `extractShadow`), not just font/insets. Folded into Phase 2 scope. `shared-html-parser.js:2 PX_PER_PT` is intentionally **retained** (generic 96-DPI CSS converter, used outside import).

## Red-Team Findings (deep mode — resolved in phase files)

1. **Gradient angle formula was wrong (Phase 4).** Original plan hard-coded `cssAngle = 90 − ooxmlDeg`; both OOXML and CSS are clockwise with different zero-refs, so the correct candidate is `(θ+90)%360` (formulas agree only at 0/180, diverge at 90/270). Resolution: Phase 4 now **derives the mapping empirically** by render observation; tests anchor only on the agreed angles (0→90, 180→270) and pin the divergent ones to the observed value. Prevents locking a wrong invariant.
2. **Nested-group line under-correction (Phase 5).** Original line formula `rotate = child.rotate + inheritedRotate` double-applies ancestor rotation for nested lines (endpoints already carry full accumulated rotation via `groupMatrix`). Resolution: line `rotate = child.rotate` only; added a nested-line regression test. Shape formula confirmed correct (`+inheritedRotate+groupRotation`).
