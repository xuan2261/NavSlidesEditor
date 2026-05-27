# NavSlides Editor v1.9.8

Release date: 2026-05-27

## Highlights

- Fixed PPTX unit conversion across import/export for rich text, direct text, shapes, code blocks, callouts, tables, strokes, borders, and shadows.
- Normalized non-default 4:3 PPTX imports to the canonical 960x540 canvas while preserving source slide dimensions for export.
- Improved rich shape text and table fidelity, including per-cell font metadata, row/column style matrix alignment, text insets, and SVG foreignObject rendering.
- Hardened shared/client/server content sanitization for CSS lengths, unsafe URL tokens, unquoted event attributes, and unsafe URL attributes.
- Added strict PPTX acceptance invariants and expanded the default corpus to 11 decks, including a non-default 4:3 resolution fixture.
- Fixed round-trip matching so exported text boxes re-imported as textual rectangle shapes remain text-equivalent in stability metrics.

## Verification

- `npm run build` passed.
- `npm run lint` passed with 0 errors and pre-existing warnings from the local untracked debug script.
- `npm run test:corpus` passed: 11/11 decks.
- Focused Vitest slices passed for PPTX mapper, export, sanitizer, matcher, and table/rendering changes.
