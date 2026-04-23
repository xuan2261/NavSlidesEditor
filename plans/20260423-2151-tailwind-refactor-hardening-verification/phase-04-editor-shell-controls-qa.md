---
phase: 4
title: "Editor Shell Controls QA"
status: completed
priority: P1
effort: "1.5 days"
dependencies: [1, 2, 3]
---

# Phase 4: Editor Shell Controls QA

## Overview

Harden the editor shell after Tailwind migration: menu bar, quick access toolbar, main toolbar, insert menu, mini toolbar, slide panel, slide sorter, find/replace, animation timeline, selection pane, and shared dropdown behavior.

## Requirements

- Every visible editor control must fit, have a clear state, and remain keyboard/mouse accessible.
- Controls must execute the same command behavior as before refactor.
- Menus/popovers must close predictably on outside click, ESC, command selection, and route change.
- Toolbar state must reflect current selection and undo/redo availability.
- Editor shell should not shift layout when toolbars, labels, badges, or icons change state.

## Architecture

Editor command flow:

`EditorPage` state/store -> toolbar/menu component -> command handler -> slide/element mutation -> undo history -> canvas/properties rerender.

Shared UI primitives must remain small and consistent: `DropdownMenu`, buttons, toolbar controls, popovers, and panel layout utilities.

## Related Code Files

- `client/src/pages/EditorPage.jsx`
- `client/src/components/EditorMenuBar.jsx`
- `client/src/components/Toolbar.jsx`
- `client/src/components/InsertMenu.jsx`
- `client/src/components/QuickAccessToolbar.jsx`
- `client/src/components/MiniToolbar.jsx`
- `client/src/components/DropdownMenu.jsx`
- `client/src/components/SlidePanel.jsx`
- `client/src/components/SlideSorterView.jsx`
- `client/src/components/FindReplaceBar.jsx`
- `client/src/components/AnimationTimeline.jsx`
- `client/src/components/SelectionPane.jsx`
- `client/src/components/find-replace-helpers.js`
- `client/src/components/find-replace-helpers.test.js`
- `tests/e2e/editor.spec.js`
- `tests/e2e/toolbar-elements.spec.js`
- `tests/e2e/keyboard-shortcuts.spec.js`
- `tests/e2e/find-replace.spec.js`
- `tests/e2e/slide-management.spec.js`
- `tests/e2e/undo-redo.spec.js`

## Implementation Steps

1. Build a control inventory:
   - File menu, edit menu, insert menu, view menu, export/share commands.
   - Quick access buttons: save, undo, redo, preview/export if present.
   - Main toolbar groups: text, insert, layout, arrange, zoom.
   - Mini toolbar selection actions.
   - Slide panel add/duplicate/delete/reorder controls.
2. Verify command handlers:
   - Disabled state prevents mutation.
   - Enabled state performs exactly one mutation.
   - Undo/redo restores before/after state.
3. Validate dropdown/popover mechanics:
   - Keyboard focus enters and exits.
   - ESC closes active layer only.
   - Outside click closes without losing selection unexpectedly.
   - Z-index order does not hide menus behind panels/canvas.
4. Fix Tailwind class regressions:
   - Hover/active/disabled/focus-visible states.
   - Icon-only buttons have stable square size and tooltip/label strategy.
   - Segmented controls and select-like controls do not resize on label changes.
5. Update helper/unit tests for find/replace and toolbar command edge cases.
6. Add E2E assertions for controls that were only visually checked before.

## Verification & Tests

- `npx vitest run client/src/components/find-replace-helpers.test.js`
- `npx playwright test tests/e2e/editor.spec.js`
- `npx playwright test tests/e2e/toolbar-elements.spec.js`
- `npx playwright test tests/e2e/keyboard-shortcuts.spec.js`
- `npx playwright test tests/e2e/find-replace.spec.js`
- `npx playwright test tests/e2e/slide-management.spec.js`
- `npx playwright test tests/e2e/undo-redo.spec.js`
- Manual control matrix:
  - Open/close each menu.
  - Insert text, shape, image/media placeholder, table, chart, code, latex/html where available.
  - Save, undo, redo, duplicate, delete, reorder slides.
  - Find next/previous, replace one, replace all.
  - Toggle animation timeline and selection pane.
  - Try keyboard shortcuts with focus in text editor and outside text editor.
- Visual checks:
  - No toolbar wrapping breaks at 1024 width.
  - Mobile/tablet shell still exposes primary actions.
  - Active selection state is visible without color-only dependency.

## Success Criteria

- [ ] All shell controls are mapped to tests or documented manual checks.
- [ ] E2E shell specs pass with no console errors.
- [ ] No panel/menu overlaps make controls unreachable.
- [ ] Undo/redo state remains correct after toolbar and menu commands.

## Risk Assessment

- Risk: editor shortcuts conflict with text editing shortcuts. Mitigation: test focus inside/outside rich text editor.
- Risk: Tailwind migration changes pointer events on overlay layers. Mitigation: explicit outside-click and z-index tests.
- Risk: icon-only controls become ambiguous. Mitigation: preserve accessible labels/tooltips.

## Security Considerations

- Editor commands that insert HTML/code must keep existing sanitization path.
- Menu labels derived from user content must render as text.

## Todo List

- [ ] Control inventory complete.
- [ ] Find/replace helpers covered.
- [ ] Toolbar/menu E2E specs pass.
- [ ] Responsive shell screenshots captured.

## Next Steps

Proceed to Phase 5 when editor shell command dispatch is stable.
