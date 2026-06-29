---
phase: 1
title: "Research Baseline"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Research Baseline

## Overview
Establish the current truth before adding tests: regenerate inventories, inspect existing plans, map stale evidence, and define the risk-ranked QA scope.

## Requirements
- Functional: enumerate all app capabilities from README, `client/src/data/element-defaults.js`, variant registries, route registries, ribbon config, properties panels, plugin runtime, Electron shell, server routes, Socket.IO handlers, and existing test manifests.
- Non-functional: keep output machine-readable, repeatable, and independent of stale manual reports.

## Architecture
Use source-derived inventory as the authority, then compare against existing tests and plans. Produce one baseline report consumed by Phase 2 matrix generation.

## Related Code Files
- Read: `README.md`
- Read: `client/src/data/element-defaults.js`
- Read: `client/src/components/ribbon/ribbon-tabs-config.js`
- Read: `client/src/components/PropertiesPanel.jsx`
- Read: `server/index.js`
- Read: `server/routes/*.js`
- Read: `server/services/socket-handler.js`
- Modify: `scripts/feature-inventory/*` only if inventory gaps are found
- Create: `plans/260629-2154-full-application-qa-verification-deep-tdd/reports/baseline.md`

## Implementation Steps
1. Run `npm run inventory`, `npm run matrix`, and `npm run matrix:extended-report`.
2. Extract canonical element types, element variants, controls, routes, pages, modals, commands, shortcuts, sockets, exports, imports, plugins, Electron entrypoints, and background jobs.
3. Compare inventory against relevant existing plans and reports; mark stale, superseded, or reusable evidence.
4. Classify each capability as P1/P2/P3 by user impact and defect blast radius.
5. Record current validator failures without fixing product code in this phase.

## TDD Gate
- Red: add a failing unit test if a source feature cannot be represented in inventory.
- Green: update inventory extraction to include that feature family.

## Success Criteria
- [x] Baseline report lists all major app surfaces and stale evidence.
- [x] Canonical element count matches `Object.keys(ELEMENT_DEFAULTS).length`.
- [x] Variant inventories include games, shapes, charts, layouts, themes, transitions, design presets, FX backgrounds, and ribbon insert sub-actions as Phase 2 required rows.
- [x] No capability family is represented only by prose in the Phase 2 inputs.

## Risk Assessment
Risk: inventory overfits README marketing text. Mitigation: source-derived rows win; README claims become audit candidates.
