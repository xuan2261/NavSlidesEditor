---
phase: 2
title: 'Fix Joyride Modal Overlay'
status: pending
effort: ''
---

# Phase 2: Fix Joyride Modal Overlay

## Overview

Khắc phục lỗi Modal Overlay của ProductTour (Joyride) bị mất nền tối (backdrop) dẫn đến việc người dùng không phân biệt được modal đang hiện trên UI.

## Requirements

- Functional: Modal Joyride phải có nền overlay tối che khuất toàn bộ giao diện phía sau, không cho phép click vào UI phía sau.
- Non-functional: Giữ nguyên các thiết kế Joyride hiện hành.

## Architecture

Vấn đề `overlayColor: 'rgba(0, 0, 0, 0.6)'` trong `react-joyride` không hiện có thể do Joyride tạo overlay inline nhưng bị lỗi z-index vì một container ở app root đã vô tình định nghĩa stacking context.

## Related Code Files

- Modify: `client/src/components/ProductTour.jsx`
- Modify: `client/index.css` (nếu cần bổ sung logic override `.react-joyride__overlay`)

## Implementation Steps

1. Phân tích `ProductTour.jsx` và CSS render của `react-joyride`.
2. Kiểm tra thuộc tính `zIndex: 99999` có thực sự hoạt động hay bị giới hạn bởi `<div id="root">` hoặc component bao ngoài.
3. Nếu cần, thêm css class global trong `index.css` để ép `.react-joyride__overlay` render chính xác ở full viewport (`fixed inset-0 z-[99999] bg-black/60`).
4. Test chạy tour để xác nhận overlay che đúng.

## Success Criteria

- [ ] Khi chạy `Welcome to NavSlidesEditor!`, nền ứng dụng tối mờ (opacity 0.6) và rõ ràng.

## Risk Assessment

- Rủi ro override CSS sai ảnh hưởng Joyride. Cách tiếp cận tốt nhất là dùng props `styles` của Joyride.
