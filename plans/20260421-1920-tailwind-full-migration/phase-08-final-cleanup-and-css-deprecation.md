---
phase: 8
title: 'Final Cleanup and CSS Deprecation'
status: completed
priority: P1
effort: '2h'
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: Final Cleanup and CSS Deprecation

## Overview

Remove the legacy CSS files entirely from the codebase, verify there are no missing classes, and conduct a full application-wide visual regression test.

## Requirements

- Functional: The application must run without `home-page.css`, `editor-page.css`, `slide-panel.css`, `canvas-toolbar.css`, `properties-panel.css`, `modals.css`, and `components.css`.
- Non-functional: Clean build process.

## Architecture

- `index.css` will only contain Tailwind base directives, typography font imports, and root CSS variables.

## Related Code Files

- Modify: `client/src/index.css`
- Delete: `client/src/styles/home-page.css`
- Delete: `client/src/styles/editor-page.css`
- Delete: `client/src/styles/slide-panel.css`
- Delete: `client/src/styles/canvas-toolbar.css`
- Delete: `client/src/styles/properties-panel.css`
- Delete: `client/src/styles/modals.css`
- Delete: `client/src/styles/components.css`

## Implementation Steps

1. Delete the 7 CSS files listed above from `client/src/styles/`.
2. Remove their `@import` statements from `client/src/index.css`.
3. Clear out legacy root variables that are no longer used by Tailwind (e.g. legacy shadow or radius variables, if they were fully replaced by Tailwind utility classes).

## Verification & Testing

- **Test:** Run the Playwright E2E suite to guarantee no crucial interactive components broke.
- **Browser Subagent:** Run a final full-app walkthrough. Login/Home -> Create Slide -> Open all Modals -> Edit Canvas -> Toggle Light/Dark. Take a comprehensive set of screenshots proving the application functions identically or better than before.

## Success Criteria

- [x] The `src/styles` directory is clean (or entirely removed if no longer needed).
- [x] `index.css` is minimal and strictly follows Tailwind configuration.

## Risk Assessment

- **Risk:** Deleting CSS files might reveal missed components that suddenly lose their styling.
- **Mitigation:** Use `git restore` if critical failures happen, and address the missed components. Keep PR commits highly granular.
