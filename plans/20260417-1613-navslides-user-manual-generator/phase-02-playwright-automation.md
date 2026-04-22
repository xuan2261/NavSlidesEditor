# Phase 02: Tự động hóa Chụp ảnh UI với Playwright

## Overview

- **Priority:** High
- **Current status:** Complete
- **Description:** Viết script dùng Playwright điều khiển trình duyệt ẩn (headless) chạy qua toàn bộ flow của NavSlides, tự động chụp lại các tính năng quan trọng và lưu vào thư mục `screenshots/`.

## Requirements

- Node.js script.
- Khởi chạy App (có thể yêu cầu User tự chạy server `npm run dev` trước khi chạy script, hoặc script tự start server).
- Định nghĩa tọa độ hoặc Selector chuẩn xác để Playwright click vào các nút (Editor, Chalkboard, Slide Menu).
- Đặt tên file ảnh chuẩn logic (vd: `01_home.png`, `03_editor_toolbar.png`) để Python DOCX dễ mapping.

## Related Code Files

- `[NEW] scripts/take_manual_screenshots.js`

## Implementation Steps

1. Khởi tạo script `take_manual_screenshots.js`.
2. Import `playwright`.
3. Viết hàm tiện ích: `async capture(page, selector, filename)`.
4. Viết kịch bản tự động hóa (Automated Scenarios):
   - Vào `/`, chụp màn hình Home.
   - Bấm nút _Create New_, vào màn Editor.
   - Trỏ chuột vào thanh Toolbar, chụp `toolbar.png`.
   - Click mở bảng Properties, chụp `properties_panel.png`.
   - Click nút Trình chiếu (Present), vào `/present/...`.
   - Bấm phím tắt mở Chalkboard, vẽ một nét (bằng JS trigger), chụp màn hình bảng phấn.
5. Xử lý tắt trình duyệt an toàn.

## Todo List

- [x] Setup file Playwright script.
- [x] Viết kịch bản điều hướng UI.
- [x] Viết kịch bản tương tác và chụp màn hình.

## Success Criteria

Chạy lệnh `node scripts/take_manual_screenshots.js` sẽ sinh ra ít nhất 15-20 file ảnh PNG nét căng trong thư mục `docs/manual/screenshots/`.
