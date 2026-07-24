---
phase: 5
title: "Tokenized Presentation Shells And Command Palette"
status: pending
priority: P2
dependencies: [1, 2]
---

# Phase 5: Tokenized Presentation Shells And Command Palette

## Overview

Remove hard-coded colors from command palette and presentation-mode shell chrome while preserving current layouts and live-presentation behavior.

## Requirements

- Functional: command palette keyboard execution, live view rendering, remote control navigation, and speaker view controls continue to work.
- Non-functional: use theme tokens for surfaces/text/borders/focus and preserve contrast in dark/light themes.

## Architecture

Convert inline styles and hard-coded Tailwind color utilities to existing token classes. If command palette needs dynamic positioning, keep inline layout styles but remove color literals.

## Related Code Files

- Modify: `client/src/components/command-palette.jsx`
- Modify/Review: `client/src/pages/LiveViewPage.jsx`
- Modify: `client/src/pages/RemoteControlPage.jsx`
- Modify: `client/src/pages/SpeakerViewPage.jsx`
- Modify: `client/src/components/game-leaderboard-overlay.jsx` only if included in strict token audit.
- Test: `client/src/components/command-palette.test.jsx`
- Existing: `client/src/utils/command-palette.test.jsx`
- Test: `client/src/utils/presentation-ui-token-audit.test.js`
- Existing: `client/src/utils/tailwind-inline-style-audit.test.js`
- E2E: `tests/e2e/command-palette-execution.spec.js`
- E2E: `tests/e2e/live-remote-controller.spec.js`
- E2E: `tests/e2e/visual/present-speaker-share-and-live-viewer-baselines.spec.js`

## Implementation Steps

1. Confirm token audit fails on `#1e1e2e`, `#fff`, `text-slate-400`, `hover:text-white`, and scoped presentation-shell literals in app chrome.
2. Refactor `CommandPalette` to use class names or CSS variables:
   - Overlay: themed scrim.
   - Panel: `bg-card`, `border-border`, themed shadow.
   - Input/list rows/kbd: token classes.
3. Replace live/remote/speaker hard-coded shell classes or inline colors with `text-text-secondary`, `hover:text-text-primary`, `bg-*`, `border-*`, or a documented allowlist when color is presentation content rather than app chrome.
4. Keep the audit scoped to app chrome. Do not flag slide content, slide templates, trusted embeds, or export renderers.
5. Verify keyboard selection and shortcut rendering in command palette.
6. Verify live/remote/speaker visual baselines or DOM state remain acceptable.

## Tests And Verification

```bash
npx vitest run client/src/components/command-palette.test.jsx client/src/utils/command-palette.test.jsx client/src/utils/presentation-ui-token-audit.test.js client/src/utils/tailwind-inline-style-audit.test.js
npx playwright test tests/e2e/command-palette-execution.spec.js tests/e2e/live-remote-controller.spec.js
npx playwright test tests/e2e/visual/present-speaker-share-and-live-viewer-baselines.spec.js
```

## Success Criteria

- [ ] No hard-coded command palette shell colors remain.
- [ ] Live, remote, and speaker primary shell controls use design tokens or have a documented app-chrome allowlist reason.
- [ ] Command palette keyboard navigation and execution remain intact.
- [ ] Visual baseline changes are intentional and token-consistent.

## Risk Assessment

- Risk: inline-style audit may catch legitimate template content colors. Mitigation: target app shell files, not slide templates.
- Risk: visual snapshots change. Mitigation: update only after human review or replace brittle screenshot with DOM/contrast checks.
