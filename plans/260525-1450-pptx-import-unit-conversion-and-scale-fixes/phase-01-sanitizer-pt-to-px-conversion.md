---
phase: 1
title: "Sanitizer pt → px conversion for font-size and letter-spacing"
status: implemented
priority: P0
effort: "1.5d"
dependencies: []
---

# Phase 1: Sanitizer pt → px conversion for font-size and letter-spacing

## Context Links

- Root cause report: `plans/reports/pptx-import-bug-audit.md` (Bug #1, Bug #4)
- File: `server/services/pptx-import/sanitize.js`
- Editor unit convention: `client/src/components/ribbon/controls/ribbon-text-formatting-controls.jsx:33` writes `px` exclusively
- Renderer entry: `client/src/components/canvas/canvas-element-wrapper.jsx:112-114` (text via `dangerouslySetInnerHTML`)

## Overview

**Priority:** P0 (critical — this is the headline user-reported bug)
**Current status:** implemented — automated gates pass; manual PowerPoint visual comparison still pending.
**Brief:** PPTX text content arrives as inline HTML with `font-size: NNpt`. The current sanitizer's `SAFE_STYLE_PROPS` allowlist passes the declaration through, the browser converts `pt → px` at the 4/3 ratio, and rendered text is ~33% larger than the original — overflowing the text box. Same anti-pattern affects `letter-spacing`. Fix: convert `pt` (and `cm`, `mm`, `in` defensively) to `px` inside the sanitizer before the HTML reaches storage.

## Key Insights

- pptxtojson emits ALL length values in `pt` (verified by parsing `Bai_2_1.pptx`: text element style contained `font-size: 40pt`).
- The conversion ratio at 96 DPI is `1pt = 4/3 px = 1.333…px`.
- The canvas is sized in `px` (`CANVAS_SIZE = { width: 960, height: 540 }`); the editor writer path is `px` only.
- Other CSS length properties in the allowlist that potentially carry pt: `letter-spacing`. `text-shadow` accepts lengths but the importer never sets it from PPTX (text shadows are stored on element fields, not in CSS).
- Backward compatibility: presentations already imported before this fix carry `pt` strings in `element.content`. The fallback must keep rendering them at the same size as the future-converted version OR re-import them.

## Requirements

**Functional:**

- All `font-size: <N>pt` declarations inside sanitized HTML become `font-size: <N×4/3>px` (rounded to 1 decimal, then stringified without trailing zeros) BEFORE the HTML is stored on `element.content`.
- All `letter-spacing: <N>pt` declarations follow the same conversion.
- Lengths in `cm`, `mm`, `in` are converted too — defensive, since pptxtojson is documented as `pt`-only but third-party packages may emit other units.
- Values already in `px`, `em`, `rem`, `%`, or unitless pass through unchanged.
- Non-numeric values (e.g. `font-size: inherit`, `font-size: smaller`) pass through unchanged.

**Non-functional:**

- Conversion logic is one pure function `convertCssLengthToPx(value, property)` in `sanitize.js`, ≤ 30 LOC, no dependencies beyond Node built-ins.
- Sanitizer remains synchronous; the dominant cost is `DOMPurify.sanitize`, not the regex.
- Phase 1 MUST create the shared strict rich-text/style sanitizer before any later phase enables additional rich HTML render surfaces. This shared sanitizer is the canonical contract for server import, client canvas fallback, and shared present/export HTML.

## Architecture

```
[PPTX content HTML]
   ↓ extracted by pptxtojson, contains `font-size: 40pt`
[sanitize.js]
   ↓ DOMPurify allowlist tags/attrs
   ↓ regex replace style="..." → sanitizeStyle()
   ↓ sanitizeStyle() splits on ';', filters by SAFE_STYLE_PROPS
   ↓ NEW: convertCssLengthToPx(value, prop) for length-bearing props
   ↓ rejoin with px-converted values
[storage]
   ↓ element.content = `<span style="font-size: 53.3px">...`
[client renderer]
   ↓ dangerouslySetInnerHTML — browser renders as-is, no conversion needed
```

## Related Code Files

**Modify:**

- `server/services/pptx-import/sanitize.js` — add `convertCssLengthToPx`, wire into `sanitizeStyle`.
- `server/services/pptx-import/sanitize.test.js` — extend coverage (new tests).
- `client/src/utils/content-safety.js` — apply strict style allowlist + unit conversion for legacy rich text render.
- `client/src/utils/content-safety.test.js` — add client fallback sanitizer parity tests.
- `shared/src/content-safety.js` — apply strict style allowlist + unit conversion for shared present/export renderers.
- `shared/tests/content-safety.test.js` — create or extend shared sanitizer parity tests.

**Create:**

- `shared/src/css-length-conversion.js` — pure shared `convertCssLengthToPx` utility.
- Shared strict rich-text style sanitizer module if keeping it separate from `shared/src/content-safety.js` keeps files under LOC limits.

**Delete:**

- None.

## Implementation Steps

### Step 1 — Red: failing test for pt → px (sanitize)

Add to `server/services/pptx-import/sanitize.test.js`:

```js
describe('sanitizeStyle — CSS length unit conversion', () => {
  test('font-size: NNpt is converted to px at 4/3 ratio', () => {
    const out = sanitizeStyle('font-size: 40pt')
    expect(out).toBe('font-size: 53.3px')
  })

  test('letter-spacing: NNpt is converted to px', () => {
    const out = sanitizeStyle('letter-spacing: 2pt')
    expect(out).toBe('letter-spacing: 2.7px')
  })

  test('font-size already in px passes through unchanged', () => {
    expect(sanitizeStyle('font-size: 16px')).toBe('font-size: 16px')
  })

  test('font-size: inherit / smaller pass through unchanged', () => {
    expect(sanitizeStyle('font-size: inherit')).toBe('font-size: inherit')
    expect(sanitizeStyle('font-size: smaller')).toBe('font-size: smaller')
  })

  test('mixed declarations preserve order and convert only length-bearing props', () => {
    const out = sanitizeStyle('color: red; font-size: 40pt; font-weight: bold')
    expect(out).toBe('color: red; font-size: 53.3px; font-weight: bold')
  })

  test('cm / mm / in lengths converted to px (defensive)', () => {
    expect(sanitizeStyle('font-size: 1in')).toBe('font-size: 96px')
    expect(sanitizeStyle('font-size: 2.54cm')).toBe('font-size: 96px')
    expect(sanitizeStyle('font-size: 25.4mm')).toBe('font-size: 96px')
  })
})

describe('sanitizeHtml — pt → px round-trip', () => {
  test('inline style font-size pt is converted in final HTML', () => {
    const out = sanitizeHtml('<span style="font-size: 40pt;font-weight: bold;">Hi</span>')
    expect(out).toMatch(/font-size:\s*53\.3px/)
    expect(out).not.toMatch(/40pt/)
  })
})
```

Run `npx vitest run server/services/pptx-import/sanitize.test.js` — expect 7 failures.

### Step 2 — Green: implement `convertCssLengthToPx`

In `server/services/pptx-import/sanitize.js`:

```js
const LENGTH_PROPS = new Set(['font-size', 'letter-spacing'])
const PT_PER_PX = 96 / 72 // = 4/3
const CONVERSION_FACTORS_TO_PX = {
  pt: PT_PER_PX,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
}

function convertCssLengthToPx(value, prop) {
  if (!LENGTH_PROPS.has(prop)) return value
  const match = /^(-?\d+(?:\.\d+)?)(pt|in|cm|mm)$/i.exec(String(value).trim())
  if (!match) return value
  const num = Number(match[1])
  const unit = match[2].toLowerCase()
  const factor = CONVERSION_FACTORS_TO_PX[unit]
  if (!Number.isFinite(num) || !factor) return value
  const px = num * factor
  const rounded = Math.round(px * 10) / 10
  return `${rounded}px`
}
```

Wire into `sanitizeStyle`:

```js
function sanitizeStyle(value) {
  return String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [prop, ...rest] = part.split(':')
      const propName = prop.trim().toLowerCase()
      const rawValue = rest.join(':').trim()
      if (!SAFE_STYLE_PROPS.has(propName)) return null
      if (/expression|javascript|import|behavior|binding/i.test(rawValue)) return null
      if (/url\s*\(/i.test(rawValue)) return null
      const converted = convertCssLengthToPx(rawValue, propName)
      return `${propName}: ${converted}`
    })
    .filter(Boolean)
    .join('; ')
}
```

Export `convertCssLengthToPx` for unit tests.

Run the sanitize tests — expect green.

### Step 3 — Refactor

- Inline the rounded-string formatter if it grows: only keep one decimal place when non-zero (`53.3px`, not `53.30px`; `96px`, not `96.0px`).
- Verify `sanitize.js` stays ≤ 180 LOC.

### Step 4 — Wire backward compat for already-imported HTML

The renderer-side `sanitizeRichTextHtml` (client) currently passes inline styles through with no unit conversion. Pre-existing imports stored `font-size: NNpt`. Two strategies considered:

- **A. Re-render fallback** — Have the client's `sanitizeRichTextHtml` run the same `pt → px` conversion on read, so old + new content render identically.
- **B. One-off migration** — Run a server-side script that rewrites stored `element.content` in `server/data/presentations/*.json`.

Strategy A is reversible, ships with the same PR, and protects against any future pt-string leak. Implement A by replacing the weak client/shared regex sanitizer semantics with a strict shared sanitizer contract, not by adding conversion-only patches. The fallback must preserve the server sanitizer contract: allowed tags/attrs, style-property allowlist, dangerous CSS token blocking, `url(...)` blocking, and unit conversion.

- Add `shared/src/css-length-conversion.js` exporting `convertCssLengthToPx` (same logic, pure function).
- Add a shared strict rich-text style sanitizer used by server import, client canvas fallback, and shared HTML present/export renderers. It must mirror `server/services/pptx-import/sanitize.js:31-35` semantics: reject non-allowlisted style props, `expression/javascript/import/behavior/binding`, and `url(...)`. This is a blocker for Phase 6 shape `textHtml` rendering.
- Update `server/services/pptx-import/sanitize.js` to import the shared conversion/style sanitizer rather than duplicating conversion logic.
- Update `client/src/utils/content-safety.js` and `shared/src/content-safety.js` (actual sanitizer paths) to apply the same style sanitizer/conversion for legacy stored rich text.
- Add tests proving `background:url(...)`, `@import`, `expression`, `behavior`, and non-allowlisted style properties are removed in server import, client canvas fallback, and shared render output.
- Test against a corpus deck that was imported BEFORE this phase: render it in headed Playwright and assert text DOM `font-size` (computed style) is identical to a freshly imported version. Also render through `shared/src/element-renderers.js` and assert no raw `pt` remains.

### Step 5 — Verification

```bash
npx vitest run server/services/pptx-import/sanitize.test.js
npx vitest run server/services/pptx-import/mapper.test.js
npx vitest run server/services/pptx-import/mapper-golden-master.test.js
npm run test:corpus
```

Snapshot in `__snapshots__/mapper-golden-master.test.js.snap` for text elements will change (`40pt` → `53.3px`). Re-baseline with `--update` AFTER corpus tests confirm fidelity ≥ 100% on text-class scoring and the new pt-px gate (defined in Phase 8) passes.

## Todo List

- [x] Step 1: write failing sanitize tests (7 cases)
- [x] Step 2: implement `convertCssLengthToPx` + wire into `sanitizeStyle`
- [x] Step 3: refactor, LOC check
- [x] Step 4a: create `shared/src/css-length-conversion.js`
- [x] Step 4b: create/apply the same strict shared sanitizer/conversion in server import, client canvas fallback, and shared renderers
- [x] Step 4c: backward-compat regression coverage for legacy `pt` rich HTML in client/shared render paths
- [x] Step 4d: add sanitizer parity tests proving Phase 6 can safely render shape `textHtml`
- [x] Step 5: mapper-golden-master snapshot checked; no re-baseline required
- [x] Update `docs/project-changelog.md` with Bug #1 + Bug #4 entry

## Implementation Evidence

- Red tests added first in `server/services/pptx-import/sanitize.test.js`,
  `shared/tests/content-safety.test.js`, and
  `client/src/utils/content-safety.test.js`; initial run failed on missing
  conversion/shared sanitizer coverage.
- Green verification:
  `npx vitest run server/services/pptx-import/sanitize.test.js client/src/utils/content-safety.test.js shared/tests/content-safety.test.js server/services/pptx-import/mapper.test.js server/services/pptx-import/mapper-golden-master.test.js`
  passed `5 files / 150 tests`.
- Reviewer follow-up preserved editor-authored `line-height`, highlight
  `background-color`, and `tel:` links across client/shared renderers, then
  focused verification passed `8 files / 169 tests`.
- Backward-compat coverage landed as focused legacy rich-HTML sanitizer tests
  in `client/src/utils/content-safety.test.js` and
  `shared/tests/content-safety.test.js`; no historical pre-fix saved deck
  fixture is currently tracked in the repo.
- Strict corpus verification: `npm run test:corpus` passed 10/10 decks at
  100.0% semantic fidelity and 99.0% round-trip stability.
- Full verification: `npm run test` passed `185 files / 1549 tests`,
  `npm run build` passed, and `npm run lint` reported 0 errors with 7 unrelated
  warnings from untracked local debug file `CWorkNavSlidesEditordebug-pptx-parse.cjs`.

## Success Criteria

- All 7 new sanitize tests pass.
- Existing sanitize / mapper / mapper-golden-master tests pass (with re-baselined snapshot).
- `npm run test:corpus` still 10/10 decks, no regression.
- Manual: import `Bai_2_1.pptx`, open in editor, text on slide 1 (`KỸ THUẬT...`) renders at the same visual size as in PowerPoint within ±2 px tolerance.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Conversion math drift between server and client | M | H — pre-existing content renders different sizes per layer | Single source: `shared/src/css-length-conversion.js`. One unit test asserts factor = 96/72 = 4/3. |
| `letter-spacing` already in px on some fixtures becomes double-converted | L | M | Regex only matches `<num><unit>` where unit ∈ {pt,in,cm,mm}; px values pass through. Test case covers this. |
| Pre-existing presentations saved with `pt` strings render at the OLD size before the client fallback ships in the same commit | L | M | Phase 1 ships server + client conversion together in a single PR. Phase 8 gate runs both. |
| Rounding to 1 decimal causes ±0.7 px drift on small font sizes | L | L | 1-decimal precision is well below the 1-px gate tolerance. |

## Security Considerations

- Conversion is purely arithmetic on a regex-matched numeric capture; no eval, no DOM, no user-controlled regex.
- Server DOMPurify still runs first; shared/client fallback must not be weaker than the server style allowlist.
- The conversion does NOT relax the existing CSS allowlist or protocol guards. Add parity tests for server, client, and shared sanitizer paths.

## Next Steps

- Phase 2 (resolution mismatch) is unblocked once `shared/src/css-length-conversion.js` exists — Phase 2's test fixtures will use a 4:3 slide deck where the canvas scale ratio differs from 1.
- Phase 3 (raw-pt scale propagation) is unblocked — uses the same shared module for any pt→px field conversions where applicable, though most Phase 3 fields are pure geometric scale, not CSS unit conversion.
- Phase 6 (shape rich-text + multi-run metadata) depends on Phase 1 to avoid re-introducing pt strings while reconstructing text HTML.
