---
phase: 2
title: "Fix C2+C3: addSlide/duplicateSlide bugs"
status: "completed"
priority: P0
effort: "30m"
dependencies: []
---

# Phase 2: Fix C2+C3 — addSlide/duplicateSlide Bugs

## Overview
Fix `addSlide` to accept and use `afterIndex` parameter (C2), and fix `duplicateSlide`/`duplicateSlides` dependency arrays (C3).

## Requirements
- C2: `addSlide` accepts `afterIndex` param — insert after that index, default to append
- C2: Use functional `setCurrentSlideIndex` update to avoid stale closure
- C3: `duplicateSlide` and `duplicateSlides` add `currentSlideIndexRef` to dependency arrays
- C3: Pass `currentSlideIndexRef.current` to `duplicateSlidesAtIndices` for consistency

## Architecture

### C2 Fix (addSlide)
**Before:**
```js
const addSlide = useCallback((templateKey = null) => {
  // ... build newSlide ...
  setPresentation((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }))
  setCurrentSlideIndex(presentation.slides.length)  // stale closure!
}, [presentation, currentSlideIndex, setPresentation, setCurrentSlideIndex])
```

**After:**
```js
const addSlide = useCallback((templateKey = null, afterIndex) => {
  // ... build newSlide ...
  setPresentation((prev) => {
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : prev.slides.length
    const slides = [...prev.slides]
    slides.splice(insertAt, 0, newSlide)
    setCurrentSlideIndex(insertAt)
    return { ...prev, slides }
  })
}, [setPresentation, currentSlideIndexRef])
```

Note: `setCurrentSlideIndex` called synchronously inside `setPresentation` callback is safe because `setCurrentSlideIndex` from EditorPage's useState setter triggers a re-render with the new index.

### C3 Fix (duplicateSlide/duplicateSlides)
**Before:**
```js
const duplicateSlide = useCallback((index) => {
  setPresentation((prev) => {
    const result = duplicateSlidesAtIndices(prev.slides, [index])
    setCurrentSlideIndex(result.currentSlideIndex)
    return { ...prev, slides: result.slides }
  })
}, [setPresentation, setCurrentSlideIndex])  // missing currentSlideIndexRef

const duplicateSlides = useCallback((indices) => {
  // same issue
}, [setPresentation, setCurrentSlideIndex])
```

**After:**
```js
const duplicateSlide = useCallback((index) => {
  setPresentation((prev) => {
    const result = duplicateSlidesAtIndices(prev.slides, [index], currentSlideIndexRef.current)
    setCurrentSlideIndex(result.currentSlideIndex)
    return { ...prev, slides: result.slides }
  })
}, [setPresentation, setCurrentSlideIndex, currentSlideIndexRef])

const duplicateSlides = useCallback((indices) => {
  setPresentation((prev) => {
    const result = duplicateSlidesAtIndices(prev.slides, indices, currentSlideIndexRef.current)
    setCurrentSlideIndex(result.currentSlideIndex)
    return { ...prev, slides: result.slides }
  })
}, [setPresentation, setCurrentSlideIndex, currentSlideIndexRef])
```

Also update `duplicateSlidesAtIndices` helper to actually USE the `currentSlideIndex` parameter (currently accepted but ignored) — add a comment explaining its purpose for future undo/redo context.

## Related Code Files
- Modify: `client/src/hooks/use-slide-operations.js`
- Modify: `client/src/hooks/slide-operation-helpers.js` (if updating duplicateSlidesAtIndices)

## Implementation Steps

### C2: Fix addSlide
1. Read `use-slide-operations.js`
2. Change `addSlide` signature: `(templateKey = null)` → `(templateKey = null, afterIndex)`
3. Change insertion logic: always append → `insertAt = afterIndex + 1` when `afterIndex !== undefined`
4. Change `setCurrentSlideIndex` call: use computed `insertAt` instead of `presentation.slides.length`
5. Fix dependency array: add `currentSlideIndexRef`, remove stale `currentSlideIndex`, remove `presentation`
6. Verify SlidePanel context menu calls `addSlide` correctly (check if it passes `afterIndex`)

### C3: Fix duplicateSlide + duplicateSlides
1. Add `currentSlideIndexRef` to `duplicateSlide` dependency array
2. Pass `currentSlideIndexRef.current` as 3rd arg to `duplicateSlidesAtIndices`
3. Apply same changes to `duplicateSlides`
4. Read `slide-operation-helpers.js` — add comment to `duplicateSlidesAtIndices` signature explaining `currentSlideIndex` param purpose

## Success Criteria
- [ ] `addSlide()` appends to end (backward compatible)
- [ ] `addSlide(null, 2)` inserts at index 3 (after slide 2)
- [ ] Rapid double-click: both slides inserted at correct positions
- [ ] `duplicateSlide` callback re-creates when `currentSlideIndexRef` changes
- [ ] `duplicateSlidesAtIndices` receives `currentSlideIndexRef.current` (even if not used yet)
- [ ] No ESLint warnings (exhaustive-deps)
