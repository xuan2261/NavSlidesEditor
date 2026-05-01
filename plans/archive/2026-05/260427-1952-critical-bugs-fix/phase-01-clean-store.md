---
phase: 1
title: "Fix C1: Clean dead presentation-store state"
status: "completed"
priority: P0
effort: "30m"
dependencies: [0]
---

# Phase 1: Fix C1 — Clean Dead Presentation Store State

## Overview
Remove dead `currentSlideIndex` state and all dead CRUD actions from the presentation store. The store becomes a dumb data holder. The command layer (useSlideOperations + EditorPage) owns all mutations.

## Requirements
- Remove `currentSlideIndex` from store state
- Remove `setCurrentSlide` action
- Remove `updateSlide`, `updateElement`, `addElement`, `deleteElement` actions (dead — always target slide 0)
- Remove `addSlide`, `deleteSlide`, `reorderSlides` actions (dead — store version)
- Keep only: `presentation`, `loading`, `setPresentation`, `setLoading`
- Update JSDoc typedef to match

## Architecture
**Before:**
```js
// presentation-store.js exports:
presentation, currentSlideIndex, loading
setPresentation, setLoading, setCurrentSlide
updateSlide, updateElement, addElement, deleteElement
addSlide, deleteSlide, reorderSlides
```

**After:**
```js
// presentation-store.js exports:
presentation, loading
setPresentation, setLoading
```

## Related Code Files
- Modify: `client/src/stores/presentation-store.js`
- Modify: `client/src/stores/presentation-store.test.js` (Phase 6 — rewrite tests)
- No other files need changes — production code never calls these actions

## Implementation Steps

### Step 1: Clean store (presentation-store.js)
1. Read `presentation-store.js`
2. Remove `currentSlideIndex: 0` from initial state
3. Remove `setCurrentSlide: (idx) => set({ currentSlideIndex: idx })`
4. Remove `updateSlide` function
5. Remove `updateElement` function
6. Remove `addElement` function
7. Remove `deleteElement` function
8. Remove `addSlide` function
9. Remove `deleteSlide` function
10. Remove `reorderSlides` function
11. Update JSDoc typedef — remove all dead action types
12. Keep: `presentation`, `loading`, `setPresentation`, `setLoading`
13. Result should be ~40 lines instead of ~133 lines

### Step 2: Verify no broken imports
1. `grep -r "from.*presentation-store" client/src/` — verify nothing imports dead exports
2. Run `npm run build` or `npm run lint` to catch any issues

## Success Criteria
- [ ] Store reduced to 4 exports: presentation, loading, setPresentation, setLoading
- [ ] No TypeScript/ESLint errors after change
- [ ] App still loads (presentation-store only used for data holding)
- [ ] presentation-store.test.js still exists but needs rewrite (Phase 6)

## Risk Assessment
- **Risk**: Store CRUD actions might be called by something not found in grep
  - **Mitigation**: Phase 0 grep verification first. If found, adjust scope.
- **Risk**: Remove too much
  - **Mitigation**: Keep `presentation`, `loading`, `setPresentation`, `setLoading` — these are actively used
