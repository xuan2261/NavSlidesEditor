---
phase: 7
title: "Mobile Header And Tour Polish"
status: pending
priority: P2
dependencies: [1, 3, 4, 5, 6]
effort: "1-2 dev-days"
---

# Phase 7: Mobile Header And Tour Polish

## Overview

Polish the two verified subjective/mobile UX issues after critical accessibility defects are addressed: dashboard header crampedness on small screens and Joyride tour overlay clarity.

This phase intentionally waits for route recovery, ribbon keyboard activation, modal focus standardization, and P0 canvas accessibility so polish does not distract from blocking accessibility work.

## Requirements

- Functional: Home header remains usable at 320, 375, 414, tablet, and desktop widths.
- Functional: search, theme, settings, and New actions remain reachable on mobile.
- Functional: Joyride highlighted target context remains visible enough to orient users.
- Non-functional: desktop layout should remain visually equivalent unless a change is explicitly required.

## Architecture

Use responsive utility classes in `HomePage.jsx`; do not rewrite the dashboard. For Joyride, tune configuration constants and styles in `ProductTour.jsx`; do not replace Joyride.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/components/ProductTour.jsx`
- Tests: `client/src/pages/home-editor-responsive-source.test.js`
- Tests: `client/src/components/ProductTour.test.js`
- E2E: `tests/e2e/dashboard.spec.js`
- Optional visual: `tests/e2e/visual/mobile-editor-explicit-device-scale-factor-pinned.spec.js`

## Implementation Steps

1. Keep the corrected verdict in mind: this is not a proven horizontal overflow bug, it is a mobile usability issue.
2. Add/extend mobile tests:
   - no horizontal overflow at 320/375/414
   - search control visible or intentionally collapsed with accessible label
   - New/settings/theme reachable
   - touch targets near 44px where feasible
3. Refactor Home header only:
   - mobile can use two-row header or compact search affordance
   - preserve desktop `h-14` layout if possible
   - avoid hiding critical actions without a replacement
4. Improve mobile sidebar horizontal nav only if tests show cramped/unusable behavior; avoid broad dashboard redesign.
5. Update ProductTour constants:
   - lower overlay opacity from `0.6` to a tested value, likely `0.45` or `0.5`
   - consider larger spotlight padding or target ring
   - keep tooltip contrast high
6. Add ProductTour test asserting overlay config and labels.
7. Browser-check Home at 320/375/414 and desktop.
8. Run targeted Home/ProductTour tests and dashboard e2e.

## Success Criteria

- [ ] Home header controls are reachable and non-overlapping at common mobile widths.
- [ ] No horizontal page overflow is introduced.
- [ ] Desktop Home header remains stable.
- [ ] Tour target context is clearer without reducing tooltip readability.
- [ ] ProductTour remains keyboard/skip/finish accessible.

## Risk Assessment

- Risk: mobile improvement regresses desktop density.
  - Mitigation: scope changes with `sm:`/`md:` breakpoints and verify desktop.
- Risk: lighter overlay reduces tooltip focus.
  - Mitigation: maintain tooltip contrast and optional target ring.
