---
phase: 2
title: 'Migrate Main Layouts and Pages'
status: completed
priority: P1
effort: '4h'
dependencies: [1]
---

# Phase 2: Migrate Main Layouts and Pages

## Overview

Migrate top-level container structures of the application pages (`HomePage`, `EditorPage`, `SettingsPage`, `ExplorePage`, `RemoteControlPage`) to Tailwind CSS, deprecating `home-page.css` and `editor-page.css`.

## Requirements

- Functional: Retain exact flexbox/grid alignments for the main application shell.
- Non-functional: Seamless transition; users should perceive zero visual changes.

## Architecture

- Replace `.home-page`, `.home-header`, `.home-sidebar`, `.home-content` with direct Tailwind utility classes (`flex`, `h-screen`, `bg-bg-primary`, etc.).
- Convert the `.editor-layout`, `.editor-header`, `.editor-workspace` grid system to Tailwind grid classes.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/pages/SettingsPage.jsx`
- Delete: `client/src/styles/home-page.css`
- Delete: `client/src/styles/editor-page.css` (or empty it out)

## Implementation Steps

1. Refactor `HomePage.jsx` to replace all `className="home-*"` with their equivalent Tailwind utilities.
2. Refactor `EditorPage.jsx` structural wrappers to Tailwind grid/flex containers.
3. Address inherited layout classes in `SettingsPage.jsx`, `ExplorePage.jsx`, and `RemoteControlPage.jsx`.
4. Remove `home-page.css` and `editor-page.css` imports from `index.css`.

## Verification & Testing

- **Test:** Run integration tests to ensure pages load without CSS bundle errors.
- **Browser Subagent:** Instruct the `browser_subagent` to open `HomePage` and `EditorPage`. Check overall layout boundaries and ensure the sidebar/header alignments remain perfect. Take screenshots for confirmation.

## Success Criteria

- [x] `home-page.css` and `editor-page.css` are fully deprecated.
- [x] Layout grid and responsiveness are identical to the legacy CSS implementation.

## Risk Assessment

- **Risk:** Z-index or overflow issues leading to unexpected scrollbars.
- **Mitigation:** Carefully map `overflow-hidden`, `overflow-y-auto`, and z-indices.
