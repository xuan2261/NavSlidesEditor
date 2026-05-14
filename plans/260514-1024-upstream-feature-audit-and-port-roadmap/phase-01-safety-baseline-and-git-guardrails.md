# Phase 01 - Safety Baseline And Git Guardrails

## Context Links

- [Plan](./plan.md)
- [Scout report](./reports/scout-report.md)
- [Research report](./research/upstream-feature-audit-research.md)
- [Prior selective port plan](../260514-1045-upstream-main-selective-port-workflow/plan.md)

## Overview

- Priority: P0
- Status: Complete
- Estimate: 3h
- Goal: protect local history and create a reproducible baseline before any port.

## Key Insights

- `HEAD` and `upstream/main` have no merge-base.
- `master` has local commits not on `origin/master`.
- Full merge risks mass deletion and product direction drift.

## Requirements

- Create backup branch from current `master`.
- Fetch upstream and origin.
- Record current commit, remotes, branch state, and upstream heads.
- Create sync branch/worktree for all future work.
- Document rollback commands.

## Architecture

```text
master
  -> backup/pre-upstream-feature-port-260514
  -> sync/upstream-feature-audit-port-260514
      -> topic/export-html-embed
      -> topic/editor-ux-micro-ports
      -> topic/media-polish
```

## Related Code Files

- Modify: none.
- Create: optional verification report under `plans/260514-1024-upstream-feature-audit-and-port-roadmap/reports/`.
- Delete: none.

## Implementation Steps

1. Confirm clean worktree or intentionally documented dirty state.
2. Run:
   ```powershell
   git status --short --branch
   git fetch origin --prune
   git fetch upstream --prune
   git branch backup/pre-upstream-feature-port-260514
   git switch -c sync/upstream-feature-audit-port-260514
   ```
3. If worktree isolation desired:
   ```powershell
   git worktree add ..\NavSlidesEditor-upstream-port sync/upstream-feature-audit-port-260514
   ```
4. Record:
   ```powershell
   git rev-parse HEAD
   git remote -v
   git branch -vv
   git ls-remote --heads upstream
   ```
5. Add rollback note:
   ```powershell
   git switch master
   git branch -D sync/upstream-feature-audit-port-260514
   git worktree remove ..\NavSlidesEditor-upstream-port
   ```

## Todo List

- [x] Fetch remotes.
- [x] Create backup branch.
- [x] Create sync branch/worktree.
- [x] Save baseline report.
- [x] Confirm no implementation changes yet.

## Success Criteria

- Backup branch exists.
- Sync branch exists.
- `master` unchanged after setup.
- Baseline report includes exact commit hashes.

## Verification

- `git status --short --branch`
- `git branch --list "*upstream-feature*"`
- `git worktree list`

## Risk Assessment

- Risk: accidental changes on `master`.
- Mitigation: branch/worktree before edits.

## Security Considerations

- Do not commit `server/data/*` secrets or config.
- Do not expose GitHub PAT/rclone config.

## Next Steps

- Proceed to Phase 02 candidate matrix.

## Unresolved Questions

- None.
