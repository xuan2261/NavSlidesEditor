# Phase 06 - Docs, Manual QA, and Maintenance Loop

## Context Links

- [Plan](./plan.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Roadmap](../../docs/project-roadmap.md)
- [Changelog](../../docs/project-changelog.md)

## Overview

Priority: P2. Status: Complete. Make the verification system usable by future releases: concise docs, checklist, and maintenance rules.

## Key Insights

- Manual QA should cover only what automation cannot reasonably cover.
- Docs must say current truth, not aspirational state.
- Allowlist must shrink or stay justified.

## Requirements

- Update roadmap/changelog after implementation.
- Produce release verification checklist.
- Add maintenance cadence for allowlist and matrix.
- Keep docs short and actionable.
- Release summary must be generated from or cross-checked against the latest matrix/report outputs.
- Manual QA checklist entries must map to capability IDs or explicit manual-only risks.

<!-- Updated: Validation Session 1 - release summary must separate release-blocking MVP, bounded coverage, contract-only coverage, and dated debt. -->

## Architecture

Artifacts:

```text
docs/testing guide -> commands and policy
docs/manual smoke checklist -> human fallback
docs/project-roadmap -> phase progress
docs/project-changelog -> implemented verification improvements
plan reports -> evidence captured during work
```

Drift controls:

- `release-verification-summary.md` must include matrix command timestamp, editor-core fixed denominator, P0/P1 status, selected E2E results, contract-only coverage, and unresolved debt copied from structured reports.
- The manual checklist stays under 45 minutes by using an always-run critical path plus a rotating domain sample. Excluded domains are listed as risk, not silently dropped.
- Roadmap/changelog entries describe delivered verification only, not aspirational future coverage.
- Docs link checks or script-name contract tests are required only for docs/scripts touched by this plan.

## Related Code Files

- Modify: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`
- Create/modify: `docs/manual-smoke-checklist.md`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/release-verification-summary.md`

## Implementation Steps

1. Red: add docs contract test if docs links/scripts are expected.
2. Update manual smoke checklist with automation boundaries.
3. Update testing guide with final lane commands and interpretation.
4. Update roadmap/changelog with actual delivered changes.
5. Write release verification summary from latest matrix/report outputs: pass/fail/debt.
6. Cross-check manual checklist rows against capability IDs and manual-only risks.
7. Run docs-related tests and link checks if available.

## Todo List

- [x] Write/update manual smoke checklist.
- [x] Update testing guide.
- [x] Update roadmap.
- [x] Update changelog.
- [x] Write release verification summary.
- [x] Cross-check release summary against latest generated matrix/report evidence.

## Evidence

- Added `docs/manual-smoke-checklist.md` with under-45-minute always-run and rotating rows mapped to capability IDs or manual-only risks.
- Added `reports/release-verification-summary.md` separating release-blocking MVP, bounded coverage, contract-only coverage, and dated debt.
- Added `tests/unit/release-verification-docs-contract.test.js` to pin checklist mappings, summary honesty, and testing-guide links.
- Updated testing guide, roadmap, changelog, system architecture, and code standards with current matrix/extended-domain/CI lane truth.
- Strengthened the docs contract to sum manual runtime and validate checklist capability IDs against `scripts/feature-inventory/inventory.json`.
- Verification passed: docs/CI contract Vitest, targeted ESLint, `npm run matrix:gate`, `npm run matrix:extended-report`, and full `npm test` (249 files passed, 1 skipped; 2195 tests passed, 8 skipped).

## Success Criteria

- A maintainer can answer: what is tested, where, and by which command.
- Manual checklist is under 45 minutes.
- Manual checklist includes sampling policy and capability/risk mapping.
- Unresolved risks are listed at end of summary.

## Risk Assessment

- Risk: docs drift immediately. Mitigation: generated matrix remains source of truth; docs link to it.
- Risk: checklist gets too long. Mitigation: only manual-only items included.

## Security Considerations

- Checklist must not request secrets.
- Do not publish private environment details.

## Next Steps

Use `/ck:cook` on the plan path to implement.
