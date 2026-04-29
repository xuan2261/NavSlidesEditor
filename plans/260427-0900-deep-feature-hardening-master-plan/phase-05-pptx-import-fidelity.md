---
phase: 5
title: "Phase 6: PPTX Import Fidelity Hardening"
status: completed
priority: P1
effort: "4-6d"
dependencies: [0]
completed: "2026-04-27"
---

# Phase 5: PPTX Import Fidelity Hardening

## Context Links

- Predecessor: Phase 0 (baseline) — PPTX export hardening (12 files, 1781 lines) was done but is EXPORT-side. This phase is IMPORT-side fidelity.
- Docs: `docs/pptx-import-fidelity-report.md`
- Code: `server/services/pptx-import/` (mapper, chart-output-to-navslides-mapper, flattener)
- Code: `client/src/utils/pdf-import.js`, `client/src/utils/pptx-import-summary.js`
- Tests: `server/services/pptx-import/*.test.js`, `tests/e2e/pptx-import-fidelity.spec.js`

## Overview

Harden PPTX import on the corpus, per-type gates, chart metadata, and unsupported-object
fallbacks. Do NOT rebuild the chart parser — only improve the mapper/metadata layer
where `pptxtojson` output proves data exists.

**Correction from audit:** The previous Phase 6 work was PPTX **export** hardening (12 files).
This phase is PPTX **import** fidelity (chart-heavy corpus, per-type gates, OLE/equation fallbacks).

## Key Insights

- `mapChart()` already maps chart type and data for supported `pptxtojson` output.
- `flattenDiagramElement()` converts SmartArt nodes to shapes (up to 50 nodes).
- Remaining gaps: chart legend/axis/style metadata, complex SmartArt hierarchy, OLE/equation fallback, small corpus.
- Per-type real-corpus gates do not yet hard-fail — only generated-fixture gates exist.
- Decision gate: if `pptxtojson` does not expose embedded workbook data, document and defer parser spike.

## Architecture

```
PPTX corpus fixtures
  -> pptxtojson/importer
  -> mapper / chart-output-to-navslides-mapper / diagram-flattener
  -> semantic + round-trip harness
  -> per-type gates + diagnostics
  -> import summary warnings
```

## Related Code Files

- Modify: `server/services/pptx-import/chart-output-to-navslides-mapper.js`
- Modify: `server/services/pptx-import/mapper.js`
- Modify: `server/services/pptx-import/diagnostics.js`
- Modify: `client/src/utils/pptx-import-summary.js`
- Modify: `docs/pptx-import-fidelity-report.md`
- Modify: `tests/e2e/pptx-import-fidelity.spec.js`
- Create: `server/services/pptx-import/*.test.js` for chart metadata tests
- Add: corpus fixture files under `server/data/test-corpus/` (if repo-size-acceptable)

## Implementation Steps

### 1. Corpus Gap Analysis

Review current corpus against real-world deck characteristics:
- Chart-heavy: bar, line, pie/doughnut, scatter, multi-series, legends, axis titles
- SmartArt/diagram: simple, nested, >50 node cases
- OLE/equation: Word/Excel embeds, MathType equations
- Large deck: 50+ slides with mixed content

Decide: add real corpus files (small, acceptable) or document external corpus path.

### 1b. Fix SmartArt Node Positioning Bug (CRITICAL — existing bug)

Researcher found a **broken node positioning algorithm** in `flattenDiagramElement` (mapper.js L634-635):
```js
// CURRENT (BROKEN): uses linear array index i for horizontal position
const nodeX = element.left + (i * boxWidth) / maxNodes  // destroys real SmartArt layout
```
Fix: Read `node.left` or `node.x` from actual diagram node data. Fall back to grid/radial layout computed from node count.

```js
// FIXED: read node's own left position
const nodeX = readCoord(node.left, node.x, element.left + (i * boxWidth) / maxNodes)
```

Also:
- Add test: SmartArt with non-linear node positions must preserve relative positions after flattening
- Add connector/arrow preservation: check `element.connectors`, `element.arrows` before dropping

### 2. Per-type Real Corpus Gates

Extend harness to fail hard on missing per-type targets:

```js
// Example gate structure
const GATES = {
  chart: { minLegend覆盖率: 0.8, minAxisTitles: true },
  diagram: { maxNodes: 50, flattenSuccessRate: 0.95 },
  table: { cellBoundaryAccuracy: 0.9 },
}
```

### 3. Chart Metadata Improvement

