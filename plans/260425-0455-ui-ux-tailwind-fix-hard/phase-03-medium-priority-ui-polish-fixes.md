# Phase 3 — Medium Priority Fixes

## Overview

Fix 8 medium-priority polish issues: ghost button active state (M-01), search clear button (M-03), undo/redo via editor API (M-04), color swatch border logic (M-05), date format i18n (M-06), delete disabled state visual (M-07), modal z-index CSS var (M-08).

---

## [M-01] Ghost Variant Active State — Uses !important Pattern

**File:** `client/src/components/ui/Button.jsx:14-15`
**Citation:** `Button.jsx:15` — ghost variant lacks explicit active state

### Problem

Ghost buttons có `hover:bg-hover hover:text-text-primary` nhưng không có explicit `active:` state. Base classes có `active:scale-[0.97]` nhưng không có `active:bg-active` cho ghost.

### Fix

Thêm `active:bg-active active:text-text-primary active:border-border-active` vào ghost variant definition:

```js
// TRƯỚC (Button.jsx:14-15):
ghost: 'border border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary'

// SAU:
ghost: 'border border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary active:bg-active active:text-text-primary'
```

### Implementation Steps

1. Edit `Button.jsx:15`: add `active:bg-active active:text-text-primary` to ghost variant
2. Verify `tailwind.config.js` maps `bg-active` → `var(--bg-active)` (CSS var đã có ở `index.css:63`)

---

## [M-03] Search Input — No Clear Button

**File:** `client/src/pages/HomePage.jsx:630-641`
**Citation:** `HomePage.jsx:630-641` — Input without X button

### Problem

Search input không có nút clear. User phải select all + delete để clear.

### Fix

Thêm X button inside input when `searchQuery` is non-empty:

```jsx
// TRƯỚC (HomePage.jsx:635-641):
<Input className="w-full pl-9" type="text" placeholder="Search presentations..."
  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

// SAU — wrap in relative div, add clear button:
<div className="relative w-full max-w-md">
  <Search size={15} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
  <Input className="w-full pl-9 pr-8" type="text" placeholder="Search presentations..."
    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
  {searchQuery && (
    <button
      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
      onClick={() => setSearchQuery('')}
      aria-label="Clear search"
    >
      <X size={14} />
    </button>
  )}
</div>
```

Also check marketplace search at ~line 1073-1083 for same fix.

### Implementation Steps

1. Edit `HomePage.jsx:630-641`: wrap Input in relative div, add clear button with `X` icon
2. Verify `X` imported from lucide-react in HomePage.jsx
3. Find marketplace search (~line 1073) and apply same pattern

---

## [M-04] Undo/Redo — dispatchEvent Hack

**File:** `client/src/components/QuickAccessToolbar.jsx:21-27`
**Citation:** `QuickAccessToolbar.jsx:21-27` — `dispatchEvent(new KeyboardEvent(...))`

### Problem

`dispatchEvent` keyboard event là hack fragile. Props `onUndo`/`onRedo` được declare nhưng never wired.

### Analysis

- `QuickAccessToolbar.jsx:8-11` — `onUndo`/`onRedo` props declared with eslint-disable
- `QuickAccessToolbar.jsx:21-27` — thay vì gọi props, dispatch keyboard event
- `editor-store.js:754-773` — có `handleUndo`/`handleRedo` functions
- `EditorPage.jsx` — gọi `handleUndo`/`handleRedo` từ store khi keyboard event xảy ra

### Fix

Wire `onUndo`/`onRedo` props directly:

```jsx
// TRƯỚC:
const handleUndo = useCallback(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
}, [])

// SAU:
const handleUndo = useCallback(() => {
  onUndo?.()
}, [onUndo])

const handleRedo = useCallback(() => {
  onRedo?.()
}, [onRedo])
```

Then in `EditorPage.jsx`, pass `handleUndo`/`handleRedo` from editor store to `<QuickAccessToolbar onUndo={handleUndo} onRedo={handleRedo} />`.

### Implementation Steps

1. Edit `QuickAccessToolbar.jsx:21-27`: replace dispatchEvent with `onUndo?.()` / `onRedo?.()`
2. Find where `QuickAccessToolbar` is used in `EditorPage.jsx` and add `onUndo={handleUndo} onRedo={handleRedo}` props
3. Verify `handleUndo`/`handleRedo` are accessible from editor-store (they are — called via `useCallback` in EditorPage)

---

## [M-05] Color Swatch Border Logic — Fragile Hardcoded Check

**File:** `client/src/components/Toolbar.jsx:430-436`
**Citation:** `Toolbar.jsx:430-436` — `color === '#ffffff' || color === '#f8f9fa'`

### Problem

Light color border check hardcoded: `color === '#ffffff' || color === '#f8f9fa'`. Logic dễ sai khi thêm màu mới.

### Fix

Dùng `isLightColor()` helper từ `shared/src/colorConfig.js` (đã tạo ở Phase 1 — C-04):

```jsx
// TRƯỚC (Toolbar.jsx:430-436):
className={`... ${
  bg.color === color
    ? 'border-2 border-white'
    : color === '#ffffff' || color === '#f8f9fa'
        ? 'border border-border'
        : 'border border-transparent'
}`}

// SAU:
className={`... ${
  bg.color === color
    ? 'border-2 border-white'
    : isLightColor(color)
        ? 'border border-border'
        : 'border border-transparent'
}`}
```

### Implementation Steps

