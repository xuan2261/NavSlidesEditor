# Scout Report: Insert Ribbon Media/Embed Direct Actions

Date: 2026-05-18

## Findings

- Project: React/Vite workspace, Node 20+, Playwright E2E, Vitest component tests.
- Main component: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` (~380 LOC).
- Current grouping:
  - Inline: Basic, Shapes, Content.
  - Dropdown: Media, Embed, Advanced.
- Dropdown component: `client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx` (~84 LOC), menu `absolute top-full`, `min-w-[140px]`, trigger label hidden below `2xl`.
- Current tests encode grouped behavior:
  - `tests/e2e/pages/RibbonInsertHelper.js` has `GROUPED_ITEMS`.
  - `tests/e2e/ribbon-layout.spec.js` expects `Media`, `Embed`, `Advanced` triggers.
  - `tests/e2e/coverage-gaps.spec.js` maps Video/Audio/SVG/Drawing through groups.
- Prior plan: `plans/260517-2252-editor-ribbon-layout-hardening-tdd` complete; phase 4 grouped Media/Embed/Advanced to solve 1280px overflow.

## Constraints

- Prior measured issue: Insert scrollWidth 1021px inside 840px at 1280px before compaction.
- Current 1280 layout gate must remain green.
- `onOpenFileBrowser` is conditional, so Media has 3 or 4 actions.
- Button `icon` variant is strict icon-only. Do not place visible text inside `icon`.
- HTML/SVG/media are trusted author content; no behavior change to security policy.

## Recommended Touchpoints

- Modify:
  - `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
  - `client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx` or new Advanced-only flyout component if simpler
  - `tests/e2e/pages/RibbonInsertHelper.js`
  - `tests/e2e/ribbon-layout.spec.js`
  - `tests/e2e/coverage-gaps.spec.js`
  - `docs/project-changelog.md`
- Optional create:
  - `client/src/components/ribbon/ribbon-advanced-flyout-menu.jsx`
  - `client/src/components/ribbon/ribbon-advanced-flyout-menu.test.jsx`

## Unresolved Questions

- None. Behavior target decided by brainstorm: Media/Embed direct; Advanced grouped.

