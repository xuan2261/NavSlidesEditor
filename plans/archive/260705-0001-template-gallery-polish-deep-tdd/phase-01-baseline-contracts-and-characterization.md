---
phase: 1
title: "Baseline contracts and characterization"
status: pending
priority: P1
dependencies: []
---

# Phase 01: Baseline contracts and characterization

## Overview

Lock existing TemplateGallery, TemplatePreview, TemplatePicker, and backend template behavior before refactoring. This phase should add tests only, except for tiny testability exports if absolutely necessary.

## Requirements

- Functional: Existing template selection, search, category/tag filtering, favorites, preview insert, and custom template API flows remain unchanged.
- Non-functional: Tests must be deterministic, fast, and independent of real network state.

## Architecture

Use Vitest + React Testing Library for frontend characterization and Supertest for backend contract characterization. Mock `/api/marketplace/templates` in component tests. Avoid Playwright until later phases.

## Related Code Files

- Modify: `client/src/components/dashboard/TemplateGallery.test.jsx`
- Modify: `client/src/utils/template-filters.test.js`
- Modify: `server/routes/marketplace.test.js`
- Modify: `server/routes/templates.test.js`
- Modify: `server/routes/presentations.test.js`
- Read: `tests/e2e/templates.spec.js`

## TDD Steps

1. Add/confirm tests for category matching when category is stored in `tags`.
2. Add tests for search matching `title`, `titleVi`, `description`, and `tags`.
3. Add tests for missing optional metadata not crashing UI.
4. Add tests for favorite toggle persistence in `localStorage`.
5. Add tests for card click calling `onSelectTemplate`.
6. Add backend tests for marketplace query forms:
   - `?category=interactive`
   - `?tags=a,b`
   - `?tags=a&tags=b`
7. Add tests for custom template create/update validation edge cases.

## Implementation Steps

1. Write tests first and run focused suite.
2. Confirm tests pass against current behavior.
3. If a test reveals an already-known defect, do not refactor yet, patch minimally or move to the relevant phase.

## Success Criteria

- [ ] Characterization tests cover current gallery and template API behavior.
- [ ] No component refactor happens before tests are green.
- [ ] Focused command passes:

```powershell
npx vitest run client/src/components/dashboard/TemplateGallery.test.jsx client/src/utils/template-filters.test.js server/routes/marketplace.test.js server/routes/templates.test.js server/routes/presentations.test.js
```

## Risk Assessment

Risk: tests become too implementation-specific and block safe refactor.  
Mitigation: assert public behavior only: visible text, calls, API responses, persisted favorite ids.
