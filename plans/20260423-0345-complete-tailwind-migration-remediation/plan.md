---
title: 'Complete Tailwind Migration Remediation'
description: 'Hoàn thiện 25-30% migration còn thiếu: fix undefined CSS vars, scope important flag, migrate 6 unmigrated files, clean hardcoded colors, fix layout bugs, optimize bundle.'
status: pending
priority: P1
tags: ['tailwind', 'css', 'remediation', 'bugfix', 'ui']
blockedBy: ['20260421-1920-tailwind-full-migration', '20260422-2230-fix-post-tailwind-css-audit']
blocks: []
created: '2026-04-23T03:45:00.000Z'
createdBy: 'ck:plan'
source: skill
---

# Complete Tailwind Migration Remediation

## Overview

Migration hiện tại đạt **70-75%** (dù plan gốc đánh dấu "Completed"). Plan này hoàn tất phần còn lại dựa trên [Code Review Report](file:///C:/Users/Z10PAD8C_Xuan2261/.gemini/antigravity/brain/bae08055-5067-410e-ba9c-c9d97fc63824/code_review_report.md).

**Source**: Adversarial Code Review — 3 Critical, 4 Major, 6 Medium issues.

## Phases

| Phase | Name | Status | Priority | Effort | Issues Covered |
|-------|------|--------|----------|--------|----------------|
| 1 | [Fix Critical CSS Variables](./phase-01-fix-critical-css-variables.md) | Pending | P1 🔴 | 20 min | C2, C3 |
| 2 | [Scope Important Flag & Preflight](./phase-02-scope-important-flag.md) | Pending | P1 🔴 | 45 min | C1, W1 |
| 3 | [Migrate Unmigrated Pages](./phase-03-migrate-unmigrated-pages.md) | Pending | P1 🟠 | 2 hrs | M1 (SettingsPage, ExplorePage) |
| 4 | [Migrate Unmigrated Modals](./phase-04-migrate-unmigrated-modals.md) | Pending | P1 🟠 | 2 hrs | M1 (LivePresentationModal, AnalyticsModal, TemplateGallery, TemplatePreview) |
| 5 | [Fix Hybrid Styles & Hardcoded Colors](./phase-05-fix-hybrid-styles.md) | Pending | P2 🟡 | 1 hr | M4, W2, W4, W5 |
| 6 | [Cleanup & Bundle Optimization](./phase-06-cleanup-and-bundle.md) | Pending | P3 🟢 | 45 min | W3, W6 |
| 7 | [Verification & Regression Testing](./phase-07-verification-and-testing.md) | Pending | P1 🔴 | 1 hr | All |

## Dependencies

- `blockedBy: [20260421-1920-tailwind-full-migration]` (completed)
- `blockedBy: [20260422-2230-fix-post-tailwind-css-audit]` (completed)
- Phase 2 depends on Phase 1 (CSS vars must be valid before removing `!important`)
- Phase 3-4 depend on Phase 2 (important scoping affects utility class behavior)
- Phase 5 depends on Phase 3-4 (hybrid cleanup on migrated files)
- Phase 7 depends on Phase 1-6

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Removing `important: true` breaks existing Tailwind classes | High | Scope to `#root` instead of removing. Test each component area. |
| SettingsPage migration changes form field behavior | Medium | Preserve `fieldStyle` as Tailwind class string, verify select/input |
| TemplateGallery 647-line migration is error-prone | Medium | Migrate section-by-section, verify after each section |
| Bundle splitting breaks lazy-loaded routes | Low | Only add `manualChunks`, don't restructure imports |
| Dark/Light theme switching regression | Medium | Browser test both themes after each phase |
