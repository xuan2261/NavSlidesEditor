---
phase: 1
title: "TDD Foundation + Real-Parser Regression Fixture"
status: completed
priority: P0
effort: "1.5d"
dependencies: []
---

# Phase 1: TDD Foundation + Real-Parser Regression Fixture

## Overview
Build the regression substrate every later phase asserts against: a fixture that mirrors **real pptxtojson@2.0.2 output shape** (string gradient `pos`, `/1e5` fractional filters, pt font, stacked chart, rotated group). This is the meta-fix — all 11 bugs slipped through because existing fixtures fabricated parser values matching the *old* 0.x convention.

## Key Insights (verified)
- Parser README: "0.x 版本中所有长度单位都是px" → 2.x uses pt. Lib version confirmed `2.0.2`.
- Filters: parser emits `parseInt(raw)/1e5` → fraction (`brightness=0.2` for 20%), neutral = `1.0`. Mapper assumes raw `100000` neutral, `/1000` divisor.
- Gradient: parser emits `pos: c/1e3 + "%"` → string `"50%"`. Mapper uses `Number()` → NaN.
- Gradient angle: parser emits `Math.round(ang/6e4)` → degrees in OOXML reference.
- Existing fixtures (`map-image.test.js`, `map-table.test.js`) fabricate `brightness:120000`, expected font `24` — green against wrong assumptions.

## Requirements
- Functional: one shared fixture module exporting a parser-shaped object (the raw output handed to the mapper), covering: a text box with pt font, a table cell with pt font, an image with `/1e5` fractional brightness/contrast/saturation, a shape with gradient fill (string `pos`, `rot`), a stacked-bar chart, a rotated group containing a shape + a line, an EMF image. Values use the **2.0.2** shape.
- Functional: a tiny synthetic `.pptx`-independent snapshot doc (JSON) usable by both unit tests and the corpus check, so no real deck is required.
- Non-functional: fixture < 200 LOC; documented field-by-field with the parser source behavior it mirrors.

## Architecture
```
server/services/pptx-import/__fixtures__/
  pptxtojson-2.0.2-output.fixture.js   (raw parser-shaped output, exported)
  expected-navslides.fixture.js        (post-fix expected mapper output — filled per phase)
```
Each later phase imports `pptxtojson-2.0.2-output.fixture.js`, runs the real mapper, and asserts against the slice of `expected-navslides.fixture.js` it owns. Phase 1 ships the raw fixture + an intentionally-failing "convention drift guard" test that pins the parser-output shape (string pos, fraction filter) so a future lib bump that changes shape breaks loudly.

## Related Code Files
- Create: `server/services/pptx-import/__fixtures__/pptxtojson-2.0.2-output.fixture.js`
- Create: `server/services/pptx-import/__fixtures__/expected-navslides.fixture.js`
- Create: `server/services/pptx-import/__fixtures__/parser-convention-drift.test.js`
- Read for context: `node_modules/pptxtojson/dist/index.cjs` (confirm shape), `server/services/pptx-import/mapper/index.js`

## Implementation Steps
1. **Red:** write `parser-convention-drift.test.js` asserting the fixture's gradient stop `pos` is a string ending in `%`, filter values are fractions in `[0,1]`, font is pt (small integer like 18). Run — fails (fixture not yet created).
2. Inspect `node_modules/pptxtojson/dist/index.cjs` once more to lock exact field names (`brightness`, `saturation`, `contrast`; gradient `colors[].pos`/`rot`; chart `grouping`). Record in fixture header comment.
3. **Green:** author `pptxtojson-2.0.2-output.fixture.js` with the parser-shaped object. Drift test passes.
4. Stub `expected-navslides.fixture.js` with empty per-element placeholders keyed by element id; later phases fill their slice.
5. **Refactor:** extract a `loadParserFixture()` helper if duplicated.

## Tests (this phase)
- `parser-convention-drift.test.js`:
  - gradient `pos` is string matching `/^\d+(\.\d+)?%$/`
  - `brightness`/`contrast`/`saturation` are finite fractions, neutral represented as `1`/`1e5`-scaled as the lib actually emits (assert the exact convention chosen)
  - chart fixture has `grouping: 'stacked'` and `chartType` containing `bar`
  - group fixture has `rotate` ≠ 0 with a child `rotate: 0`

## Success Criteria
- [ ] Fixture mirrors verified 2.0.2 output shape, documented field-by-field
- [ ] Drift guard test passes and would fail if pos became numeric or filters became raw
- [ ] `npm run test -- server/services/pptx-import/__fixtures__` green
- [ ] No real `.pptx` binary required

## Risk Assessment
- Risk: fixture drifts from true lib output. Mitigation: header cites exact `index.cjs` expressions; Phase 8 cross-checks against the live parser on at least one synthetic deck.
- Risk: over-fitting fixture to current bug list. Mitigation: include neutral/identity cases (filter = neutral, gradient with 2 stops) so fixes can't special-case.

## Security Considerations
- Fixture is static JSON-like data; no media fetch, no eval. EMF entry uses a fake in-memory buffer reference, not a network URL.

## Next Steps
- Unblocks Phases 2–7 (each asserts against this fixture).
