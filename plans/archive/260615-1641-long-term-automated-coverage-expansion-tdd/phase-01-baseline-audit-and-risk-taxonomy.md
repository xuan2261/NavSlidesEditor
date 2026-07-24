# Phase 01 - Baseline Audit And Risk Taxonomy

## Context Links

- [Plan](./plan.md)
- [Feature Coverage Matrix](../../docs/feature-coverage-matrix.md)
- [Testing Guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Manual Smoke Checklist](../../docs/manual-smoke-checklist.md)
- `scripts/feature-inventory/feature-manifest.json`
- `tests/e2e/`
- `client/src/`
- `server/`
- `shared/src/`

## Overview

Priority: P0  
Status: completed-with-concerns  
Description: Establish the real coverage baseline before writing new tests. Current matrix is green, but it does not prove every control has persistence/export/live behavior coverage.

## Key Insights

- Existing matrix is capability-level, not exhaustive workflow-level proof.
- Several domains already have E2E files; avoid duplicating them blindly.
- Long-term coverage needs a taxonomy that prevents false confidence, not just more tests.

## Requirements

- Regenerate current test and matrix reports.
- Inventory test files by domain and execution cost.
- Classify capabilities by user risk and required proof depth.
- Identify manual-smoke rows that should become automated.
- Produce an actionable backlog table, not only narrative findings.

## Architecture

Use the existing feature-inventory pipeline as the source for current coverage. Add a read-only audit report first; do not change gates until Phase 2.

```text
test suite -> run results -> matrix -> audit report -> phase backlog
```

## Related Code Files

Modify:
- None in this phase unless adding a generated report script is clearly needed.

Create:
- `plans/260615-1641-long-term-automated-coverage-expansion-tdd/reports/baseline-audit-report.md`

Delete:
- None.

## Implementation Steps

1. Run `npm run test`, `npm run matrix:baseline-report`, and inspect generated outputs.
2. Read `docs/manual-smoke-checklist.md` and map each row to automated candidates.
3. Scan `tests/e2e`, `tests/unit`, `client/src/**/*.test.*`, `server/**/*.test.*`, and `shared/tests`.
4. Categorize existing tests by layer: unit, component, E2E, visual, a11y, load, corpus, contract.
5. Mark gaps by missing assertion type: UI action, state, persistence, export, live sync, error path.
6. For each gap, assign owner phase, target layer, estimated test count, expected runtime impact, and automation/manual disposition.
7. Write a concise baseline audit report.

## Todo List

- [x] Regenerate matrix baseline; record stale/blocked test-run baseline.
- [x] Inventory current test domains and costs.
- [x] Classify risk tiers and required proof depth.
- [x] Produce baseline audit report.

## Phase 01 Results

- Baseline report: [baseline-audit-report.md](./reports/baseline-audit-report.md)
- `npm run matrix:baseline-report` regenerated inventory/matrix and passed coverage gate, then failed because `scripts/feature-inventory/run-results-vitest.json` was stale.
- `npm run test` timed out after 126s; `npx vitest run --reporter=json --outputFile=scripts/feature-inventory/run-results-vitest.json` timed out after 300s.
- No production or test behavior changed.

## Success Criteria

- Baseline report lists concrete gaps with target test layer.
- Backlog rows include `capability`, `risk`, `missing proof`, `target layer`, `owner phase`, `test budget`, and `manual disposition`.
- No production or test behavior changed yet.
- Future phases have specific acceptance criteria.

## Red Team Notes

- Accepted finding: a read-only audit without a normalized backlog will not drive implementation. Phase 1 must output a table that later phases can execute directly.

## Risk Assessment

- Risk: spending time chasing raw line coverage. Mitigation: prioritize behavior and regression risk.
- Risk: stale generated matrix. Mitigation: regenerate before making decisions.

## Security Considerations

- Do not include local secrets from `server/data`, `server/uploads`, reports, or coverage artifacts.
- External provider behavior stays contract-only unless test credentials are explicitly available.

## Next Steps

- Feed the classified gaps into Phase 2 matrix expansion.
- Phase 2 should expose run-result freshness and depth labels as warn-first evidence before adding strict gates.

## Unresolved Questions

- None.
