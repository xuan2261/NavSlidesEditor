---
phase: 5
title: "Ribbon Overflow Discoverability And Input Density"
status: complete
priority: P1
effort: "4-5 dev-days"
dependencies: [3, 4]
---

# Phase 5: Ribbon Overflow Discoverability And Input Density

## Overview

Replace invisible ribbon scrolling with explicit, container-aware progressive disclosure while keeping every advanced Insert capability. Standardize compact input geometry and rebuild the table-size picker for keyboard and touch use.

## Requirements

### Functional

- Every ribbon tab and command remains reachable at 768, 1024 and 1440.
- No active row depends on a hidden native scrollbar.
- Primary actions stay direct; lower-frequency groups use visible named triggers such as Media, Embed and Advanced.
- Focused/active tabs and commands scroll or move into view.
- Table picker supports arrow navigation, Home/End, Enter/Space, Escape and touch-sized hit regions.
- Direct and overflow actions share descriptors and callbacks.

### Non-functional

- Preserve Radix tab IDs, contextual Format behavior and persisted active tab.
- Preserve Insert inventory and callback semantics.
- Use actual ribbon container width.
- Do not add a new UI library or duplicate action registries.

## Architecture

```text
ribbon container ResizeObserver
  -> density tier
     -> shared action descriptors
        -> direct group renderer
        -> named overflow menu renderer

shared ribbon control primitives
  -> button / select / number / range geometry

table picker
  -> one grid tab stop + roving active cell
  -> keyboard/pointer/touch selection
```

## File Inventory

| Action | Files | Planned impact |
|---|---|---:|
| Modify | `ribbon-panel.jsx`, `ribbon-tab-content-row.jsx`, `ribbon-section.jsx`, `tab-bar-with-scroll-and-icons.jsx` | Container density and reachability |
| Modify | Home, Insert, Design, Format, Transitions and Animations tab content | Shared descriptors/primitives |
| Consume only | `ribbon-view-mode-controls-content.jsx` | Phase 4 owns panel commands; Phase 5 wraps density without changing command semantics |
| Modify | `ribbon-insert-tab-element-galleries-panel.jsx` | Extract descriptors and accessible table grid |
| Create | `ribbon-density-context.jsx` and tests | 70-110 LOC each |
| Create | `ribbon-overflow-group-menu.jsx` and tests | 100-140 LOC each |
| Create | `ribbon-control-primitives.jsx` | 80-120 LOC |
| Modify/create | Ribbon Playwright helpers and focused overflow/visibility specs | Split every new spec below 200 LOC |
| Delete | None | All existing actions retained |

## Interfaces To Protect

- `TAB_PANELS`, contextual Format fallback and active-tab persistence.
- Existing ribbon action names, test IDs and callback props.
- Shape, table, technical-symbol, game and Advanced popup focus restoration.
- Classic desktop section order at 1440.
- Sibling-popup closure and viewport positioning.
- `RibbonTabContentRow` one-row contract.

## TDD Scenario Matrix

| Tier | State | Expected |
|---|---|---|
| 1440 | Every tab | Full labels and direct primary groups |
| 1024 | Insert | Basic/Shapes/Content direct; named lower-frequency menus |
| 768 | Insert | Text/Picture/Shape direct; every other action reachable through visible trigger |
| All | Home idle/text editing | Clipboard, Font and Paragraph reachable without hidden scroll |
| All | Format with selection | Contextual label and all geometry/arrange actions reachable |
| All | Keyboard tab navigation | Arrow/Home/End keep focused tab visible |
| All | Overflow menu | Enter/Space opens; arrows wrap; Escape restores trigger |
| All | Insert inventory | Action count and labels unchanged |
| All | Table picker | 6×8 grid navigable with one tab stop and ≥44px touch hit areas |
| All | Popup geometry | Popup remains inside viewport and above canvas |

## Acceptance Metrics

