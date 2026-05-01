---
title: Editable PPTX Import
description: Server-side editable PPTX import using pptxtojson primary parser.
status: completed
priority: P1
branch: master
tags:
  - pptx
  - import
  - parser
blockedBy:
  - plans/20260424-1508-pptx-parser-benchmark-hard/
blocks: []
created: '2026-04-24T14:51:16.154Z'
createdBy: 'ck:plan'
source: skill
---

# Editable PPTX Import

## Overview

Implement Phase 1 editable `.pptx` import from the benchmark decision. Primary parser is `pptxtojson@2.0.2`; `pptx2json@0.0.10` is fallback metadata inspector only. Supported editable objects: text, image, shape, table. Unsupported objects become locked placeholders. Parser runs server-side in a child process behind ZIP budget guards.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Parser API Boundary](./phase-01-parser-api-boundary.md) | Completed |
| 2 | [Intermediate Model And Adapters](./phase-02-intermediate-model-and-adapters.md) | Completed |
| 3 | [NavSlides Mapper](./phase-03-navslides-mapper.md) | Completed |
| 4 | [Homepage Import Flow](./phase-04-homepage-import-flow.md) | Completed |
| 5 | [Corpus Validation And Docs](./phase-05-corpus-validation-and-docs.md) | Completed |

## Dependencies

- Benchmark decision: [final-parser-decision.md](../20260424-1508-pptx-parser-benchmark-hard/reports/final-parser-decision.md)
- Corpus evidence: [corpus-ground-truth.md](../20260424-1508-pptx-parser-benchmark-hard/reports/corpus-ground-truth.md)
- Mapping rubric: [mapper-feasibility-scorecard.md](../20260424-1508-pptx-parser-benchmark-hard/reports/mapper-feasibility-scorecard.md)

## Public Interface

- `POST /api/pptx/import` with multipart field `file`.
- Client helper: `api.importPptx(file)`.
- Response: presentation payload, import stats, normalized warnings.
