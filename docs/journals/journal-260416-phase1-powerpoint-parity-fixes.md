# Journal — Phase 1: PowerPoint Parity Controls (Critical Fixes)

**Date:** 2026-04-16
**Author:** Claude Code
**Tags:** phase1, clipboard, selection-pane, keyboard-shortcuts
**Commit:** `6507dcff` | 5 files, +436/-12 lines

---

## Tóm tắt

Triển khai Phase 1 (P0) trong 1 session: Ctrl+B/I/U fix, Cut/Copy/Paste/Duplicate, Selection Pane.

---

## Features đã implement

### P0-1: Ctrl+B/I/U Keyboard Fix (`SlideCanvas.jsx`)
- **Root cause:** `onKeyDown` handler return ngay sau Escape khi `editingElementId != null` → TipTap không nhận Ctrl+B/I/U events.
- **Fix:** Forward Ctrl+B/I/U/Z/Y/0 cho TipTap handle; block tất cả keys khác khi đang edit.
- **Verification:** Ctrl+B/I/U hoạt động khi type trong text box.

### P0-2: Cut/Copy/Paste/Duplicate (`SlideCanvas.jsx` + `EditorPage.jsx`)
- **Keyboard:** Ctrl+C/X/V/D trong `onKeyDown` handler khi có element được chọn.
- **Context menu:** Copy/Cut/Paste/Duplicate buttons trong canvas context menu.
- **`addElements` callback:** Generate IDs bằng `crypto.randomUUID()` TRƯỚC `setPresentation` (bug found: closure capturing undefined IDs in setState).
- **Clipboard state:** Local `useState` + `useRef` trong SlideCanvas; `copySelected/cutSelected` trong editor-store.

### P0-3: Selection Pane (`SelectionPane.jsx` — NEW)
- PowerPoint-style layer list với:
  - Type icon (Lucide icons theo element.type)
  - Name (double-click để inline rename)
  - Eye icon → toggle visibility (`hidden: true/false`)
  - Lock icon → toggle `locked: true/false`
  - Drag handle → reorder zIndex
- Tích hợp vào `PropertiesPanel.jsx` như CollapsibleSection (default collapsed).
- Hidden filter: `.filter(el => !(el.hidden || false))` trong SlideCanvas render.

---

## Quyết định kiến trúc

| Decision | Reason |
|---|---|
| IDs gen trước `setPresentation` | Closure bug — setState closures capture stale object refs |
| Hidden filter tại render level | Không cần thay đổi element model schema |
| `onUpdateElements` batch cho reorder | SlideCanvas drag đã có batch update; SelectionPane dùng cùng pattern |
| `clipboard` local state trong SlideCanvas | Đơn giản hơn Zustand; paste cần position context từ canvas |

---

## Bugs found + fixed

1. **Closure ID bug:** `addElements` gọi `setSelectedElementIds` sau `setPresentation` nhưng cả hai dùng `newElements` có `id: undefined`. Fix: gen IDs trước, pass `withIds` vào cả hai.
2. **Duplicate state corruption:** Do bug #1 → Ctrl+D lần 2 duplicate element gốc thay vì bản mới. Fixed cùng với #1.

---

## Unresolved Questions

1. **Clipboard format:** JSON (hiện tại) hay cần HTML fallback khi copy từ external apps?
2. **Paste position:** Luôn +20/+20 offset hay nên paste tại mouse position?
3. **Selection Pane position:** CollapsibleSection trong PropertiesPanel ổn hay nên tách floating panel riêng?

---

## Next Steps

→ Phase 2: Slide Sorter View + Mini Toolbar + Zoom Controls + Toolbar UX