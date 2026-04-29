---
title: "UI/UX Tailwind Fix — Hard Mode Remediation"
description: "Fix all remaining Critical/High/Medium UI/UX issues from code review: slide index visibility, color palette theme system, sidebar layout, viewport overflow, button states, accessibility, and performance."
status: completed
priority: P1
effort: 8h
branch: master
tags: [ui, ux, tailwind, a11y, fix]
created: 2026-04-25
---

## Tổng quan

Fix toàn bộ Critical/High/Medium UI/UX issues còn lại từ Tailwind CSS code review. Mỗi fix self-contained, no cross-file dependencies (ngoại trừ C-04 + M-05 cùng share `Toolbar.jsx`).

## Phase Status

| Phase | Description | Status | Effort |
|-------|-------------|--------|--------|
| [Phase 1](phase-01-critical-slide-index-color-palette.md) | Critical Fixes (C-02, C-04) | ✅ completed | 1.5h |
| [Phase 2](phase-02-high-priority-sidebar-scale-popup-click-emoji.md) | High Priority Fixes (H-01..H-05) | ✅ completed | 2h |
| [Phase 3](phase-03-medium-priority-ui-polish-fixes.md) | Medium Priority Fixes (M-01..M-08) | ✅ completed | 2.5h |
| [Phase 4](phase-04-tailwind-a11y-placeholder-scrollbar-roles.md) | Tailwind & A11y (T-01, T-04, A-02, A-03) | ✅ completed | 1.5h |
| [Phase 5](phase-05-verification-smoke-test.md) | Verification & Tests | ✅ completed | 0.5h |

## Key Dependencies

- C-04 (color palette) + M-05 (swatch border) both touch `Toolbar.jsx` — sequential, not parallel
- M-04 (undo/redo) cần verify editor API trước khi implement

## Skip List (Already Done / No Change Needed)

- [C-01] Custom CSS textarea dark theme — ALREADY FIXED
- [C-03] Lucide icon subset import — ALREADY FIXED
- [T-02] Input/Select bg consistency — No change needed (already consistent)
- [T-03] Naming inconsistency — No mismatch found

## Rollback Plan

Mỗi phase có thể rollback riêng bằng `git checkout -- <file>` vì tất cả fixes self-contained.
