# Phase 05 - CI Gates and Release Confidence

## Context Links

- [Plan](./plan.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [GitHub workflows](../../.github/workflows)

## Overview

Priority: P1. Status: Complete. Turn verification into repeatable gates that give clear release confidence without making every PR painfully slow.

## Key Insights

- PR lane should be fast and reliable.
- Merge/release lane can run heavier E2E, visual, PPTX, k6.
- Gate output must explain gaps, not just fail.

## Requirements

- Define PR fast lane and release full lane.
- Keep `matrix:gate` part of CI.
- Document which commands are local vs CI-only.
- No branch protection changes without explicit operator action.
- Add CI gates incrementally with runtime budget and rollback path.
- Preserve or document required-check job name migration before workflow changes land.
- Enforce destructive-test loopback guards and secret/artifact scanning for generated reports/artifacts.

<!-- Updated: Validation Session 1 - initial required gates are lint/unit/matrix; E2E and heavy lanes stay report-only until two green CI runs. -->

## Architecture

Lane model:

```text
PR fast: lint + unit + matrix gate + selected E2E smoke
Merge full: full E2E + visual + coverage summary
Release strict: PPTX strict + Electron smoke + k6 smoke + manual checklist signoff
```

Runtime and rollout constraints:

- PR fast lane target: under 20 minutes.
- New E2E and heavy gates start as non-blocking report jobs unless they are already stable locally and in CI.
- Promote a gate to required only after at least two consecutive green CI runs on the target branch.
- Keep a rollback note in `ci-gate-verification.md` with exact workflow/job changes and how to disable the new gate without deleting tests.
- Quarantine requires owner, linked issue, expiry date, severity, and release-strict debt signal. Critical journey quarantine blocks release signoff.
- Branch-protection report must list old required job names, new job names, and operator action needed.

## Related Code Files

- Modify: `.github/workflows/*.yml`
- Modify: `package.json` scripts only if command grouping is needed
- Modify: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/ci-gate-verification.md`

## Implementation Steps

1. Red: add workflow/unit contract test for required scripts or workflow jobs.
2. Green: wire lane commands.
3. Add loopback/destructive preflight for E2E/load/sync/GitHub-like lanes before any destructive command runs.
4. Add secret scan or documented scanner command for `plans/reports`, Playwright traces/videos/screenshots, exported `.navslides`, and workflow artifacts.
5. Ensure matrix gate fails new unallowlisted gaps.
6. Add local command checklist and runtime budget.
7. Verify with `npm test`, targeted E2E, and workflow contract tests limited to changed scripts/jobs.
8. Record branch-protection mapping, rollback path, and quarantine policy in CI gate report.

## Todo List

- [x] Define PR fast lane command set.
- [x] Define merge full lane command set.
- [x] Define release strict lane command set.
- [x] Add/adjust workflow contract tests.
- [x] Add destructive-command loopback preflight.
- [x] Add secret/artifact scan step or documented scanner command.
- [x] Document branch-protection mapping and rollback path.
- [x] Document quarantine expiry policy.
- [x] Document operator-only branch protection steps.

## Evidence

- Added `tests/unit/github-actions-ci-release-confidence-contract.test.js` to pin the workflow/report contract for `matrix:gate`, `required-checks`, loopback load targets, and rollout docs.
- Added k6 loopback preflight to `tests/load/k6-load-test-api-presentations-post-endpoint-with-profiles.js` and `tests/load/k6-load-test-socketio-websocket-room-join-and-slide-change-broadcast.js`.
- Added `reports/ci-gate-verification.md` with PR fast, merge full, release strict, branch-protection mapping, rollback, quarantine, and secret/artifact scan commands.
- Updated `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` with release-confidence lane references and operator-only branch-protection guidance.
- Verification passed: targeted ESLint for CI/load contract files, `npx vitest run tests/unit/github-actions-ci-release-confidence-contract.test.js tests/unit/test-fixtures-loopback.test.js`, and `npm run matrix:gate`.
- Tester status: DONE. Reviewer re-check status: DONE after fixing required-check promotion wording and artifact scanning command.

## Success Criteria

- CI tells exactly which verification layer failed.
- Fast lane remains practical for PRs.
- Release lane includes heavy checks without hiding failures.
- New required gates have rollout evidence and rollback instructions.
- No destructive lane can run against non-loopback/test targets.

## Risk Assessment

- Risk: CI time grows too much. Mitigation: shard E2E and reserve heavy checks for merge/release.
- Risk: flaky tests block work. Mitigation: fix flake or quarantine with dated issue, not silent skip.

## Security Considerations

- No secrets in workflows or logs.
- Release gates must not run destructive calls against non-loopback URLs.
- Workflow permissions are least-privilege for changed jobs.
- Dependency/supply-chain checks are included where practical: lockfile verification, `npm audit --audit-level=high`, and pinned or version-reviewed GitHub Actions.

## Next Steps

Phase 6 converts this into maintainable docs/process.
