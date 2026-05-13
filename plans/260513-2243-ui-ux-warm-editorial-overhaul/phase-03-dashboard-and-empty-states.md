# Phase 03 - Dashboard And Empty States

## Context Links

- [Plan](./plan.md)
- `client/src/pages/HomePage.jsx`
- `client/src/pages/ExplorePage.jsx`
- `client/src/components/dashboard/TemplateGallery.jsx`
- `client/src/components/dashboard/TemplatePreview.jsx`

## Overview

- Priority: P1
- Status: Complete
- Effort: 7h
- Goal: make first screen clearer, warmer, and faster to operate.

## Key Insights

- Dashboard has highest perceived quality impact.
- Current gradient logo/hero conflicts with `DESIGN.md`.
- Empty states can use editorial style without reducing editor density.

## Requirements

- Functional:
  - Preserve create/import/open/template flows.
  - Keep search, sort, grid/list behavior.
  - Improve empty, loading, error/import-warning states.
  - Replace generic indigo-purple brand mark with warm tokenized mark.
- Non-functional:
  - No horizontal overflow at 375px.
  - Cards reserve thumbnail space.
  - Hover cannot rely on vertical jump only.

## Architecture

Dashboard remains one page. Refactor only if needed for readability:

```text
HomePage
  header/search/actions
  sidebar nav
  content states
  cards/list
  create/confirm modals
```

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/pages/ExplorePage.jsx`
- Optional modify: `client/src/components/dashboard/TemplateGallery.jsx`
- Optional modify: `client/src/components/dashboard/TemplatePreview.jsx`
- Tests: `tests/e2e/dashboard.spec.js`, `tests/e2e/templates.spec.js`, `tests/e2e/visual-regression.spec.js`

## Implementation Steps

1. Replace dashboard shell colors with token classes.
2. Update brand mark and title hierarchy.
3. Improve empty state:
   - one clear primary CTA.
   - secondary template CTA.
   - concise feature line.
4. Update card hover:
   - border/ring/elevation.
   - remove unnecessary `transition-all`.
5. Add loading skeleton for presentations/templates if fetch > initial render.
6. Ensure import warnings have `role="alert"` or `aria-live`.
7. Check grid/list actions remain keyboard reachable.

## Todo List

- [x] Update dashboard header and sidebar styling.
- [x] Update empty states.
- [x] Update cards/list rows.
- [x] Improve loading/import warning feedback.
- [x] Run dashboard and template tests.

## Verify / Tests

- `npm run test:e2e -- tests/e2e/dashboard.spec.js`
- `npm run test:e2e -- tests/e2e/templates.spec.js`
- `npm run test:e2e -- tests/e2e/visual-regression.spec.js`
- Manual: 375x812 dashboard, 1024x768, 1440x900.
- Manual: create presentation, duplicate, trash, restore.

## Success Criteria

- Dashboard looks intentional in light/dark.
- Primary actions easier to find.
- Empty/loading/error states are clear.
- No broken flows.

## Risk Assessment

- Risk: HomePage is large and easy to regress.
- Mitigation: small commits by section, test after each section.

## Security Considerations

- Preserve import validation and warning behavior.
- No change to file parsing logic.

## Next Steps

- Phase 04 modal shell.

## Implementation Notes

- Replaced indigo-purple dashboard marks with warm brand/token styling.
- Replaced layout-shifting card hover movement with border/ring/elevation states.
- Added keyboard activation to dashboard cards and the new-presentation tile.
- Added `role="status"` / `role="alert"` to import progress and warnings.
- Targeted unit tests, lint, and production build passed.
- `npm run test:e2e -- tests/e2e/dashboard.spec.js` passed on 2026-05-14: 11/11.
- `npm run test:e2e -- tests/e2e/visual-regression.spec.js` passed on 2026-05-14: 1/1.

## Unresolved Questions

- Whether dashboard copy should be fully English as current UI, or Vietnamese localized later.
