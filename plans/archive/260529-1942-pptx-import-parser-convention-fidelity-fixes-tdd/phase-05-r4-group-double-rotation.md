---
phase: 5
title: "R4 Group Affine Double-Rotation (Shape + Line)"
status: completed
priority: P1
effort: "1.5d"
dependencies: [1]
---

# Phase 5: R4 Group Affine Double-Rotation

## Overview
Fix #7 (grouped shapes) and #E (grouped lines): elements inside a rotated group are rotated twice and (for shapes) bloated. Root cause R4 — `flattenGroupElement` derives a child box from `mapBoxByMatrix` (the **AABB** of the rotated box, already enlarged) and then *also* sets `rotate = child.rotate + inheritedRotate + groupRotation`, so the canvas wrapper rotates the already-rotated/enlarged box a second time.

## Key Insights (verified)
- `map-group.js:78` `mapBoxByMatrix(childBoxLocal, groupMatrix)` returns the axis-aligned bounding box of the rotated child → width/height inflate with rotation.
- `map-group.js:79-86`: `transformedChild` uses that inflated `mappedBox.width/height` **and** `rotate += groupRotation`.
- `canvas-element-wrapper.jsx:110` applies `transform:rotate(rotate)` once → net double rotation + wrong size.
- Lines (`map-group.js:88-95`): endpoints are transformed through `groupMatrix` (correct — they already encode group rotation), but the line element still receives `rotate += groupRotation` (line 85) → wrapper rotates the already-rotated endpoints again.
- `group-transform.test.js` only asserts `rotation===15`, `x≥0`, `width>0` — too loose to catch bloat/position error.

## Requirements
- Functional #7 (shapes): a child keeps its **intrinsic** width/height; its center is the group-transformed center; rotation = `child.rotate + inheritedRotate + groupRotation` applied **once** by the renderer.
- Functional #E (lines): endpoints are group-transformed (keep); the line element is **not** additionally rotated by the group (endpoints already carry the rotation).
- Non-functional: nested groups still accumulate correctly; flip (`isFlipH/isFlipV`) handled or explicitly scoped.

## Architecture
Replace AABB-based child boxing with **center-transform + dimension-preservation**:
```
childBoxLocal (scaled)
  center = (x + w/2, y + h/2)
  mappedCenter = applyToPoint(groupMatrix, center)
  width/height = childBoxLocal.width/height        # preserved, NOT AABB
  left = mappedCenter.x - width/2 ; top = mappedCenter.y - height/2
  rotate(shape) = child.rotate + inheritedRotate + groupRotation   # once, applied by wrapper around center
  rotate(line)  = child.rotate                                      # endpoints already carry group+inherited rotation
```
- Use existing `applyToPoint` (already imported). Keep `mapBoxByMatrix` for any non-rotated path if needed, but the child path switches to center-transform.
- Branch by child kind: detect line via `x1/y1/x2/y2` present (same predicate already used at `:88`).
- **Line rotation (nested-safe):** endpoints at `:89-90` are transformed by `groupMatrix`, which already accumulates this group's rotation **and** all ancestor rotation (via the `parentMatrix` chain at `:53,63`). So the line element's `rotate` must be `child.rotate` alone — NOT `+ inheritedRotate` and NOT `+ groupRotation`, or nested-group lines get rotated twice by the wrapper.
- Flip: if `groupMatrix` includes reflection (group `isFlipH/isFlipV`), toggle child flip flags rather than baking into rotate. If flip+rotation interaction is uncertain, scope flip-in-rotated-group to Phase 8 visual check and document.

## Related Code Files
- Modify: `server/services/pptx-import/mapper/map-group.js:72-95`
- Read for context: `server/services/pptx-import/geometry.js` (`applyToPoint`, `mapBoxByMatrix`, `rotateAround`), `client/src/components/canvas/canvas-element-wrapper.jsx:110`
- Tests: `map-group.test.js` (tighten assertions)

## Implementation Steps
1. **Read geometry helpers** to confirm `applyToPoint` signature and matrix order; confirm wrapper rotation is about element center.
2. **Red (shape):** test — child box 100×100 at local origin, group rotation 30°. Assert result `width≈100, height≈100` (NOT ≈136.6 AABB), center at the 30°-rotated position, `rotate===30`. Run — fails (current width≈136.6, double rotation).
3. **Green (shape):** implement center-transform + preserved dimensions in `transformedChild`.
4. **Red (line):** test — line endpoints inside a 30°-rotated group: endpoints equal the matrix-transformed coords AND element `rotate===0` (so wrapper doesn't re-rotate). Run — fails (current rotate=30).
5. **Green (line):** keep endpoint transform; set line `rotate = readNumber(child.rotate, 0)` only — exclude **both** `groupRotation` and `inheritedRotate` (endpoints already carry the full accumulated rotation via `groupMatrix`).
6. **Refactor:** factor the child-kind branch cleanly; verify nested-group test (group in group) still accumulates rotation once per level.

## Tests (this phase)
- shape in 30° group: width/height preserved (±0.5), center matches `rotateAround(30, gcx, gcy)` of child center, `rotate===30`
- shape in nested 30°+15° group: `rotate===45`, dimensions preserved
- line in 30° group: endpoints == matrix-transformed, `rotate===0` (child.rotate=0)
- line in nested 30°+15° group (child.rotate=0): endpoints == matrix-transformed, `rotate===0` (NOT 45 — proves inherited rotation is not double-applied to lines)
- line with own `rotate=10` in 30° group: element `rotate===10` (child rotation preserved, group rotation only in endpoints)
- regression: non-rotated group (rotation 0) leaves child box/position unchanged (identity)

## Success Criteria
- [ ] Grouped shapes keep size; positioned at rotated center; rotated once
- [ ] Grouped lines positioned by endpoints; not double-rotated
- [ ] Nested groups accumulate rotation once per level
- [ ] Tightened `map-group.test.js` green; lint clean

## Risk Assessment
- Risk (confidence ~76-78%): line rotation semantics depend on how PPTX encodes line rot vs endpoints. Mitigation: geometry test pins endpoint-driven placement; Phase 8 visual check on a real rotated-group deck (synthetic if none provided).
- Risk: flip inside rotated group. Mitigation: explicit flip test or documented scope-out; do not silently mishandle.

## Security Considerations
- Pure geometry; no external input.

## Next Steps
- Phase 8 visual audit confirms rotated-group layout on a synthetic deck.
