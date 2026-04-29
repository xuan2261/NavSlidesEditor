---
phase: 3
title: "Element Property Mapping Hardening"
status: completed
priority: P1
effort: "2-3d"
dependencies: [1, 2]
---

# Phase 3: Element Property Mapping Hardening

## Context Links
- `server/services/pptx-import/mapper.js`
- `server/services/pptx-import/chart-output-to-navslides-mapper.js`
- `client/src/components/properties/import-fidelity-properties.test.jsx`
- `client/src/utils/export-pptx-basic-renderers.js`
- `client/src/utils/export-pptx-core.test.js`
- `shared/src/element-renderers.js`

## Overview
Fix property loss after geometry is normalized. Preserve editable controls and
source metadata for text, shapes, images, tables, charts, and slide-level values
without changing the public presentation schema unless unavoidable.

## Key Insights
- User-visible loss is not only x/y drift. It includes crop, text formatting,
  stroke/fill, table dimensions, chart metadata, opacity, rotation, and z-order.
- Existing tests cover many happy paths but do not assert enough imported
  controls are visible/editable in the editor.
- Sidecar metadata is acceptable when NavSlides cannot fully edit a PPTX detail,
  but renderer/export must ignore it safely.

## Requirements
- Functional: imported elements expose correct editor controls after selection.
- Functional: text style, shape fill/stroke, image crop/border/flip, table cell
  sizes/styles, chart datasets/options survive import.
- Non-functional: keep editable output first; use locked placeholder only when
  parser data is absent or unsupported.

## Architecture
```text
pptxtojson element
  -> geometry normalized base element
  -> property mapper per element type
  -> NavSlides editable schema + _pptx* sidecar where needed
  -> editor property panel + renderer/export verification
```

## Related Code Files
- Create: `server/services/pptx-import/property-mapping.test.js`
- Modify: `server/services/pptx-import/mapper.js`
- Modify: `server/services/pptx-import/mapper.test.js`
- Modify: `client/src/components/properties/import-fidelity-properties.test.jsx`
- Modify: `client/src/utils/export-pptx-core.test.js`
- Modify: `client/src/utils/export-pptx-basic-renderers.js` only if import
  schema already has data that export drops.

## Tests Before
- Add failing assertions for imported text:
  - font family, font size, color, bold/italic/underline, alignment.
  - text inset/margin if parser exposes it.
- Add failing assertions for shapes:
  - fill color, transparent/no fill, gradient sidecar, stroke color/width/dash.
  - opacity and rotation retained.
- Add failing assertions for images:
  - crop ratios clamped to `0..1`.
  - existing renderer crop model receives equivalent data.
  - alt text, border, flip retained.
- Add failing assertions for tables:
  - `colWidths`, `rowHeights`, merged cells, per-cell text/bg/align.
- Add failing assertions for charts:
  - labels, datasets, series colors, original chart meta.

## Implementation Steps
1. Split property extraction helpers inside `mapper.js` only if it reduces
   duplication; do not create a generic abstraction without repeated logic.
2. Use explicit allowlists per element type:
   text, shape, image, table, chart, slide metadata.
3. Preserve unsupported but harmless PPTX details under `_pptxMeta`,
   `_pptxChartMeta`, or element-local `_pptxImportMeta`.
4. Normalize units for properties:
   - stroke width in canvas px.
   - font size in editor pt/px convention already used by export.
   - crop as ratios or as existing image crop fields, not both ambiguous.
5. Update property panel SSR test so imported chart/table data produces controls
   users can edit.
6. Update export unit tests only for properties now expected to round-trip.

## Todo List
- [x] Add `property-mapping.test.js`.
- [x] Preserve text style and inset metadata.
- [x] Harden shape fill/stroke/dash/opacity mapping.
- [x] Normalize image crop to renderer-compatible model.
- [x] Preserve table sizing and cell styles.
- [x] Preserve chart editable datasets and sidecar metadata.
- [x] Verify imported controls render in property panels.

## Success Criteria
- [x] Imported element properties match fixture expectations with tolerance.
- [x] Property panel tests prove controls exist for imported data.
- [x] No broad schema rewrite.
- [x] No new placeholder for an element type that can remain editable.

## Risk Assessment
- Risk: sidecar metadata grows without renderer support.
- Mitigation: every sidecar field must have either a consumer, test, or explicit
  documented future reason.
- Risk: crop data model mismatch between mapper and image renderer.
- Mitigation: choose one canonical model in this phase and cover with unit tests.

## Security Considerations
- Continue sanitizing rich text and shape text before metadata extraction.
- Do not trust PPTX-provided URLs beyond existing media persistence rules.
- Keep chart labels/dataset text as data, not executable HTML.

## Regression Gate
```bash
npm run test -- server/services/pptx-import/property-mapping.test.js server/services/pptx-import/mapper.test.js client/src/components/properties/import-fidelity-properties.test.jsx client/src/utils/export-pptx-core.test.js
```

## Next Steps
- Phase 4 applies the same rigor to grouped/nested transforms and connector
  geometry.
