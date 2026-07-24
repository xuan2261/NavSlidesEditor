---
phase: 5
title: "Native editable charts"
status: pending
priority: P0
effort: "5-12d"
dependencies: [3, 4]
tdd: true
---

# Phase 5: Native editable charts

## Overview

Every OOXML chart evidence node imports as a **native editable NavSlides `chart` element** with series/categories/values user can edit. Zero `native-chart-degraded` gaps. No permanent image-only chart. Expand chart model where Chart.js mapping is insufficient — fail tests rather than fake pass.

## Requirements

### Functional
- Parse `ppt/charts/chartN.xml` (+ cache/embeddings as needed) into structured series
- Publish **chart support matrix** (RT-10): each OOXML chart type → Nav `chartType` or **strict fail** (no coerce-to-bar silent loss of series semantics without test).
- Minimum editable with data preserved: bar, line, pie, doughnut, scatter (true scatter if model allows), area.
- Coercions (e.g. stock→line) only if matrix row documents data-preserving mapping + tests; else gap stays open and E2 fails.
- Expand Nav chart model / Chart.js config when needed — do not claim E2=0 while values dropped.
- `stats.nativeObjectCoverage.chartCoverageGapCount === 0` on all corpus decks with charts **only after matrix rows implemented**
- Editor: change a value → persists in presentation JSON
- Present/export HTML renders chart
- Scene graph chart nodes all have `_pptxSource` mapping to chart element ids
- Remove acceptance of shape-only “semantic 100%” for chart fixtures as SLA success

### Non-functional
- Large chart XML: parse in worker or bounded main-thread
- Keep chart colors theme-aware when possible

## Architecture

```
sceneGraph chart node
  → read chart XML + optional excel embedding (xlsx in ppt/embeddings)
  → chart-output-to-navslides-mapper (rewrite to OOXML-first)
  → element type: chart { chartType, chartData, ... }
```

If embeddings required for values, use existing sheet parse carefully (size limits).

## Related Code Files

- Create/Modify:
  - `server/services/pptx-import/ooxml-chart-parser.js` + tests
  - `chart-output-to-navslides-mapper.js` (OOXML path)
  - `map-presentation.js` chart branch
  - `client` chart properties if new fields
  - corpus fixtures `chart-bars-lines.pptx`, `chart-pie-scatter.pptx` — expect type `chart` not only shape
  - export path ensures charts round-trip better (prep for Phase 08)

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T5.1 | Parse bar chart XML fixture → ≥1 series, numeric values |
| T5.2 | Import chart-bars-lines → `elements.some(e => e.type==='chart')` |
| T5.3 | `chartCoverageGapCount === 0` for chart fixtures |
| T5.4 | No warning `native-chart-degraded` on those fixtures |
| T5.5 | Mapped chartData editable shape: labels/datasets arrays finite |
| T5.6 | Unsupported exotic type: either editable fallback with data **or** hard fail in strict — **not** permanent placeholder image (SLA) |
| T5.7 | Client/unit: update chart dataset value mutates element |
| T5.8 | Oracle SSIM on chart decks ≥ 0.97 milestone (phase-05) when LO present |

## Implementation Steps

1. RED T5.1–T5.4 with real corpus chart files.
2. OOXML chart parser.
3. Replace reliance on pptxtojson chart-as-shape for these.
4. Editor smoke test for data edit.
5. Wire coverage gap metric to fail corpus strict optional flag `PPTX_SLA_STRICT`.
6. Update fidelity report: chart native milestone.

## Success Criteria

- [ ] E2 metric = 0 on corpus
- [ ] Chart elements editable in unit/integration sense
- [ ] T5.* green; G0/G1 green
- [ ] No permanent chart placeholders

## Verify

```bash
npx vitest run server/services/pptx-import/ooxml-chart-parser.js server/services/pptx-import/chart-output-to-navslides-mapper.test.js server/services/pptx-import/mapper/map-presentation.test.js --reporter=dot
npm run test:corpus
npm run test:pptx:oracle -- --milestone phase-05 --only chart-bars-lines.pptx,chart-pie-scatter.pptx
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Values only in embedded xlsx | Parse embeddings; size cap |
| Chart.js visual ≠ PP | SSIM gate; improve renderer; data correctness first |
| Combo/3D charts | Explicit support matrix; strict fail until implemented |

## Definition of Done

Charts are first-class editable imports with zero coverage gap on corpus chart decks.
