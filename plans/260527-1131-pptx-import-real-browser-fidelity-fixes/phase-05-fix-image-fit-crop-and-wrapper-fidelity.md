# Phase 05 Fix Image Fit Crop And Wrapper Fidelity

## Context Links

- Image clipping slides in audit: `Bai3#16/#29/#32/#34/#35/#39/#52/#61/#78`, `Bai_2_1#24/#31/#32/#35/#36/#37`, `Bai_2_5#11/#14/#15/#27/#31/#44`
- Image mapper: [map-image.js](../../server/services/pptx-import/mapper/map-image.js)
- Editor image render: [canvas-element-wrapper.jsx](../../client/src/components/canvas/canvas-element-wrapper.jsx)
- Shared image render: [element-renderers.js](../../shared/src/element-renderers.js)

## Overview

Priority: P0. Status: complete. Fix 28 image clipping hits without removing legitimate PowerPoint crop behavior.

## Key Insights

- Baseline audit marked 28 `image-outside-wrapper` hits when the actual `<img>` box exceeded wrapper.
- All 28 hits were source crop cases and are now reported as `intentionalImageCrop`, not strict failures.
- 9 image wrappers were outside canvas after crop classification; importer now fits image boxes within slide bounds.

## Requirements

- Functional: preserve true PPTX crop when source has crop rect.
- Functional: avoid accidental image cut from wrong `imageW`, `imageH`, `imageOffsetX`, `imageOffsetY`.
- Functional: editor and shared export render identical image box/crop semantics.
- Functional: audit verifies crop intent from parsed source/import metadata, not only renderer-owned DOM flags.
- Non-functional: no data loss for EMF/PNG/JPEG/GIF media.

## Architecture

```text
pptx blip + crop rect
  -> map-image
  -> element cropData/objectFit/offset metadata
  -> editor image renderer
  -> audit classifies intentional crop vs unexpected clipping
```

## Related Code Files

- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/map-image.js`
- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/map-image.test.js`
- Modify: `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
- Modify: `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-helper.js`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pptx-import-real-browser-audit.spec.js`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-report-helper.js`

## Implementation Steps

1. RED: create tests for imported image with:
   - no crop -> img must stay inside wrapper
   - source crop -> clipping allowed and recorded as intentional
   - offset/size mismatch -> normalized to visible wrapper
2. Inspect mapper crop metadata for all 28 image hits.
3. Normalize image representation:
   - use `objectFit: contain` when no crop.
   - use `cropData` and explicit offsets only when source crop exists.
   - keep `imageW/H/Offset` consistent with wrapper and crop bounds.
4. Update editor renderer to expose `data-pptx-crop-intent` only as diagnostic. Audit authority must be parsed source crop metadata or an import-time metadata fingerprint tied to element id and expected crop bounds.
5. Update shared renderer to match editor.
6. Update export renderer only if the mapper/editor fix changes exported crop behavior; otherwise keep export scope limited and document no-impact evidence.

## Tests

- Unit:
  - `map-image.test.js` maps no-crop image without offset overflow.
  - crop rect maps to bounded `cropData`.
  - crop percentages clamp 0..1 and never produce negative sizes.
- Component:
  - image without crop has `imgRect` inside wrapper.
  - image with source crop is marked intentional.
- E2E:
  - strict audit image gate `unexpectedImageClip=0`.
  - report still lists `intentionalCrop` separately if source crop exists.
  - crop intent cannot be accepted solely because a DOM attribute says so.
- Commands:
  ```bash
  npx vitest run server/services/pptx-import/mapper/map-image.test.js
  npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx
  npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0
  ```

## Todo List

- [x] Add image crop intent tests.
- [x] Fix mapper normalization.
- [x] Add renderer data attributes for audit.
- [x] Verify unexpected image clipping drops from 28 to 0.

## Progress Evidence

- `map-image` now fits image boxes within canvas bounds and records `_pptxImportMeta.sourceCrop=true` when source crop rect exists.
- Editor wrapper exposes source crop diagnostics via `data-pptx-crop-intent="source-crop"` and bounded crop data.
- Shared renderer clips source-cropped images like the editor instead of exporting them with `overflow:visible`.
- Audit classifies source crop separately as `intentionalImageCrop`; unexpected image clipping remains strict-failing.
- Latest full 5-deck real-browser audit: `failedSlides=0`, `image=0`, `intentionalImageCrop=28`, `unexpectedOutOfCanvas=0`, `strictFailures=0`.
- Artifact: `plans/reports/pptx-import-real-browser-audit-runs/2026-05-27T09-06-22-051Z-12732/pptx-import-real-browser-audit.json`.

## Success Criteria

- No unexpected image clipping in browser audit: met.
- Intentional crop, if present, is explicitly reported and tied to source crop metadata: met.
- Export/import roundtrip image crop tests still pass: targeted import/crop and audit tests pass; broader corpus remains Phase 08.

## Risk Assessment

- Risk: changing crop semantics regresses export PPTX. Mitigation: update export tests in same phase.
- Risk: EMF conversion images have odd dimensions. Mitigation: test with real corpus samples.
- Risk: audit becomes circular. Mitigation: compare DOM clipping against source crop metadata/fingerprint, not renderer self-labels.

## Security Considerations

- Keep media path allowlist and dedup rules from previous plan, and re-verify in this phase: allowed schemes only, no external fetch, normalized archive paths, MIME sniffing, max bytes/pixels, reject active SVG-as-image, and safe EMF handling.

## Next Steps

Align shared renderers in Phase 06.
