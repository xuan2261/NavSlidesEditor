# Phase 02 — Toolbar Insert Dropdown (HIGH)

## Priority: 🟠 HIGH

## Status: ⬜ Not started

## Effort: Medium (~2.5h)

## Impact: ⭐⭐⭐⭐

## Overview

Gom 16 nút insert element trong Toolbar thành **1 dropdown "Insert"** với categories, giữ canvas tools inline. Giảm toolbar từ 22 nút inline → 5 nút.

## Key Insights

- Toolbar hiện tại (Toolbar.jsx, 1764 lines) chứa 2 modes:
  1. **Element insertion tools** (line 204-700): Text, Image, Upload, Embed, Code, TeX, Markdown, Chart, Callout, Icon, Video, Audio, Table, Draw, Arrow/Line, SVG
  2. **Canvas tools** (line 1057-1105): BG, Grid toggle + size, Smart guides, Ruler
  3. **Text editing tools** (line 1160-1760): chỉ hiện khi `editor` active
- Alignment + Group tools (line 1107-1149): chỉ hiện khi `selectedCount >= 2`
- Mỗi element button dùng inline styles + emoji icons cho một số loại

## Architecture

### Toolbar Layout Mới

```
┌──────────────────────────────────────────────────────────────────┐
│ [+ Insert ▾] │ 🔲 BG │ ▦ Grid [40] │ 🧲 Snap │ 📏 Ruler │ hint │
│                                                                  │
│ (when selectedCount >= 2: Align tools | Group/Ungroup)          │
│ (when editor active: text editing toolbar - KEEP AS-IS)          │
└──────────────────────────────────────────────────────────────────┘
```

### Insert Dropdown Categories

```
┌─────────────────────────┐
│ 📝 BASIC               │
│   Text                  │
│   Image                 │
│   Upload Image          │
│ ─────────────────────── │
│ 📊 CONTENT              │
│   Embed HTML            │
│   Code Block            │
│   LaTeX / TikZ          │
│   Markdown              │
│   Chart                 │
│ ─────────────────────── │
│ 🎬 MEDIA                │
│   Video                 │
│   Audio                 │
│   Media Library         │
│ ─────────────────────── │
│ ◇ SHAPES & LINES       │
│   Shape                 │  → sub-dropdown với shape picker
│   Line / Arrow          │
│   SVG                   │
│   Icon                  │
│   Callout               │
│ ─────────────────────── │
│ 📐 LAYOUT              │
│   Table (rows × cols)   │
│   Drawing Canvas        │
└─────────────────────────┘
```

---

## Related Code Files

### Files to create:

- `client/src/components/InsertMenu.jsx` — Insert dropdown với categories + sub-pickers

### Files to modify:

- `client/src/components/Toolbar.jsx` — Extract element buttons → InsertMenu
- `client/src/index.css` — Add insert menu styles

---

## Implementation Steps

### Step 1: Create InsertMenu.jsx

```jsx
// Props needed (all callbacks from current Toolbar props):
<InsertMenu
  onAddText={onAddText}
  onAddImage={onAddImage} // triggers file picker
  onAddImageElement={addImageElement}
  onAddHtmlElement={onAddHtmlElement}
  onAddCodeElement={onAddCodeElement}
  onAddLatexElement={onAddLatexElement}
  onAddMarkdownElement={onAddMarkdownElement}
  onAddChart={onAddChart}
  onAddVideo={handleAddVideo} // currently uses window.prompt
  onAddAudio={handleAddAudio}
  onOpenMediaLibrary={onOpenMediaLibrary}
  onAddShape={onAddShape} // shape picker sub-menu
  onAddLine={onAddLine}
  onAddSvgElement={onAddSvgElement}
  onAddIcon={handleAddIcon} // icon picker sub-menu
  onAddCallout={onAddCallout}
  onAddTable={handleAddTable} // currently uses window.prompt
  onAddDrawing={onAddDrawing}
/>
```

**Thiết kế component:**

- Sử dụng `DropdownMenu` từ Phase 01 (nếu đã tạo), hoặc tạo standalone
- Category headers: uppercase, `text-muted`, font-size 10px
- Items: icon + label, full-width clickable
- Shape item: mở sub-panel bên phải (shape picker grid hiện tại)
- Icon item: mở sub-panel bên phải (icon picker hiện tại)
- Close dropdown sau khi click item (trừ shape/icon picker)

### Step 2: Refactor Toolbar.jsx

**Xóa khỏi inline rendering (move to InsertMenu):**

- Lines 204-420: Tất cả element insertion buttons (Text, Image, Upload, ...)
- Lines 422-700: Shape menus, Icon menus, Video/Audio handlers, table/chart buttons
- Lines 700-800: BG menu GIỮ NGUYÊN inline

**Giữ nguyên inline:**

- BG button + popup (line 755-1055): vẫn là canvas tool
- Grid toggle + size input (line 1057-1087)
- Smart guides toggle (line 1089-1096)
- Ruler toggle (line 1098-1105)
- Alignment tools when multi-select (line 1107-1149)
- Text editing toolbar when editor active (line 1160-1760)
- Hint text "Double-click a text box to edit" (line 1153-1158)

**Toolbar structure mới:**

```jsx
<div className="toolbar">
  {/* Insert dropdown - luôn hiện */}
  <InsertMenu {...insertProps} />

  <span className="toolbar-divider" />

  {/* Canvas tools - luôn hiện */}
  {/* BG button + popup */}
  {/* Grid toggle */}
  {/* Smart guides */}
  {/* Ruler */}

  {/* Multi-select alignment - conditional */}
  {selectedCount >= 2 && (
    <>
      <span className="toolbar-divider" />
      {/* Align + Group/Ungroup tools */}
    </>
  )}

  <span className="toolbar-divider" />

  {/* Hint or Text editing toolbar */}
  {!editingElementId && <span>Double-click...</span>}
  {editor && <>{/* ALL text editing tools - UNCHANGED */}</>}
</div>
```

### Step 3: Add CSS

```css
.insert-menu {
  position: relative;
}

.insert-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  background: var(--color-primary-light);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.insert-trigger:hover {
  background: var(--accent);
  color: white;
}

.insert-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 240px;
  max-height: 480px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.insert-category {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 12px 4px;
}

.insert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  transition: background var(--transition-fast);
}
.insert-item:hover {
  background: var(--bg-hover);
}
.insert-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}
```

---

## Todo List

- [ ] Create `InsertMenu.jsx`
  - [ ] Dropdown trigger button "+ Insert"
  - [ ] 5 categories: Basic, Content, Media, Shapes & Lines, Layout
  - [ ] Shape picker sub-panel (reuse existing grid)
  - [ ] Icon picker sub-panel (reuse existing)
  - [ ] Close on click outside
- [ ] Refactor `Toolbar.jsx`
  - [ ] Extract element insertion → InsertMenu
  - [ ] Keep canvas tools inline
  - [ ] Keep text editing toolbar unchanged
  - [ ] Keep alignment tools unchanged
- [ ] Add CSS for insert menu
- [ ] Test all element insertion via dropdown
- [ ] Verify shape/icon picker still works

## Success Criteria

1. Toolbar hàng 1 giảm xuống <10 items (Insert + 4 canvas tools)
2. Tất cả 16 loại element vẫn insertable
3. Shape picker, icon picker vẫn hoạt động
4. Text editing toolbar không thay đổi
5. Alignment tools khi multi-select không thay đổi
