---
phase: 3
title: 'Fix Toolbar Icons'
status: pending
effort: '1h'
---

# Phase 3: Fix Toolbar Icons

## Overview

Cân chỉnh lại kích thước các icon trên thanh công cụ và sửa lỗi lệch font chữ trong các menu sổ xuống (dropdown).

## Requirements

- Functional: Chức năng của các nút trên thanh công cụ hoạt động bình thường.
- Non-functional: Sự đồng bộ trực quan giữa các biểu tượng (kích thước, căn chỉnh).

## Architecture

- Cập nhật các class kích thước (`w-4 h-4` -> `w-5 h-5`) hoặc kích thước cố định trong thuộc tính `size` của lucide-react.

## Related Code Files

- Modify: `client/src/components/Toolbar.jsx`
- Modify: `client/src/components/QuickAccessToolbar.jsx` (Nếu áp dụng)

## Implementation Steps

1. Mở file `client/src/components/Toolbar.jsx`.
2. Kiểm tra các nút phụ trợ như `Undo`, `Redo`, `Magnet`, `Ruler`.
3. Thay đổi tham số `size` (ví dụ từ 16 lên 18 hoặc 20) cho các icon bị nhỏ bất thường để đồng bộ với các icon chính.
4. Kiểm tra mục chèn "LaTeX / TikZ" trong dropdown Insert.
5. Đảm bảo sử dụng `items-center` và bỏ các margin/padding không chuẩn để chữ không bị lệch dòng baseline.

## Success Criteria

- [x] Tất cả các icon trên thanh công cụ có cùng một chuẩn kích thước và dễ dàng click.
- [x] Typography của menu "LaTeX / TikZ" thẳng hàng với các mục khác.

## Risk Assessment

- Rủi ro: Tăng kích thước có thể làm thanh công cụ bị tràn nếu số lượng nút quá nhiều.
- Giảm thiểu: Sử dụng flex-wrap hoặc cuộn ngang nếu không gian hiển thị bị giới hạn.
