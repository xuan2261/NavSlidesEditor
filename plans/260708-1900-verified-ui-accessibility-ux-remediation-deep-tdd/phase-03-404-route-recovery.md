---
phase: 3
title: "404 Route Recovery"
status: pending
priority: P2
dependencies: [1]
effort: "0.5 dev-day"
---

# Phase 3: 404 Route Recovery

## Overview

Add accessible recovery for unknown routes so users never land on a blank app shell after typos, stale links, or bad deep links.

## Requirements

- Functional: unknown route renders clear Not Found UI with a dashboard return action.
- Functional: known dynamic routes continue resolving directly.
- Non-functional: keep lazy-loading behavior and app layout intact.

## Architecture

Add a lightweight `NotFoundPage` component or inline lazy-safe route in `App.jsx`. Place `path="*"` last. If rendered under `MainLayout`, preserve normal app chrome; public presentation routes remain outside the layout.

## Related Code Files

- Modify: `client/src/App.jsx`
- Optional create: `client/src/pages/NotFoundPage.jsx`
- Tests: `client/src/App.suspense-fallback.test.jsx` or `client/src/App.route-recovery.test.jsx`
- E2E: add unknown-route assertion to an existing smoke/dashboard spec if low cost

## Implementation Steps

1. Write/confirm failing route recovery test from Phase 1.
2. Add `NotFoundPage` with:
   - heading `Page not found`
   - short recovery copy
   - button/link back to `/`
   - accessible landmark/main container
3. Add `<Route path="*">` as the final route in `Routes`.
4. Resolve the game-route ambiguity before adding the catch-all by reading current source and docs:
   - Verify `client/src/App.jsx` for actual current routes.
   - `README.md` and current app route are expected to use `/player/:slideId/:elementId`, but do not assume this without source verification.
   - `CLAUDE.md` mentions `/game/join`.
   - Decide whether `/game/join` should become a supported redirect/route or is stale project guidance. If stale, record that as out-of-scope and do not silently add behavior.
5. Verify known routes:
   - `/`
   - `/editor/:id`
   - `/template/:id`
   - `/settings`
   - `/explore`
   - `/live/:roomCode`
   - `/remote/:roomCode`
   - `/speaker/:roomCode`
   - `/player/:slideId/:elementId`
   - `/game/join` according to the decision above
6. Specify exact wildcard placement:
   - nested `*` under `MainLayout` for app-route typos
   - top-level `*` only if public route typos should also use the same Not Found UI
7. Add E2E checks for both `/not-a-real-route` and a malformed public route such as `/live/bad/extra`.
8. Run targeted App route tests.

## Success Criteria

- [ ] Unknown paths no longer render blank UI.
- [ ] 404 page is keyboard accessible and has a clear recovery action.
- [ ] Catch-all does not intercept existing routes.
- [ ] `/game/join` ambiguity is explicitly resolved from current `App.jsx`, `README.md`, and `CLAUDE.md`, then tested or documented as out-of-scope.
- [ ] Targeted route tests pass.

## Risk Assessment

- Risk: wildcard route captures valid dynamic routes.
  - Mitigation: place wildcard last and test all known route families.
