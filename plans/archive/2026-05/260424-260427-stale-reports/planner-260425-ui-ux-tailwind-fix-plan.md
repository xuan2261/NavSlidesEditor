# Planner Report: UI/UX Tailwind Fix — Hard Mode Remediation

**Date:** 2026-04-25
**Sources:** `agent-code-review-260425-ui-ux-tailwind-audit.md`, `researcher-a-260425-ui-ux-issues.md`, `researcher-b-260425-ui-ux-issues.md`

---

## Plan Summary

17 issues across 5 phases. All fixes self-contained (no cross-file dependencies ngoài C-04 + M-05 cùng share `Toolbar.jsx`).

| Priority | Count | Key Fix |
|----------|-------|---------|
| Critical | 2 | C-02 (slide index visibility), C-04 (color palette theme) |
| High | 5 | H-01 (sidebar layout), H-02 (vertical scale), H-03 (BG popup overflow), H-04 (list view onClick), H-05 (emoji) |
| Medium | 8 | M-01..M-08 (ghost state, search clear, undo/redo, swatch border, date i18n, delete disabled, modal z-index) |
| Tailwind/A11y | 4 | T-01, T-04, A-02, A-03 |
| **Total** | **19** | |

---

## Key Architectural Decisions

### 1. `shared/src/colorConfig.js` — Central Color Config (C-04 + M-05)

C-04 và M-05 cùng depend trên việc centralize color constants. Tạo `shared/src/colorConfig.js` export:
- `TEXT_COLORS` (36 colors)
- `BG_COLORS` (12 bg swatches)
- `GRADIENT_PRESETS` (6 gradients)
- `isLightColor(hex)` helper

This becomes the single source of truth for all color arrays. `Toolbar.jsx` imports thay vì inline.

**Citation:** `Toolbar.jsx:52-117` (inline arrays), `HomePage.jsx:161` (LIGHT_PRESET_COLORS Set — already partial deduplication)

### 2. Undo/Redo via Props (M-04)

`QuickAccessToolbar.jsx` hiện dispatch fake keyboard events. Props `onUndo`/`onRedo` đã declared nhưng unused. Fix: wire props directly.

**Citation:** `QuickAccessToolbar.jsx:21-27` (dispatchEvent hack), `editor-store.js:754-773` (handleUndo/handleRedo), `EditorPage.jsx` (calls store functions on keydown)

### 3. Context Menu Keyboard Nav (A-03)

`SlidePanel.jsx:474-551` context menu hiện có `Escape` listener nhưng không có ArrowUp/ArrowDown navigation. Thêm `role="menu"`, `role="menuitem"`, và container `onKeyDown` handler.

**Citation:** `SlidePanel.jsx:474-551` (menu markup), `SlidePanel.jsx:42-46` (Escape listener in useEffect)

### 4. No Changes Needed (Confirmed)

- **C-01** Custom CSS textarea — ALREADY FIXED
- **C-03** Lucide icon subset — ALREADY FIXED
- **T-02** Input/Select bg consistency — Both use `bg-surface-3` at definition; no inconsistency found
- **T-03** Naming inconsistency — CSS kebab vs Tailwind dot-notation is correct (two separate naming systems)

---

## Files Touched

| File | Phases | Issues |
|------|--------|--------|
| `shared/src/colorConfig.js` | 1 | C-04 (create) |
| `shared/src/index.js` | 1 | C-04 (add export) |
| `client/src/components/SlidePanel.jsx` | 1, 2, 3, 4 | C-02, H-02, M-07, A-03 |
| `client/src/components/Toolbar.jsx` | 1, 3, 4 | C-04, M-05, H-03, A-02 |
| `client/src/pages/HomePage.jsx` | 2, 3 | H-01, H-04, M-03, M-06, M-08 |
| `client/src/components/PropertiesPanel.jsx` | 2 | H-05 |
| `client/src/components/QuickAccessToolbar.jsx` | 3 | M-04 |
| `client/src/pages/EditorPage.jsx` | 3 | M-04 (pass props) |
| `client/src/components/ui/Button.jsx` | 3 | M-01 |
| `client/src/components/ui/Input.jsx` | 4 | T-01 |
| `client/src/index.css` | 3, 4 | M-08, T-04 |

---

## Unresolved Questions

1. **[M-01]** Does Tailwind config map `bg-active` → `var(--bg-active)`? CSS var exists in `index.css:63`, but config mapping unverified. If not mapped, use `active:bg-[var(--bg-active)]` arbitrary value.
2. **[H-04]** Should Edit button in list view be removed entirely (title already opens), or kept as redundant affordance? Decision: keep Edit button for discoverability, but remove redundant `onOpen` call.
3. **[T-04]** Light theme scrollbar value `rgba(0,0,0,0.15)` — conservative pick. May need tuning based on actual light theme surface colors.
