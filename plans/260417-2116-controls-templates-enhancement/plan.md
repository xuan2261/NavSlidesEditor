---
title: "Controls & Template System Enhancement"
status: completed
created: 2026-04-17
priority: high
estimatedEffort: 8-12 days
blockedBy: []
blocks: []
---

# Controls & Template System Enhancement

Mở rộng hệ thống controls (thêm shapes, QR Code, divider) + nâng cấp slide layout templates (từ 8 → 20) + bổ sung interactive simulation/quiz templates vào Marketplace + cải tiến template UX (preview modal, insert flow).

## Quyết định thiết kế

| Quyết định | Lựa chọn |
|-----------|----------|
| New element types | QR Code (qrcode.js library) + Divider (reuse shape renderer) |
| Shapes mở rộng | Thêm vào shapeUtils.js — hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket |
| Slide Templates | Extract SLIDE_TEMPLATES ra file riêng `slide-templates.js` |
| Interactive Templates | HTML embed + vanilla JS (không framework) |
| Quiz Templates | HTML embed với client-side grading |
| Template Preview | Inline canvas preview (render miniature elements) |
| Storage | Giữ built-in-templates.json, thêm categories mới |

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Shapes & Controls Expansion](./phase-01-shapes-controls.md) | ✅ Completed | P0 | 1-2 ngày |
| 2 | [Slide Layout Templates Expansion](./phase-02-slide-layouts.md) | ✅ Completed | P0 | 1-2 ngày |
| 3 | [Interactive Simulation Templates](./phase-03-interactive-simulations.md) | ✅ Completed | P1 | 2-3 ngày |
| 4 | [Quiz & Data Viz Templates](./phase-04-quiz-dataviz.md) | ✅ Completed | P1 | 2-3 ngày |
| 5 | [Template UX Enhancement](./phase-05-template-ux.md) | ✅ Completed | P1 | 1-2 ngày |

## Dependency Graph

```
Phase 1 (Shapes/Controls) ──→ Phase 3 (Simulations use new shapes)
                               │
Phase 2 (Slide Layouts) ───┐  │
                           ├──→ Phase 5 (UX enhancements)
Phase 3 (Simulations) ─────┤
                           │
Phase 4 (Quiz/DataViz) ────┘
```

**Parallel:** Phase 1 + 2 chạy song song. Phase 3 + 4 chạy song song sau Phase 1.

## Verification

- Build: `npm run build` thành công, no errors
- Shapes: Tất cả shapes mới render đúng trong canvas + present + PDF export
- Templates: "Add Slide" modal hiện đủ 20 layouts
- Marketplace: `/api/marketplace/templates` trả về categories mới + templates mới
- Interactive: HTML embed templates hoạt động khi present mode
- Export: Offline HTML export giữ được simulations

## Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| built-in-templates.json quá lớn (>1MB) | Medium | Lazy loading per-category, nén whitespace |
| HTML embed simulations không work offline | High | Inline tất cả JS, không dùng CDN |
| EditorPage.jsx quá phình (~133KB) | High | Extract SLIDE_TEMPLATES ra file riêng |
| New shapes break PDF/PPTX export | Medium | Test từng shape trong print + export pipeline |
