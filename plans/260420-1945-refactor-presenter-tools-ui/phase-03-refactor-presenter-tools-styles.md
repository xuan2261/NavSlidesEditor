---
phase: 3
title: 'Refactor Presenter Tools Styles'
status: pending
priority: P2
effort: '45m'
dependencies: [2]
---

# Phase 3: Refactor Presenter Tools Styles

## Overview

Reintroduce the Fullscreen button as a grouped element inside `.presenter-toolbar` and apply a translucent style across all presenter tools. Fix the rendering condition to ensure the toolbar styling always applies.

## Requirements

- Functional: Fullscreen button must function the same way, using the requestFullscreen API.
- Non-functional: All presenter tools (`.presenter-toolbar`, `.slide-menu-button`, `.customcontrols`, `.reveal .controls`) must start with an opacity of 0.15 and smoothly transition to opacity 1 when hovered. The toolbar CSS must always be injected regardless of toggle settings.

## Architecture

- `shared/src/presenterTools.js` `getPresenterToolsBody` for injecting the Fullscreen button inside `.presenter-toolbar`.
- `shared/src/presenterTools.js` `getPresenterToolsHead` for appending the CSS rules handling opacity.

## Related Code Files

- Modify: `shared/src/presenterTools.js`

## Implementation Steps

1. In `shared/src/presenterTools.js` `getPresenterToolsHead`, move the `.presenter-toolbar` CSS block **OUTSIDE** of the `if (presenterTools.themeToggle !== false || presenterTools.fontZoom !== false)` check so that it always renders.
2. Update the `.presenter-toolbar` CSS to include `opacity: 0.15; transition: opacity 0.3s ease;` to `.presenter-toolbar` and `opacity: 1;` to `.presenter-toolbar:hover`.
3. In `shared/src/presenterTools.js` `getPresenterToolsHead`, add a new style block that targets `.slide-menu-button`, `.customcontrols`, and `.reveal .controls`:

```css
.slide-menu-button,
.customcontrols,
.reveal .controls {
  opacity: 0.15 !important;
  transition: opacity 0.3s ease !important;
}
.slide-menu-button:hover,
.customcontrols:hover,
.reveal .controls:hover {
  opacity: 1 !important;
}
```

4. Move the `:fullscreen #fs-btn` style from `htmlGenerator.js` to `presenterTools.js` so it hides the button when in fullscreen.
5. In `shared/src/presenterTools.js` `getPresenterToolsBody`, always push the Fullscreen button (`<button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6;</button>`) into the `buttons` array. Ensure `buttons.length === 0` logic handles it correctly (it should never be 0 now since fs-btn is always there).

## Success Criteria

- [ ] CSS for `.presenter-toolbar` is always injected.
- [ ] Fullscreen button is embedded directly inside `.presenter-toolbar`.
- [ ] All floating presenter tools (including default Reveal arrows) are 85% transparent initially.
- [ ] Hovering over the tools restores 100% opacity.

## Risk Assessment

- Low. UI adjustments may need minor tuning for visual consistency but logic is contained.
