# Phase 3: Polish & Advanced

**Phase:** 3/3 | **Priority:** 🟡 P2-P3 | **Estimated:** 5-7 days  
**Files:** `AnimationTimeline.jsx`, `PropertiesPanel.jsx`, `Toolbar.jsx`, `EditorMenuBar.jsx`, `SlideCanvas.jsx`, `InsertMenu.jsx`

---

## Issues

| #     | Issue                                          | Area        | Fix Complexity |
| ----- | ---------------------------------------------- | ----------- | -------------- |
| P2-1  | THIẾU Animation Duration & Delay               | Animation   | Easy           |
| P2-2  | THIẾU Alignment section trong Properties Panel | Properties  | Easy           |
| P2-3  | THIẾU Manual zoom controls                     | Canvas      | Easy           |
| P2-4  | Settings menu quá đông                         | MenuBar     | Easy           |
| P2-5  | Context menu: Bring to Front/Back              | Context     | Easy           |
| P2-6  | Animation Timeline: show all elements          | Animation   | Easy           |
| P2-7  | THIẾU Animation Gallery (12 → 30+ types)       | Animation   | Medium         |
| P2-8  | THIẾU Quick Access Toolbar (QAT)               | MenuBar     | Medium         |
| P2-9  | Find/Replace: tìm trong Markdown/LaTeX         | FindReplace | Medium         |
| P2-10 | Icon picker mở rộng (60 → 200+)                | Insert      | Easy           |

---

## P2-1: Animation Duration & Delay

### PowerPoint Reference

PowerPoint: Animation Duration (0.25s - 5s) + Start delay (0s - 10s) per animation.

### Implementation Steps

**Step 1:** Mở rộng `ANIMATION_TYPES` data

```js
// AnimationTimeline.jsx - thêm vào element data model:
{ ..., duration: 0.5, delay: 0 }
```

**Step 2:** Thêm duration/delay UI trong `AnimationTimeline`

```jsx
// Trong timeline-element-chip, thêm:
<div className="anim-extra">
  <div className="anim-field">
    <label>Duration</label>
    <input
      type="number"
      min="0.1"
      max="5"
      step="0.1"
      value={el.fragmentDuration ?? 0.5}
      onChange={(e) =>
        onUpdateElement(el.id, {
          fragmentDuration: Math.max(0.1, parseFloat(e.target.value) || 0.5),
        })
      }
    />
    s
  </div>
  <div className="anim-field">
    <label>Delay</label>
    <input
      type="number"
      min="0"
      max="10"
      step="0.1"
      value={el.fragmentDelay ?? 0}
      onChange={(e) =>
        onUpdateElement(el.id, {
          fragmentDelay: Math.max(0, parseFloat(e.target.value) || 0),
        })
      }
    />
    s
  </div>
</div>
```

**Step 3:** Map sang reveal.js (css custom properties)

```css
/* Trong generated reveal.js HTML: */
.fragment {
  --fragment-duration: 0.5s;
  --fragment-delay: 0s;
}
/* Map vào animation */
```

### Verification

```
✅ Duration slider: 0.1s → 5s, hiện giá trị
✅ Delay input: 0 → 10s
✅ Preview animation với đúng duration/delay
```

---

## P2-2: Alignment Section in Properties Panel

### PowerPoint Reference

PowerPoint Format Pane → Align → dropdown với visual options.

### Implementation Steps

**Step 1:** Thêm Alignment section vào `PropertiesPanel.jsx`

```jsx
// Thêm collapsible section khi selectedElementIds.length > 0
<CollapsibleSection title="Align & Distribute">
  {selectedElementIds.length >= 2 ? (
    <div className="align-grid">
      {[
        ['left', AlignStartVertical],
        ['center-h', AlignHorizontalJustifyCenter],
        ['right', AlignEndVertical],
        ['top', AlignStartHorizontal],
        ['center-v', AlignVerticalJustifyCenter],
        ['bottom', AlignEndHorizontal],
      ].map(([type, Icon]) => (
        <button key={type} className="btn-icon" title={type} onClick={() => onAlignElements(type)}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  ) : (
    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select 2+ elements to align</p>
  )}
</CollapsibleSection>
```

