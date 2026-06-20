---
phase: 2
title: "Teaching Feature Onboarding"
status: completed
priority: P1
effort: "1.5-2d"
dependencies: [1]
---

# Phase 2: Teaching Feature Onboarding

## Overview

Make v1.15 teaching features easier to discover and understand inside the editor without adding new feature families.

## Requirements

- Functional: expose lightweight onboarding for Mermaid, STEM, LaTeX/TikZ, technical symbols, and game activities.
- Functional: keep trusted-content and online-only warnings visible and screen-reader reachable.
- Functional: preserve Insert ribbon behavior and existing focus restoration.
- Non-functional: do not add persistent onboarding state beyond existing localStorage/tour patterns unless necessary.

## Architecture

Use existing `ProductTour` and contextual copy patterns. The Insert ribbon remains the primary feature gateway; modals provide local guidance and validation. All feature creation still flows through existing element creation handlers.

## Related Code Files

- Modify: `client/src/components/ProductTour.jsx`
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `client/src/components/HtmlEditorModal.jsx`
- Modify: `client/src/components/LatexEditorModal.jsx`
- Modify: `client/src/components/stem-simulation-preset-modal.jsx`
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx`
- Modify: `client/src/components/content-editor-modals.test.jsx`
- Modify: `tests/e2e/teaching-interactivity-smoke.spec.js`

## Implementation Steps

1. Extend failing tests from Phase 1 for onboarding copy and reachable controls.
2. Add or adjust ProductTour steps for teaching feature discovery.
3. Add concise contextual helper text/tooltips to Insert teaching controls where missing.
4. Strengthen modal `aria-describedby`/warning relationships for HTML/Mermaid, STEM, and LaTeX.
5. Add explicit discoverability/reachable-flow tests for LaTeX/TikZ and technical symbols, not only Mermaid/STEM/Live Poll; use Playwright E2E where practical, otherwise document equivalent role/name component coverage in the phase evidence.
6. Verify the teaching smoke path still inserts Mermaid, STEM, and Live Poll.

## Success Criteria

- [x] Users can identify where to add Mermaid, STEM, LaTeX/TikZ, technical symbols, and games from Insert.
- [x] Mermaid, STEM, LaTeX/TikZ, technical symbols, and game activities each have a role/name based reachability test, with E2E coverage preferred for app-level Insert flows.
- [x] Modal warnings are visible and programmatically associated with dialogs or inputs.
- [x] Keyboard focus behavior of Insert popups remains unchanged or improves.
- [x] Teaching E2E smoke remains green.

## Risk Assessment

Risk: onboarding becomes noisy. Mitigation: use tour/contextual hints, not persistent banners.

Risk: security warnings get softened. Mitigation: preserve trusted-author and online-only warnings in tests.
