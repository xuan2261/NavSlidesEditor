---
title: "Codebase Implementation Research"
type: research
created: 2026-05-13
---

# Codebase Implementation Research

## Summary

Repo already has a good theming entry point: `client/src/index.css` CSS variables and Tailwind aliases in `client/tailwind.config.js`. Shared primitives exist in `client/src/components/ui`. Best implementation path: update tokens and primitives first, then migrate high-impact surfaces.

## Relevant Files

| File | Current Role | Notes |
| --- | --- | --- |
| `client/src/index.css` | Global tokens, base typography, scrollbars, Joyride z-index | Main place for theme palette |
| `client/tailwind.config.js` | Tailwind aliases to CSS variables | Add shadow/ring/radius tokens if useful |
| `client/src/components/ui/Button.jsx` | Shared button variants | Good first refactor target |
| `client/src/components/ui/Input.jsx` | Shared text input | Align height/focus/background |
| `client/src/components/ui/Select.jsx` | Shared select | Align with input |
| `client/src/components/ui/ColorPicker.jsx` | Shared color picker | Keep compact, improve focus/labels |
| `client/src/pages/HomePage.jsx` | Dashboard | Highest visible impact |
| `client/src/components/PropertiesPanel.jsx` | Right panel | Dense controls, readability risk |
| `client/src/components/SlidePanel.jsx` | Left panel thumbnails | Overlay/readability polish |
| `client/src/components/*Modal.jsx` | Many repeated modal shells | Needs shared shell |

## Current Risks

- Many one-off `shadow-2xl`, `bg-black/50`, `transition-all`, and small `text-[10px]`.
- Some structural emoji in game join/error UI.
- Prior UI regressions exist in archive, so visual regression checks are mandatory.
- Modals are inline, not portal-based. Any shared shell must respect current inline mounting.

## Recommended Architecture

- Phase 1: token-only changes with no component rewrites.
- Phase 2: shared UI primitives.
- Phase 3-6: surface-by-surface migration.
- Phase 7-8: a11y, responsive, tests, docs.

## Unresolved Questions

- Whether to introduce `ModalShell.jsx` as a new shared component despite rule "update existing files directly." This is justified only if it removes repeated modal markup.
