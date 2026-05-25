---
phase: 7
title: "Mapper split (10 sub-modules, move-in-place)"
status: complete
priority: P1
effort: "5d"
dependencies: [2, 3, 4, 5, 6]
---

# Phase 7 — Mapper Split (10 Sub-Modules, Move-in-Place)

`mapper.js` = 999 LOC violates 200-LOC rule. Split via incremental move-in-place — each extraction is a 40-line diff, runs full test suite, then proceeds. Refactor LAST after all behavior fixes (Phases 2-6) so golden masters are stable.

## Context Links

- Brainstorm: P0-A
- Research: `plans/260524-1729-pptx-import-review/research/researcher-260524-tdd-refactor.md` sections 2, 3, 8
- Source: `server/services/pptx-import/mapper.js` (999 LOC)

## Overview

- Priority: P1
- Current status: Complete
- Brief: Apply move-in-place strategy. **Ten** sub-extractions (group split pre-emptively into group + diagram per red-team verification that range 654-862 = 209 LOC exceeds 180-LOC budget); each preserves `require('./mapper')` callers via re-export. After final extraction, rename `mapper.js` -> `mapper/index.js`. Total: ~870 LOC across 10 files, each <= 180 LOC.

## Key Insights (from research + red-team)

- Only TWO callers of `./mapper`: `importer.js:4` and `pptx-import-semantic-and-roundtrip-fidelity-tester.js:13`. URL stable until final rename.
- Circular dep risk: `mapElement` dispatches and `flattenGroupElement` recursively calls `mapElement`. Break via dependency injection — pass `mapElement` as parameter into group/diagram flatteners.
- Mutable `context` MUST be passed by reference. NO `{ ...context }` spread in extracted files. **Red-team finding:** mapper.js currently has `{...context}` spreads at lines 691 and 746. These existing spreads must be REMOVED (or fixed in place) during Step 8 extraction, not preserved.
- `uuidv4 = () => require('node:crypto').randomUUID()` MUST be inlined per file that uses it (5 files). Do not centralize.
- Exports contract at `mapper.js:992-999` is `{ mapPptxOutput, sanitizeHtml, mapVideo, mapAudio, extractShadow, mapMath }` — barrel `mapper/index.js` must re-export all 6.
- **Red-team verified:** Step 8 range mapper.js:654-862 = **209 LOC** actual (group + diagram + flatten helpers). Splitting pre-emptively to `map-group.js` (group only) + `map-diagram.js` (diagram + connectors) keeps each ≤ 130 LOC and avoids late discovery of overflow.

## File Inventory

| Step | Extract to | Functions | Est LOC |
|------|-----------|-----------|---------|
| 1 | `mapper/utils-color.js` | `colorValue`, `normalizeGradientStops`, `gradientBackground`, `svgAttr`, `arrowMarker` | ~50 |
| 2 | `mapper/utils-text.js` | `plainText`, `normalizeFontSize`, `normalizeFontFamily`, `buildBaseTextStyle`, `applyTextStyle`, `extractTextMetadata`, `extractTextInsets` | ~80 |
| 3 | `mapper/utils-base.js` | `baseElement`, `shapeName`, `warning`, `extractShadow`, `placeholder` | ~70 |
| 4 | `mapper/map-shape.js` | `mapShape` | ~80 |
| 5 | `mapper/map-image.js` | `mapImage` | ~90 |
| 6 | `mapper/map-table.js` | `mapTable` (incl. Phase 4 per-cell border parsing) | ~140 |
| 7 | `mapper/map-media.js` | `mapVideo`, `mapAudio`, `mapMath` | ~90 |
| 8a | `mapper/map-group.js` | `flattenGroupElement`, `buildGroupMatrix`, `MAX_GROUP_DEPTH` | ~110 |
| 8b | `mapper/map-diagram.js` | `flattenDiagramElement` (+ connector detection helpers) | ~100 |
| 9 | `mapper/map-presentation.js` | `mapPptxOutput`, `mapElement` | ~130 |
| Final | `mapper/index.js` | Barrel re-export | ~15 |

Total new files: 10 + barrel. Delete `mapper.js` after step 9. **Pre-emptive group/diagram split addresses red-team finding that mapper.js:654-862 = 209 LOC overflows the 180-LOC budget.**

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `mapper.test.js` (1508 LOC) | Eventually split, NOT during steps | At Step 9, slice into per-file tests; do NOT delete from `mapper.test.js` until per-file equivalent green |
| `mapper-golden-master.test.js` | Should NOT change | If snapshot diff appears, refactor broke behavior — STOP |
| `geometry-drift.test.js` | Verify still green | |
| `group-transform.test.js` | Critical — verify after Step 8 (group extraction) | |
| `property-mapping.test.js` (245 LOC) | Verify still green | |
| `roundtrip-matching.test.js` (155 LOC) | Verify still green | |

New tests: per-file co-located tests added during slice step.

## Function/Interface Checklist

### Step 8 critical: Dependency injection for group flattening (split into 8a + 8b)

```js
// mapper/map-group.js
async function flattenGroupElement(group, context, mapElementFn, depth = 0) {
  // ...
  const mappedChildren = await mapElementFn(transformedChild, childContext)
}
module.exports = { flattenGroupElement, buildGroupMatrix, MAX_GROUP_DEPTH }
```

```js
// mapper/map-diagram.js
async function flattenDiagramElement(diagram, context, mapElementFn) {
  // Note: context.zIndex += 1 mutation at original line 793 is load-bearing — preserve.
}
module.exports = { flattenDiagramElement }
```

