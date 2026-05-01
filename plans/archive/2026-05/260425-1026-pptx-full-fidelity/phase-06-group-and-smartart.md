---
phase: 6
title: "Groups/SmartArt Flattening"
status: complete
priority: P2
effort: "2-3 days"
dependencies: [phase-00-sanitizer-hardening, phase-01-rich-html-preservation, phase-02-shape-line-image-enhancement]
---

# Phase 6: Groups/SmartArt Flattening

## Overview

Replace group placeholder with actual flattening. Flatten group children to absolute positions with transforms. Add SmartArt/diagram → individual elements or SVG. **Requires Phase 0 array-return contract.**

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P2-B Group array return contract
- Phase 0: `phase-00-sanitizer-hardening.md` — array return contract
- Existing mapper: `server/services/pptx-import/mapper.js`
- pptxtojson schema: `plans/reports/researcher-260425-0946-pptxtojson-schema.md` §5i, §5j

## Requirements

**Groups:**
- Extract all child elements from group
- Convert relative child positions → absolute positions on slide
- Apply group-level transforms: rotation, flipH, flipV
- Recurse for nested groups (depth cap: 10)
- Preserve child element formatting (Phase 1+2 applied)
- Handle circular references (depth cap prevents infinite loops)

**SmartArt/Diagrams:**
- Convert diagram nodes → individual shape+text elements
- Or render as SVG for visual fidelity
- Extract text content from `textList[]` and `elements[]`

**Phase 0 contract applies:** `mapElement()` returns array. Group handler must return flattened children array.

## Architecture

**Group flattener** (`server/services/pptx-import/group-flattener.js`):
```
Input: { type: 'group', left, top, width, height, rotate, isFlipH, isFlipV, elements[] }
Output: Element[] — flattened children with absolute positions
```

Algorithm:
```
flattenGroup(group, context, depth=0):
  if depth > 10: return [{ placeholder }]
  results = []
  for child in group.elements:
    absLeft = group.left + child.left
    absTop = group.top + child.top
    childTransform = compose(groupTransform, childTransform)
    if child.type === 'group':
      results += flattenGroup(child, context, depth+1)
    else:
      // Process child through normal mapper, then adjust position
      adjustedChild = processElement(child, { left: absLeft, top: absTop, ...child })
      results.push(adjustedChild)
  return results
```

**SmartArt converter** (`server/services/pptx-import/smartart-converter.js`):
- Option A (preferred): Convert diagram nodes → individual elements (editable)
- Option B: Render as SVG (visual fidelity, not editable)
- Scale diagram element positions to slide coordinates

## Related Code Files

**Create:**
- `server/services/pptx-import/group-flattener.js` — group flattening logic
- `server/services/pptx-import/smartart-converter.js` — SmartArt → element[] or SVG

**Modify:**
- `server/services/pptx-import/mapper.js` — replace group → placeholder with flattener call
- `server/services/pptx-import/mapper.test.js` — tests for group and SmartArt

## Implementation Steps

1. **Create `group-flattener.js`**
   - `flattenGroup(group, context, depth = 0)` function
   - Convert relative positions to absolute: `absLeft = group.left + child.left`, etc.
   - Apply rotation: if `group.rotate`, compute rotation matrix
   - Apply flip: if `isFlipH`/`isFlipV`, reflect child coordinates
   - Recurse for nested groups (depth counter, max 10)
   - Return array of flattened child elements

2. **Update `mapElement()` in `mapper.js`**
   - Remove: `if (element.type === 'group') return placeholder(...)`
   - Add: `if (element.type === 'group') return flattenGroup(element, context, 0)`
   - Returns array directly (Phase 0 contract)

3. **Create `smartart-converter.js`**
   - `convertDiagram(element, context)` function
   - Scale diagram element positions from diagram bounding box to slide coordinates
   - For each `diagram.elements[]`: process through `mapElement()` with scaled positions
   - Fallback: if no usable elements, generate SVG placeholder with text list
   - Return array of elements (Phase 0 contract)

4. **Update `mapElement()` for diagram**
   - Add: `if (element.type === 'diagram') return convertDiagram(element, context)`

5. **Handle z-index for flattened elements**
   - Group children maintain relative z-order from group `elements[]` order
   - Diagram elements maintain their own z-order
   - Global zIndex counter increments per flattened result

6. **Add tests in `mapper.test.js`**
   - Test simple group with 2 children → 2 individual elements
   - Test nested group (depth 2) → all grandchildren flattened
   - Test group at depth 10 → processed; depth 11 → placeholder
   - Test group with rotation → children rotated
   - Test group with flip → children reflected
   - Test SmartArt with 3 nodes → 3 individual elements
   - Test empty group → no output (not placeholder)
   - Test zIndex increments correctly for flattened array
   - All existing tests pass

## Success Criteria

- [ ] Group with 2 rectangles → 2 shape elements with absolute positions
- [ ] Nested group (depth 2) → all grandchildren flattened correctly
- [ ] Group at depth 10 → processed; depth 11 → placeholder with warning
- [ ] Group with rotation → children visually rotated (angle preserved)
- [ ] Group with flipH → children horizontally reflected
- [ ] SmartArt with 5 nodes → 5 shape/text elements
- [ ] Empty group → no elements (not placeholder)
- [ ] zIndex increments correctly for flattened array results
- [ ] All existing tests pass

## Risk Assessment

**Risk:** Complex group transforms (nested rotation + flip + scale) may produce unexpected results.
**Mitigation:** Test with real PPTX files. Add diagnostic warning for unusual transforms. Use placeholder for extreme cases.
**Risk:** SmartArt can be very complex (hundreds of nodes, custom layouts).
**Mitigation:** Limit to first 50 nodes with warning. Complex SmartArt → SVG placeholder.
