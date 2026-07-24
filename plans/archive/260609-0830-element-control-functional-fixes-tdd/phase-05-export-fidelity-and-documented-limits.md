---
phase: 5
title: "Export Fidelity and Documented Limits"
status: completed
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 5: Export Fidelity and Documented Limits

## Overview
Close the fixable reveal-HTML export mapping gaps (image border, table merged
cells) and DOCUMENT the 6 inherent format limits without attempting workarounds.
Implements locked decision 5.

## Defects Addressed
- **P1-IMG-BORDER** — image border (color/width) honored in pptx
  (`export-pptx-basic-renderers.js:89-97`) but dropped in reveal `renderImage`
  (`shared/src/element-renderers.js:156-182`).
- **P1-TBL-MERGE** — table `mergedCells` dropped in reveal HTML — `renderTable`
  (`shared/src/element-renderers.js:374-432`) has no colspan/rowspan. (Canvas
  `table-element-renderer.jsx:44-58` AND pptx `addTableElement:216-230` both DO
  merge — so reveal parity is meaningful, audit assumption confirmed.)
- **Inherent limits (decision 5 + red-team B1 — DOCUMENT ONLY, do NOT fix):**
  pptx has no box-shadow, no image corner-radius, no CSS filters→pptx, no table
  rotation; **chart rotation (pptxgenjs `IChartOpts` has NO `rotate` field —
  verified — charts are graphicFrames, unrotatable; moved here from Phase 1 per
  B1)**; game + html-iframe are live-only. These are format ceilings.

## Requirements
- Functional: image with border renders that border in reveal HTML export
  (share link, offline, PDF). Table with merged cells renders colspan/rowspan in
  reveal HTML matching the canvas. Inherent limits are documented in `./docs` so
  users know what is lost on pptx export.
- Non-functional: reveal output stays valid HTML; no regression to existing
  reveal render tests; DRY with canvas merge semantics.

## Architecture
- **Image border (reveal):** in `renderImage`, read `borderColor`/`borderWidth`
  and emit matching CSS border (mirror what canvas + pptx do). Compose with
  existing border-radius if present.
- **Table merge (reveal) — extract a shared resolver, don't triplicate (red-team
  m5):** merge resolution already exists TWICE — canvas
  `table-element-renderer.jsx:44-58` and pptx `addTableElement:216-230`. Adding a
  third copy in reveal `renderTable` invites drift. Extract a pure
  `resolveMergedCells(mergedCells, rows, cols)` → `{ spans, covered }` into
  `shared/` and have all three consume it. reveal emits `colspan`/`rowspan` from
  `spans` and skips `covered` cells.
- **Docs (decision 5 + B1):** add a "Known export limitations" section to `./docs`
  listing the inherent limits with reason: pptx no box-shadow, no image
  corner-radius, no CSS filters, no table rotation, **no chart rotation
  (`IChartOpts` has no `rotate`; charts are graphicFrames)**; game + html-iframe
  live-only. Distinguish from the fixed mapping gaps.

## Related Code Files
- Create: `shared/src/table-merge-resolver.js` (pure `resolveMergedCells`) + test
- Modify: `shared/src/element-renderers.js` (renderImage border ~156-182; renderTable consume resolver ~374-432)
- Modify (consume shared resolver): `client/src/components/canvas/element-renderers/table-element-renderer.jsx` (~44-58), `client/src/utils/export-pptx-basic-renderers.js` (~216-230)
- Modify: `./docs/system-architecture.md` (or create `./docs/export-fidelity-and-limits.md`)
- Create: `shared/tests/reveal-export-fidelity.test.js` (or co-locate)

## Implementation Steps (TDD)
1. **Test first (image border reveal):** `renderImage` for an image with
   `borderColor:'#f00', borderWidth:2` → output HTML/CSS includes that border.
   Implement; green. Test compose with border-radius.
2. **Test first (shared resolver, m5):** `resolveMergedCells` for a (0,0)-spans-2-cols
   fixture → `spans` has `{r:0,c:0,colspan:2}`, `covered` has `(0,1)`. Implement
   pure resolver; green.
3. **Test first (table merge reveal):** `renderTable` consuming the resolver →
   output has `colspan="2"` and the covered cell omitted. Implement; green.
4. **Parity (m5):** point canvas + pptx merge at the shared resolver too; assert
   all three agree on the same fixture (no drift). Run their existing suites.
5. **Docs (decision 5 + B1):** write "Known export limitations" — inherent limits
   incl. chart rotation (with the `IChartOpts`-no-`rotate` reason); cross-link the
   fixed mapping gaps as resolved. NO workaround code.
6. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] Image border renders in reveal HTML export
- [ ] `resolveMergedCells` extracted to `shared/`, consumed by reveal + canvas + pptx (no triplication)
- [ ] Table merged cells render colspan/rowspan in reveal, parity with canvas + pptx
- [ ] Inherent limits (incl. chart rotation per B1) documented in `./docs`; no workaround code
- [ ] Existing reveal/pptx/canvas table tests still green; lint clean

## Risk Assessment
- **Risk:** table merge logic drift between canvas and reveal. **Mitigation:**
  shared resolver or parity test against the same fixture (step 3).
- **Risk:** scope creep into "fixing" inherent limits. **Mitigation:** decision 5
  — document only; explicitly out of scope.
- **Risk:** border CSS conflicts with border-radius clipping. **Mitigation:**
  compose test (step 1).
