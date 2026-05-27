---
phase: 2
title: "Resolution mismatch for non-default slide sizes"
status: implemented
priority: P0
effort: "1d"
dependencies: [1]
---

# Phase 2: Resolution mismatch for non-default slide sizes

## Context Links

- File: `server/services/pptx-import/mapper/map-presentation.js:168`
- Canvas: `server/services/pptx-import/constants.js:10` — `CANVAS_SIZE = { width: 960, height: 540 }`
- Geometry: `server/services/pptx-import/geometry.js:18-29` — `normalizeSourceSize` computes `scale = { x: 960/width, y: 540/height }`
- Client canvas size: `client/src/components/SlideCanvas.jsx:78-79` — `SLIDE_W = resolution?.width || 960`

## Overview

**Priority:** P0
**Current status:** implemented — automated unit, corpus, build, lint, targeted Playwright API, tester, and code-review gates pass.
**Brief:** When a PPTX file uses a slide size other than the default 16:9 960×540 pt (e.g., 4:3 720×540 pt, or A4 landscape), the importer stores `resolution: { width: sourceSize.width, height: sourceSize.height }` on the presentation. The client uses this resolution to size the canvas. Result: a 720×540 deck renders with a 720×540-px canvas, but all elements were already scaled to fit a 960×540 canvas (`scale.x = 960/720 = 1.333`), so elements project beyond the right edge.

## Key Insights

- `normalizeSourceSize` computes `scale.x = CANVAS_SIZE.width / source.width`. Elements use this scale via `mapBox`.
- The canvas in the client uses `presentation.resolution.width` directly as the canvas pixel width.
- These two paths disagree when `source.width !== 960`. Elements are positioned for a 960-wide canvas; the canvas is rendered at `source.width` pixels wide.
- Fix: store `resolution: { width: CANVAS_SIZE.width, height: CANVAS_SIZE.height }` since elements are scaled to that target. Keep `originalSize` in `_pptxMeta` for round-trip export.

## Requirements

**Functional:**

- For every imported presentation, `presentation.resolution` MUST be exactly `CANVAS_SIZE` ({width: 960, height: 540}).
- `presentation._pptxMeta.originalSize` MUST be the unscaled source size in pt — this is used by the PPTX exporter to round-trip back to the original slide dimensions.
- A 4:3 (720×540 pt) input MUST produce elements positioned at the same fractional positions as in the source, and the canvas MUST be 960×540 px.

**Non-functional:**

- No new dependencies.
- Keep import mapper change small, but include required compatibility/export call-site updates in the same implementation slice so 4:3 decks do not regress on load, present, share, or PPTX export.
- Expanded test coverage for mapper resolution, legacy API-output normalization, and 4:3 export/re-import.

## Architecture

Two coordinates exist in the import pipeline:

| Coord system | Unit | Where |
|---|---|---|
| Source | pt | pptxtojson output: element `left/top/width/height`, slide size |
| Canvas | px | NavSlides storage: element `x/y/width/height`, `presentation.resolution` |

`normalizeSourceSize` is the bridge: `scale.x = 960 / source.width`. Elements pass through `mapBox(element, scale)` and end up in canvas-px. The presentation-level `resolution` MUST match canvas-px, not source-pt. The current code stores source-pt, mis-sizing the canvas.

## Related Code Files

**Modify:**

- `server/services/pptx-import/mapper/map-presentation.js` — line 168 area.
- `server/services/pptx-import/mapper/map-presentation.test.js` — add fixture for non-default size.
- `server/services/storage.js` — `readPresentations()` is the persisted-deck read path over `server/data/presentations.json`; add/read through a normalization helper rather than mutating JSON during plain reads.
- `server/routes/presentations.js` — `GET /api/presentations/:id`, list summaries, export, present, duplicate, and upload-ref routes call `readPresentations()` then serialize presentation JSON/HTML.
- `server/index.js` — share HTML uses `renderShareView()` and `readPresentations()` outside `server/routes/presentations.js`; include this surface in load/API-output compatibility tests.
- `server/routes/share.js` — share setup verifies presentations via `readPresentations()`; no canvas payload here, but keep it covered by shared helper import boundaries if read normalization moves into storage.
- `shared/src/shared-pptx-core.js` — add NEW `getPptxExportLayout`; leave existing `getPresentationResolution` unchanged.
- `shared/src/shared-pptx-core.test.js` — new tests for the helper split (CREATE if absent).
- `server/utils/server-export.js:24-30` — use `getPptxExportLayout` for slide layout; keep `getPresentationResolution` for element scaling.
- `client/src/utils/export-pptx-core.js:13-22` — add `getPptxExportLayout` re-export and use it from the export call sites in `client/src/utils/exportPptx.js` and `client/src/utils/export-pptx-basic-renderers.js`.
- `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js` — add 4:3 fixture round-trip.

