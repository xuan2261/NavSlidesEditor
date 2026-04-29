---
phase: 4
title: "Groups Lines And Transform Fidelity"
status: completed
priority: P1
effort: "2d"
dependencies: [2, 3]
---

# Phase 4: Groups Lines And Transform Fidelity

## Context Links
- `server/services/pptx-import/mapper.js`
- `server/services/pptx-import/geometry.js`
- `server/services/pptx-import/mapper.test.js`
- `shared/src/element-renderers.js`
- `client/src/components/SlideCanvas.jsx`

## Overview
Harden transforms that cause visible drift: nested groups, rotation, flips,
connector lines, arrows, and z-order inside flattened groups. This phase turns
ad hoc group math into testable geometry helpers.

## Key Insights
- Current `flattenGroupElement()` composes offsets, rotation, and flips inline.
  That is hard to audit and can move children away from PowerPoint positions.
- Flattening remains the pragmatic choice for editable output, but transform
  math must be deterministic and covered.
- Lines need wrapper geometry and local endpoints to stay consistent across
  editor, HTML export, and PPTX export.

## Requirements
- Functional: group children preserve absolute position, size, rotation, flip,
  and z-order after import.
- Functional: line/connector endpoints and arrowheads preserve source intent.
- Non-functional: transform helpers are pure and independently tested.

## Architecture
```text
group transform tree
  -> geometry affine helpers
  -> flattened absolute child boxes
  -> mapElement(child)
  -> stable zIndex sequence
```

## Related Code Files
- Create: `server/services/pptx-import/group-transform.test.js`
- Modify: `server/services/pptx-import/geometry.js`
- Modify: `server/services/pptx-import/geometry.test.js`
- Modify: `server/services/pptx-import/mapper.js`
- Modify: `server/services/pptx-import/mapper.test.js`

## Tests Before
- Add failing group fixtures:
  - simple group offset.
  - nested group offset.
  - group rotation around group center.
  - group horizontal/vertical flip.
  - rotated child inside rotated group.
- Add failing line fixtures:
  - connector with negative direction.
  - diagonal connector using absolute endpoints.
  - arrow start/end explicit fields.
- Add z-order fixture:
  - children keep visual order after flattening.

## Implementation Steps
1. Add pure affine helpers to `geometry.js`:
   `identityMatrix`, `translate`, `rotateAround`, `scaleAround`,
   `multiply`, `applyToPoint`, `mapBoxByMatrix`.
2. Replace inline group transform math with helper calls.
3. Normalize group origins:
   - group `left/top` are parent-space.
   - child `left/top` are group-local unless parser marks absolute.
4. Compute transformed child bounding boxes from all four corners, not only the
   top-left point.
5. Preserve child rotation as `child.rotate + group.rotate` after box mapping.
6. Keep nested group recursion limit and placeholder warning unchanged.
7. Extend line geometry to handle reversed/negative endpoint directions.

## Todo List
- [x] Add affine transform helpers.
- [x] Replace group inline transform math.
- [x] Add nested group tests.
- [x] Add line direction and arrow tests.
- [x] Verify z-order is stable.
- [x] Confirm no regression in diagram flattening.

## Success Criteria
- [x] Group transform tests pass with <= 1 px tolerance.
- [x] Line endpoint tests pass for horizontal, vertical, diagonal, reversed.
- [x] Existing group/diagram tests still pass.
- [x] Warnings remain deterministic for deep/unsupported groups.

## Risk Assessment
- Risk: flattened rotated boxes differ from PowerPoint visual bounds.
- Mitigation: compute from corners and use visual tolerance; document residual
  editable-vs-perfect-vector tradeoff.
- Risk: nested group data from parser uses mixed absolute/local coordinates.
- Mitigation: add fixture proving detection; fallback to placeholder only when
  impossible to infer safely.

## Security Considerations
- Transform code is pure numeric logic.
- Cap recursion and warning output to prevent pathological PPTX abuse.

## Regression Gate
```bash
npm run test -- server/services/pptx-import/geometry.test.js server/services/pptx-import/group-transform.test.js server/services/pptx-import/mapper.test.js
```

## Next Steps
- Phase 5 raises corpus and visual gates so this cannot regress silently.
