# Phase 07 - CI Governance Docs And Release Adoption

## Context Links

- [Plan](./plan.md)
- [Testing Guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Manual Smoke Checklist](../../docs/manual-smoke-checklist.md)
- [Project Roadmap](../../docs/project-roadmap.md)
- [Project Changelog](../../docs/project-changelog.md)
- `.github/workflows/`

## Overview

Priority: P0  
Status: completed-with-concerns  
Description: Convert the expanded test coverage into maintainable governance: scripts, docs, CI lane policy, release evidence, and reduced manual smoke where automation is reliable.

## Key Insights

- New gates should start warn-first unless already deterministic.
- Evergreen docs are the contract; plan reports are provenance.
- Manual smoke should shrink only when automation has equivalent confidence.

## Requirements

- Update docs after implementation.
- Keep branch protection operator-controlled.
- Do not silently make expensive/flaky checks required.
- Document commands, owners, and rollback path.
- Do not remove a manual smoke row unless the replacing automation proves the same user-observable risk.
- <!-- Updated: Validation Session 1 - all new gates start warn-first unless existing required jobs already cover them. -->

## Architecture

```text
local commands -> CI jobs -> required-checks fan-in -> docs/release evidence
```

## Related Code Files

Modify:
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` if gate promotion is approved.
- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- `docs/manual-smoke-checklist.md`
- `docs/project-roadmap.md`
- `docs/project-changelog.md`
- `docs/code-standards.md` if tag conventions changed.

Create:
- Plan-scoped final validation report under `reports/`.

Delete:
- None.

## Implementation Steps

1. Summarize new test commands and coverage-depth semantics.
2. Update docs with PR lane, merge lane, release strict lane changes.
3. For each manual-smoke row, mark one of: `manual-only`, `automated-backed`, `replaced-by-automation`, or `deferred-risk`.
4. Move a manual row out only when the automation asserts the same data/artifact/user-visible outcome.
5. Add CI jobs only after local reliability is proven.
6. Keep newly risky gates warn-first until promotion criteria are met.
7. Record CI promotion evidence: command, date, branch, two green run links or local run artifacts.
8. Run final validation commands and write final report.

## Todo List

- [x] Update testing guide.
- [x] Update manual smoke checklist.
- [x] Update roadmap/changelog.
- [x] Adjust CI only for approved deterministic checks.
- [x] Write final validation report.

## Completion Notes

- Testing guide now records non-functional gate ownership and local reproduction commands for visual, a11y/touch, k6 smoke, and release-only load/stress profiles.
- Manual smoke checklist rows now declare `automated-backed` or `manual-only` disposition without removing rows whose manual value remains release-relevant.
- CI visual gate was aligned with existing deterministic visual suite scope; no branch-protection or required-check promotion was added.
- Final validation report written to [final-validation-report.md](./reports/final-validation-report.md).

## Success Criteria

- Developers know which command proves which risk.
- Release evidence is evergreen and not tied only to this plan.
- Manual checklist is shorter or more explicit.
- Final validation commands are recorded with pass/fail status.
- Any required-check change has explicit operator approval or remains documented as proposed/warn-first.
- New gate promotion cites deterministic local reproduction plus two target-branch green runs.

## Risk Assessment

- Risk: CI becomes too slow. Mitigation: keep release-only strict lane.
- Risk: docs drift. Mitigation: generated matrix and evergreen docs both updated.
- Risk: deleting manual smoke creates blind spots. Mitigation: keep manual-only rows unless automation proves equivalent user-observable risk.

## Security Considerations

- Run release artifact secret scan before sharing reports.
- Never commit credentials or local provider config.

## Next Steps

- Use Phase 7 evidence as the handoff for operator-controlled CI promotion after two target-branch green runs.

## Verification

- `npx vitest run tests/unit/release-verification-docs-contract.test.js tests/unit/github-actions-ci-release-confidence-contract.test.js tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` - passed, 12 tests.
- `npm run matrix:gate` - passed, 0 warnings, 0 failures.
- `npm run lint` - passed with 23 pre-existing warnings.
- `npm run build` - passed.
- `npm run test` - passed on 2026-06-16 with 300 test files passed, 1 skipped; 2511 tests passed, 1 skipped.
- `npm run test:e2e` - passed on 2026-06-16 with 475 passed, 22 skipped, and 0 retry-passed flakes.
- `npm run test:load:api:smoke` and `npm run test:load:ws:smoke` - passed on 2026-06-16.

## Concerns

- No required-check promotion was performed because this session does not have two target-branch green CI links.
- Full release strict lane and Linux visual snapshots remain target-environment validation items; latest local full-suite E2E has no retry-passed flakes.

## Red Team Notes

- Accepted finding: CI/manual-smoke changes need operational proof. Phase 7 now requires row-level disposition and explicit promotion evidence.

## Unresolved Questions

- None.