**Read for context:**

- `client/src/components/SlideCanvas.jsx:78-79` — canvas pixel size derivation (uses canvas-resolution; unaffected by the split).
- `server/utils/server-export.js:24-30` — verifies `getPptxLayout(...)` is the only slide-dimension consumer; `scaleElementBounds` is the element-coord consumer.
- `client/src/utils/exportPptx.js:75`, `client/src/utils/export-pptx-basic-renderers.js:65-68,142-144` — confirm element scaling continues to use canvas-resolution after split.

**Create:**

- `shared/src/shared-pptx-core.test.js` — IF absent.

**Delete:**

- None.

## Implementation Steps

### Step 1 — Red: failing test on non-default slide size

In `server/services/pptx-import/mapper/map-presentation.test.js` (or `mapper.test.js`):

```js
describe('mapPptxOutput — resolution', () => {
  test('non-default slide size produces canvas-sized resolution and scaled elements', async () => {
    const output = {
      size: { width: 720, height: 540 }, // 4:3 in pt
      slides: [{
        elements: [
          { type: 'text', left: 360, top: 270, width: 100, height: 50, content: '<p>Mid</p>' },
        ],
      }],
    }
    const result = await mapPptxOutput({ output, originalName: '4x3.pptx', uploadsDir: '/tmp' })
    expect(result.presentation.resolution).toEqual({ width: 960, height: 540 })
    expect(result.presentation._pptxMeta.originalSize).toEqual({ width: 720, height: 540 })
    const element = result.presentation.slides[0].elements[0]
    expect(element.x).toBe(480) // 360 * 960/720
    expect(element.y).toBe(270) // 270 * 540/540
    expect(element.width).toBe(133) // 100 * 4/3 rounded
  })

  test('16:9 default slide size also produces canvas-sized resolution', async () => {
    const output = { size: { width: 960, height: 540 }, slides: [{ elements: [] }] }
    const result = await mapPptxOutput({ output, originalName: '16x9.pptx', uploadsDir: '/tmp' })
    expect(result.presentation.resolution).toEqual({ width: 960, height: 540 })
    expect(result.presentation._pptxMeta.originalSize).toEqual({ width: 960, height: 540 })
  })
})
```

Run — expect failure (current code returns `{width: 720, height: 540}` for the 4:3 case).

### Step 2 — Green: change resolution to CANVAS_SIZE

In `map-presentation.js`:

```js
const { CANVAS_SIZE, normalizeSourceSize } = require('../geometry')
const { CANVAS_SIZE: CANVAS } = require('../constants') // verify single source

// In mapPptxOutput:
return {
  presentation: {
    // ...
    resolution: { width: CANVAS_SIZE.width, height: CANVAS_SIZE.height },
    _pptxMeta: {
      originalSize: { width: sourceSize.width, height: sourceSize.height },
      // ...
    },
  },
  // ...
}
```

(Use existing `CANVAS_SIZE` from `constants.js`; verify which module re-exports it cleanly.)

### Step 3 — Round-trip patch (CONFIRMED REQUIRED) — split helpers

**Verified by inspection:** `shared/src/shared-pptx-core.js:13-17` `getPresentationResolution` reads `presentation.resolution` directly. After Step 2 lands, `presentation.resolution` is ALWAYS `{960, 540}` (canvas-px), so without further patching every exported deck would be 16:9 — destroying the 4:3 round-trip.

**Subtlety (caught in red-team verification):** `getPresentationResolution` has TWO classes of consumers with conflicting needs:

| Consumer | Wants | Why |
|---|---|---|
| `getPptxLayout` (slide-dimension setter) | Source aspect ratio | To emit a .pptx whose slide size matches the source — e.g., 4:3 stays 4:3 |
| `scaleElementBounds` and image-crop math (`export-pptx-basic-renderers.js:65-68, 142-144`, `export-pptx-core.js:37-44`) | Canvas pixel dimensions where elements were scaled | To divide stored element coords by the same canvas size they were scaled to — i.e., 960×540 |

