---
phase: 6
title: "Editor Integration And Import UX"
status: completed
priority: P2
effort: "1-2d"
dependencies: [3, 5]
---

# Phase 6: Editor Integration And Import UX

## Context Links
- `client/src/utils/api.js`
- `client/src/utils/pptx-import-summary.js`
- `client/src/utils/pptx-import-summary.test.js`
- `client/src/components/SlideCanvas.jsx`
- `client/src/components/properties/`
- `tests/e2e/element-properties.spec.js`
- `tests/e2e/properties-panel.spec.js`

## Overview
Verify the improved server import survives the full editor workflow. Imported
elements must appear at correct positions, expose expected controls, save, reload,
and export without losing the normalized geometry/properties.

## Key Insights
- Server mapper correctness is insufficient if the client drops fields, fails to
  render them, or property controls do not surface them.
- Existing property selector work is completed and should be reused instead of
  adding unstable selectors.
- Import warnings should tell users what was approximated, not hide data loss.

## Requirements
- Functional: imported elements render on `SlideCanvas` at mapper coordinates.
- Functional: selected imported elements show relevant property controls.
- Functional: presentation save/reload preserves imported geometry/properties.
- Non-functional: no broad UI redesign; only import fidelity UX/reporting.

## Architecture
```text
POST /api/pptx/import
  -> presentation payload
  -> client import summary
  -> editor canvas render
  -> property panel edit
  -> save/reload persistence
```

## Related Code Files
- Modify: `client/src/utils/pptx-import-summary.js`
- Modify: `client/src/utils/pptx-import-summary.test.js`
- Modify: `client/src/components/SlideCanvas.jsx` only if renderer drops fields.
- Modify: `client/src/components/properties/import-fidelity-properties.test.jsx`
- Modify: `tests/e2e/pptx-import-fidelity.spec.js`
- Modify: `tests/e2e/properties-panel.spec.js` only for selector reuse.

## Tests Before
- Add failing summary tests for warnings:
  - geometry clamped.
  - unsupported crop converted.
  - group flattened.
  - placeholder created.
- Add E2E assertions:
  - import deck.
  - bounding boxes match fixture expectations.
  - select imported text/image/table/chart/line.
  - property controls are visible.
  - edit one property, save, reload, assert persisted state.

## Implementation Steps
1. Audit client import path to find where server fields enter presentation state.
2. Update `pptx-import-summary.js` to group fidelity warnings by severity:
   exact, approximated, placeholder, failed.
3. If the client drops normalized fields, patch the narrow receiving code only.
4. If `SlideCanvas` rendering differs from exported renderer, add the smallest
   compatibility fix and cover with tests.
5. Extend property panel tests for imported sidecar-backed data only where users
   can edit it.
6. Add E2E save/reload check using existing API fixture helpers and stable
   selectors.

## Todo List
- [x] Audit client field preservation.
- [x] Improve import warning summary.
- [x] Add property visibility checks.
- [x] Add save/reload E2E for imported elements.
- [x] Verify canvas bounding boxes after import.

## Success Criteria
- [x] Imported elements remain positioned after save/reload.
- [x] Property controls show for imported editable data.
- [x] Import warnings distinguish approximation from hard failure.
- [x] No new unstable CSS-only selectors where stable selectors exist.

## Risk Assessment
- Risk: fixing rendering in `SlideCanvas` impacts hand-authored elements.
- Mitigation: add regression assertions using existing element property tests.
- Risk: warning UX becomes noisy.
- Mitigation: aggregate repeated warnings and keep technical detail in logs/tests.

## Security Considerations
- Do not expose raw PPTX internals containing private text in visible warnings.
- Continue client-side rendering through existing sanitized fields.
- Preserve trusted HTML embed policy; this plan is PPTX import focused.

## Regression Gate
```bash
npm run test -- client/src/utils/pptx-import-summary.test.js client/src/components/properties/import-fidelity-properties.test.jsx
npx playwright test tests/e2e/pptx-import-fidelity.spec.js tests/e2e/properties-panel.spec.js
```

## Next Steps
- Phase 7 updates project docs and runs final gates before handing to `/ck:cook`
  implementation.