**Step 2:** Thêm vào canvas context menu

```jsx
// SlideCanvas.jsx - canvas-context-menu:
{
  selectedElementIds.length >= 2 && (
    <>
      <div className="canvas-context-menu-separator" />
      <button onClick={() => alignElements('left')}>Align Left</button>
      <button onClick={() => alignElements('center-h')}>Align Center</button>
      <button onClick={() => alignElements('right')}>Align Right</button>
      <button onClick={() => alignElements('top')}>Align Top</button>
      <button onClick={() => alignElements('center-v')}>Align Middle</button>
      <button onClick={() => alignElements('bottom')}>Align Bottom</button>
      <div className="canvas-context-menu-separator" />
      <button onClick={() => alignElements('distribute-h')}>Distribute H</button>
      <button onClick={() => alignElements('distribute-v')}>Distribute V</button>
    </>
  )
}
```

### Verification

```
✅ Properties Panel: Alignment section visible khi 1+ element selected
✅ Align buttons disabled khi chỉ có 1 element
✅ Context menu: 8 align options hiện khi multi-select
```

---

## P2-3: Settings Menu Reorganization

### Implementation Steps

**Step 1:** Tách Settings menu thành 2 tabs hoặc collapsible sections

```jsx
// EditorMenuBar.jsx - settingsItems:
// Chia Settings thành: Presentation | Presenter Tools

const presentationItems = [
  // Theme, Slide Size, Transition
  { type: 'separator' },
  // Grid, Footer, Page Numbers
]

const presenterItems = [
  // Auto-advance, Loop, Kiosk Mode, Presenter Tools checkboxes
]

// Hiện 2 collapsible groups trong Settings dropdown:
<div className="settings-section">
  <div className="settings-section-title">Presentation</div>
  {/* presentation items */}
</div>
<div className="settings-section">
  <div className="settings-section-title">Presenter</div>
  {/* presenter items */}
</div>
```

**Step 2:** Di chuyển Presenter Tools ra Properties Panel (CollapsibleSection)

```jsx
// PropertiesPanel.jsx:
<CollapsibleSection title="Presenter Tools">
  <PresenterToolsOptions presentation={presentation} onUpdatePresentation={onUpdatePresentation} />
</CollapsibleSection>
```

### Verification

```
✅ Settings dropdown: 2 sections rõ ràng
✅ Presenter Tools also trong Properties Panel
✅ Không còn scroll trong Settings menu
```

---

## P2-4: Context Menu — Bring to Front/Back

### Implementation Steps

**Step 1:** Thêm vào `SlideCanvas.jsx` canvas context menu

```jsx
// Trong canvas-context-menu:
{
  selectedElementIds.length >= 1 && (
    <>
      <div className="canvas-context-menu-separator" />
      <button onClick={() => bringToFront(selectedElementIds[0])}>⬆ Bring to Front</button>
      <button onClick={() => bringForward(selectedElementIds[0])}>↗ Bring Forward</button>
      <button onClick={() => sendBackward(selectedElementIds[0])}>↙ Send Backward</button>
      <button onClick={() => sendToBack(selectedElementIds[0])}>⬇ Send to Back</button>
      <div className="canvas-context-menu-separator" />
      <button onClick={() => groupSelected(selectedElementIds)}>Group</button>
      <button onClick={() => ungroupSelected(selectedElementIds)}>Ungroup</button>
    </>
  )
}
```

**Step 2:** Implement layer functions trong EditorPage/Store

```js
// bringToFront: tìm max zIndex → gán max+1
// sendToBack: tìm min zIndex → gán min-1
// bringForward: zIndex += 1
// sendBackward: zIndex -= 1
```

### Verification

```
✅ Right-click element → Bring to Front/Forward/Backward/Back options
✅ Group/Ungroup options in context menu
✅ Layer changes phản ánh ngay trên canvas
```

---

## P2-5: Animation Timeline — Show All Elements

### Implementation Steps

**Step 1:** Sửa render logic trong `AnimationTimeline.jsx`

