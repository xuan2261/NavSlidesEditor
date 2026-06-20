---
phase: 4
title: "Accessibility Keyboard Polish"
status: completed
priority: P1
effort: "1.5-2d"
dependencies: [1]
---

# Phase 4: Accessibility Keyboard Polish

## Overview

Improve keyboard-only and assistive-technology paths across the newly expanded teaching and game surfaces.

## Requirements

- Functional: keyboard-only users can open Insert teaching flows, operate modals, activate templates, and submit/join game activities.
- Functional: Escape, Apply/Insert, focus restore, and validation announcement behavior are explicit.
- Functional: game join errors and matching/poll/word-cloud prompts are announced clearly.
- Functional: blocking validation errors use `role="alert"` or `aria-live` and are covered by tests.
- Non-functional: preserve existing shortcut scopes and text-editing guards.

## Architecture

Keep keyboard behavior in existing scope-aware handlers. Modal-level improvements should use semantic dialog/input relationships rather than custom focus traps unless existing behavior is insufficient.

## Related Code Files

- Modify: `client/src/hooks/use-keyboard.js` only if a real shortcut bug is found
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `client/src/components/HtmlEditorModal.jsx`
- Modify: `client/src/components/LatexEditorModal.jsx`
- Modify: `client/src/components/stem-simulation-preset-modal.jsx`
- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/pages/game-player-join-page.jsx`
- Modify: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
- Modify: `tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js`

## Implementation Steps

1. Add failing keyboard/a11y tests for modal descriptions, focus restore, dashboard template activation, and game join validation.
2. Add or extend `tests/e2e/games/game-elements-player-join-page.spec.js` to assert keyboard submit and accessible validation/error announcement.
3. Fix semantic labels/descriptions and `aria-live` announcements where missing.
4. Verify no shortcut collisions with active text editing.
5. Run targeted axe and keyboard Playwright checks.

## Success Criteria

- [x] Keyboard-only E2E covers the polished teaching route.
- [x] Touched dialogs have stable accessible names and descriptions.
- [x] Validation/error messages are announced where user action is blocked.
- [x] Game join validation has keyboard-submit and accessible error/announcement assertions.
- [x] No new critical axe violations are introduced.
- [x] Existing game shortcut tests remain green.

## Risk Assessment

Risk: shortcut changes break editor productivity. Mitigation: avoid changing `use-keyboard.js` unless tests prove a bug.

Risk: focus management regresses popup behavior. Mitigation: add focus restore assertions before changing components.
