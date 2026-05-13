---
title: "Scout Report"
type: report
created: 2026-05-13
---

# Scout Report

## Summary

NavSlides is React/Vite/Tailwind. UI is tokenized but uneven. Best leverage is shared CSS variables + shared UI components. Main implementation should avoid changing export/rendering logic.

## Findings

- Theme tokens live in `client/src/index.css`.
- Tailwind aliases already map to CSS variables.
- `Button.jsx` computes aria-label fallback for icon buttons.
- `HomePage.jsx` has multiple dashboard views and repeated hover card styles.
- `PropertiesPanel.jsx` and property subcomponents use many compact labels.
- `SlidePanel.jsx` uses custom preview rendering and must remain lightweight.
- E2e visual tests exist under `tests/e2e/visual-regression.spec.js`.

## Watch List

- Do not alter slide element data model.
- Do not alter `SlideThumbnail` rendering in ways that change test snapshots without review.
- Keep canvas logical size and scaling untouched.
- Keep selection/smart-guide colors sufficiently distinct from slide content.

## Unresolved Questions

- None blocking.
