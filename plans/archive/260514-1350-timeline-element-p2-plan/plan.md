---
title: "Timeline Element P2 Plan"
description: "Implement a first-class timeline slide element using local NavSlides architecture, not upstream cherry-picks."
status: cancelled
priority: P2
effort: 16-23h
created: 2026-05-14
source: ../260514-1024-upstream-feature-audit-and-port-roadmap/reports/timeline-element-feasibility-report.md
---

# Timeline Element P2 Plan

## Goal

Add a first-class `timeline` element only if it solves a real presentation workflow beyond the current timeline slide template and fragment animation timeline.

## Scope

- New `timeline` element type.
- Date/year range support, including BCE-style negative years.
- Event items with label, description, optional image, side, and connector offset.
- Canvas renderer, properties panel, insert flow, and shared reveal/export renderer.
- Unit and Playwright tests for edit, persistence, present/export.

## Out Of Scope

- Plugin architecture.
- Remote data-backed timelines.
- Marketplace/templates work.
- Cherry-picking upstream monolithic file changes.

## Architecture

```text
shared/src/types/presentation.js
  -> TimelineElement
client/src/data/element-defaults.js
  -> default timeline object
client/src/components/canvas/element-renderers/timeline-element-renderer.jsx
  -> editor renderer
client/src/components/properties/timeline-properties.jsx
  -> event/date/image controls
shared/src/element-renderers.js
  -> present/export renderer
```

## Phases

| Phase | Status | Goal |
| --- | --- | --- |
| 1 | Cancelled | Final UX/schema decision |
| 2 | Cancelled | Shared type/default/renderer tests |
| 3 | Cancelled | Canvas renderer |
| 4 | Cancelled | Properties panel |
| 5 | Cancelled | Insert/persistence/export integration |
| 6 | Cancelled | E2E and docs |

## Success Criteria

- Timeline edits persist across save/reload.
- Present/export output matches canvas enough for normal usage.
- No collision with `AnimationTimeline.jsx`.
- All normal gates pass.

## Verification

```powershell
npm run lint
npm run build
npm run test
npm run test:e2e -- tests/e2e/element-properties.spec.js tests/e2e/export.spec.js
```

## Unresolved Questions

- Which timeline workflow should drive MVP: project roadmap, historical chronology, or research milestones?