```jsx
// Thay vì:
// const nonFragElements = (slide.elements || []).filter((el) => !el.fragment)
// Chỉ hiện 5

// Thành:
// Hiện ALL elements, nhưng:
// - Fragment elements: colored chip (như hiện tại)
// - Non-fragment elements: muted chip + "Add" button để enable fragment
```

**Step 2:** Thêm "Enable Fragment" quick action

```jsx
// Trên non-fragment element chip:
<div
  className="timeline-element-chip muted"
  onClick={() => onUpdateElement(el.id, { fragment: true, fragmentIndex: 1 })}
  title="Click to enable fragment animation"
>
  <span className="timeline-chip-label">{getElementLabel(el)}</span>
  <span style={{ fontSize: 9, opacity: 0.5 }}>+Fragment</span>
</div>
```

### Verification

```
✅ Animation Timeline hiện TẤT CẢ elements (không giới hạn 5)
✅ Non-fragment elements hiển thị muted với label
✅ Click non-fragment element → enable fragment ngay
```

---

## P2-6: Expand Animation Gallery (12 → 30+ types)

### PowerPoint Animation Mapping

| PowerPoint       | reveal.js equivalent     |
| ---------------- | ------------------------ |
| Fade In          | `fade-in`                |
| Float In         | `fade-up`                |
| Zoom In          | `zoom-in`                |
| Wipe Right       | `fade-right`             |
| Grow & Turn      | N/A → fallback `fade-in` |
| Expand           | `grow`                   |
| Appear           | `fade-in`                |
| Emphasis effects | `highlight-*` variants   |

### Implementation Steps

**Step 1:** Mở rộng `ANIMATION_TYPES` array

```js
const ANIMATION_TYPES = [
  // === ENTRANCE ===
  { value: 'fade-in', label: 'Fade In', category: 'entrance' },
  { value: 'fade-up', label: 'Fade Up', category: 'entrance' },
  { value: 'fade-down', label: 'Fade Down', category: 'entrance' },
  { value: 'fade-left', label: 'Fade Left', category: 'entrance' },
  { value: 'fade-right', label: 'Fade Right', category: 'entrance' },
  { value: 'zoom-in', label: 'Zoom In', category: 'entrance' },
  { value: 'grow', label: 'Grow', category: 'entrance' },
  { value: 'shrink', label: 'Shrink', category: 'entrance' },
  { value: 'slide-in-right', label: 'Slide Right', category: 'entrance' },
  { value: 'slide-in-left', label: 'Slide Left', category: 'entrance' },
  { value: 'fly-in', label: 'Fly In', category: 'entrance' },
  { value: 'bounce', label: 'Bounce', category: 'entrance' },
  { value: 'spin-in', label: 'Spin In', category: 'entrance' },
  // === EMPHASIS ===
  { value: 'highlight-red', label: 'Highlight Red', category: 'emphasis' },
  { value: 'highlight-green', label: 'Highlight Green', category: 'emphasis' },
  { value: 'highlight-blue', label: 'Highlight Blue', category: 'emphasis' },
  { value: 'pulse', label: 'Pulse', category: 'emphasis' },
  { value: 'teeter', label: 'Teeter', category: 'emphasis' },
  { value: 'spotlight', label: 'Spotlight', category: 'emphasis' },
  // === EXIT ===
  { value: 'fade-out', label: 'Fade Out', category: 'exit' },
  { value: 'shrink-out', label: 'Shrink Out', category: 'exit' },
  { value: 'fly-out', label: 'Fly Out', category: 'exit' },
]
```

**Step 2:** CSS transitions cho animation types mới

```css
/* Animations are CSS reveal.js - thêm custom classes nếu cần */
/* .reveal .fragment.fade-up { animation: fade-up 0.5s ease forwards; } */
```

### Verification

```
✅ Animation dropdown: hiện 25+ animation types
✅ Grouped by category (Entrance/Emphasis/Exit)
✅ Preview animation khi chọn type mới
```

---

## P2-7: Quick Access Toolbar (QAT)

### PowerPoint Reference

Top-left QAT: Save, Undo, Redo, Repeat + customizable commands.

### Implementation Steps

**Step 1:** Tạo `QuickAccessToolbar` component

