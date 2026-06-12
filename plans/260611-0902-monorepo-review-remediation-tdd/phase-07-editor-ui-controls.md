---
phase: 7
title: "Editor UI Controls"
status: complete
priority: P2
effort: "1.5d"
dependencies: []
---

# Phase 7: Editor UI Controls

## Overview
Fix four functional gaps in editor controls/state workflow: Find&Replace skips
vertical child slides, ribbon arrange/geometry controls mishandle multi-select,
and undo/redo caps are asymmetric. Reuse the `computeMixedValues` plumbing from
the completed 2026-06-09 plan for the ribbon mixed-state fix.

## Findings Covered
- **I-R2.1** — Find&Replace ignores `slide.children[].elements` (vertical slides) → partial Replace All.
- **I-R2.2** — ribbon arrange buttons move only primary on multi-select (keyboard path uses whole selection).
- **I-R2.3** — redo cap 20 vs undo 50; comment wrong (`slice(-19)`).
- **I-R2.4** — ribbon Format X/Y/W/H/Rotation no mixed/indeterminate state (only Opacity has it).
- **M-R2×8** — editing-ref not cleared on delete; arrow-nudge N setStates; Ctrl+D doesn't select copies; addToSelection no dedupe; impure reducer (StrictMode); teardown save can't recover; late save setState after unmount; mixed-value treats two undefined fills as same.

## Requirements
- Functional: search/replace covers vertical children; z-order + geometry controls
  act on the whole selection consistently with keyboard; redo retains parity with undo.
- Non-functional: no StrictMode double-invoke hazards; no setState-after-unmount warnings.

## Architecture

### I-R2.1 — Find&Replace vertical slides
`FindReplaceBar.jsx:34-52,72-119` + `find-replace-helpers.js:118-144` iterate only
`slide.elements`. Extend traversal to `slide.children[].elements` for both search
and Replace All. Add child coordinates to match navigation.

### I-R2.2 — ribbon arrange multi-select
`EditorPage.jsx:1450-1453,1574-1575` wire forward/back/front/back to
`bringElementForward(selectedElementId)` (last id only); keyboard path uses
`stepSelectedZOrder` (`:839`) over whole selection. Point ribbon handlers at the
same whole-selection action.

### I-R2.3 — redo cap parity
`EditorPage.jsx:935` `slice(-19)` caps redo at 20 while undo is 50; comment at
`:630` is wrong. Align redo cap to 50; fix comment.

### I-R2.4 — ribbon Format mixed state
`ribbon-format-tab-...controls.jsx:248-302`: X/Y/W/H/Rotation bind to primary only;
only Opacity uses `computeMixedValues`. Apply `computeMixedValues` (from prior
plan) to the geometry fields so divergent multi-select shows blank/indeterminate,
not the primary's value. (Properties panel already does this — reuse, don't fork.)

### Mediums (M1–M8)
Clear `editingElementIdRef.current` on delete (M1); batch arrow-nudge into one
`updateElements` (M2); select new copies after Ctrl+D (M3); dedupe `addToSelection`
(M4); move `setCurrentSlideIndex` out of the `setPresentation` updater — impure
reducer/StrictMode hazard (M5); teardown save recovery (M6); guard late-save
setState after unmount (M7); mixed-value distinguishes two undefined fills with
different default swatches (M8).

## Related Code Files
- Modify: `client/src/components/FindReplaceBar.jsx`, `client/src/components/find-replace-helpers.js`
- Modify: `client/src/pages/EditorPage.jsx`, `client/src/components/ribbon/ribbon-format-tab-contextual-controls` (path via Glob), `client/src/components/ribbon/controls/arrange-controls.jsx`
- Modify: `client/src/stores/editor-store.js`, `client/src/hooks/use-slide-operations.js`
- Reference (read): prior plan `260609-0830-.../phase-03-indeterminate-multi-select-state.md` (computeMixedValues), `PropertiesPanel.test.jsx`
- Create: `client/src/components/find-replace-vertical-slides.test.jsx`, `client/src/components/ribbon/ribbon-multiselect-arrange-geometry.test.jsx`, undo/redo cap test

## TDD — Tests First
1. **I-R2.1**: deck with a vertical child containing target text → search finds it,
   Replace All replaces it (red today).
2. **I-R2.2**: multi-select 3 elements, click ribbon "bring forward" → all 3 move,
   matching keyboard behavior (red today — only 1 moves).
3. **I-R2.3**: 30 undos then 30 redos → all redo states retained (red — capped at 20).
4. **I-R2.4**: multi-select with divergent X → ribbon X field shows blank/indeterminate (red).

## Implementation Steps
1. Write failing tests 1–4.
2. Find&Replace child traversal → test 1.
3. Ribbon arrange whole-selection → test 2.
4. Redo cap → test 3.
5. Ribbon mixed-state via computeMixedValues → test 4.
6. Mediums M1–M8.

## Success Criteria
- [x] Tests 1–4 green.
- [x] Ribbon and keyboard z-order paths behave identically on multi-select.
- [x] No setState-after-unmount warning in editor test run.
- [x] `npm run test` editor suites green; `npm run test:e2e` editor specs green.

## Risk Assessment
- **Risk:** child-slide traversal changes match indexing → navigation off-by-one.
  *Mitigation:* test forward/back navigation across parent+child matches.
- **Risk:** moving `setCurrentSlideIndex` out of updater changes timing.
  *Mitigation:* call after setPresentation resolves; test slide-add selection.
- **Risk:** ribbon mixed-state reuse diverges from panel behavior. *Mitigation:*
  share the exact helper; assert parity with panel in test.
