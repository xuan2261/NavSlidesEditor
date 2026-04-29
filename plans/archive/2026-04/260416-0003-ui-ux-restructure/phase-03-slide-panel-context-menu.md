# Phase 03 — Slide Panel Context Menu

## Priority: 🟡 MEDIUM

## Status: ⬜ Not started

## Effort: Small (~1.5h)

## Impact: ⭐⭐⭐

## Overview

Simplify slide thumbnail actions: hiện tại mỗi slide có **7 action buttons** luôn hiện khi hover (Lock, AutoAnimate, Duplicate, Move up, Move down, Delete, Add vertical). Chuyển thành show-on-hover 2 nút chính + right-click context menu cho phần còn lại.

## Key Insights

- SlidePanel.jsx (498 lines) — `.slide-actions` hiện chứa 7 buttons (L375-452)
- CSS `.slide-actions` đã dùng `opacity: 0` → show on hover (tốt)
- Drag-and-drop reorder đã được implement (L52-71) → Move up/Move down buttons **thừa**
- Button size 10px icons + 3px padding = ~16px touch target → quá nhỏ

## Architecture

### Layout mới cho slide-actions:

```
┌─────────────────────┐
│ [1] ─── Slide ───── │  ← hover shows: [📋 Duplicate] [🗑 Delete]
│     Thumbnail        │  ← right-click shows context menu
│                      │
└─────────────────────┘

Context menu:
┌─────────────────────┐
│ Duplicate        ⌘D │
│ Delete               │
│ ─────────────────── │
│ ✓ Lock slide         │
│ ✓ Auto-animate       │
│ ─────────────────── │
│ Add vertical slide   │
│ ─────────────────── │
│ Move up              │
│ Move down            │
└─────────────────────┘
```

---

## Related Code Files

### Files to modify:

- `client/src/components/SlidePanel.jsx` — Refactor slide actions
- `client/src/index.css` — Add context menu styles (reuse `.canvas-context-menu` pattern)

---

## Implementation Steps

### Step 1: Add right-click handler

```jsx
const [contextMenu, setContextMenu] = useState(null) // { index, x, y }

// On each slide-item:
onContextMenu={(e) => {
  e.preventDefault()
  e.stopPropagation()
  setContextMenu({ index, x: e.clientX, y: e.clientY })
}}
```

### Step 2: Reduce hover actions to 2 buttons

Giữ chỉ hover buttons:

- **Duplicate** (Copy icon, size 11)
- **Delete** (Trash2 icon, size 11, color danger)

Tăng button padding: `padding: 4px` → touch target ~22px

### Step 3: Create context menu overlay

```jsx
{
  contextMenu && (
    <div className="slide-context-overlay" onClick={() => setContextMenu(null)}>
      <div className="slide-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
        <button
          onClick={() => {
            onDuplicate(contextMenu.index)
            setContextMenu(null)
          }}
        >
          <Copy size={14} /> Duplicate
        </button>
        <button
          onClick={() => {
            onDelete(contextMenu.index)
            setContextMenu(null)
          }}
          style={{ color: 'var(--danger)' }}
        >
          <Trash2 size={14} /> Delete
        </button>
        <div className="context-separator" />
        <button
          onClick={() => {
            onToggleLock?.(contextMenu.index)
            setContextMenu(null)
          }}
        >
          {slides[contextMenu.index]?.locked ? <Lock size={14} /> : <Unlock size={14} />}
          {slides[contextMenu.index]?.locked ? 'Unlock slide' : 'Lock slide'}
        </button>
        <button
          onClick={() => {
            onToggleAutoAnimate?.(contextMenu.index)
            setContextMenu(null)
          }}
        >
          <Sparkles size={14} />
          {slides[contextMenu.index]?.autoAnimate ? 'Disable auto-animate' : 'Enable auto-animate'}
        </button>
        <div className="context-separator" />
        {onAddVerticalSlide && (
          <button
            onClick={() => {
              onAddVerticalSlide(contextMenu.index)
              setContextMenu(null)
            }}
          >
            <ArrowDownRight size={14} /> Add vertical slide
          </button>
        )}
      </div>
    </div>
  )
}
```

### Step 4: Reuse context menu CSS pattern

```css
/* Reuse existing canvas-context-menu pattern */
.slide-context-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
}
.slide-context-menu {
  position: fixed;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 4px;
  min-width: 180px;
  box-shadow: var(--shadow-lg);
  z-index: 10001;
}
/* Reuse .canvas-context-menu button styles */
```

---

## Todo List

- [ ] Add `contextMenu` state to SlidePanel
- [ ] Add `onContextMenu` handler per slide
- [ ] Reduce hover buttons: keep only Duplicate + Delete
- [ ] Increase hover button size (padding 4px)
- [ ] Create context menu with all actions
- [ ] Add close-on-click-outside
- [ ] Remove Move up/Move down buttons entirely
- [ ] Add CSS for context menu (reuse pattern)
- [ ] Test: right-click shows menu, click outside closes

## Success Criteria

1. Hover chỉ hiện 2 buttons (Duplicate, Delete) → cleaner look
2. Right-click cho full menu (Lock, AutoAnimate, Vertical, etc.)
3. Drag-and-drop reorder vẫn hoạt động
4. Touch target >= 22px
