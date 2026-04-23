---
phase: 2
title: "Button And Icon Control Accessibility"
status: complete
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 02: Button And Icon Control Accessibility

## Context Links

- `client/src/components/ui/Button.jsx`
- `client/src/pages/HomePage.jsx`

## Overview

Fix the global Button border conflict and ensure icon-only controls have accessible names.

## Requirements

- Functional: `secondary` buttons render visible borders; icon-only buttons expose names.
- Non-functional: avoid broad design restyling.

## Architecture

Keep `Button` API stable. Update variant classes and add safe `title` to `aria-label` fallback.

## Related Code Files

- Modify: `client/src/components/ui/Button.jsx`
- Modify: `client/src/components/ui/Button.test.js`
- Modify: `client/src/pages/HomePage.jsx`

## Implementation Steps

1. Remove `border-none` from Button base classes.
2. Add explicit border classes to every variant.
3. Replace Button `transition-all` with property-specific transitions.
4. Add explicit `aria-label` on HomePage icon buttons.
5. Preserve existing `title` tooltip behavior.

## Todo List

- [ ] Button variants updated.
- [ ] Icon controls named.
- [ ] Button unit tests pass.

## Success Criteria

- [ ] `buttonVariants({ variant: 'secondary' })` has visible border policy and no `border-none`.
- [ ] HomePage icon buttons have `aria-label`.
- [ ] No new lint errors.

## Risk Assessment

Risk: class merge order hides intended overrides. Mitigation: keep `className` last through existing `cn()` path.

## Security Considerations

No new security surface.

## Next Steps

Apply modal accessibility/responsive fixes.
