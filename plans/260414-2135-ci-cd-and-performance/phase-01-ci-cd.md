# Phase 1: CI/CD Pipeline Setup

## Related Code Files

- `.github/workflows/ci.yml` (nơi chứa workflow của GitHub Actions)

## Context

Thiết lập A2 (Comprehensive Full-Stack Pipeline) để cung cấp vòng an toàn (safety net) cho các phiên bản tương lai. Nó sẽ chạy tự động khi có bất kỳ PR hay Push nào vào nhánh `main`.

## Implementation Steps

- `[x]` Tạo thư mục `.github/workflows` nếu chưa có.
- `[x]` Tạo file `ci.yml` định nghĩa GitHub Actions.
- `[x]` Thêm step cài đặt Node.js v20.
- `[x]` Thêm step chạy `npm ci` (hoặc `npm install`).
- `[x]` Thêm step chạy `npm run lint`.
- `[x]` Thêm step chạy `npm run test` (Vitest).
- `[x]` Thêm step chạy `npm run build` để kiểm chứng việc đóng gói frontend.
- `[x]` Thêm step cài đặt Chrome headless cho Playwright `npx playwright install chromium --with-deps`.
- `[x]` Thêm step chạy E2E tests với lệnh `npm run test:e2e`.

## Success Criteria

- Toàn bộ pipeline chạy thành công thông qua các step không có lỗi.
- Lực lượng E2E test có thể tương tác với DEV server được start trong Playwright runner.
