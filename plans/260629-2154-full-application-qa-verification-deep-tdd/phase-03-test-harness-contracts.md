---
phase: 3
title: "Test Harness Contracts"
status: completed
priority: P1
dependencies: [2]
---

# Phase 3: Test Harness Contracts

## Overview
Harden reusable test infrastructure so broad verification stays deterministic, maintainable, and not selector-fragile.

## Requirements
- Functional: provide stable fixtures, seeded presentations, API builders, page objects, selector contracts, visual freeze helpers, and mock external services.
- Non-functional: avoid arbitrary waits, isolate tests, support parallel Playwright workers, and keep helper files focused.

## Architecture
Centralize user-flow helpers under `tests/e2e/pages/` and API/fixture helpers under `tests/e2e/fixtures/` or `tests/e2e/helpers/`. Enforce `data-testid` contracts through unit tests.

## Related Code Files
- Modify: `tests/e2e/pages/editor-page.js`
- Modify: `tests/e2e/pages/canvas-helper.js`
- Modify: `tests/e2e/pages/properties-panel-helper.js`
- Modify: `tests/e2e/pages/ribbon-tab-toolbar-helper.js`
- Modify: `tests/e2e/fixtures/test-fixtures.js`
- Modify: `tests/unit/data-testid-presence.test.js`
- Read: `playwright.config.js`

## Implementation Steps
1. Audit existing helpers for duplication, waits, hidden state coupling, and missing cleanup.
2. Add fixture builders for all 19 element types, vertical slides, templates, live rooms, game rooms, share tokens, and media.
3. Add selector contract rows for every high-risk control and modal.
4. Add deterministic visual freeze and clock/network mocking defaults.
5. Add helper-level unit tests where helpers encode non-trivial contracts.

## TDD Gate
- Red: add selector/fixture contract tests for missing helpers.
- Green: implement helpers until unit and focused Playwright smoke tests pass.

## Success Criteria
- [x] No new E2E spec needs raw app setup boilerplate for the selectors added in this phase.
- [x] No new test uses `waitForTimeout`.
- [x] Every newly expanded P1/P2 control surface in this phase has a stable selector contract.

## Risk Assessment
Risk: helper abstraction hides user intent. Mitigation: helpers expose domain actions (`insertElement`, `setProperty`, `expectPersisted`) not implementation details.
