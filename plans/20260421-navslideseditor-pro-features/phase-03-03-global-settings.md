---
phase: 3
title: '03-global-settings'
status: completed # pending | in-progress | completed
priority: P2 # P1 | P2 | P3
effort: '2h'
dependencies: []
---

# Phase 3: 03-global-settings

## Overview

Cung cấp các thông số cấu hình chạy Slide (Playback settings) như Auto-slide, Slide loop, hay Navigation Mode cho từng bài thuyết trình, giúp Project đạt tiêu chuẩn trình diễn Pro giống slides.com.

## Requirements

- Functional:
  - Thêm Form nhập/chọn cấu hình ở phần "Presentation Settings" khi click ra ngoài slide (deselect all).
  - Hỗ trợ biến: `autoSlide` (số giây, 0 là tắt), `loop` (boolean), `navigationMode` (linear / default).
- Non-functional:
  - Thông số phải được lưu vào object `presentation.settings` trên Database.
  - Tích hợp mượt mà với API `Reveal.initialize()` hiện có trong `LiveViewPage` và logic Export.

## Architecture

- Object `presentation` sẽ có thêm fields (hoặc nằm trong `presentation.config`): `autoSlideInterval` (Number), `loop` (Boolean), `viewMode` (String: 'linear' | 'default').
- Trong `LiveViewPage.jsx`, truyền các thông số này xuống hàm khởi tạo Reveal:
  ```javascript
  Reveal.initialize({
    autoSlide: presentation.autoSlideInterval ? presentation.autoSlideInterval * 1000 : 0,
    loop: presentation.loop || false,
    navigationMode: presentation.viewMode || 'default',
    ...
  })
  ```

## Related Code Files

- Modify: `client/src/components/PropertiesPanel.jsx` (Thêm tab "Presentation Settings" nếu `selectedElement` là null).
- Modify: `client/src/pages/LiveViewPage.jsx` (Update cấu hình Reveal).
- Modify: `client/src/pages/ExportPage.jsx` (Tương tự Live View).

## Implementation Steps

1. Mở rộng `PropertiesPanel.jsx` -> Kiểm tra nếu không có selected element, hiển thị tuỳ chọn Global (bên cạnh CSS/Footer hiện có).
2. Tạo các input: Number cho Auto-Slide, Toggle cho Loop, Select cho Navigation Mode.
3. Update state thông qua hàm `onUpdatePresentation`.
4. Tìm tất cả các chỗ gọi `Reveal.initialize()` và nhúng cấu hình này vào.

## Success Criteria

- [x] UI cho phép nhập và lưu cấu hình Auto-slide, Loop.
- [x] Xem Live View, slide tự động chuyển trang theo số giây đã setup.
- [x] Export HTML cũng kế thừa các config tự chuyển trang này.
- [x] Vượt qua unit test đối chiếu (nếu có).

## Risk Assessment

- Rủi ro: Ảnh hưởng tới chế độ Edit nếu Reveal được init trong Edit Mode.
- Mitigations: Cấu hình Auto-Slide không được kích hoạt trong `EditorPage.jsx` hoặc `SlideCanvas.jsx`, chỉ kích hoạt ở chế độ xem độc lập (Live/Export).
