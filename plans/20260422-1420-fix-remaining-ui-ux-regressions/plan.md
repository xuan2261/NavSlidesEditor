---
title: 'Fix Remaining UI UX Regressions'
description: 'Phục hồi triệt để giao diện người dùng sau Tailwind migration, sửa lỗi thẻ thuyết trình bị ẩn nút, dọn dẹp placeholder rác và cải thiện khoảng cách các ô thuộc tính trong Editor.'
status: completed
priority: P2
branch: 'master'
tags: ['ui', 'ux', 'dashboard', 'editor']
blockedBy: []
blocks: []
created: '2026-04-22T07:20:25.103Z'
createdBy: 'ck:plan'
source: skill
---

# Fix Remaining UI UX Regressions

## Overview

Kế hoạch này nhằm giải quyết các lỗi UI/UX còn sót lại sau đợt chuyển đổi sang Tailwind CSS dựa trên quá trình gỡ lỗi và kiểm tra toàn diện bằng browser subagent. Các vấn đề chính bao gồm:

1. Lỗi mất các nút Edit/Duplicate/Delete và xuất hiện khoảng trắng trên thẻ "All Presentations" tại Dashboard do tràn layout của component thumbnail.
2. Sự xuất hiện của các nút "New Template" rác trong Modal tạo mới.
3. Lỗi chật chội và đè chữ trong bảng thuộc tính Editor (Properties Panel), đặc biệt ở phần Drop Shadow.
4. Lỗi kích thước icon trên thanh công cụ và typography bị lệch của mục "LaTeX / TikZ".
5. Lỗi khoảng cách (padding) ở thanh trạng thái (Status bar) làm chữ dính sát lề.

Kế hoạch cũng bao gồm các bước xác minh giao diện toàn diện và kiểm thử E2E để đảm bảo hệ thống đạt mức Zero-regression.

## Phases

| Phase | Name                                                                         | Status    |
| ----- | ---------------------------------------------------------------------------- | --------- |
| 1     | [Fix Dashboard](./phase-01-fix-dashboard.md)                                 | Completed |
| 2     | [Fix Editor Properties](./phase-02-fix-editor-properties.md)                 | Completed |
| 3     | [Fix Toolbar Icons](./phase-03-fix-toolbar-icons.md)                         | Completed |
| 4     | [Comprehensive UI Verification](./phase-04-comprehensive-ui-verification.md) | Completed |
| 5     | [E2E Testing](./phase-05-e2e-testing.md)                                     | Completed |

## Dependencies

- Phụ thuộc vào mã nguồn hiện tại của nhánh `master`.
