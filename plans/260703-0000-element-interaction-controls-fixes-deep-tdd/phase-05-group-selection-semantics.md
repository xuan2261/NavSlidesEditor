---
phase: 5
title: "Group Selection Semantics"
status: completed
priority: P1
dependencies: [1, 3]
---

# Phase 05: Group Selection Semantics

## Overview

Prevent accidental partial manipulation of grouped elements when selection comes from marquee or additive selection rather than plain click.

## Requirements

- Functional: grouped elements move, cut, duplicate, and apply geometry controls as a group unless ungrouped while all members are unlocked.
- Functional: marquee selection cannot leave a draggable partial group in a state that moves only one member.
- Functional: if any group member is locked, group-level mutations are blocked for the whole group.
- Functional: hidden group members have explicit non-accidental behavior.
- Non-functional: preserve current multi-select ability for ungrouped elements.

## Architecture

Add a shared group-expansion helper used by selection paths:
- `expandSelectionIdsForGroups(slide, ids)` returns all members for any selected group member.
- Use it after marquee hit IDs and when resolving context-menu target selection.
- For Shift selection, decide at click-time whether selecting one group member expands to the full group. Prefer expansion for consistency with pointer-down.
- Mixed locked group rule: selection may visually include locked members, but any group-level mutation is disabled/no-op when at least one selected group member is locked.
- Hidden group rule: hidden group members remain non-selected and non-mutated; if hidden members would make the group partial, movement/geometry mutations for the visible group members are blocked until hidden members are unhidden or the group is made complete through an unlocked-only ungroup/regroup path.
- Locked ungroup rule: a group containing any locked member cannot be ungrouped. Unlock locked members first with a pure lock toggle.

## Related Code Files

- Modify: `client/src/utils/active-slide-selection.js`
- Modify: `client/src/utils/active-slide-selection.pointer-down.test.js`
- Modify: `client/src/components/canvas/use-canvas-rubber-band-drag-selection.js`
- Modify: `client/src/components/canvas/rubber-band-marquee-selection.test.js`
- Modify: `client/src/components/SlideCanvas.jsx`

## TDD Tests

1. Marquee intersects one element in group G, resulting selection includes all G members.
2. Marquee intersects one group member and one ungrouped element, resulting selection includes all G members plus the ungrouped element.
3. Locked group member remains excluded if lock contract requires locked elements not to be bulk-selected, but movement still cannot distort the group. Document chosen behavior in test names.
4. Shift-click grouped element expands to full group or preserves a clearly tested explicit partial-selection contract.
5. Drag after marquee moves all group members with preserved relative offsets.
6. Marquee hits unlocked member of a mixed locked group, then drag/nudge/cut/duplicate/geometry are no-op for the whole group.
7. Shift-click hits unlocked member of a mixed locked group and destructive actions remain disabled/no-op.
8. Group containing hidden member has tested behavior: hidden member stays unselected/non-mutated and visible members cannot be group-mutated until group is made complete.
9. Context-menu target expansion uses the same helper and group-atomic lock rule.

## Implementation Steps

1. Add group expansion helper and tests.
2. Wire helper into rubber-band selection application.
3. Wire helper into additive selection if current behavior permits partial groups.
4. Add helper for `isGroupMutationBlockedByLockedOrHiddenMember`.
5. Run existing/available movement tests after group helper changes, then rerun the full Phase 02 movement suite after Phase 02 lands.
6. Confirm selection pane remains usable for advanced hidden/locked selection cases without enabling accidental mutation.

## Success Criteria

- [x] Marquee selection cannot accidentally drag only one member of an unlocked group.
- [x] Shift/additive selection behavior is explicit and covered by tests.
- [x] Mixed locked groups are group-atomic no-op targets for movement and destructive actions.
- [x] Hidden group member behavior is explicit and tested.
- [x] Groups containing locked members cannot be ungrouped until locked members are explicitly unlocked.
- [x] Group drag still preserves relative offsets and respects slide bounds.

## Risk Assessment

Users may sometimes want to select a single group member. Existing product semantics expose explicit group/ungroup, so consistency favors group expansion. If preserving advanced partial selection is required later, it should be a deliberate edit mode, not a side effect.
