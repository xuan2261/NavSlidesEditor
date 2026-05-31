# Phase 03 - Create Sync Branch And Merge Upstream Main

## Context Links

- [Plan](./plan.md)
- [Red Team Review](./reports/red-team-review.md)

## Overview

- Priority: P1
- Status: Pending
- Goal: isolate upstream merge on `sync/upstream-20260514`.

## Key Insights

- `master` must remain untouched until gates pass.
- Merge commit preferred over rebase.
- Conflict state is acceptable in this phase; resolution happens Phase 04.

## Requirements

- Functional:
  - Create/switch sync branch from current safe `master`.
  - Run merge from `upstream/main`.
  - Capture conflicted files if any.
- Non-functional:
  - No rebase.
  - No force push.
  - No `--ours`/`--theirs` blanket strategy.

## Architecture

```text
master
  \
   sync/upstream-20260514 + merge upstream/main
```

## Related Code Files

- Modify: conflict files only if merge creates conflicts.
- Create: none expected.
- Delete: upstream-driven only after review.

## Implementation Steps

1. Create sync branch:
   ```powershell
   git switch -c sync/upstream-20260514
   ```
   If already exists:
   ```powershell
   git switch sync/upstream-20260514
   ```
2. Confirm branch and clean state:
   ```powershell
   git status --short --branch
   git status --porcelain=v1
   ```
3. Merge:
   ```powershell
   git merge upstream/main
   ```
4. If conflicts occur, list them:
   ```powershell
   git diff --name-only --diff-filter=U
   git status --short
   ```
5. If merge looks wrong before resolving:
   ```powershell
   git merge --abort
   ```
   Then reassess Phase 02 findings.

## Verification And Tests

- `git branch --show-current` equals `sync/upstream-20260514`.
- Merge either completes cleanly or conflict list is available.
- No rebase command used.

## Todo List

- [ ] Create/switch sync branch.
- [ ] Confirm clean state.
- [ ] Merge `upstream/main`.
- [ ] Capture conflicts.
- [ ] Abort only if merge base/risk is wrong.

## Success Criteria

- Sync branch contains either completed merge or clear conflict state ready for Phase 04.

## Risk Assessment

- Risk: branch created from stale base.
  - Mitigation: Phase 01 records `master` HEAD; confirm before branch creation.
- Risk: using blanket conflict strategy.
  - Mitigation: resolve by domain in Phase 04.

## Security Considerations

- No secret handling expected.

## Next Steps

- Proceed to Phase 04 if conflicts exist, otherwise Phase 05.
