# Phase 01 - Baseline and Verification Contract

## Context Links

- [Plan](./plan.md)
- [Feature coverage matrix](../../docs/feature-coverage-matrix.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Existing matrix plan](../260530-0854-feature-coverage-traceability-matrix-system-tdd/plan.md)

## Overview

Priority: P1. Status: Complete. Establish exact baseline and rules before writing more tests. Output is a verified gap list and contract doc section.

## Key Insights

- Current matrix says 73/100 PASS, 27 ALLOWED.
- PASS must mean tagged test ran green, not tag exists.
- High-risk gaps need deep behavior tests or explicit debt.

## Requirements

- Run current baseline commands.
- Identify all `ALLOWED`, `DEEP-GAP`, `TAGGED`, `SKIP`, and orphan tags.
- Classify each gap by risk, layer, and target test type.
- Keep generated docs generated; do not hand-edit generated matrix.
- Freeze the editor-core denominator used by this plan before Phase 4 adds any extended domain IDs.
- Produce a machine-readable baseline report contract that later phases can validate.

<!-- Updated: Validation Session 1 - baseline JSON is authoritative and must be deterministically generated from matrix/manifest/run output. -->

## Architecture

Use existing inventory pipeline:

```text
feature-manifest + registries -> inventory -> test tags + run JSON -> matrix -> gate
```

Plan only adds contract clarifications and reports, not a new system.

Baseline report schema:

```json
{
  "generatedAt": "2026-05-31T00:00:00.000Z",
  "editorCoreBaselineTotal": 100,
  "gaps": [
    {
      "capId": "editor.autosave",
      "currentStatus": "ALLOWED",
      "risk": "P0",
      "ownerLayer": "client",
      "targetLayer": "playwright",
      "blockingReason": "missing failed-save coverage",
      "resolutionPhase": 2,
      "debtAllowedUntil": "2026-06-30"
    }
  ]
}
```

The Markdown report may summarize the JSON, but Phase 2 consumes the structured fields. The report is invalid if any `ALLOWED`, `DEEP-GAP`, `SKIP`, or orphan tag from the current matrix is missing.

## Related Code Files

- Modify: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Modify: `scripts/feature-inventory/coverage-gate-allowlist.json`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/baseline-gap-report.json`
- Read: `docs/feature-coverage-matrix.md`
- Read: `scripts/feature-inventory/feature-manifest.json`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/baseline-gap-report.md`

## Implementation Steps

1. Red: add/update a small test or gate assertion proving stale/undated allowlist debt is visible.
2. Run `npm run matrix:gate`; capture PASS/ALLOWED counts.
3. Generate `baseline-gap-report.json` and `baseline-gap-report.md` from the same source; the JSON is the source of truth and must not be manually assembled.
4. Validate the report covers every current `ALLOWED`, `DEEP-GAP`, `SKIP`, and orphan tag.
5. Define policy: `PASS`, `ALLOWED`, `MISSING`; keep deep/visual/manual as metadata, not new gate states unless already supported.
6. Update testing guide with concise policy and commands.
7. Green: adjust allowlist metadata/check as needed.
8. Refactor: remove duplicate wording and keep docs concise.

## Todo List

- [x] Capture baseline matrix and gate output.
- [x] Produce structured gap report and Markdown summary.
- [x] Freeze editor-core denominator for this plan.
- [x] Document verification semantics.
- [x] Add stale allowlist rule if missing.
- [x] Run `npm run matrix:gate`.

## Implementation Evidence

- `npm run matrix:baseline-report` generated `reports/baseline-gap-report.json` and `reports/baseline-gap-report.md`.
- Baseline: 75/100 PASS, 25 ALLOWED, 0 orphan tags, editor-core denominator frozen at 100.
- Baseline JSON has `staleRunResults: false`; report generation now refuses stale matrix input.
- `npm run matrix:gate` passed with 25 allowlist warnings and 0 failures.
- Targeted tests passed: `npx vitest run scripts/feature-inventory/check-coverage-gate.test.mjs scripts/feature-inventory/baseline-gap-report.test.mjs`.
- Full `npx vitest run --reporter=json --outputFile=scripts/feature-inventory/run-results-vitest.json` produced fresh run-results but reported 3 unrelated failing suites; do not treat full `npm test` as green yet.

## Success Criteria

- Baseline report exists and is actionable.
- Baseline JSON validates against all current matrix gaps.
- No ambiguous "tested" language remains.
- Every allowed gap has reason, date, and target resolution path.

## Risk Assessment

- Risk: baseline commands fail due unrelated existing issue. Mitigation: record failure, isolate if plan-critical.
- Risk: too much policy. Mitigation: one concise table in testing guide.

## Security Considerations

- Do not include secrets or local absolute user data in reports.
- Loopback guards stay intact for E2E data cleanup.

## Next Steps

Phase 2 consumes the gap report to write tests.
