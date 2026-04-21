---
phase: 2
title: "Implement Tour Component"
status: pending
priority: P1
effort: "2h"
dependencies: ["phase-01-setup-environment"]
---

# Phase 2: Implement Tour Component

## Overview
Xây dựng component `ProductTour.jsx` bao bọc `react-joyride`, định nghĩa các bước (steps) chi tiết, đồng thời tuỳ chỉnh giao diện (CSS / Theme) của Joyride để khớp với giao diện Dark Mode của dự án.

## Requirements
- Functional:
  - Khai báo 4-5 bước giới thiệu chính (Welcome, Slide List, Toolbar, Canvas, Properties).
  - Tự động bắt đầu nếu `localStorage` chưa lưu trạng thái `navSlidesTutorialSeen`.
  - Lưu trạng thái vào `localStorage` khi hoàn thành hoặc Skip để không hiển thị lại ở lần sau.
- Non-functional:
  - Tách rời component `ProductTour.jsx` để giữ file `EditorPage.jsx` gọn gàng.
  - Sử dụng chung màu sắc từ theme hiện tại (e.g. màu primary `#6366f1`, nền `#1e1e2e`).

## Architecture
- `react-joyride` cung cấp prop `steps` (mảng các step config). Mỗi step chứa `target` (CSS selector), `content` (nội dung HTML/String), `placement` (vị trí tooltip).
- Component sẽ quản lý state `run` (boolean) để kích hoạt tour.
- Callback của Joyride sẽ bắt các event `status === 'finished'` hoặc `status === 'skipped'` để ghi localStorage.

## Related Code Files
- Create: `client/src/components/ProductTour.jsx`
- Modify: `client/src/pages/EditorPage.jsx`

## Implementation Steps
1. Tạo file `ProductTour.jsx`.
2. Import `Joyride` từ `react-joyride`.
3. Định nghĩa biến `steps` với các mục tiêu cụ thể:
   - Bước 1: Welcome (chọn body, placement center)
   - Bước 2: Toolbar (`.tour-step-toolbar`)
   - Bước 3: Canvas (`.tour-step-canvas`)
   - Bước 4: Properties (`.tour-step-properties`)
4. Tuỳ chỉnh prop `styles` của Joyride để đổi màu button, tooltip background, text color cho phù hợp Dark Mode.
5. Cài đặt hàm `handleJoyrideCallback` để lắng nghe event hoàn tất, sau đó set `localStorage.setItem('navSlidesTutorialSeen', 'true')`.

## Success Criteria
- [ ] Component ProductTour có thể hiển thị được tooltip tại đúng vị trí các CSS class.
- [ ] Tooltip giao diện Dark Mode, font chữ rõ ràng.
- [ ] Logic Skip/Finish ghi dữ liệu đúng vào localStorage.

## Risk Assessment
- Rủi ro: Z-index của các thành phần có thể bị đè lên Tooltip của Joyride.
- Mitigations: Thiết lập `styles.options.zIndex` của Joyride lên `99999`. Đảm bảo các component fixed khác không có z-index cao hơn.
