---
phase: 1
title: "Interaction Repro Harness"
status: completed
priority: P0
dependencies: []
---

# Phase 01: Interaction Repro Harness

## Overview

Create failing-first regression coverage for every debug finding before behavior changes. This phase confirms the report with executable evidence and prevents accidental partial fixes.

## Requirements

- Functional: cover D1-D7 with focused tests that currently fail or are marked as bug-present tripwires.
- Non-functional: tests must be deterministic, fast, and avoid browser-only E2E unless DOM behavior cannot be tested otherwise.

## Architecture

Use existing Vitest and React Testing Library surfaces. Pure interaction math gets unit tests; UI callbacks get component tests with mocked handlers; export output gets string-level renderer assertions.

## Related Code Files

- Modify: `client/src/editor-interaction-bug-repro.test.js`
- Modify: `client/src/components/canvas/use-canvas-pointer-interaction.test.js`
- Modify: `client/src/components/canvas/canvas-element-wrapper.test.jsx`
- Modify: `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx`
- Modify: `client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx`
- Modify/Create: shared renderer test covering `shared/src/element-renderers.js`

## TDD Tests

1. D1: render a line element unselected, click its visual wrapper/line hit area, assert selection handler fires.
2. D2: call batch-move helper with two selected elements near right/bottom boundaries, assert both receive the same clamped delta.
3. D3: nudge selected element at `x=0` left and `y=0` up, assert position remains in bounds.
4. D4: select locked element and invoke `updateSelectedElements`-driven property updates, assert only lock toggle can change it.
5. D5: right-click element B while element A is selected, click Cut, assert only expected target(s) are cut/deleted and locked targets are disabled.
6. D6: marquee intersects one member of a group, assert resulting selection expands to all group members or movement expands before drag.
7. D7: render shared line HTML with thick stroke and arrowhead, assert wrapper style allows visible overflow or pads viewBox to avoid clipping.
8. Red-team gates:
   - strict lock-only update payload rejects mixed lock+geometry mutation on locked elements.
   - mixed locked group mutation is no-op for movement, geometry, z-order, cut/delete, duplicate, group/ungroup.
   - context-menu tests exercise synchronous target selection, not only menu button callbacks.
   - line clickability has a Playwright repro because JSDOM cannot prove SVG stroke hit testing.

## Implementation Steps

1. Add minimal fixtures for slide size, grouped elements, locked elements, and line elements.
2. Add pure helper tests first where helpers already exist.
3. Add `it.fails` or explicit failing assertions only for confirmed bug-present behaviors.
4. Run targeted Vitest commands and record failing tests in notes:
   - `npx vitest run client/src/editor-interaction-bug-repro.test.js`
   - `npx vitest run client/src/components/canvas/use-canvas-pointer-interaction.test.js`
   - `npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx`
   - `npx vitest run client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx`
5. Add the mandatory scoped browser repro before any Phase 06 line hit-target implementation starts:
   - `npx playwright test tests/editor-element-interactions.spec.js`

## Success Criteria

- [x] Each defect ID has a concrete regression test.
- [x] Tests fail for the expected reason before implementation.
- [x] Browser-only hit-testing defects are not claimed covered by JSDOM-only tests.
- [x] The Playwright repro file exists and fails for the expected line hit-target behavior before Phase 06 fixes.
- [x] No production source behavior is changed in this phase except test-only exports if unavoidable.

## Risk Assessment

Main risk is brittle DOM simulation around canvas transforms. Mitigate by extracting pure helpers in later phases and testing callbacks rather than pixel-perfect browser layout.
