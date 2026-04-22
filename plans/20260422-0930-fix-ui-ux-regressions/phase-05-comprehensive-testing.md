---
phase: 5
title: 'Comprehensive Testing'
status: done
priority: P2
effort: '2h'
dependencies: ['1', '2', '3', '4']
---

# Phase 5: Comprehensive Testing

## Overview

Phase cuối cùng đảm bảo mọi thay đổi trong kế hoạch này không làm vỡ thêm bất kỳ logic giao diện nào khác. Sử dụng Browser Subagent và Playwright E2E để kiểm định.

## Requirements

- Verification: Tỷ lệ test pass 100%. Không còn bất kỳ điểm thiết sót UI nào theo báo cáo `ui_ux_regression_report.md`.

## Architecture

- Playwright Testing: Chạy test suite để kiểm tra flow (Dashboard -> Editor -> Preview -> Present).
- Visual UI Check: `browser_subagent` được dùng để chụp ảnh xác minh.

## Related Code Files

- Modify: `tests/e2e/editor.spec.js` (Nếu cần update CSS Selector)

## Implementation Steps

1. Khởi động lại ứng dụng với `npm run dev`.
2. Dùng `browser_subagent` điều hướng đến `http://localhost:5175/`.
3. Kiểm tra Dashboard: Thumbnails có hiện không? Nút "New" còn chữ `/>` không?
4. Kiểm tra Editor: Chuyển sang Dark Mode, check Properties Panel, mở Dropdown Share và AI Assistant.
5. Mở Welcome Modal kiểm tra chữ có bị lóa không.
6. Chạy bộ E2E Tests: `npm run test:e2e`.

## Success Criteria

- [x] E2E Tests pass 100%.
- [x] `browser_subagent` report trả về kết quả "Perfect" (Không lỗi).

## Risk Assessment

- Rủi ro: E2E Test fail do đổi class.
- Mitigation: Cập nhật CSS Selector dựa trên text thay vì class name.
