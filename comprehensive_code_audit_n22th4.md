# 🔍 Comprehensive Code Audit Report — NavSlides Editor

> **Audit Date:** 2026-04-22  
> **Scope:** ALL components, pages, modals, AI features, controls  
> **Method:** Static code analysis + CSS cross-reference + Tailwind config validation + browser testing

---

## Executive Summary

Phát hiện **21 issues** across **5 categories**, trong đó:
- 🔴 **5 CRITICAL** — Component hoàn toàn mất styling hoặc logic sai
- 🟡 **7 MAJOR** — Visual bug ảnh hưởng UX rõ ràng
- 🟢 **9 MINOR** — Potential issues, text color fallback, inconsistencies

---

## Category 1: Missing CSS Definitions (Orphaned Class Names)

CSS classes được reference trong JSX nhưng **KHÔNG có CSS definition nào** — bị xóa hoàn toàn trong Tailwind migration.

| # | Severity | Component | Missing Classes | Impact |
|---|----------|-----------|----------------|--------|
| 1 | 🔴 CRITICAL | `SlideSorterView.jsx` | `.slide-sorter-overlay`, `.slide-sorter-header`, `.slide-sorter-grid`, `.sorter-slide-card`, `.sorter-slide-preview`, `.sorter-slide-number` | Slide Sorter **hoàn toàn vỡ layout** — render thành DOM unstyled |
| 2 | 🔴 CRITICAL | `SlidePanel.jsx` | `.slide-context-overlay`, `.slide-context-menu`, `.context-separator` | Context menu (right-click trên slide) **không có styling** |
| 3 | 🔴 CRITICAL | `TransitionPreview.jsx` | `.transition-preview-overlay`, `.transition-preview-modal`, `.transition-preview-header`, `.transition-preview-content` | Transition Preview modal **hoàn toàn vỡ** |
| 4 | 🟡 MAJOR | `Toolbar.jsx` | `.color-indicator`, `.color-btn-wrapper` | Color picker indicator dots mất styling |
| 5 | 🟡 MAJOR | `HomePage.jsx` | `.form-group`, `.anim-fade-in` | Form groups trong modals mất spacing; fade-in animation không hoạt động |

> **Root Cause:** Trong quá trình Tailwind migration, các file CSS cũ chứa definitions cho các class thuần CSS đã bị xóa, nhưng JSX components **không được convert** sang Tailwind classes.

---

## Category 2: Invalid/Undefined Tailwind Token Usage

Tailwind classes được sử dụng nhưng **KHÔNG có trong `tailwind.config.js`**.

| # | Severity | Files Affected | Invalid Tokens | Should Be |
|---|----------|---------------|---------------|-----------|
| 6 | 🟡 MAJOR | `FindReplaceBar.jsx`, `AnimationTimeline.jsx`, `SlideCanvas.jsx` | `bg-muted`, `text-foreground`, `text-muted-foreground` | `bg-hover` / `bg-secondary`, `text-text-primary`, `text-text-muted` |
| 7 | 🟡 MAJOR | `AICopywriterModal.jsx`, `AIGeneratorModal.jsx`, `AITranslateModal.jsx`, `ShareModal.jsx`, `SyncModal.jsx`, `GitHubPushModal.jsx`, `MediaLibraryModal.jsx`, `HistoryModal.jsx` | `text-text` (standalone) | `text-text-primary` |
| 8 | 🟡 MAJOR | `HomePage.jsx`, `SettingsPage.jsx`, `ExplorePage.jsx`, `SlidePanel.jsx` | `bg-bg-primary`, `bg-bg-canvas-default` | `bg-primary` hoặc CSS var trực tiếp |

> **Impact:** Tailwind sẽ strip các classes không hợp lệ → elements bị inherit color từ parent thay vì design token chính xác. Trong dark mode thường vẫn trông OK do kế thừa, nhưng sai về nguyên tắc và có thể gây lỗi khi switch theme.

