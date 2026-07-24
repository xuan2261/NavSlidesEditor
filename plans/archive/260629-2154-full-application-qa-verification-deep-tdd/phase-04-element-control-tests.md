---
phase: 4
title: "Element Control Tests"
status: completed
priority: P1
dependencies: [3]
---

# Phase 4: Element Control Tests

## Overview
Verify every canonical element type across insertion, canvas interaction, properties/ribbon controls, persistence, and export fidelity.

## Requirements
- Functional: cover text, image, shape, code, LaTeX/TikZ, HTML, Markdown, chart, video, audio, table, QR, icon, callout, drawing, line, SVG, timeline, and game elements.
- Non-functional: prefer data-driven tests and shared expectations to avoid 19 near-identical brittle specs.

## Architecture
Layer tests by depth: pure render/unit for defaults and mapping, component tests for properties controls, E2E for insertion and persistence, shared/server tests for export parity.

## Related Code Files
- Modify: `client/src/data/element-defaults.test.js`
- Modify: `client/src/components/properties/*.test.jsx`
- Modify: `client/src/components/canvas/element-renderers/*.test.jsx`
- Modify: `tests/e2e/elements/*.spec.js`
- Modify: `shared/tests/element-export-parity.test.js`
- Modify: `shared/tests/element-renderers.test.js`
- Modify: `tests/e2e/coverage-depth/editor-control-persistence.spec.js`

## Implementation Steps
1. Generate element × control expectations from `ELEMENT_DEFAULTS` and properties-panel mappings.
2. Add failing matrix rows for each missing control depth: insert, select, edit, persist, export, edge.
3. Cover geometry controls: x/y/width/height/rotation/opacity/lock/hidden/z-order/group/crop/aspect.
4. Cover element-specific controls: text formatting, image filters, chart datasets, media trim/speed, table editing, game questions, code language/theme, LaTeX fallback, Markdown/HTML safety.
5. Add export parity checks for reveal HTML, offline HTML, PDF/PPTX where supported, and explicit fallback warnings where not.

## TDD Gate
- Red: add matrix expectations proving an element/control pair is missing.
- Green: add the narrowest test or product fix needed for that pair.

## Success Criteria
- [x] Each canonical element has at least one insert/render/persist/export gate in the focused validation suite.
- [x] High-risk property controls have single-select and multi-select behavior where applicable in the focused validation suite.
- [x] Unsupported export paths emit intentional warnings, not silent loss, per existing export parity tests.

## Risk Assessment
Risk: tests assert implementation CSS too tightly. Mitigation: assert semantic state, persisted JSON, rendered output, and accessible controls first.
