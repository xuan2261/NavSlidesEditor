---
title: "Editor Ribbon Layout Hardening TDD"
description: "Harden EditorPage ribbon layout with tests-first gates, root-cause button fixes, compact grouping, responsive header polish, and browser verification."
status: complete
priority: P1
effort: 20-28h
branch: "master"
tags: [frontend, ui-ux, refactor, testing, tdd]
blockedBy: []
blocks: []
created: "2026-05-17T15:52:51.202Z"
createdBy: "ck-cli"
source: cli
---

# Editor Ribbon Layout Hardening TDD

## Overview

Fix EditorPage ribbon control clipping, hidden horizontal overflow, uneven alignment, and medium/narrow viewport pressure found in `plans/reports/ribbon-ui-review-260517-2235.md`.

Strategy: root-cause first, compact second. Add failing layout tests before each implementation phase. Preserve current editor commands, TipTap selection behavior, keyboard accessibility, and slide canvas fidelity.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Related history | [UI/UX Warm Editorial Overhaul](../260513-2243-ui-ux-warm-editorial-overhaul/plan.md) | complete |
| Related report | [Ribbon UI Review](../reports/ribbon-ui-review-260517-2235.md) | complete |

## Key Decisions

- Do not make ribbon multi-row in this plan.
- Keep `Button variant="icon"` strict icon-only.
- Add a new ribbon/icon+text button variant instead of overriding `icon` at call sites.
- Add compact dropdown/grouping only after root-cause button and sizing fixes.
- TDD gates use Vitest component tests plus Playwright/agent-browser visual metrics.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Baseline Visual Regression Tests](./phase-01-baseline-visual-regression-tests.md) | Complete |
| 2 | [Button Variant Root Cause Fix Plan](./phase-02-button-variant-root-cause-fix-plan.md) | Complete |
| 3 | [Ribbon Control Dimension Normalization](./phase-03-ribbon-control-dimension-normalization.md) | Complete |
| 4 | [Insert Tab Compact Grouping](./phase-04-insert-tab-compact-grouping.md) | Complete |
| 5 | [Home Text Editing Compact Controls](./phase-05-home-text-editing-compact-controls.md) | Complete |
| 6 | [Header Responsive Pressure Relief](./phase-06-header-responsive-pressure-relief.md) | Complete |
| 7 | [Full Browser Verification And Docs](./phase-07-full-browser-verification-and-docs.md) | Complete |

## Dependencies

- React 18, Vite 5, Tailwind utilities, Lucide icons.
- Existing E2E helpers: `tests/e2e/pages/EditorPage.js`, `tests/e2e/pages/RibbonInsertHelper.js`.
- Existing test suites: `client/src/components/ui/Button.test.js`, `client/src/components/ribbon/*test*`, `tests/e2e/editor.spec.js`, `tests/e2e/toolbar-elements.spec.js`.
- Verification commands: `npm run test -- --run`, targeted Playwright specs, `npm run build`, final `agent-browser` screenshots/metrics.

## Success Criteria

- No visible text is clipped inside icon-only buttons.
- Home, Insert, Design, Format, Transitions, Animations, View pass ribbon overflow metrics at 1280, 1024, 900, 768 px.
- Text-editing Home ribbon keeps TipTap mounted and exposes core formatting controls without hidden critical actions at 1280px.
- Format tab controls have consistent 28/32px vertical rhythm.
- Existing insertion/formatting E2E behavior still passes.

## Handoff

Cook command: `/ck:cook D:\NCKH_2025\NavSlidesEditor\plans\260517-2252-editor-ribbon-layout-hardening-tdd`