> **Note:** `text-text` may partially work vì Tailwind config có `text.DEFAULT` mapping nhưng nó **không đúng chuẩn** — nên là `text-text-primary` cho consistency.

---

## Category 3: Logic Bugs

| # | Severity | Component | Issue | Details |
|---|----------|-----------|-------|---------|
| 9 | 🔴 CRITICAL | `EditorPage.jsx:1049` | **Speaker Notes handler sai** | `onSpeaker={() => presentInWindow(presentation)}` — gọi Present thay vì toggle Speaker Notes. Khi user click View → Speaker Notes, nó mở presenter window thay vì hiện notes panel |
| 10 | 🟢 MINOR | `EditorPage.jsx:1049` | **Speaker Notes đã có trong PropertiesPanel** | Properties Panel bên phải đã có "Speaker Notes" textarea. Handler `onSpeaker` nên scroll/focus vào đó, KHÔNG mở presenter |

---

## Category 4: Overflow/Clipping Bugs

| # | Severity | Component | Issue | Details |
|---|----------|-----------|-------|---------|
| 11 | 🟡 MAJOR | `InsertMenu.jsx:125,283` | **Shape submenu bị clip** | Dropdown parent có `overflow-y-auto` → sub-panel `position: absolute; left: 100%` bị cắt bởi overflow bounds |
| 12 | 🟡 MAJOR | `InsertMenu.jsx:125,431` | **Table size picker bị clip** | Table picker nằm TRONG dropdown div có `overflow-y-auto` → 8x8 grid bị cắt khi Table item ở cuối menu |

> **Fix pattern:** Cần `overflow: visible` trên dropdown container HOẶC render sub-panels bên NGOÀI dropdown container (portal pattern).

---

## Category 5: Spacing & UX Issues

| # | Severity | Component | Issue |
|---|----------|-----------|-------|
| 13 | 🔴 CRITICAL | `SlidePanel.jsx:76` | **Slides dính liền nhau** — container `.slide-list` có `p-2` nhưng KHÔNG có `gap` hay `space-y` → thumbnails sát nhau không có khoảng trống |

---

## Category 6: Potential/Latent Issues (Lower Priority)

| # | Severity | Component | Issue |
|---|----------|-----------|-------|
| 14 | 🟢 MINOR | `Toolbar.jsx:351` | Class `bg-popup-container` không có definition — chỉ là naming marker, không ảnh hưởng vì có inline Tailwind |
| 15 | 🟢 MINOR | `SlideSorterView.jsx:159` | Dynamic classes `sorter-slide-card current/dragging/drag-over/multi-selected` — tất cả mất CSS |
| 16 | 🟢 MINOR | `SlideSorterView.jsx:178` | Context menu trong Sorter view cũng dùng `.slide-context-menu` — cùng issue #2 |
| 17 | 🟢 MINOR | ALL AI modals | `text-text` standalone — works due to CSS var but non-standard |
| 18 | 🟢 MINOR | `AnimationTimeline.jsx:110-140` | Dùng `bg-muted`, `text-muted-foreground` — shadcn/ui tokens KHÔNG có trong TW config |
| 19 | 🟢 MINOR | `FindReplaceBar.jsx:147,155` | `bg-muted`, `text-muted-foreground` — cùng issue shadcn tokens |
| 20 | 🟢 MINOR | `SlideCanvas.jsx:1376` | `bg-muted`, `text-foreground` trong zoom input — cùng pattern |
| 21 | 🟢 MINOR | `TemplatePickerModal.jsx:92` | `animate-in fade-in zoom-in-95` — cần `tailwindcss-animate` plugin nhưng `tailwind.config.js` không có |

---

## Impact Matrix

