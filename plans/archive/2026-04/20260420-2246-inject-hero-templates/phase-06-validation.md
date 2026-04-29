---
phase: 6
title: 'Validation & Testing'
status: pending
priority: P1
effort: '1h'
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Validation & Testing

## Overview

Xác nhận tính chính xác và an toàn của cơ sở dữ liệu `built-in-templates.json` sau khi inject các template mới.

## Requirements

- Functional: 100% các template mới được parse thành công trên UI Gallery.
- Non-functional: Không lỗi crash ứng dụng.

## Architecture

Test end-to-end trên frontend Gallery.

## Related Code Files

- Modify: N/A

## Implementation Steps

1. Chạy validator JSON để đảm bảo cấu trúc mảng hợp lệ.
2. Kiểm tra `npm run dev` để test xem app có start hay báo lỗi.
3. Sử dụng `curl` hoặc node script để fetch `/api/marketplace/templates` xem payload trả về hợp lệ.
4. Đếm số lượng categories hiển thị trong mảng filter, kiểm tra các tag mới.

## Success Criteria

- [ ] Script kiểm tra node script đếm >78 template (bao gồm 5 template JSON siêu lớn).
- [ ] Không có JSON parse error trong Terminal.

## Risk Assessment

- None.
