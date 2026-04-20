# Code Review: Phase 1 Critical Fixes

**Reviewer:** code-reviewer
**Date:** 2026-04-16
**Files:** SlideCanvas.jsx, editor-store.js, SelectionPane.jsx, PropertiesPanel.jsx, EditorPage.jsx

---

## SlideCanvas.jsx

### P0-1: Ctrl+B/I/U Forwarding ✅ PASS

- Lines 488–491: Correctly checks `editingElementId` first, then forwards formatting keys (`b`, `i`, `u`, `z`, `y`, `0`) via `return` without `e.preventDefault()`.
- Browser/TipTap handles the formatting natively. ✅

### P0-2: Clipboard Shortcuts ⚠️ PARTIAL PASS

**Ctrl+C (Copy)** ✅ — Clones selected elements, strips `id`, stores in local `clipboard`. Correct.

**Ctrl+X (Cut)** ✅ — Clones + calls `onDeleteSelectedElements()`. Delete is guarded by `!slide?.locked` at line 499. Correct.

**Ctrl+V (Paste)** ✅ — Guarded check for empty clipboard (`clipboardRef.current.length > 0`). No crash on empty clipboard. Correct.

**Ctrl+D (Duplicate)** ⚠️ 1 issue:
- After `onAddElements(clones)` is called, the cloned elements still have `id: undefined`. The parent `addElements` generates new IDs *after* the fact, but `setSelectedElementIds` in `addElements` receives the *original* undefined-ID objects (not the ID-assigned copies).
- **Effect:** After Ctrl+D, newly duplicated elements are NOT selected. A second Ctrl+D would duplicate the *original* selection again, not the new duplicate. User has to manually click to select the duplicate.
- **Fix:** `addElements` should return the new elements with generated IDs, and EditorPage should capture that return value for selection.

**Context Menu: Cut** ✅ — `setClipboard(clones)` + `onDeleteElement()` called sequentially. Correct.

**Context Menu: Paste** ✅ — Guarded with empty clipboard check. Correct.

**Context Menu: Duplicate** ⚠️ 1 issue:
- Same bug as Ctrl+D: no `setSelectedElementIds` call after `onAddElements([newEl])`. New element not auto-selected.

**Ctrl+B/I/U — `e.ctrlKey` check includes `z`/`y`/`0`** ⚠️
- At line 489: `['b','i','u','z','y','0'].includes(e.key.toLowerCase())` forwards undo/redo/reset shortcuts too. Undo/redo are fine (TipTap handles them). However, `0` (reset formatting) is forwarded correctly. No regression, just broader forwarding than strictly needed for P0-1.

### Hidden Element Filter ✅ PASS

- Line 965–968: `.filter(el => !(el.hidden || false))` correctly hides elements where `hidden: true`.
- Filter is applied before `sort((a,b) => (a.zIndex || 0) - (b.zIndex || 0))`, so sorting works correctly on visible elements only.

---

## editor-store.js ✅ PASS

- `copySelected` / `cutSelected`: correctly filter by `selectedIds`, strip `id` with destructuring `{ id, ...rest }`.
- `cutSelected` does NOT delete originals — caller is responsible. Documented in comment. ✅
- `clipboard` state is plain array of cloned objects. ✅

---

## SelectionPane.jsx

### Rename ✅ PASS
- `commitRename` guards against empty string (`renameValue.trim()` check at line 61).
- `Escape` key clears `renamingId` state but does NOT clear the input visually — acceptable UX, no data corruption.

### Drag-and-Drop Reorder ✅ PASS
- `handleDrop` calls `onReorder(fromIdx, toIdx)` with valid array indices.
- No self-reorder guard needed (moving item to same index is a no-op).

### Visibility/Lock Toggles ✅ PASS
- Both buttons call `e.stopPropagation()` to prevent item click → selection change.

### Addictive Selection on Click ✅ PASS
- `handleItemClick` correctly checks `e.ctrlKey || e.metaKey || e.shiftKey`.

### ⚠️ Minor: SelectionPane renders ALL elements (including hidden)

