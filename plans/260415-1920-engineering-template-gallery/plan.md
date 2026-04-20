---
title: "Engineering Template Gallery & Interactive Simulations"
status: pending
created: 2026-04-15
priority: high
estimatedEffort: 12-18 days
blockedBy: []
blocks: []
---

# Engineering Template Gallery & Interactive Simulations

Mở rộng Template Gallery + Marketplace với 33-55 templates chuyên ngành kỹ thuật (11 môn × 3-5 templates/môn), kèm 6+ interactive simulations sử dụng HTML embed.

## Quyết định thiết kế

| Quyết định | Lựa chọn |
|-----------|----------|
| Templates/môn | 3-5 (Bài giảng tổng quan, chi tiết, Lab report, Seminar, Project) |
| Interactive | Embed HTML trước, refactor sau |
| Ưu tiên P0 | Kỹ thuật số, Vi xử lý, Lý thuyết mạch |
| Ngôn ngữ | Tiếng Việt only (không song ngữ) |
| Storage | JSON marketplace (built-in-templates.json) |

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Template Data Infrastructure](./phase-01-template-infrastructure.md) | ✅ Done | P0 | 1-2 ngày |
| 2 | [P0: Kỹ thuật số + Vi xử lý + Lý thuyết mạch](./phase-02-p0-templates.md) | ✅ Done | P0 | 3-4 ngày |
| 3 | [P1: Điện tử + Tự động hoá + Điện](./phase-03-p1-templates.md) | ✅ Done | P1 | 3-4 ngày |
| 4 | [P2: Đo lường + ĐTCS + Cơ khí + VKT + Thuỷ khí](./phase-04-p2-templates.md) | ✅ Done | P2 | 3-4 ngày |
| 5 | [Interactive Simulations](./phase-05-interactive-simulations.md) | ✅ Done | P1 | 3-4 ngày |
| 6 | [UI Enhancement & Polish](./phase-06-ui-enhancement.md) | ✅ Done | P1 | 1-2 ngày |

## Dependency Graph

```
Phase 1 (Infrastructure) ──→ Phase 2 (P0 Templates)
       │                       │
       │                       ├──→ Phase 3 (P1 Templates)
       │                       │
       │                       ├──→ Phase 4 (P2 Templates)
       │                       │
       └──→ Phase 5 (Simulations) ──→ tích hợp vào Phase 2-4
       │
       └──→ Phase 6 (UI Polish)
```

**Parallel:** Phase 3 + 4 chạy song song sau Phase 2. Phase 5 chạy song song với Phase 2.
Phase 6 cuối cùng.

## Verification

- API test: `GET /api/marketplace/templates` trả đúng categories + templates
- Template selection → tạo presentation có đầy đủ slides
- Interactive HTML embeds hoạt động khi present
- Export HTML offline → simulations vẫn work

## Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON file quá lớn (50+ templates) | Medium | Lazy loading, cache |
| HTML embed bị block bởi CSP | High | sandbox="allow-scripts" |
| Template content chất lượng kém | Medium | Chuẩn hoá slide structure |
