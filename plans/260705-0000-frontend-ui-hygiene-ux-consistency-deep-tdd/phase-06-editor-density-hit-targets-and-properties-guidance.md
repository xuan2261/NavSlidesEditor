---
phase: 6
title: "Editor Density Hit Targets And Properties Guidance"
status: pending
priority: P2
dependencies: [1, 2]
---

# Phase 6: Editor Density Hit Targets And Properties Guidance

## Overview

Improve editor control usability without forcing a larger UI on desktop users. Add clear text-element PropertiesPanel guidance.

## Requirements

- Functional: compact editor remains available; touch/comfortable density can expose larger controls; text selection shows useful guidance instead of silently returning no type-specific panel.
- Non-functional: avoid breaking existing ribbon tests, status bar store behavior, and dense desktop workflows.

## Architecture

Add opt-in sizing/density variants to shared controls instead of globally increasing every `Button`. The default implementation should use scoped CSS/breakpoints or `(pointer: coarse)` touch media before adding persisted UI state. The UI store can own a density setting only if a test proves CSS/touch-media scoped sizing cannot satisfy the policy.

Hit-target policy:
- Compact desktop may keep dense toolbar controls below 44px when equivalent keyboard access and visible focus are preserved.
- Comfortable/touch contexts must target `44x44px` for primary controls.
- Dense toolbar exceptions in comfortable/touch contexts must be at least `32x32px`, have enough spacing to avoid mis-taps, and be explicitly documented in tests.

## Related Code Files

- Modify: `client/src/components/ui/Button.jsx`
- Modify: `client/src/components/layout/StatusBar.jsx`
- Modify: `client/src/components/QuickAccessToolbar.jsx` if hit-target audit includes it.
- Modify: `client/src/components/ribbon/*` only for targeted size/density classes.
- Modify: `client/src/components/PropertiesPanel.jsx`
- Possibly modify: `client/src/stores/ui-store.js` for density setting.
- Test: `client/src/components/ui/Button.test.js`
- Test: `client/src/components/layout/StatusBar.test.jsx`
- Test: `client/src/components/PropertiesPanel.test.jsx`
- Test: `client/src/components/properties/text-properties-panel-render.test.jsx`
- E2E: `tests/e2e/a11y/minimum-hit-targets.spec.js`
- E2E: `tests/e2e/a11y/touch-gestures-tap-double-tap-and-swipe-on-tablet-viewport.spec.js`

## Implementation Steps

1. Confirm hit-target and text PropertiesPanel tests fail for current compact-only behavior.
2. Decide density mechanism:
   - Preferred: `compact` default, `comfortable` through CSS breakpoint/touch media.
   - Avoid: global `Button` size change that impacts all app surfaces.
   - Avoid: persisted density state unless scoped CSS cannot pass tests.
3. Increase status bar zoom/view controls in comfortable/touch contexts while preserving compact layout at desktop.
4. Review ribbon `h-7 w-7` controls and apply tokenized size classes where comfortable mode requires larger hit areas.
5. Include find/replace `h-6 w-6` buttons in the measured policy if Phase 7 keeps them in a touch-reachable overlay.
6. Add text selected-state PropertiesPanel content:
   - Explain text formatting lives in Home/Format ribbon and direct text editing.
   - Provide optional quick controls only if existing editor APIs make that low-risk.
7. Keep focus rings and aria labels visible/meaningful.

## Tests And Verification

```bash
npx vitest run client/src/components/ui/Button.test.js client/src/components/layout/StatusBar.test.jsx
npx vitest run client/src/components/PropertiesPanel.test.jsx client/src/components/properties/text-properties-panel-render.test.jsx
npx playwright test tests/e2e/a11y/minimum-hit-targets.spec.js tests/e2e/a11y/touch-gestures-tap-double-tap-and-swipe-on-tablet-viewport.spec.js
npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js
```

## Success Criteria

- [ ] Compact desktop editor is not visually bloated.
- [ ] Comfortable/touch mode key controls meet documented hit-target expectations.
- [ ] Any dense-toolbar exception is documented with size, spacing, and keyboard alternative.
- [ ] Status bar zoom/view controls still update Zustand state.
- [ ] Text element selection no longer leaves users with an unexplained blank type-specific panel.
- [ ] Keyboard focus rings remain visible.

## Risk Assessment

- Risk: adding density state creates persistence churn. Mitigation: start with CSS/breakpoint approach unless user settings are required.
- Risk: text quick controls duplicate ribbon logic. Mitigation: guidance-only is acceptable if quick controls would overcomplicate.
