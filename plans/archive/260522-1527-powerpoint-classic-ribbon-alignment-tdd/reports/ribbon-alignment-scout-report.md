---
title: "Ribbon Alignment Scout Report"
status: complete
created: 2026-05-22
---

# Ribbon Alignment Scout Report

## Summary

Existing ribbon is already close to PowerPoint classic. Main risk is inconsistency drift: repeated tab wrapper classes, one-off empty states, and layout tests that verify outcomes but not the shared contract.

## Relevant Files

| File | Observation |
| --- | --- |
| `client/src/components/ribbon/ribbon-panel.jsx` | Panel shell. Height 80px. Active tab panels `flex items-center h-full w-full`. |
| `client/src/components/ribbon/ribbon-section.jsx` | Shared section primitive. Content centered, label bottom centered. |
| `client/src/components/ribbon/home-tab-content.jsx` | Left-flow sections. Good classic baseline. |
| `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` | Six groups. Good classic grouping, dense. |
| `client/src/components/ribbon/design-tab-content.jsx` | Left-flow, good. Navigation group dense icon-only. |
| `client/src/components/ribbon/transitions-tab-content.jsx` | PowerPoint-like order: transition, slide, speed, auto-advance, preview. |
| `client/src/components/ribbon/ribbon-element-animation-effect-controls-tab-content.jsx` | Good contextual behavior, needs disabled/empty state check. |
| `client/src/components/ribbon/ribbon-view-mode-controls-content.jsx` | Good tool/window groups. |
| `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` | Contextual tab. Empty state visually diverges. |
| `tests/e2e/ribbon-layout.spec.js` | Strong overflow/clipping matrix. Add classic contract assertions. |
| `tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js` | Good visual baseline. Needs selected-element Format state. |

## Key Risks

- Refactor may accidentally break TipTap selection preservation in Home text controls.
- Over-tightening 1024/768 expectations can fight intentional horizontal scroll.
- Visual snapshot updates can mask real regressions if not paired with geometry assertions.

## Recommended Test Emphasis

- Unit tests for class/DOM contract.
- E2E geometry for group left-flow and no overlap.
- Visual snapshots for all tabs plus Format selected/empty states.
- Keyboard tests for tablist and dropdowns remain mandatory.

## Unresolved Questions

- None.
