---
phase: 2
title: "Dead and Wrong Controls"
status: completed
priority: P0
effort: "0.5d"
dependencies: [1]
---

# Phase 2: Dead and Wrong Controls

## Overview
Fix controls that are visible but do nothing or write the wrong target: the
Fill picker on `line` (ignored), the video Source field divergence
(`src` vs `videoUrl`), and markdown's hardcoded font/color (no control, writes
ignored). Implements locked decisions 1 and 2.

## Defects Addressed
- **P0-LINEFILL** — ribbon routes `line` to `ShapeControls` which always renders a
  Fill section writing `element.fill`; `LineArrowRenderer` never reads `fill`
  (`ribbon-format-tab-element-position-size-rotation-controls.jsx:188-190`,
  `line-element-renderer.jsx:60-119`). Also PropertiesPanel routes `line` to
  `ShapeProperties` (`PropertiesPanel.jsx:21-23`) — confirm fill is gated there too.
- **P0-VIDEO-SRC** (decision 1) — panel has TWO URL fields `src` + `videoUrl`
  (`media-properties.jsx:17-34`); renderer reads `videoUrl || src`
  (`canvas-element-wrapper.jsx:204`); ribbon writes only `src`
  (`ribbon-format-tab…:158`). Edits diverge.
- **P0-MD-HARDCODE** (decision 2) — `markdown-element-renderer.jsx:12-13` hardcodes
  `color:'white'`, `fontSize:'18px'`; no controls.

## Requirements
- Functional: `line` shows NO fill control (only stroke/arrows). Video has ONE
  source field; setting it from ribbon or panel both take effect; old data with
  `videoUrl` still plays (back-compat). Markdown respects `textColor`/`fontSize`
  with controls in MiscProperties.
- Non-functional: back-compat — existing presentations with `videoUrl` set must
  not break; renderer keeps `videoUrl || src` fallback; migrate on load.

## Architecture
- **Line fill (red-team M4 — panel side partly done):** `shape-properties.jsx:13`
  ALREADY gates the Fill block behind `!isLine` — the PANEL is correct, verify
  before touching. The defect is the RIBBON: `ShapeControls` (`ribbon-format-tab…:22`)
  always renders a Fill section regardless of type. Fix = guard the ribbon Fill
  block on `element.type !== 'line'`. Keep stroke/width/dash/arrows for line.
- **Video src unify (decision 1) — migrate in `migrateSlide`, not the load effect
  (red-team M5):** remove the second `videoUrl` Input from `media-properties.jsx`
  (the `isVideo` block ~25-36); keep single "Source URL" → `src`. Renderer KEEPS
  `element.videoUrl || element.src` so old docs play (no change at
  `canvas-element-wrapper.jsx:204`). The load effect (`EditorPage.jsx:442-476`) now
  drains the save queue + seeds `historyRef` + sets `seededRef` — inserting a
  migration there would diverge the seeded baseline from rendered state (spurious
  first-autosave diff / undo drift). Instead extend the EXISTING per-slide funnel
  `migrateSlide` (`EditorPage.jsx:113-141`) to walk `elements` and copy
  `videoUrl→src` when `src` empty. Runs before the history snapshot, isolated.
- **Markdown (decision 2) — ALSO fix the reveal renderer (red-team M3):** canvas
  `markdown-element-renderer.jsx:12-13` hardcodes white/18px — read
  `element.textColor || 'white'` and `element.fontSize || 18`. BUT reveal has a
  SEPARATE markdown renderer that hardcodes `color:white`/`font-size` inside the
  iframe srcdoc (`shared/src/element-renderers.js:218-224`, incl. the forPrint
  branch ~:220). Without fixing it, markdown font/color works in-editor but drops
  on share-link/offline/PDF. Thread `textColor`/`fontSize` into BOTH. Add the two
  controls to the markdown branch of `misc-properties.jsx` (mirror callout/icon).
  (pptx has no markdown element — no pptx touchpoint.)

## Related Code Files
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` (ribbon ShapeControls fill gate ~22)
- Verify-only (already gated): `client/src/components/properties/shape-properties.jsx:13` (`!isLine` fill gate)
- Modify: `client/src/components/properties/media-properties.jsx` (remove videoUrl field ~25-36)
- Modify: `client/src/components/canvas/element-renderers/markdown-element-renderer.jsx` (read textColor/fontSize ~12-13)
- Modify: `shared/src/element-renderers.js` (reveal renderMarkdown, both branches ~218-224)
- Modify: `client/src/components/properties/misc-properties.jsx` (markdown branch: add controls)
- Modify: `client/src/pages/EditorPage.jsx` (`migrateSlide` ~113-141: per-element videoUrl→src)

## Implementation Steps (TDD)
1. **Verify first (line fill panel):** confirm `shape-properties.jsx:13` already
   gates Fill behind `!isLine` (panel side done). **Test (ribbon):** render the
   ribbon ShapeControls with a `line` → assert NO fill control; with `shape` →
   fill present. Fix the ribbon gate only; green.
2. **Test first (video unify):** MediaProperties for video renders ONE source
   field writing `src`. Renderer still resolves `videoUrl || src` (old-data test:
   element with only `videoUrl` → resolved src is videoUrl). Remove the videoUrl
   field; green.
3. **Test first (migration in migrateSlide):** `migrateSlide` on a slide whose
   video element has `videoUrl` set, `src` empty → returns element with
   `src === videoUrl`. Element with `src` already set → unchanged. Implement in
   `migrateSlide` (per-element walk), NOT the load effect; green. Assert the
   seeded-history baseline is unaffected (migration runs before snapshot).
4. **Test first (markdown canvas):** markdown element with `textColor:'#f00'`,
   `fontSize:24` → canvas renderer style has those (not hardcoded white/18). Fix
   `markdown-element-renderer.jsx:12-13`; green.
5. **Test first (markdown reveal — red-team M3):** reveal `renderMarkdown` for the
   same element → iframe body CSS has `color:#f00`/`font-size:24px` (both the
   normal AND forPrint branch ~218-224). Fix; green. Without this, font/color drop
   on share-link/offline/PDF.
6. **Test first (markdown controls):** MiscProperties markdown branch renders
   textColor + fontSize controls calling onUpdate. Add controls; green. (These
   ship NON-mixed-aware — indeterminate is Phase 3's high-impact set which doesn't
   touch misc-properties; markdown indeterminate is explicit fast-follow.)
7. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] No fill control for line in the RIBBON (panel already gated); shape keeps fill
- [ ] Single video source field; ribbon+panel agree; old `videoUrl` data still plays; migrated to src in `migrateSlide`
- [ ] Markdown honors textColor/fontSize on BOTH canvas and reveal (HTML/PDF export) + has controls
- [ ] Seeded-history baseline unaffected by the migration
- [ ] No regression to shape/video/audio control tests; lint clean

## Risk Assessment
- **Risk:** removing `videoUrl` field strands old presentations. **Mitigation:**
  renderer keeps `videoUrl||src` fallback + load-time migration; test old-data path.
- **Risk:** markdown default color must match theme (was literal white).
  **Mitigation:** default to the same token text elements use (`element.textColor || 'white'` keeps current look when unset).
- **Risk:** line routed to ShapeProperties AND ShapeControls — gate must cover BOTH. **Mitigation:** test both surfaces.
