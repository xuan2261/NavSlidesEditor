---
title: "PPTX Import Coordinate Fidelity Hardening"
description: "Fix PPTX import drift by hardening geometry, transforms, properties, corpus gates, and editor verification."
status: completed
priority: P1
effort: "9-14d"
branch: "master"
tags: [bugfix, backend, frontend, pptx, import, critical]
blockedBy: []
blocks: []
created: "2026-04-26T14:29:47.159Z"
createdBy: "ck:plan"
source: skill
---

# PPTX Import Coordinate Fidelity Hardening

## Overview

Hard-mode plan for PPTX import fidelity. Primary problem: imported elements lose
position, coordinate, size, crop, line endpoint, transform, and style fidelity.
Current corpus passes average semantic/round-trip gates, but those gates are too
broad and hide user-visible drift.

## Scope Challenge

- Existing code: PPTX mapper, chart mapper, strict corpus harness, route tests,
  editor property E2E selectors.
- Minimum change: fix PPTX geometry/property mapping and tests.
- Complexity: server mapper/harness, one geometry helper, import UI summary,
  targeted E2E, docs.
- Selected mode: HOLD SCOPE, hard execution.

## Key Decisions

- Keep `pptxtojson` primary; no new parser unless fixture proves data missing.
- Treat `960 x 540` as canonical NavSlides canvas.
- All source PPTX units pass through one normalizer.
- Tests-first per phase. Mapper change needs synthetic unit test + gate.
- Preserve editable output first. Raster fallback only for unsupported objects.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Baseline Reproduction And Fixtures](./phase-01-baseline-reproduction-and-fixtures.md) | Completed |
| 2 | [Geometry Normalization Layer](./phase-02-geometry-normalization-layer.md) | Completed |
| 3 | [Element Property Mapping Hardening](./phase-03-element-property-mapping-hardening.md) | Completed |
| 4 | [Groups Lines And Transform Fidelity](./phase-04-groups-lines-and-transform-fidelity.md) | Completed |
| 5 | [Corpus Gates And Visual Verification](./phase-05-corpus-gates-and-visual-verification.md) | Completed |
| 6 | [Editor Integration And Import UX](./phase-06-editor-integration-and-import-ux.md) | Completed |
| 7 | [Docs Roadmap And Review](./phase-07-docs-roadmap-and-review.md) | Completed |

## Dependencies

- Source audit: `plans/reports/debug-260426-2125-deep-feature-synthesis-audit.md`
- Related docs: `docs/pptx-import-fidelity-report.md`,
  `plans/20260424-1508-pptx-parser-benchmark-hard/reports/final-parser-decision.md`
- Cook command:
  `/ck:cook D:\NCKH_2025\Para_WorkSpace\NavSlidesEditor\Projects\NavSlidesEditor\repo\plans\260426-2128-pptx-import-coordinate-fidelity-hardening\plan.md`

## Out Of Scope

- SlideCanvas decomposition except import-render compatibility fixes.
- Custom keyboard shortcuts, Slide Master, PDF editable import, analytics, MCP.

## Hard Gates

- `npm run lint`
- `npm run test -- server/services/pptx-import`
- `npm run test -- client/src/components/properties/import-fidelity-properties.test.jsx`
- `npm run test:corpus`
- Targeted Playwright import/property tests added in this plan.

## Unresolved Questions

- None.
