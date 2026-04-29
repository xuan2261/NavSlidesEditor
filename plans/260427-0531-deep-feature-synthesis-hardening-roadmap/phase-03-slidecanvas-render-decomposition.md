---
phase: 3
title: "SlideCanvas Render Decomposition"
status: pending
priority: P0
effort: "3-5d"
dependencies: [2]
---

# Phase 3: SlideCanvas Render Decomposition

## Context Links

- Audit finding: `SlideCanvas.jsx` is a confirmed god component; target `<=1200 LOC` first.
- Code: `client/src/components/SlideCanvas.jsx`
- Shared renderer contract: `shared/src/element-renderers.js`, `shared/tests/element-renderers.test.js`
- Tests: `tests/e2e/visual-regression.spec.js`, `tests/e2e/element-properties.spec.js`, `tests/e2e/elements.spec.js`

## Overview

Extract element render dispatch and renderer components from `SlideCanvas.jsx`
without changing canvas interactions. This phase reduces file size while keeping
behavior stable.

## Key Insights

- The brainstorm target of `~400 LOC` is too aggressive for one pass.
- Existing `shared/src/element-renderers.js` already supports export/render contract; do not create a second shared parser casually.
- `markdownToHtml()` is local in `SlideCanvas.jsx`; editor preview vs export rendering must be unified deliberately.
- Renderer extraction can be verified with visual regression and element property E2E.

## Requirements

- Functional: all 17 element types render exactly as before in editor.
- Functional: selection, resizing, rotation, crop overlay, and context menu remain unchanged in this phase.
- Functional: Markdown preview and export contract do not diverge further.
- Non-functional: extracted renderer files are focused and testable.
- Non-functional: new React component filenames follow existing repo convention; utility files use kebab-case.

## Architecture

```text
SlideCanvas.jsx
  -> CanvasElement wrapper
      -> element-renderer registry
          -> text/image/shape/table/code/chart/media renderer components
  -> shared render utilities where client/export behavior must match
```

Renderer registry should avoid a new 17-way switch inside `SlideCanvas.jsx`.

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx`
- Create: `client/src/components/canvas/CanvasElement.jsx`
- Create: `client/src/components/canvas/element-renderers/TextElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/ImageElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/ShapeElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/TableElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/CodeElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/ChartElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/MediaElementRenderer.jsx`
- Create: `client/src/components/canvas/element-renderers/registry.js`
- Modify: `shared/src/element-renderers.js` only if editor/export contract needs shared helper extraction.
- Modify/Create: renderer unit tests where pure helpers are extracted.
- Delete: none in first extraction pass.

## Implementation Steps

1. Add a renderer inventory from `SlideCanvas.jsx`: element type, local helper, dependencies, DOM output.
2. Extract pure helpers first: style building, markdown preview helper, shape path adapter if duplicated.
3. Create element renderer registry and move one low-risk renderer first, such as shape or image.
4. Run focused tests and visual smoke after first extraction.
5. Move remaining stable renderers in small batches: text/markdown, media, chart/code, table, icon/callout/line/drawing.
6. Keep selection handles and interaction event routing in `SlideCanvas.jsx` until Phase 4.
7. Replace local render switch with registry dispatch.
8. Ensure renderer props are minimal: element, scale/context, editing state, callbacks needed by that renderer only.
9. Remove local renderer helpers from `SlideCanvas.jsx` once no references remain.
10. Record new `SlideCanvas.jsx` LOC and any extracted file over 200 LOC for follow-up split.

## Todo List

- [ ] Renderer inventory completed before moving code.
- [ ] Registry dispatch exists outside `SlideCanvas.jsx`.
- [ ] Markdown preview contract reviewed against `shared/src/element-renderers.js`.
- [ ] All element types covered by either unit or E2E smoke.
- [ ] `SlideCanvas.jsx` reduced meaningfully without interaction changes.

## Verification & Tests

```bash
npm run test -- shared/tests/element-renderers.test.js client/src/utils/content-safety.test.js
npx playwright test tests/e2e/elements.spec.js tests/e2e/element-properties.spec.js tests/e2e/visual-regression.spec.js
npm run lint
npm run build
```

Manual smoke:

- Open a deck with text, image crop, shape, table, chart, code, LaTeX/TikZ, Markdown, HTML embed, video/audio, QR, icon, callout, drawing, line, SVG.
- Confirm selection handles and property panel still update the selected element.

## Success Criteria

- [ ] `SlideCanvas.jsx` no longer contains local renderer functions for most element types.
- [ ] Editor visual regression is unchanged or accepted with documented reason.
- [ ] Shared render/export tests still pass.
- [ ] No new component file becomes another god component.

## Risk Assessment

- Risk: renderer extraction breaks event propagation or selection.
- Mitigation: keep event routing in wrapper and add Playwright selection smoke per element category.
- Risk: Markdown/client/export behavior diverges.
- Mitigation: centralize sanitization/markdown helper or document intentional editor-only behavior.

## Security Considerations

- Preserve trusted HTML embed policy; do not add blanket sanitizer to HTML embed.
- Keep text/markdown/svg safety helpers intact.
- Avoid introducing `dangerouslySetInnerHTML` in new renderers unless existing path already requires it and is guarded.

## Next Steps

Proceed to Phase 4 to extract chrome and interaction logic.

## Unresolved Questions

- Which renderer is the safest first extraction candidate after command layer passes? Default: shape/image before text/table.
