# Phase 2 — High Priority Fixes

## Overview

Fix 5 high-priority UX bugs: sidebar import status layout (H-01), vertical child scale (H-02), BG popup viewport overflow (H-03), list view double onClick (H-04), và emoji badge (H-05).

---

## [H-01] Import Progress/Warning — Breaks Sidebar Layout

**File:** `client/src/pages/HomePage.jsx:796-805`
**Citation:** `HomePage.jsx:796-805` — inline progress/warning divs inside sidebar nav

### Problem

Progress và warning divs render inline trong sidebar nav list — khi có content, đẩy layout của sidebar nav items.

### Fix

Move progress/warning ra ngoài `<nav>` element, đặt ở vị trí fixed bottom hoặc tách riêng. Current markup:

```jsx
{/* Line 796-805 — nằm trong nav wrapper */}
{importProgress && (
  <div className="mx-3 mt-2 rounded border border-border bg-card px-2 py-1.5 ...">
)}
{importWarningSummary && (
  <div className="mx-3 mt-2 rounded border border-yellow-500/30 ...">
)}
```

### Implementation Steps

1. **Edit** `HomePage.jsx:785-806` — find the sidebar nav section wrapper
2. Wrap import progress/warning trong một `<div>` positioned at sidebar bottom:
   ```jsx
   <div className="mt-auto px-3 pb-2">
     {importProgress && (
       <div className="rounded border border-border bg-card px-2 py-1.5 text-[11px] text-text-secondary">
         {importProgress}
       </div>
     )}
     {importWarningSummary && (
       <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[11px] text-text-secondary">
         {importWarningSummary}
       </div>
     )}
   </div>
   ```
3. Ensure sidebar wrapper có `flex flex-col` và progress div dùng `mt-auto` để sticky ở bottom.

---

## [H-02] Vertical Children Scale — Too Small to Interact

**File:** `client/src/components/SlidePanel.jsx:386-407`
**Citation:** `SlidePanel.jsx:390` — `scale-[0.85] origin-top-left`

### Problem

Vertical slide children được scale 85% — thumbnail rất khó đọc và click chính xác trên màn hình nhỏ.

### Fix

Thay `scale-[0.85]` bằng giảm padding/width thay vì scale transform. Approach đơn giản nhất:

```jsx
// TRƯỚC (SlidePanel.jsx:390):
className={`... origin-top-left scale-[0.85] ${...}`}

// SAU: giảm padding từ p-1.5 → p-1, remove scale:
className={`... p-1 ${...}`}
```

Đồng thời giảm `min-h-[30px]` ở line 402 xuống `min-h-[24px]`.

### Implementation Steps

1. Edit `SlidePanel.jsx:390`: remove `origin-top-left scale-[0.85]`
2. Edit `SlidePanel.jsx:402`: giảm `p-1.5` → `p-1`, `min-h-[30px]` → `min-h-[24px]`

---

## [H-03] BG Popup — Viewport Overflow

**File:** `client/src/components/Toolbar.jsx:387-389`
**Citation:** `Toolbar.jsx:388` — `absolute left-0 top-full mt-1` popup

### Problem

BG popup dùng `absolute` không có boundary check. Near viewport bottom, popup tràn ra ngoài màn hình.

### Fix

Thêm `max-h-[80vh] overflow-y-auto` để clip content khi viewport nhỏ. Đồng thời add stable `id` attribute thay vì fragile `.bg-popup-container` class selector:

```jsx
// TRƯỚC (Toolbar.jsx:388):
<div className="bg-popup-container absolute left-0 top-full mt-1 w-[260px] ...">

// SAU:
<div id="bg-menu-popup" className="absolute left-0 top-full mt-1 w-[260px] max-h-[80vh] overflow-y-auto ...">
```

Also update outside-click handler if it uses `.bg-popup-container` selector.

### Implementation Steps

1. Edit `Toolbar.jsx:388-389`: add `id="bg-menu-popup"`, `max-h-[80vh] overflow-y-auto`
2. Edit `Toolbar.jsx:201-208` (outside-click handler): thay `e.target.closest?.('.bg-popup-container')` → `e.target.closest?.('#bg-menu-popup')`

---

## [H-04] List View Double onClick Risk

