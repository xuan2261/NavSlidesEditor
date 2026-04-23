---
phase: 2
title: "Properties Panel Family Migration"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 02: Properties Panel Family Migration

## Overview

Chuyển đổi toàn bộ nhóm Properties Panel (7 file, 114 inline styles) sang Tailwind utilities. Nhóm này có pattern rất lặp lại (label + input/select + spacing), nên có thể áp dụng conversion rules thống nhất.

## Requirements

- **Functional:** Tất cả property controls (color picker, slider, input, select, checkbox) phải hoạt động đúng
- **Non-functional:** Spacing/layout giữ nguyên pixel-perfect so với hiện tại

## Related Code Files

| File | Lines | Inline Styles | className Count |
|---|---|---|---|
| `properties/misc-properties.jsx` | 351 | **50** | 11 |
| `properties/image-properties.jsx` | ~200 | **15** | 5 |
| `properties/table-properties.jsx` | ~250 | **14** | 3 |
| `properties/chart-properties.jsx` | ~200 | **12** | 5 |
| `properties/media-properties.jsx` | ~150 | **11** | 3 |
| `properties/code-properties.jsx` | ~180 | **9** | 3 |
| `properties/common-element-controls.jsx` | ~100 | **3** | 3 |

## Common Patterns & Conversion Rules

Hầu hết inline styles trong nhóm này thuộc các pattern sau:

### Pattern A: Section spacing
```jsx
// TRƯỚC
<div style={{ marginBottom: 10 }}>
// SAU
<div className="mb-2.5">
```

### Pattern B: Label text
```jsx
// TRƯỚC
<div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
// SAU
<div className="text-[11px] text-text-muted mb-1">
```

### Pattern C: Button/control layout
```jsx
// TRƯỚC
style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 6 }}
// SAU
className="w-full justify-center text-xs mb-1.5"
```

### Pattern D: Color swatch
```jsx
// TRƯỚC
style={{ width: 24, height: 24, borderRadius: 4, background: value, border: '1px solid var(--border)' }}
// SAU
className="w-6 h-6 rounded border border-border"
style={{ background: value }}  // KEEP: dynamic value
```

### Pattern E: Grid layout
```jsx
// TRƯỚC
style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}
// SAU
className="grid grid-cols-4 gap-1"
```

## Implementation Steps

1. **`misc-properties.jsx` (50 inline styles):**
   - Áp dụng Pattern A cho tất cả `marginBottom: 10` → `mb-2.5`
   - Áp dụng Pattern B cho tất cả label text → `text-[11px] text-text-muted mb-1`
   - Áp dụng Pattern C cho button containers → `w-full justify-center text-xs`
   - Color swatches: giữ `style={{ background: value }}` cho dynamic color, chuyển kích thước sang className
   - Icon rotation: `style={{ transform: 'rotate(90deg)' }}` → `className="rotate-90"`

2. **`image-properties.jsx` (15 inline styles):**
   - Image preview container: `style={{ maxHeight: 120, overflow: 'hidden' }}` → `className="max-h-[120px] overflow-hidden"`
   - Crop controls: chuyển flex layout → `className="flex items-center gap-2"`
   - Opacity slider: giữ `style={{ opacity: value }}` cho dynamic

3. **`table-properties.jsx` (14 inline styles):**
   - Table preview mini: `style={{ border: '1px solid', fontSize: 10 }}` → `className="border border-border text-[10px]"`
   - Row/column controls: chuyển grid layout → `className="grid grid-cols-2 gap-2"`

4. **`chart-properties.jsx` (12 inline styles):**
   - Chart type selector: grid layout → `className="grid grid-cols-3 gap-1"`
   - Data table cells: border + padding → `className="border border-border px-2 py-1"`

5. **`media-properties.jsx` (11 inline styles):**
   - Video preview: `style={{ maxHeight: 160 }}` → `className="max-h-40"`
   - Audio controls: flex layout → utility classes

6. **`code-properties.jsx` (9 inline styles):**
   - Code preview: monospace font + bg → `className="font-mono bg-surface-2 rounded p-2 text-xs"`
   - Line numbers toggle: flex layout → utility classes

7. **`common-element-controls.jsx` (3 inline styles):**
   - Position inputs: flex + gap → `className="flex gap-2"`
   - Size label: text styling → `className="text-[11px] text-text-muted"`

## Success Criteria

- [ ] Tất cả 7 file properties: inline styles giảm từ 114 → ≤7 (chỉ giữ dynamic background/opacity)
- [ ] `npm run build` pass zero errors
- [ ] Kiểm tra visual: Properties Panel mở lên không bị lỗi layout
- [ ] Kiểm tra functional: thay đổi property value trong editor phản ánh đúng trên canvas
- [ ] Color picker, slider, checkbox, select tất cả interactive đúng
- [ ] `npm run test:e2e` pass

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Properties Panel styling rất chi tiết, dễ lệch pixel | So sánh screenshot trước/sau |
| Một số component dùng `var()` trực tiếp trong style | Đây là hybrid hợp lý — chuyển sang TW class tương ứng |
| Color swatch dynamic background | Giữ inline `style={{ background }}` cho các giá trị dynamic |