- `elements` prop includes hidden elements (rendered at `opacity: 0.45`).
- `onReorder` indices are computed over the full array (including hidden elements).
- This means reordering visible elements in the layer list affects hidden element positions too.
- **Not a bug** — PowerPoint-style layer lists include hidden layers. Just noting the interaction with hidden element zIndex.

---

## PropertiesPanel.jsx ✅ PASS (with notes)

- `SelectionPane` correctly integrated inside `<CollapsibleSection>`. ✅
- All callbacks (`onToggleVisibility`, `onToggleLock`, `onRename`, `onReorder`) correctly wired. ✅
- `onReorder` builds `updates` array with `id + zIndex`, calls `onUpdateElements(updates)`. ✅
- `onUpdateElement` in `PropertiesPanel` receives `{ x, y, ... }` object and passes it correctly to `updateElement(selectedElementId, updates)`. ✅

---

## EditorPage.jsx

### `addElements` function ⚠️ 1 ISSUE (propagates from SlideCanvas Ctrl+D bug)

```js
const addElements = useCallback((newElements) => {
  if (!newElements || newElements.length === 0) return
  setPresentation((prev) => {
    // ... adds newElements to slide
  })
  setSelectedElementIds(newElements.map(el => el.id)) // ← BUG: el.id is undefined
}, [])
```

- `newElements` passed from SlideCanvas contain `id: undefined` (ID not yet generated).
- `crypto.randomUUID()` generates IDs *inside* the `setPresentation` callback, but `setSelectedElementIds` runs *after* — receiving the same undefined-ID objects.
- **Result:** After paste/duplicate, `selectedElementIds` contains `[undefined, ...]`. No elements selected.
- **Second duplicate issue:** If user presses Ctrl+D again without selecting, the *original* (still selected) elements are duplicated again.

### Prop wiring ✅ PASS

- `SlideCanvas`: `onAddElements={addElements}`, `onUpdateElements={updateElements}`. ✅
- `PropertiesPanel`: `onSelectElement={toggleElementSelection}`, `onUpdateElements={updateElements}`. ✅

### `updateElements` (batch zIndex) ✅ PASS

```js
const updateElements = useCallback((updates) => {
  updates.forEach(({ id, ...changes }) => updateElement(id, changes))
}, [updateElement])
```

Correctly destructures each `{ id, ...changes }` and calls `updateElement`.

---

## Summary

| File | Feature | Status |
|------|---------|--------|
| SlideCanvas.jsx | P0-1 Ctrl+B/I/U forwarding | ✅ PASS |
| SlideCanvas.jsx | P0-2 Ctrl+C/X/V | ✅ PASS |
| SlideCanvas.jsx | P0-2 Ctrl+D (duplicate) | ⚠️ Bug: no auto-select after duplicate |
| SlideCanvas.jsx | Context menu clipboard | ⚠️ Duplicate doesn't auto-select |
| SlideCanvas.jsx | Hidden element filter | ✅ PASS |
| editor-store.js | Clipboard state | ✅ PASS |
| SelectionPane.jsx | Rename | ✅ PASS |
| SelectionPane.jsx | Drag reorder | ✅ PASS |
| SelectionPane.jsx | Visibility/Lock | ✅ PASS |
| PropertiesPanel.jsx | SelectionPane integration | ✅ PASS |
| EditorPage.jsx | `addElements` + prop wiring | ⚠️ Bug: `setSelectedElementIds` receives undefined IDs |

---

## Unresolved Issues

1. **`addElements` undefined ID bug (HIGH priority):** `setSelectedElementIds(newElements.map(el => el.id))` — `el.id` is `undefined` at call time. Fix: capture return value from the state setter, or generate IDs before the state update and pass them separately.

2. **Duplicate not auto-selected (MEDIUM):** After Ctrl+D or context menu Duplicate, newly created element(s) are not selected. Second Ctrl+D duplicates the original selection instead of the new duplicate.

---

**Status:** DONE_WITH_CONCERNS
