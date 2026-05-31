---
phase: 7
title: "R6 EMF/WMF Browser-Unsupported Placeholder"
status: completed
priority: P2
effort: "0.5d"
dependencies: [1]
---

# Phase 7: R6 EMF/WMF Browser-Unsupported Placeholder

## Overview
Fix #H — EMF/WMF images persist a URL the browser cannot render, so the slide shows a broken `<img>`. Per decision: render a **clear placeholder + warning** in place of the broken image (rasterization deferred to a future plan). EMF is common in real decks (vector paste from Excel/Word), so this is a frequent "missing image" source.

## Key Insights (verified)
- `media.js:37,40` already detects EMF/WMF and returns `{ unsupportedBrowserImage: true }`.
- `media.js:91,109` surfaces a warning; media is still persisted with a URL.
- `map-image.js:7-25` only emits a placeholder when `src` is falsy; an EMF with a valid (but unrenderable) URL passes through as a normal `<img>`.
- `placeholder(element, scale, zIndex, slideIndex, warnings, type, label)` exists in `utils-base.js:60` — reuse it.

## Requirements
- Functional: when media is flagged `unsupportedBrowserImage`, `mapImage` returns a placeholder (labelled "EMF/WMF not supported") instead of an `<img>`, and pushes a clear warning.
- Functional: placeholder keeps the original box geometry so layout is preserved.
- Non-functional: supported formats (png/jpg/…) unchanged; warning code distinct and surfaced to the import summary.

## Architecture
```
persistImageForElement ─► media { url, warning, unsupportedBrowserImage } 
mapImage: if media.unsupportedBrowserImage ─► placeholder(..., 'unsupported-image', 'EMF/WMF not supported') + pushMediaWarning
          else ─► normal <img> path (existing)
```
Thread `unsupportedBrowserImage` out of `media` to `mapImage`. `media.js` already computes the flag (line 91); confirm it is included on the object `persistImageForElement` returns to the mapper (it surfaces at `:91` but the mapper-facing return at `:114` only has `{url, warning}` — add the flag).

## Related Code Files
- Modify: `server/services/pptx-import/media.js:87-114` (include `unsupportedBrowserImage` on the mapper-facing return)
- Modify: `server/services/pptx-import/mapper/map-image.js:9-25` (branch to placeholder when flagged)
- Read for context: `server/services/pptx-import/mapper/utils-base.js:60` (placeholder), `mapper/media-warning.js`
- Tests: `map-image.test.js`, `map-media.test.js`

## Implementation Steps
1. **Read** `media.js:87-114` to confirm exactly which fields reach `mapImage` today; verify the flag is/ isn't passed through.
2. **Red:** `map-image.test.js` — an element whose media resolves with `unsupportedBrowserImage:true` → result is a placeholder element (type per placeholder convention) with label mentioning EMF/WMF, original box preserved, and a pushed warning. Run — fails (currently emits `<img>`).
3. **Green:** include `unsupportedBrowserImage` on the media return; in `mapImage`, after `pushMediaWarning`, branch: if flagged, return `placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'unsupported-image', 'EMF/WMF not supported')`.
4. **Refactor:** ensure the existing `media-missing` placeholder path and the new `unsupported-image` path share the same return shape; warning code distinct (e.g. `image-format-unsupported`).

## Tests (this phase)
- EMF media (`unsupportedBrowserImage:true`) → placeholder, box preserved, warning pushed
- WMF media → same
- normal png media → unchanged `<img>` (regression lock)
- placeholder retains element x/y/width/height from source box

## Success Criteria
- [ ] EMF/WMF render as labelled placeholder, not broken image
- [ ] Box geometry preserved; warning surfaced in import summary
- [ ] Supported formats unaffected
- [ ] `npm run test -- server/services/pptx-import/mapper/map-image` green; lint clean

## Risk Assessment
- Risk: users expect the image, not a placeholder. Mitigation: clear label + warning; rasterization tracked as explicit future-plan follow-up (documented in plan.md Decisions).
- Risk: flag not threaded through all media entry points (base64 vs ref). Mitigation: step-1 read covers both `persistImageForElement` branches.

## Security Considerations
- No network fetch for unsupported formats; placeholder is static. Avoids persisting an unrenderable blob as a live `<img src>`.

## Next Steps
- Future plan: EMF/WMF → PNG rasterization (out of scope here).