```jsx
// client/src/components/QuickAccessToolbar.jsx
// Props: onSave, onUndo, onRedo, onRepeat, onPresent, extraCommands

// Default commands: Save, Undo, Redo, Present
// Optional: user-configurable commands in settings
```

**Step 2:** Tích hợp vào `EditorPage.jsx` layout

```jsx
// EditorPage.jsx - trên cùng:
<div className="editor-root">
  <QuickAccessToolbar onSave={handleSave} onUndo={handleUndo} ... />
  <EditorMenuBar ... />
  <div className="editor-body">
    ...
  </div>
</div>
```

**Step 3:** CSS

```css
.quick-access-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  height: 32px;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border);
}
```

### Verification

```
✅ QAT hiện trên cùng (trước Menu Bar)
✅ Save, Undo, Redo, Present buttons với icons
✅ Keyboard: Ctrl+S (Save), Ctrl+Z (Undo), Ctrl+Y (Redo) hoạt động
```

---

## P2-8: Find/Replace — Search in Markdown/LaTeX

### Implementation Steps

**Step 1:** Cập nhật `FindReplaceBar.jsx`

```jsx
// Thêm vào stripHtml + content search:
let text = ''
if (el.type === 'text') text = stripHtml(el.content)
else if (el.type === 'code') text = el.content || ''
else if (el.type === 'shape' && el.text) text = el.text
else if (el.type === 'markdown')
  text = el.content || '' // THÊM
else if (el.type === 'latex') text = el.content || '' // THÊM
```

### Verification

```
✅ Find bar: tìm thấy text trong Markdown elements
✅ Find bar: tìm thấy text trong LaTeX elements
✅ Navigate đến slide chứa match
```

---

## P2-9: Icon Picker — Expand to 200+ Icons

### Implementation Steps

**Step 1:** Thay hardcoded array bằng dynamic Lucide import

```jsx
// InsertMenu.jsx - thay:
const ICON_NAMES = [/* 60 hardcoded */]

// Thành:
// Dynamic import tất cả lucide-react icons
import * as LucideIcons from 'lucide-react'
const ICON_NAMES = Object.keys(LucideIcons)
  .filter(name => !name.startsWith('Icon') && name[0] === name[0].toUpperCase())
  .filter(name => !['createContext', 'useCallback', ...].includes(name))
```

**Step 2:** Thêm icon search với debounce

```jsx
// Debounce icon search input (300ms)
const [debouncedIconSearch, setDebouncedIconSearch] = useState('')
```

### Verification

```
✅ Icon picker: hiện 200+ icons
✅ Search: real-time filter khi gõ
✅ Icons được render đúng (Lucide SVG components)
```

---

## Phase 3 Todo Checklist

- [x] **P2-1 Duration:** Thêm duration/delay inputs vào AnimationTimeline
- [x] **P2-2 Align-PP:** Alignment section trong PropertiesPanel
- [x] **P2-2 Align-CM:** Bring to Front/Back trong canvas context menu
- [x] **P2-3 Settings:** Tách Settings menu thành 2 sections
- [x] **P2-4 Layer-CM:** Group/Ungroup trong context menu
- [x] **P2-5 Anim-Show:** Animation Timeline hiện all elements + Add Fragment
- [x] **P2-6 Anim-Gallery:** Mở rộng ANIMATION_TYPES lên 25+
- [x] **P2-7 QAT:** Tạo QuickAccessToolbar component
- [x] **P2-8 FindMd:** Find/Replace trong Markdown + LaTeX content
- [x] **P2-9 Icons:** Dynamic Lucide import thay hardcoded array

---

## Success Criteria (Phase 3)

1. ✅ Animation: duration (0.1-5s) + delay (0-10s) per fragment
2. ✅ Properties Panel: Alignment section visible khi multi-select
3. ✅ Context menu: Bring to Front/Back + Group/Ungroup
4. ✅ Settings menu: ≤2 sections, không scroll
5. ✅ Animation Timeline: all elements + "Add Fragment" button
6. ✅ Animation Gallery: 25+ animation types grouped by category
7. ✅ QAT: Save/Undo/Redo/Present ở top-left
8. ✅ Find: tìm trong Markdown + LaTeX elements
9. ✅ Icon picker: 200+ icons + real-time search
