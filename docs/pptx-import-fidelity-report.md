# PPTX Import Fidelity Report

**Phase:** Phase 7 — Full Fidelity PPTX Import
**Generated:** 2026-04-27
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
| **Total** | **145+** | **✅ All Pass** |

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
  decks and made `npm run test:corpus` enforce the final v1 acceptance gate:
  aggregate semantic >= 98%, aggregate round-trip >= 99%, no deck below 95%
  semantic, no element-class drop above 15%, and n >= 10. The final run passes
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

## Coverage by Phase

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
| `server/data/test-corpus/` | 10 | 10 | 100.0% |

Round-trip validation status (2026-05-25):

| Mode | Export Method | Avg Round-trip Stability |
|------|---------------|--------------------------|
| `--roundtrip --allow-fallback` | production (fallback available) | 99.0% |
| `--roundtrip --strict` | production only | 99.0% |

Strict run guarantees:
- `--strict` always runs round-trip validation (even if `--roundtrip` is omitted)
- Export method is `production` for every deck
- Only exact/proximity matches count as stable; `type-only` remains diagnostic
- Fails if production export is unavailable
- Fails if average semantic fidelity drops below 98%
- Fails if average round-trip stability drops below 99%
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
- Strict mode enforces production path, aggregate semantic/round-trip thresholds, per-deck semantic minimums, corpus size, and element-class retention floors.

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

1. **Add true chart/SmartArt parser coverage** → current generated chart decks are parsed as shape-backed content by `pptxtojson`.
2. **Expand with more real decks** → add Office 365 and SmartArt-heavy decks beyond the initial n=10 corpus.
3. **Track per-type round-trip gates** → optionally enforce per-type round-trip targets in strict mode.
4. **Performance benchmarks** → measure 100-slide deck import + round-trip runtime.