A single `getPresentationResolution` cannot satisfy both. Solution: introduce `getPptxExportLayout(presentation)` for slide-dimension export, leaving `getPresentationResolution` for element-coord scaling.

Patch in `shared/src/shared-pptx-core.js`:

```js
// NEW — for .pptx slide-size emission. Prefers source-pt dims when available so 4:3 round-trips correctly.
function getPptxExportLayout(presentation) {
  const originalSize = presentation && presentation._pptxMeta && presentation._pptxMeta.originalSize
  if (originalSize && Number(originalSize.width) > 0 && Number(originalSize.height) > 0) {
    return { width: Number(originalSize.width), height: Number(originalSize.height) }
  }
  return getPresentationResolution(presentation) // fallback: canvas dims
}

// UNCHANGED — every existing caller of getPresentationResolution keeps canvas-px semantics for element scaling.
function getPresentationResolution(presentation) { /* current body */ }
```

Update `server/utils/server-export.js:25-26` to call `getPptxExportLayout` for the layout, NOT `getPresentationResolution`:

```js
const exportSlideSize = getPptxExportLayout(presentation)
const layout = getPptxLayout(exportSlideSize)
// element scaling continues to use canvas-resolution:
const resolution = getPresentationResolution(presentation)
```

Same change in `client/src/utils/export-pptx-core.js` and `client/src/utils/exportPptx.js:75`.

`shared/src/shared-pptx-core.test.js` (CREATE if absent):

```js
test('getPptxExportLayout prefers _pptxMeta.originalSize when present', () => {
  expect(getPptxExportLayout({
    resolution: { width: 960, height: 540 },
    _pptxMeta: { originalSize: { width: 720, height: 540 } },
  })).toEqual({ width: 720, height: 540 })
})

test('getPptxExportLayout falls back to resolution for native NavSlides decks', () => {
  expect(getPptxExportLayout({ resolution: { width: 960, height: 540 } })).toEqual({ width: 960, height: 540 })
})

test('getPresentationResolution remains canvas-px (unchanged)', () => {
  expect(getPresentationResolution({
    resolution: { width: 960, height: 540 },
    _pptxMeta: { originalSize: { width: 720, height: 540 } },
  })).toEqual({ width: 960, height: 540 }) // does NOT consult _pptxMeta
})
```

Round-trip e2e — extend `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js` to include a 4:3 deck. Assertions: import 4:3 → export → re-import → resulting `_pptxMeta.originalSize` equals `{ width: 720, height: 540 }`; AND elements at known fractional positions round-trip correctly.

### Step 4 — Corpus fixture for non-default size

Add a corpus deck with non-default slide size to `server/data/test-corpus/` (one of 4:3, A4 landscape, or 16:10). Possible options:

- Generate synthetic 4:3 PPTX via PPTX exporter then save as fixture.
- Hand-craft via PowerPoint (manual one-time).
- Include an existing 4:3 deck if one exists in `PPTX/`.

Update `server/data/test-corpus/README.md` to document the fixture.

### Step 5 — Legacy stored-deck load/API-output normalization

Existing presentations imported before this fix can already be persisted with `resolution: { width: sourceSize.width, height: sourceSize.height }` while their elements were scaled to 960×540. Add load-time/API-output normalization first; a one-off persistence migration is optional follow-up and is NOT required for this plan:

- Detect `_pptxMeta.originalSize` and `resolution.width !== 960 || resolution.height !== 540`.
- Preserve `_pptxMeta.originalSize`.
- Clamp `presentation.resolution` to `CANVAS_SIZE` before the client canvas consumes it.
- Add a regression fixture using a persisted legacy JSON deck: opening it must produce a 960×540 canvas with no off-canvas clipping.
- Implement a pure helper, e.g. `normalizePptxImportedPresentationForRead(presentation)`, close to the read/serialization boundary. Preferred location: `server/services/presentation-normalization.js` if the helper is used by multiple routes; otherwise keep it local in `server/routes/presentations.js` only if tests prove no other surface emits stale canvas dimensions.
- Apply the helper to API/output surfaces that serialize persisted presentations: `server/routes/presentations.js` (`GET /api/presentations/:id`, list, export, present, duplicate as needed) and `server/index.js` `renderShareView()`.
- Do NOT change `server/services/storage.js` to silently write normalized data during `readPresentations()`. Storage may expose raw persisted JSON; normalization belongs to API/output unless a separate migration command is added.
- Do not mutate saved JSON as part of normal reads unless the implementation explicitly adds a separate, tested migration command.

