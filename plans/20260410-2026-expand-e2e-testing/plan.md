---
title: "Mở Rộng E2E Test cho Editor (Phase 1 & 2)"
status: completed
blockedBy: []
blocks: []
date: 2026-04-10
---

# Kế Hoạch Mở Rộng E2E Testing (Phase 1 & Phase 2)

Dựa trên [Brainstorm Report](./reports/brainstorm-report.md), kế hoạch này sẽ tổ chức và tái thiết kế cấu trúc E2E Test Framework của dự án theo pattern **Page Object Model (POM)**, đồng thời mở phủ sóng automation testing cho các chức năng CRUD Slides và Elements.

## Bối Cảnh
Project hiện đang thiếu độ nén E2E coverage. Lệnh `npm run test:e2e` hiện tại chỉ check load trang hoặc click vài thứ đơn giản. Kế hoạch này giúp đảm bảo Core Flow của Editor không suy thoái khi cập nhật tính năng.

## Các Giai Đoạn (Phases)

| Phase | Path | Priority | Trạng thái |
|-------|------|----------|------------|
| Phase 01 | `./phase-01-page-object-model-and-core.md` | `High` | `Completed` |
| Phase 02 | `./phase-02-elements-insertion.md` | `High` | `Completed` |

## Thành Quả Kỳ Vọng
- Tách bạch cấu trúc POM Components (e.g. `tests/e2e/pages/HomePage.js`).
- Scripts tự động check được vòng đời của Presentation (Tạo, Sửa, Render Toolbar).
- CI/CD không bị flaky do chờ timeout sai cách.

> Lệnh chuyển tiếp: Khi kế hoạch được duyệt, hãy gõ `/ck:cook plans/20260410-2026-expand-e2e-testing/plan.md` để thi công.
