# PPTX Import Fidelity Report

**Phase:** Ongoing PPTX Import Fidelity Hardening
**Generated:** 2026-04-27; updated 2026-06-17
**Test Suite:** `server/services/pptx-import/`

## Test Suite Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `mapper-golden-master.test.js` | 8 | ✅ Pass |
| `corpus-baseline.test.js` | 2 | ✅ Pass |
| `mapper.test.js` | 127 | ✅ Pass |
| `geometry.test.js` | 7 | ✅ Pass |
| `geometry-drift.test.js` | 5 | ✅ Pass |
| `property-mapping.test.js` | 5 | ✅ Pass |
| `group-transform.test.js` | 3 | ✅ Pass |
| `generated-fixtures.test.js` | 3 | ✅ Pass |
| `pptx-import-e2e-flow.test.js` | 5 | ✅ Pass |
| `pptx-import.test.js` (route) | 2 | ✅ Pass |
| `pptx-export.test.js` | 1 | ✅ Pass |
| `chart-output-to-navslides-mapper.test.js` | 2 | ✅ Pass |
| `import-fidelity-properties.test.jsx` | 2 | ✅ Pass |
| **Total** | **172** | **✅ All Pass** |

## 2026-07-09 Cook progress (Phases 01–08)

| Phase | Status |
|-------|--------|
| 01 | **Done** — zero-loss original + atomic create |
| 02 | **Done (machinery)** — goldens compare + **present capture** (`test:pptx:oracle:capture` via Playwright + reveal HTML) |
| 03 | **Advanced** — scene graph leaves stamped as `_pptxSource.nodeId`; node-level unmapped warnings; `PPTX_SLA_STRICT_NODES` |
| 04 | **Advanced** — layout placeholder injection when slide text empty; theme/color sanitize; primitive ban list |
| 05 | **Advanced** — `ooxml-chart-parser` reads chart XML series; injects native `chart` elements when scene graph has chart nodes |
| 06–08 | Scaffolds (SmartArt native, EMF sandbox, roundtrip policy) |

**Oracle debt:** placeholder goldens self-compare to SSIM 1 until LO/PP goldens + Nav present actuals land.  
**Not claimed:** product 1:1 visual/editable SLA.

## 2026-07-09 Zero-Loss Original Package (Phase 01 SLA foundation)

- Successful PPTX import **atomically** persists `original.pptx` under
  `server/data/pptx-originals/{uuid}.pptx` and creates the presentation
  server-side with `pptxOriginal.{id,sha256,byteLength,uploadedAt}`.
- Job done payload includes `presentationId` (client opens that id; no
  client path bind of originals).
- `GET /api/presentations/:id/pptx-original` streams bytes; permanent delete
  unlinks the original. Engineering milestone contract lives in
  `server/services/pptx-import/sla-contract.js` (Phase 01 requires **P1** only).
- This does **not** claim visual 1:1; later phases own SSIM/oracle and editable
  parity. Plan: `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd/`.

## 2026-06-17 Strict Gate And OOXML Visibility Update

- `test:pptx:strict` now runs `test:corpus` plus the strict smoke browser audit;
  `test:pptx:browser-audit:full` remains the release signoff command.
- Strict corpus diagnostics now print threshold labels generated from the
  enforced constants. Current global gates are average semantic >= 98%, average
  production round-trip floor >= 50%, corpus size >= 10, production export only,
  per-deck semantic >= 95%, and element-class drop <= 15%.
- Latest pre-change corpus baseline was `11/11` decks, `100.0%` semantic
  fidelity, and `70.0%` average round-trip stability. The 50% round-trip floor
  is a regression floor while the per-type round-trip report remains diagnostic.
- Import now inspects OOXML slide relationship evidence for native charts
  (`ppt/charts/chart*.xml`) and SmartArt data (`ppt/diagrams/data*.xml`),
  exposes additive `stats.nativeObjectCoverage`, `stats.ooxml`,
  `nativeChartCount`, and `nativeSmartArtCount`, and warns when those native
  evidence entries are not imported as native chart/diagram elements.

