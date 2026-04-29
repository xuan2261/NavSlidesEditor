# Phase 5 — Verification & Tests

## Overview

Verify all 19 fixes work correctly. Test strategy: manual smoke test + existing Vitest suite.

---

## Test Matrix

| Phase | Fix | Test Method | Verification |
|-------|-----|-------------|--------------|
| 1 | C-02 slide index visibility | Visual — switch theme | Badge readable in both dark/light |
| 1 | C-04 color palette shared config | Verify no console errors on load | `COLOR_PALETTE` no longer in Toolbar.jsx |
| 2 | H-01 sidebar layout | Visual | Progress bar at sidebar bottom |
| 2 | H-02 vertical children scale | Visual | Children thumbnails readable |
| 2 | H-03 BG popup viewport | Resize browser to bottom | Popup clips, no overflow |
| 2 | H-04 list view onClick | Click title vs row background | Only title opens presentation |
| 2 | H-05 emoji badge | Visual | `MousePointer2` icon renders |
| 3 | M-01 ghost active state | Click+hold ghost button | `bg-active` visible on press |
| 3 | M-03 search clear | Type in search → X button | Click X clears input |
| 3 | M-04 undo/redo | Click undo/redo in toolbar | `onUndo`/`onRedo` called (verify via console or behavior) |
| 3 | M-05 swatch border | Select white bg swatch | `border-border` visible (not transparent) |
| 3 | M-06 date format | Open page in different locales | Date respects browser locale |
| 3 | M-07 delete disabled | Delete slides until 1 remains | Button visually disabled (opacity+not-allowed) |
| 3 | M-08 modal z-index | Open create modal | `z-[var(--z-modal)]` applied (inspect element) |
| 4 | T-01 input placeholder | Focus input | Placeholder uses `text-text-muted` |
| 4 | T-04 scrollbar light | Switch to light theme | Scrollbar thumb lighter |
| 4 | A-02 color palette ARIA | Inspect element | `role="listbox"` present |
| 4 | A-03 context menu keyboard | Open context menu, press ↑↓ Esc | Focus moves, menu closes on Esc |
| 4 | A-03 context menu ARIA | Inspect element | `role="menu"` and `role="menuitem"` present |

---

## Smoke Test Steps

1. **Build check:** `npm run build` — no errors
2. **Dev server:** `npm run dev` — no console errors on load
3. **HomePage:** Test search clear, date format, modal z-index, sidebar layout
4. **EditorPage:** Test toolbar color picker, BG popup, slide panel context menu keyboard nav, undo/redo
5. **Theme toggle:** Switch dark ↔ light — verify all fixes render correctly

---

## Regression Checklist

- [ ] SlidePanel: selecting slides still works
- [ ] SlidePanel: context menu duplicate/lock/delete still works
- [ ] SlidePanel: vertical children selectable
- [ ] Toolbar: color picker still sets colors
- [ ] Toolbar: BG picker still sets backgrounds
- [ ] HomePage: list/grid view toggle still works
- [ ] HomePage: CRUD (create/edit/delete/duplicate) still works
- [ ] PropertiesPanel: multi-select badge still visible
- [ ] QuickAccessToolbar: undo/redo still functional
- [ ] No new ESLint errors introduced

---

## Rollback Plan

Nếu regression phát hiện, rollback per-file:

```bash
git checkout -- client/src/components/SlidePanel.jsx
git checkout -- client/src/components/Toolbar.jsx
git checkout -- client/src/components/QuickAccessToolbar.jsx
git checkout -- client/src/components/PropertiesPanel.jsx
git checkout -- client/src/components/ui/Button.jsx
git checkout -- client/src/components/ui/Input.jsx
git checkout -- client/src/pages/HomePage.jsx
git checkout -- client/src/index.css
git checkout -- shared/src/colorConfig.js  # if created
```

---

## Documentation Updates

Kiểm tra xem có docs nào cần update:
- `docs/code-standards.md` — nếu thêm design tokens mới (CSS variables)
- `docs/system-architecture.md` — nếu thêm shared module (`colorConfig.js`)
- `docs/project-changelog.md` — ghi lại tất cả fixes
- `docs/project-roadmap.md` — mark Tailwind remediation phase complete
