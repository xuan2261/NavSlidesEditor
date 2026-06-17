# Phase 08 Governance Docs And Final Verification

## Context Links

- [Phase 01 matrix](./phase-01-matrix-source-of-truth-and-harness.md)
- `C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md`
- `C:/Work/NavSlidesEditor/docs/project-changelog.md`
- `C:/Work/NavSlidesEditor/docs/project-roadmap.md`
- `C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md`
- `C:/Work/NavSlidesEditor/package.json`

## Overview

Priority: P0
Status: Completed
Goal: make the matrix maintainable after fixes land: docs updated, scripts integrated where useful, final verification run, unresolved decisions recorded.

## Key Insights

- `docs/feature-coverage-matrix.md` is generated; do not hand-edit.
- Project docs require changelog/roadmap updates after significant QA/fix work.
- A matrix without a gate will rot.

## Requirements

<!-- Updated: Validation Session 1 - final verification must check full Phase 01 coverage, export warning UI/report, and policy/test security scope. -->

Functional:
- Update plan progress and final report.
- Update changelog/roadmap if behavior or coverage changes.
- Add or update command docs for matrix validator.
- Run targeted tests for each completed phase.
- Verify Phase 01 produced full expected-control inventory and matrix rows for all 19 canonical element types before any control fixes were accepted.
- Classify final commands as blocking plan gates vs release-confidence signals.
- Run blocking gates: targeted phase tests, `npm run matrix:gate`, and PPTX browser audit when export rows changed.
- Run release-confidence signals: lint/full unit/full browser suites where practical; unrelated failures are reported without expanding plan scope.
- Verify export warnings are both user-visible through an export result modal/panel and captured in the machine-readable report.
- Run lightweight redaction/secret check for generated reports and docs touched by this plan.

Non-functional:
- Keep docs concise.
- No confidential data in reports.
- Do not mark plan complete if any blocking gate fails or is skipped.

## Architecture

```text
phase tests
  -> matrix validator
  -> feature matrix gate / element-control validator
  -> docs/changelog/roadmap
  -> report redaction/secret check
  -> final verification report
```

## Related Code Files

Modify/create:
- `C:/Work/NavSlidesEditor/plans/260617-0739-element-control-audit-matrix-tdd/reports/final-verification-report.md`
- `C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md`
- `C:/Work/NavSlidesEditor/docs/project-changelog.md`
- `C:/Work/NavSlidesEditor/docs/project-roadmap.md`
- `C:/Work/NavSlidesEditor/package.json` only if adding a matrix validator script

Read:
- `C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md`
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/*`

## Tests First

1. Static docs test: export-limit docs mention every accepted limit from matrix.
2. Matrix validator test from Phase 01 remains passing.
3. If a `package.json` script is added, test command is executable in CI-like environment.
4. Redaction/secret check fails if generated plan reports include tokens, local private paths from fixtures, private deck text, or uploaded file content.

Commands:

```bash
npm run matrix:gate
npm run test:pptx:browser-audit
```

Release-confidence signals:

```bash
npm run lint
npm run test
```

Optional release-grade:

```bash
npm run test:pptx:strict
```

## Implementation Steps

1. Collect phase test results.
2. Update matrix final statuses.
3. Update `docs/export-fidelity-and-limits.md`.
4. Update changelog with fixed/verified matrix work.
5. Update roadmap QA/coverage progress if materially changed.
6. Run blocking verification commands.
7. Run release-confidence signals where practical.
8. Run report redaction/secret check.
9. Write final verification report with command outputs, failures, skipped gates, unrelated failures, and residual risks.

## Todo List

- [x] Update docs.
- [x] Run lint.
- [x] Run unit tests.
- [x] Run matrix gate.
- [x] Run PPTX browser audit.
- [x] Run report redaction/secret check.
- [x] Write final verification report.
- [x] Mark plan phase statuses accurately.

## Completion Evidence

- Final verification report: `reports/final-verification-report.md`.
- Blocking gates passed: targeted export/shared/server tests, expanded targeted tests with matrix validator, `npm run matrix:gate`, `npm run test:pptx:browser-audit`, `npm run build`, and redaction scan.
- Release-confidence lint passed with 0 errors and 23 pre-existing warnings.
- `npm run matrix:gate` passes with 0 warnings and 0 failures after refreshing Vitest and tagged Playwright evidence.

## Success Criteria

- Final report lists pass/fail/skip for every command and labels each as blocking or release-confidence.
- No blocking gate is skipped; skipped blocking gate leaves the plan blocked.
- Phase 01 coverage is complete before later phase fixes are counted as done.
- Export warning UI/report contract is verified where export rows changed.
- Matrix statuses match actual tests and docs.
- Changelog/roadmap updated if implementation changed behavior/coverage.
- No unresolved export gap is hidden.
- Reports/docs contain no secrets, private uploaded content, or sensitive fixture data.

## Risk Assessment

- Risk: full tests too slow locally.
  Mitigation: targeted tests and `matrix:gate` are blocking; full suite is release-confidence unless it fails in touched code. Skipped blocking gates block completion.
- Risk: docs drift immediately.
  Mitigation: validator checks accepted limit docs.

## Red Team Review Applied

- Finding 3/15: final gates are classified; skipped blocking gates mean `BLOCKED`, not paperwork.
- Finding 15: generated reports/docs need redaction/secret checks before completion.
- Finding 4: unrelated full-suite failures are reported as release-confidence risk unless they touch this plan's files or behavior.

## Security Considerations

- Do not include private deck content, uploads, tokens, or screenshots in committed reports.
- Export docs should repeat trusted author content boundary.
- Redact command output before committing reports; never paste full sensitive fixture contents or local private media paths.

## Next Steps

After Phase 08 passes, run code review and close/supersede stale old plan findings.
