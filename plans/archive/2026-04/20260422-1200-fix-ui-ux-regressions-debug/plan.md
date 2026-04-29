---
title: 'Fix UI/UX Regressions (Phase 2 - Debug Report)'
description: ''
status: completed
priority: P2
branch: 'master'
tags: []
blockedBy: []
blocks: []
created: '2026-04-22T04:59:45.265Z'
createdBy: 'ck:plan'
source: skill
---

# Fix UI/UX Regressions (Phase 2 - Debug Report)

## Overview

Kế hoạch này (Phase 2 - Debug Report) nhằm giải quyết 4 lỗi UI/UX cốt lõi được phát hiện qua báo cáo audit (`artifacts/debug_report.md`):

1. Menu thả xuống không hoạt động hoặc bị che khuất (z-index / overflow).
2. Modal hướng dẫn (ProductTour) bị mất lớp overlay tối.
3. Bố cục Properties Panel bị chật chội, cắt chữ ở các mục Auto-slide, Loop, và Footer.
4. Ảnh thu nhỏ (Thumbnail) hiển thị nội dung mẫu của Reveal.js kèm theo các icon điều khiển không mong muốn thay vì hiển thị dạng thẻ tĩnh.
5. Kiểm tra E2E tổng thể và test toàn diện các thay đổi.

## Phases

| Phase | Name                                                                     | Status    |
| ----- | ------------------------------------------------------------------------ | --------- |
| 1     | [Fix Dropdown Menus](./phase-01-fix-dropdown-menus.md)                   | Completed |
| 2     | [Fix Joyride Modal Overlay](./phase-02-fix-joyride-modal-overlay.md)     | Completed |
| 3     | [Fix Properties Panel Layout](./phase-03-fix-properties-panel-layout.md) | Completed |
| 4     | [Fix Thumbnail Rendering](./phase-04-fix-thumbnail-rendering.md)         | Completed |
| 5     | [Comprehensive Verification](./phase-05-comprehensive-verification.md)   | Completed |

## Dependencies

<!-- Cross-plan dependencies -->