## 2026-04-27 Coordinate Fidelity Hardening Update

- Added `server/services/pptx-import/geometry.js` as canonical numeric/affine
  normalization layer for import geometry.
- Mapper now uses nullish-safe coordinate reads (`0` stays valid) instead of
  `||` fallbacks for critical geometry paths.
- Line import now normalizes absolute/global endpoints into local wrapper
  endpoints deterministically.
- Image crop import now standardizes to editor-native crop model:
  `imageW/imageH/imageOffsetX/imageOffsetY`; original crop ratios preserved in
  `_pptxImportMeta.cropData`.
- Group flattening moved to matrix-based transform path; rotated/flipped nested
  groups map through corner-based bounds with stable z-order.
- Corpus harness extended with:
  - `geometryDrift.maxPx`, `geometryDrift.medianPx`, `geometryDrift.byType`
  - `propertyCoverage.overall`, `propertyCoverage.byType`
  - `elementCount.sourceByType`, `elementCount.navByType`
- Strict per-type gates added for generated fixture decks:
  - text/shape/line/image/table max drift <= 3px
  - group max drift <= 5px
  - table/chart property coverage >= 0.8
- Added focused Playwright flow `tests/e2e/pptx-import-fidelity.spec.js`
  (import -> bbox audit -> property edit -> save/reload persistence).

## 2026-05-24 Import Review TDD Update

- Added mapper golden-master snapshots for text, image, shape, line, table,
  math, group, and diagram imports.
- Added `corpus-baseline.json` plus a baseline regression test for the checked-in
  `PPTX/` corpus.
- Fixed math/latex capture scoring so math imports use latex-specific criteria
  instead of shape criteria.
- Added `--baseline-out=<path>` to the corpus tester for explicit baseline
  refreshes.
- Media persistence now returns `{ url, warning? }`, allowing import callers to
  surface MIME/sniffing warnings without hidden state mutation.
- EMF/WMF image payloads are preserved as uploaded media with limited browser
  support warnings instead of becoming image-missing placeholders.
- Added `--drift-out=<path>` per-shape geometry diagnostics. The previous large
  shape drift was a tester-side grouped-source flattening issue: grouped PPTX
  child coordinates were compared locally against absolute NavSlides coordinates.
  Applying group transforms in the tester lowered Bai_2_1/Bai_2_2/Bai_2_5
  median shape drift to `0px`.
- Added per-cell/per-side table border preservation through
  `cellStyles.borders[row][col]`, with shared present/export and client canvas
  renderers applying those borders. Table property coverage now reports 100.0%
  for Bai_2_1, Bai_2_2, and Bai_2_5.
- Hardened imported media persistence with SHA256 dedup through
  `server/data/upload-hashes.json`, UUID filenames, extension allowlist,
  dynamic `file-type` magic-byte verification, and external video/audio URL
  gating for localhost/same-origin only.
- Added parser worker ACK handling and progress IPC filtering to the shared
  worker runner. The corpus harness now uses that runner directly so worker
  control messages cannot be mistaken for parse results.
- Split the oversized mapper into focused files under
  `server/services/pptx-import/mapper/` with a directory barrel preserving
  `require('./mapper')`. Group, diagram, media, table, image, shape, text/color,
  base utility, and presentation orchestration slices now have co-located tests;
  the old `mapper.js` file is removed.
- Latest Phase 7 verification: full Vitest `181 passed / 1 skipped` files with
  `1503 passed / 9 skipped` tests; strict corpus remains `4/4` decks at
  `100.0%` semantic fidelity and `99.0%` round-trip stability.
- Replaced blocking PPTX import with async job flow:
  `POST /api/pptx/import -> 202 { jobId }`, `GET /api/pptx/jobs/:jobId`,
  `GET /api/pptx/jobs/:jobId/stream`, and `DELETE /api/pptx/jobs/:jobId`.
  Jobs enforce one running import, keep terminal state during attached SSE
  clients, clean up after TTL, and abort the parser worker on cancel.
- Parser and mapper progress events now flow through the worker runner to SSE
  and HomePage `EventSource` progress UI. Affected Playwright PPTX import
  consumers now poll job completion before using the imported presentation.
