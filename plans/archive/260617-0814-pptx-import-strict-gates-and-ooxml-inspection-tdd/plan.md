# PPTX Import Strict Gates And OOXML Inspection TDD

Superseded by planner-owned plan
`plans/260617-0815-pptx-import-gates-and-parser-coverage-tdd/`. This file
records the same implementation scope and is retained for traceability.

## Context

- Scope follows the PPTX import brainstorm: strict gate truth, browser audit cost, and native OOXML chart/SmartArt visibility.
- Main touchpoints: `package.json`, `server/services/pptx-import/*`, `README.md`, `docs/*`.
- Baseline: `npm run test:corpus` passes with average semantic 100.0% and average round-trip 70.0%; current strict round-trip floor is 50%.

## Phases

| Phase | Status | Progress | Link |
| --- | --- | --- | --- |
| 01 | Superseded | 100% | [Strict corpus gate truth](phase-01-strict-corpus-gate-truth.md) |
| 02 | Superseded | 100% | [Strict PPTX smoke audit](phase-02-strict-pptx-smoke-audit.md) |
| 03 | Superseded | 100% | [OOXML chart SmartArt inspection](phase-03-ooxml-chart-smartart-inspection.md) |
| 04 | Superseded | 100% | [Docs and validation](phase-04-docs-and-validation.md) |

## Acceptance

- Strict corpus CLI reports gate thresholds from the same constants it enforces.
- `npm run test:pptx:strict` runs corpus plus strict smoke browser audit; full audit remains available separately.
- PPTX import exposes additive OOXML chart/SmartArt coverage stats and warnings when native objects degrade during mapping.
- Docs match actual commands and gate thresholds.
- Focused tests pass, then corpus/build/lint are run when feasible.