```js
// mapper/map-presentation.js
const { flattenGroupElement } = require('./map-group')
const { flattenDiagramElement } = require('./map-diagram')
const { mapShape } = require('./map-shape')
const { mapImage } = require('./map-image')
// ... etc

async function mapElement(element, context) {
  if (element.type === 'group') return flattenGroupElement(element, context, mapElement)
  if (isDiagram(element)) return flattenDiagramElement(element, context, mapElement)
  if (element.type === 'shape') return mapShape(element, context)
  // ... etc
}
```

**Removing existing `{...context}` spreads:** mapper.js currently spreads `context` at lines 691 and 746. Step 8a extraction must remove these (preserve by reference) — the spread breaks the mutable-stat-accumulation invariant the rest of the file depends on.

### Final barrel `mapper/index.js`
```js
const { mapPptxOutput } = require('./map-presentation')
const { mapVideo, mapAudio, mapMath } = require('./map-media')
const { extractShadow } = require('./utils-base')
const { sanitizeHtml } = require('../sanitize')  // existing re-export pattern
module.exports = { mapPptxOutput, sanitizeHtml, mapVideo, mapAudio, extractShadow, mapMath }
```

### `uuidv4` per-file
Files that need it: `map-image.js`, `map-media.js`, `map-presentation.js`, `map-group.js`, `utils-base.js` (5 of 10). Inline:
```js
const uuidv4 = () => require('node:crypto').randomUUID()
```

## Dependency Map

- Blocks: Phase 9 (acceptance gate)
- Blocked by: Phases 2, 3, 4, 5, 6 (all behavior fixes must land first — re-baselining snapshots after refactor is dangerous)

## Tests Before (Characterization Gate)

- [x] Confirm `npm test` green at start of Phase 7
- [x] Confirm `mapper-golden-master.test.js` snapshots all green (post Phase 2-6 re-baselining)
- [x] Confirm `npm run test:corpus` >= 98% / 99% with re-baselined `corpus-baseline.json`
- [x] Take final snapshot of `mapper.test.js` test outputs — these are the regression bar

## Refactor / Implement

For EACH of 10 steps, in sequence:

- [x] Step N: create `mapper/<name>.js` with extracted functions
- [x] Add re-export in `mapper.js`: `const m = require('./mapper/<name>'); module.exports.<fn> = m.<fn>`
- [x] Verify no circular dep: `node -e "require('./server/services/pptx-import/mapper/index.js')"`
- [x] Run `npm test` — green
- [x] Run `npm run test:corpus` after Step 4 (map-shape), Step 6 (map-table), Step 8a (map-group), Step 8b (map-diagram) — corpus is slow ~2 min, run only at high-risk steps
- [x] Co-locate test file: `mapper/<name>.test.js` with unit tests imported from `./<name>.js` directly
- [x] Remove extracted block from `mapper.js`
- [x] Re-run `npm test` — green
- [x] Commit step handled as a landing concern; no per-extraction commits were created during this uncommitted implementation session.

After Step 9:

- [x] Rename `mapper.js` -> `mapper/index.js`
- [x] Update `importer.js:4`: `require('./mapper')` -> still resolves to `mapper/index.js` (node resolution) — verify no change needed
- [x] Update `pptx-import-semantic-and-roundtrip-fidelity-tester.js:13` likewise
- [x] Slice key unit coverage into per-file `*.test.js`; keep broad integration coverage in `mapper.test.js`.

## Tests After (New Unit Tests)

- [x] Each `mapper/<name>.test.js` runs in isolation: `npx vitest run server/services/pptx-import/mapper/<name>.test.js` green.
- [x] `mapper.test.js` retains broad pipeline coverage.
- [x] `mapper-golden-master.test.js` snapshots unchanged after entire refactor.

## Regression Gate (after each step, full at end)

- [x] `npm test` — full suite green
- [x] `npx vitest run --coverage` — thresholds preserved (lines:33, branches:28, fns:26)
- [x] LOC budget: each new file <= 180 LOC; `map-group.js` (~110), `map-diagram.js` (~103), `map-presentation.js` (~178)
- [x] No circular dep: `node -e "require('./server/services/pptx-import/mapper/index.js')"`
- [x] `npm run test:corpus` — at end of Phase 7, metrics unchanged from baseline
- [x] `mapper-golden-master.test.js` snapshots IDENTICAL (any diff = refactor broke behavior)

## Success Criteria

- 10 sub-files + 1 barrel exist; old `mapper.js` deleted.
- Each file <= 180 LOC.
- All existing exports preserved.
- Golden master snapshots unchanged.
- Corpus metrics unchanged.

## Risk Assessment

- High risk: `flattenGroupElement` extraction (Step 8a) — recursive call chain via `mapElement` dependency injection. Mitigation: extensive `group-transform.test.js` coverage; run `npm run test:corpus` immediately after Step 8a and 8b.
- Risk: accidental `{...context}` spread breaks stat accumulation silently. Mitigation: grep extracted files for `\.\.\.context` and fail review.
- Risk: snapshot drift during refactor. Mitigation: never re-baseline during Phase 7; any diff = STOP and investigate.
- Risk: `sanitizeHtml` re-export chain breaks. Mitigation: explicit test on `mapper/index.js` exports surface.

## Rollback Plan

- Each step is a git commit. Revert individual steps with `git revert <sha>`. Full rollback: `git revert` last 10 commits, restore `mapper.js`.

## Completion Notes

1. Broad integration coverage remains in `mapper.test.js`; focused per-module coverage lives beside the extracted mapper files.
2. The `context.zIndex` mutation path was preserved in the extracted diagram/group mapping flow.
3. LOC checks include blank lines and comments by the same simple line-count convention used in the plan; extracted files remain below the hard limit.
