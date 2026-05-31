---
phase: 3
title: "Shape geometry drift diagnostic + fix"
status: complete
priority: P1
effort: "3d"
dependencies: [1]
---

# Phase 3 — Shape Geometry Drift Diagnostic + Fix

## Context Links

- Brainstorm: P0-D
- Diagnostic report: `plans/260524-1729-pptx-import-review/reports/geometry-drift-diagnostic.md`
- Drift before fix: `plans/260524-1729-pptx-import-review/reports/shape-drift-baseline.json`
- Drift after fix: `plans/260524-1729-pptx-import-review/reports/shape-drift-after-source-transform.json`
- Code: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- Tests: `server/services/pptx-import/geometry-drift.test.js`

## Overview

- Priority: P1
- Current status: Complete
- Brief: Added per-shape drift diagnostics, identified root cause, and fixed the diagnostic metric. No mapper geometry behavior change was needed.

## Key Insights

- The apparent 121-364px shape drift was a tester-side diagnostic error.
- Grouped PPTX children were flattened as local group coordinates, then compared against absolute NavSlides canvas coordinates.
- Applying group transforms to source children before comparison reduced median shape drift to 0px on Bai_2_1, Bai_2_2, and Bai_2_5.

## Requirements

- Emit per-shape drift JSON through `--drift-out=<path>`.
- Include enough context to diagnose outliers: `deckName`, `slideIdx`, `sourceIdx`, `flattenedIdx`, `sourcePath`, `kind`, `origin`, `mapped`, `deltaPx`.
- Avoid mapper behavior churn unless the diagnostic proves mapper geometry is wrong.

## Architecture

- `computeDetailedFidelityMetrics` now returns `shapeDriftDetails`.
- `buildSourceGroupMatrix` and `transformSourceChild` apply grouped source transforms before comparison.
- `writeDriftRows` writes the CLI drift rows and is unit tested without spawning a full corpus run.

## Related Code Files

- Modified: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- Modified: `server/services/pptx-import/geometry-drift.test.js`
- Created: `plans/260524-1729-pptx-import-review/reports/geometry-drift-diagnostic.md`
- Created: `plans/260524-1729-pptx-import-review/reports/shape-drift-baseline.json`
- Created: `plans/260524-1729-pptx-import-review/reports/shape-drift-after-source-transform.json`
- Not modified: `server/services/pptx-import/mapper.js` for Phase 3 behavior
- Not modified: `server/services/pptx-import/geometry.js`

## Implementation Steps

1. Added `--drift-out=<path>` CLI support.
2. Added per-shape diagnostic rows to `computeDetailedFidelityMetrics`.
3. Ran baseline drift output against `PPTX/`.
4. Found outliers concentrated in grouped source paths such as `6.2.33`, `5.0.19`, and `6.7.41.1`.
5. Fixed tester source flattening to apply group matrix transforms before geometry comparison.
6. Re-ran drift output and confirmed all large shape drifts disappeared.
7. Documented diagnosis and before/after evidence.

## Todo List

- [x] Add `--drift-out=<path>` CLI flag.
- [x] Emit per-shape drift JSON.
- [x] Generate baseline drift JSON.
- [x] Identify root cause.
- [x] Fix the diagnostic metric.
- [x] Add unit coverage for drift row shape.
- [x] Add unit coverage for drift writer output.
- [x] Add unit coverage for grouped and nested rotated source transforms.
- [x] Run importer Vitest suite.
- [x] Run strict corpus gate.
- [x] Run production build.

## Success Criteria

- Bai_2_1 median shape drift: `364.5px -> 0px`.
- Bai_2_2 median shape drift: `121.04px -> 0px`.
- Bai_2_5 median shape drift: `325.91px -> 0px`.
- All four corpus decks pass strict gate.

## Validation

- `npx vitest run server/services/pptx-import` — 15 files passed, 210 passed, 1 skipped.
- `npm run test:corpus` — 4/4 decks passed, avg semantic fidelity 100.0%, avg round-trip stability 99.0%.
- `npm run build` — passed.
- `npm test` full suite was not proven in this phase; previous run timed out locally.

## Risk Assessment

- Corpus remains small (`n=4`), so rare geometry edge cases may still exist.
- The fix corrects diagnostic comparison, not every possible geometry mapping issue.
- Large JSON drift artifacts are useful for traceability but not practical for full manual review.

## Security Considerations

- No new request surface.
- No parser behavior change.
- No upload/media trust change in this phase.

## Next Steps

- Continue to Phase 4: per-cell table border extraction.
- Phase 9 should still expand corpus to cover more deck styles.

## Completion Notes

None for Phase 3. Bai_2_2 and connector drift were explained by the same tester-side grouped-source comparison issue in the measured corpus.
