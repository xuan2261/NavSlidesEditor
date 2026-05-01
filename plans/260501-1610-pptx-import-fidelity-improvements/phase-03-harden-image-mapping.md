---
phase: 3
title: "Harden image property mapping"
status: completed
priority: P2
effort: "2h"
dependencies: []
---

# Phase 3: Harden Image Property Mapping

## Overview
Improve real image property preservation. Some image properties from pptxtojson are ignored or misinterpreted. This phase adds missing mappings and fixes the critical `rect` crop unit mismatch.

## Key Findings from Research

### Critical: `rect` Crop Unit Mismatch

pptxtojson outputs crop values like:
```json
{ "l": 1.474, "r": 22.275, "b": 12.267 }
```

Current code divides by 1000, assuming 0-1000 range:
```js
const left = Math.min(1, Math.max(0, readNumber(element.rect.l, 0) / 1000))
// readNumber(1.474, 0) / 1000 = 0.001474 → near-zero → crop silently ignored
```

**These are percentages (0-100 range), NOT fractions of 1000.** Dividing by 1000 makes all crops zero. Fix: detect the unit and divide accordingly.

### Medium: `borderType` and `borderStrokeDasharray`

pptxtojson provides `borderType` (solid/dashed/dotted) and `borderStrokeDasharray` — both ignored. The NavSlides schema and renderer support these fields.

### Low: Visual Effects

`effect`/`shadow`/`brightness`/`contrast`/`grayscale` on images — not present in corpus but would be lost if encountered.

### Already Mapped (Correct)
`rotation`, `opacity`, `flipH`, `flipV`, `borderColor`, `borderWidth`, `alt`, `objectFit`, `src` via `baseElement()`.

## Related Code Files
- Modify: `server/services/pptx-import/mapper.js` — `mapImage()` function (lines 227-277)
- Modify: `server/services/pptx-import/property-mapping.test.js` — add image property tests

## Implementation Steps

### Step 0: Verify border field names (IMPORTANT — do before implementing)
Red-team flagged that `borderStyle` and `borderDashArray` field names are assumed but never verified against the NavSlides schema or renderer.
1. Search `client/src/` for how image borders are rendered — check `element-renderers.js` or similar
2. Verify what field names the renderer actually uses for image border style and dash pattern
3. If renderer doesn't use these fields, the mapping is pointless — skip border steps and document as "renderer doesn't support"
4. If fields ARE used, proceed with steps 2-3

### Step 1: Fix `rect` crop unit detection
1. Read `mapper.js` `mapImage()` crop section (~line 258-275)
2. Replace the `/1000` division with smart detection:
   ```javascript
   if (element.rect) {
     const rawL = readNumber(element.rect.l, 0)
     const rawR = readNumber(element.rect.r, 0)
     const rawT = readNumber(element.rect.t, 0)
     const rawB = readNumber(element.rect.b, 0)
     // Detect unit: if any value > 1, it's either percentage (0-100) or per-mile (0-1000)
     const maxVal = Math.max(Math.abs(rawL), Math.abs(rawR), Math.abs(rawT), Math.abs(rawB))
     let left, right, top, bottom
     if (maxVal > 100) {
       // Per-mille (0-1000) → divide by 1000
       left = Math.min(1, Math.max(0, rawL / 1000))
       right = Math.min(1, Math.max(0, rawR / 1000))
       top = Math.min(1, Math.max(0, rawT / 1000))
       bottom = Math.min(1, Math.max(0, rawB / 1000))
     } else if (maxVal >= 1) {
       // Percentage (0-100) → divide by 100. Use >= to handle maxVal===1 exactly.
       left = Math.min(1, Math.max(0, rawL / 100))
       right = Math.min(1, Math.max(0, rawR / 100))
       top = Math.min(1, Math.max(0, rawT / 100))
       bottom = Math.min(1, Math.max(0, rawB / 100))
     } else {
       // Already fraction (0-1) → use as-is
       left = Math.min(1, Math.max(0, rawL))
       right = Math.min(1, Math.max(0, rawR))
       top = Math.min(1, Math.max(0, rawT))
       bottom = Math.min(1, Math.max(0, rawB))
     }
     // ... rest of crop computation unchanged
   }
   ```

### Step 2: Add `borderType` mapping
1. In `mapImage()`, after `borderWidth`:
   ```javascript
   if (element.borderType) img.borderStyle = element.borderType
   ```
2. Note: The NavSlides schema uses `borderStyle` for CSS border-style

### Step 3: Add `borderStrokeDasharray` mapping
```javascript
if (element.borderStrokeDasharray) img.borderDashArray = element.borderStrokeDasharray
```

### Step 4: Write comprehensive image property tests
1. Add test: `rect` with percentage values (0-100) → crop computed correctly
2. Add test: `rect` with per-mille values (0-1000) → crop computed correctly
3. Add test: `rect` with fractional values (0-1) → crop computed correctly
4. Add test: image with `borderType` → nav element has `borderStyle`
5. Add test: image with `borderStrokeDasharray` → nav element has `borderDashArray`

### Step 5: Verify
1. Run fidelity tester → image coverage should improve (crop units now work)
2. Run all unit tests → expect 168+ tests to pass

## Success Criteria
- [ ] `rect` crop unit auto-detection handles percentages and fractions
- [ ] `borderType` mapped to `borderStyle`
- [ ] `borderStrokeDasharray` mapped to `borderDashArray`
- [ ] Image fidelity improves (especially Bai_2_5 crop images)
- [ ] All unit tests pass

## Risk Assessment
- **Medium risk**: `rect` unit detection could mis-detect in edge cases
- **Mitigation**: Write tests for each unit variant before changing code
