# Phase 08 - Finalize Merge Back Or Rollback

## Context Links

- [Plan](./plan.md)
- [Red Team Review](./reports/red-team-review.md)
- [Validation](./reports/validation-report.md)

## Overview

- Priority: P1
- Status: Pending
- Goal: either merge validated sync branch back to `master`, or rollback safely.

## Key Insights

- `master` should change only after phases 01-07 pass.
- Rollback path must remain available.
- Push only after local validation.

## Requirements

- Functional:
  - Merge sync branch to `master` if validated.
  - Push to origin only if user wants remote update.
  - Keep rollback instructions.
- Non-functional:
  - No force push.
  - No destructive reset.
  - Keep final commit history auditable.

## Architecture

```text
sync/upstream-20260514 validated
        |
        v
master merge --no-ff
        |
        v
origin/master push optional
```

## Related Code Files

- Modify: none expected unless final docs/test fix needed.
- Create: none expected.
- Delete: none expected.

## Implementation Steps

1. Confirm sync branch is clean:
   ```powershell
   git status --short --branch
   npm run build
   npm run test
   ```
2. Switch to `master`:
   ```powershell
   git switch master
   ```
3. Confirm `master` has not moved unexpectedly:
   ```powershell
   git log --oneline --max-count=5
   ```
4. Merge sync branch:
   ```powershell
   git merge --no-ff sync/upstream-20260514
   ```
5. Final gate:
   ```powershell
   npm run build
   npm run test
   git status --short --branch
   ```
6. Optional push:
   ```powershell
   git push origin master
   ```
7. Rollback options:
   - If before final merge commit:
     ```powershell
     git switch master
     git branch -D sync/upstream-20260514
     ```
   - If final merge committed but not pushed:
     ```powershell
     git revert -m 1 <merge-commit>
     ```
   - If pushed:
     ```powershell
     git revert -m 1 <merge-commit>
     git push origin master
     ```

## Verification And Tests

- `master` contains merge commit.
- `npm run build` passes on `master`.
- `npm run test` passes on `master`.
- `git status --short --branch` clean after final merge.
- Optional `git push origin master` succeeds.

## Todo List

- [ ] Confirm sync branch validation complete.
- [ ] Switch to `master`.
- [ ] Merge sync branch with `--no-ff`.
- [ ] Run final build/test.
- [ ] Push only after approval.
- [ ] Record merge commit hash.
- [ ] Keep rollback command documented.

## Success Criteria

- `master` safely includes upstream updates and local customizations.
- Remote push is clean if performed.
- Rollback is possible through revert.

## Risk Assessment

- Risk: final merge creates new conflicts because `master` moved.
  - Mitigation: inspect `master` log before merge; resolve or restart from updated base.
- Risk: bad merge pushed.
  - Mitigation: final gates before push; revert if already pushed.

## Security Considerations

- Do not force push shared branch.
- Do not push confidential files.

## Next Steps

- Archive plan when implementation is complete.
