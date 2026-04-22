---
phase: 1
title: 'Fix Dashboard'
status: completed
effort: '2h'
---

# Phase 1: Fix Dashboard

## Overview

Khắc phục các lỗi hiển thị trên trang Dashboard, bao gồm việc khôi phục các nút bấm thao tác trên thẻ thuyết trình và dọn dẹp các mục mẫu (template) rác.

## Requirements

- Functional: Nút Edit, Duplicate, Delete phải hiển thị đầy đủ và hoạt động được trên từng thẻ trình bày. Modal tạo mới phải loại bỏ các mẫu không hợp lệ.
- Non-functional: Giữ nguyên hiệu ứng hover, không làm phá vỡ cấu trúc grid.

## Architecture

- Sửa lỗi layout bằng cách điều chỉnh các lớp (classes) Tailwind trong `SlideThumbnail`.
- Cập nhật logic render danh sách template trong `HomePage`.

## Related Code Files

- Modify: `client/src/components/SlideThumbnail.jsx`
- Modify: `client/src/pages/HomePage.jsx`

## Implementation Steps

1. Mở file `client/src/components/SlideThumbnail.jsx`.
2. Định vị thẻ `div` bọc ngoài cùng có class `h-full`.
3. Xóa class `h-full` để ngăn Thumbnail chiếm 100% chiều cao của thẻ cha.
4. Mở file `client/src/pages/HomePage.jsx`.
5. Tìm đoạn mã hiển thị Modal tạo mới (`allTemplates.map`).
6. Thêm bộ lọc để loại bỏ các template rác (ví dụ: title là "New Template" được tạo ra trong quá trình test).
7. Điều chỉnh class `px-3` thành `px-4` trong `client/src/components/layout/StatusBar.jsx` để tăng padding lề trái/phải.

## Success Criteria

- [x] Các nút thao tác xuất hiện khi hover lên thẻ thuyết trình tại mục "All Presentations".
- [x] Không còn khoảng trắng thừa dưới thumbnail.
- [x] Modal tạo mới chỉ hiển thị Blank và các template hợp lệ.
- [x] Status bar có padding chuẩn, không bị sát mép.

## Risk Assessment

- Rủi ro: Việc bỏ `h-full` có thể làm thumbnail hiển thị sai tỷ lệ nếu không có `aspect-video`.
- Giảm thiểu: Đảm bảo class `aspect-video` vẫn được giữ nguyên và áp dụng đúng cách để duy trì tỷ lệ 16:9.
