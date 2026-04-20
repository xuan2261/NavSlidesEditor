# Phase 4: Setup Testing

## Overview

- Priority: High
- Current status: Pending
- Description: Setup Vitest for unit testing HTML generation logic, and Playwright for End-to-End smoke testing of the editor application to tackle technical debt.

## Related Code Files

- `[MODIFY] package.json`
- `[NEW] vitest.workspace.ts`
- `[NEW] shared/tests/htmlGenerator.test.js`
- `[NEW] playwright.config.js`
- `[NEW] tests/e2e/smoke.spec.js`

## Implementation Steps

1. Run `npm i -D vitest @playwright/test` at root.
2. Initialize Vitest config to test `shared/**/*.test.js`.
3. Write `shared/tests/htmlGenerator.test.js` to assert `generateRevealHTML` output matches basic string matching templates.
4. Setup `playwright.config.js`.
5. Create `tests/e2e/smoke.spec.js` mapped to visit `localhost:5173`, create a slide, assert elements exist.
6. Add `"test": "vitest run"` and `"test:e2e": "playwright test"` to package.json.

## Success Criteria

- `npm run test` executes successfully and passes `shared` package logic tests.
- E2E smoke tests can run standalone or in CI efficiently.