**File:** `client/src/pages/HomePage.jsx:1317-1321, 1338-1346`
**Citation:** `HomePage.jsx:1317-1321` — row click + `onOpen(pres.id)`; `HomePage.jsx:1343-1346` — Edit button also calls `onOpen(pres.id)`

### Problem

Entire row clickable (opens presentation) + Edit button also calls `onOpen`. StopPropagation hoạt động nhưng cấu trúc fragile. Edit button redundant.

### Fix

Đơn giản hóa: remove `onClick` từ outer row div, chỉ giữ `onClick` trên title/thumbnail area:

```jsx
// TRƯỚC (HomePage.jsx:1317-1321):
<div className="group flex items-center gap-4 px-4 py-3 rounded cursor-pointer ... hover:bg-hover"
  onClick={() => onOpen(pres.id)}  // ← entire row opens
>

// SAU: remove onClick from outer div, add onClick on title area only
<div className="group flex items-center gap-4 px-4 py-3 rounded cursor-pointer ... hover:bg-hover">
  {/* ... thumbnail ... */}
  <div className="flex-1 min-w-0">
    <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate cursor-pointer"
      onClick={() => onOpen(pres.id)}>
      {pres.title || 'Untitled'}
    </h3>
```

Action buttons (Edit/Duplicate/Delete) keep their own `stopPropagation` — nhưng Edit button không cần call `onOpen` nữa vì title đã handle rồi. Thay Edit button thành navigate-to-editor button với `stopPropagation` + direct action (hoặc giữ nguyên nếu muốn giữ Edit trong list view).

### Implementation Steps

1. Edit `HomePage.jsx:1317-1321`: remove `onClick={() => onOpen(pres.id)}` from outer row div
2. Edit `HomePage.jsx:1330`: add `onClick={() => onOpen(pres.id)} cursor-pointer` vào `<h3>` title
3. Optionally: Edit button at line 1339-1346 — remove `onOpen` call (title đã handle), chỉ giữ stopPropagation. Or keep as-is với stopPropagation.

---

## [H-05] Emoji Badge in Properties Panel

**File:** `client/src/components/PropertiesPanel.jsx:88-90`
**Citation:** `PropertiesPanel.jsx:89` — `📌 {selectedElementIds.length} elements selected`

### Problem

Emoji `📌` không consistent với design system (stroke-based Lucide icons).

### Fix

Thay emoji bằng Lucide `MousePointer2` icon (14px, stroke-style):

```jsx
// TRƯỚC (PropertiesPanel.jsx:88-90):
<span className="text-xs text-text-secondary">
  📌 {selectedElementIds.length} elements selected
</span>

// SAU:
<span className="flex items-center gap-1 text-xs text-text-secondary">
  <MousePointer2 size={13} />
  {selectedElementIds.length} elements selected
</span>
```

### Implementation Steps

1. Check if `MousePointer2` already imported in `PropertiesPanel.jsx`
2. If not, add to lucide-react import
3. Edit `PropertiesPanel.jsx:88-90`: thay emoji bằng `<MousePointer2 size={13} />`

---

## Related Code Files

| File | Changes |
|------|---------|
| `client/src/pages/HomePage.jsx` | H-01 (sidebar layout), H-04 (onClick refactor) |
| `client/src/components/SlidePanel.jsx` | H-02 (scale removal) |
| `client/src/components/Toolbar.jsx` | H-03 (popup overflow + id) |
| `client/src/components/PropertiesPanel.jsx` | H-05 (emoji → icon) |

## Success Criteria

- [ ] H-01: Import progress/warning sticky at sidebar bottom, no layout push
- [ ] H-02: Vertical children readable at 100% scale with reduced padding
- [ ] H-03: BG popup clips with `max-h-[80vh]` near viewport bottom
- [ ] H-04: Row click → only title triggers `onOpen`, Edit button not redundant
- [ ] H-05: `📌` replaced with `MousePointer2` Lucide icon

## Risk Assessment

| Issue | Risk | Mitigation |
|-------|------|------------|
| H-01 | Low — structural reflow | Test with long sidebar nav lists |
| H-02 | Low — CSS only | Test with various slide sizes |
| H-03 | Low — CSS overflow | Verify other popups have same pattern |
| H-04 | Medium — onClick removal | Verify no other handlers depend on row click |
| H-05 | Low — icon swap | Verify icon is meaningful for "elements selected" |
