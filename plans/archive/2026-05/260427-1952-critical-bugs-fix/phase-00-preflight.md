---
phase: 0
title: "Pre-flight: Verify all affected files"
status: "completed"
priority: P0
effort: "15m"
dependencies: []
---

# Phase 0: Pre-flight — Verify All Affected Files

## Overview
Verify all files that import or depend on the presentation-store before modifying it.

## Requirements
- List every consumer of `presentation-store.js`
- Confirm `setCurrentSlide` is never called in production
- Confirm `updateElement`, `addElement`, `deleteElement` from store are never called in production
- Confirm `useSlideOperations.addSlide` is the only slide-addition path
- Confirm no code imports the store's CRUD actions directly

## Architecture
Read-only verification — no code changes.

## Related Code Files
- Read: `client/src/stores/presentation-store.js`
- Read: `client/src/hooks/use-slide-operations.js`
- Grep: `from.*presentation-store` across `client/src/`

## Implementation Steps
1. `grep -r "presentation-store" client/src/ --include="*.js" --include="*.jsx"` → list all consumers
2. `grep -r "setCurrentSlide\|updateElement\|addElement\|deleteElement\|updateSlide\|addSlide\|deleteSlide\|reorderSlides" client/src/ --include="*.js" --include="*.jsx" | grep -v presentation-store.js | grep -v ".test."` → confirm no production calls
3. Read EditorPage.jsx to confirm it uses `useSlideOperations.addSlide` (not store.addSlide)
4. Read SlidePanel.jsx to confirm how it adds slides
5. Document findings in this phase file

## Success Criteria
- [x] Complete list of all presentation-store consumers
- [x] Confirmed: `currentSlideIndex`, `setCurrentSlide`, `updateSlide`, `updateElement`, `addSlide`, `deleteSlide`, `reorderSlides` — DEAD (only test code calls them)
- [x] Confirmed: `addElement`, `deleteElement` — LIVE (use-clipboard.js calls them)
- [x] No surprises found during verification

## SCOPE ADJUSTMENT FOUND
- `use-clipboard.js` (line 120-121) calls `store.addElement` and `store.deleteElement`
- `use-clipboard.js` (line 119) reads `currentSlideIndex` from store
- Phase 1 must ALSO update `use-clipboard.js`: pass `currentSlideIndex` as param instead of reading from store
- Plan assumption "no production code calls dead CRUD" was WRONG for `addElement`/`deleteElement`

## Risk Assessment
- Low risk — read-only verification
- Phase 1 scope adjusted to account for use-clipboard.js dependency
