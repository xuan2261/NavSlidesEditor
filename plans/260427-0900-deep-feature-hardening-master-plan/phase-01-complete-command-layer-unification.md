---
phase: 1
title: "Complete Command Layer Unification"
status: completed
priority: P0
effort: "4-6d"
dependencies: []
---

# Phase 1: Complete Command Layer Unification

## Context Links

- Audit: `plans/reports/debugger-260427-0823-refactoring-plan-audit.md`
- Research: `plans/reports/researcher-260427-0900-p2-cleanup-and-p6-pptx-fidelity.md`
- Code: `client/src/components/SlideCanvas.jsx` (lines 508-649: inline keyboard, lines 1281-1365: context menu clipboard)
- Code: `client/src/hooks/use-keyboard.js` (createKeyboardHandler pattern — good)
- Code: `client/src/hooks/use-clipboard.js` (performCopy/Paste/Cut/Duplicate)
- **CRITICAL FIX:** `performDuplicate` uses 50ms `setTimeout` — must be made sync
- Tests to create: `client/src/hooks/use-clipboard.test.js`
- Tests to update: `tests/e2e/keyboard-shortcuts.spec.js`

## Overview

Complete the ~60% done Phase 2 work from the old plan. Remove inline keyboard/clipboard
from `SlideCanvas.jsx`, wire everything through `useKeyboard` + `useClipboard` callbacks,
fix the `performDuplicate` async bug, add locked-element guard, and create missing unit tests.

> **⚠️ CRITICAL:** `use-clipboard.js` `performDuplicate` uses `setTimeout(..., 50)` — this is
> a **user-visible regression** if kept. Must be refactored to synchronous before Phase 1 ships.

## Key Insights

**What was already done (keep):**
- `createKeyboardHandler` + `useMemo` pattern in use-keyboard.js
- `performDuplicate` rewritten with `crypto.randomUUID()`
- `slideRef` for stale-closure fix
- `clipboardRef` for paste handler
- Locked-element guards in SlideCanvas keyboard handler
- Paste-on-empty-selection for post-slide-change paste

**What still needs to be done:**
1. SlideCanvas STILL has its own `document.addEventListener('keydown', onKeyDown)` at ~line 648 — must be removed
2. Inline clipboard code (lines 560-646) still exists in SlideCanvas — must be replaced with callback calls
3. Context menu clipboard actions (lines 1292-1365) still inline — must call command callbacks
4. `use-clipboard.test.js` NOT created
5. Keyboard E2E tests have only 4 lines changed

## Architecture

