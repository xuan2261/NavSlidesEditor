---
phase: 5
title: "SlideCanvas Selective + Config Cleanup"
status: pending
priority: P3
effort: "3h"
dependencies: [1, 2, 3, 4]
---

# Phase 05: SlideCanvas Selective + Config Cleanup

## Overview

Phase cuối: (A) chuyển đổi selective cho `SlideCanvas.jsx` — chỉ xử lý inline styles cho **UI chrome**, không đụng vào **canvas element rendering**; (B) dọn dẹp `index.css` và `tailwind.config.js`; (C) chạy final regression audit.

## Requirements

- **Functional:** Canvas element rendering (text, shape, image, chart) phải hoàn toàn không bị ảnh hưởng
- **Non-functional:** Bundle size giảm, hệ thống animation thống nhất

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx` (2654 lines, 68 inline styles — chỉ migrate ~30)
- Modify: `client/src/index.css` (265 lines — cleanup legacy CSS classes)
- Modify: `client/tailwind.config.js` (57 lines — add animation tokens, review `important`)
- Modify: `client/src/pages/HomePage.jsx` (cleanup Loading indicator + minor styling)

## Part A: SlideCanvas Selective Migration (68 → ~38)

### Quy tắc phân loại

| Category | Action | Ví dụ |
|---|---|---|
| **Canvas element rendering** | ❌ KHÔNG CHUYỂN | `style={{ left: el.x, top: el.y, width: el.width }}` |
| **UI chrome / overlay** | ✅ CHUYỂN | resize handles, selection border, rulers |
| **Toolbar/control inside canvas** | ✅ CHUYỂN | format bar, context menu |
| **Dynamic visual** | ⚠️ GIỮA inline cho dynamic value | `style={{ background: el.fill }}` |

### Implementation Steps

1. **Resize handles** (~L770-830): `style={{ position:'absolute', width:8, height:8, background:'#fff', border:'2px solid #6366f1' }}` → `className="absolute w-2 h-2 bg-white border-2 border-primary cursor-nwse-resize"` (8 handles × ~3 inline styles = 24 conversions)

2. **Selection outline**: `style={{ border:'2px solid #6366f1', position:'absolute' }}` → `className="absolute border-2 border-primary pointer-events-none"`

3. **Rulers/guides**: `style={{ position:'absolute', background:'var(--overlay-ruler)' }}` → `className="absolute bg-[var(--overlay-ruler)]"`

4. **Canvas grid overlay**: `style={{ position:'absolute', inset:0, pointerEvents:'none' }}` → `className="absolute inset-0 pointer-events-none"`

5. **Mini format toolbar**: chuyển positioning/layout → utility classes. Giữ inline cho dynamic top/left position

6. **KHÔNG CHUYỂN — Canvas elements**: Tất cả rendering logic cho text/shape/image/table/chart elements sử dụng computed style dựa trên element data model. Đây là core rendering, KHÔNG thay đổi.

## Part B: index.css Cleanup

7. **Migrate `.qat-dot` class** (L230-237):
   - Hiện tại:
     ```css
     .qat-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent); transition:opacity 0.2s; }
     ```
   - Xoá class này. Tại file sử dụng (`QuickAccessToolbar.jsx`), thay `className="qat-dot"` → `className="inline-block w-2 h-2 rounded-full bg-accent transition-opacity duration-200"`

8. **Migrate `.anim-fade-in`** (L248-255):
   - Thêm vào `tailwind.config.js`:
     ```js
     animation: {
       'fade-in': 'fadeIn 0.3s ease-out',
     },
     keyframes: {
       fadeIn: {
         from: { opacity: '0', transform: 'translateY(8px)' },
         to: { opacity: '1', transform: 'translateY(0)' },
       },
     },
     ```
   - Xoá class `.anim-fade-in` và `@keyframes fadeIn` khỏi `index.css`
   - Tại tất cả nơi dùng `className="anim-fade-in"` → `className="animate-fade-in"`

9. **Migrate `.anim-zoom-in`** (L257-264):
   - Thêm vào `tailwind.config.js`:
     ```js
     'zoom-in': 'zoomIn 0.2s ease-out',
     ```
   - Keyframe tương tự
   - Xoá khỏi `index.css`, thay `className="anim-zoom-in"` → `className="animate-zoom-in"`

10. **Giữ nguyên — KHÔNG XOÁ:**
    - `.color-picker-swatch` (L210-227) — pseudo-element styling, không thể dùng Tailwind
    - `.label-caps` (L166-172) — utility class hợp lệ
    - `.react-joyride__overlay` / `.react-joyride__tooltip` (L240-245) — third-party override, cần `!important`
    - Base resets (L132-207) — foundation styles

## Part C: tailwind.config.js Review

11. **Thêm animation tokens** (step 8-9 ở trên)

12. **Thêm `borderRadius` tokens:**
    ```js
    borderRadius: {
      sm: 'var(--radius-sm)',   // 6px
      md: 'var(--radius-md)',   // 12px
      lg: 'var(--radius-lg)',   // 16px
    },
    ```

13. **Review `important: '#root'`:**
    - Hiện tại: `important: '#root'` — nâng specificity tất cả Tailwind classes
    - **KHÔNG THAY ĐỔI** vì: đây là cần thiết để Tailwind classes thắng inline styles legacy trong quá trình migration dần dần
    - **TODO cho tương lai:** Sau khi tất cả inline styles đã chuyển xong (migration complete), có thể xem xét gỡ bỏ `important: '#root'` và chuyển sang `important: true` hoặc xoá hoàn toàn

## Part D: Final Regression Audit

14. **Automated verification:**
    ```bash
    # Count remaining inline styles
    Get-ChildItem -Recurse -Include *.jsx client\src | ForEach-Object { Select-String -Path $_.FullName -Pattern "style=\{\{" } | Measure-Object -Line
    # Target: ≤ 30

    # Count remaining hardcoded hex in UI code (excluding data)
    # Manually verify remaining are all in data objects or dynamic values

    # Build check
    npm run build

    # E2E test
    npm run test:e2e
    ```

15. **Browser visual regression test:**
    - [ ] Dashboard: grid layout, template thumbnails, sidebar navigation
    - [ ] Editor: toolbar, slide panel, properties panel, canvas
    - [ ] Settings: form layout, AI config section
    - [ ] Speaker View: layout grid, timer, thumbnails (Light + Dark mode)
    - [ ] Slide Sorter: grid layout, drag-and-drop
    - [ ] Light mode toggle: verify all pages render correctly

16. **Final grep audit:**
    ```bash
    # Verify no orphaned CSS classes remain
    Select-String -Path "client\src\index.css" -Pattern "\.qat-dot|\.anim-fade-in|\.anim-zoom-in"
    # Should return 0 results

    # Verify animation classes migrated
    Get-ChildItem -Recurse -Include *.jsx client\src | ForEach-Object { Select-String -Path $_.FullName -Pattern "anim-fade-in|anim-zoom-in" }
    # Should return 0 results (all converted to animate-*)
    ```

## Success Criteria

- [ ] `SlideCanvas.jsx` inline styles: 68 → ≤38 (canvas element rendering untouched)
- [ ] `index.css`: `.qat-dot`, `.anim-fade-in`, `.anim-zoom-in` REMOVED
- [ ] `tailwind.config.js`: animation tokens `fade-in`, `zoom-in` added
- [ ] `tailwind.config.js`: borderRadius tokens added
- [ ] Total codebase inline styles: 503 → ≤30
- [ ] `npm run build` pass zero errors, no new bundle warnings
- [ ] `npm run test:e2e` pass ALL tests
- [ ] Light/Dark mode visual check pass on ALL pages
- [ ] No orphaned CSS classes in `index.css`
- [ ] Canvas element rendering identical before/after

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| SlideCanvas element rendering breakage | 🔴 Critical | Strict classification: NEVER touch element rendering styles |
| Animation migration breaks existing transitions | Medium | Verify timing/easing matches exactly |
| `qat-dot` removal breaks QuickAccessToolbar | Low | Simple 1:1 class replacement |
| tailwind.config changes break existing classes | Low | Only adding tokens, not modifying existing |
