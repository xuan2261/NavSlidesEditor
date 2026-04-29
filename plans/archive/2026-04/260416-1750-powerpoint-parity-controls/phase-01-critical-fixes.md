# Phase 1: Critical Fixes

**Phase:** 1/3 | **Priority:** 🔴 P0 | **Estimated:** 1-2 days  
**Files:** `SlideCanvas.jsx`, `editor-store.js`, `PropertiesPanel.jsx`

---

## Issues

| #    | Issue                                    | Area       | Fix Complexity |
| ---- | ---------------------------------------- | ---------- | -------------- |
| P0-1 | Ctrl+B/I/U không hoạt động khi edit text | Canvas     | Easy           |
| P0-2 | KHÔNG CÓ Cut/Copy/Paste elements         | Canvas     | Medium         |
| P0-3 | KHÔNG CÓ Selection Pane (layer list)     | Properties | Medium         |

---

## P0-1: Fix Ctrl+B/I/U Keyboard Shortcuts (SlideCanvas.jsx)

### Root Cause

```jsx
// SlideCanvas.jsx line 480-486
if (editingElementId) {
  if (e.key === 'Escape') {
    onStopEdit()
    e.preventDefault()
  }
  return // ← RETURN NGAY → TipTap KHÔNG nhận được Ctrl events
}
```

### Fix Steps

**Step 1:** Sửa `onKeyDown` handler trong `SlideCanvas.jsx`

```jsx
// Thay:
// if (editingElementId) { ...; return }

// Thành:
// if (editingElementId) {
//   if (e.key === 'Escape') { onStopEdit(); e.preventDefault(); return }
//   // Forward formatting shortcuts to TipTap (do NOT block)
//   if ((e.ctrlKey || e.metaKey) &&
//       ['b','i','u','z','y','0','1'].includes(e.key.toLowerCase())) {
//     return // Let browser/TipTap handle
//   }
//   return // Block other keys khi đang edit
// }
```

**Step 2:** Verify with `EditorPage.jsx` — test all:

- `Ctrl+B` → Bold text
- `Ctrl+I` → Italic text
- `Ctrl+U` → Underline text
- `Ctrl+Z` → Undo
- `Ctrl+Y` → Redo

**Step 3:** Test keyboard shortcuts khi KHÔNG edit text (vẫn hoạt động như cũ)

### Verification

```bash
# Test criteria:
# ✅ Ctrl+B/I/U work khi đang type trong text box
# ✅ Ctrl+Z/Y work khi đang type trong text box
# ✅ Escape vẫn stop edit đúng
# ✅ Canvas shortcuts (Delete, Escape select) vẫn work khi không edit
```

---

## P0-2: Add Cut/Copy/Paste Elements (editor-store + SlideCanvas)

### Architecture

```
editor-store.js          SlideCanvas.jsx          PropertiesPanel.jsx
┌──────────────────┐    ┌──────────────────┐
│ clipboard: {      │    │ Ctrl+C → copy() │ → Lưu element clones
│   type: 'copy'   │    │ Ctrl+X → cut()  │ → Lưu + delete
│   elements: [...] │    │ Ctrl+V → paste()│ → Insert at mouse pos
│   sourceSlideIdx  │    │ Ctrl+D → dup()  │ → copy + paste
│ }                │    └──────────────────┘
└──────────────────┘
```

### Implementation Steps

**Step 1:** Thêm clipboard state vào `editor-store.js`

```js
// Thêm vào store:
clipboard: null, // { elements: [...], sourceSlideIdx: number }

// Actions:
copySelectedElements: () => { ... },
cutSelectedElements: () => { ... },
pasteElements: (slideIdx, x, y) => { ... },
duplicateSelected: () => { ... },
```

**Step 2:** Thêm keyboard shortcuts vào `SlideCanvas.jsx`

```jsx
// Trong onKeyDown handler:
// if (selectedElementIds.length > 0) { ... }
// THÊM:
if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
  copySelectedElements()
  e.preventDefault()
}
if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
  cutSelectedElements()
  e.preventDefault()
}
if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
  pasteElements(currentSlideIdx, mouseX, mouseY)
  e.preventDefault()
}
if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
  duplicateSelected()
  e.preventDefault()
}
```

**Step 3:** Thêm Canvas context menu items

```jsx
// Trong canvas-context-menu JSX:
<button onClick={copySelectedElements}>Copy (Ctrl+C)</button>
<button onClick={cutSelectedElements}>Cut (Ctrl+X)</button>
<button onClick={pasteElements}>Paste (Ctrl+V)</button>
<button onClick={duplicateSelected}>Duplicate (Ctrl+D)</button>
```

**Step 4:** Thêm UI feedback

- `copied` state trong SlideCanvas → hiện toast "Copied N elements"
- `pasting` state → hiện ghost element tại vị trí paste

### Edge Cases

- Paste vào slide KHÁC với slide nguồn → work (đặt tại center của slide)
- Paste khi clipboard rỗng → disabled button
- Cut element đã locked → skip locked elements
- Copy element có zIndex cao nhất → giữ nguyên zIndex + 1 offset

### Verification

```
✅ Ctrl+C → elements saved to clipboard
✅ Ctrl+X → elements removed + saved
✅ Ctrl+V → elements inserted at mouse position
✅ Ctrl+D → elements duplicated in place
✅ Ctrl+C/X/V/D work from context menu
✅ Paste to different slide works
```

