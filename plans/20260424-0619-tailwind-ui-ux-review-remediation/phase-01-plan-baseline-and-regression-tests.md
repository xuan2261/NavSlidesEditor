---
phase: 1
title: "Plan Baseline And Regression Tests"
status: complete
priority: P1
effort: "1h"
dependencies: []
---

# Phase 01: Plan Baseline And Regression Tests

## Context Links

- `plans/reports/code-review-20260424-tailwind-ui-ux.md`
- `client/src/components/ui/Button.test.js`
- `client/src/components/AnimationPreviewModal.test.jsx`
- `client/src/utils/export-project.js`

## Overview

Translate review findings into executable regression checks before or alongside the fixes.

## Requirements

- Functional: cover secondary Button border policy, modal semantics, export partial-media behavior.
- Non-functional: keep tests focused and deterministic.

## Architecture

Use existing Vitest tests for component/helper checks and one focused Playwright spec for browser-only modal behavior.

## Related Code Files

- Modify: `client/src/components/ui/Button.test.js`
- Modify: `client/src/components/AnimationPreviewModal.test.jsx`
- Create: `client/src/utils/export-project.test.js`
- Create: `tests/e2e/animation-preview.spec.js`

## Implementation Steps

1. Add Button variant test asserting no `border-none` and explicit secondary border.
2. Add modal SSR test assertions for dialog semantics and close accessible name.
3. Add export-project unit test for mixed valid/missing local media.
4. Add E2E modal open/Escape/narrow-overflow coverage.

## Todo List

- [ ] Button regression test exists.
- [ ] Modal semantic test exists.
- [ ] Export partial-media test exists.
- [ ] E2E animation preview test exists.

## Success Criteria

- [ ] Tests directly map to Medium findings.
- [ ] No unrelated snapshot or broad test churn.

## Risk Assessment

Risk: browser-only modal behavior is hard to assert in SSR. Mitigation: split SSR attribute checks and Playwright runtime checks.

## Security Considerations

No new trust boundary in this phase.

## Next Steps

Implement the fixes in phases 2-5.
