# Phase 01 - Baseline and Verification Contract

## Context Links

- [Plan](./plan.md)
- [Feature coverage matrix](../../docs/feature-coverage-matrix.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Existing matrix plan](../260530-0854-feature-coverage-traceability-matrix-system-tdd/plan.md)

## Overview

Priority: P1. Status: Pending. Establish exact baseline and rules before writing more tests. Output is a verified gap list and contract doc section.

## Key Insights

- Current matrix says 73/100 PASS, 27 ALLOWED.
- PASS must mean tagged test ran green, not tag exists.
- High-risk gaps need deep behavior tests or explicit debt.

## Requirements

- Run current baseline commands.
- Identify all `ALLOWED`, `DEEP-GAP`, `TAGGED`, `SKIP`, and orphan tags.
- Classify each gap by risk, layer, and target test type.
- Keep generated docs generated; do not hand-edit generated matrix.

## Architecture

Use existing inventory pipeline:

```text
feature-manifest + registries -> inventory -> test tags + run JSON -> matrix -> gate
```

Plan only adds contract clarifications and reports, not a new system.

## Related Code Files

- Modify: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Modify: `scripts/feature-inventory/coverage-gate-allowlist.json`
- Read: `docs/feature-coverage-matrix.md`
- Read: `scripts/feature-inventory/feature-manifest.json`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/baseline-gap-report.md`

## Implementation Steps

1. Red: add/update a small test or gate assertion proving stale/undated allowlist debt is visible.
2. Run `npm run matrix:gate`; capture PASS/ALLOWED counts.
3. Generate `baseline-gap-report.md` listing each gap with proposed owner layer.
4. Define policy: PASS, DEEP PASS, VISUAL PASS, MANUAL REQUIRED, ALLOWED.
5. Update testing guide with concise policy and commands.
6. Green: adjust allowlist metadata/check as needed.
7. Refactor: remove duplicate wording and keep docs concise.

## Todo List

- [ ] Capture baseline matrix and gate output.
- [ ] Produce gap report.
- [ ] Document verification semantics.
- [ ] Add stale allowlist rule if missing.
- [ ] Run `npm run matrix:gate`.

## Success Criteria

- Baseline report exists and is actionable.
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
