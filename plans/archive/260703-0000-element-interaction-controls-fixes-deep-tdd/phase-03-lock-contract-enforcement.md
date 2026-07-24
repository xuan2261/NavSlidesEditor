---
phase: 3
title: "Lock Contract Enforcement"
status: completed
priority: P0
dependencies: [1]
---

# Phase 03: Lock Contract Enforcement

## Overview

Make `locked` a consistent mutation barrier across Properties, Ribbon, keyboard, canvas, z-order, context menu, and shared update fanout.

## Requirements

- Functional: locked elements cannot be edited except by explicitly unlocking them.
- Functional: mixed selections containing locked elements mutate only unlocked members, unless the update is the lock toggle itself.
- Functional: mixed locked groups are atomic no-op targets for group-level mutations, including ungroup.
- Non-functional: do not break existing delete/duplicate behavior that already skips locked members.

## Architecture

Centralize lock filtering in `updateSelectedElements` and, if needed, `buildSelectionUpdates`. The rule:
- `{ locked: true }` may apply to unlocked elements.
- A locked element may receive `{ locked: false }` only when it is the entire payload.
- Mixed payloads such as `{ locked: false, x: 999 }` must not mutate geometry/style on locked elements.
- Any other update excludes locked elements.

This preserves the ability to unlock while blocking accidental geometry/style mutations.

The lock barrier must also cover mutation paths that bypass `updateSelectedElements`: z-order updates, group/ungroup, crop/start crop/reset crop, snap reference changes, direct context-menu `onUpdateElement` calls, and any direct `updateElements` fanout.

## Related Code Files

- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/utils/element-update-fanout.js`
- Modify: `client/src/utils/element-update-fanout.test.js`
- Modify: `client/src/components/properties/common-element-controls.jsx`
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify: `client/src/hooks/use-slide-operations.js`
- Modify: `client/src/components/SlideCanvas.jsx`
- Modify: `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
- Modify: related property/ribbon tests

## TDD Tests

1. `buildSelectionUpdates` or `updateSelectedElements` excludes locked element for `{ x: 200 }`, `{ width: 300 }`, `{ rotation: 45 }`, `{ opacity: 0.5 }`, and style keys.
2. Locked element accepts `{ locked: false }` from lock toggle.
3. Multi-select with one locked and one unlocked applies property change only to unlocked element.
4. Ribbon rotate 90, opacity, align, and geometry controls cannot mutate locked selected element.
5. Properties panel X/Y/W/H/rotation/opacity/shadow/fragment cannot mutate locked element.
6. Existing delete/cut/duplicate locked tests remain green.
7. Mixed payload `{ locked: false, x: 999, width: 999 }` unlocks at most, and does not mutate locked geometry/style.
8. Z-order commands do not mutate `zIndex` for locked elements or mixed locked groups.
9. Group/ungroup does not set or clear `groupId` on locked elements; groups containing any locked member cannot be ungrouped until those members are explicitly unlocked.
10. Crop/start crop/reset crop and snap-reference context updates are disabled/no-op for locked elements.
11. Any direct `updateElement`/`updateElements` bypass introduced for context actions goes through a lock-aware guard.

## Implementation Steps

1. Add lock-aware update fanout tests.
2. Implement strict helpers such as `isPureLockToggle(updates)`, `filterLockedForUpdate`, and `isGroupAtomicMutationBlocked`.
3. Apply filtering at the highest shared chokepoint in `updateSelectedElements`.
4. Add direct guards for every bypass listed in Architecture, not only shared property controls.
5. Ensure visual disabled state is added only where it does not block unlock.
6. Run targeted property/ribbon/EditorPage tests.

## Success Criteria

- [x] Locked elements are immutable through all shared control paths.
- [x] Explicit unlock still works.
- [x] Mixed lock+geometry/style payloads cannot mutate locked elements.
- [x] Mixed selections behave predictably: unlocked members update, locked members stay fixed.
- [x] Z-order, group/ungroup, crop, reset crop, snap reference, and context direct updates are lock-aware.
- [x] Mixed locked groups are not partially mutated.
- [x] Mixed locked groups cannot be ungrouped while any member remains locked.
- [x] No regression in existing lock/delete/duplicate tests.

## Risk Assessment

The highest risk is blocking unlock or changing multi-select behavior unexpectedly. Mitigate by testing lock-only updates and mixed-selection fanout separately.
