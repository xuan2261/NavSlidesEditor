---
phase: 7
title: "Vector media EMF WMF parity"
status: pending
priority: P1
effort: "3-8d"
dependencies: [3, 4]
tdd: true
---

# Phase 7: Vector media EMF/WMF parity

## Overview

Eliminate permanent `unsupported-image` placeholders for EMF/WMF. Convert or render to an **editable-capable** form in NavSlides: prefer SVG path conversion or high-quality PNG **only as intermediate** if SVG impossible — but final element must remain user-replaceable/editable image (crop/filters) with visual parity, not a locked “import placeholder” type. SLA forbids permanent non-editable dead boxes.

## Requirements

### Functional
- Detect EMF/WMF via magic (already in `media.js`)
- Conversion pipeline (pick one primary, test both if available):
  - LibreOffice/ImageMagick/Inkscape CLI convert to PNG/SVG
  - Or pure JS library if license OK
- Mapped as `type: 'image'` (or `svg` if vector conversion quality good) with real `src`
- `importPlaceholderType === 'unsupported-image'` count = 0 on fixtures containing EMF/WMF
- Strict mode fails if conversion unavailable **and** EMF present (no silent placeholder pass)
- SSIM: decks with vector logos improve vs Phase 04 baseline

### Non-functional / Security (RT-01)
- Conversion via `child_process.execFile` only (no `shell: true`), fixed binary path allowlist
- Args: input/output temp paths under dedicated dir only; no user strings in argv except generated paths
- Timeout + memory limit; kill tree on hang
- Prefer container/job sandbox when available; never network to convert
- SVG output must pass sanitizer before store (RT-17)
- Cache converted assets via media-dedup hash of source bytes
- Document system dependency for conversion tool

## Architecture

```
emf/wmf bytes → sandboxed execFile(converter) → png/svg bytes → sanitize → persistDedupedBuffer → image element
```

Debug-only: if `PPTX_ALLOW_EMF_PLACEHOLDER=1` for local — **must not** be default; CI strict off.

## Related Code Files

- Modify: `media.js`, `map-image.js`, `constants.js`
- Create: `server/services/pptx-import/vector-media-convert.js` + tests
- Fixtures: craft minimal EMF or extract from corpus if present
- Docs: system dependency

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T7.1 | sniff EMF → convert mock → image url returned |
| T7.2 | mapImage EMF no longer returns `unsupported-image` when converter ok |
| T7.3 | converter fail + strict → import error type recorded |
| T7.4 | converter fail + non-strict → still not permanent success without flag (align with SLA: prefer fail) |
| T7.5 | dedup: same EMF twice → one stored convert |
| T7.6 | timeout kills hung converter |

## Implementation Steps

1. RED with mocked converter.
2. Implement CLI converter adapter (LO draw export or magick).
3. Wire map-image.
4. Integration fixture.
5. CI: ensure tool available or skip job with fail if corpus contains EMF and tool missing.

## Success Criteria

- [ ] Zero permanent EMF/WMF placeholders in default strict
- [ ] T7.* green
- [ ] G0 green
- [ ] Docs list converter dependency

## Verify

```bash
npx vitest run server/services/pptx-import/vector-media-convert.test.js server/services/pptx-import/mapper/map-image.test.js server/services/pptx-import/media.test.js --reporter=dot
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| No converter on Windows CI | Install ImageMagick or LO; document |
| Lossy PNG | Prefer SVG when possible; SSIM gate |
| Huge EMF | Size cap already in media |

## Definition of Done

EMF/WMF import yields real media elements, not unsupported placeholders.
