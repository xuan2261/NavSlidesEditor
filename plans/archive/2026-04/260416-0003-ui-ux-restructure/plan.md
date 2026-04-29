# UI/UX Restructure — NavSlides Editor

## Overview

Tái cấu trúc giao diện NavSlides Editor để giảm cognitive load, tổ chức nút chức năng hợp lý, và cải thiện trải nghiệm người dùng tổng thể. Dựa trên kết quả audit phát hiện **51 controls** hiển thị cùng lúc trong editor.

## Status

| Phase | Description                                                 | Status      |
| ----- | ----------------------------------------------------------- | ----------- |
| 01    | Editor Menu Bar — Gom 18 nút header → dropdown menus        | ✅ Complete |
| 02    | Toolbar Insert Dropdown — Gom 16 nút insert → mega dropdown | ✅ Complete |
| 03    | Slide Panel Context Menu — Simplify slide actions           | ✅ Complete |
| 04    | Replace window.prompt → custom popovers                     | ✅ Complete |
| 05    | Emoji → Lucide icons + CSS polish                           | ✅ Complete |

## Dependencies

- Không có dependency ngoại vi. Tất cả thay đổi là frontend-only.
- Có risk nhỏ với E2E tests cần update selectors sau refactor.

## Key Decisions

- Chọn kiểu **desktop app menu bar** (File | View | Settings | AI | Share) thay vì icon-only dropdowns → familiar pattern, tốt cho discoverability
- Giữ text editing toolbar nguyên trạng (đã tổ chức tốt)
- Canvas tools (Grid, Snap, Ruler, BG) giữ inline thay vì dropdown → hay dùng, cần toggle nhanh

## Risk Assessment

- **E2E Tests**: ~15 Playwright selectors cần update sau khi refactor header/toolbar
- **File size**: EditorPage.jsx (3939 lines) đã quá lớn → cần extract components
- **User learning curve**: Tối thiểu vì các chức năng vẫn giữ nguyên, chỉ tổ chức lại

## Verification Plan

1. Visual comparison: chụp before/after screenshots
2. Functional test: tất cả actions trong dropdowns phải hoạt động
3. Keyboard shortcuts giữ nguyên (Ctrl+F, Ctrl+Z, etc.)
4. `npm run dev` pass, không console errors
