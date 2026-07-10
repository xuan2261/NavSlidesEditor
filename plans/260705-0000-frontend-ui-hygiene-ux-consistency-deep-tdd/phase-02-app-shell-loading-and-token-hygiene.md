---
phase: 2
title: "App Shell Loading And Token Hygiene"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: App Shell Loading And Token Hygiene

## Overview

Fix confirmed blank-loading and undefined-token defects at the app shell/theme layer.

## Requirements

- Functional: route lazy loading shows visible themed feedback; `bg-editor-bg` and `bg-background` usages resolve to valid theme tokens or are replaced with existing tokens.
- Non-functional: preserve dark/light theme behavior and avoid broad visual redesign.

## Architecture

Add a small `AppLoadingFallback` component or inline shell in `App.jsx`. For tokens, prefer replacing source usages with existing `bg-workspace`, `bg-secondary`, `bg-panel`, or adding aliases only when the alias is semantically useful.

## Related Code Files

- Modify: `client/src/App.jsx`
- Modify: `client/tailwind.config.js`
- Modify: `client/src/pages/game-player-join-page.jsx`
- Modify: `client/src/components/ribbon/ribbon-panel.jsx`
- Modify: `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx`
- Modify: `client/src/index.css` only if CSS variable alias is needed.
- Test: `client/src/App.suspense-fallback.test.jsx`
- Test: `client/src/utils/tailwind-token-contract.test.js`
- Existing: `shared/tests/design-tokens.test.js`

## Implementation Steps

1. Confirm Phase 1 tests fail on `fallback={null}` and missing token aliases.
2. Replace `fallback={null}` with a themed loading shell using `role="status"` or equivalent accessible text.
3. Decide token strategy:
   - Replace `bg-editor-bg` with `bg-workspace` in game player if no unique semantic is needed.
   - Replace `bg-background` with `bg-secondary` or `bg-panel` in ribbon chrome, or add `background: var(--bg-secondary)` as a compatibility alias.
4. Ensure fallback respects current root theme via CSS tokens, not hard-coded dark-only colors.
5. Update tests to assert accessible loading and no undefined theme aliases.

## Tests And Verification

```bash
npx vitest run client/src/App.suspense-fallback.test.jsx client/src/utils/tailwind-token-contract.test.js shared/tests/design-tokens.test.js
npx vitest run client/src/pages/game-player-matching-card.test.jsx client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx
npm run lint
```

## Success Criteria

- [ ] Lazy routes render a visible accessible loading state.
- [ ] `bg-editor-bg` and `bg-background` are no longer undefined in app source.
- [ ] Game player, ribbon panel, and tab bar retain correct dark/light backgrounds.
- [ ] No unrelated theme tokens are introduced.

## Risk Assessment

- Risk: aliasing `background` encourages vague tokens. Mitigation: prefer semantic replacement unless compatibility is clearly safer.
- Risk: fallback flashes too often. Mitigation: keep it minimal and visually quiet.
