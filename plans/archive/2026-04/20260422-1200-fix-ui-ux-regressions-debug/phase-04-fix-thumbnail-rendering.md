---
phase: 4
title: 'Fix Thumbnail Rendering'
status: completed
effort: 'Small'
---

# Phase 4: Fix Thumbnail Rendering

## Overview

Giải quyết vấn đề hiển thị ảnh thu nhỏ (Thumbnail) bị lỗi trên Dashboard: hiển thị sai định dạng tĩnh do dùng `iframe` load toàn bộ Reveal.js control.

## Requirements

- Functional: Thumbnail phải hiển thị preview mượt mà của Slide đầu tiên.
- Non-functional: Giảm thiểu tài nguyên (không nên load 20 iframes cùng lúc nếu có nhiều slides), giao diện gọn gàng không hiện mũi tên (controls) của Reveal.

## Architecture

`SlideThumbnail.jsx` đang dùng `iframe` trỏ về API `/api/presentations/:id/present?preview=true`. Cần kiểm tra xem API này có hỗ trợ ẩn thẻ controls không, hoặc CSS của Dashboard cần chèn pointer-events-none, ẩn `reveal-controls`. Phương pháp tối ưu hơn là tạo một endpoint lấy ảnh thumbnail tĩnh thay vì load cả hệ thống HTML.

## Related Code Files

- Modify: `client/src/components/SlideThumbnail.jsx`
- Xem xét: `server/index.js` (logic render HTML for `?preview=true`)

## Implementation Steps

1. Mở `SlideThumbnail.jsx`, đảm bảo CSS đã loại bỏ khả năng tương tác (`pointer-events-none`).
2. Mở `server/index.js` tại route `/api/presentations/:id/present`, khi có tham số `?preview=true`, truyền options vào Reveal.js để tắt controls, progress bar, overview: `controls: false, progress: false, keyboard: false`.
3. Nếu cần, thêm một chút CSS inline (`<style>.reveal .controls { display: none !important; }</style>`) trực tiếp từ API cho mode preview.

## Success Criteria

- [ ] Ảnh thu nhỏ hiển thị trọn vẹn slide đầu tiên (theo tỷ lệ aspect-video).
- [ ] Hoàn toàn không có các icon mũi tên hay thanh kéo qua lại của Reveal.js.

## Risk Assessment

- Hiệu suất: Load quá nhiều iframes trên Dashboard có thể làm nặng máy. Cách giảm thiểu là thêm thuộc tính `loading="lazy"` (đã có) hoặc chuyển sang render dạng ảnh (png snapshot) ở phía server (sẽ cần công sức lớn hơn). Ta ưu tiên khắc phục UI bằng việc ẩn các DOM dư thừa trước.
