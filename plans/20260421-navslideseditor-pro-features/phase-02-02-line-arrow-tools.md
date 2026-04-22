---
phase: 2
title: '02-line-arrow-tools'
status: completed # pending | in-progress | completed
priority: P1 # P1 | P2 | P3
effort: '4h'
dependencies: []
---

# Phase 2: 02-line-arrow-tools

## Overview

Bổ sung công cụ Line (đường thẳng) và Arrow (mũi tên) cho Canvas. Tính năng này vô cùng cần thiết để làm các slide dạng biểu đồ, sơ đồ kỹ thuật.

## Requirements

- Functional:
  - Thanh công cụ (Toolbar) có thêm nút vẽ Line và Arrow.
  - Khi click vào nút, chuột chuyển sang chế độ vẽ (Draw mode).
  - Có thể chọn Line/Arrow, đổi màu sắc, đổi độ dày đường vẽ.
- Non-functional:
  - Khớp với hệ thống drag-and-drop và selection của Canvas hiện tại (Tái sử dụng logic Bounding Box của Shape).

## Architecture

- Render bằng thẻ `<svg>`. Để tận dụng 100% logic Drag/Resize hiện tại (`CommonElementControls.jsx`), Line và Arrow sẽ được định nghĩa là `type: 'shape'` với `shapeType: 'line'` hoặc `'arrow'`.
- SVG Line sẽ được vẽ từ góc `(0,0)` đến `(100%, 100%)` bên trong Bounding Box tiêu chuẩn `(width, height)`.

## Related Code Files

- Modify: `client/src/components/Toolbar.jsx` (Thêm icon Line, Arrow).
- Modify: `client/src/components/SlideCanvas.jsx` (Hoặc component con render shape).
- Modify: `client/src/components/properties/shape-properties.jsx` (Thêm stroke options).

## Implementation Steps

1. Khai báo `shapeType` mới là `line` và `arrow` bên cạnh rect, circle.
2. Thêm button Line và Arrow vào `Toolbar.jsx`.
3. Sửa hàm render Shape trong `SlideCanvas.jsx` (hoặc `ShapeRenderer`). Nếu là `line` hoặc `arrow`, render `<svg width="100%" height="100%"><line x1="0" y1="0" x2="100%" y2="100%" stroke="current" stroke-width="x" /></svg>`. Thêm marker `url(#arrowhead)` nếu là mũi tên.
4. Cập nhật `shape-properties.jsx` để hiển thị chọn màu viền và độ dày.

## Success Criteria

- [x] Bấm nút Line/Arrow trên Toolbar có thể vẽ được.
- [x] Có thể kéo thả (Drag) và đổi kích thước (Resize) Line/Arrow giống hệt Shape bình thường.
- [x] Export HTML/PDF vẫn hiển thị đúng đường line.

## Risk Assessment

- Rủi ro: Bounding Box của một đường thẳng chéo có thể gây khó khăn cho việc Click-to-Select vì click vào vùng trống cũng sẽ dính bounding box.
- Mitigations: Sử dụng CSS `pointer-events: none` cho bounding box, và `pointer-events: stroke` (hoặc `visibleStroke`) cho thẻ `<line>` bên trong SVG để chỉ trigger sự kiện chọn khi click trực tiếp vào nét vẽ.
