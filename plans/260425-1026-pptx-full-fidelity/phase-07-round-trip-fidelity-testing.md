---
phase: 7
title: "Fidelity Harness + Corpus"
status: complete
priority: P1
effort: "3-4 days"
dependencies: [phase-00-sanitizer-hardening, phase-01-rich-html-preservation, phase-02-shape-line-image-enhancement, phase-03-table-full-support, phase-04-chart-component, phase-05-slide-metadata, phase-06-group-and-smartart]
---

# Phase 7: Fidelity Harness + Corpus

## Overview

Comprehensive testing with **TWO separate fidelity metrics**: (1) semantic fidelity (pptxtojson → NavSlides), and (2) round-trip stability (NavSlides → PPTX → NavSlides). **Critical fix from plan review:** original plan only measured round-trip, which can produce false positives.

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P1-D Fidelity baseline wrong
- Phase 1 baseline: `plans/260424-1841-pptx-import/plan.md`
- Existing mapper tests: `server/services/pptx-import/mapper.test.js`
- Existing route tests: `server/routes/pptx-import.test.js`

## Requirements

**Metric 1: Semantic Fidelity** (what we extract from PPTX)
- Compare pptxtojson output → NavSlides schema
- Baseline: pptxtojson JSON → our mapped JSON
- Measures: how much of pptxtojson's data do we capture?
- This is the TRUE fidelity measure

**Metric 2: Round-trip Stability** (NavSlides → PPTX → NavSlides)
- Compare: import → export → re-import
- Measures: does NavSlides preserve its own data through export/import?
- This is stability, not accuracy

**Test corpus:**
- 10-20 diverse real-world PPTX files
- Categories: text-rich, shape-heavy, image-heavy, table-complex, chart-multi-series, SmartArt, mixed
- Edge cases: nested groups, complex tables, 100+ slides

**Regression tests:**
- All existing unit tests pass after each phase
- Integration tests: full import → export → re-import pipeline
- API tests: `POST /api/pptx/import` with corpus files

**Performance benchmarks:**
- Large deck (100+ slides) import performance
- Memory usage during import
- Timeout behavior with complex files

## Architecture

**Fidelity diff tool** (`server/services/pptx-import/fidelity-tester.js`):
```
Input: original.pptx
Step 1: parse with pptxtojson → pptxtojson JSON (baseline)
Step 2: import with NavSlides → NavSlides JSON (semantic)
Step 3: export NavSlides JSON → output.pptx
Step 4: re-import output.pptx → comparison JSON (stability)

Output:
  semanticFidelity: {
    overall: 0.95,
    text: 0.98, shape: 0.95, image: 1.0, table: 0.90,
    chart: 0.85, group: 0.90, smartArt: 0.80, slide: 0.80
  }
  roundTripStability: {
    overall: 0.98,
    text: 0.99, shape: 0.99, image: 1.0, table: 0.95, ...
  }
  diffReport: { ... }
```

**Diff categories per metric:**
```
Semantic (pptxtojson → NavSlides):
  Text: content match (normalized), formatting fields present
  Shape: type match, fill match, stroke match
  Image: objectFit match, crop data present, border present
  Table: merged cells present, cell styling present
  Chart: series count match, data values match
  Group: children count, types present
  Slide: background type match, transition present

Round-trip (NavSlides → PPTX → NavSlides):
  Element count match per slide
  Element type match
  Text content normalized match
  Shape type match
  Numeric values within tolerance (0.01 for floats, 1px for positions)
```

## Related Code Files

**Create:**
- `server/services/pptx-import/fidelity-tester.js` — dual-metric fidelity diff tool
- `server/data/test-corpus/` — directory for test PPTX files
- `server/services/pptx-import/e2e-pptx-flow.test.js` — integration test

**Modify:**
- `server/services/pptx-import/mapper.test.js` — add fidelity assertions
- `server/routes/pptx-import.test.js` — expand integration test coverage
- `package.json` — add corpus test script

## Implementation Steps

1. **Create `fidelity-tester.js`**
   - `parsePptxWithPptxtojson(filePath)` → baseline JSON
   - `importPresentation(filePath)` → NavSlides JSON (call importer)
   - `exportPresentation(presentation)` → output PPTX (call exporter API)
   - `reImportPresentation(filePath)` → comparison JSON
   - `computeSemanticFidelity(pptxtojsonJSON, navslidesJSON)` → semantic report
   - `computeRoundTripStability(originalJSON, reimportedJSON)` → stability report
   - `generateDiffReport()` → detailed per-element diff

2. **Collect test corpus (10-20 files)**
   - Gather diverse PPTX files from real presentations
   - Categorize: text-rich, shape-heavy, image-heavy, table-complex, chart-multi-series, SmartArt, mixed, large
   - Store with descriptive names: `text-rich-001.pptx`, `chart-multi-series-001.pptx`
   - Document each file's characteristics for regression tracking

3. **Run semantic fidelity tests**
   - For each corpus file: parse with pptxtojson → import with NavSlides
   - Compare: what percentage of pptxtojson data did we capture?
   - Report per element type and overall

4. **Run round-trip stability tests**
   - For each corpus file: import → export → re-import
   - Compare: how stable is our own data through export/import?
   - Report per element type and overall

5. **Set fidelity targets and validate**
   - Semantic: target 95% overall, with per-type thresholds
   - Round-trip: target 98% overall
   - Identify worst-performing files → add to bug backlog

6. **Add regression tests (`e2e-pptx-flow.test.js`)**
   - import → edit → export → re-import for key corpus files
   - Validate API response structure unchanged
   - Validate presentation schema compliance
   - Validate import stats accuracy

7. **Performance benchmarks**
   - Test: 10 slides, 50 slides, 100 slides
   - Measure: import time, memory usage, output size
   - Validate: 100-slide deck < 30s import time

8. **Add npm scripts**
   - `npm run test:corpus` — run fidelity tests
   - `npm run test:corpus -- --verbose` — detailed output
   - `npm run test:corpus -- --report` — HTML report

9. **Update documentation**
   - Create `docs/pptx-import-fidelity-report.md` with corpus results
   - Update `docs/project-changelog.md` with Phase 2 completion

## Success Criteria

- [ ] `fidelity-tester.js` runs full pipeline with both metrics
- [ ] Semantic fidelity ≥ 95% overall on text-rich corpus
- [ ] Semantic fidelity ≥ 85% overall on chart-heavy corpus
- [ ] Round-trip stability ≥ 98% overall
- [ ] 10+ corpus files collected and categorized
- [ ] All regression tests pass
- [ ] Performance: 100-slide deck imports in < 30s
- [ ] `npm run test:corpus` runs successfully with summary
- [ ] `docs/pptx-import-fidelity-report.md` created
- [ ] Clear gap analysis: which element types are below target

## Risk Assessment

**Risk:** Achieving 95% semantic fidelity may require iterations.
**Mitigation:** Set realistic sub-targets per element type. Document remaining gaps.
**Risk:** Corpus files may be malformed or use OOXML features pptxtojson doesn't support.
**Mitigation:** Validate corpus files before adding. Skip unsupported files with clear reason.
**Risk:** Float precision differences in round-trip diff.
**Mitigation:** Use tolerance: 0.01 for floats, 1px for positions, normalized strings for text.