### Step 6 — Verification

```bash
npx vitest run server/services/pptx-import/mapper/map-presentation.test.js
npx vitest run server/services/pptx-import/mapper.test.js
npx vitest run server/services/pptx-import/mapper-golden-master.test.js
npm run test:corpus
npx playwright test tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js --project=chromium
```

## Todo List

- [x] Step 1: write failing test for non-default slide size
- [x] Step 2: change `resolution` to `CANVAS_SIZE` in `map-presentation.js`
- [x] Step 3: verify PPTX export reads `_pptxMeta.originalSize`; patch if needed
- [x] Step 4: add a 4:3 (or similar non-default) corpus deck + README entry
- [x] Step 5: add legacy stored-deck load-time/API normalization; document migration as optional follow-up
- [x] Step 6: full verification suite

## Implementation Evidence

- Red tests first: `map-presentation.test.js` failed on 4:3 input returning
  `resolution: { width: 720, height: 540 }`; shared/client export core tests
  failed because `getPptxExportLayout` did not exist.
- Green implementation stores canonical canvas resolution, preserves
  `_pptxMeta.originalSize`, splits PPTX export layout from element scaling, and
  normalizes legacy imported decks at read/serialization boundaries.
- Follow-up review fix normalizes raw legacy PPTX-imported decks inside
  `server/utils/server-export.js` before element scaling, so direct server
  export callers no longer need to pre-normalize persisted presentations.
- Focused post-review Vitest passed:
  `npx vitest run server/utils/server-export.test.js server/services/presentation-normalization.test.js shared/tests/shared-pptx-utils.test.js client/src/utils/export-pptx-core.test.js server/routes/presentations.test.js`
  with `5 files / 27 tests` passing; reviewer also re-ran an export-focused
  slice with `4 files / 20 tests` passing.
- Added `server/data/test-corpus/non-default-4x3-resolution.pptx`; strict corpus
  now passes `11/11` decks with 100.0% semantic fidelity and 100.0% round-trip
  stability.
- Targeted Playwright passed:
  `npx playwright test tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js --project=chromium`
  with `7/7` tests passing.
- Full Vitest passed: `npm run test` with `186 passed / 1 skipped` files and
  `1558 passed / 8 skipped` tests.
- Compile/static gates: `npm run build` passed; `npm run lint` reported 0
  errors and 7 unrelated warnings from untracked local debug file
  `CWorkNavSlidesEditordebug-pptx-parse.cjs`.
- Tester subagent returned `DONE`; code reviewer follow-up returned `DONE`
  with no findings after the raw legacy server-export normalization fix.

## Success Criteria

- New `map-presentation.test.js` cases pass.
- `npm run test:corpus` passes with the new non-default-size deck added.
- Round-trip export → re-import preserves the original slide size.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing presentations stored with non-960 resolution will render mis-sized after upgrade | M | H | Detect on load/API output for PPTX-imported decks: if `resolution.width != 960`, log a warning and clamp to `CANVAS_SIZE`. Documented in changelog. Persistence migration remains optional follow-up. |
| PPTX exporter currently reads `resolution` — round-trip breaks | **Confirmed** | H | Step 3 mandates the patch in `shared/src/shared-pptx-core.js:13-17`. Round-trip Playwright test is mandatory gate. |
| Some non-PPTX-imported NavSlides presentations may legitimately use other resolutions (e.g., custom canvas size) | L | M | Confirm with `git grep -n "resolution" client/src/`: if any user-facing control sets it, scope the change to PPTX-imported decks only. Otherwise, `CANVAS_SIZE` is the only legal value. |
| Rollback after new 4:3 imports can break PPTX export aspect ratio on old code | M | H | Ship export-layout compatibility before or with import storage change. Phase 8 rollout must rehearse rollback/export for a post-fix 4:3 deck. |

## Security Considerations

None — this is a pure data-shape change.

## Next Steps

- Phase 3 onwards can use the 4:3 corpus deck added here as a regression fixture for scale-propagation bugs.
