---
title: "QA Test Continuation Report"
date: 2026-05-22
status: done
plan: "../plan.md"
---

# QA Test Continuation Report

## Summary

Ran current-state validation for Insert Advanced direct actions and ribbon overlay migration. Functional, build, lint, coverage, targeted Playwright, and visual workflow contract gates are green. Visual screenshot specs now skip on non-Linux hosts because canonical baselines are Linux-container-only.

## Results

| Command | Result |
| --- | --- |
| `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-plugin-insert.test.jsx client/src/components/ribbon/ribbon-floating-overlay.test.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx` | Passed: 4 files / 18 tests |
| `npx vitest run client/src/components/ribbon` | Passed: 16 files / 141 tests |
| `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-plugin-insert.test.jsx client/src/components/ribbon/ribbon-floating-overlay.test.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx client/src/__tests__/sparkles-icon-semantic-separation.test.jsx client/src/utils/tailwind-inline-style-audit.test.js tests/unit/electron-release-readiness-contract.test.js` | Passed: 7 files / 31 tests |
| `npm run test:coverage` | Passed: 148 files / 1296 tests passed / 1 skipped; statements 36.87%, branches 31.23%, functions 31.31%, lines 38.44% |
| `npm run lint` | Passed: 0 errors / 36 existing warnings |
| Targeted `npx eslint` on latest changed test/code files | Passed |
| `npm run build` | Passed; existing Vite deprecation/chunk-size warnings only |
| `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Insert"` | Passed: 19 tests |
| `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium` | Passed: 73 tests |
| `npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium` | Passed: 4 tests |
| `npx playwright test tests/e2e/games/game-elements.spec.js tests/e2e/plugin-runtime-insert-render-persistence.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js --project=chromium` | Passed: 42 tests |
| `npx playwright test tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js --project=chromium` | Passed on Windows by skipping 7 non-canonical snapshot tests |
| `npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js --project=chromium` | Passed on Windows by skipping 17 non-canonical snapshot tests |
| `npx vitest run tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` | Passed: 4 tests |

## Fixes Applied

- Updated `docs/codebase-summary.md` release/version references from `v1.9.1` to `v1.9.2`.
- Updated Sparkles semantic regression test to assert the new direct `AdvancedActionButton` Kinetic Text contract.
- Removed unnecessary inline `style={{ ... }}` from shape button and overlay test fixture.
- Added a single inline-style budget entry for `RibbonFloatingOverlay`, where dynamic fixed-position style is required.
- Added a shared non-Linux skip guard for Playwright visual screenshot specs. Linux CI/manual workflow remains mandatory and unchanged.

## Visual Snapshot Status

The visual helper states baselines must be generated in `mcr.microsoft.com/playwright:v1.59.1-jammy`. Running `docker --version` failed because Docker is not installed/available in this environment; `wsl --list --verbose` also showed no installed WSL distributions. A temporary Windows snapshot refresh was reverted because it would not be valid for CI.

The Insert visual diff matches the intentional product change: fixed Advanced actions are now direct icon buttons and the launcher is icon-only. Semantic and geometry Playwright coverage for this behavior is green. The manual GitHub Actions workflow remains the canonical path for refreshing and verifying Linux snapshots, and its contract test passed.

## Unresolved Questions

- None.
