---
title: 'PPTX Parser Benchmark Hard Plan'
description: 'Benchmark 4 JavaScript PPTX parsers for editable .pptx-only import into NavSlides.'
status: completed
priority: P1
branch: 'master'
tags: ['pptx', 'import', 'benchmark', 'parser', 'hard']
blockedBy: []
blocks: ["260424-1841-pptx-import"]
created: '2026-04-24T15:08:00+07:00'
createdBy: 'ck:plan --hard'
source: skill
---

# PPTX Parser Benchmark Hard Plan

## Overview

Benchmark 4 `.pptx` parser candidates before implementing editable import. Target: visual fidelity first; text, image, shape, and table editable first; chart, equation, OLE, SmartArt, and uncertain objects fallback to locked placeholder/snapshot. Future TODO: increase editable object coverage after parser decision.

## Parser Candidates

| Parser | Role |
| --- | --- |
| `pptxtojson` | Primary semantic JSON candidate |
| `pptx2json` | Raw OOXML/package candidate and fallback inspector |
| `ppt-parser` | Secondary semantic JSON candidate |
| `pptx-compose` | Older raw JSON/CLI baseline |

## Phases

| Phase | Name | Status | Output |
| --- | --- | --- | --- |
| 1 | [Corpus Ground Truth Inventory](./phase-01-corpus-ground-truth-inventory.md) | Completed | Baseline object/media counts |
| 2 | [Benchmark Harness Design](./phase-02-benchmark-harness-design.md) | Completed | Isolated parser runner spec |
| 3 | [Parser Execution Matrix](./phase-03-parser-execution-matrix.md) | Completed | Raw outputs and timing metrics |
| 4 | [NavSlides Mapping Feasibility](./phase-04-navslides-mapping-feasibility.md) | Completed | Mapper scorecard |
| 5 | [Decision Report And Handoff](./phase-05-decision-report-and-handoff.md) | Completed | Recommended parser strategy |

## Dependencies

- Uses existing `.pptx` corpus in `PPTX/`.
- Reads current NavSlides data model in `shared/src/types/presentation.js`.
- No LibreOffice, no Java, no Python, no `.ppt` support in this benchmark.

## Success Criteria

- Every candidate is run against all 4 sample decks or marked with exact failure reason.
- Report includes parse success, speed, memory, slide count, element coverage, media coverage, style coverage, and mapper complexity.
- Final decision states one primary parser, one fallback parser, rejected candidates, and next implementation plan scope.

## Reports

- [Research summary](./reports/research-summary.md)
- [Red-team review](./reports/red-team-review.md)
- [Validation questions](./reports/validation-questions.md)
- [Corpus ground truth](./reports/corpus-ground-truth.md)
- [Parser execution matrix](./reports/parser-execution-matrix.md)
- [Mapper feasibility scorecard](./reports/mapper-feasibility-scorecard.md)
- [Final parser decision](./reports/final-parser-decision.md)
