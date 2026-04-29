---
title: 'Fix Post-Tailwind CSS Audit Issues'
description: 'Fix orphaned CSS classes, invalid Tailwind tokens, inline styles, and spin animation inconsistencies discovered in comprehensive post-migration audit.'
status: completed
priority: P1
tags: ['tailwind', 'css', 'bugfix', 'ui']
blockedBy: ['20260421-1920-tailwind-full-migration']
blocks: []
created: '2026-04-22T15:30:00.000Z'
createdBy: 'ck:plan'
source: skill
---

# Fix Post-Tailwind CSS Audit Issues

## Overview

Comprehensive fix for **6 categories of issues** discovered during post-Tailwind-migration code audit + visual browser inspection. Key problems: 7 orphaned CSS classes causing invisible UI elements, `text-primary` token bug affecting ~26 input fields, 3 unmigrated components with 100% inline styles, and `spin` vs `animate-spin` inconsistency.

**Source:** [Comprehensive Audit Report](file:///C:/Users/Z10PAD8C_Xuan2261/.gemini/antigravity/brain/c8823642-9836-424f-aaff-cc9ed8c29128/implementation_plan.md)

## Phases

| Phase | Name | Status | Priority | Files |
|-------|------|--------|----------|-------|
| 1 | [Fix Orphaned CSS Classes & Spin Animation](./phase-01-fix-orphaned-css-and-spin.md) | ✅ Done | P1-Critical | 4 files |
| 2 | [Fix Invalid Tailwind Tokens](./phase-02-fix-invalid-tailwind-tokens.md) | ✅ Done | P1-Critical | 9 files |
| 3 | [Convert PromptPopover to Tailwind](./phase-03-convert-prompt-popover.md) | ✅ Done | P2 | 1 file |
| 4 | [Convert Inline Styles — SlideSorterView & TransitionPreview](./phase-04-convert-inline-styles-components.md) | ✅ Done | P2 | 2 files |
| 5 | [Migrate RemoteControlPage to Tailwind](./phase-05-migrate-remote-control-page.md) | ✅ Done | P2 | 1 file |
| 6 | [Verification & Visual Regression Testing](./phase-06-verification-and-testing.md) | ✅ Done | P1 | All |

## Dependencies

- `blockedBy: [20260421-1920-tailwind-full-migration]` (completed)
- `blockedBy: [20260422-1643-fix-tailwind-migration-regressions]` (completed)
- Phase 6 depends on Phase 1-5

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| `text-primary` → `text-text-primary` may affect non-properties files | Medium | Only apply in properties/ directory with `AllowMultiple` |
| RemoteControlPage full rewrite | Low | Isolated page, no shared components |
| PromptPopover styling may break positioning | Low | Keep `style` prop for dynamic positioning |
| `qat-dot` sizing may not match original | Low | Use 8x8px accent circle — consistent with save indicators |
