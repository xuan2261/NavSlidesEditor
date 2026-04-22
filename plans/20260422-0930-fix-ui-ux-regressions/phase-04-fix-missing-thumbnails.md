---
phase: 4
title: 'Fix Missing Thumbnails'
status: completed
priority: P1
effort: '3h'
dependencies: []
---

# Phase 4: Fix Missing Thumbnails

## Overview

Sự cố nghiêm trọng nhất: Dashboard không thể hiển thị bản xem trước thu nhỏ (thumbnail) của các bài thuyết trình, chỉ hiển thị ô xám trống. Phase này tìm kiếm và phục hồi cơ chế render Thumbnail đã bị vỡ sau khi gỡ bỏ legacy CSS.

## Requirements

- Functional: Dashboard hiển thị Thumbnail chính xác cho mỗi Document/Template.
- Non-functional: Tốc độ load Dashboard không bị ảnh hưởng do render Thumbnail.

## Architecture

- Khôi phục cấu trúc CSS container cho Thumbnail Renderer (thường là iframe tĩnh hoặc một thẻ SVG container tỷ lệ 16:9).
- Bổ sung lại các thuộc tính `transform scale`, `transform-origin: top left`, `pointer-events: none` bằng Tailwind CSS.

## Related Code Files

- Modify: `client/src/components/shared/SlideThumbnail.jsx` (hoặc tương tự)
- Modify: `client/src/pages/HomePage.jsx` (phần map danh sách presentations)
- Modify: `client/src/utils/thumbnailGenerator.js` (nếu liên quan đến logic)

## Implementation Steps

1. Xác định component chịu trách nhiệm hiển thị Thumbnail trên Dashboard.
2. Kiểm tra lại các wrapper classes: thêm `aspect-video`, `overflow-hidden`, `relative`, `bg-white`.
3. Khôi phục tỷ lệ scale: thêm thẻ nội dung bên trong với kích thước tuyệt đối (VD: `w-[1920px] h-[1080px]`) và sử dụng inline style `transform: scale(...)` hoặc các lớp Tailwind scale.
4. Đảm bảo iframe/canvas bên trong bị vô hiệu hóa sự kiện chuột (`pointer-events-none`).

## Success Criteria

- [ ] Các bài trình chiếu trên màn hình chính có hình ảnh thu nhỏ thể hiện đúng slide đầu tiên.
- [ ] Hình thu nhỏ hiển thị tốt trên cả giao diện sáng và tối.

## Risk Assessment

- Rủi ro: Việc render iframe cho hàng chục thumbnails có thể làm crash trình duyệt nếu chưa được tối ưu hóa.
- Mitigation: Áp dụng Lazy Loading hoặc đảm bảo logic trước đây vẫn giữ nguyên.
