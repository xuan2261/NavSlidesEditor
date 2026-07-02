# NavSlides Editor v1.15.2

Release date: 2026-07-02

## Highlights

- Fixed New Presentation `Start from` creation for built-in non-UUID deck starter IDs.
- Made blank presentations, new templates, added slides, Markdown elements, and selected slide templates honor active design tokens for theme-aware backgrounds and text.
- Synchronized base reveal theme selection with the matching design token preset.
- Resolved `auto` colors in PPTX export for client and server renderers, including native text, shapes, lines, callouts, tables, slide backgrounds, and raster fallbacks for icons, drawings, and Markdown.
- Added regression coverage for theme token mappings, Markdown auto colors, slide-template contrast guards, presentation creation, and PPTX auto-color export.

## Verification

- `npm run test -- shared/tests/theme-presets.test.js shared/tests/design-tokens.test.js client/src/components/canvas/element-renderers/markdown-element-renderer.test.jsx client/src/data/slide-templates.test.js server/routes/presentations.test.js shared/tests/htmlgenerator-golden-baseline.test.js shared/tests/present-mode-section-styles.test.js client/src/utils/exportPptx.test.js server/utils/server-basic-renderers.test.js server/utils/server-export.test.js server/routes/pptx-export.test.js`
- `npm run test -- client/src/data/element-defaults.test.js client/src/components/ribbon/design-tab-content.test.jsx client/src/hooks/use-slide-operations.child-slides.test.js client/src/pages/__tests__/editor-page-slide-ops.characterization.test.jsx`
- `npm run lint` (0 errors; existing warnings only)
- `npm run build`
