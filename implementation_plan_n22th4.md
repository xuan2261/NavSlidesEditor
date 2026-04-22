# Fix UI/UX Issues — Slide Panel, Insert Submenus, SlideSorter, Speaker Notes

## Các vấn đề đã xác nhận qua browser testing & code analysis

### 🔴 CRITICAL

| # | Issue | Root Cause | File |
|---|-------|-----------|------|
| 1 | **Slide Sorter hoàn toàn mất CSS** — render unstyled, dồn cục góc trên trái | CSS classes `.slide-sorter-overlay`, `.slide-sorter-grid`, `.sorter-slide-card` đã bị xóa trong Tailwind migration | `index.css` + `SlideSorterView.jsx` |
| 2 | **Speaker Notes (View menu) sai logic** — gọi `presentInWindow()` thay vì toggle Speaker Notes panel | Line 1049: `onSpeaker={() => presentInWindow(presentation)}` | `EditorPage.jsx` |

### 🟡 MAJOR

| # | Issue | Root Cause | File |
|---|-------|-----------|------|
| 3 | **Slide Panel — thumbnails dính liền nhau** | Container `.slide-list` có `p-2` nhưng không có `gap` hay `space-y` | `SlidePanel.jsx:76` |
| 4 | **Insert → Shape submenu không hiện** | Sub-panel `absolute left-full` bị clip bởi parent dropdown `overflow-y-auto` | `InsertMenu.jsx:125,283` |
| 5 | **Insert → Table size picker không hiện** | Table picker nằm trong parent có `overflow-y-auto`, bị clip | `InsertMenu.jsx:125,431` |
| 6 | **Context menu mất CSS** | Classes `.slide-context-overlay`, `.slide-context-menu`, `.context-separator` không có CSS | `index.css` + `SlidePanel.jsx` |

---

## Proposed Changes

### 1. SlidePanel — Thêm gap giữa thumbnails
**File:** `SlidePanel.jsx:76`
```diff
- <div className="slide-list flex-1 overflow-y-auto p-2">
+ <div className="slide-list flex-1 overflow-y-auto p-2 space-y-2">
```

### 2. InsertMenu — Fix overflow cho Shape & Table submenus  
**File:** `InsertMenu.jsx:125`
- Thay `overflow-y-auto` thành `overflow-y-auto overflow-x-visible` hoặc dùng Portal
- Thực tế: cần đổi strategy — đặt sub-panel ngoài dropdown container

### 3. SlideSorterView — Thêm đầy đủ CSS (hoặc convert sang Tailwind inline)
**File:** `SlideSorterView.jsx` — convert tất cả CSS classes sang Tailwind classes trực tiếp

### 4. Speaker Notes — Fix logic handler
**File:** `EditorPage.jsx:1049`
```diff
- onSpeaker={() => presentInWindow(presentation)}
+ onSpeaker={() => {
+   // Scroll to and focus the Speaker Notes textarea in PropertiesPanel
+   const notesEl = document.querySelector('[data-notes-panel]') || document.querySelector('textarea[placeholder*="speaker"]')
+   if (notesEl) { notesEl.scrollIntoView({ behavior: 'smooth' }); notesEl.focus() }
+ }}
```

### 5. Context Menu — Thêm CSS hoặc convert sang Tailwind
**File:** `SlidePanel.jsx` — convert `.slide-context-overlay`, `.slide-context-menu`, `.context-separator` sang Tailwind classes

---

## Verification Plan
- Build check: `npm run build`
- Browser subagent: verify all 6 fixes visually
