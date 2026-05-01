---
phase: 5
title: "Corpus Gates And Visual Verification"
status: completed
priority: P1
effort: "2-3d"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Corpus Gates And Visual Verification

## Context Links
- `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- `server/services/pptx-import/harness-integration.test.js`
- `server/services/pptx-import/roundtrip-matching.test.js`
- `server/data/test-corpus/`
- `PPTX/`
- `tests/e2e/visual-regression.spec.js`

## Overview
Make the fidelity harness catch the exact class of regressions the user sees:
coordinate drift, property loss, element count loss, and visual mismatch. Current
overall scores stay useful but are not strict enough per element type.

## Key Insights
- Average semantic and round-trip scores can hide severe drift in one element
  category.
- Real corpus is small (`PPTX/` has 4 decks), so generated deterministic decks
  are needed for geometry/property coverage.
- Visual verification should be targeted and deterministic, not broad snapshot
  churn.

## Requirements
- Functional: strict corpus run fails on excessive geometry drift per type.
- Functional: generated fixtures cover text, image crop, shape, line, table,
  chart, group, and mixed-content slides.
- Non-functional: visual tests are deterministic and low-flake.

## Architecture
```text
generated fixture decks + existing PPTX corpus
  -> import
  -> semantic/property/geometry metrics by type
  -> optional round-trip
  -> targeted Playwright visual check
```

## Related Code Files
- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- Modify: `server/services/pptx-import/harness-integration.test.js`
- Modify: `server/services/pptx-import/roundtrip-matching.test.js`
- Create: `server/services/pptx-import/generated-fixtures.test.js`
- Create: `tests/e2e/pptx-import-fidelity.spec.js`
- Optional create: `server/services/pptx-import/test-fixtures/generated/`

## Tests Before
- Add failing harness test where overall score passes but line drift fails.
- Add failing per-type gate test for:
  - line geometry.
  - image crop.
  - group transform.
  - table sizing.
- Add generated fixture test that imports known synthetic parser output and
  asserts by-type metric payload.
- Add Playwright test outline that compares imported bounding boxes on canvas
  against expected stored fixture boxes.

## Implementation Steps
1. Extend fidelity tester output with:
   - `geometryDrift.maxPx`
   - `geometryDrift.medianPx`
   - `geometryDrift.byType`
   - `propertyCoverage.byType`
   - `elementCount.byType`
2. Add strict per-type gates:
   - text/shape/line/image/table: geometry max <= 3 px for generated fixtures.
   - group flattened children: max <= 5 px.
   - chart/table property coverage must not drop below current baseline.
3. Keep existing overall semantic >= 95% and round-trip >= 98% gates.
4. Generate or store deterministic fixtures with no proprietary content.
5. Add Playwright helper to load imported presentation, inspect `.slide-element-*`
   bounding boxes, and compare to fixture expectations.
6. Save final corpus summary in plan reports:
   `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/reports/fidelity-gate-result.md`.

## Todo List
- [x] Add by-type geometry/property metrics.
- [x] Add per-type strict gates.
- [x] Add generated fixture coverage.
- [x] Add targeted Playwright import fidelity spec.
- [x] Save corpus gate result report.

## Success Criteria
- [x] Harness can fail a single bad element type even when average score passes.
- [x] `npm run test:corpus` reports by-type drift and property coverage.
- [x] Generated fixture tests are deterministic.
- [x] Playwright import fidelity test checks real editor rendering positions.

## Risk Assessment
- Risk: Playwright bounding boxes vary by browser/font.
- Mitigation: disable animations, use deterministic fonts, compare logical
  canvas-relative boxes with tolerance.
- Risk: generated decks diverge from real parser output.
- Mitigation: pair generated fixtures with existing `PPTX/` corpus and allow
  local-only proprietary deck runs outside git.

## Security Considerations
- Keep corpus files non-confidential.
- Do not log full slide text from proprietary decks in reports.
- Reuse existing PPTX ZIP guards; this phase does not loosen import limits.

## Regression Gate
```bash
npm run test -- server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js server/services/pptx-import/generated-fixtures.test.js server/services/pptx-import/roundtrip-matching.test.js
npm run test:corpus
npx playwright test tests/e2e/pptx-import-fidelity.spec.js
```

## Next Steps
- Phase 6 verifies the fixed import still behaves correctly through the editor
  upload, selection, property panel, save, and reload path.
