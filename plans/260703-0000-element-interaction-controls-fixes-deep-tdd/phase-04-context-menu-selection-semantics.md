---
phase: 4
title: "Context Menu Selection Semantics"
status: completed
priority: P0
dependencies: [1, 3, 5]
---

# Phase 04: Context Menu Selection Semantics

## Overview

Fix right-click menu actions so Cut, Copy, Duplicate, Crop, and Delete operate on the intended context target without double-deleting or bypassing lock rules.

## Requirements

- Functional: right-click Cut should not cut current unrelated selection plus separately delete the context-clicked element.
- Functional: locked context targets disable destructive actions.
- Functional: context actions should match user expectation when right-click target is outside current selection.
- Functional: context actions must not depend on async React selection reconciliation between menu open and menu click.
- Non-functional: preserve existing keyboard shortcuts and selection behavior.

## Architecture

Adopt one explicit context-menu contract:
- If the right-clicked element is part of the current selection, actions operate on the current selection.
- If it is outside selection, context-menu open should select that element first, expanded by group if applicable, then actions operate on that selection.
- Cut should call one operation only, not `onCut` plus direct `onDeleteElement`.
- `SlideCanvas` computes `contextSelectionIds` synchronously on right-click and passes them into the menu, or actions receive explicit target-aware callbacks such as `onCutSelection(contextSelectionIds)`.
- Grouped context targets expand to the full group. If any member is locked, destructive group actions are disabled/no-op per the mixed locked group rule.

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx`
- Modify: `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
- Modify: `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx`
- Modify: `client/src/hooks/use-clipboard.js`
- Modify: `client/src/hooks/use-clipboard.test.js` if context contract needs clipboard-level assertions

## TDD Tests

1. Right-click B while A selected, choose Cut, assert B is the target and A remains.
2. Right-click B while A+B selected, choose Cut, assert both selected targets are cut once.
3. Cut button disabled for locked context target.
4. Duplicate and Copy respect same context selection contract.
5. Crop disabled or no-op for locked image context target.
6. No action calls both `onCut` and `onDeleteElement` for the same click.
7. Full `SlideCanvas` test: A selected, right-click B, menu opens with B as `contextSelectionIds` before Cut.
8. Full `SlideCanvas` test: A+B selected, right-click B, action targets A+B exactly once.
9. Grouped B expands context selection to the whole group.
10. Mixed locked group context selection disables destructive actions.

## Implementation Steps

1. Add tests for context menu action callbacks and full `SlideCanvas` selection reconciliation.
2. Update context-menu open logic in `SlideCanvas` to compute/pass `contextSelectionIds` synchronously.
3. Remove direct `onDeleteElement(contextMenu.elementId)` from Cut.
4. Disable destructive context actions when any group-atomic target is locked, or when every context-selected standalone target is locked.
5. Confirm keyboard Cut remains unchanged and still respects lock handling from Phase 03.

## Success Criteria

- [x] Context Cut performs exactly one delete/cut operation.
- [x] Right-click outside selection retargets actions predictably.
- [x] Context actions are target-aware without selection timing races.
- [x] Locked context targets cannot be cut, deleted, duplicated, or cropped.
- [x] Grouped and mixed locked context targets follow Phase 05 group semantics.
- [x] Existing context menu tests pass.

## Risk Assessment

Changing right-click selection may affect workflows where users expect selection to remain untouched. Mitigate by using the common editor convention: context action targets the right-clicked object unless it is already part of selected set.
