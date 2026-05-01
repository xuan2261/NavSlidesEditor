---
title: "Full Fidelity PPTX Import v2"
description: "Full-fidelity PPTX import: rich HTML preservation, 15 shape types, real line coords, image metadata, full tables, slide metadata, groups/SmartArt, charts, and round-trip fidelity testing. Phase 0 addresses P0 blockers from plan review."
status: completed
priority: P1
branch: "master"
tags:
  - pptx
  - import
  - full-fidelity
  - round-trip
blockedBy:
  - plans/260424-1841-pptx-import/
blocks: []
created: "2026-04-25T03:27:11.808Z"
createdBy: "ck-cli"
source: cli
reviewedBy: "debug-260425-1102-pptx-full-fidelity-plan-review.md"
---

# Full Fidelity PPTX Import v2

## Overview

Phase 1 (shipped 2026-04-24) implemented basic PPTX import with ~60-100% data loss across element types. This Phase 2 delivers full-fidelity import. **Revised after plan review** to address P0 blockers (sanitizer, text schema) and correct scope estimates.

**Key design decision change (from review):** Keep `element.content` as HTML string — do NOT switch to TipTap JSON. Maintain backward compatibility. Improve sanitizer + HTML parser to preserve formatting from source.

**Target fidelity per element type:**
| Element | Target | Key deliverable |
|---|---|---|
| Text | 98% | Rich HTML (bold, italic, color, font, alignment, lists, links) |
| Shapes | 95% | 15 mapped types, gradient fills, stroke styles |
| Lines | 95% | Real coordinates, arrow types, line styles |
| Images | 100% | Crop, flip, border, objectFit preserved |
| Tables | 90% | Merged cells, per-cell styling, borders |
| Charts | 85% | Interactive Chart.js, multi-series editable |
| Groups | 90% | Flattened children with transforms |
| SmartArt | 80% | Individual elements or SVG |
| Slides | 80% | Transitions, gradient backgrounds |

**Total effort:** ~3.5 weeks, sequential phases (added Phase 0)

## Phases

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 0 | [Schema Compatibility + Sanitizer Hardening](./phase-00-sanitizer-hardening.md) | P0 | 0.5-1 day | ✅ Complete |
| 1 | [Rich HTML Preservation + PPTX Text Export](./phase-01-rich-html-preservation.md) | P1 | 2-3 days | ✅ Complete |
| 2 | [Image/Line/Supported Shape Fidelity](./phase-02-shape-line-image-enhancement.md) | P1 | 2 days | ✅ Complete |
| 3 | [Table Full Support](./phase-03-table-full-support.md) | P1 | 3-4 days | ✅ Complete |
| 4 | [Chart Data Import + Multi-Series Editor](./phase-04-chart-component.md) | P1 | 3-4 days | ✅ Complete |
| 5 | [Slide Metadata + Resolution](./phase-05-slide-metadata.md) | P2 | 1-2 days | ✅ Complete |
| 6 | [Groups/SmartArt Flattening](./phase-06-group-and-smartart.md) | P2 | 2-3 days | ✅ Complete |
| 7 | [Fidelity Harness + Corpus](./phase-07-round-trip-fidelity-testing.md) | P1 | 3-4 days | ✅ Complete |

**Phase order changed from review:**
- Added **Phase 0** as P0 blocker (sanitizer must be fixed BEFORE any content processing)
- **Charts moved to Phase 4** (needs Phase 1 text fixes first for data labels)
- **Slide metadata moved to Phase 5** (after chart so transitions can use slide-level data)
- **Groups moved to Phase 6** (complex, needs solid mapper contract first)
- **Fidelity stays Phase 7** (needs all phases complete)

## Dependencies

- Phase 1 baseline: [plans/260424-1841-pptx-import/](../260424-1841-pptx-import/plan.md) — completed 2026-04-24
- Plan review: [plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md](../reports/debug-260425-1102-pptx-full-fidelity-plan-review.md)
- Research reports:
  - [plans/reports/researcher-260425-0939-pptxtojson-analysis.md](../reports/researcher-260425-0939-pptxtojson-analysis.md) — library overview
  - [plans/reports/researcher-260425-0946-pptxtojson-schema.md](../reports/researcher-260425-0946-pptxtojson-schema.md) — output schema

## Modules to Create

| Module | Phase | Purpose |
|--------|-------|---------|
| `server/services/pptx-import/chart-output-to-navslides-mapper.js` | 4 | pptxtojson chart → NavSlides chart schema |
| `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | 7 | Semantic + round-trip fidelity diff tool + CLI |
| `server/services/pptx-import/pptx-import-e2e-flow.test.js` | 7 | Integration tests for full import pipeline |
| `server/data/test-corpus/` | 7 | Directory for test PPTX corpus files |
| `docs/pptx-import-fidelity-report.md` | 7 | Phase 7 fidelity report |

## Modules to Modify

| Module | Phases | Changes |
|--------|--------|---------|
| `server/services/pptx-import/sanitize.js` | 0 | Extend SAFE_STYLE_PROPS, add href attr, fix text-decoration |
| `server/services/pptx-import/mapper.js` | 0-6 | Schema compat, array return contract, all element mappers, group flattener, diagram flattener (inlined) |
| `server/services/pptx-import/importer.js` | 5 | Pass through presentation metadata |
| `client/src/utils/export-pptx-text-runs.js` | 1 | Enhanced HTML → pptxgenjs text runs with full marks |
| `client/src/utils/export-pptx-basic-renderers.js` | 2-3 | Shape/line/table export with new metadata |
| `client/src/utils/export-pptx-background.js` | 5 | Gradient background export |
| `client/src/data/element-defaults.js` | 3, 4 | Extended table + chart schema |
| `client/src/components/SlideCanvas.jsx` | 3, 5 | Table renderer (merged cells), gradient bg |
| `client/src/components/properties/table-properties.jsx` | 3 | Per-cell styling editor |
| `client/src/components/properties/chart-properties.jsx` | 4 | Multi-series chart editor |
| `server/services/pptx-import/mapper.test.js` | 0-6 | Tests per phase |
| `server/routes/pptx-import.test.js` | 7 | Integration tests |

## Key Design Decisions

1. **Text representation: HTML string (NOT TipTap JSON).** Backward compatibility critical. Improve sanitizer + parser, not schema.
2. **Shape fidelity: 15 types (not 20+).** `shapeUtils.js` + `getShapeType()` support 14-15 shapes. Custom paths → SVG fallback.
3. **Color handling:** Fix `colorValue()` for gradient, 'none', scheme colors. Store as sidecar `_pptxMeta` if needed.
4. **Group flattening:** Change `mapElement()` contract to always return array. Update zIndex/stats logic.
5. **Chart fidelity: data fidelity (85%), NOT visual parity.** Multi-series editor required.
6. **Fidelity metrics: TWO separate metrics.** (a) Semantic: pptxtojson → NavSlides. (b) Round-trip: NavSlides → PPTX → NavSlides.

## Risks

1. **Sanitizer change may break existing import behavior** — test carefully with Phase 1 corpus
2. **Shape overstated** — plan claimed 20+, actual is 15. Still significant improvement from 6.
3. **Table effort still underestimated** — revised to 3-4 days to cover canvas+editor+export
4. **Chart multi-series editing** — chart-properties panel needs rewrite
5. **Group array return** — mapper contract change affects all existing element handlers
