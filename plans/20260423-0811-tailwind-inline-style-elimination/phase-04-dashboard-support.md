---
phase: 4
title: "Dashboard & Supporting Components"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 04: Dashboard & Supporting Components

## Overview

Chuyển đổi các component phụ trợ (Dashboard TemplatePreview, TemplatePickerModal, ProductTour, ErrorBoundary, và các minor files). Nhóm này đa dạng nhưng mỗi file có số lượng inline styles vừa phải.

## Requirements

- **Functional:** Template preview rendering, Product Tour overlay, error boundary fallback đúng
- **Non-functional:** Dashboard aesthetics giữ nguyên

## Related Code Files

| File | Lines | Inline Styles | className Count |
|---|---|---|---|
| `dashboard/TemplatePreview.jsx` | 516 | **44** | 2 |
| `TemplatePickerModal.jsx` | ~200 | **9** | 7 |
| `ProductTour.jsx` | ~200 | **12** | 0 |
| `ErrorBoundary.jsx` | ~100 | **7** | 0 |
| `SlideSorterView.jsx` | ~250 | **7** | 11 |
| `SelectionPane.jsx` | ~200 | **7** | 7 |
| `dashboard/TemplateGallery.jsx` | ~150 | **6** | - |
| Minor files (5 files, 1-2 each) | - | **~10** | - |

**Total:** ~102 inline styles across ~12 files

## Implementation Steps

### dashboard/TemplatePreview.jsx (44 → ~3)

1. **Preview card container**: `style={{ width, height, background }}` — giữ inline cho dynamic dimensions, chuyển layout/border sang className

2. **Text overlays** (title, description): `style={{ fontSize, color, position }}` → `className="absolute bottom-0 left-0 right-0 p-3 text-sm text-white bg-gradient-to-t from-black/60"`

3. **Category badge**: `style={{ position:'absolute', top:8, right:8, fontSize:10, background, color }}` → `className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary"`

4. **Hover overlay**: chuyển opacity + background sang utility classes với group/hover

5. **Slide metadata section**: `style={{ padding, fontSize, color }}` → `className="p-3 text-xs text-text-secondary"`

### TemplatePickerModal.jsx (9 → 0)

6. **Modal overlay**: đã có className phần lớn, chuyển nốt `style={{ gap, padding }}` → `className="gap-4 p-4"`

7. **Template grid**: `style={{ display:'grid' }}` → `className="grid grid-cols-3 gap-3"`

8. **Template card hover**: `style={{ border, cursor }}` → `className="border border-border rounded-lg cursor-pointer hover:border-primary transition-colors"`

### ProductTour.jsx (12 → 0)

9. **Tour step content**: `style={{ padding, fontSize, lineHeight }}` → `className="p-4 text-sm leading-relaxed"`

10. **Navigation buttons**: `style={{ display:'flex', justifyContent:'space-between' }}` → `className="flex justify-between mt-4"`

11. **Progress dots**: `style={{ width:8, height:8, borderRadius:'50%', background }}` → `className={`w-2 h-2 rounded-full ${active ? 'bg-primary' : 'bg-surface-3'}`}`

### ErrorBoundary.jsx (7 → 0)

12. **Error page**: `style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', color, background }}` → `className="flex flex-col items-center justify-center h-screen text-text-primary bg-surface-0"`

13. **Error icon**: `style={{ fontSize:64, marginBottom:16 }}` → `className="text-6xl mb-4"`

14. **Error message**: `style={{ fontSize:14, color, maxWidth:400 }}` → `className="text-sm text-text-secondary max-w-[400px] text-center"`

### SlideSorterView.jsx (7 → ~1)

15. **Grid container**: chuyển grid layout → `className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4"`

16. **Slide card**: border + shadow → `className="rounded-lg border border-border bg-card overflow-hidden hover:border-primary transition-colors cursor-pointer"`

17. **Active indicator**: conditional styling → className conditional

### SelectionPane.jsx (7 → 0)

18. **Element list items**: `style={{ padding, borderBottom }}` → `className="px-3 py-2 border-b border-border"`

19. **Type icon**: `style={{ width:16, height:16, color }}` → `className="w-4 h-4 text-text-muted"`

### Minor Files (~10 inline styles total)

20. **EditorMenuBar.jsx** (2): chuyển menu item spacing
21. **QuickAccessToolbar.jsx** (2): chuyển dot indicator styling
22. **DropdownMenu.jsx** (2): chuyển dropdown positioning
23. **FindReplaceBar.jsx** (2): chuyển input layout
24. **LivePresentationModal.jsx** (2): chuyển QR code container
25. **SettingsPage.jsx** (1): `style={{ padding: '6px 10px' }}` → `className="px-2.5 py-1.5"`
26. **ExplorePage.jsx** (1): chuyển page layout

## Success Criteria

- [ ] `TemplatePreview.jsx` inline styles: 44 → ≤3 (dynamic dimensions)
- [ ] `TemplatePickerModal.jsx` inline styles: 9 → 0
- [ ] `ProductTour.jsx` inline styles: 12 → 0
- [ ] `ErrorBoundary.jsx` inline styles: 7 → 0
- [ ] `SlideSorterView.jsx` inline styles: 7 → ≤1
- [ ] Minor files: tất cả → 0
- [ ] `npm run build` pass zero errors
- [ ] Kiểm tra visual: Dashboard template grid render đúng thumbnails
- [ ] Kiểm tra visual: Product Tour overlay hiển thị đúng steps, dots, navigation
- [ ] Kiểm tra visual: Error boundary fallback page hiển thị đúng
- [ ] Kiểm tra visual: Slide sorter view grid layout và active state
- [ ] `npm run test:e2e` pass

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| TemplatePreview dynamic dimensions | Medium | Giữ width/height inline, chỉ chuyển visual styling |
| ProductTour Joyride integration | Medium | `!important` overrides trong `index.css` đã xử lý z-index |
| ErrorBoundary critical path | Low | Rất đơn giản, ít risk |
