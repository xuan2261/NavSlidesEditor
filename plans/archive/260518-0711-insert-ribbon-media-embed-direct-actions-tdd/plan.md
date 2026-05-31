---
title: "Insert Ribbon Media Embed Direct Actions TDD"
description: "Refine Insert ribbon UX by making Media and Embed actions direct while preserving 1280px layout gates and Advanced grouping."
status: complete
priority: P1
effort: 14-20h
branch: master
tags: [frontend, ui-ux, refactor, testing, tdd]
blockedBy: []
blocks: []
created: 2026-05-18
---

# Insert Ribbon Media Embed Direct Actions TDD

## Overview

Fix the Insert ribbon UX regression introduced by compact grouping: `Media` and `Embed` actions are currently hidden behind small dropdowns, slowing element insertion and making menus feel cramped. Keep layout hardening from the previous plan, but expose common Media/Embed element actions as direct icon-only ribbon buttons. Keep `Advanced` grouped, but use a wider flyout/palette.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Builds on | [Editor Ribbon Layout Hardening TDD](../260517-2252-editor-ribbon-layout-hardening-tdd/plan.md) | complete |
| Related report | [Final Verification Report](../260517-2252-editor-ribbon-layout-hardening-tdd/reports/final-verification-report.md) | complete |

## Key Decisions

- Do not reintroduce text labels for Media/Embed buttons; use icon-only with `title` and `aria-label`.
- Do not add a complex breakpoint state machine. Pass 1280px without overflow; smaller viewports may scroll cleanly.
- Do not use focus trap for `Advanced`; it is a menu/flyout, not modal. Require keyboard reachability, Escape close, click-outside close, focus restore.
- Keep trusted author content policy unchanged for HTML/SVG/media.
- Keep file edits scoped to existing ribbon/tests/docs; no new external package.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [TDD Baseline And Layout Budget](./phase-01-tdd-baseline-and-layout-budget.md) | Complete |
| 2 | [Media Direct Action Buttons](./phase-02-media-direct-action-buttons.md) | Complete |
| 3 | [Embed Direct Action Buttons](./phase-03-embed-direct-action-buttons.md) | Complete |
| 4 | [Advanced Flyout Hardening](./phase-04-advanced-flyout-hardening.md) | Complete |
| 5 | [E2E Helper And Regression Updates](./phase-05-e2e-helper-and-regression-updates.md) | Complete |
| 6 | [Final Verification And Docs](./phase-06-final-verification-and-docs.md) | Complete |

## Dependencies

- React/Vite client in `client/src/components/ribbon`.
- Existing Button variants: `icon` for icon-only, `ribbon` for icon+text.
- Existing Playwright helpers: `tests/e2e/pages/EditorPage.js`, `tests/e2e/pages/RibbonInsertHelper.js`.
- Existing E2E specs: `ribbon-layout.spec.js`, `coverage-gaps.spec.js`, `toolbar-elements.spec.js`, `games/game-elements.spec.js`.

## Success Criteria

- At 1280px Insert tab has no horizontal overflow and no clipped/overlapping controls.
- Media actions are direct buttons: Video URL, Audio/Upload, Media Library, conditional File Browser.
- Embed actions are direct buttons: HTML Embed, SVG File, Drawing Canvas, Divider.
- `Advanced` opens a wider keyboard-accessible flyout/palette, not the cramped 140px dropdown.
- All existing insertion flows still pass through `RibbonInsertHelper`.
- Docs/changelog updated with actual behavior and verification results.

## Handoff

Cook command: `/ck:cook --tdd D:\NCKH_2025\NavSlidesEditor\plans\260518-0711-insert-ribbon-media-embed-direct-actions-tdd\plan.md`