1. Edit `Toolbar.jsx` top: add `import { isLightColor } from 'revealjs-shared'` (same module as Phase 1)
2. Edit `Toolbar.jsx:433-434`: replace `color === '#ffffff' || color === '#f8f9fa'` → `isLightColor(color)`

---

## [M-06] Date Format — Hardcoded en-US Locale

**File:** `client/src/pages/HomePage.jsx:163-167`
**Citation:** `HomePage.jsx:166` — `toLocaleDateString('en-US', ...)`

### Problem

Hardcoded `en-US`. User Việt Nam muốn `25/04/2026` format.

### Fix

Dùng `navigator.language` để lấy browser locale:

```js
// TRƯỚC:
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// SAU:
return date.toLocaleDateString(navigator.language, { month: 'short', day: 'numeric', year: 'numeric' })
```

### Implementation Steps

1. Edit `HomePage.jsx:166`: replace `'en-US'` with `navigator.language`

---

## [M-07] Delete Button — No Visual Disabled State

**File:** `client/src/components/SlidePanel.jsx:373`
**Citation:** `SlidePanel.jsx:373` — `slides.length > 1 ? 'text-white' : 'text-white/30'`

### Problem

Khi chỉ còn 1 slide, delete button có `text-white/30` nhưng không có `disabled` attribute. Visual disabled state hoàn toàn thiếu.

### Fix

Thêm `disabled={slides.length <= 1}` attribute và `cursor-not-allowed opacity-50` classes:

```jsx
// TRƯỚC (SlidePanel.jsx:372-381):
<button
  className={`bg-black/60 border-none p-1 rounded-[3px] cursor-pointer ... ${slides.length > 1 ? 'text-white' : 'text-white/30'}`}
  title="Delete"
  onClick={(e) => { e.stopPropagation(); if (slides.length > 1) onDelete(index) }}
>

// SAU:
<button
  className={`bg-black/60 border-none p-1 rounded-[3px] flex items-center justify-center ${slides.length > 1 ? 'text-white hover:bg-accent/80 cursor-pointer' : 'text-white/30 cursor-not-allowed opacity-50'}`}
  title={slides.length <= 1 ? 'Cannot delete last slide' : 'Delete'}
  disabled={slides.length <= 1}
  onClick={(e) => { e.stopPropagation(); if (slides.length > 1) onDelete(index) }}
>
```

### Implementation Steps

1. Edit `SlidePanel.jsx:373`: add `disabled={slides.length <= 1}`, update class for disabled state, update title
2. Keep JS logic check `if (slides.length > 1)` inside onClick as safeguard

---

## [M-08] Modal z-index — Hardcoded 10000

**File:** `client/src/pages/HomePage.jsx:1382-1383, 1526-1527`
**Citation:** `HomePage.jsx:1383` — `z-[10000]`

### Problem

z-index 10000 hardcoded trong 2 modal instances. Future modal layers (tour tooltip, etc.) sẽ conflict.

### Fix

Thêm CSS variable `--z-modal` vào `index.css` và dùng `z-[var(--z-modal)]`:

```css
/* index.css — thêm vào :root */
:root {
  /* ... existing tokens ... */
  --z-modal: 10000;
  --z-modal-overlay: 9999;
}
```

```jsx
// TRƯỚC (HomePage.jsx:1383, 1527):
className="... z-[10000]"

// SAU:
className="... z-[var(--z-modal)]"
```

### Implementation Steps

1. Edit `index.css` `:root` block: add `--z-modal: 10000` và `--z-modal-overlay: 9999`
2. Edit `HomePage.jsx:1383`: thay `z-[10000]` → `z-[var(--z-modal)]`
3. Edit `HomePage.jsx:1526-1527`: thay overlay `z-[10000]` → `z-[var(--z-modal-overlay)]`

---

## Related Code Files

| File | Changes |
|------|---------|
| `client/src/components/ui/Button.jsx` | M-01 (ghost active state) |
| `client/src/pages/HomePage.jsx` | M-03 (search clear), M-06 (date format), M-08 (z-index) |
| `client/src/components/QuickAccessToolbar.jsx` | M-04 (undo/redo props) |
| `client/src/components/Toolbar.jsx` | M-05 (isLightColor helper) |
| `client/src/components/SlidePanel.jsx` | M-07 (disabled state) |
| `client/src/index.css` | M-08 (z-index CSS var) |

## Success Criteria

- [ ] M-01: Ghost buttons show `bg-active` on active/pressed
- [ ] M-03: Search input shows X button when query non-empty
- [ ] M-04: QuickAccessToolbar calls `onUndo`/`onRedo` props directly
- [ ] M-05: `isLightColor()` used for swatch border logic
- [ ] M-06: `formatDate` respects browser locale via `navigator.language`
- [ ] M-07: Delete button has `disabled` attribute + visual disabled state
- [ ] M-08: `z-[var(--z-modal)]` used in both modal instances

## Risk Assessment

| Issue | Risk | Mitigation |
|-------|------|------------|
| M-01 | Low — CSS class only | Verify bg-active CSS var exists |
| M-03 | Low — new DOM element | Verify X icon imported |
| M-04 | Medium — prop wiring | Verify handleUndo/handleRedo accessible from EditorPage |
| M-05 | Low — refactor to helper | isLightColor helper already exists from Phase 1 |
| M-06 | Low — browser API | `navigator.language` universally supported |
| M-07 | Low — disabled attr only | Ensure JS check still prevents deletion |
| M-08 | Low — CSS var mapping | Verify Tailwind supports `var(--z-modal)` in z-[] |
