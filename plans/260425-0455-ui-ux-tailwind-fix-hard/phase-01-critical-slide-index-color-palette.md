# Phase 1 — Critical Fixes

## Overview

Fix 2 critical issues: slide index badge invisible on light backgrounds (C-02), và centralize hardcoded color palette arrays into shared theme config (C-04).

---

## [C-02] Slide Index Badge — Invisible on Light Backgrounds

**File:** `client/src/components/SlidePanel.jsx:207-213`
**Citation:** `SlidePanel.jsx:208` — `text-white/50 bg-black/40`

### Problem

`text-white/50` + `bg-black/40` — trên slide background trắng hoặc gradient sáng, text số thứ tự gần như invisible.

### Fix

Thay `text-white/50 bg-black/40` bằng design system classes:
- `text-text-muted` (CSS var, readable in both themes)
- `bg-surface-2/80` (semi-transparent surface, respects theme)

```jsx
// TRƯỚC (SlidePanel.jsx:208):
className={`absolute top-1 left-1 text-[10px] text-white/50 bg-black/40 ...`}

// SAU:
className={`absolute top-1 left-1 text-[10px] text-text-muted bg-surface-2/80 ...`}
```

**Note:** Cùng pattern cần apply cho vertical children badge tại line 397 (`text-indigo-400 bg-black/40`).

### Implementation Steps

1. Edit `SlidePanel.jsx:208`: thay `text-white/50 bg-black/40` → `text-text-muted bg-surface-2/80`
2. Edit `SlidePanel.jsx:397`: thay `text-indigo-400 bg-black/40` → `text-text-muted bg-surface-2/80`

---

## [C-04] Color Palette — Move to Shared Theme Config

**Files:** `client/src/components/Toolbar.jsx:52-117`
**Citation:** `Toolbar.jsx:52-117` — `COLOR_PALETTE`, `COLOR_SWATCHES_BG`, `GRADIENT_PRESETS_BG`

### Problem

3 color arrays hardcoded trong `Toolbar.jsx`:
- `COLOR_PALETTE` (36 hex colors) — text/bg color picker
- `COLOR_SWATCHES_BG` (12 bg swatches)
- `GRADIENT_PRESETS_BG` (6 gradient strings)

Không theo theme system, không reusable.

### Architecture

Create `shared/src/colorConfig.js` — pure JS module export các color arrays.
Import vào `Toolbar.jsx` thay vì inline.

### Implementation Steps

1. **Create** `shared/src/colorConfig.js`:
   - Export `TEXT_COLORS` (rename từ COLOR_PALETTE, 36 colors)
   - Export `BG_COLORS` (rename từ COLOR_SWATCHES_BG, 12 colors)
   - Export `GRADIENT_PRESETS` (rename từ GRADIENT_PRESETS_BG, 6 gradients)
   - Export `isLightColor(hex)` — returns true cho light backgrounds (dùng cho M-05 border logic)

2. **Edit** `Toolbar.jsx:52-117`:
   - Thay inline arrays bằng: `import { TEXT_COLORS, BG_COLORS, GRADIENT_PRESETS } from 'revealjs-shared'`
   - Update references: `COLOR_PALETTE` → `TEXT_COLORS`, `COLOR_SWATCHES_BG` → `BG_COLORS`, `GRADIENT_PRESETS_BG` → `GRADIENT_PRESETS`
   - Update `getBackgroundStyle` inline at `Toolbar.jsx:448` — sử dụng `GRADIENT_PRESETS` (hiện đang inline ở JSX)

3. **Verify** `shared/package.json` có `"main": "src/index.js"` hoặc `"exports"` để `Toolbar.jsx` (bundled qua Vite) có thể import được.

### Files to Create

| File | Purpose |
|------|---------|
| `shared/src/colorConfig.js` | Shared color constants + helpers |

### Files to Modify

| File | Change |
|------|--------|
| `shared/src/index.js` | Export colorConfig |
| `client/src/components/Toolbar.jsx` | Replace inline arrays with imports |

### Success Criteria

- [ ] `SlidePanel.jsx` line 208: `text-text-muted bg-surface-2/80`
- [ ] `SlidePanel.jsx` line 397: `text-text-muted bg-surface-2/80`
- [ ] `shared/src/colorConfig.js` created with all 3 arrays + `isLightColor()`
- [ ] `Toolbar.jsx` imports from `revealjs-shared` instead of inline arrays
- [ ] No `COLOR_PALETTE` / `COLOR_SWATCHES_BG` / `GRADIENT_PRESETS_BG` strings remain in `Toolbar.jsx`

### Risk Assessment

- **Low risk** — pure data refactor, no logic changes
- **Verify:** ensure Vite resolve alias for `revealjs-shared` points to `shared/src/`

---

## Related Code Files

| Action | File |
|--------|------|
| Create | `shared/src/colorConfig.js` |
| Modify | `shared/src/index.js` |
| Modify | `client/src/components/SlidePanel.jsx` |
| Modify | `client/src/components/Toolbar.jsx` |
