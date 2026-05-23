---
phase: 1
title: "Upstream Baseline And Diff Oracle"
status: blocked
priority: P0
effort: "1-2d"
dependencies: []
---

# Phase 1: Upstream Baseline And Diff Oracle

## Context Links

- [Overview](./plan.md)
- [Research summary](./research/research-summary.md)
- `plans/260514-1045-upstream-main-selective-port-workflow/plan.md`

## Overview

Define exact upstream source of truth and create reproducible commands to run baseline tests on upstream and current repo.

## Requirements

<!-- Updated: Validation Session 1 - upstream source of truth confirmed -->

**Functional:**
- Record upstream remote URL, branch/tag/commit SHA.
- Treat the exact upstream SHA as a hard gate before Phase 2 can start.
- Record approver, approval date, and policy for changing the upstream SHA.
- Use only an approved immutable commit SHA as the upstream oracle. Do not use a floating branch such as `upstream/main` for parity claims.
- Create upstream worktree outside current repo.
- Run the same baseline intent in upstream and current through a reviewed adapter command map where tooling differs.
- Compare `package.json`, lockfile, Node/npm versions, Playwright/Vitest config, and script availability before assuming commands are equivalent.
- Save concise results in `plans/260523-0500-upstream-parity-verification-tdd/reports/`.

**Non-functional:**
- No direct merge/cherry-pick.
- No destructive git command.
- Commands must be copy-pasteable on Windows PowerShell.
- Prefer deterministic installs with `npm ci`; do not mutate lockfiles during baseline.
- Do not run dependency lifecycle scripts from upstream until package/lockfile diffs are reviewed.

## Architecture

```text
origin/current repo
    |
    | same smoke/parity intent via reviewed adapter
    v
baseline report
    ^
    | same smoke/parity intent via reviewed adapter
upstream worktree
```

## Related Code Files

**Read:**
- `package.json`
- `playwright.config.js`
- `vitest.config.mjs`
- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`

**Create:**
- `plans/.../reports/upstream-baseline-report.md`
- `plans/.../reports/upstream-oracle-approval-record.md`
- `plans/.../reports/upstream-adapter-harness-design.md`

## Implementation Steps

1. Check remote:
   ```powershell
   git remote -v
   git fetch upstream
   git rev-parse <candidate-upstream-ref>
   ```
   Record the approved immutable SHA, remote URL, approver, approval date, and change policy. Stop here if the SHA is not approved.
2. Create worktree:
   ```powershell
   git worktree add ..\NavSlidesEditor-upstream <approved-upstream-sha>
   ```
3. Diff tooling before install:
   ```powershell
   node -v
   npm -v
   git -C ..\NavSlidesEditor-upstream diff -- package.json package-lock.json
   ```
   If scripts/config differ, document an adapter command map instead of forcing identical commands.
4. Run baseline current:
   ```powershell
   npm ci --ignore-scripts
   npm run build
   npm run lint
   npm test
   npm run test:e2e
   ```
5. Run baseline upstream with reviewed equivalent commands in a disposable shell/user with no real secrets.
6. Record pass/fail, duration, failing spec names, environment, lockfile hash, and dirty-worktree status after test.

## TDD / Tests

- Red: add a report checklist row with `upstreamRef = TBD`, fail review until exact SHA exists.
- Green: fill exact SHA and both command results.
- Refactor: trim report to key deltas only.

## Todo List

- [x] Capture current repo remote/tooling metadata.
- [x] Create Phase 1 baseline report scaffold.
- [x] Record historical candidate upstream context without approving it.
- [x] Fetch candidate upstream remote and disable its push URL.
- [x] Refresh candidate upstream evidence snapshot without approving it.
- [x] Compare candidate upstream test/tooling availability before install.
- [x] Create upstream oracle approval record template.
- [x] Draft upstream adapter harness design without running upstream baseline.
- [x] Confirm upstream remote/ref.
- [x] Create upstream worktree.
- [x] Run current baseline.
- [x] Run upstream baseline and record setup/build failure.
- [x] Write baseline report.

## Success Criteria

- Exact upstream SHA is known.
- SHA has named signoff and is used by all reports, fixtures, matrix rows, and CI gates.
- Both environments can run the same smoke/parity intent through a reviewed adapter command map where tooling differs.
- Any command differences are documented as an adapter map with rationale.
- Known upstream/current failures are separated from new regressions.
- Worktrees remain clean after install/test except for allowlisted generated artifacts.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Upstream incompatible with current npm/tooling | High | Record as oracle limitation; pin commit or use upstream documented setup |
| E2E flake hides parity issue | High | Use retries only for classification, not final pass |
| Upstream dependency scripts execute unsafe code | Critical | Use `npm ci --ignore-scripts`, review diffs, and run upstream in disposable environment |
| Floating upstream ref invalidates reports | Critical | Use approved immutable SHA only |

## Security Considerations

- Use local loopback only.
- Do not run tests against production URLs.
- Do not expose real GitHub, AI, rclone, npm, or OS credentials to the upstream worktree.
- Treat upstream install/test execution as untrusted until package scripts are reviewed.

## Red Team Adjustment

- Phase 1 is now a hard gate. No downstream phase may produce parity claims until the upstream SHA, approver, date, and ref-change policy are recorded.
- Baseline commands must be deterministic and supply-chain aware: `npm ci`, script review, tooling diff, lockfile hash, and dirty-worktree checks are mandatory.

## Next Steps

- Feed baseline into Phase 2 matrix.

## Unresolved Questions

- Approved upstream build currently fails on the local Windows/npm/Node environment.
- Decide whether Phase 2 remains blocked until upstream build is fixed, or whether
  unavailable upstream automation can be represented as `Blocked`/`Waived` rows
  with manual oracle evidence.
