---
phase: 3
title: "Raw-pt scale propagation in shadows, borders, strokes"
status: implemented
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 3: Raw-pt scale propagation in shadows, borders, strokes

## Context Links

- Bug #5 (diagram): `server/services/pptx-import/mapper/map-diagram.js:36, 63` — `strokeWidth` raw, no `fontSize` on nodes
- Bug #6 (shadow): `server/services/pptx-import/mapper/utils-base.js:41-50` — `extractShadow` returns raw pt
- Bug #7 (image border): `server/services/pptx-import/mapper/map-image.js:36` — `borderWidth` raw
- Bug #8 (line stroke): `server/services/pptx-import/mapper/map-shape.js:41` — `strokeWidth` raw
- Scale source: `server/services/pptx-import/geometry.js:18-29` — `scale.x / scale.y`

## Overview

**Priority:** P1
**Current status:** implemented — TDD mapper slices, corpus, build, lint, full Vitest, tester, and code-review gates pass.
**Brief:** Four mapper modules read pptxtojson length values (`pt`) and store them as element fields without multiplying by `scale.x` or `scale.y`. For a 4:3 source (Phase 2 added that fixture), a 2 pt stroke renders as 2 px on a 720×540-px box but should render as 2.67 px on the canvas-scaled 960-px-wide box. For 16:9 sources the bug is masked because `scale.x = 1`, BUT pt-to-px conversion (×4/3 = 1.333) is still missing — even for default slide sizes.

Fields affected:

- `image.borderWidth` (line stroke around picture)
- `line.strokeWidth` (shape line)
- `diagram node.strokeWidth` and `diagram connector.strokeWidth`
- `shadow.shadowX`, `shadow.shadowY`, `shadow.shadowBlur`
- `diagram node` is also missing `fontSize` capture (sub-bug noted in Bug #5)

## Key Insights

- Geometry conversion in mapper modules already uses `scale.x` for X-axis lengths and `scale.y` for Y-axis lengths via `mapBox`. Stroke/border lengths are axis-agnostic — conventionally use `scale.x` (most pt-to-px conversions ride the X scale; minor lateral drift on non-square sources is acceptable).
- Shadow X uses `scale.x`, Y uses `scale.y`, blur uses `scale.x` (axis-agnostic).
- These fields are numeric stored values, not CSS strings — Phase 1's sanitizer logic does not apply here. Multiplication by `scale.x / scale.y` is the fix.
- After Phase 1 + 2, this phase finalizes the scale invariant: every length-bearing pt value from PPTX is scaled by `scale.x / scale.y` to its canvas-px equivalent.

## Requirements

**Functional:**

- `mapImage` borderWidth = `readNumber(element.borderWidth, 0) * PT_TO_PX * context.scale.x`, rounded, min 0.
- `mapShape` line strokeWidth = same pattern, min 1.
- `mapDiagramNode` strokeWidth = same pattern, min 0; also extract fontSize via `extractTextMetadata` like text/shape mappers do.
- `mapDiagramConnector` strokeWidth = same pattern, min 1.
- `extractShadow` returns scaled `shadowX/Y/Blur` — accepts `scale` as second argument: `extractShadow(element, scale)`. Callers updated.

**Non-functional:**

- Every modified mapper sub-module stays ≤ 180 LOC.
- No new module — extend existing ones.

## Architecture

Add a single helper `scaleLength(value, scale)` in `utils-base.js`. These numeric fields are PPTX point lengths consumed by renderers as px, so the default conversion is `pt × 4/3 × sourceToCanvasScaleAxis`. Do not use `scaleAxis` alone; that misses default 960×540 decks where `scale.x === 1`.

```js
const PT_TO_PX = 96 / 72

function scaleLength(value, scaleAxis, min = 0) {
  const num = readNumber(value, 0)
  if (num <= 0) return min
  return Math.max(min, Math.round(num * PT_TO_PX * scaleAxis * 10) / 10)
}
```

(Note: keep 1-decimal precision; rendering layer accepts decimal pixel values for stroke / shadow.)

Apply at every call site:

```js
// map-image.js
img.borderWidth = scaleLength(element.borderWidth, context.scale.x)
// map-shape.js (line branch)
strokeWidth: scaleLength(element.borderWidth, context.scale.x, 1)
// map-diagram.js (node + connector)
strokeWidth: scaleLength(node.borderWidth, context.scale.x)
// utils-base.js
function extractShadow(element, scale = { x: 1, y: 1 }) {
  // ...
  shadowX: scaleLength(s.h, scale.x),
  shadowY: scaleLength(s.v, scale.y),
  shadowBlur: scaleLength(s.blur, scale.x),
}
```

Update every `extractShadow` caller in mapper sub-modules to pass `context.scale`.

For Bug #5 fontSize extraction on diagram nodes: pull `extractTextMetadata` from `utils-text.js`, apply to `nodeText`, copy `fontSize` / `fontFamily` / `textColor` onto the diagram node element output.

## Related Code Files

**Modify:**

- `server/services/pptx-import/mapper/utils-base.js` — add `scaleLength`, update `extractShadow` signature.
- `server/services/pptx-import/mapper/map-image.js`
- `server/services/pptx-import/mapper/map-shape.js`
- `server/services/pptx-import/mapper/map-diagram.js`
- `server/services/pptx-import/mapper/map-presentation.js` — update `mapText` `extractShadow` call.
- `server/services/pptx-import/mapper/utils-base.test.js`
- `server/services/pptx-import/mapper/map-image.test.js`
- `server/services/pptx-import/mapper/map-shape.test.js`
- `server/services/pptx-import/mapper/map-diagram.test.js`

**Create:**

- None.

**Delete:**

- None.

## Implementation Steps

### Step 1 — Red: failing tests for scale propagation

`utils-base.test.js`:

```js
describe('scaleLength', () => {
  test('converts default-size point lengths to px', () => {
    expect(scaleLength(2, 1)).toBe(2.7)
  })
  test('multiplies by scale axis and rounds to 1 decimal', () => {
    expect(scaleLength(2, 4/3)).toBe(3.6)
  })
  test('respects min', () => {
    expect(scaleLength(0, 1, 1)).toBe(1)
  })
  test('non-finite returns min', () => {
    expect(scaleLength(undefined, 1.5, 2)).toBe(2)
  })
})

describe('extractShadow', () => {
  test('scales shadowX/Y/Blur by passed scale', () => {
    const result = extractShadow({ shadow: { h: 3, v: 3, blur: 6, color: '#000' } }, { x: 4/3, y: 4/3 })
    expect(result.shadowX).toBe(5.3)
    expect(result.shadowY).toBe(5.3)
    expect(result.shadowBlur).toBe(10.7)
  })
})
```

`map-image.test.js`:

```js
test('image borderWidth is scaled by scale.x', async () => {
  const result = await mapImage({ ...baseEl, borderWidth: 2 }, { ...ctx, scale: { x: 4/3, y: 4/3 } })
  expect(result[0].borderWidth).toBe(3.6)
})
```

`map-shape.test.js`:

```js
test('line strokeWidth is scaled by scale.x with min 1', () => {
  const result = mapShape({ shapType: 'line', borderWidth: 2, x1: 0, y1: 0, x2: 100, y2: 0, width: 100, height: 2 }, { ...ctx, scale: { x: 4/3, y: 4/3 } })
  expect(result[0].strokeWidth).toBe(3.6)
})
```

`map-diagram.test.js`:

```js
test('diagram node strokeWidth is scaled and fontSize captured', () => {
  const result = flattenDiagramElement({
    elements: [{ shapType: 'rect', borderWidth: 1, content: '<span style="font-size: 18pt">Hello</span>', width: 100, height: 40 }],
    textList: [{ text: 'Hello' }],
    width: 300, height: 200,
  }, { ...ctx, scale: { x: 4/3, y: 4/3 } })
  expect(result[0].strokeWidth).toBe(1.8)
  expect(result[0].fontSize).toBeGreaterThan(0) // captured from text metadata
})
```

Run — expect failures.

### Step 2 — Green: implement `scaleLength`, update `extractShadow`

Per Architecture above. Update all callers.

### Step 3 — Green: apply at each mapper module

Per the file list. For diagram nodes, import `extractTextMetadata` and merge its output into the diagram-node element.

### Step 4 — Update mapper-golden-master snapshot

Many shadow / border / stroke fields will change values. Regenerate snapshot AFTER corpus tests confirm fidelity.

### Step 5 — Verification

```bash
npx vitest run server/services/pptx-import/mapper/utils-base.test.js \
  server/services/pptx-import/mapper/map-image.test.js \
  server/services/pptx-import/mapper/map-shape.test.js \
  server/services/pptx-import/mapper/map-diagram.test.js \
  server/services/pptx-import/mapper.test.js \
  server/services/pptx-import/mapper-golden-master.test.js
npm run test:corpus
```

## Todo List

- [x] Step 1: write failing tests for `scaleLength`, `extractShadow`, image border, line stroke, diagram node
- [x] Step 2: implement `scaleLength` in `utils-base.js`, update `extractShadow` signature
- [x] Step 3: apply at every mapper call site; thread `context.scale` through `extractShadow` callers
- [x] Step 4: re-baseline `mapper-golden-master.test.js.snap` after corpus passes
- [x] Step 5: full verification

## Implementation Evidence

- Red tests first failed on raw `borderWidth`, `strokeWidth`, `shadowX/Y/Blur`, missing `scaleLength`, and diagram rich metadata.
- Implemented `scaleLength(value, scaleAxis, min)` as `pt * 96/72 * scaleAxis`, rounded to one decimal, with min fallback.
- Applied scale propagation to image borders, shape line/non-line/custom SVG path strokes, diagram node/connector strokes, and text/shape shadows.
- Diagram nodes now preserve plain display text from `textList` while using rich `node.content` for sanitized font metadata when present.
- Focused mapper slice passed:
  `npx vitest run server/services/pptx-import/mapper/utils-base.test.js server/services/pptx-import/mapper/map-image.test.js server/services/pptx-import/mapper/map-shape.test.js server/services/pptx-import/mapper/map-diagram.test.js`
  with `4 files / 12 tests`.
- Broader mapper slice passed:
  `npx vitest run server/services/pptx-import/mapper.test.js server/services/pptx-import/mapper-golden-master.test.js server/services/pptx-import/property-mapping.test.js server/services/pptx-import/geometry-drift.test.js`
  with `4 files / 149 tests`.
- Post-review diagram metadata regression passed:
  `npx vitest run server/services/pptx-import/mapper/map-diagram.test.js server/services/pptx-import/mapper.test.js server/services/pptx-import/mapper-golden-master.test.js`
  with `3 files / 138 tests`.
- Strict corpus passed `11/11` decks with `100.0%` semantic fidelity and `100.0%` round-trip stability.
- Full Vitest passed: `npm run test` with `186 passed / 1 skipped` files and `1560 passed / 8 skipped` tests.
- Compile/static gates: `npm run build` passed; `npm run lint` reported 0 errors and 7 unrelated warnings from untracked local debug file `CWorkNavSlidesEditordebug-pptx-parse.cjs`.
- Tester concern about mapper LOC was resolved; code-reviewer follow-up returned `DONE` with no remaining concerns.

## Success Criteria

- All new tests pass.
- Corpus: 10/10 decks pass with stable or improved fidelity.
- Manual: import a 4:3 deck with a shadowed shape and a bordered image, verify shadow offset and border width visually proportional to canvas.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Decimal stroke values break canvas-renderer (some renderers reject sub-px) | L | M | Probe: existing `mapDiagramConnector` uses `Math.max(1, readNumber(...))`. Round to 1 decimal; if renderer rejects, round to whole pixels. Test in headed Playwright. |
| `extractShadow` signature change leaves a stale caller un-scaling | M | M | Use `git grep "extractShadow("` to enumerate callers; every caller is updated in same PR. Unit test for utils-base covers default scale parameter. |
| Diagram fontSize capture changes existing snapshot in ways that hide other regressions | L | L | Phase 8 visual-regression gate detects unexpected pixel shifts. |

## Security Considerations

None.

## Next Steps

- Phase 4 (SVG path scaling) uses the same scale.x propagation idea but on geometric coordinates within an SVG viewBox.
- Phase 5 (table fidelity) uses `scale.x` for `colWidths` and `scale.y` for `rowHeights`.
