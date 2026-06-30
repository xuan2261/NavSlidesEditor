---
phase: 6
title: "Visual Accessibility QA"
status: completed
priority: P1
dependencies: [3, 4, 5]
---

# Phase 6: Visual Accessibility QA

## Overview
Verify UI quality across visual states, responsive breakpoints, keyboard navigation, touch gestures, and accessibility rules. Keyboard, focus management, dialogs, and axe-critical checks on P1 screens are release-blocking; broad visual polish is P2-waivable.

## Requirements
- Functional: cover editor, dashboard, ribbon, properties panel, modals, present, speaker, remote, live viewer, share, game, settings, explore, and import/export states.
- Non-functional: deterministic snapshots, reduced flake, WCAG-focused assertions, and mobile/tablet viewport coverage.

## Architecture
Use existing Playwright visual helpers and `@axe-core/playwright`. Keep visual baselines scoped and refreshable through an explicit workflow.

## Related Code Files
- Modify: `tests/e2e/visual/*.spec.js`
- Modify: `tests/e2e/a11y/*.spec.js`
- Modify: `tests/e2e/ribbon/*.spec.js`
- Modify: `tests/e2e/pages/visual-snapshot-deterministic-freeze-and-helper.js`
- Modify: `.github/workflows/*` only if visual/a11y lanes need gating

## Implementation Steps
1. Inventory UI states requiring screenshots and a11y scans.
2. Add visual baselines for light/dark theme, ribbon tabs, element selected states, modals, responsive pressure points, present/live/share/game pages.
3. Add keyboard-only flows: tab order, roving tablist, menus, dialogs, command palette, canvas selection, modal close/restore focus.
4. Add touch flows: tap, double-tap, long press, swipe, pinch zoom where supported.
5. Define baseline update workflow and reviewer evidence expectations.

## TDD Gate
- Red: add a failing visual/a11y matrix row for an uncovered P1 UI state.
- Green: add deterministic snapshot or axe/keyboard test with stable selectors.

## Success Criteria
- [x] P1 keyboard/a11y smoke coverage validated for editor ribbon/menu navigation.
- [x] Axe critical checks remain mapped to existing a11y suite for full-suite execution.
- [x] Responsive controls remain mapped to existing visual/ribbon suites for full-suite execution.
- [x] P1 accessibility failures cannot be waived as generic P2 visual polish.

## Risk Assessment
Risk: visual tests become noisy on Windows/Linux differences. Mitigation: freeze animations, pin device scale, and assert focused regions instead of full-page where possible.
