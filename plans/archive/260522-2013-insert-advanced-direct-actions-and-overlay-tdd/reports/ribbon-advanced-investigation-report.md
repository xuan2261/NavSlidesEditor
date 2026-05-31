---
title: "Ribbon Insert Advanced Investigation Report"
created: 2026-05-22
scope: "Insert tab Advanced UX, popup clipping, TDD planning"
---

# Ribbon Insert Advanced Investigation Report

## Summary

`Advanced` in Insert is currently a dropdown rendered inside the ribbon command row. It is not a viewport-level overlay. Because the ribbon shell is fixed at `80px` and uses `overflow-hidden`, dropdown content can be visually constrained by the ribbon area despite high `z-index`. This matches the reported UX issue: hard to see, hard to use.

## Evidence

- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-panel.jsx:27`
  - `.tour-step-ribbon` uses `relative h-[80px] overflow-hidden`.
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-tab-content-row.jsx:13`
  - active command row owns horizontal scroll with `overflow-x-auto`.
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-dropdown-menu-group-trigger.jsx:70`
  - dropdown uses `absolute top-full left-0`, rendered under trigger container.
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx:387`
  - `Advanced` groups fixed advanced actions plus `Games...` and plugin items.
- `C:\Work\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js:9`
  - tests currently assume fixed advanced actions remain grouped.
- `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js:126`
  - spec explicitly documents `Advanced grouped`.

## Current Advanced Items

- Fixed actions: `Kinetic Text`, `Math Grid`, `Anime.js`, `Three.js`, `Timeline`.
- Nested launcher: `Games...`.
- Dynamic actions: plugin insert items.

## UX Finding

Fixed single-click insertion actions should not be hidden behind a cramped dropdown. `Games...` and plugins should remain grouped because they are multi-choice or dynamic-count surfaces.

## Recommendation

1. Convert the five fixed Advanced actions to direct icon buttons in the `Advanced` section.
2. Keep one compact launcher for `Games` and plugin insert items.
3. Move ribbon popups/flyouts to viewport-level anchored overlays or a portal-backed shared primitive.
4. Update tests that currently encode grouped fixed actions.

## Risks

- 1280px Insert row can overflow if direct buttons are too wide.
- Keyboard/focus behavior can regress when moving menus into portals.
- Shape/Table/Advanced popup behavior can diverge if each is patched separately.

## Unresolved Questions

- Keep section label `Advanced`, or rename to `Interactive`? Default recommendation: keep `Advanced` for lower churn.