```
┌──────────────────────┬────────────────────────────────────────┐
│ Category             │ Files Affected                         │
├──────────────────────┼────────────────────────────────────────┤
│ Missing CSS (5)      │ SlideSorterView, SlidePanel,           │
│                      │ TransitionPreview, Toolbar, HomePage   │
├──────────────────────┼────────────────────────────────────────┤
│ Invalid Tokens (3)   │ FindReplaceBar, AnimationTimeline,     │
│                      │ SlideCanvas, ALL AI Modals,            │
│                      │ ShareModal, SyncModal, HistoryModal,   │
│                      │ GitHubPushModal, MediaLibraryModal,    │
│                      │ HomePage, SettingsPage, ExplorePage,   │
│                      │ SlidePanel, MiniToolbar                │
├──────────────────────┼────────────────────────────────────────┤
│ Logic Bugs (2)       │ EditorPage                             │
├──────────────────────┼────────────────────────────────────────┤
│ Overflow Clip (2)    │ InsertMenu                             │
├──────────────────────┼────────────────────────────────────────┤
│ Spacing (1)          │ SlidePanel                             │
└──────────────────────┴────────────────────────────────────────┘
```

---

## ✅ Components PASSING Audit (No Issues Found)

| Component | Status |
|-----------|--------|
| `AICopywriterModal.jsx` | ✅ Clean (minor `text-text`) |
| `AIGeneratorModal.jsx` | ✅ Clean (minor `text-text`) |
| `AITranslateModal.jsx` | ✅ Clean (minor `text-text`) |
| `CSSEditorModal.jsx` | ✅ Clean — full Tailwind |
| `CodeEditorModal.jsx` | ✅ Clean |
| `DropdownMenu.jsx` | ✅ Clean — full Tailwind |
| `EditorMenuBar.jsx` | ✅ Clean — full Tailwind |
| `ErrorBoundary.jsx` | ✅ Clean |
| `HtmlEditorModal.jsx` | ✅ Clean |
| `LatexEditorModal.jsx` | ✅ Clean |
| `LivePresentationModal.jsx` | ✅ Clean |
| `ProductTour.jsx` | ✅ Clean |
| `PromptPopover.jsx` | ✅ Clean |
| `PropertiesPanel.jsx` | ✅ Clean |
| `QuickAccessToolbar.jsx` | ✅ Clean |
| `SelectionPane.jsx` | ✅ Clean |
| `CollapsibleSection.jsx` | ✅ Clean |
| `StatusBar.jsx` | ✅ Clean |

---

## Recommended Fix Priority

### Batch 1 — CRITICAL (must fix)
1. **SlideSorterView** → Convert ALL CSS classes to Tailwind inline
2. **TransitionPreview** → Convert ALL CSS classes to Tailwind inline
3. **SlidePanel context menu** → Convert `.slide-context-*` + `.context-separator` to Tailwind
4. **SlidePanel spacing** → Add `space-y-2` to `.slide-list` container
5. **Speaker Notes logic** → Fix `onSpeaker` handler to scroll/focus PropertiesPanel notes

### Batch 2 — MAJOR (should fix)
6. **InsertMenu overflow** → Change dropdown `overflow-y-auto` to `overflow-visible` with max-height on inner content
7. **Toolbar color indicators** → Add `.color-indicator` CSS or convert to Tailwind
8. **Invalid Tailwind tokens** → Global find-replace:
   - `bg-muted` → `bg-hover`
   - `text-foreground` → `text-text-primary`
   - `text-muted-foreground` → `text-text-muted`
   - `text-text ` → `text-text-primary `
   - `bg-bg-primary` → `bg-primary`
   - `bg-bg-canvas-default` → CSS var directly

### Batch 3 — MINOR (nice to have)
9. Add `tailwindcss-animate` plugin or remove animation classes
10. Add `.form-group` CSS or convert to Tailwind `space-y-3`
11. Standardize ALL `text-text` → `text-text-primary`

---

## Unresolved Questions

1. Có nên thêm `tailwindcss-animate` plugin vào project hay convert `animate-in` sang CSS thuần?
2. `bg-muted` vs `bg-hover` — semantically khác nhau, có nên thêm `muted` vào TW config thay vì replace?
3. TransitionPreview cần layout phức tạp (overlay + modal + iframe) — convert sang Tailwind hay viết CSS riêng?
