---
phase: 5
title: "Table fontSize / fontFamily / colWidths / rowHeights fidelity"
status: implemented
priority: P1
effort: "1d"
dependencies: [1, 3]
---

# Phase 5: Table fontSize / fontFamily / colWidths / rowHeights fidelity

## Context Links

- File: `server/services/pptx-import/mapper/map-table.js:80-88, 121-122`
- Current cell extraction copies `fontColor`, `fontBold`, `align`, `vAlign`, per-cell `borders` — but NOT `fontSize` or `fontFamily`.
- `colWidths` and `rowHeights` copied raw from pptxtojson (pt) without scaling.
- Table renderer: `shared/src/element-renderers.js` and `client/src/components/canvas/element-renderers/`.

## Overview

**Priority:** P1
**Current status:** implemented
**Brief:** Imported PPTX tables lose per-cell font size and font family. Tables render with the default table CSS font size, ignoring the source's per-cell typography. Additionally, column widths and row heights are stored in pt but rendered as px, producing tables that are visually 25% smaller than they should be on default 16:9 decks (`×4/3` scale).

## Key Insights

- pptxtojson outputs `cell.fontSize` (pt) and `cell.fontFace` (string) per cell when defined.
- `cell.text` may also be HTML with inline `font-size: NNpt` — those go through `plainText()` which strips formatting (cell.text in pptxtojson is plain text by the package's design, so HTML inline styles are not the primary source here).
- `colWidths` array units: pt. To convert: multiply each entry by `context.scale.x`.
- `rowHeights` units: pt. Multiply by `context.scale.y`.

## Requirements

**Functional:**

- Per-cell `fontSize` (number, in px) and `fontFamily` (string) captured into `cellStyles`.
- `colWidths` and `rowHeights` arrays are converted to canvas-px via `scale.x` / `scale.y`.
- Client canvas, shared HTML renderer, and PPTX export consume `cellStyles.fontSizes` / `cellStyles.fontFamilies`.
- Client canvas and shared HTML renderer consume `colWidths` / `rowHeights` in actual layout. PPTX export maps them when supported by pptxgen; otherwise document that PPTX table width fidelity remains a known export limitation.
- Table row/column edit operations keep `data`, every `cellStyles.*` matrix, `colWidths`, `rowHeights`, and `mergedCells` in sync.
- Existing per-cell `fontColor`, `bgColor`, `isBold`, `align`, `vAlign`, `borders` continue to work.

**Non-functional:**

- Renderer (`shared/src/element-renderers.js` for export and `client/src/components/canvas/element-renderers/` for canvas) reads the new fields and applies them.

## Architecture

Extend `cellStyles` schema:

```js
const cellStyles = {
  textColors: [],
  bgColors: [],
  isBold: [],
  fontSizes: [], // NEW — px, decimal
  fontFamilies: [], // NEW — string
  aligns: [],
  vAligns: [],
  borders: [],
}
```

In `pushEmptyCell` and the cell-populated branch, push the corresponding entries. Use `normalizeFontSize` and a stricter `normalizeFontFamily` from `utils-text.js`. `normalizeFontFamily` must reject semicolons, colons, parentheses, slashes, backslashes, control characters, CSS comments, and dangerous tokens such as `url`, `import`, and `expression`; generic families are allowed explicitly. Apply pt→px conversion to fontSize via the `convertCssLengthToPx` helper (Phase 1) — or via a direct ×4/3 multiplication since fontSize here is always a number, not a CSS string.

`colWidths` / `rowHeights`:

```js
colWidths: Array.isArray(element.colWidths) ? element.colWidths.map((w) => Math.round(w * context.scale.x)) : [],
rowHeights: Array.isArray(element.rowHeights) ? element.rowHeights.map((h) => Math.round(h * context.scale.y)) : [],
```

## Related Code Files

**Modify:**

- `server/services/pptx-import/mapper/map-table.js`
- `server/services/pptx-import/mapper/map-table.test.js`
- `shared/src/element-renderers.js` (table renderer reads `cellStyles.fontSizes`/`fontFamilies`)
- `client/src/components/canvas/element-renderers/<table renderer file>` — confirm path during impl; apply same fields
- `client/src/components/properties/table-properties.jsx` — keep style matrices and col/row arrays in sync during add/remove row/column.
- `client/src/utils/export-pptx-basic-renderers.js` — export per-cell `fontSize`/`fontFace`; map col/row sizes when supported.
- `shared/tests/element-renderers.test.js` — extend coverage

**Read for context:**

- `client/src/components/canvas/element-renderers/registry.js`
- `client/src/components/PropertiesPanel.jsx` — verify table edits don't conflict with new fields

**Create:**

- None.

**Delete:**

- None.

## Implementation Steps

### Step 1 — Red: failing test on table cell fontSize/fontFamily and colWidth scaling

`mapper/map-table.test.js`:

```js
test('per-cell fontSize is captured (pt → px) and fontFamily preserved', () => {
  const result = mapTable({
    data: [[{
      text: 'Cell', fontSize: 18, fontFace: 'Arial', fontBold: true,
    }]],
  }, { ...ctx, scale: { x: 1, y: 1 } })
  const table = result[0]
  expect(table.cellStyles.fontSizes[0][0]).toBe(24) // 18 * 4/3
  expect(table.cellStyles.fontFamilies[0][0]).toBe('Arial')
})

test('colWidths and rowHeights scaled by scale.x / scale.y', () => {
  const result = mapTable({
    data: [[{ text: 'A' }, { text: 'B' }]],
    colWidths: [100, 200], rowHeights: [40],
  }, { ...ctx, scale: { x: 4/3, y: 4/3 } })
  expect(result[0].colWidths).toEqual([133, 267])
  expect(result[0].rowHeights).toEqual([53])
})
```

`shared/tests/element-renderers.test.js`:

```js
test('table renderer applies per-cell fontSize and fontFamily', () => {
  const html = renderTable({
    rows: 1, cols: 1, data: [['Cell']],
    cellStyles: {
      fontSizes: [[24]], fontFamilies: [['Arial']],
      textColors: [[null]], bgColors: [[null]], isBold: [[false]],
      aligns: [['left']], vAligns: [['middle']], borders: [[/*...*/]],
    },
  })
  expect(html).toMatch(/font-size:\s*24px/)
  expect(html).toMatch(/font-family:\s*Arial/)
})
```

Run — expect failures.

### Step 2 — Green: extend mapTable

Add `fontSizes` and `fontFamilies` arrays to `cellStyles`. Populate from `cell.fontSize` (×4/3 to convert pt → px) and `cell.fontFace`. Scale `colWidths` / `rowHeights`.

### Step 3 — Green: update renderers and table edit/export consumers

`shared/src/element-renderers.js`:

```js
const fontSize = cellStyles?.fontSizes?.[r]?.[c]
const fontFamily = cellStyles?.fontFamilies?.[r]?.[c]
const inlineStyle = [
  fontSize ? `font-size: ${fontSize}px` : '',
  fontFamily ? `font-family: ${fontFamily}` : '',
  // ...existing
].filter(Boolean).join('; ')
```

Client canvas table renderer: apply analogously.

Also update:

- `client/src/components/properties/table-properties.jsx`: centralize add/remove row/column mutation so every `cellStyles.*` matrix gets a matching null/default entry, removed rows/columns are truncated, `colWidths`/`rowHeights` stay aligned, and `mergedCells` are adjusted or safely cleared when impacted.
- `client/src/utils/export-pptx-basic-renderers.js`: use `getCellStyle('fontSizes', ri, ci)` and `getCellStyle('fontFamilies', ri, ci)` for PPTX table cell options. Continue falling back to table-level `element.fontSize` / `element.fontFamily`.
- Client/shared table renderers: use `colWidths`/`rowHeights` in actual layout; JSON-only assertions are not enough.

### Step 4 — Update fidelity tester / corpus baseline

`mapper-golden-master.test.js` snapshot for the table fixture will change. Regenerate.
`corpus-baseline.json` table property coverage scoring should credit the new fields.

### Step 5 — Verification

```bash
npx vitest run server/services/pptx-import/mapper/map-table.test.js \
  shared/tests/element-renderers.test.js \
  server/services/pptx-import/mapper-golden-master.test.js
npm run test:corpus
```

## Todo List

- [x] Step 1: write failing tests for cell fontSize/fontFamily + scaled dimensions
- [x] Step 2: extend `mapTable` cellStyles + dimension scaling
- [x] Step 3: extend shared + client table renderers, table edit operations, and PPTX export
- [x] Step 4: regenerate golden-master snapshot
- [x] Step 5: full verification

## Evidence

- Mapper now writes `cellStyles.fontSizes` and `cellStyles.fontFamilies`, converts PPTX point font sizes to px via `96/72`, and scales `colWidths` / `rowHeights` by the import scale axes.
- Shared HTML, client canvas, client PPTX export, and server PPTX export now consume per-cell table typography and row/column sizing.
- Table row/column shape edits now keep `cellStyles.*`, `colWidths`, `rowHeights`, and `mergedCells` aligned through `table-properties-utils.js`.
- Font family values are strictly sanitized before mapper storage and before client/server PPTX export.
- Verification passed:
  - Initial red run failed on mapper, shared renderer, client renderer, and PPTX export expectations.
  - Focused Phase 5 slice: `10 files / 186 tests` passed.
  - Post-review fix slice: `8 files / 50 tests` passed.
  - `npm run test:corpus`: 11/11 decks, 100.0% semantic, 100.0% round-trip; table property coverage remains 100.0%.
  - `npm run build`: pass.
  - `npm run lint`: 0 errors, 7 unrelated warnings from the untracked debug script.
  - Tester gate: DONE_WITH_CONCERNS only for unrelated lint warnings / short timeout.
  - Code-reviewer fix-diff gate: DONE.

## Success Criteria

- All new mapper + renderer tests pass.
- `npm run test:corpus` table property coverage 100% on `table-shapes-media.pptx` (corpus fixture).
- Manual: import a deck containing a table with explicit per-cell font sizes (e.g. 24pt header, 14pt body) — both sizes render correctly.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Adding new `cellStyles` fields breaks the editor's table editing UI (insert/remove rows/cols expects arrays of consistent length) | M | M | This is required work, not follow-up: update table-properties row/col operations and add tests for preserving/truncating all matrices. |
| Snapshot churn obscures other regressions | M | L | Snapshot diff is reviewed manually; corpus gate guards fidelity. |
| Pre-existing tables stored without these fields render with `font-size: undefinedpx` | L | M | Renderers must gracefully omit the inline style when value is undefined. |

## Security Considerations

- `fontFamily` strings come from pptxtojson — sanitize via a strict validator, not only quote stripping/comma splitting.
- Inline CSS in shared HTML renderer must use a vetted serializer or prevalidated values; reject values containing CSS separators or fetch-capable syntax.

## Next Steps

- Phase 6 (shape rich-text) is independent — runs in parallel after Phase 1.
