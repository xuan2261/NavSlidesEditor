---
title: "Scout Report - Editor Ribbon Layout Hardening"
status: complete
created: 2026-05-17
---

# Scout Report - Editor Ribbon Layout Hardening

## Summary

Project: React 18 + Vite 5 + Tailwind + Zustand. Scope is frontend app chrome only. No backend or slide canvas fidelity changes.

## Relevant Files

| Area | Files |
| --- | --- |
| Shared button | `client/src/components/ui/Button.jsx`, `Button.test.js` |
| Ribbon shell | `client/src/components/ribbon/ribbon-panel.jsx`, `ribbon-section.jsx`, `ribbon-header-bar.jsx`, `tab-bar-with-scroll-and-icons.jsx` |
| Insert controls | `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`, `tests/e2e/pages/RibbonInsertHelper.js` |
| Home text controls | `client/src/components/ribbon/home-tab-content.jsx`, `controls/ribbon-text-formatting-controls.jsx`, `controls/paragraph-formatting-and-alignment-controls.jsx` |
| Format controls | `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` |
| E2E helpers | `tests/e2e/pages/EditorPage.js`, `tests/e2e/editor.spec.js`, `tests/e2e/toolbar-elements.spec.js` |
| Evidence | `plans/reports/ribbon-ui-review-260517-2235.md`, `docs/ui-review/*.png` |

## Current Patterns

- Shared `Button` variants centralize basic control classes.
- Ribbon sections use `RibbonSection` with fixed 80px ribbon height.
- Tab content is one-row flex with horizontal overflow.
- TipTap text commands use `useSelectionPreservation` and `onMouseDown.preventDefault`.
- E2E tests use Playwright POM and API-created temporary presentations.

## Constraints

- Keep `Button variant="icon"` strict icon-only.
- Do not implement multi-row ribbon in this plan.
- Keep Tailwind utilities; no CSS Modules.
- Preserve keyboard accessibility and current command handlers.
- Preserve slide canvas 960x540 fidelity.

## Related Plans

- `260513-2243-ui-ux-warm-editorial-overhaul` complete, related history.
- No active incomplete plan directly blocks ribbon hardening.

## Recommendations

- Use TDD with browser metrics because jsdom cannot catch visual clipping.
- Fix root-cause button variant before compacting groups.
- Compact Insert/Home only after sizing is stable.

## Unresolved Questions

- None blocking plan creation.
