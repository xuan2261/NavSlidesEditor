# Phase 07 - Responsive Accessibility And Motion Hardening

## Context Links

- [Plan](./plan.md)
- [Validation checklist](./reports/validation-checklist.md)
- `client/src/index.css`
- `client/src/pages/*.jsx`
- `client/src/components/*.jsx`
- `tests/e2e/*`

## Overview

- Priority: P1
- Status: Pending
- Effort: 5h
- Goal: verify interaction quality after visual changes.

## Key Insights

- Editor is desktop-first, but dashboard/modals must not break on small widths.
- Accessibility issues are easier to introduce during visual polish.
- Motion should be subtle and respect reduced motion.

## Requirements

- Functional:
  - Add `prefers-reduced-motion` overrides.
  - Ensure focus states visible.
  - Ensure errors use alert/live regions.
  - Ensure icon-only buttons have labels.
  - Ensure route/modal keyboard flow works.
- Non-functional:
  - No animation > 300ms except intentional preview content.
  - Avoid animating width/height/top/left.
  - No dashboard/modal horizontal scroll at 375px.

## Architecture

Global CSS handles reduced motion and focus baseline. Component fixes remain local.

## Related Code Files

- Modify: `client/src/index.css`
- Modify: any components found by audit.
- Tests: targeted unit/e2e and manual keyboard checks.

## Implementation Steps

1. Add global `@media (prefers-reduced-motion: reduce)` for app UI animation classes.
2. Audit icon-only buttons via rg.
3. Audit `transition-all` and replace high-impact instances.
4. Audit modal and form errors for `role="alert"`.
5. Check responsive breakpoints for dashboard/modals.
6. Run manual keyboard path.

## Todo List

- [ ] Add reduced-motion CSS.
- [ ] Fix unlabeled icon buttons.
- [ ] Replace risky `transition-all`.
- [ ] Add alert/live roles.
- [ ] Verify small viewport behavior.

## Verify / Tests

- `npm run build`
- `npm run test:e2e -- tests/e2e/smoke.spec.js`
- `npm run test:e2e -- tests/e2e/keyboard-shortcuts.spec.js`
- Manual: Chrome reduced motion enabled.
- Manual: Tab order dashboard -> create modal -> editor toolbar.
- Manual: 375px dashboard and modal no horizontal overflow.

## Success Criteria

- Keyboard user can operate key flows.
- Reduced motion is respected.
- No hover-only critical action.
- Small viewport dashboard/modals remain usable.

## Risk Assessment

- Risk: too much a11y work expands scope.
- Mitigation: fix blocking issues only; record non-blockers for later.

## Security Considerations

- No auth/data changes.
- Do not weaken sandbox or content safety.

## Next Steps

- Phase 08 final tests/docs.

## Unresolved Questions

- Whether to add automated axe checks later. Not in current scope unless dependency already exists.
