---
phase: 3
title: "Ribbon Control Dimension Normalization"
status: complete
effort: "3-5h"
---

# Phase 3: Ribbon Control Dimension Normalization

## Context Links

- [RibbonSection](../../client/src/components/ribbon/ribbon-section.jsx)
- [Format tab](../../client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx)
- [Font controls](../../client/src/components/ribbon/controls/ribbon-text-formatting-controls.jsx)
- [Paragraph controls](../../client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.jsx)
- [Canvas controls](../../client/src/components/ribbon/controls/canvas-controls.jsx)

## Overview

Priority: P1. Normalize ribbon input/select/button/slider rhythm so controls align consistently. Focus Format tab first.

## Key Insights

- Format measured: inputs 20px high, buttons 32px high, slider 4px high.
- Uneven rhythm reads as “lệch” even with no geometric overlap.
- `RibbonSection` gives shell; child controls need consistent row wrappers.

## Requirements

Functional:
- Standardize ribbon row control wrappers to 28 or 32px.
- Keep range track thin, but center it in stable-height wrapper.
- Keep existing labels and aria-labels.

Non-functional:
- No broad CSS file migration.
- Avoid abstraction unless it removes real duplication.
- Do not change slide element update semantics.

## Architecture

Preferred minimal helpers:
- `ribbonInputClass`
- `ribbonSelectClass`
- `ribbonIconButtonClass`
- `RibbonControlRow`

Extract to new file only if reused by 3+ modules and stays under 200 LOC.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\ribbon-text-formatting-controls.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\paragraph-formatting-and-alignment-controls.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\canvas-controls.jsx`

Create:
- Optional: `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\ribbon-control-primitives.jsx`
- Optional test: `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\controls\ribbon-control-primitives.test.jsx`

Delete: None.

## TDD Tests First

1. Add/extend component tests for Format controls:
   - Render selected element.
   - Assert controls expose stable dimension contract.
2. Extend E2E metric:
   - Format control wrappers have accepted heights.
   - Slider wrapper height accepted; slider track can be smaller.

## Implementation Steps

1. Choose exact contract: `h-7` compact or `h-8` Button parity.
2. Normalize Format numeric inputs.
3. Normalize selects/inputs in Font, Paragraph, Canvas.
4. Wrap opacity slider in `h-7`/`h-8 flex items-center`.
5. Prefer focus token if aligned with standards.
6. Re-run Phase 1/2 tests.

## Todo List

- [ ] Add failing Format rhythm test.
- [ ] Normalize Format position/size/rotate/opacity/align/properties.
- [ ] Normalize Font and Paragraph selects.
- [ ] Normalize Canvas grid input.
- [ ] Re-run E2E metric suite.

## Success Criteria

- Format tab no longer has mixed row alignment.
- E2E reports no outside controls caused by sizing regressions at 1280px.
- Existing selected element updates still work.

## Risk Assessment

- Too much abstraction bloats files. Mitigation: local constants first.
- Style tests brittle. Mitigation: class contract + browser metrics.

## Security Considerations

- No security changes.

## Verification

```powershell
npm run test -- --run client/src/components/ribbon
npm run test:e2e -- tests/e2e/editor.spec.js
```

## Next Steps

Proceed to Insert tab compaction.