- Latest Phase 8 verification: full Vitest `182 passed / 1 skipped` files with
  `1515 passed / 9 skipped` tests; coverage summary `37.26%` statements,
  `32.03%` branches, `31.92%` functions, `38.75%` lines; strict corpus remains
  `4/4` decks at `100.0%` semantic fidelity and `99.0%` round-trip stability.
  Reviewer concerns were fixed for pre-upload concurrency reservation, cancel
  abort propagation, SSE-to-polling fallback, and route-level SSE lifecycle
  coverage.
- Phase 9 expanded the default corpus to `server/data/test-corpus/` with 10
  decks. At the time, `npm run test:corpus` enforced the final v1 acceptance gate:
  aggregate semantic >= 98%, aggregate round-trip >= 99%, no deck below 95%
  semantic, no element-class drop above 15%, and n >= 10; the current production
  round-trip floor is documented in the 2026-06-17 update above. The final run passes
  10/10 decks at `100.0%` semantic fidelity and `99.0%` round-trip stability.
  The chart decks are native PPTX chart files, but current `pptxtojson` metrics
  expose them as shape-backed content; true parser chart extraction remains a
  follow-up.
- Final reviewer-fix validation closed the remaining review concerns: table
  border CSS is sanitized before shared/client rendering, cancelled imports stay
  active until background work settles, package validation observes
  `AbortSignal`, LaTeX import strips HTML tags fully, and abort-after-write
  media files are removed before or after hash indexing. Verification passed focused
  Vitest `6 files / 60 tests`, full `npm test` `182 files / 1527 tests`, strict
  corpus `10/10` at `100.0%` semantic and `99.0%` round-trip, and production
  build.

## 2026-05-25 Unit Conversion Phase 1 Update

- Added a shared CSS length conversion contract for PPTX rich text:
  `font-size` and `letter-spacing` values in `pt`, `in`, `cm`, and `mm` are
  normalized to `px` at 96 DPI and rounded to one decimal place.
- Server PPTX import sanitization, client legacy canvas fallback sanitization,
  and shared present/export rich-text sanitization now share the same strict
  style declaration sanitizer.
- The shared sanitizer preserves editor-authored `line-height`, highlight
  `background-color`, and `tel:` links so the stricter sanitizer does not
  regress normal rich text render/export.
- Unsafe rich-text style declarations remain blocked across layers, including
  non-allowlisted properties, `expression`, `javascript`, `@import`/`import`,
  `behavior`, `binding`, and any `url(...)` usage.
- Mapper text metadata tests now assert the normalized px contract, so imported
  rich text no longer carries raw `pt` font-size metadata through mapper output.
- Verification passed: focused Vitest slice `8 files / 169 tests`, full
  `npm run test` `185 passed / 1 skipped` files with `1549 passed / 8 skipped`
  tests, `npm run test:corpus` strict corpus `10/10` at `100.0%` semantic
  fidelity and `99.0%` round-trip stability, `npm run build`, and `npm run lint`
  with 0 errors. Lint still reports 7 warnings from an unrelated untracked
  debug script in the local worktree.

## 2026-05-25 Non-Default Resolution Phase 2 Update

- Imported PPTX presentations now store canvas-pixel resolution as
  `{ width: 960, height: 540 }` regardless of source slide size, matching the
  coordinate system used by mapped elements.
- Source slide dimensions remain available in `_pptxMeta.originalSize`, and
  PPTX export uses that metadata for slide layout while continuing to scale
  elements from canvas resolution.
- Legacy persisted PPTX-imported decks with stale non-canvas `resolution` are
  normalized at read/serialization boundaries without mutating the stored JSON.
- Direct server PPTX export now also normalizes raw legacy imported decks before
  element scaling, while still using `_pptxMeta.originalSize` for emitted slide
  layout.
- Added `server/data/test-corpus/non-default-4x3-resolution.pptx` to cover 4:3
  import resolution normalization in the default corpus.
