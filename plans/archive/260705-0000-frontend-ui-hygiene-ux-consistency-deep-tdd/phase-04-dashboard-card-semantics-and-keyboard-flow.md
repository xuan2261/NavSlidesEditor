---
phase: 4
title: "Dashboard Card Semantics And Keyboard Flow"
status: pending
priority: P1
dependencies: [1, 2]
---

# Phase 4: Dashboard Card Semantics And Keyboard Flow

## Overview

Fix dashboard card interaction semantics so open actions and item action buttons are separate, accessible, and keyboard-friendly.

## Requirements

- Functional: presentation/template cards remain easy to open, edit, duplicate, delete, restore, and permanently delete.
- Non-functional: no nested interactive roles; keyboard order matches visual order; no regression in grid/list layouts.

## Architecture

Refactor card markup to use one main card action surface plus a sibling action toolbar. Use native `button` or `a` where possible instead of `div role="button"`. Keep action buttons outside the main open button and stop relying on event propagation cancellation as the primary behavior boundary. Each card must have a non-ambiguous accessible name for the open affordance and distinct names for toolbar actions.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Possibly create: small dashboard card component if it reduces repeated markup without broad rewrite.
- Test: `client/src/pages/home-dashboard-card-semantics.test.jsx`
- Existing: `client/src/pages/home-editor-responsive-source.test.js`
- E2E: `tests/e2e/dashboard.spec.js`
- E2E: `tests/e2e/a11y/dashboard-card-semantics.spec.js`
- E2E: `tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js`

## Implementation Steps

1. Re-read latest `HomePage.jsx` before editing because it has been externally modified during this session.
2. Confirm Phase 1 dashboard semantics test fails on nested interactive structures.
3. Refactor one card family at a time:
   - New presentation tile.
   - Built-in template cards.
   - My templates cards.
   - Presentation grid cards.
   - Trash cards.
   - List-view title/open controls.
4. Preserve `data-testid` attributes and existing handler contracts where tests depend on them.
5. Ensure `Enter` and `Space` open main card actions and action buttons remain separately reachable.
6. Add assertions that toolbar actions (`Edit`, `Duplicate`, `Delete`, `Restore`, permanent delete) do not call the open handler.
7. Verify tab order goes from the open affordance to toolbar actions in visual order.
8. Run axe/keyboard checks at desktop and narrow dashboard layouts.

## Tests And Verification

```bash
npx vitest run client/src/pages/home-dashboard-card-semantics.test.jsx client/src/pages/home-editor-responsive-source.test.js
npx playwright test tests/e2e/dashboard.spec.js tests/e2e/a11y/dashboard-card-semantics.spec.js
npx playwright test tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js
```

## Success Criteria

- [ ] No dashboard card contains action buttons inside a `role="button"` container.
- [ ] Grid and list cards remain operable by mouse and keyboard.
- [ ] Edit/duplicate/delete/restore actions do not accidentally open the presentation.
- [ ] `Enter` and `Space` on the open affordance open only the selected item.
- [ ] `Enter` and `Space` on toolbar buttons trigger only their own action.
- [ ] Card and toolbar accessible names are specific and not duplicated ambiguously.
- [ ] Mobile dashboard horizontal scroll behavior does not regress.

## Risk Assessment

- Risk: HomePage is large and active. Mitigation: re-read before editing, split refactor into small card families, preserve tests.
- Risk: changing markup breaks CSS hover group behavior. Mitigation: verify grid/list visuals in Playwright.
