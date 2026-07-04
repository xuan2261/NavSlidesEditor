---
phase: 6
title: "Line Hit Target and Export Fidelity"
status: completed
priority: P1
dependencies: [1]
---

# Phase 06: Line Hit Target and Export Fidelity

## Overview

Make line elements directly selectable in the editor and prevent visible line decorations from being clipped in reveal/export HTML.

## Requirements

- Functional: unselected line elements can be clicked and right-clicked.
- Functional: thin lines remain easy enough to target without making transparent bounding boxes hijack clicks.
- Functional: reveal/export output preserves visible stroke, arrowheads, and markers.
- Functional: browser hit testing is verified with Playwright because JSDOM cannot prove SVG stroke targeting.
- Non-functional: avoid changing hit behavior of non-line elements.

## Architecture

Editor:
- Prefer line renderer-level hit target, such as a transparent wider SVG path with `pointer-events: stroke`, rather than disabling pointer events on the entire wrapper.
- Keep wrapper pointer events enabled for line while minimizing click stealing.

Export:
- Override base wrapper overflow for line elements or add marker-safe padding/viewBox expansion.
- Scope fix to `renderLine` or `buildBaseStyle` with a line-specific option.
- Prefer marker-safe SVG viewBox/coordinate padding plus line-specific wrapper overflow. Wrapper overflow alone is not sufficient.
- Discover all line export paths (reveal/live HTML, offline HTML, print/PDF, and any shared renderer reuse). Test each distinct path, or record source evidence that it uses the same `shared/src/element-renderers.js` line renderer and wrapper.

## Related Code Files

- Modify: `client/src/components/canvas/canvas-element-wrapper.jsx`
- Modify: `client/src/components/canvas/element-renderers/line-element-renderer.jsx`
- Modify: `client/src/components/canvas/canvas-element-wrapper.test.jsx`
- Modify: `client/src/components/canvas/element-renderers/line-element-renderer.jsx` tests if present
- Modify: `shared/src/element-renderers.js`
- Modify/Create: shared renderer tests for line export
- Create/Modify: `tests/editor-element-interactions.spec.js`

## TDD Tests

1. Unselected line wrapper has pointer events enabled or line renderer exposes a clickable hit stroke.
2. Clicking line calls selection handler.
3. Right-clicking line opens context menu.
4. Non-line wrappers retain current overflow/pointer behavior.
5. Shared HTML render for line contains `overflow:visible` on the wrapper or equivalent marker-safe SVG/viewBox.
6. Thick stroke + `arrowEnd` output includes marker definitions and is not enclosed by an `overflow:hidden` line wrapper.
7. Thick stroke with `arrowStart` and `arrowEnd` has marker-safe SVG viewBox/padding.
8. Rotated line export does not clip stroke/markers inside slide bounds.
9. Offline/print export paths preserve line marker visibility when distinct, or have source evidence proving they reuse the tested shared renderer.
9a. Export path discovery test/report identifies every line render path and maps it to a tested renderer or a shared renderer proof.
10. Playwright: click directly on visible line stroke selects line.
11. Playwright: click inside line wrapper bounding box but away from stroke does not hijack underlying element/canvas behavior.
12. Playwright: right-click visible line stroke opens context menu for the line.

## Implementation Steps

1. Add failing wrapper/renderer tests for unselected line clickability.
2. Replace wrapper `pointerEvents: none` special case with a safer line hit strategy.
3. Add export renderer test that detects line wrapper clipping.
4. Perform export path discovery before changing renderer code.
5. Update shared line renderer/base style to allow visible overflow only for lines and pad marker-safe SVG geometry.
6. Add scoped Playwright smoke for real browser hit testing and overlap behavior.
7. Run targeted canvas, shared renderer, export-path, and Playwright smoke tests.

## Success Criteria

- [x] Lines can be selected by direct click.
- [x] Lines can open context menu by right-click.
- [x] Exported line arrowheads, both-end markers, rotated lines, and thick strokes are not clipped inside slide bounds.
- [x] Every distinct line export path is either directly tested or proven to share the tested renderer.
- [x] Browser smoke proves line stroke hit testing without bounding-box click hijack.
- [x] No non-line wrapper clipping behavior changes.

## Risk Assessment

Line wrappers may intercept clicks over their full bounding box. Mitigate with SVG stroke hit targets and tests around overlapping elements if practical.