- Verification passed: post-review focused Vitest slices `5 files / 27 tests`
  and reviewer export slice `4 files / 20 tests`, full `npm run test`
  `186 passed / 1 skipped` files with `1558 passed / 8 skipped` tests,
  Playwright PPTX import endpoint spec `7/7`, strict corpus `11/11` at
  `100.0%` semantic fidelity and `100.0%` round-trip stability,
  `npm run build`, and `npm run lint` with 0 errors. Lint still reports 7
  warnings from an unrelated untracked debug script in the local worktree.

## 2026-05-25 Numeric Scale Propagation Phase 3 Update

- Added `scaleLength(value, scaleAxis, min)` for numeric PPTX point lengths,
  converting `pt` to canvas `px` via `96/72` and the source-to-canvas scale axis.
- Image borders, line/shape/custom-path SVG strokes, diagram node/connector
  strokes, and text/shape shadow offsets/blur now use scaled canvas-pixel values.
- Diagram nodes now preserve plain display text from `textList` while extracting
  sanitized rich metadata from `node.content` when present.
- Mapper golden-master and property tests were re-baselined to the new numeric
  px contract.
- Verification passed: focused mapper slices `4 files / 12 tests`,
  `4 files / 149 tests`, post-review diagram metadata slice `3 files / 138 tests`,
  full `npm run test` `186 passed / 1 skipped` files with
  `1560 passed / 8 skipped` tests, strict corpus `11/11` at `100.0%` semantic
  fidelity and `100.0%` round-trip stability, `npm run build`, and
  `npm run lint` with 0 errors. Lint still reports 7 warnings from an unrelated
  untracked debug script in the local worktree.

## 2026-05-25 SVG Path Scaling Phase 4 Update

- Diagnostic evidence in `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/reports/svg-path-scaling-diagnostic.md`
  confirmed `pptxtojson` custom path coordinates are local to source shape
  dimensions.
- Custom SVG path imports now keep the inner SVG `viewBox` in raw source
  dimensions while the outer NavSlides element remains canvas-scaled through
  `mapBox`.
- Generated custom-path SVGs include `width="100%"`, `height="100%"`, and
  `preserveAspectRatio="none"` so the child SVG fills the wrapper instead of
  relying on intrinsic SVG size.
- Custom-path `stroke-width` now uses the raw viewBox coordinate contract:
  PPTX `pt` converts to `px` once, and the viewBox/wrapper transform applies the
  source-to-canvas scale.
- Verification passed: mapper/golden-master Vitest slice `3 files / 138 tests`,
  strict corpus `11/11` at `100.0%` semantic fidelity and `100.0%` round-trip
  stability, `npm run build`, and `npm run lint` with 0 errors. Lint still
  reports 7 warnings from an unrelated untracked debug script in the local
  worktree.

## 2026-05-25 Table Typography Phase 5 Update

- PPTX table import now captures per-cell `fontSizes` and `fontFamilies` in
  `cellStyles`, with numeric font sizes converted from PPT points to canvas px
  via `96/72`.
- Imported `colWidths` and `rowHeights` are converted from source units into
  canvas px using the current import scale axes.
- Shared HTML rendering, client canvas rendering, client PPTX export, and
  server PPTX export now consume per-cell table typography plus row/column
  sizing.
- Table row/column shape edits now keep `cellStyles.*`, `colWidths`,
  `rowHeights`, and `mergedCells` aligned through a focused table-properties
  utility.
- Font family values are strictly sanitized before mapper storage and before
  PPTX export, preventing imported or legacy JSON font-family CSS injection.
- Verification passed: focused Phase 5 Vitest slice `10 files / 186 tests`,
  post-review fix slice `8 files / 50 tests`, strict corpus `11/11` at
  `100.0%` semantic fidelity and `100.0%` round-trip stability with table
  property coverage at `100.0%`, `npm run build`, and `npm run lint` with 0
  errors. Lint still reports 7 warnings from an unrelated untracked debug script
  in the local worktree.

## 2026-05-25 Shape Rich Text Phase 6 Update

- Shape renderers now prefer sanitized `textHtml` when present, using an
  SVG-compatible `foreignObject` path in both shared present/export rendering
  and the client canvas renderer.
