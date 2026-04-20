---
title: "CI/CD and Performance Pipeline"
status: completed
created: 2026-04-14
priority: high
estimatedEffort: 3-5 days
blockedBy: []
blocks: []
---

# CI/CD and Performance Pipeline

Phát triển công cụ kiểm thử tự động toàn diện và đo lường hiệu năng giới hạn cho nền tảng Slides (A2 + B1).

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [CI/CD Pipeline Setup](./phase-01-ci-cd.md) | completed | P1 | 1-2 days |
| 2 | [Performance Load Testing Setup](./phase-02-performance.md) | completed | P2 | 2-3 days |

## Quyết định thiết kế đã xác nhận
- **CI/CD:** Sử dụng GitHub Actions cho luồng PR và Push to main (Lint, Vitest, Build, Playwright E2E).
- **Thử tải (Load Test):** Sử dụng `k6` để giả lập tải cho WebSocket (Socket.IO) và Upload JSON (REST API).
