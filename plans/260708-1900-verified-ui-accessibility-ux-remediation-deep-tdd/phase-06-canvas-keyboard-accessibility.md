---
phase: 6
title: "Canvas Keyboard Accessibility"
status: pending
priority: P0
dependencies: [1]
effort: "3-5 dev-days"
---

# Phase 6: Canvas Keyboard Accessibility

## Overview

Make core slide elements keyboard reachable and operable without destabilizing pointer-based editing, TipTap text editing, group selection, crop, resize, rotate, and existing global shortcuts.

## Requirements

- Functional: users can keyboard-focus slide elements, select them, enter edit mode, delete, and nudge.
- Functional: focus state is visible but does not alter exported/rendered slide content.
- Functional: resize/rotate must have keyboard-accessible alternatives, either via focusable handles or properties/ribbon controls.
- Functional: keyboard handlers must not fire while typing in inputs/contenteditable/TipTap.
- Non-functional: preserve current mouse/touch drag, resize, rotate, crop, group, and line hit target behavior.

## Architecture

Do not rewrite `EditorPage.jsx`. Add focused semantics at the canvas wrapper layer and route actions through existing selection/update callbacks. Prefer helper extraction for keyboard event decisions:

- `isCanvasElementActivationKey`
- `isEditableTarget`
- `getElementAccessibleName`
- `handleElementKeyboardAction`

Use visible focus outline on wrapper/handles outside `[data-element-content]` so slide content is unchanged.

## Related Code Files

- Modify: `client/src/components/canvas/canvas-element-wrapper.jsx`
- Modify: `client/src/components/SlideCanvas.jsx`
- Evaluate: `client/src/hooks/use-keyboard.js`
- Evaluate: `client/src/hooks/use-element-cycle-through-slide-elements-hook.js`
- Evaluate: `client/src/utils/active-slide-selection.js`
- Tests: `client/src/components/canvas/canvas-element-wrapper.test.jsx`
- Tests: `client/src/components/SlideCanvas.test.jsx`
- E2E: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`

## Implementation Steps

1. Start from failing canvas semantics tests.
2. Implement this phase in two internal slices:
   - **6A P0 Core:** element focus, selection, delete guard, bounded nudge, edit entry/exit. Depends only on Phase 1.
   - **6B Integration:** verify ribbon/properties/modal interactions after Phases 4 and 5 land. This slice can wait, but 6A cannot.
3. Define keyboard mode table:
   - canvas workspace focus
   - element wrapper focus
   - selected element focus
   - text edit/contenteditable focus
   - modal focus
4. Resolve Enter/Space semantics explicitly:
   - focused but unselected element: Enter or Space selects
   - selected editable text-like element: Enter or F2 enters edit mode
   - selected non-editable element: Enter opens the most relevant properties/format affordance only if one exists, otherwise no-op with no mutation
   - editing: Escape exits edit mode, then a second Escape can clear selection if existing editor semantics support it
5. Choose a tab-stop strategy before implementation:
   - preferred: roving tabindex over elements on the active slide, integrated with existing Tab/Shift+Tab cycle
   - acceptable alternative: slide-level focus plus keyboard element cycling
   - reject: every element permanently `tabIndex=0` in large decks without a bound
6. Add accessible names for elements using type plus user-visible hint:
   - `Text element`
   - `Image element`
   - `Chart element`
   - include locked/group state when selected if useful
7. Add `tabIndex` and `role="button"` or `role="group"` according to the chosen tab-stop strategy only when the wrapper represents an interactive editor object.
8. Add keyboard actions:
   - Enter/Space selects focused element
   - Enter or F2 enters edit mode where applicable
   - Delete/Backspace deletes selected element if not locked and not editing text
   - Arrow keys nudge through existing bounded movement logic
   - Shift+Arrow larger nudge if existing shortcuts support it
   - Escape exits edit/selection consistently
9. Address resize/rotate accessibility:
   - Ensure Format ribbon/properties panel supports size/rotation with labels and keyboard activation.
   - Optionally expose focusable handles with `aria-label="Resize north east"` only if not noisy.
10. Add end-to-end keyboard proof for resize/rotate alternative: select an element by keyboard, reach size/rotation controls, change values, and verify element update.
11. Preserve pointer flow:
   - `onMouseDown` drag behavior unchanged.
   - Line SVG hit testing unchanged.
   - Crop overlay handles unchanged unless a keyboard alternative is added.
12. Add unit/component tests for keyboard selection, edit activation, delete guard, arrow nudge, locked element behavior, text-edit suppression, and large-slide tab strategy.
13. Add Playwright smoke: keyboard-only open editor, focus canvas element, select, nudge, open format controls, close.
14. Run targeted tests and a11y e2e.

## Success Criteria

- [ ] Canvas elements are discoverable and operable by keyboard.
- [ ] P0 core keyboard selection/delete/nudge lands without waiting for modal migration.
- [ ] Enter/Space/F2 behavior follows the documented state table.
- [ ] Active-slide tab-stop strategy remains usable with many elements.
- [ ] Existing global shortcuts still work outside editable targets.
- [ ] Pointer drag/resize/rotate/crop behavior is unchanged.
- [ ] Locked elements do not mutate through new keyboard paths.
- [ ] Focus indicators are visible in dark/light editor modes.
- [ ] Keyboard users can reach and operate size/rotation controls after selecting an element.

## Risk Assessment

- Risk: keyboard handlers conflict with text editing or browser shortcuts.
  - Mitigation: central `isEditableTarget` guard and tests with TipTap/contenteditable.
- Risk: extra tab stops make editor cumbersome.
  - Mitigation: limit focusable targets to meaningful editor objects and keep slide panel/ribbon order predictable.
- Risk: changing wrapper styles affects slide rendering.
  - Mitigation: editor-only focus decoration, not part of exported content.
