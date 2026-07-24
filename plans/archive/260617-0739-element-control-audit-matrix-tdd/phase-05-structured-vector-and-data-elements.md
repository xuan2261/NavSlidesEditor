# Phase 05 Structured Vector And Data Elements

## Context Links

- `C:/Work/NavSlidesEditor/client/src/components/properties/shape-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/table-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/timeline-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/misc-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/*`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`

## Overview

Priority: P1
Status: Completed
Goal: verify shape, line, table, icon, callout, QR, drawing, SVG, and timeline controls; close ambiguity around table merge authoring and drawing path edits.

## Key Insights

- Old gaps for table border/header, SVG edit, and timeline connector are fixed in source.
- Table merged cells are render/export-supported, but no obvious merge/unmerge authoring UI.
- Drawing controls may only affect defaults, not existing paths.
- Many vector/misc elements export to PPTX fallback, not native editable objects.

## Requirements

Functional:
- Verify shape fill/stroke/opacity/border radius/label controls.
- Verify line stroke/dash/markers and no dead Fill control.
- Verify table row/col, header, colors, border style, cell styles.
- Document table merge/unmerge authoring as out of scope/read-only import fidelity for this plan.
- Verify merged-cell invariants when rows/columns are added, removed, or resized.
- Verify SVG markup/override/reset.
- Verify icon/callout/QR controls.
- Verify timeline event controls including connector length.
- Verify drawing stroke controls semantics.

Non-functional:
- Do not add complex spreadsheet/table editor beyond matrix scope.
- Keep each renderer test under focused assertions.

## Architecture

```text
PropertiesPanel type router
  -> type-specific property editor
  -> React canvas renderer / inline wrapper
  -> shared HTML renderer
  -> PPTX native for shape/line/table/callout, fallback for others
```

## Related Code Files

Tests:
- `C:/Work/NavSlidesEditor/client/src/components/properties/shape-properties.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/table-properties.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/timeline-properties.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/misc-properties-vector-controls.test.jsx`
- `C:/Work/NavSlidesEditor/shared/tests/element-renderers.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.test.js`
- `C:/Work/NavSlidesEditor/tests/e2e/canvas/structured-element-controls.spec.js`

Potential source:
- `C:/Work/NavSlidesEditor/client/src/components/properties/shape-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/table-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/timeline-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/misc-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/table-element-renderer.jsx`
- `C:/Work/NavSlidesEditor/shared/src/table-merge-resolver.js`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`

## Tests First

1. RTL: shape controls update fill/stroke/strokeWidth/opacity/radius/text fields.
2. RTL: line controls exclude fill and update dash/markers.
3. RTL: table controls update rows/cols, header, border style, per-cell style.
4. Unit: table mergedCells render with correct colspan/rowspan in shared HTML and PPTX table rows.
5. Unit: row/column add/remove repairs, clamps, or drops invalid `mergedCells` ranges before canvas/shared/PPTX render.
6. Decision test: merge authoring row is marked read-only/partial.
7. RTL/security: SVG markup edit, fill/stroke override, reset, and malicious SVG payloads are sanitized consistently.
8. RTL: icon/callout/QR controls update canonical fields.
9. RTL: timeline connector length updates event connector field and shared render consumes it.
10. Drawing test: changing element stroke controls existing paths or explicitly remains default-only.

Commands:

```bash
npm run test -- client/src/components/properties/table-properties.test.jsx
npm run test -- client/src/components/canvas/element-renderers/table-element-renderer.test.jsx
npm run test -- shared/tests/element-renderers.test.js
# No Phase 05-specific E2E file is required in this pass; coverage is component/unit/shared-render focused.
```

## Implementation Steps

1. Add missing property tests around current source behavior.
2. Fix any dead/no-op control.
3. Lock table merge authoring decision:
   - Merge/unmerge UI is out of scope for this audit plan.
   - Imported/read-only merged cells stay `partial`.
   - Row/column mutations must not leave invalid merge ranges.
4. Clarify drawing stroke behavior:
   - If UI says default only, label it clearly.
   - If global apply, update paths and tests.
5. Add malicious SVG fixture coverage for canvas/shared/export/raster paths.
6. Update matrix rows and status evidence.

## Todo List

- [x] Add shape/line tests.
- [x] Add table tests.
- [x] Add table merged-cell mutation invariant tests.
- [x] Mark table merge authoring read-only/partial.
- [x] Add SVG/misc vector tests.
- [x] Add malicious SVG fixture tests.
- [x] Add timeline connector test.
- [x] Clarify drawing control semantics.
- [x] Update matrix.

## Success Criteria

- No stale old-audit gaps remain for table/SVG/timeline.
- Table merge status is intentional, not accidental.
- Table row/column mutations cannot corrupt merged-cell ranges.
- Drawing status matches real behavior and label.
- PPTX fallback rows explicitly identified.

## Risk Assessment

- Risk: table authoring scope grows.
  Mitigation: merge/unmerge authoring is explicitly out of scope for this plan.
- Risk: drawing path update changes existing artwork.
  Mitigation: preserve existing paths unless UI says apply all.

## Red Team Review Applied

- Finding 4/11: table merge authoring is locked to read-only/import fidelity, with row/column mutation invariants required.
- Finding 10: SVG sanitization needs adversarial fixtures, not only a general security note.

## Security Considerations

<!-- Updated: Validation Session 1 - SVG security work focuses on sanitizer policy and adversarial tests, not broad renderer/runtime redesign. -->

- SVG content must remain sanitized.
- QR data should be escaped in shared render paths.
- SVG tests must include scripts, event attributes, `foreignObject`, unsafe `href`/`xlink:href`, and external references across canvas/shared/export/raster paths.
- Runtime hardening beyond enforcing the existing SVG sanitizer policy is out of scope for this audit plan.

## Next Steps

Phase 06 covers game elements and live-only export policy.