- Plain shape text remains the backward-compatible fallback, with text content
  escaped and `textColor` sanitized before SVG output.
- `extractTextMetadata()` now selects the longest visible styled text run for
  summary fields, aggregates nested same-style text as one dominant run, and
  rejects parent aggregate candidates when visible children override
  `fontSize`, `fontFace`, or `color`.
- Shared rich-text sanitization now strips unquoted event attributes and unsafe
  unquoted `href`/`src`/`xlink:href` values while preserving quoted safe
  protocols such as `tel:`.
- Verification passed: focused Phase 6 Vitest slice `9 files / 182 tests`,
  post-review regression slice `7 files / 153 tests`, strict corpus `11/11` at
  `100.0%` semantic fidelity and `100.0%` round-trip stability,
  `npm run build`, and `npm run lint` with 0 errors. Lint still reports 7
  warnings from an unrelated untracked debug script in the local worktree.

## 2026-05-25 Text Insets Phase 7 Update

- PPTX text frame insets now convert from points to scaled canvas pixels during
  import and are stored in `_pptxImportMeta.textInsets` with
  `textInsetsUnit: 'px'`.
- Imported text elements render those insets as inner padding on
  `.slide-text-content`; legacy unmarked inset metadata still converts from pt
  to px at render time.
- Imported shape rich text applies the same inset metadata to the inner
  `foreignObject` content in both client canvas rendering and shared
  present/export SVG output.
- Insets are clamped to `min(box side / 2, 96)`, invalid values are ignored per
  side, and no generic top-level `element.padding` schema/control was added.
- Verification passed: focused Phase 7 Vitest slice `6 files / 33 tests`,
  strict corpus `11/11` at `100.0%` semantic fidelity and `100.0%` round-trip
  stability, `npm run build`, and `npm run lint` with 0 errors. Lint still
  reports 7 warnings from an unrelated untracked debug script in the local
  worktree.

## 2026-05-25 Acceptance Gate Phase 8 Update

- Added reusable PPTX import acceptance criteria covering canonical canvas
  resolution, finite length-bearing numeric fields, raw CSS unit rejection in
  rich HTML style declarations, dangerous CSS/url token rejection, and
  source-pt font-size tolerance for direct source font metadata.
- The strict corpus runner now executes the acceptance invariants for every
  imported deck before semantic and round-trip metrics are accepted.
- The new gate caught a remaining `line-height: pt` rich-text leak in
  `Bai_2_1.pptx`; rich-text CSS length conversion now normalizes `line-height`
  alongside `font-size` and `letter-spacing`.
- Added rollout checklist documentation for staging verification, rollback
  behavior, and the manual visual-baseline review gate.
- Added `tests/e2e/pptx-import-visual-fidelity.spec.js` as the guarded
  visual-regression harness. It uses the async PPTX import job flow and
  `.slide-canvas` screenshots with `maxDiffPixelRatio: 0.002`; it intentionally
  skips unless `PPTX_VISUAL_BASELINES_REVIEWED=1` is set after reference
  baselines are reviewed.
- Verification passed: acceptance criteria/unit slices, strict corpus `11/11`
  at `100.0%` semantic fidelity and `100.0%` round-trip stability.

## Coverage by Phase

This table is the historical coverage taxonomy from the earlier PPTX import
review work; the 2026-05-25 unit-conversion plan uses its own Phase 1-8 index
in `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/`.

| Phase | Feature | Test Count | Status |
|-------|---------|-----------|--------|
| Phase 0 | Sanitizer hardening | 17 | ✅ |
| Phase 1 | Rich HTML/text preservation | 37 | ✅ |
| Phase 2 | Shape, line, image fidelity | 21 | ✅ |
| Phase 3 | Table full support | 9 | ✅ |
| Phase 4 | Chart import | 9 | ✅ |
| Phase 5 | Slide metadata | 6 | ✅ |
| Phase 6 | Group/SmartArt flattening | 11 | ✅ |
| Phase 7 | Fidelity harness + e2e | 5 | ✅ |