Only extend chart mapper for fields proven present by fixtures:
- Legend labels and positions
- Axis titles and units
- Grouping/stacking metadata
- Chart style/theme colors

**Do NOT add fields that `pptxtojson` does not expose** without first verifying with fixtures.

**Chart metadata unit tests (specific):**
```js
// chart-output-to-navslides-mapper.test.js additions:
test('mapChart maps legendPos to element.legend')
test('mapChart maps xAxis.title to element.xAxisTitle')
test('mapChart maps yAxis.title to element.yAxisTitle')
test('mapChart detects combo chart via secondary Y axis')
test('mapScatterChart does not confuse 2-series line chart with scatter') // fixes length >= 2 bug
test('mapChart ignores 3D settings when absent')
```

### 4. OLE/Equation Fallback

Standardize unsupported object fallbacks:
- Severity: `warning` | `error` | `placeholder`
- Placeholder type: `locked-shape` with icon + label
- User-facing message: `Unsupported Office object (equation/embedded file)`

**Implementation (explicit, not vague):**
```js
// In mapElement, add before falling through to placeholder:
if (element.type === 'ole' || element.oleType || element.isOle) {
  return [placeholder(..., 'ole-object', `Embedded ${element.oleClass || 'OLE'} (unsupported)`)]
}
// tiered fallback:
// linked file -> download link stored as `link` element
// embedded Excel chart -> placeholder with _pptxImportMeta.oleType: 'excel-chart'
// embedded PDF -> extract first page as image (reuse pdf-import raster path)
// unknown -> placeholder + warning
```

Add corpus test fixture for OLE-embedded deck if pptxtojson exposes `oleType`/`oleClass`.

### 5. Update Import Summary

`pptx-import-summary.js` should expose:
- Chart count + editable-chart count
- Diagram count + flattened-count + placeholder-count
- Warning list per severity
- Confidence score per page

### 6. Update Import Fidelity Report

Document per-type results with actual fixture corpus:
- Semantic match percentages per element type
- Round-trip fidelity per element type
- Known gaps with severity labels
- Recommendations for next corpus additions

### 7. Run Strict Corpus

```bash
npm run test:corpus
```

## Decision Gate

```
If pptxtojson exposes embedded workbook data on real decks
  -> improve chart data mapper for that data
Else
  -> document gap, do not build greenfield parser in this phase
```

## Todo List

- [ ] Real chart-heavy corpus decision made (add files or external path)
- [ ] **SmartArt node positioning bug fixed** (read node.left/x, not array index)
- [ ] Connector/arrow preservation added for SmartArt flattening
- [ ] Per-type real corpus hard gates added to harness
- [ ] Chart metadata tests added before mapper changes (6 specific tests above)
- [ ] Chart legend/axis metadata improved only where source data exists
- [ ] OLE/equation fallback implemented with tiered strategy (link → excel-chart → pdf → unknown)
- [ ] Import summary updated with per-type diagnostics
- [ ] `docs/pptx-import-fidelity-report.md` updated with corpus results
- [ ] Parser rewrite spike decision recorded

## Verification Commands

```bash
npm run test -- server/services/pptx-import
npm run test -- client/src/utils/pptx-import-summary.test.js
npm run test:corpus
npx playwright test tests/e2e/pptx-import-fidelity.spec.js
npm run lint
npm run build
```

## Manual Smoke

- Import chart-heavy deck → inspect editable chart data
- Import SmartArt deck → inspect flattened nodes vs placeholders
- Import OLE/equation deck → inspect warnings
- Import mixed large deck → verify summary shows per-type breakdown

## Success Criteria

- [ ] Corpus contains or references chart-heavy real decks
- [ ] Strict mode fails when per-type targets regress
- [ ] Chart metadata improves only where source data exists
- [ ] Unsupported object fallbacks are explicit and non-crashing
- [ ] No greenfield chart parser added without fixture evidence
- [ ] Import summary shows actionable diagnostics

## Risk Assessment

- Risk: binary corpus bloats repo.
  - Mitigation: small generated fixtures in git; document external real corpus path.
- Risk: per-type gates flaky across parser versions.
  - Mitigation: start with diagnostic thresholds; hard fail after stable baseline.

## Security Considerations

- Keep ZIP bomb/package budget guards.
- Validate MIME/extension; never execute embedded OLE content.
- Treat imported HTML/text through existing targeted sanitizers.

## Next Steps

Proceed to Phase 6 (slide master validation) after this phase completes.
