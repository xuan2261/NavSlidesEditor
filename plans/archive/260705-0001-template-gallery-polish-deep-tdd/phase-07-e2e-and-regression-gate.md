---
phase: 7
title: "E2E and regression gate"
status: pending
priority: P2
dependencies: [4, 5, 6]
---

# Phase 07: E2E and regression gate

## Overview

Validate full user workflows after unit/integration phases are complete. This phase proves the refactor did not break real template usage.

## Requirements

- Functional: Users can open built-in gallery, filter templates, preview a template, create from template, view My Templates, and create a custom template.
- Non-functional: E2E selectors should be resilient, role/text based where practical.

## Architecture

Extend existing Playwright coverage in `tests/e2e/templates.spec.js` and page helpers only if needed. Do not add broad E2E coverage for every category; focus on one or two representative flows.

## Related Code Files

- Modify: `tests/e2e/templates.spec.js`
- Modify if needed: `tests/e2e/pages/home-page.js`
- Read: `client/src/components/dashboard/TemplateGallery.jsx`
- Read: `client/src/components/dashboard/TemplatePreview.jsx`

## TDD Steps

1. Add/adjust E2E test for marketplace card loading.
2. Add E2E test for marketplace category filter that matches a tag category.
3. Add E2E test for preview modal open/close.
4. Add E2E test for create-from-template path. If an existing test already covers it, update it to use stable selectors. If skipped, document the exact reason in implementation notes.

## Implementation Steps

1. Update selectors to prefer roles and visible labels.
2. Avoid brittle `.bg-card.group` selectors if UI refactor removed those classes.
3. Ensure tests wait for real loading completion, not only container visibility.
4. Run focused E2E before full unit suite.

## Success Criteria

- [ ] Focused E2E passes:

```powershell
npx playwright test tests/e2e/templates.spec.js
```

- [ ] Full unit suite passes:

```powershell
npm run test
```

- [ ] Lint passes:

```powershell
npm run lint -- --quiet
```

- [ ] No unrelated files are modified by the implementation.
- [ ] Create-from-template is covered by Playwright or has a written, explicit skip reason.

## Risk Assessment

Risk: E2E adds flakiness around async template loading.  
Mitigation: add explicit loading/empty states and wait for stable visible template card text.