## Fidelity Tester

**File:** `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`

### Metrics

1. **Semantic Fidelity** (pptxtojson → NavSlides)
   - Measures how much of pptxtojson's data is captured in NavSlides schema
   - Per-element: position, size, fill, stroke, content, type
   - Per-category: text, shape, line, image, table, chart, group, diagram

2. **Round-trip Stability** (NavSlides → PPTX → NavSlides)
   - Optional via `--roundtrip`; `--strict` implies round-trip validation
   - Uses the production server export pipeline (`server/utils/server-export.js`) for validation
   - `--allow-fallback` keeps a development fallback path for non-strict runs; strict mode requires production export
   - Uses fingerprint + proximity matching with per-type breakdown and mismatch diagnostics; only exact/proximity matches count as stable, `type-only` stays diagnostic

### CLI Usage

```bash
# Run against default corpus; falls back to ./PPTX when server/data/test-corpus is empty
npm run test:corpus

# Run strict production round-trip validation
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict

# Run with development fallback (minimal exporter allowed when production fails)
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --allow-fallback

# Run against a specific directory
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./path/to/corpus
```

### Final Corpus Result

`npm run test:corpus` on 2026-05-25 used the checked-in `server/data/test-corpus/` corpus:

| Corpus | Files | Passed | Avg Semantic Fidelity |
|--------|-------|--------|-----------------------|
| `server/data/test-corpus/` | 11 | 11 | 100.0% |

Round-trip validation status (2026-05-25):

| Mode | Export Method | Avg Round-trip Stability |
|------|---------------|--------------------------|
| `--roundtrip --allow-fallback` | production (fallback available) | 99.0% |
| `--roundtrip --strict` | production only | 100.0% |

Strict run guarantees:
- `--strict` always runs round-trip validation (even if `--roundtrip` is omitted)
- Export method is `production` for every deck
- Only exact/proximity matches count as stable; `type-only` remains diagnostic
- Fails if production export is unavailable
- Fails if average semantic fidelity drops below 98%; CLI diagnostics use the same constant as the gate
- Fails if average round-trip stability drops below 50%; CLI diagnostics use the same constant as the gate
- Fails if any deck drops below 95% semantic fidelity
- Fails if any tracked element class drops more than 15%
- Fails if the default corpus has fewer than 10 decks

### Adding Corpus Files

Place `.pptx` files in `server/data/test-corpus/`. Recommended naming convention:

```
server/data/test-corpus/
├── text-rich-001.pptx
├── shape-heavy-001.pptx
├── image-heavy-001.pptx
├── table-complex-001.pptx
├── chart-multi-series-001.pptx
├── smartart-diagram-001.pptx
├── mixed-content-001.pptx
└── large-deck-100slides.pptx
```

### Fidelity Targets

| Category | Semantic Target | Round-trip Target |
|----------|----------------|-------------------|
| Overall | ≥ 95% | ≥ 98% |
| Text | ≥ 95% | ≥ 99% |
| Shape | ≥ 95% | ≥ 99% |
| Line | ≥ 95% | ≥ 99% |
| Image | ≥ 90% | ≥ 99% |
| Table | ≥ 90% | ≥ 95% |
| Chart | ≥ 85% | ≥ 90% |
| Group | ≥ 90% | ≥ 95% |
| SmartArt/Diagram | ≥ 80% | ≥ 90% |

## Known Gaps

### Semantic Fidelity Gaps

- **Chart**: Series metadata (legend, axis titles) not fully mapped
- **SmartArt/Diagram**: Complex nested layouts may lose structural hierarchy
- **Group**: Rotation and flip transforms applied during flattening; nested rotation compositing may differ from PowerPoint rendering
- **Table**: Cell border styles beyond solid/dashed not preserved (pattern/gradient fills)
- **Image**: Crop data from `element.rect` (EMUs, 0-1000 scale) mapped to 0-1 ratios; precision loss possible

### Round-trip Gaps