---

## P0-3: Add Selection Pane (PropertiesPanel.jsx)

### PowerPoint Reference

View → Selection Pane → Danh sách tất cả objects trên slide với:

- Visibility toggle (eye icon)
- Lock toggle
- Name (editable)
- Drag to reorder zIndex

### Component Structure

```jsx
// Thêm vào PropertiesPanel.jsx:
<CollapsibleSection title="Selection Pane" defaultOpen={false}>
  <SelectionPane
    elements={slide.elements}
    selectedIds={selectedElementIds}
    onSelect={(id, additive) => onToggleSelectElement(id, additive)}
    onToggleVisibility={(id) => onUpdateElement(id, { hidden: !el.hidden })}
    onToggleLock={(id) => onUpdateElement(id, { locked: !el.locked })}
    onRename={(id, name) => onUpdateElement(id, { name })}
    onReorder={(fromIdx, toIdx) => {
      /* reorder zIndex */
    }}
  />
</CollapsibleSection>
```

### UI Design

```
┌─────────────────────────────┐
│ Selection Pane          👁 📌 │
├─────────────────────────────┤
│ ⋮ Text Box 1        [icon] ✓ ✓ │
│ ⋮ Image 1           [icon] ✓   │
│ ⋮ Shape 2           [icon] ✓ ✓ │
│ ⋮ Chart 1           [icon] ✓   │
└─────────────────────────────┘
  ↓ drag to reorder
```

### Implementation Steps

**Step 1:** Tạo `SelectionPane` component

```jsx
// client/src/components/SelectionPane.jsx
// Props: elements, selectedIds, onSelect, onToggleVisibility,
//        onToggleLock, onRename, onReorder

// Features:
// - List all elements with type icon
// - Eye icon → toggle hidden
// - Lock icon → toggle locked
// - Double-click → rename inline
// - Drag → reorder zIndex
// - Click → select element
// - Shift+click → range select
```

**Step 2:** Thêm `hidden` field support trong element model

- Trong `slide.elements[]`, thêm `{ ...el, hidden: boolean }`
- Trong `SlideCanvas`, khi render: `{...el.hidden ? null : <CanvasElement />}`

**Step 3:** Thêm vào PropertiesPanel

```jsx
<CollapsibleSection title="Selection Pane" defaultOpen={false}>
  <SelectionPane
    elements={slide.elements || []}
    selectedIds={selectedElementIds}
    onSelect={onToggleSelectElement}
    onToggleVisibility={(id) => {
      const el = slide.elements.find((e) => e.id === id)
      onUpdateElement(id, { hidden: !el?.hidden })
    }}
    onToggleLock={(id) => {
      const el = slide.elements.find((e) => e.id === id)
      onUpdateElement(id, { locked: !el?.locked })
    }}
    onRename={(id, name) => onUpdateElement(id, { name })}
    onReorder={(fromIdx, toIdx) => {
      // Reorder zIndex
      const els = [...slide.elements]
      const [moved] = els.splice(fromIdx, 1)
      els.splice(toIdx, 0, moved)
      // Assign new zIndexes
      els.forEach((el, i) => onUpdateElement(el.id, { zIndex: i }))
    }}
  />
</CollapsibleSection>
```

**Step 4:** Thêm `hidden` vào element rendering in SlideCanvas

```jsx
// Trong SlideCanvas, render elements:
// {slide?.elements?.filter(el => !el.hidden)...
```

### Verification

```
✅ Selection Pane hiện trong Properties Panel (collapsed by default)
✅ Tất cả elements được liệt kê với type icon + name
✅ Click element → chọn trên canvas
✅ Eye icon → ẩn/hiện element trên canvas
✅ Lock icon → toggle lock
✅ Double-click name → rename inline
✅ Drag item → reorder zIndex
✅ Shift+click → range select
```

---

## Phase 1 Todo Checklist

- [x] **P0-1 Fix:** Ctrl+B/I/U keyboard shortcuts (SlideCanvas.jsx)
- [x] **P0-2 Copy:** Add `copySelectedElements` to editor-store.js
- [x] **P0-2 Cut:** Add `cutSelectedElements` to editor-store.js
- [x] **P0-2 Paste:** Add `pasteElements` to editor-store.js
- [x] **P0-2 Shortcuts:** Add Ctrl+C/X/V/D to SlideCanvas keyboard handler
- [x] **P0-2 Menu:** Add Copy/Cut/Paste/Duplicate to canvas context menu
- [x] **P0-3 Pane:** Create SelectionPane component
- [x] **P0-3 Visibility:** Add `hidden` field support in element model + SlideCanvas
- [x] **P0-3 Integrate:** Add SelectionPane to PropertiesPanel (CollapsibleSection)

---

## Success Criteria (Phase 1)

1. ✅ Ctrl+B/I/U hoạt động khi edit text (TipTap nhận keyboard events)
2. ✅ Copy element → Ctrl+C → Ctrl+V → element mới xuất hiện
3. ✅ Cut element → element bị xóa → có thể paste lại
4. ✅ Ctrl+D → element được duplicate tại chỗ
5. ✅ Selection Pane hiện tất cả elements với icon + name + visibility + lock
6. ✅ Ẩn/hiện element từ Selection Pane hoạt động
7. ✅ Lock/unlock element từ Selection Pane hoạt động
8. ✅ Drag reorder zIndex trong Selection Pane hoạt động
