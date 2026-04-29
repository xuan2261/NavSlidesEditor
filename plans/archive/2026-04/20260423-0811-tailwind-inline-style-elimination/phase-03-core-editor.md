---
phase: 3
title: "Core Editor Components"
status: pending
priority: P2
effort: "5h"
dependencies: [1, 2]
---

# Phase 03: Core Editor Components

## Overview

Chuyển đổi 4 component editor chính. Đây là phase phức tạp nhất vì `Toolbar.jsx` (1339 lines, 53 inline styles) là file lớn thứ 2, và các component này có UI interaction phức tạp (dropdown, popover, color picker).

## Requirements

- **Functional:** Toolbar buttons, dropdowns, popovers, slide panel drag-and-drop phải hoạt động đúng
- **Non-functional:** Không lệch layout, không mất hover effects

## Related Code Files

| File | Lines | Inline Styles | className Count |
|---|---|---|---|
| `Toolbar.jsx` | 1339 | **53** | 51 |
| `SlidePanel.jsx` | 700 | **33** | 21 |
| `InsertMenu.jsx` | ~500 | **13** | 44 |
| `AnimationTimeline.jsx` | ~300 | **10** | 16 |

## Implementation Steps

### Toolbar.jsx (53 → ~10)

1. **Color picker popover** (L316-340): `style={{ position: 'relative' }}` → `className="relative"`. Dropdown panel: `style={{ position: 'absolute', top:'100%', ... }}` → `className="absolute top-full left-0 mt-1 p-3 bg-card border border-border rounded-lg shadow-lg z-50"`

2. **Font size/family selects** (L526-570): `style={{ display:'flex', gap:6 }}` → `className="flex gap-1.5"`. Label: `style={{ fontSize:10, color:'var(--text-muted)' }}` → `className="text-[10px] text-text-muted mb-0.5"`

3. **Alignment buttons** (L637-660): `style={{ fontSize:10, color:'var(--text-muted)' }}` → `className="text-[10px] text-text-muted"`. Button: `style={{ padding:'0 3px', width:28, height:28 }}` → `className="px-[3px] w-7 h-7"`

4. **Font weight/italic/underline buttons** (L815-840): `style={{ fontSize:12, fontWeight:700, width:'auto', padding:'0 6px' }}` → `className="text-xs font-bold w-auto px-1.5"`

5. **Slide background section** (L890-980): Nhiều `style={{ position:'relative' }}` → `className="relative"`. Color swatches grid: `style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)' }}` → `className="grid grid-cols-6 gap-1"`

6. **Color picker with highlight indicator** (L893-970): Swatch bar: `style={{ background: currentColor }}` → giữ inline (dynamic). Dropdown: chuyển layout/positioning sang className

7. **Background image controls** (L993-1090): `style={{ position:'relative' }}` → `className="relative"`. URL input: chuyển layout

8. **Inline styles cần GIỮA (dynamic):**
   - `style={{ background: currentColor }}` — dynamic color swatch
   - `style={{ display: 'none' }}` cho hidden file input
   - `style={{ fontSize: 13 }}` cho section label (nếu không có token phù hợp)

### SlidePanel.jsx (33 → ~5)

9. **Slide thumbnail container**: `style={{ position:'relative' }}` → `className="relative"`. Aspect ratio: `style={{ paddingBottom: '56.25%' }}` → `className="pb-[56.25%]"` hoặc dùng `var(--slide-ratio)`

10. **Context menu**: chuyển positioning/layout sang utility classes. Giữ `style={{ top, left }}` cho dynamic menu position

11. **Drag preview**: `style={{ opacity: 0.5 }}` → `className="opacity-50"`. Transform: giữ inline (dynamic)

12. **Slide number badge**: `style={{ position:'absolute', bottom:4, right:4 }}` → `className="absolute bottom-1 right-1"`

### InsertMenu.jsx (13 → ~2)

13. **Grid layouts**: `style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)' }}` → `className="grid grid-cols-3 gap-2"`

14. **Icon containers**: `style={{ display:'flex', flexDirection:'column', alignItems:'center' }}` → `className="flex flex-col items-center"`

15. **Category sections**: spacing → `className="mb-4"` hoặc `className="space-y-3"`

### AnimationTimeline.jsx (10 → ~2)

16. **Timeline track**: `style={{ position:'relative', height:40 }}` → `className="relative h-10"`

17. **Keyframe markers**: giữ inline `style={{ left: `${percent}%` }}` cho dynamic positioning. Chuyển visual styling sang className

18. **Play/progress indicator**: giữ inline cho dynamic width. Chuyển colors sang tokens

## Success Criteria

- [ ] `Toolbar.jsx` inline styles: 53 → ≤10 (dynamic color swatches, hidden inputs)
- [ ] `SlidePanel.jsx` inline styles: 33 → ≤5 (dynamic context menu position, drag transform)
- [ ] `InsertMenu.jsx` inline styles: 13 → ≤2 (dynamic positioning if any)
- [ ] `AnimationTimeline.jsx` inline styles: 10 → ≤2 (dynamic keyframe positions)
- [ ] `npm run build` pass zero errors
- [ ] Kiểm tra visual: Toolbar — tất cả buttons, dropdowns, color pickers render đúng
- [ ] Kiểm tra visual: SlidePanel — drag-and-drop, context menu, slide reordering hoạt động
- [ ] Kiểm tra visual: InsertMenu — tất cả categories, icons hiển thị đúng grid
- [ ] Kiểm tra functional: Toolbar font controls (size, family, color, alignment) hoạt động chính xác
- [ ] `npm run test:e2e` pass

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Toolbar dropdown positioning bị lệch | High | Test từng dropdown riêng biệt (font color, bg color, slide bg) |
| SlidePanel drag-and-drop bị ảnh hưởng | High | Test drag reorder + drop indicator carefully |
| `important: '#root'` xung đột với popover | Medium | Nếu lỗi, dùng `!important` class hoặc sử dụng `style` fallback |
| InsertMenu submenu clipping | Low | Đã fix ở các lần trước, chỉ cần verify |
