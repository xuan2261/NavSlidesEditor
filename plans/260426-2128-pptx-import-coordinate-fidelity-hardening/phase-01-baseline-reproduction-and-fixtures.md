---
phase: 1
title: "Baseline Reproduction And Fixtures"
status: completed
priority: P1
effort: "1-2d"
dependencies: []
---

# Phase 1: Baseline Reproduction And Fixtures

## Context Links
- `server/services/pptx-import/mapper.js`
- `server/services/pptx-import/mapper.test.js`
- `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- `docs/pptx-import-fidelity-report.md`
- `plans/reports/debug-260426-2125-deep-feature-synthesis-audit.md`

## Overview
Create failing, precise evidence for PPTX import drift before changing mapper
logic. Existing average fidelity scores are too coarse; this phase captures
geometry/property drift by element type.

## Key Insights
- Current strict corpus passes 97.0% semantic / 99.0% round-trip, but user sees
  visible drift.
- `mapper.js` uses direct scale and some fallback logic that can hide bad input.
- Line renderer expects local `x1/y1/x2/y2` inside element bounds.

## Requirements
- Functional: reproduce wrong x/y/width/height, line endpoint, crop, table size,
  group transform, and text inset cases.
- Non-functional: no sensitive raw PPTX output committed; generated fixtures ok.

## Architecture
```text
fixture PPTX / synthetic pptxtojson JSON
  -> mapPptxOutput()
  -> geometry/property assertions
  -> drift report by type
```

## Related Code Files
- Modify: `server/services/pptx-import/mapper.test.js`
- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- Create: `server/services/pptx-import/geometry-drift.test.js`
- Optional create: `server/services/pptx-import/test-fixtures/` generated JSON only

## Tests Before
- Add failing tests for zero coordinates:
  - `left: 0`, `top: 0`, `width`, `height` preserved exactly.
  - `left: 0` does not fallback to `x` unexpectedly.
- Add failing tests for non-16:9 decks:
  - source size `1280x720`, `1920x1080`, `1024x768`, custom widescreen.
  - assert scaled coordinates against `960x540`.
- Add failing line tests:
  - absolute endpoints from source converted to local endpoints.
  - wrapper box equals min/max endpoint box.
- Add failing crop tests:
  - imported `cropData` renders or converts to editor crop model.
- Add failing group tests:
  - nested group offset + rotation + flip preserve child bounding boxes.

## Implementation Steps
1. Inventory current fixture coverage in `mapper.test.js`; mark gaps by type.
2. Add synthetic `pptxtojson` outputs that isolate one coordinate issue each.
3. Add drift helper in tests: compare expected vs actual x/y/w/h with tolerance.
4. Extend fidelity tester with optional geometry diagnostic output:
   max drift px, median drift px, by type.
5. Run baseline and save result in
   `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/reports/baseline-drift.md`.
6. Do not fix in this phase.

## Todo List
- [x] Add synthetic geometry drift tests.
- [x] Add non-16:9 source size tests.
- [x] Add line endpoint local/global tests.
- [x] Add crop visual-model test.
- [x] Produce baseline drift report.

## Success Criteria
- [x] At least 5 failing tests prove current drift/loss.
- [x] Existing tests still runnable.
- [x] Baseline report says which element types drift and by how many px.
- [x] No raw parser dump committed.

## Risk Assessment
- Risk: synthetic fixtures may not match real parser output.
- Mitigation: pair synthetic tests with at least one generated/real PPTX fixture
  before Phase 5 gate.

## Security Considerations
- PPTX remains untrusted ZIP/XML.
- Do not commit raw full-content parser dumps.
- Keep parser child-process boundary unchanged.

## Regression Gate
```bash
npm run test -- server/services/pptx-import/mapper.test.js server/services/pptx-import/geometry-drift.test.js
```

## Next Steps
- Phase 2 implements geometry normalizer after baseline proves failure modes.
