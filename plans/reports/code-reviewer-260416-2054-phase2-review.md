# Code Review: Phase 2 — PowerPoint Parity Controls

**Reviewer:** code-reviewer
**Date:** 2026-04-16
**Phase:** 2 — PowerPoint Parity Controls
**Scope:** SlideSorterView, SlidePanel multi-select, SlideCanvas zoom/mini-toolbar, MiniToolbar, Toolbar

---

## Summary

Phase 2 adds solid structural features (slide sorter, multi-select batch ops, canvas zoom, floating mini-toolbar). A few correctness issues found — mostly edge cases that surface under specific interactions.

---

## Issues Found

### 1. `MiniToolbar` — wrong position when canvas is scrolled or centered

**File:** `MiniToolbar.jsx` (rendered from `SlideCanvas.jsx` lines 1345–1360)
**Severity:** 🔴 Critical

**Problem:**

```jsx
const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0
const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0
return (
  <MiniToolbar
    position={{
      x: containerLeft + (el.x + (el.width ?? 200) / 2) * scale,
      y: containerTop + el.y * scale,
    }}
```

- `position.y` uses `el.y * scale` — this is the element's position within the **slide coordinate space**, but the canvas itself is centered inside `containerRef` via flexbox (`alignItems: center, justifyContent: center`). `getBoundingClientRect().top` is the container's top edge, not the canvas top-left. The offset is off by half the gap between container edge and canvas.
- `position.x` places the toolbar at the element's center horizontally but `position.y` places it at the element's top — no vertical offset below the element. The toolbar will appear flush against the element's top edge with no separation.
- No scroll offset subtraction: if the canvas area scrolls (overflow), scroll position is not accounted for.

**Fix:** Calculate canvas rect separately:

```jsx
const canvasRect = canvasRef.current?.getBoundingClientRect()
if (!canvasRect) return null
return (
  <MiniToolbar
    position={{
      x: canvasRect.left + (el.x + (el.width ?? 200) / 2) * scale,
      y: canvasRect.top + el.y * scale - 44, // above element, adjust for toolbar height
    }}
```

---

### 2. `SlidePanel` — batch delete index shifting races with prop `currentIndex`

**File:** `SlidePanel.jsx` lines 488–503
**Severity:** 🟡 Warning

**Problem:**

```jsx
toDelete.forEach((i) => {
  onDelete(i) // calls EditorPage → splice array → re-render with new currentIndex
  if (i < currentIndex) newIdx--
})
setSelectedIndices([Math.max(0, newIdx)])
```

- `currentIndex` is the **initial** prop value at loop start. During the loop, `onDelete` triggers parent state updates, and `currentIndex` prop changes mid-loop in React's async batching. The `if (i < currentIndex)` comparison uses a stale closure value.
- For large deletions (e.g., 5 slides at indices 0–4 when `currentIndex=10`), each `onDelete(i)` shifts slides below `i` by 1, but the comparison keeps checking against the original 10 instead of the already-decremented value. Result: `newIdx` ends up wrong.
- Example: `toDelete=[0,1,2,3,4]`, `currentIndex=10`. Loop: all 4 comparisons use `currentIndex=10`. `newIdx` decreases by 5 → becomes 5. But correct result: after removing 5 slides from start, index 10 becomes index 5. Actually gives the correct final value by coincidence here. The real problem is when deletions are interspersed.

- Worst case: `toDelete=[4,5]` with `currentIndex=6`. Loop iteration 1: `i=4 < 6`, `newIdx=5`, `onDelete(4)`. Loop iteration 2: `currentIndex` prop may have updated to 5 (React pending), but closure still has 6. `i=5 < 6`, `newIdx=4`. Correct final = 4. Still works. But if deletions are in the opposite order or cross the boundary, the math is brittle.

**Fix:** Capture `currentIndex` at start, use a running base:

```jsx
const toDelete = [...selectedIndices].sort((a, b) => b - a)
let current = currentIndex
let newIdx = currentIndex
toDelete.forEach((i) => {
  onDelete(i)
  if (i < current) {
    newIdx--
    current--
  }
})
setSelectedIndices([Math.max(0, newIdx)])
```

---

### 3. `SlideSorterView` — `onMove` called with wrong index after intermediate deletion

**File:** `SlideSorterView.jsx` lines 73–80
**Severity:** 🟡 Warning

**Problem:**

```jsx
const handleDrop = (e, idx) => {
  e.preventDefault()
  if (dragIdx !== null && dragIdx !== idx) {
    onMove(dragIdx, idx) // passes original dragIdx
  }
  setDragIdx(null)
  setDragOverIdx(null)
}
```

