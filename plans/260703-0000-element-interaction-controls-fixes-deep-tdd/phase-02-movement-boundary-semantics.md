---
phase: 2
title: "Movement Boundary Semantics"
status: completed
priority: P0
dependencies: [1, 3, 5]
---

# Phase 02: Movement Boundary Semantics

## Overview

Fix movement bounds so mouse drag and keyboard nudge share one safe model: selected elements move together, locked elements stay fixed, and no element moves outside the slide.

## Requirements

- Functional: batch drag preserves relative offsets when any selected member hits a slide edge.
- Functional: keyboard nudge clamps to slide boundaries and skips locked members.
- Functional: keyboard nudge uses the same shared batch delta as mouse drag.
- Functional: a group with any locked member is a group-atomic no-op for drag/nudge.
- Non-functional: preserve current single-element drag, snapping, and smart-guides behavior; define multi-select snapping explicitly.

## Architecture

Add or update pure helpers in `use-canvas-pointer-interaction.js` or a small nearby utility:
- `computeClampedBatchDelta(startEls, dx, dy, slideW, slideH)` returns one safe delta for all moving elements.
- `applyMoveBatch` applies the shared delta, not per-element clamp.
- keyboard nudge reuses the same clamp logic with the active slide dimensions.
- Multi-select snap contract: resolve snap/guides from the grabbed/primary element, apply the resulting shared delta to the whole moving set, then clamp that shared delta so no member leaves slide bounds.
- Extract helper logic outside `EditorPage.jsx`; keep `EditorPage.jsx` edits to wiring.

## Related Code Files

- Modify: `client/src/components/canvas/use-canvas-pointer-interaction.js`
- Modify: `client/src/components/canvas/use-canvas-pointer-interaction.test.js`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx`

## TDD Tests

1. Batch right-boundary drag:
   - element A at `x=850,w=100`, element B at `x=100,w=100`, slideW `960`, dx `50`.
   - expected shared dx is `10`; A becomes `860`, B becomes `110`.
2. Batch left-boundary drag:
   - min selected `x=5`, dx `-20`.
   - expected shared dx is `-5`.
3. Batch bottom/top cases mirror x-axis behavior.
4. Single-element drag output remains identical to current `applyMove`.
5. Keyboard nudge at all four edges clamps instead of writing negative/out-of-range `x/y`.
6. Keyboard nudge skips locked selected members and moves unlocked members only within bounds.
7. Keyboard nudge of two selected elements near an edge preserves relative offsets by applying one shared clamped delta.
8. Group selection nudge uses the same shared delta as mouse drag.
9. Mixed locked group drag/nudge is a no-op for all group members.
10. Grid-enabled multi-select drag applies one snapped shared delta and then clamps.
11. Smart-guide-enabled multi-select drag uses the chosen primary/grabbed-element guide contract and cannot snap any member out of bounds.

## Implementation Steps

1. Implement `computeClampedBatchDelta`.
2. Refactor `applyMoveBatch` to use shared delta.
3. Add a small nudge helper or inline call that clamps `x/y` using slide width/height.
4. Add explicit multi-select snap/guide handling; keep single-element behavior unchanged.
5. Run targeted tests for pointer interaction and EditorPage element ops.

## Success Criteria

- [x] Multi-select/group drag near all slide edges preserves selected layout.
- [x] Keyboard nudge cannot create negative coordinates or coordinates beyond slide bounds.
- [x] Keyboard nudge preserves selected layout at boundaries.
- [x] Locked individual elements remain unmoved during keyboard nudge.
- [x] Mixed locked groups do not partially move.
- [x] Multi-select snap/guide behavior is explicit and tested.
- [x] Existing drag/resize/rotate tests still pass.

## Risk Assessment

Changing batch movement can affect group drag feel. Mitigate with edge and non-edge tests, plus keep single-element path unchanged.
