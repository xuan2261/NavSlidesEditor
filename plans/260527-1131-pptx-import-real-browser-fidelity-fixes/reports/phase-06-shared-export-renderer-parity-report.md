# Phase 06 Shared Export Renderer Parity Report

Date: 2026-05-27

## Summary

Phase 06 is complete.

## Changes

- Shared HTML renderer validates imported fitted text font size before emitting CSS.
- Shared HTML renderer clips source-cropped images like the editor and carries source crop diagnostics.
- Shared shape utilities already clamp SVG inner dimensions and preserve imported text wrapping.
- Client PPTX export uses `_pptxImportMeta.fitFontSizePx` for imported text and shape text.
- Server/Electron PPTX export mirrors the same fitted font-size behavior.

## Render Surface Inventory

- Editor canvas: direct React renderers.
- Present/export HTML/PDF: shared `renderElement`/`renderSlideElements`.
- PPTX browser export: client basic renderers.
- PPTX server/Electron export: server basic renderers.
- Speaker/viewer: consume shared/generated slide content, no separate import-specific text/image/shape renderer found.

## Validation

- `npx vitest run shared/tests/element-renderers.test.js shared/tests/shapeUtils.test.js client/src/utils/export-pptx-core.test.js server/utils/server-basic-renderers.test.js client/src/components/canvas/canvas-element-wrapper.test.jsx` passed: 61 tests.
- `npx eslint shared/src/element-renderers.js shared/src/shapeUtils.js client/src/utils/export-pptx-basic-renderers.js server/utils/server-basic-renderers.js client/src/utils/export-pptx-core.test.js server/utils/server-basic-renderers.test.js` passed.
- `npm run build` passed.

## Unresolved Questions

None.
