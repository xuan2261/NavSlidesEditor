# Phase 2: Core PowerPoint Parity

**Phase:** 2/3 | **Priority:** 🟠 P1 | **Estimated:** 3-5 days  
**Files:** `EditorPage.jsx`, `Toolbar.jsx`, `SlidePanel.jsx`, `editor-store.js`

---

## Issues

| # | Issue | Area | Fix Complexity |
|---|---|---|---|
| P1-1 | KHÔNG CÓ Slide Sorter View | SlidePanel | Medium |
| P1-2 | KHÔNG CÓ Mini Toolbar (floating bar) | Toolbar | Medium |
| P1-3 | KHÔNG CÓ Manual Zoom Controls | Canvas | Easy |
| P1-4 | Toolbar quá đông, thiếu tooltip+shortcut labels | Toolbar | Easy |
| P1-5 | KHÔNG CÓ Multi-select slides | SlidePanel | Easy |

---

## P1-1: Add Slide Sorter View

### PowerPoint Reference
View → Slide Sorter → Grid view tất cả slides (thumbnail nhỏ, 4-6/hàng), click để select, drag để reorder.

### Implementation Steps

**Step 1:** Thêm view mode state vào `EditorPage.jsx`
```jsx
// State:
const [viewMode, setViewMode] = useState('normal') // 'normal' | 'sorter'

// Actions:
const enterSlideSorter = () => setViewMode('sorter')
const exitSlideSorter = () => setViewMode('normal')
```

**Step 2:** Tạo `SlideSorterView` component
```jsx
// client/src/components/SlideSorterView.jsx
// Props: slides, currentIndex, onSelect, onMove, onDelete, onDuplicate

// Features:
// - Grid layout: 4-6 slides per row (responsive)
// - Each slide: thumbnail (scaled-down preview) + slide number
// - Click: select slide (go to normal view)
// - Ctrl+click: multi-select
// - Drag: reorder slides
// - Context menu: Duplicate, Delete, Lock
// - Active slide: highlighted border
```

**Step 3:** Tích hợp vào EditorPage layout
```jsx
// EditorPage.jsx:
{viewMode === 'sorter' ? (
  <SlideSorterView
    slides={presentation.slides}
    currentIndex={currentSlideIndex}
    onSelect={(idx) => {
      setCurrentSlideIndex(idx)
      setViewMode('normal')
    }}
    onMove={handleMoveSlide}
    onDelete={handleDeleteSlide}
    onDuplicate={handleDuplicateSlide}
  />
) : (
  <div className="editor-main">
    <SlidePanel ... />
    <SlideCanvas ... />
    <PropertiesPanel ... />
  </div>
)}
```

**Step 4:** Thêm nút chuyển đổi vào View menu
```jsx
// EditorMenuBar.jsx - viewItems:
{
  type: 'button',
  label: 'Slide Sorter',
  icon: Grid3x3,
  onClick: onSlideSorter,
}
```

### UI Design
```
┌──────────────────────────────────────────────────────────┐
│ Slide Sorter View                              [✕ Close] │
├──────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │  1   │ │  2   │ │  3   │ │  4   │ │  5   │ │  6   │     │
│ │thumb │ │thumb │ │thumb │ │thumb │ │thumb │ │thumb │     │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│ ┌──────┐ ┌──────┐ ┌──────┐                               │
│ │  7   │ │  8   │ │  9   │  ← current                  │
│ │thumb │ │thumb │ │thumb │                               │
│ └──────┘ └──────┘ └──────┘                               │
└──────────────────────────────────────────────────────────┘
```

### Verification
```
✅ View → Slide Sorter → hiện grid view tất cả slides
✅ Click slide → quay về normal view + chọn slide đó
✅ Drag slide → reorder đúng
✅ Right-click → context menu (Duplicate, Delete)
✅ Multi-select (Ctrl+click) → selected highlighted
```

---

## P1-2: Add Mini Toolbar (Floating Formatting Bar)

### PowerPoint Reference
PowerPoint: Khi chọn text element → floating bar xuất hiện ngay trên text với B/I/U/Underline/Font/Font Size/Color.

### Implementation Steps