- Document, tab list and active ribbon row satisfy `scrollWidth <= clientWidth + 1`.
- Zero clipped labels and zero visible-control intersections.
- Every critical action takes one activation at 1440, at most two at 768/1024.
- Game subtype selection may take three activations.
- Insert action inventory remains unchanged.
- Standard ribbon controls align to `28px ± 2px`; touch hit regions expand to at least 44px in touch mode.
- Focus ring and popup are fully visible.
- Table grid exposes row/column position and selected size to assistive technology.

## Tests Before

1. Extend viewport matrix to 768, 1024 and 1440 for every tab.
2. Add unconditional row/tab overflow assertions.
3. Add an Insert inventory test mapping every action to direct or overflow location.
4. Add compact overflow keyboard/focus tests.
5. Add RED table-picker role, roving-focus, arrow, Escape and hit-area tests.
6. Include Format state with a deterministic selected element fixture.

## Refactor

1. Introduce container-derived density.
2. Build one reusable named overflow group.
3. Extract action descriptors from the Insert monolith without changing callbacks.
4. Reuse descriptors for direct and compact renderers.
5. Introduce compact control primitives for mixed inputs.
6. Preserve the existing 6×8 maximum while replacing its 48 tab stops with one roving active cell.
7. Apply the same reachability strategy to all ribbon tabs.

## Tests After

- Verify all actions execute exactly once in direct and overflow presentations.
- Verify focus restoration and sibling popup closure.
- Verify density responds to panel/container changes, not only window resize.
- Verify reduced motion and no layout shift during density transition.
- Verify tooltip/accessible name parity.

## Implementation Steps

1. Build RED matrix and action inventory.
2. Implement density context and overflow primitive.
3. Convert Insert first; keep action count stable.
4. Rebuild table picker.
5. Convert Home and contextual Format.
6. Convert remaining tabs.
7. Standardize control geometry.
8. Run keyboard, geometry, inventory and visual gates.

## Regression Gate

```powershell
npx vitest run client/src/components/ribbon/ribbon-density-context.test.jsx client/src/components/ribbon/ribbon-overflow-group-menu.test.jsx client/src/components/ribbon/ribbon-section.test.jsx client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx
npx playwright test tests/e2e/ribbon/all-tabs-overflow-matrix.spec.js tests/e2e/ribbon/insert-tab-critical-controls-visibility.spec.js tests/e2e/ribbon/format-tab-vertical-rhythm.spec.js tests/e2e/ribbon/header-responsive-pressure.spec.js tests/e2e/ribbon/home-tab-text-editing-state.spec.js --project=chromium
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] Ribbon rows never hide unreachable commands.
- [x] Every Insert capability remains discoverable.
- [x] Compact menus are keyboard and screen-reader operable.
- [x] Table picker is usable by keyboard and touch.
- [x] Contextual Format remains visible and understandable.
- [x] No callback/action drift between direct and compact presentations.

## Completion Evidence

Completed 2026-07-13. Container-aware density, named overflow groups, command inventory preservation, and accessible table-picker contracts are implemented and verified by the focused ribbon gate.

## Risk Assessment

- **Duplicate action drift:** one descriptor source.
- **Over-compaction:** preserve direct high-frequency groups at wide tiers.
- **Mystery overflow:** use named groups, not a generic unlabeled ellipsis.
- **Popup collisions:** reuse existing overlay positioning/closure.
- **Monolith growth:** extract focused files instead of adding to the 900+ LOC Insert panel.
- **View-tab ownership collision:** Phase 5 consumes Phase 4's finalized panel command interface and cannot restore raw Zustand toggles.

## Accessibility And Performance

Menus use real menu semantics and deterministic focus restoration. Density changes use measurement observers and render only the active presentation, avoiding duplicate hidden interactive controls.

## Rollback

Restore direct section rendering and current overflow rows while retaining tests as regression evidence. Never remove actions.

## Next Steps

Phase 6 can run in parallel after Phase 3. Phase 7 starts after Phase 4 and this phase's touch-target policy is stable.
