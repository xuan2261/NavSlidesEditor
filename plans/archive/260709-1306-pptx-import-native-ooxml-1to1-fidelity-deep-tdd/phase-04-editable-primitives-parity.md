---
phase: 4
title: "Editable primitives parity"
status: pending
priority: P0
effort: "5-10d"
dependencies: [2, 3]
tdd: true
---

# Phase 4: Editable primitives parity

## Overview

Bring **text, shape, line, image, table** to SLA-grade editable import: scene-graph nodes of those classes always become editable Nav elements (never permanent placeholders), property/geometry gates tighten, and visual SSIM milestone **≥ 0.95** mean on core corpus decks (text/shape heavy). Theme/placeholder resolution enough so layout text is not missing.

## Requirements

### Functional
- Placeholder permanent types banned for: `text`, `shape`, `line`, `image` (raster), `table`
- Missing media still errors as temporary fail — must surface as import fail in strict mode, not silent empty
- Theme color scheme (`schemeClr`) resolves to sRGB for fills/fonts used by primitives
- Basic layout placeholder inheritance: title/body from slideLayout when slide lacks explicit text (minimal viable)
- Geometry: median drift ≤ 1px, max ≤ 3px for text/shape/line/image/table on generated fixtures (existing gates)
- Color sanitize unified (`sanitizeCssColor` for shape fills — close review finding I4)
- Background images persist to `/uploads` (not unbounded inline data URLs) — closes I6 from review

### Non-functional
- Keep `_pptxImportMeta` fit/crop behavior; invalidate on edit remains
- No regression of 374-test suite intent

## Architecture

- Map path: scene graph node id → mapper → element with `_pptxSource.nodeId`
- Theme resolve helper shared by shape/text/table
- Acceptance criteria **runtime** call in strict mode (`assertPresentationAcceptance`) — closes I2

## Related Code Files

- Modify heavily:
  - `mapper/map-presentation.js`, `map-shape.js`, `map-image.js`, `map-table.js`, `utils-text.js`, `utils-color.js`
  - `geometry.js` if needed
  - `acceptance-criteria.js` + importer strict hook
  - `media.js` background path
- Create:
  - `mapper/theme-resolve.js` + tests
  - `mapper/placeholder-resolve.js` + tests
  - property/geometry golden updates

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T4.1 | schemeClr accent1 → concrete hex/rgb in mapped fill |
| T4.2 | Layout title placeholder without slide text → non-empty text element |
| T4.3 | Strict import: zero `importPlaceholderType` for text/shape/line/image/table on table-shapes-media + Bai subset |
| T4.4 | Runtime `assertPresentationAcceptance` invoked; raw `pt` in HTML fails import |
| T4.5 | Shape fill `red; expression(alert(1))` sanitized / rejected |
| T4.6 | Background image data URL > cap or any bg image → `/uploads/...` URL |
| T4.7 | Golden master snapshots updated intentionally (review diff) |
| T4.8 | Oracle mean SSIM ≥ 0.95 on `background-image-notes-footer`, `table-shapes-media`, `math-rich-text` (if LO) |
| T4.9 | Corpus semantic ≥ 0.98 still |

## Implementation Steps

1. RED T4.1–T4.6 unit.
2. Theme + placeholder resolve.
3. Color sanitize + background persist.
4. Runtime acceptance in strict.
5. Fix geometry/property failures on core decks.
6. Run oracle milestone Phase 04 thresholds.
7. Update fidelity docs: “primitives parity milestone”.

## Success Criteria

- [ ] T4.* green
- [ ] Permanent placeholders = 0 for primitive classes on core corpus
- [ ] SSIM milestone 0.95 (or documented LO-skip with CI LO job green)
- [ ] G0 + G1 green
- [ ] Review items I2/I4/I6 addressed for import path

## Verify

```bash
npx vitest run server/services/pptx-import/mapper server/services/pptx-import/acceptance-criteria.test.js --reporter=dot
npm run test:corpus
npm run test:pptx:oracle -- --milestone phase-04
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Placeholder resolve incomplete | Limit to title/body; full master in Phase 08 |
| SSIM still low due fonts | Font subset task; lower only with product sign-off in plan frontmatter |
| Snapshot noise | Review golden carefully |

## Definition of Done

Core editable primitives pass strict inventory + visual milestone 0.95. Charts/SmartArt/EMF still allowed to fail until later phases.
