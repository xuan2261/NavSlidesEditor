---
phase: 1
title: "Baseline UI Contract Harness"
status: pending
priority: P0
dependencies: []
---

# Phase 1: Baseline UI Contract Harness

## Overview

Create the failing/guard test harness that makes the confirmed UI issues measurable before implementation. This phase writes tests only, except for harmless test helpers/fixtures.

## Requirements

- Functional: capture contracts for route loading, missing Tailwind tokens, native dialogs, dashboard semantics, color hard-coding, hit targets, find/replace bounds, and advanced ribbon discoverability.
- Non-functional: tests must be deterministic, scoped, and cheap enough to run during later phases.

## Architecture

Use three layers:

1. Static Vitest scans for token/native-dialog/color-class regressions scoped to production UI chrome files.
2. React component tests for semantic component contracts.
3. Playwright viewport/a11y tests for visible/clickable responsive behavior.

## Related Code Files

- Create: `client/src/App.suspense-fallback.test.jsx`
- Create: `client/src/utils/tailwind-token-contract.test.js`
- Create: `client/src/utils/native-dialog-audit.test.js`
- Create: `client/src/pages/home-dashboard-card-semantics.test.jsx`
- Create: `client/src/utils/presentation-ui-token-audit.test.js`
- Create: `client/src/components/properties/text-properties-panel-render.test.jsx`
- Create: `tests/e2e/a11y/minimum-hit-targets.spec.js`
- Create: `tests/e2e/find-replace-responsive-overlay.spec.js`
- Create: `tests/e2e/ribbon/advanced-actions-overflow-discoverability.spec.js`
- Create: `tests/e2e/a11y/dashboard-card-semantics.spec.js`
- Modify: existing tests only when a narrower extension is cleaner.

## Implementation Steps

1. Add a Tailwind token contract test that loads `client/tailwind.config.js`, extracts `theme.extend.colors`, and fails for missing aliases used in production UI files.
2. Add a native-dialog audit that scans production UI files and fails for `alert(` or `confirm(` usage, excluding tests, fixtures, slide templates, export utilities, security fixtures, and explicit `ui-audit-allow: <reason>` comments.
3. Add a command/presentation UI token audit for app chrome targets: `command-palette.jsx`, `RemoteControlPage.jsx`, `SpeakerViewPage.jsx`, and any explicitly scoped presentation shell files.
4. Add a dashboard semantics test that renders key dashboard card states and fails when action buttons are nested in a `role="button"` container.
5. Add a text PropertiesPanel test showing selected text currently lacks type-specific guidance.
6. Add Playwright specs for hit targets, find/replace viewport containment, dashboard card a11y, and ribbon advanced-action access under constrained widths.
7. For React tests that need context, define wrappers up front: router, Zustand state reset, API mocks, and portal/modal roots.
8. Run each new targeted test and record expected red failures in phase notes or commit message during implementation.
9. For every fail-first test, record:
   - failing assertion,
   - mapped finding ID (`F1`-`F9`),
   - why failure is product behavior and not mock/provider/setup noise.

## Tests And Verification

Targeted red commands:

```bash
npx vitest run client/src/App.suspense-fallback.test.jsx client/src/utils/tailwind-token-contract.test.js
npx vitest run client/src/utils/native-dialog-audit.test.js
npx vitest run client/src/pages/home-dashboard-card-semantics.test.jsx
npx vitest run client/src/utils/presentation-ui-token-audit.test.js
npx vitest run client/src/components/properties/text-properties-panel-render.test.jsx
npx playwright test tests/e2e/a11y/minimum-hit-targets.spec.js tests/e2e/find-replace-responsive-overlay.spec.js tests/e2e/ribbon/advanced-actions-overflow-discoverability.spec.js tests/e2e/a11y/dashboard-card-semantics.spec.js
```

Expected initial result: at least one failing assertion per confirmed issue group.

## Success Criteria

- [ ] Test failures map to F1-F9 and are not setup noise.
- [ ] Static scans exclude tests/fixtures so they do not fail on intentional examples.
- [ ] Static scans do not inspect slide templates, export fixtures, trusted author content, or security payload tests.
- [ ] Allowlists are file-level or line-level with an explicit reason.
- [ ] Playwright specs use stable selectors, roles, or existing test helpers.
- [ ] No production UI behavior changes in this phase.

## Risk Assessment

- Risk: static scans become brittle. Mitigation: allow explicit comments for rare justified exceptions and keep allowlists small.
- Risk: Playwright hit-target assertions fail across zoom/device scale. Mitigation: test main controls at fixed viewport and avoid pixel-perfect visual snapshots.
