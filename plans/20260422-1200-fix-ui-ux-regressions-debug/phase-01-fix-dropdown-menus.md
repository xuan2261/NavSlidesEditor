---
phase: 1
title: 'Fix Dropdown Menus'
status: pending
effort: ''
---

# Phase 1: Fix Dropdown Menus

## Overview

Sửa lỗi Dropdown Menu (View, Share, Settings, Insert) trong thanh `EditorMenuBar.jsx` bị che khuất hoặc không hiện khi click.

## Requirements

- Functional: Dropdown Menu phải hiển thị chính xác khi người dùng click, đè lên trên tất cả các thành phần khác.
- Non-functional: Đảm bảo responsive và không phá vỡ layout hiện tại.

## Architecture

Vấn đề xuất phát từ `DropdownMenu.jsx` có class Tailwind `z-[1000] absolute`, nhưng có thể bị chặn bởi stacking context của một component cha có `relative`, `flex`, hoặc `overflow: hidden`. Ta cần kiểm tra `EditorMenuBar.jsx` và `Header` trong `EditorPage.jsx`.

## Related Code Files

- Modify: `client/src/components/DropdownMenu.jsx`
- Modify: `client/src/components/EditorMenuBar.jsx`
- Modify: `client/src/pages/EditorPage.jsx`

## Implementation Steps

1. Phân tích DOM tree trên trình duyệt (qua `EditorPage.jsx` và `EditorMenuBar.jsx`) để tìm phần tử cha gây ra lỗi z-index.
2. Thêm hoặc điều chỉnh các class như `isolate`, loại bỏ `overflow-hidden` không cần thiết, hoặc áp dụng `portal` nếu cần để Dropdown Menu thoát khỏi stacking context bị lỗi.
3. Kiểm tra tương tác bằng cách click vào các menu trên UI.

## Success Criteria

- [ ] Các menu (File, View, Settings, AI, Share) xổ xuống bình thường, không bị khuất sau Canvas.

## Risk Assessment

- Xung đột z-index với Canvas hoặc Overlay của Modal khác. Đảm bảo cấu trúc z-index (ví dụ 10-50 cho Canvas, 100+ cho header, 1000 cho Dropdown, 9999 cho Modal).
