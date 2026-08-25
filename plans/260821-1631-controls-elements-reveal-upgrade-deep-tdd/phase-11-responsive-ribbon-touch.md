---
title: "Phase 11: Responsive Ribbon, Active Reveal, and Touch Targets"
status: completed
---

# Phase 11: Responsive Ribbon, Active Reveal, and Touch Targets

## Goal

Make the Ribbon and dense editor controls discoverable and operable at narrow/tablet widths while preserving compact desktop density and contextual Format behavior.

## Dependencies

- Phase 05 semantic names/focus behavior.

## Canonical Files

- `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx`
- Ribbon shell/panel components and contextual Format tab owner
- Shared `Button`, `Input`, `Select`, `ColorPicker`, icon button, tooltip, and scroll affordance primitives
- `client/src/components/PropertiesPanel.jsx`
- `client/src/components/StatusBar.jsx` as existing coarse-pointer precedent
- `client/src/__tests__/ui-accessibility-findings-regression.test.js`
- Focused Ribbon component tests and new Playwright responsive/touch spec

## Contract

- The active tab is always brought into view with `scrollIntoView({ block: 'nearest', inline: 'nearest' })` after tab changes and when a hidden contextual Format tab appears/disappears.
- Horizontal overflow exposes visible, keyboard-operable affordances (scroll buttons/edge indicators) and native touch scrolling; it does not rely on a hidden scrollbar alone.
- If contextual Format becomes invalid, selection falls back deterministically to the last valid non-contextual tab without focus loss.
- At coarse pointer/tablet breakpoints, primary interactive targets meet a 44 CSS-pixel hit-area contract through padding/min-size while icons/text can remain visually compact. Desktop fine-pointer density remains current unless browser evidence proves clipping.
- The editor has no page-level horizontal overflow at 320, 768, or 1024 CSS pixels. Ribbon panels may scroll in their owned axis without covering canvas/status/properties controls.
- Focus rings, disabled/pressed/selected states, tooltip relationships, and reduced-motion behavior remain visible.

## RED

- [x] Component test activates an off-screen tab and asserts the correct trigger receives `scrollIntoView`; rerender after contextual Format hide/show preserves a valid active/focused tab.
- [x] Keyboard tests cover Arrow/Home/End/Enter/Space and overflow buttons with accessible names/states.
- [x] Responsive browser tests at 320/768/1024 and landscape/portrait measure page overflow, active-tab visibility, panel clipping, and focus order.
- [x] Coarse-pointer browser test measures computed hit boxes for primary tab/button/select/color controls and exercises touch scrolling/taps.
- [x] Reduced-motion test verifies active reveal/scroll avoids animated motion when requested.
- [x] Regression tests cover every Ribbon tab, contextual element type, Properties collapse/expand, and status controls.

## GREEN

- [x] Add a trigger ref map and active-tab reveal effect in the tab bar.
- [x] Add bounded left/right overflow controls or edge affordances derived from actual scroll position; update them on resize/scroll without per-frame React churn.
- [x] Add coarse-pointer responsive token/classes to shared controls rather than one-off per-panel padding.
- [x] Fix panel overflow ownership and shrink/min-width constraints; keep canvas usable instead of forcing the entire page wider.
- [x] Reconcile contextual tab fallback with Radix controlled state and focus restoration.

## REFACTOR

- [x] Centralize coarse-pointer target sizing in existing UI primitives/design tokens.
- [x] Remove obsolete hidden-scroll assumptions and duplicated tab-scroll handlers.
- [x] Do not turn the Ribbon into a new navigation system or redesign desktop information architecture.

## Focused Verification

```bash
npm test -- client/src/components/ribbon/tab-bar-with-scroll-and-icons.test.jsx client/src/components/ribbon/ribbon-format-tab-contextual-controls.test.jsx
npm test -- client/src/__tests__/ui-accessibility-findings-regression.test.js
npm run test:e2e:touch -- tests/e2e/ribbon-responsive-touch.spec.js
```

Use headed browser verification for 320/768/1024 snapshots and keyboard/touch interactions; screenshots are evidence for appearance only, while DOM measurements prove overflow/hit targets.

## Success Criteria

- [x] Active Ribbon tab is visible after keyboard, pointer, programmatic, and contextual changes.
- [x] Overflow is discoverable and operable by keyboard, mouse wheel/trackpad, and touch.
- [x] Primary coarse-pointer targets meet 44 CSS pixels without inflating desktop fine-pointer layout.
- [x] No page-level horizontal overflow or clipped primary action at target widths.
- [x] Focus/selected/disabled states remain semantic and visible.

## Risks / Rollback

- Unconditional scroll effects can steal user scroll or cause loops. Trigger only when active/visibility/size changes and use nearest alignment.
- Global 44px sizing can collapse desktop workspace. Scope through coarse-pointer/media tokens and verify both pointer modes.
- Rollback may remove visual overflow buttons but must retain semantic tabs and active-tab focus; do not revert to inaccessible hidden active state.