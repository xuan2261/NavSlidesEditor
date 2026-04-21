---
phase: 1
title: "Setup Environment"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Setup Environment

## Overview
Cài đặt thư viện `react-joyride` và thiết lập các định danh (ID/Class) cần thiết trên các DOM elements (Toolbar, Canvas, Properties Panel) để làm mục tiêu cho các bước hướng dẫn của Tour.

## Requirements
- Functional: Cài đặt dependency vào project `client`. Gắn ID/Class mục tiêu vào các vùng UI chính.
- Non-functional: Giữ nguyên cấu trúc Component hiện tại, không làm ảnh hưởng đến logic drag/drop hoặc styling.

## Architecture
- `react-joyride` sẽ sử dụng các CSS Selectors (ví dụ: `.tour-step-toolbar`, `.tour-step-canvas`) để xác định tọa độ và khoanh vùng làm sáng (highlight/spotlight).

## Related Code Files
- Modify: `client/package.json`
- Modify: `client/src/components/Toolbar.jsx`
- Modify: `client/src/components/SlideCanvas.jsx`
- Modify: `client/src/components/PropertiesPanel.jsx`

## Implementation Steps
1. Mở terminal, chuyển hướng vào thư mục `client` và chạy lệnh `npm install react-joyride`.
2. Mở `Toolbar.jsx`, thêm className `tour-step-toolbar` vào thẻ div gốc hoặc container chức năng.
3. Mở `SlideCanvas.jsx`, thêm className `tour-step-canvas` vào khu vực trang slide.
4. Mở `PropertiesPanel.jsx`, thêm className `tour-step-properties` vào vùng chứa cài đặt.

## Success Criteria
- [ ] Cài đặt thành công `react-joyride` mà không gây lỗi phiên bản.
- [ ] Các class mục tiêu xuất hiện đúng trên DOM khi inspect element.

## Risk Assessment
- Rủi ro: Việc gắn class có thể bị ghi đè nếu dùng Tailwind hoặc component lồng nhau phức tạp.
- Mitigations: Sử dụng các class độc lập chuyên dụng cho Tour (ví dụ prefix `tour-step-*`) và gắn ở container ngoài cùng của vùng.
