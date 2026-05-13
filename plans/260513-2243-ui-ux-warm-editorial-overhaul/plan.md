---
title: "UI/UX Warm Editorial Overhaul"
description: "Apply DESIGN.md selectively to NavSlides editor shell, dashboard, modals, and control surfaces without changing slide canvas fidelity."
status: pending
priority: P1
effort: 42h
issue:
branch: master
tags: [feature, frontend, ui-ux, accessibility, tech-debt]
blockedBy: []
blocks: []
created: 2026-05-13
---

# UI/UX Warm Editorial Overhaul

## Overview

Make NavSlides easier to read, easier to operate, and visually closer to `DESIGN.md`. Scope is app chrome only: dashboard, editor shell, shared controls, modals, panels, onboarding/feedback states. Preserve slide canvas output fidelity.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Related history | [Tailwind UI/UX Review Remediation](../archive/2026-04/20260424-0619-tailwind-ui-ux-review-remediation/plan.md) | archived |
| Related history | [Fix UI/UX Regressions](../archive/2026-04/20260422-1304-fix-ui-ux-regressions/plan.md) | archived |

## Phases

| Phase | Name | Status |
| --- | --- | --- |
| 1 | [Design Tokens And Theme Baseline](./phase-01-design-tokens-and-theme-baseline.md) | Pending |
| 2 | [Shared UI Primitives](./phase-02-shared-ui-primitives.md) | Pending |
| 3 | [Dashboard And Empty States](./phase-03-dashboard-and-empty-states.md) | Pending |
| 4 | [Modal Shell And Async Feedback](./phase-04-modal-shell-and-async-feedback.md) | Pending |
| 5 | [Editor Chrome Toolbar And Insert Controls](./phase-05-editor-chrome-toolbar-and-insert-controls.md) | Pending |
| 6 | [Slide Panel And Properties Panel](./phase-06-slide-panel-and-properties-panel.md) | Pending |
| 7 | [Responsive Accessibility And Motion Hardening](./phase-07-responsive-accessibility-and-motion-hardening.md) | Pending |
| 8 | [Visual Regression Docs And Release Gate](./phase-08-visual-regression-docs-and-release-gate.md) | Pending |

## Key Decisions

- Apply warm editorial style to product UI, not authored slide content.
- Keep Inter/system UI for dense controls. Use serif only for dashboard hero/empty states and marketing-like headings.
- Use semantic CSS variables and shared components first. Avoid one-off hardcoded styling.
- Keep accessibility higher priority than brand mimicry.

## Dependencies

- React 18 + Vite 5 + Tailwind 3.
- Existing CSS token layer in `client/src/index.css`.
- Existing shared primitives in `client/src/components/ui/`.
- Existing Playwright visual/e2e tests.

## Success Criteria

- Light/dark themes both readable and visually coherent.
- All high-use controls have visible hover, active, disabled, and focus states.
- No canvas/export fidelity regressions.
- No new syntax/build errors.
- Core e2e and visual checks pass.

## Cook Handoff

Run implementation with:

```powershell
/ck:cook D:\NCKH_2025\NavSlidesEditor\plans\260513-2243-ui-ux-warm-editorial-overhaul
```

## Unresolved Questions

- Should the product accent be full terracotta `#c96442`, or a hybrid keeping blue for technical selection/focus?
- Should dashboard headings load an external serif font, or use Georgia fallback to avoid extra network cost?
