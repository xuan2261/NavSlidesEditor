---
phase: 5
title: 'E2E Testing'
status: completed
effort: '1h'
---

# Phase 5: E2E Testing

## Overview

Chạy bộ kiểm thử E2E (Playwright) để khẳng định việc sửa giao diện UI không làm đứt gãy hay vỡ các tính năng đã kiểm thử tự động, xác nhận trạng thái "Zero-regression".

## Requirements

- Functional: Tất cả test scripts đều phải PASS.

## Architecture

- Sử dụng Playwright cho E2E Testing.

## Related Code Files

- Execute: `tests/e2e/**/*.spec.js`

## Implementation Steps

1. Khởi động môi trường kiểm thử e2e.
2. Chạy lệnh: `npm run test:e2e` (hoặc lệnh tương ứng của Playwright).
3. Phân tích kết quả test.
4. Nếu có lỗi về selector do cấu trúc DOM bị điều chỉnh, tiến hành sửa chữa mã e2e ngay lập tức.
5. Chạy lại đến khi PASS 100%.

## Success Criteria

- [x] Bộ test E2E vượt qua không có lỗi.
- [x] Không xuất hiện lỗi flaky test liên quan đến UI.

## Risk Assessment

- Rủi ro: E2E có thể fail do thời gian chờ load giao diện thay đổi.
- Giảm thiểu: Bổ sung các lệnh wait() hợp lý nếu cần.