- Round-trip pipeline now runs on server-side production export modules; strict validation requires production export and counts only exact/proximity matches as stable. Residual drift risk is concentrated in parser representation changes (e.g., vector/raster remapping), not minimal-export feature loss.
- Corpus size is now `n=10`, but should still grow with more real-world Office 365, SmartArt, and chart-heavy decks.
- Strict mode enforces production path, aggregate semantic threshold, per-deck semantic minimums, corpus size, element-class retention floors, and a baseline 50% aggregate production round-trip floor.

### Visual Baseline Gaps

- Guarded Playwright baselines now capture the editor canvas at canonical 960x540 with reviewed PowerPoint reference exports saved under `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/reports/powerpoint-reference/`.
- `Bai_2_1.pptx` still shows broad source-to-app drift from grouped background/image rendering. This is tracked as a follow-up fidelity gap outside the unit-conversion and scale-propagation scope.

## Phase 0–6 Implementation Summary

### Phase 0: Sanitizer Hardening
- Added `SAFE_STYLE_PROPS`: `text-decoration`, `vertical-align`, `letter-spacing`, `text-shadow`, `background`
- Added `ALLOWED_TAGS`: `a`, `s`, `strike`, `del`, `sub`, `sup`
- Added `ALLOWED_ATTR`: `href` with protocol whitelist (`https:`, `http:`, `mailto:`, `tel:`)
- `validateHref()` strips invalid protocol hrefs

### Phase 1: Rich HTML Preservation
- `export-pptx-html-parser.js`: Added `strike`, `sub`, `sup`, `charSpacing` parsing
- `export-pptx-text-runs.js`: Built `buildRunOptions()` supporting all 8 text run properties
- Hyperlinks preserved via `<a href>` tags with safe protocol validation

### Phase 2: Shape/Line/Image Enhancement
- `colorValue()`: handles `{type:'color'}/{type:'gradient'}/{type:'none'}/{type:'pattern'}` discriminated union
- `mapImage()`: `objectFit`, `flipH`, `flipV`, `borderColor`, `borderWidth`, `cropData`
- `mapShape()`: real `x1/y1/x2/y2` coords from pptxtojson, improved arrow detection
- `shapeName()`: 15+ shape types, `arrow` checked before `line` to avoid misclassification

### Phase 3: Table Full Support
- `mapTable()`: full rewrite with `mergedCells`, `cellStyles` (textColors, bgColors, isBold, aligns, vAligns), `colWidths`, `rowHeights`
- `vMerge`/`hMerge` continuation cells (rowSpan=0) properly skipped
- Per-cell text color, background, bold, alignment, vertical alignment preserved

### Phase 4: Chart Import
- `chart-output-to-navslides-mapper.js`: `mapChartType()`, `mapCommonChart()`, `mapScatterChart()`
- Handles both pptxtojson native `[x,y]` parallel arrays and CommonChart format
- `_pptxChartMeta` sidecar stores original type, barDir, holeSize, marker, grouping

### Phase 5: Slide Metadata
- Background: `color`/`gradient`/`image` type preserved
- Transition: `fade`/`slide`/`none` with duration and direction
- Speaker notes: sanitized HTML preserved
- `_pptxMeta` sidecar: `originalSize`, `usedFonts`, `themeColors`
- Presentation `resolution` field preserved

### Phase 6: Group/SmartArt Flattening
- `flattenGroupElement()`: recursive with `MAX_GROUP_DEPTH=10`, absolute coordinate transform, rotation matrix, flip transform
- `flattenDiagramElement()`: converts up to 50 diagram nodes to individual shapes
- Depth exceeding `MAX_GROUP_DEPTH` produces a placeholder with `importPlaceholderType: 'grouped-complex'`

## Next Steps

1. **Add true chart/SmartArt parser coverage** → current importer records native OOXML chart/SmartArt package evidence, but full native SmartArt/chart reconstruction remains parser work.
2. **Expand with more real decks** → add Office 365 and SmartArt-heavy decks beyond the initial n=10 corpus.
3. **Track per-type round-trip gates** → optionally enforce per-type round-trip targets in strict mode.
4. **Performance benchmarks** → measure 100-slide deck import + round-trip runtime.
