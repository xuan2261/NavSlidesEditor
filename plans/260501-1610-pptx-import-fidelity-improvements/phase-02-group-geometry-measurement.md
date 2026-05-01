---
phase: 2
title: "Fix group geometry fidelity measurement"
status: completed
priority: P2
effort: "1h"
dependencies: []
---

# Phase 2: Fix Group Geometry Fidelity Measurement

## Overview
The apparent "group geometry drift" (481-807px) is a measurement artifact: the fidelity tester compares PPTX source GROUP elements against NavSlides PLACEHOLDER elements. Since groups are intentionally flattened (children become real elements), this comparison is meaningless. Fix the measurement to accurately assess group-child positioning.

## Key Findings

### Root Cause
1. pptxtojson returns `type: 'group'` with position fields (`left`, `top`, etc.)
2. `semanticBounds(group)` reads `x/y/width/height` — if undefined, returns 0
3. Nav placeholder position = group position scaled via `mapBox(group, scale=1)` → same values
4. Drift = |source_x - nav_x| + |source_y - nav_y| → large because positions are similar but matched incorrectly
5. **ALL corpus groups have `rotate=0`** — rotation code paths are untested

### What Actually Matters
Group CHILDREN positions ARE correctly computed (canvas units, scale=1). The fidelity measurement should measure children, not the group container.

## Measurement Strategy
Recurse into group children in fidelity measurement. Groups are a PPTX organizational concept, not a NavSlides concept — measure what actually gets rendered.

## Related Code Files
- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
  - `computeSemanticFidelity` (line ~219)
  - `computeDetailedFidelityMetrics` (line ~284)
  - `semanticTypePreferences` — remove `case 'group'` entry

## Implementation Steps

### Step 1: Add recursion helper
In fidelity tester, add:
```javascript
function* flattenForFidelity(elements) {
  for (const el of elements) {
    if (el.type === 'group') {
      yield* flattenForFidelity(el.elements || [])
    } else {
      yield el
    }
  }
}
```

### Step 2: Apply to `computeSemanticFidelity` — CRITICAL FIX

**The plan's first version was wrong.** Simply iterating over flattened elements doesn't fix the counting problem. At line 237, `categoryScores[cat].total += 1` still runs for each group in the raw `ppts` array, polluting the group total.

Correct fix: filter groups out BEFORE the counting loop:
```javascript
// Before (line ~229):
for (const pptxEl of ppts) { ... categoryScores[cat].total += 1 }

// After:
for (const pptxEl of ppts) {
  if (pptxEl.type === 'group') {
    // Groups are flattened; process children recursively into categoryScores
    const flattenRec = (el, cat) => {
      categoryScores[cat].total += 1
      for (const child of (el.elements || [])) {
        const childCat = mapCategory(child.type || (child.content ? 'text' : 'other'))
        flattenRec(child, childCat)
      }
    }
    flattenRec(pptxEl, 'group')
    continue
  }
  // ... existing logic (non-group elements) ...
}
```

This ensures groups contribute their children's categories to the totals, not the group category.

### Step 3: Apply to `computeDetailedFidelityMetrics`
Same recursive filtering pattern for geometry drift calculation.

### Step 4: Remove group from `semanticTypePreferences`
Remove `case 'group': return ['group']` — groups are expanded to children, no longer needed.

### Step 5: Update `evaluateCapture`
Remove the `type === 'group'` case — groups are now expanded.

### Step 6: Write tests
1. Test: `flattenForFidelity` correctly expands nested groups
2. Test: Fidelity measurement on a slide with groups matches children, not group containers

### Step 7: Verify
1. Run fidelity tester → expect group "drift" to drop to near-zero (<10px max)
2. Run all unit tests → expect 168+ tests to pass

## Success Criteria
- [ ] Groups recursed into children during fidelity measurement
- [ ] Group "drift" drops from 481-807px to <10px max in fidelity report
- [ ] All unit tests pass

## Risk Assessment
- **High risk**: Changes the counting semantics in computeSemanticFidelity — if group children exceed available nav elements (many-to-few), last children go unmatched regardless of correctness. Group-heavy slides (e.g. Bai_2_2 has 23 groups) will still under-report due to 1-to-1 greedy matching.
- **Mitigation**: Verify fidelity before/after; acknowledge that group-rich slides may still show <100% coverage even with correct positions. Consider accepting this as a known limitation rather than redesigning the matching algorithm.
