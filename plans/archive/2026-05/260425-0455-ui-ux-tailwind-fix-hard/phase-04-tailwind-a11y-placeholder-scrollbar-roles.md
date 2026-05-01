# Phase 4 — Tailwind & Accessibility Fixes

## Overview

Fix 2 Tailwind design system issues (T-01, T-04) và 2 accessibility issues (A-02, A-03).

---

## [T-01] Input Placeholder — Missing Color

**File:** `client/src/components/ui/Input.jsx:9`
**Citation:** `Input.jsx:9` — base Input class string

### Problem

`placeholder:text-text-muted` không có trong Input base class. Browser placeholder color mặc định (thường là gray) không match design system.

### Fix

Add `placeholder:text-text-muted` vào Input base class:

```jsx
// TRƯỚC (Input.jsx:9):
'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] transition-colors duration-150 ease-out focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed'

// SAU:
'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] transition-colors duration-150 ease-out focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-text-muted'
```

### Implementation Steps

1. Edit `Input.jsx:9`: append `placeholder:text-text-muted`

---

## [T-04] Scrollbar — No Light Theme Override

**File:** `client/src/index.css:189-203`
**Citation:** `index.css:197-202` — scrollbar thumb using `var(--border-strong)`

### Problem

Custom scrollbar thumb color dùng `var(--border-strong)`. Trong light theme, giá trị này là `rgba(0,0,0,0.16)` — có thể quá tối trên nền sáng.

### Fix

Thêm `[data-theme='light']` override block:

```css
/* TRƯỚC (index.css:189-203): */
::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* SAU — thêm light theme override sau block hiện tại: */
[data-theme='light'] ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}
[data-theme='light'] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
```

### Implementation Steps

1. Edit `index.css:189-203`: thêm `[data-theme='light']` override block sau scrollbar rules

---

## [A-02] Color Palette Popup — No ARIA Role

**File:** `client/src/components/Toolbar.jsx:873-919`
**Citation:** `Toolbar.jsx:874-876` — popup div không có role

### Problem

Color palette popup không có `role="listbox"` hoặc `aria-label`. Screen reader user không biết đây là color picker.

### Fix

Thêm ARIA attributes:

```jsx
// TRƯỚC (Toolbar.jsx:874-876):
<div
  onMouseDown={(e) => e.stopPropagation()}
  className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-lg p-2 shadow-xl grid grid-cols-[repeat(8,22px)] gap-[3px]"
>

// SAU:
<div
  role="listbox"
  aria-label="Text color palette"
  onMouseDown={(e) => e.stopPropagation()}
  className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-[1000] bg-card border border-border rounded-lg p-2 shadow-xl grid grid-cols-[repeat(8,22px)] gap-[3px]"
>
```

Và mỗi color swatch button:

```jsx
// TRƯỚC (Toolbar.jsx:879-893):
<Button variant="ghost" key={color} title={color} ...>

// SAU:
<Button
  variant="ghost"
  key={color}
  title={color}
  role="option"
  aria-selected={currentColor.toLowerCase() === color.toLowerCase()}
  aria-label={`Color ${color}`}
  ...
/>
```

Toggle button (line 857-865) cần thêm `aria-expanded` và `aria-haspopup="true"`.

### Implementation Steps

1. Edit `Toolbar.jsx:874`: thêm `role="listbox" aria-label="Text color palette"`
2. Edit `Toolbar.jsx:857`: thêm `aria-expanded={showColorPalette} aria-haspopup="listbox"`
3. Edit `Toolbar.jsx:879-893`: thêm `role="option" aria-selected={...} aria-label={...}` trên mỗi swatch Button

---

## [A-03] Context Menu — No Keyboard Navigation

**File:** `client/src/components/SlidePanel.jsx:474-551`
**Citation:** `SlidePanel.jsx:478-482` — context menu div không có role/menu semantics

### Problem

Context menu không hỗ trợ keyboard navigation (↑↓ arrows, Enter, Escape). Không có `role="menu"` hoặc `role="menuitem"`.

### Fix

Thêm ARIA roles và keyboard navigation:

```jsx
// TRƯỚC (SlidePanel.jsx:478-479):
<div className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
  style={getContextMenuStyle(ctxMenu)}
  onMouseDown={(e) => e.stopPropagation()}
>

// SAU:
<div
  role="menu"
  aria-label="Slide actions"
  className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
  style={getContextMenuStyle(ctxMenu)}
  onMouseDown={(e) => e.stopPropagation()}
>
```

Mỗi button menu item:

```jsx
// TRƯỚC (SlidePanel.jsx:483-490):
<button onClick={() => { ... }}>
  <Copy size={14} /> Duplicate
</button>

// SAU:
<button
  role="menuitem"
  tabIndex={0}
  onClick={() => { ... }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); /* same action */ }
  }}
>
```

Keyboard navigation (↑↓) — thêm `useEffect` hoặc `onKeyDown` trên container:

```jsx
<div
  role="menu"
  onKeyDown={(e) => {
    const items = Array.from(el.querySelectorAll('[role="menuitem"]'))
    const current = document.activeElement
    const idx = items.indexOf(current)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(idx + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Escape') {
      setCtxMenu(null)
    }
  }}
>
```

### Implementation Steps

1. Edit `SlidePanel.jsx:478-479`: thêm `role="menu" aria-label="Slide actions"` trên container
2. Edit each menu button (lines 483-548): thêm `role="menuitem" tabIndex={0}` và `onKeyDown` handler
3. Add `onKeyDown` handler on container div for ArrowUp/ArrowDown/Escape navigation
4. Add `disabled` buttons: set `tabIndex={-1}` for disabled items

---

## Related Code Files

| File | Changes |
|------|---------|
| `client/src/components/ui/Input.jsx` | T-01 (placeholder color) |
| `client/src/index.css` | T-04 (scrollbar light theme) |
| `client/src/components/Toolbar.jsx` | A-02 (color palette ARIA) |
| `client/src/components/SlidePanel.jsx` | A-03 (context menu keyboard nav) |

## Success Criteria

- [ ] T-01: Input placeholder color matches `text-text-muted`
- [ ] T-04: Light theme scrollbar thumb uses `rgba(0,0,0,0.15)`
- [ ] A-02: Color palette popup has `role="listbox"`, toggle has `aria-expanded`, swatches have `role="option"`
- [ ] A-03: Context menu has `role="menu"`, items have `role="menuitem"`, keyboard nav (↑↓ Esc) works

## Risk Assessment

| Issue | Risk | Mitigation |
|-------|------|------------|
| T-01 | Low — CSS class addition | Safe, well-supported |
| T-04 | Low — CSS override | Light theme scrollbar value is conservative |
| A-02 | Low — ARIA attributes | No functional change, only semantics |
| A-03 | Medium — keyboard nav logic | Test with keyboard-only navigation |
