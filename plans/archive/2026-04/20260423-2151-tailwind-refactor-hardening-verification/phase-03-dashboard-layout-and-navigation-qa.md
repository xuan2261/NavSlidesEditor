---
phase: 3
title: "Dashboard Layout And Navigation QA"
status: completed
priority: P1
effort: "1 day"
dependencies: [1, 2]
---

# Phase 3: Dashboard Layout And Navigation QA

## Overview

Verify all non-editor navigation surfaces after the Tailwind/refactor changes: home, all presentations, explore, settings, template gallery/preview, routing to editor, and empty/error states.

This phase explicitly re-tests the previously reported bug path: clicking a presentation from All Presentations must open `EditorPage` with content, not `Presentation not found. Go back`.

## Requirements

- Dashboard cards and lists must be usable on desktop/tablet/mobile.
- Presentation navigation must pass correct IDs through routes and stores.
- Loading/empty/error states must be styled and actionable.
- Template preview deletion/move must not leave broken imports or routes.
- Version display should stay aligned with `v1.6.0`.

## Architecture

Primary route flow:

Dashboard route -> presentation/template card -> router navigation -> editor loader/store -> `EditorPage`.

Dashboard UI must remain independent from editor internals except route IDs and shared presentation metadata.

## Related Code Files

- `client/src/pages/HomePage.jsx`
- `client/src/pages/ExplorePage.jsx`
- `client/src/pages/SettingsPage.jsx`
- `client/src/pages/EditorPage.jsx`
- `client/src/components/dashboard/TemplateGallery.jsx`
- `client/src/components/dashboard/TemplatePreview.jsx` or replacement imports
- `client/src/components/layout/StatusBar.jsx`
- `tests/e2e/dashboard.spec.js`
- `tests/e2e/explore.spec.js`
- `tests/e2e/settings.spec.js`
- `tests/e2e/templates.spec.js`
- `tests/e2e/smoke.spec.js`

## Implementation Steps

1. Reconcile any deleted/moved dashboard component imports.
2. Validate dashboard route state and presentation ID handling.
3. Check All Presentations card actions:
   - Open.
   - Duplicate if present.
   - Delete/trash if present.
   - Empty state when no presentations.
4. Verify template gallery/preview:
   - Search/filter.
   - Open preview.
   - Create from template.
   - Back/close behavior.
5. Verify Settings:
   - Form controls render correctly.
   - Persisted options do not break Tailwind class state.
6. Confirm all dashboard responsive layouts:
   - No horizontal scroll from controls.
   - Cards do not nest as fake sections.
   - Text truncates or wraps cleanly.
7. Add regression test for All Presentations -> Editor when missing.

## Verification & Tests

- `npx playwright test tests/e2e/dashboard.spec.js`
- `npx playwright test tests/e2e/explore.spec.js`
- `npx playwright test tests/e2e/settings.spec.js`
- `npx playwright test tests/e2e/templates.spec.js`
- `npx playwright test tests/e2e/smoke.spec.js`
- Manual/browser checks:
  - Open existing presentation from All Presentations.
  - Refresh editor URL after navigation.
  - Navigate back to dashboard and reopen same item.
  - Create presentation from template and verify editor content exists.
  - Empty dashboard state with no overlap/clipping.
- Capture screenshots at 1440x900, 1024x768, 390x844.

## Success Criteria

- [ ] All dashboard E2E specs pass.
- [ ] All Presentations -> Editor route always resolves an existing presentation object.
- [ ] Template actions have no broken imports after refactor.
- [ ] Dashboard UI has no clipped text, overlapped controls, or inaccessible actions on mobile.

## Risk Assessment

- Risk: stale client storage contains IDs that no longer exist. Mitigation: error state offers safe recovery and tests cover missing presentation route.
- Risk: template preview deletion leaves dead route references. Mitigation: `rg "TemplatePreview"` and E2E template flow.
- Risk: mobile dashboard hides primary action. Mitigation: viewport matrix screenshots.

## Security Considerations

- Presentation/template names rendered in dashboard must remain text-safe.
- Settings inputs must not persist executable HTML into global config.

## Todo List

- [ ] Presentation open regression covered.
- [ ] Dashboard route screenshots captured.
- [ ] Template imports reconciled.
- [ ] E2E dashboard group passes.

## Next Steps

Proceed to Phase 4 when dashboard navigation into editor is stable.
