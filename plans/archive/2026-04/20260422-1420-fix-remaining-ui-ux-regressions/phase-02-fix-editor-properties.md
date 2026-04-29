---
phase: 2
title: 'Fix Editor Properties'
status: pending
effort: '1h'
---

# Phase 2: Fix Editor Properties

## Overview

Điều chỉnh giao diện của Bảng thuộc tính (Properties Panel) để đảm bảo các trường nhập liệu không bị chật chội, chữ không bị đè lên nhau.

## Requirements

- Functional: Các input thuộc tính phải nhận và hiển thị giá trị đúng.
- Non-functional: UI thân thiện, khoảng cách đồng đều, dễ đọc và dễ thao tác.

## Architecture

- Sử dụng các tiện ích lưới (grid) của Tailwind CSS để thiết lập `gap` phù hợp.

## Related Code Files

- Modify: `client/src/components/properties/common-element-controls.jsx`

## Implementation Steps

1. Mở file `client/src/components/properties/common-element-controls.jsx`.
2. Định vị khu vực thiết lập thuộc tính Drop Shadow.
3. Thay đổi lớp tiện ích `gap-1.5` thành `gap-2` cho lưới cấu trúc `grid-cols-[1fr_1fr_1fr_28px]`.
4. Rà soát các vùng lưới (grid) khác ở các thông số vị trí (X, Y, Rot, W, H) để đảm bảo không bị quá khít.
5. Cân nhắc thêm padding nội bộ cho input nếu cần để chữ hiển thị rõ ràng.

## Success Criteria

- [x] Khoảng cách giữa các ô input X, Y, Blur trong phần Drop Shadow được mở rộng và hiển thị đẹp mắt.
- [x] Không có hiện tượng chữ bị đè, mất nội dung trong bảng thuộc tính khi thu hẹp bề ngang.

## Risk Assessment

- Rủi ro: Làm vỡ bố cục khi màn hình có độ phân giải thấp.
- Giảm thiểu: Kiểm tra bằng các công cụ responsive để đảm bảo tính linh hoạt của Flex/Grid.
