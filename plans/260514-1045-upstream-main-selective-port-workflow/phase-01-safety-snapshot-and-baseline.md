# Phase 01 - Safety Snapshot And Baseline

## Context Links

- [Plan](./plan.md)
- [Research Synthesis](./research/research-synthesis.md)
- [Validation Report](./reports/validation-report.md)
- [Previous Merge Plan](../260514-0749-upstream-main-merge-sync/plan.md)

## Overview

- Priority: P1
- Status: Complete
- Goal: prove local repo is safe before selective upstream port work.

## Key Insights

- Current safe checkpoint from previous session: `6ac3b60 chore: checkpoint upstream sync plan`.
- `master` must remain untouched until all validation gates pass.
- Baseline tests are important because selective port must not inherit unknown current failures silently.

## Requirements

- Functional:
  - Record current branch, HEAD, upstream tip, and status.
  - Create rollback ref before any port.
  - Run baseline validation commands and record results.
- Non-functional:
  - No rebase.
  - No force push.
  - No merge with `--allow-unrelated-histories`.
  - No code edits in this phase.

## Architecture

```text
master HEAD
  |
  +-- backup/pre-upstream-selective-port-20260514
  |
  +-- later: sync/upstream-selective-port-20260514
```

## Related Code Files

- Modify: none.
- Create: no source file. Reports may be updated in `plans/260514-1045-upstream-main-selective-port-workflow/reports/`.
- Delete: none.

## Implementation Steps

1. Confirm branch/status:
   ```powershell
   git branch --show-current
   git status --short --branch
   git rev-parse HEAD
   git rev-parse upstream/main
   git remote -v
   ```
2. If dirty, inspect changes before continuing:
   ```powershell
   git status --porcelain=v1
   git diff --stat
   ```
3. Create backup ref only if not present:
   ```powershell
   git branch backup/pre-upstream-selective-port-20260514 HEAD
   ```
4. Confirm unrelated-history condition remains true:
   ```powershell
   git merge-base HEAD upstream/main
   ```
   Expected: non-zero exit. Do not treat this as failure; it confirms why this plan exists.
5. Run baseline gates:
   ```powershell
   npm run lint
   npm run build
   npm run test
   ```
6. Record outputs in implementation notes or progress report.

## TDD / Verification

- Before changes:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
- Git verification:
  - `git show-ref --heads backup/pre-upstream-selective-port-20260514`
  - `git status --short --branch`

## Todo List

- [x] Confirm current branch is `master`.
- [x] Confirm status is clean or checkpointed.
- [x] Create backup branch.
- [x] Record `HEAD` and `upstream/main`.
- [x] Run baseline lint/build/unit tests.
- [x] Document any pre-existing failures.

## Success Criteria

- Backup ref exists.
- Baseline state is known.
- No production merge or cherry-pick started.

## Risk Assessment

- Risk: baseline tests already fail.
  - Mitigation: record as pre-existing; fix only if it blocks port validation.
- Risk: backup ref accidentally points to wrong commit.
  - Mitigation: verify with `git rev-parse backup/pre-upstream-selective-port-20260514`.

## Security Considerations

- Do not stage or commit `.env`, tokens, credentials.
- Do not print private remotes with embedded tokens; current remotes should be HTTPS public URLs.

## Next Steps

- Proceed to Phase 02 candidate matrix.