**Step 1:** Tạo `MiniToolbar` component
```jsx
// client/src/components/MiniToolbar.jsx
// Props: editor, position (x, y), onClose

// Features:
// - Hiện khi user chọn text element (editingElementId != null)
// - Floating positioned gần vùng chọn text
// - Buttons: Bold, Italic, Underline, Font Color, Highlight Color, Font Size dropdown
// - Tự động ẩn khi user click outside hoặc ESC
// - Có arrow/chevron gắn với vùng chọn
```

**Step 2:** Tích hợp vào `SlideCanvas`
```jsx
// Trong SlideCanvas render:
{isEditing && editor && (
  <MiniToolbar
    editor={editor}
    position={{
      x: element.x + element.width / 2,  // center of element
      y: element.y - 50,                   // above element
    }}
    onClose={() => onStopEdit()}
  />
)}
```

**Step 3:** CSS positioning
```css
.mini-toolbar {
  position: absolute;
  /* Positioning logic: flip if near edges */
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  border-radius: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  display: flex;
  gap: 2px;
  padding: 4px;
  pointer-events: auto;
}
```

### UI Design
```
┌─────────────────────────────────────────┐
│ [B] [I] [U] │ [Font▾] [Size▾] │ [A🔵]  │
└─────────────────────────────────────────┘
         ↑ arrow pointing to text
```

### Verification
```
✅ Double-click text → Mini Toolbar xuất hiện trên text
✅ Click B/I/U → text được format (TipTap commands)
✅ Click color → color picker popup
✅ ESC / click outside → ẩn toolbar
✅ Tooltip cho từng button với shortcut
✅ Toolbar flip direction khi gần edges
```

---

## P1-3: Add Manual Zoom Controls

### PowerPoint Reference
PowerPoint: Zoom dropdown (25%-400%) + Zoom in/out buttons ở bottom-right.

### Implementation Steps

**Step 1:** Thêm zoom state vào `SlideCanvas.jsx`
```jsx
// Trong SlideCanvas state:
const [scale, setScale] = useState(1)
const [userZoomMode, setUserZoomMode] = useState(false) // auto-fit vs manual

// useEffect: chỉ resize observer auto-fit khi userZoomMode = false
```

**Step 2:** Thêm zoom controls UI
```jsx
// Thêm vào bottom-right của canvas container:
<div className="zoom-controls">
  <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} title="Zoom out">
    <Minus size={12} />
  </button>
  <select
    value={`${Math.round(scale * 100)}`}
    onChange={(e) => {
      const pct = parseInt(e.target.value) / 100
      setScale(Math.max(0.1, Math.min(4, pct)))
      setUserZoomMode(true)
    }}
  >
    <option value="25">25%</option>
    <option value="50">50%</option>
    <option value="75">75%</option>
    <option value="100">100%</option>
    <option value="150">150%</option>
    <option value="200">200%</option>
    <option value="400">400%</option>
  </select>
  <button onClick={() => setScale(s => Math.min(4, s + 0.1))} title="Zoom in">
    <Plus size={12} />
  </button>
  <button onClick={() => {
    setUserZoomMode(false)
    updateScaleAuto() // trigger ResizeObserver logic
  }} title="Fit to window">
    Fit
  </button>
</div>
```

**Step 3:** Add Ctrl+scroll to zoom
```jsx
// Trong containerRef's onWheel:
if (e.ctrlKey) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  setScale(s => Math.max(0.1, Math.min(4, s + delta)))
  setUserZoomMode(true)
}
```

### Verification
```
✅ Zoom buttons ±10% work
✅ Zoom dropdown chính xác %
✅ Ctrl+scroll zoom work
✅ "Fit" button → auto-fit to container
✅ Zoom % hiển thị trong dropdown
```

---

## P1-4: Toolbar UX Improvements

### Improvements

**Step 1:** Thêm tooltip với keyboard shortcut cho mỗi button
```jsx
// Toolbar.jsx - thêm title attribute cho mỗi formatting button:
<button
  className={`btn-icon ${editor.isActive('bold') ? 'active' : ''}`}
  onClick={() => editor.chain().focus().toggleBold().run()}
  title="Bold (Ctrl+B)"  // ← THÊM SHORTCUT VÀO TITLE
>
  <Bold size={15} />
</button>
```

**Step 2:** Reorganize Toolbar groups (visual separators)
```jsx
// Toolbar.jsx - dùng toolbar-divider rõ ràng hơn:
<span className="toolbar-divider" data-group="insert" />
<span className="toolbar-divider" data-group="font" />
<span className="toolbar-divider" data-group="format" />
<span className="toolbar-divider" data-group="align" />
<span className="toolbar-divider" data-group="insert-element" />
```

