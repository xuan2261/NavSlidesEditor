---
title: "PPTX Import Gates And Parser Coverage TDD Plan"
description: "Align strict PPTX corpus/browser gates with docs and add minimal OOXML coverage-gap reporting for chart and SmartArt."
status: complete
priority: P1
effort: 10h
branch: master
tags: [pptx-import, backend, docs, test, tdd]
blockedBy: []
blocks: []
created: 2026-06-17
---

# PPTX Import Gates And Parser Coverage TDD Plan

## Overview

TDD plan for 3 linked fixes: lock one strict corpus threshold contract, make `npm run test:pptx:strict` run corpus plus smoke audit, and surface OOXML chart/SmartArt coverage gaps without rewriting the importer. Current drift spans scripts, code, and docs: `package.json:50-54`, `server/services/pptx-import/pptx-import-corpus-cli.js:36-55`, `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:20-25`, `README.md:282-287`, `docs/project-roadmap.md:79-80`, `docs/pptx-import-fidelity-report.md:103-110,351-390`.

## Cross-Plan Dependencies

No active blocking plan found in `plans/`; `pptx` hits from repo scan were limited to `plans/archive/**`.

## Phases

| Phase | Name | Status |
| --- | --- | --- |
| 1 | [Lock Corpus Threshold Contract](./phase-01-lock-corpus-threshold-contract.md) | Complete |
| 2 | [Make Strict Browser Gate Smoke-First](./phase-02-make-strict-browser-gate-smoke-first.md) | Complete |
| 3 | [Add OOXML Native Object Coverage Inspection](./phase-03-add-ooxml-native-object-coverage-inspection.md) | Complete |
| 4 | [Sync Docs And Run Final Verification](./phase-04-sync-docs-and-run-final-verification.md) | Complete |

## Dependency Graph

`Phase 1 -> Phase 2 -> Phase 3 -> Phase 4`

## Global Success Criteria

- `npm run test:corpus` strict thresholds, baseline metadata, failure messaging, and docs point to one canonical gate set.
- `npm run test:pptx:strict` runs corpus plus smoke browser audit; full audit remains explicit through `npm run test:pptx:browser-audit:full`.
- Import results expose additive OOXML native-object coverage stats/warnings for chart and SmartArt evidence gaps.
- Existing API contracts stay backward compatible; only additive stats/warnings are introduced.
- Focused Vitest slices cover thresholds, script orchestration, and OOXML inspection seams before full gate commands run.

## Validation

```bash
npx vitest run server/services/pptx-import/pptx-import-corpus-cli.test.js server/services/pptx-import/corpus-baseline.test.js
npx vitest run scripts/run-pptx-browser-audit.test.js tests/unit/pptx-import-audit-helper.test.js
npx vitest run server/services/pptx-import/ooxml-native-object-inspector.test.js server/services/pptx-import/mapper/map-presentation.test.js server/services/pptx-import/pptx-import-e2e-flow.test.js tests/unit/pptx-import-docs-contract.test.js
npm run test:corpus
npm run test:pptx:strict
npm run test:pptx:browser-audit:full
```

## Completion Notes

- Implemented strict gate canonical metadata, smoke-first strict command, and
  per-slide OOXML native chart/SmartArt relationship evidence reporting.
- Reviewer findings were addressed: unused package parts are ignored, duplicate
  relationships are deduped per slide, cross-slide mapped charts do not hide
  gaps, importer stats boundary is covered, and docs contract checks required
  docs individually.
- Final reviewer re-check hit rate limiting, so completion relies on local
  verification plus the first reviewer findings being explicitly resolved.

## Out Of Scope

- Rewriting `pptxtojson` or building native SmartArt rendering/editor support.
- Changing CI/release workflow files outside this repo scope.
- Expanding the smoke deck list beyond the current helper contract unless tests show the subset is invalid.
- UI redesign work beyond additive warning/stat plumbing.
