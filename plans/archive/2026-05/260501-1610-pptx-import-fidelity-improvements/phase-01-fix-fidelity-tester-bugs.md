---
phase: 1
title: "Fix fidelity tester bugs: image scoring + math type"
status: completed
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Fix Fidelity Tester Bugs

## Overview
Fix two bugs causing false-positive coverage drops: spurious image gap and unrecognized `math` type.

## Bug 1: Spurious `preserved-objectFit` Gap

**File**: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:549-554`

**Current**:
```javascript
if (type === 'image') {
  const score = navEl.src ? 1 : 0.1
  if (!navEl.src) gaps.push('missing-image-src')
  if (navEl.objectFit) gaps.push('preserved-objectFit')  // ← BUG: fires when present
  return { score, gaps }
}
```

**Fix**: Remove the `preserved-objectFit` gap line. `objectFit` is always set by `mapImage` (defaults to `'contain'`), so this gap fires on every image, polluting the gap list with a false positive. Does NOT affect the score (cosmetic fix only).

## Bug 2: `math` Type Elements → 0% Coverage (Critical)

**Research confirmed**: pptxtojson parses Office Math ML (OMML) equations into `type: 'math'` elements with `latex` + `picBase64` rasterized fallback. Bai_2_2 has 4 such elements.

**Root cause chain**:
1. `mapCategory('math')` → `'other'` (no 'math' case in mapper)
2. `'other'` in `evaluateCapture` → fallback score=0.5 per matched
3. Nav placeholder has `importPlaceholderType: 'unknown-object'` — not matched
4. 0 matched → 0% coverage for 'other' (4 unmatched elements)

**Fix**: In `mapElement`, add handler for `element.type === 'math'`:
- Use `picBase64` as image source if available (pptxtojson rasterizes math to PNG)
- If no picBase64, use the `latex` content as a text fallback
- Set `importPlaceholderType: 'math'`

In fidelity tester `evaluateCapture`:
- Add case for `type === 'other'` checking `navEl.importPlaceholderType`
- If `importPlaceholderType === 'math'` and source was 'math': score = 0.8 (partial, rasterized)

## Related Code Files
- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` — remove spurious gap, add math handling
- Modify: `server/services/pptx-import/mapper.js` — add `math` type handler in `mapElement()`

## Implementation Steps

### Step 1: Fix image scoring
1. Read `pptx-import-semantic-and-roundtrip-fidelity-tester.js` line ~549
2. Remove `if (navEl.objectFit) gaps.push('preserved-objectFit')`

### Step 2: Add math handler in mapper
1. Read `mapper.js` `mapElement()` around line 457-496
2. Add before the final placeholder return:
   ```javascript
   if (element.type === 'math') {
     const mathElement = { ...element }
     if (element.picBase64) {
       mathElement.type = 'image'
       mathElement.base64 = element.picBase64
       return mapImage(mathElement, context)
     }
     return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
   }
   ```
3. Result: math → converted to image via picBase64, or falls back to placeholder

### Step 3: Add math recognition in fidelity tester
1. In `evaluateCapture`, add `|| type === 'math'` to the shape/diagram/line block (line 584) and check for math placeholder:
   ```javascript
   if (type === 'shape' || type === 'diagram' || type === 'line' || type === 'other' || type === 'math') {
     if (navEl.importPlaceholderType === 'math') return { score: 0.8, gaps: ['math-rasterized'] }
     // ... existing shape scoring
   }
   ```
   **CRITICAL**: Do NOT add a separate `type === 'other'` check — `normalizeSemanticType('math')` returns `'math'`, not `'other'`, so it falls through to the shape block instead. The fix must be in the shape block.

### Step 4: Write tests
1. Add unit test: `evaluateCapture` for image with objectFit should not push false gap
2. Add unit test: `mapElement` with `type: 'math'` and `picBase64` → returns image element
3. Add unit test: `mapElement` with `type: 'math'` but no picBase64 → returns placeholder with math importPlaceholderType
4. Run full test suite

### Step 5: Verify
1. Run fidelity tester → Bai_2_2 "other" should improve from 0%
2. Run all unit tests → expect 168+ tests to pass

## Success Criteria
- [ ] `preserved-objectFit` spurious gap removed
- [ ] `math` type from pptxtojson → image element (via picBase64) or math placeholder
- [ ] Fidelity: Bai_2_2 "other" coverage improves from 0%
- [ ] All unit tests pass

## Risk Assessment
- **Low risk**: Isolated to test/mapping code
- **Mitigation**: Each fix independently testable with unit tests
