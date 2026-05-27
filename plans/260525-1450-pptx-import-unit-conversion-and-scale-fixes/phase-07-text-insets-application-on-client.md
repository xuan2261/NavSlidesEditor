---
phase: 7
title: "Text insets — parse → apply as CSS padding"
status: implemented
priority: P2
effort: "0.5d"
dependencies: [1]
---

# Phase 7: Text insets — parse → apply as CSS padding

## Context Links

- File: `server/services/pptx-import/mapper/utils-text.js:70-77` — `extractTextInsets` already parses `insetLeft/Right/Top/Bottom` (also `lIns`/`rIns`/`tIns`/`bIns` and `marginLeft/...` variants) from pptxtojson output.
- File: `server/services/pptx-import/mapper/map-presentation.js:48-49` — text mapper stores `_pptxImportMeta.textInsets`.
- File: `server/services/pptx-import/mapper/map-shape.js:62-63` — shape mapper stores `_pptxImportMeta.textInsets`.
- File: `client/src/components/canvas/canvas-element-wrapper.jsx` — text container; currently does NOT read `_pptxImportMeta.textInsets`.

## Overview

**Priority:** P2 (LOW, but easy)
**Current status:** implemented
**Brief:** PPTX text frames have per-side inner padding (insets). The importer extracts them but the client renderer ignores the stored field. Result: text sits flush against the box edge, while PowerPoint shows it indented by typically 0.1″ (≈10 px). The fix is two-part: convert pt → px at extraction time (since insets are also pt-sourced), then have the canvas element wrapper apply them as `padding-left/right/top/bottom` inline styles.

## Key Insights

