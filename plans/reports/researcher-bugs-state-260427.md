# Research: State Management Bugs

## Bug 1: Dead currentSlideIndex in presentation-store.js

### Root Cause
presentation-store.js exposes `currentSlideIndex` state and `setCurrentSlide(idx)` action, but production code never calls `setCurrentSlide`. EditorPage owns `currentSlideIndex` as a local `useState(0)` (EditorPage.jsx:139) and a `useRef` synced via `useEffect` (EditorPage.jsx:212-223). `useSlideOperations` receives `currentSlideIndex` and `currentSlideIndexRef` as props from EditorPage and never calls any store method. Grep confirms: no production file calls `setCurrentSlide` — only `presentation-store.test.js` does (isolated unit test). The store's `updateElement` (line 51), `addElement` (line 72), `deleteElement` (line 86), `updateSlide` (line 35), `addSlide` (line 106), `deleteSlide` (line 119), `reorderSlides` (line 130) ALL read `state.currentSlideIndex` which is always 0.

### Impact
All store CRUD actions target slide 0 unconditionally. Multi-slide presentations are silently broken: editing, adding, or deleting elements always affects the first slide regardless of the user's current selection. Store's `addSlide`, `deleteSlide`, `reorderSlides` also move the store's internal cursor to wrong positions.

### Fix Strategy
Two options:
- **Option A (Minimal)**: Keep the store as-is, add a comment marking `currentSlideIndex` as EditorPage-local and store CRUD as unused. Zero risk but leaves dead code.
- **Option B (Clean)**: Remove `currentSlideIndex`, `setCurrentSlide`, and all CRUD actions (`updateElement`, `addElement`, `deleteElement`, `updateSlide`, `addSlide`, `deleteSlide`, `reorderSlides`) from the store entirely. The store's only live export would be `presentation`, `loading`, `setPresentation`, `setLoading`. Requires updating `presentation-store.test.js` (which tests the dead API) and removing dead JSDoc typedef entries.
- **Recommended**: Option B. The store is functionally a dumb data holder (`presentation` + `loading`). The command layer in `useSlideOperations` handles all slide mutations correctly via `setPresentation` with `currentSlideIndexRef`.

### Test Scenarios
- Unit test: store CRUD actions always target the correct slide index (currently fails because store index is always 0)
- Integration test: after calling `setCurrentSlide(2)` then `addElement`, element appears on slide 2 (currently would appear on slide 0)
- Remove tests for `setCurrentSlide` if the store action is deleted

### EditorPage Context
EditorPage owns `currentSlideIndex` as `useState(0)` (line 139) and `currentSlideIndexRef` (line 212) kept in sync via `useEffect`. All child components (SlideCanvas, SlidePanel, PropertiesPanel, Toolbar) receive `currentSlideIndex` as props or read it via `useEditorStore`. The store's `currentSlideIndex` is completely redundant.

### Interaction with Other Bugs
Fixing Bug 1 (removing dead store CRUD) makes Bug 3's missing `currentSlideIndexRef` argument to `duplicateSlidesAtIndices` stand out more clearly as an inconsistency vs `deleteSlide`/`deleteSlides` which correctly pass `currentSlideIndexRef.current`.

---

## Bug 2: addSlide ignores afterIndex

### Root Cause
`addSlide` (use-slide-operations.js lines 227-262) accepts `templateKey` as parameter but has no `afterIndex` parameter at all — the function signature is `(templateKey = null)`. It always appends: `setPresentation((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }))` (line 258). The store's `addSlide` (presentation-store.js line 103) correctly uses `afterIndex + 1` in splice, but `useSlideOperations.addSlide` never calls the store method. Additionally, `presentation.slides.length` (line 259) is read from the closure at render time, not computed inside `setPresentation` — so rapid successive calls accumulate stale indices.

### Impact
"Insert slide after current" always creates at end. UI "Insert slide after X" is silently broken. In `SlidePanel`, if user right-clicks slide 3 to insert a new slide, it appears at the end of the deck, not after slide 3.

### Fix Strategy
Minimal: add `afterIndex` parameter to `addSlide`, compute `insertAt = afterIndex !== undefined ? afterIndex + 1 : prev.slides.length` inside `setPresentation`. Change `setCurrentSlideIndex` to use computed index rather than closure `presentation.slides.length`. One-line signature change + one-line index logic fix. Backward-compatible: `afterIndex = undefined` defaults to append (existing behavior).

### Test Scenarios
- `addSlide()` without arg appends to end (existing behavior, verify it still works)
- `addSlide(null, 2)` inserts at index 3 (after slide 2)
- Rapid double-click "add slide" button: two slides inserted at correct positions
- "Insert after" from SlidePanel context menu: slide inserted at correct position

### Interaction with Other Bugs
Bug 1 fix (removing store CRUD) eliminates the store's `addSlide` that correctly uses `afterIndex`, making Bug 2 the sole source of truth. No conflict — Bug 2 fix handles the insertion logic correctly.

---

## Bug 3: duplicateSlide missing currentSlideIndexRef

### Root Cause
`duplicateSlidesAtIndices` (slide-operation-helpers.js:24) accepts but does not use a `currentSlideIndex` parameter. `duplicateSlide` (use-slide-operations.js:276-286) does NOT pass any ref to `duplicateSlidesAtIndices`, unlike `deleteSlide` (line 268) which passes `currentSlideIndexRef.current`. The `duplicateSlidesAtIndices` helper always computes `currentSlideIndex` from the duplicated indices (helpers.js:41-42) — correct for duplication but inconsistent with the delete pattern. The dependency array `[]` (line 285) is technically correct (no stale closure because `currentSlideIndexRef` is not read inside the callback body), but ESLint `react-hooks/exhaustive-deps` would warn and it's a maintenance hazard as the function grows.

### Impact
Low severity — `duplicateSlidesAtIndices` returns the correct index based on duplicated positions (always the last duplicated slide). The actual user-facing behavior is correct. The bug is architectural inconsistency and future-proofing risk.

### Fix Strategy
Two changes: (1) Pass `currentSlideIndexRef.current` to `duplicateSlidesAtIndices` for consistency with the delete pattern (even though the helper ignores it today, the signature should be consistent for future changes). (2) Add `currentSlideIndexRef` to dependency array to satisfy ESLint. `duplicateSlides` (line 288) has identical issue — apply same fix.

### Test Scenarios
- Duplicate slide at index 0, 2, 5: verified new slide appears after original
- Rapid duplicate button clicks: each creates a new slide after the previous duplicate
- Undo/redo after duplicate: index state is consistent

### Interaction with Other Bugs
Bug 1 fix (removing store) makes the `currentSlideIndexRef` inconsistency more visible. Bug 2 fix (addSlide with afterIndex) introduces a similar insertion-point concern that `duplicateSlide` should mirror for consistency.

---

## Unresolved Questions

1. Why does `duplicateSlidesAtIndices` accept `currentSlideIndex` but not use it? Was this intended for future undo/redo context where the "current" selection before duplication matters?
2. Is there a `presentation-store.test.js` test that directly tests `setCurrentSlide` + subsequent mutations? If yes, deleting the store CRUD actions requires updating those tests first.
3. The store JSDoc typedef at line 18 declares `addSlide(slide, afterIndex)` — does any code (e.g. a test import or a future feature) rely on this typedef? The hook's `addSlide` doesn't match this signature.