```
use-keyboard.js (createKeyboardHandler)
  -> dispatches command callbacks
use-clipboard.js (performCopy/Paste/Cut/Duplicate)
  -> owns clipboard semantics (fresh IDs, +20/+20 offset)
SlideCanvas.jsx
  -> receives command callbacks as props (onCopy, onCut, onPaste, onDuplicate, onDelete, onEscape)
  -> NO inline clipboard logic
  -> NO standalone keydown listener
Context menu
  -> calls same command callbacks
EditorPage.jsx
  -> wires command callbacks: SlideCanvas + useKeyboard + useClipboard
```

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx` — remove inline keyboard/clipboard, accept command callbacks
- Modify: `client/src/pages/EditorPage.jsx` — wire command callbacks once
- Modify: `client/src/hooks/use-clipboard.js` — ensure `addElements` helper or use `addElement` per element
- Create: `client/src/hooks/use-clipboard.test.js`
- Modify: `tests/e2e/keyboard-shortcuts.spec.js`
- Delete: none (unless dead inline code becomes fully unused after refactor)

## Implementation Steps

### CRITICAL: Fix `performDuplicate` Semantics BEFORE Wiring

**Step 0:** Refactor `use-clipboard.js` `performDuplicate` to synchronous:
- Current: `setTimeout(..., 50)` — 50ms delay before elements appear (user-visible regression)
- Fix: inline `addElement` synchronously, remove `setTimeout`
- Keep `setClipboard` write for clipboard semantics
- Add locked-element guard: skip entirely if any selected element is locked (matches SlideCanvas inline behavior)

```js
// FIXED performDuplicate (synchronous)
const performDuplicate = useCallback(() => {
  if (selectedElementIds.length === 0 || !presentation) return
  const slide = presentation.slides[currentSlideIndex]
  if (!slide) return
  const elementsToDuplicate = (slide.elements || []).filter(el =>
    selectedElementIds.includes(el.id)
  )
  if (elementsToDuplicate.length === 0) return
  if (elementsToDuplicate.some(el => el.locked)) return // locked guard

  setClipboard(elementsToDuplicate)
  // Synchronous — no setTimeout
  const newElementIds = []
  elementsToDuplicate.forEach(el => {
    const newId = crypto.randomUUID()
    newElementIds.push(newId)
    addElement({ ...el, id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 })
  })
  if (newElementIds.length > 0) {
    selectElement(newElementIds[newElementIds.length - 1])
  }
}, [...])
```

### Tests First (TDD)

1. Create `client/src/hooks/use-clipboard.test.js`:
   - `performCopy`: no-op when empty, stores correct elements
   - `performPaste`: fresh UUIDs, +20/+20 offset, selects last
   - `performCut`: copies then deletes originals, clears selection
   - `performDuplicate`: **sync** — elements appear instantly; **locked guard** — skips if any selected is locked
   - Multi-element: fresh IDs for all

2. Tests will fail against current 50ms implementation — fix Step 0 first.

### Command Callback Wiring

3. In `EditorPage.jsx`, pass command callbacks to `SlideCanvas`:
   ```jsx
   <SlideCanvas
     // ... existing props
     onCopy={performCopy}
     onCut={performCut}
     onPaste={performPaste}
     onDuplicate={performDuplicate}
     onDelete={/* existing or new handler */}
     onEscape={handleEscape}
   />
   ```

4. Also wire `useKeyboard` in EditorPage (or SlideCanvas) with the same callbacks.

### SlideCanvas Refactor (the core work)

5. **Remove the inline keyboard listener** (`useEffect` at ~line 508-649). Keep only:
   - Crop mode keyboard handling (Enter/Escape for crop) — this is canvas-internal, not clipboard
   - Forward TipTap formatting shortcuts (`Ctrl+B/I/U/Z/Y/0`) — these are canvas-internal

   Replace the REMAINING clipboard shortcuts with calls to the command callbacks:
   - `onDeleteSelectedElements()` -> `onDelete?.()`
   - `setClipboard(clones)` -> `onCopy?.()`
   - cut logic -> `onCut?.()`
   - paste logic -> `onPaste?.()`
   - duplicate logic -> `onDuplicate?.()`

6. **Refactor context menu clipboard actions** (lines 1292-1365). Replace inline clipboard code with:
   - Copy button -> `onCopy?.()`
   - Cut button -> `onCut?.()`
   - Paste button -> `onPaste?.()`
   - Duplicate button -> `onDuplicate?.()`

7. **Verify paste-on-empty-selection still works**: The code at lines 627-646 handles paste when `selectedElementIds.length === 0`. This must be preserved — it calls `onAddElements?.()` for the clipboard contents.

### Cleanup

8. After SlideCanvas no longer calls `setClipboard` directly, verify `setClipboard` is only called from `use-clipboard.js`.

9. Verify `clipboardRef` usage in SlideCanvas — if no longer needed for inline clipboard, it may still be needed for paste-on-empty. Keep if still referenced; remove if orphaned.

10. Run unit tests:
    ```bash
    npm run test -- client/src/hooks/use-clipboard.test.js client/src/hooks/use-keyboard.test.js
    ```

11. Run Playwright E2E:
    ```bash
    npx playwright test tests/e2e/keyboard-shortcuts.spec.js
    ```

12. Run `npm run lint` and `npm run build`.

## File Change Summary

### SlideCanvas.jsx — what to remove:

| Lines | What | Why removed |
|-------|------|------------|
| 508-509, 648 | `useEffect` with `document.addEventListener('keydown')` | Replaced by `useKeyboard` in EditorPage |
| 560-624 | Inline clipboard shortcuts (copy/cut/paste/duplicate) | Replaced by command callbacks |
| 627-646 | Paste-on-empty-selection | Keep — calls `onAddElements`, canvas-internal |
| 1292-1307 | Context menu Copy | Replace with `onCopy?.()` |
| 1309-1324 | Context menu Cut | Replace with `onCut?.()` |
| 1325-1340 | Context menu Paste | Replace with `onPaste?.()` |
| 1341-1360 | Context menu Duplicate | Replace with `onDuplicate?.()` |

### SlideCanvas.jsx — what to add:

- Accept new props: `onCopy`, `onCut`, `onPaste`, `onDuplicate` (or reuse existing `onAddElements` for paste)
- Crop mode keyboard handling (Enter/Escape) stays inline — it is canvas-internal state
- TipTap shortcut forwarding stays inline — it is canvas-internal

### EditorPage.jsx — what to add:

- Import `useClipboard` from hooks
- Call `useClipboard()` to get `performCopy`, `performPaste`, `performCut`, `performDuplicate`
- Pass these as callbacks to `SlideCanvas`
- Wire `useKeyboard` with the same callbacks (if not already done)

## Todo List

- [x] `use-clipboard.test.js` created and passing (17 tests)
- [x] `performDuplicate` refactored to synchronous (removed `setTimeout(..., 50)`)
- [x] SlideCanvas accepts command callbacks as props (`onCopy`, `onCut`, `onPaste`, `onDuplicate`)
- [x] SlideCanvas inline keyboard listener removed
- [x] SlideCanvas inline clipboard shortcuts replaced with callback calls
- [x] Context menu clipboard actions replaced with callbacks
- [x] Paste-on-empty-selection preserved (via `onPaste` callback)
- [x] TipTap shortcut forwarding preserved (canvas-internal)
- [x] EditorPage wires command callbacks once (`useClipboard` + `useKeyboard`)
- [x] `clipboardRef` and `setClipboard` removed from SlideCanvas
- [x] `useEditorStore` import removed from SlideCanvas (no longer needed)
- [x] Dead `addElements` function removed from EditorPage
- [x] `npm run test` passes (398/398, +17 new tests)
- [x] `npm run build` passes
- [x] `npm run lint` passes

## Completion Results (2026-04-27)

**LOC reduction:** SlideCanvas 2759 → 2680 (−79 lines, −3%)

**Key changes:**
- `use-clipboard.js` refactored: pure functions `createCopyOperation`, `createPasteOperation`, `createDuplicateOperation`, `createCutOperation` exposed for unit testing
- `performDuplicate` now synchronous (no `setTimeout`)
- `performDuplicate` includes locked-element guard
- SlideCanvas keyboard handler: inline clipboard shortcuts replaced with `onCopy?.()`, `onCut?.()`, `onPaste?.()`, `onDuplicate?.()`
- SlideCanvas context menu: clipboard actions use same callbacks
- `useKeyboard` wired at EditorPage level with all command callbacks
- `useClipboard` wired at EditorPage level; clipboard callbacks passed to SlideCanvas
- Dead code removed: `clipboardRef`, `setClipboard` store read, `addElements` function from EditorPage

## Verification Commands

```bash
npm run test -- client/src/hooks/use-clipboard.test.js client/src/hooks/use-keyboard.test.js
npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/element-interactions.spec.js
npm run lint
npm run build
```

## Success Criteria

- [ ] SlideCanvas has NO standalone `document.addEventListener('keydown')` for clipboard commands
- [ ] SlideCanvas has NO inline clipboard logic (copy/cut/paste/duplicate)
- [ ] Context menu and keyboard shortcut share same command implementation
- [ ] `use-clipboard.test.js` exists and covers all operations
- [ ] Paste-on-empty works after slide change
- [ ] Locked-element guard still works
- [ ] All keyboard E2E tests pass
- [ ] `SlideCanvas.jsx` LOC reduced by ~100-150 lines

## Risk Assessment

- Risk: removing inline clipboard from SlideCanvas breaks paste-on-empty-selection.
  - Mitigation: preserve lines 627-646 separately; paste-on-empty is canvas-internal.
- Risk: context menu loses element-local context for copy (needs element ID).
  - Mitigation: context menu already has `contextMenu.elementId`; wire `onCopy` to include that ID or use a different callback signature like `onCopyElement(elementId)`.
- Risk: `slideRef` and `clipboardRef` are still used for paste-on-empty.
  - Mitigation: keep these refs; they are needed for the paste-on-empty path.

## Security Considerations

- Do not read/write system clipboard beyond in-app element clipboard scope.
- Do not serialize trusted HTML embeds into browser clipboard.
- Validate element IDs in callbacks — never trust client-side IDs without ownership check.

## Next Steps

After Phase 1 is complete, proceed to Phase 2 (canvas render decomposition) — it is the critical blocker for all later phases.