- `extractTextInsets` returns numbers in pt (pptxtojson convention). After Phase 1 lands, this becomes the only pt value not yet converted, so the extractor itself must do the conversion.
- `_pptxImportMeta` is a sidecar for round-trip data. For this plan, keep text insets as import-scoped metadata and render from `_pptxImportMeta.textInsets`; do not introduce a new generic editable `padding` schema. A first-class editable padding field is a follow-up.
- Canvas wrapper applies `padding-*` inline styles on the inner content wrapper, not the outer position box (insets shrink usable text area, they don't move the box).
- Hard-default for PPTX without insets: pptxtojson omits the field → no padding override; the editor's standard text padding (defined in element-defaults) applies.

## Requirements

**Functional:**

- `extractTextInsets` returns padding values in canvas-px (pt × scale.x for left/right; pt × scale.y for top/bottom). Accepts a `scale` argument.
- Both `text` and `shape` mapped elements keep `_pptxImportMeta.textInsets` as canvas-px numbers for new imports.
- Canvas text renderer reads `_pptxImportMeta.textInsets` and applies `padding-{side}: ${value}px` on the text content wrapper.
- Shape renderer reads `_pptxImportMeta.textInsets` and applies it to the chosen Phase 6 shape text strategy (`foreignObject` or overlay), not the outer position box.
- Backward-compat: legacy `_pptxImportMeta.textInsets` values from old imports are treated as pt and converted client/shared-side only when no version marker or explicit px marker is present.
- Clamp each inset side to a sane bound, e.g. `min(element.width / 2, 96)` for horizontal and `min(element.height / 2, 96)` for vertical. Reject/normalize `Infinity`, `NaN`, exponent strings, negatives, and extreme values.
- Do not create or rely on top-level `element.padding` in this plan. `_pptxImportMeta.textInsets` is the only canonical storage field for PPTX-imported text insets.

**Non-functional:**

- No new generic editable field added to the canvas store schema in this phase.
- Wrapper change ≤ 20 LOC.

## Architecture

Two layers:

```mermaid
flowchart LR
  A[pptxtojson element.insetLeft pt] -->|extractTextInsets scale| B[padding.left px]
  B -->|stored on element| C[Canvas wrapper applies padding-left inline]
```

### Extractor change

```js
function extractTextInsets(element = {}, scale = { x: 1, y: 1 }) {
  const PT_PER_PX = 96 / 72
  const toPx = (value, axis) => {
    const n = readNumber(value, null)
    if (n == null) return null
    if (!Number.isFinite(n)) return null
    const px = Math.max(0, Math.round(n * PT_PER_PX * axis * 10) / 10)
    return Math.min(px, 96)
  }
  const left = toPx(element.insetLeft ?? element.marginLeft ?? element.lIns ?? element.insetL, scale.x)
  const right = toPx(element.insetRight ?? element.marginRight ?? element.rIns ?? element.insetR, scale.x)
  const top = toPx(element.insetTop ?? element.marginTop ?? element.tIns ?? element.insetT, scale.y)
  const bottom = toPx(element.insetBottom ?? element.marginBottom ?? element.bIns ?? element.insetB, scale.y)
  if ([left, right, top, bottom].every((v) => v == null)) return null
  return { left, right, top, bottom }
}
```

(Wait — pptxtojson actually exposes inset values in **pt** for text frames but in **EMU** for some shapes. Step 2 below has a quick probe; if EMU, use `emuToPx`. The implementation should handle both transparently via a unit-aware variant of `readNumber` or normalize upstream.)

### Store as import metadata

In `map-presentation.js` (text branch) and `map-shape.js`:

```js
const insets = extractTextInsets(element, context.scale)
if (insets) {
  mapped._pptxImportMeta = { ...(mapped._pptxImportMeta || {}), textInsets: insets, textInsetsUnit: 'px' }
}
```

### Client renderer

In `canvas-element-wrapper.jsx`, when computing the inline `style` for the text content div:

```jsx
const padding = deriveFromMeta(element._pptxImportMeta)
const style = {
  ...existingStyle,
  ...(padding && {
    paddingLeft: `${padding.left ?? 0}px`,
    paddingRight: `${padding.right ?? 0}px`,
    paddingTop: `${padding.top ?? 0}px`,
    paddingBottom: `${padding.bottom ?? 0}px`,
  }),
}
```

Where `deriveFromMeta` converts pt → px using `convertCssLengthToPx('Npt', 'font-size')`-style logic from Phase 1 (or a direct ×4/3 since we know the unit is always pt for back-compat).

## Related Code Files

**Modify:**

- `server/services/pptx-import/mapper/utils-text.js` — extend `extractTextInsets(element, scale)`.
- `server/services/pptx-import/mapper/map-presentation.js` — pass `context.scale`, set `_pptxImportMeta.textInsets` + `textInsetsUnit: 'px'`.
- `server/services/pptx-import/mapper/map-shape.js` — same.
- `client/src/components/canvas/canvas-element-wrapper.jsx` — apply padding from `_pptxImportMeta.textInsets` with back-compat conversion.
- `client/src/components/canvas/element-renderers/shape-element-renderer.jsx` — apply insets to shape text renderer.
- `shared/src/shapeUtils.js` / shared renderer path — apply insets for present/export HTML.
- `server/services/pptx-import/mapper/utils-text.test.js` — failing tests for px conversion + scale.
- `server/services/pptx-import/mapper/map-presentation.test.js` — text element gets `_pptxImportMeta.textInsets`.
- `server/services/pptx-import/mapper/map-shape.test.js` — shape element gets `_pptxImportMeta.textInsets`.
- `client/src/components/canvas/canvas-element-wrapper.test.jsx` (new or existing) — verifies inline padding applied.

**Read for context:**

- `client/src/data/element-defaults.js` — verify no generic text padding schema is already present.
- `client/src/components/PropertiesPanel.jsx` — read only to confirm editable padding remains out of scope.

**Create:**

- None.

**Delete:**

- None.

## Implementation Steps

### Step 1 — Red: failing extractor + mapper + renderer tests

`utils-text.test.js`:

```js
test('extractTextInsets converts pt to px and scales', () => {
  const result = extractTextInsets(
    { insetLeft: 7.2, insetRight: 7.2, insetTop: 3.6, insetBottom: 3.6 },
    { x: 4/3, y: 4/3 }
  )
  // 7.2 pt × 4/3 (pt→px) × 4/3 (scale) = 12.8 px
  expect(result.left).toBeCloseTo(12.8, 1)
  expect(result.right).toBeCloseTo(12.8, 1)
  expect(result.top).toBeCloseTo(6.4, 1)
  expect(result.bottom).toBeCloseTo(6.4, 1)
})

test('extractTextInsets returns null when no insets present', () => {
  expect(extractTextInsets({}, { x: 1, y: 1 })).toBeNull()
})
```

`map-presentation.test.js`:

```js
test('text element stores import metadata textInsets from insets', async () => {
  const output = {
    size: { width: 960, height: 540 },
    slides: [{ elements: [{
      type: 'text', left: 0, top: 0, width: 200, height: 50,
      insetLeft: 7.2, insetRight: 7.2, insetTop: 3.6, insetBottom: 3.6,
      content: '<p>X</p>',
    }] }],
  }
  const { presentation } = await mapPptxOutput({ output, originalName: 'p.pptx', uploadsDir: '/tmp' })
  const text = presentation.slides[0].elements[0]
  expect(text._pptxImportMeta.textInsets).toEqual({ left: 9.6, right: 9.6, top: 4.8, bottom: 4.8 }) // pt × 4/3, scale=1
  expect(text._pptxImportMeta.textInsetsUnit).toBe('px')
})
```

`canvas-element-wrapper.test.jsx`:

```js
test('text element with import textInsets applies inline padding styles', () => {
  const element = { type: 'text', content: '<p>Hi</p>', _pptxImportMeta: { textInsets: { left: 10, right: 10, top: 5, bottom: 5 }, textInsetsUnit: 'px' } }
  const { container } = render(<CanvasElementWrapper element={element} />)
  const contentDiv = container.querySelector('.slide-text-content')
  expect(contentDiv.style.paddingLeft).toBe('10px')
  expect(contentDiv.style.paddingTop).toBe('5px')
})

test('back-compat: legacy element with _pptxImportMeta.textInsets still applies padding (pt → px)', () => {
  const element = { type: 'text', content: '<p>Hi</p>', _pptxImportMeta: { textInsets: { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6 } } }
  const { container } = render(<CanvasElementWrapper element={element} />)
  const contentDiv = container.querySelector('.slide-text-content')
  expect(contentDiv.style.paddingLeft).toBe('9.6px') // 7.2 pt × 4/3
})
```

Run — expect failures.

### Step 2 — Probe pptxtojson inset units

```bash
node -e "
const fs = require('fs')
const p = require('pptxtojson')
p(fs.readFileSync('./server/data/test-corpus/Bai_2_1.pptx')).then((out) => {
  const t = out.slides[0].elements.find((e) => e.type === 'text')
  console.log(JSON.stringify({ insetLeft: t.insetLeft, marginLeft: t.marginLeft, lIns: t.lIns }, null, 2))
})
"
```

Confirm units. Adjust extractor (pt or EMU). Document finding in implementation commit message.

### Step 3 — Green: update extractor + mappers + wrapper

Per Architecture.

### Step 4 — PropertiesPanel remains out of scope

Do not add editable padding controls in this plan. If an existing PropertiesPanel path already exposes padding, leave it untouched unless it conflicts with `_pptxImportMeta.textInsets` rendering. Editable generic padding is a separate follow-up.

### Step 5 — Verification

```bash
npx vitest run server/services/pptx-import/mapper/utils-text.test.js \
  server/services/pptx-import/mapper/map-presentation.test.js \
  server/services/pptx-import/mapper/map-shape.test.js \
  client/src/components/canvas/canvas-element-wrapper.test.jsx
npm run test:corpus
```

Manual: open imported `Bai_2_1.pptx`; verify text is inset from the box edge by the same amount as in PowerPoint.

## Todo List

- [x] Step 1: write failing tests
- [x] Step 2: probe pptxtojson inset units
- [x] Step 3: update extractor, mappers, wrapper
- [x] Step 4: confirm PropertiesPanel remains out of scope; no top-level `padding` field added
- [x] Step 5: verification

## Evidence

- Red phase failed as expected across extractor, mapper, client text wrapper, client shape renderer, and shared shape renderer before implementation.
- Direct ad-hoc `pptxtojson` package probe was inconclusive under current Node/package export behavior, so implementation followed the plan contract that extracted inset fields are PPT points and preserves legacy unmarked pt metadata handling at render boundaries.
- Focused Phase 7 verification passed: `npx vitest run server/services/pptx-import/mapper/utils-text.test.js server/services/pptx-import/mapper/map-presentation.test.js server/services/pptx-import/mapper/map-shape.test.js client/src/components/canvas/canvas-element-wrapper.test.jsx client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx shared/tests/shapeUtils.test.js` -> 6 files / 33 tests passed.
- Corpus gate passed: `npm run test:corpus` -> 11/11 decks, 100.0% semantic, 100.0% round-trip.
- Compile gate passed: `npm run build`.
- Lint gate passed with 0 errors; 7 warnings remain from unrelated untracked `CWorkNavSlidesEditordebug-pptx-parse.cjs`.
- Tester status: DONE. Code-reviewer status: DONE; minor legacy shape test gap was addressed with follow-up coverage.

## Success Criteria

- All new tests pass.
- Imported `Bai_2_1.pptx` text frames render with the same visual padding as the source.
- No regression in elements without insets.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| pptxtojson inset units are EMU not pt | M | M | Step 2 probe decides. Convert via `emuToPx` if needed. |
| Existing decks rely on padding from `element-defaults` and break when padding is `0` | L | M | Treat `null`/`undefined` padding as "use defaults"; only override when insets are present in source. |
| `_pptxImportMeta.textInsets` back-compat path is forgotten and old decks render mis-padded | M | L | Test the back-compat path explicitly. |
| Malicious inset values cause extreme CSS layout work | M | M | Clamp each side to canvas-relative maximum and test huge/invalid numeric values. |

## Security Considerations

None.

## Next Steps

- Phase 8 (acceptance gate) verifies text inset behaviour via Playwright visual regression.