**Step 3:** Conditional button titles (active state)
```jsx
<button
  title={
    editor.isActive('bold')
      ? 'Bold (Ctrl+B) — active'
      : 'Bold (Ctrl+B)'
  }
>
```

### Verification
```
✅ Mỗi button có tooltip với shortcut khi hover
✅ Các nhóm controls được phân tách rõ bằng dividers
✅ Active buttons hiển thị trạng thái trong tooltip
```

---

## P1-5: Multi-Select Slides (SlidePanel)

### Implementation Steps

**Step 1:** Thêm multi-select state vào `SlidePanel.jsx`
```jsx
// State:
const [selectedIndices, setSelectedIndices] = useState([currentIndex])

// Handler:
const handleSlideClick = (e, index) => {
  if (e.ctrlKey || e.metaKey) {
    // Toggle selection
    setSelectedIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  } else if (e.shiftKey && prev.length > 0) {
    // Range select
    const last = prev[prev.length - 1]
    const range = Array.from(
      { length: Math.abs(index - last) + 1 },
      (_, i) => Math.min(last, index) + i
    )
    setSelectedIndices(range)
  } else {
    setSelectedIndices([index])
    onSelect(index)
  }
}
```

**Step 2:** Visual feedback for multi-selected slides
```jsx
// Trong slide-item className:
className={`slide-item ${index === currentIndex ? 'active' : ''} ${
  selectedIndices.includes(index) ? 'multi-selected' : ''
}`}
```

**Step 3:** CSS for multi-selected state
```css
.slide-item.multi-selected {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

**Step 4:** Delete/Duplicate selected slides
```jsx
// Trong slide context menu hoặc footer buttons:
{selectedIndices.length > 1 && (
  <>
    <button onClick={() => selectedIndices.forEach(i => onDelete(i))}>
      Delete {selectedIndices.length} slides
    </button>
    <button onClick={() => selectedIndices.forEach(i => onDuplicate(i))}>
      Duplicate {selectedIndices.length} slides
    </button>
  </>
)}
```

### Verification
```
✅ Ctrl+click slide → toggle selection
✅ Shift+click → range select
✅ Selected slides highlighted
✅ Delete → xóa tất cả selected slides
✅ Duplicate → duplicate tất cả selected slides
```

---

## Phase 2 Todo Checklist

- [x] **P1-1 View:** Thêm viewMode state vào EditorPage.jsx
- [x] **P1-1 Component:** Tạo SlideSorterView component
- [x] **P1-1 Integrate:** Tích hợp SlideSorter vào EditorPage layout
- [x] **P1-1 Menu:** Thêm View → Slide Sorter vào EditorMenuBar
- [x] **P1-2 Component:** Tạo MiniToolbar component
- [x] **P1-2 Integrate:** Tích hợp MiniToolbar vào SlideCanvas
- [x] **P1-2 CSS:** Floating position + edge flip logic
- [x] **P1-3 Zoom:** Thêm zoom state + manual zoom mode
- [x] **P1-3 Controls:** Zoom buttons + dropdown + Fit button
- [x] **P1-3 Scroll:** Ctrl+scroll zoom handler
- [x] **P1-4 Tooltips:** Thêm title attributes với shortcuts cho tất cả buttons
- [x] **P1-4 Dividers:** Thêm visual separators giữa các nhóm
- [x] **P1-5 Multi:** Thêm multi-select state + handlers
- [x] **P1-5 CSS:** Multi-selected visual feedback
- [x] **P1-5 Batch:** Delete/Duplicate batch operations

---

## Success Criteria (Phase 2)

1. ✅ View → Slide Sorter → hiện grid view → click quay về normal view
2. ✅ Mini Toolbar xuất hiện khi chọn text element với B/I/U/Color
3. ✅ Mini Toolbar tự động ẩn khi click outside / ESC
4. ✅ Zoom controls: ±10% buttons, dropdown %, Ctrl+scroll, Fit button
5. ✅ Toolbar buttons: mỗi button có tooltip "Action (Ctrl+key)"
6. ✅ Toolbar groups được phân tách rõ bằng visual dividers
7. ✅ SlidePanel: Ctrl+click → multi-select slides
8. ✅ SlidePanel: Multi-select → batch delete/duplicate
