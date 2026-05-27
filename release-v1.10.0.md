# NavSlides Editor v1.10.0

Release date: 2026-05-27

## Highlights

- Fixed PPTX import real-browser fidelity across the 5-deck / 227-slide audit corpus.
- Reduced text overflow, unexpected image clipping, unexpected out-of-canvas placement, and SVG console errors to zero in the strict audit results.
- Added bounded fit/wrap metadata for imported text with edit invalidation.
- Aligned shared HTML, PPTX export, server, and canvas renderers around the same imported text/image/shape layout contract.
- Added strict PPTX browser audit commands for PR smoke checks and full release gates.

## Verification

- `npm run test` (192 files / 1629 tests)
- `npm run test:corpus` (11/11)
- `npm run test:pptx:browser-audit`
- `npm run test:pptx:browser-audit:full`
- `npm run build`
- `npm run lint` with 0 errors and 7 pre-existing warnings from a local debug artifact
