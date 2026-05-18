---
title: 'UI/UX Warm Editorial Overhaul'
description: 'Apply DESIGN.md selectively to NavSlides editor shell, dashboard, modals, and control surfaces without changing slide canvas fidelity.'
status: complete
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

| Relationship    | Plan                                                                                                            | Status   |
| --------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Related history | [Tailwind UI/UX Review Remediation](../archive/2026-04/20260424-0619-tailwind-ui-ux-review-remediation/plan.md) | archived |
| Related history | [Fix UI/UX Regressions](../archive/2026-04/20260422-1304-fix-ui-ux-regressions/plan.md)                         | archived |

## Phases

| Phase | Name                                                                                                         | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| 1     | [Design Tokens And Theme Baseline](./phase-01-design-tokens-and-theme-baseline.md)                           | Complete    |
| 2     | [Shared UI Primitives](./phase-02-shared-ui-primitives.md)                                                   | Complete    |
| 3     | [Dashboard And Empty States](./phase-03-dashboard-and-empty-states.md)                                       | Complete    |
| 4     | [Modal Shell And Async Feedback](./phase-04-modal-shell-and-async-feedback.md)                               | Complete    |
| 5     | [Editor Chrome Toolbar And Insert Controls](./phase-05-editor-chrome-toolbar-and-insert-controls.md)         | Complete    |
| 6     | [Slide Panel And Properties Panel](./phase-06-slide-panel-and-properties-panel.md)                           | Complete    |
| 7     | [Responsive Accessibility And Motion Hardening](./phase-07-responsive-accessibility-and-motion-hardening.md) | Complete    |
| 8     | [Visual Regression Docs And Release Gate](./phase-08-visual-regression-docs-and-release-gate.md)             | Complete    |

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

## Progress Notes

- Phase 01 complete: warm tokens implemented with terracotta brand and separate blue focus/selection.
- Phase 02 complete: shared Button/Input/Select/ColorPicker primitives updated with stable focus states and no API changes.
- Phase 07 started: global reduced-motion baseline added.
- Phase 03 advanced: dashboard/header/empty/card states updated with warm tokens, keyboard activation, and import alert/status feedback.
- Phase 04 advanced: shared ModalShell added and migrated to Sync, History, Home create, and Home confirm dialogs.
- Phase 04 advanced: AI generator/copywriter/translate, share, media library, and template picker modals migrated to ModalShell.
- Phase 05 advanced: DropdownMenu, InsertMenu, and FindReplaceBar surfaces/feedback updated without command logic changes.
- Phase 06 advanced: CollapsibleSection and SlidePanel keyboard/focus/context states improved.
- Phase 05 advanced: toolbar accessible-name and active-state audit completed for editor chrome and rich-text controls.
- Phase 06 advanced: PropertiesPanel landmark and common high-use property controls updated with icon-backed actions.
- Phase 05 complete: targeted toolbar and keyboard shortcut e2e passed.
- Phase 06 complete: targeted properties panel e2e passed.
- Phase 08 complete: build, lint, unit, smoke/dashboard/visual e2e, docs sync, snapshot update, and final verification report done.
- 2026-05-14 modal-shell migration verification: targeted Vitest, lint, and production build passed.
- 2026-05-14 e2e release gate complete: smoke 1/1, dashboard 11/11, visual regression 1/1 after intended warm chrome snapshot update.
- 2026-05-14 Escape rerender regression fixed in shared modal close hook; targeted Vitest now passes 7 files / 22 tests.
- 2026-05-14 responsive/accessibility gate complete: keyboard shortcuts, narrow viewport animation modal, and coverage-gaps responsive smoke passed 10/10.
- 2026-05-14 EditorPage POM modal waits updated to role-based dialog locators; Sync/History modal e2e passed 1/1.

## Unresolved Questions

- Should dashboard headings use already-imported serif fonts or Georgia fallback to avoid extra network cost?