`onMove(dragIdx, idx)` passes the **original** `dragIdx` (the slide's position at drag-start). If the slide list was reordered by other operations between drag-start and drop (e.g., a parallel delete), the index is stale. However, since `SlideSorterView` is a closed overlay with no external mutations during its lifetime, this is **low risk in practice**. Still, the `key` on map uses `slide.id || idx` which is correct for stable identity.

No fix needed — acceptable given the overlay lifecycle.

---

### 4. `SlideSorterView` — context menu `slides.length > 1` guard is optimistic

**File:** `SlideSorterView.jsx` lines 141–144
**Severity:** 🟡 Warning

**Problem:**

```jsx
style={{ color: slides.length > 1 ? 'var(--danger)' : undefined }}
```

The delete button is shown but grayed out (no `disabled` attr) when `slides.length <= 1`. The parent still receives the click event and `onDelete` is called — the parent needs to guard. If parent doesn't, this will attempt to delete the last slide. Check if `EditorPage`'s `handleDeleteSlide` has a guard. If it does, no issue. If not, the last slide can be deleted.

**Fix:** Add `disabled` attribute or guard `onDelete` in SlideSorterView.

---

### 5. `SlideCanvas` — zoom via `onWheel` fires on trackpad two-finger scroll

**File:** `SlideCanvas.jsx` lines 723–730
**Severity:** 🟡 Warning

**Problem:**

```jsx
onWheel={(e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((s) => Math.max(0.1, Math.min(4, s + delta)))
    setUserZoomMode(true)
  }
}}
```

On macOS, `ctrlKey` is often true on regular scroll (mission control / Spaces gestures) even without Ctrl held. This intercepts normal scrolling in the canvas area. Also, `onWheel` doesn't use `{ passive: false }` initially — `e.preventDefault()` may fail silently on some browsers if the listener isn't registered as non-passive.

**Fix:** Consider requiring a modifier key held indicator, or check `e.ctrlKey && e.type === 'wheel'` more carefully:

```jsx
onWheel={(e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()  // fine if listener is passive:false
    ...
```

Note: The `onWheel` prop doesn't have `passive` control in React without additional setup. This is a known cross-browser issue — the current implementation is a reasonable best-effort.

---

### 6. `SlidePanel` — `selectedIndices` state goes stale when slide navigation happens outside the panel

**File:** `SlidePanel.jsx` lines 34, 93–108
**Severity:** 🟢 Minor

**Problem:**
`selectedIndices` is internal state. If the user changes `currentIndex` via keyboard shortcuts (←/→) or other navigation controls in `EditorPage`, the `selectedIndices` in `SlidePanel` still holds the old selection. The `multi-selected` CSS class uses `selectedIndices.includes(index)`, so it can show stale visual highlights for slides that are no longer selected.

**Fix:** Either lift `selectedIndices` to `EditorPage` and pass it down + update it on all navigation events, or accept the limitation and document it.

---

### 7. `SlidePanel` — batch duplicate `forEach` creates slides in wrong order

**File:** `SlidePanel.jsx` lines 481–486
**Severity:** 🟢 Minor

**Problem:**

```jsx
selectedIndices.forEach((i) => onDuplicate(i))
```

Duplicates are created in ascending index order. If duplicating slides 1 and 3:

- First `onDuplicate(1)` → inserts copy at index 2, original slide 3 becomes index 4
- Second `onDuplicate(3)` → but `presentation.slides[3]` is now the copy just created, not original slide 3

This results in wrong slides being duplicated, or duplicates appearing in unexpected positions.

**Fix:** Sort descending and adjust insert positions, or pass a batch-duplicate handler that inserts all at once:

```jsx
const sorted = [...selectedIndices].sort((a, b) => b - a)
sorted.forEach((i) => {
  const actualIdx = Math.min(i, presentation.slides.length - 1)
  onDuplicate(actualIdx)
})
```

Actually better: pass `onDuplicateBatch` to SlidePanel that accepts `[idx1, idx2, ...]` and handles the shift internally.

---

## Unresolved Questions

1. **EditorPage `handleDeleteSlide` guard**: Does the delete handler in EditorPage guard against deleting the last slide? If not, Issue #4 in SlideSorterView becomes a critical regression.
2. **`passive: false` on wheel listener**: The SlideCanvas `onWheel` handler calls `e.preventDefault()` — is this reliably working in the target browsers (Electron, standard Chrome)? Electron's webContents may behave differently.
3. **CSS existence**: The review assumes all CSS classes referenced in JSX (`.mini-toolbar`, `.zoom-controls`, `.slide-sorter-overlay`, `.multi-selected`, `.slide-panel-batch-footer`) exist in `index.css`. Not verified in this review.

---

## Positive Findings

- `SlideSorterView` drag-and-drop logic is clean and correct — `dragIdx !== idx` guard prevents drop on self, sorting not needed since drop index is relative to current position.
- Zoom controls (`Fit`, `+`, `-`, dropdown) integrate well with `ResizeObserver` via `userZoomMode` flag — proper separation of user intent vs. auto-fit.
- `MiniToolbar` uses `onMouseDown` with `e.preventDefault()` for all buttons — correctly prevents TipTap from losing focus during formatting.
- `SlidePanel` `selectedIndices` state is properly reset to `[index]` on normal click — no persistent selection leak.
- `SlideSorterView` uses `slide.id || idx` as key — handles both stable IDs and index-based fallbacks correctly.

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Phase 2 implementation is solid overall. 1 critical issue (MiniToolbar positioning), 2 warnings (batch delete race, scroll zoom passive), 3 minor issues. Fix critical + warnings before merge.
