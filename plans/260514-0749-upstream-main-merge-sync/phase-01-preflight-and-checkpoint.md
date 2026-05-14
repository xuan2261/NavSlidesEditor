# Phase 01 - Preflight And Checkpoint

## Context Links

- [Plan](./plan.md)
- [Research 01](./research/researcher-01-git-upstream-merge-safety.md)
- [Validation](./reports/validation-report.md)

## Overview

- Priority: P1
- Status: Pending
- Goal: prove repo state is safe before any upstream merge action.

## Key Insights

- At planning time worktree is clean and `master` is ahead of `origin/master` by 3 commits.
- If worktree becomes dirty during execution, checkpoint before continuing.
- This phase is the main rollback anchor.

## Requirements

- Functional:
  - Record current branch and commit hash.
  - Confirm no uncommitted changes, or create checkpoint commit.
  - Confirm current `origin` remote.
- Non-functional:
  - No destructive commands.
  - No `reset --hard`.
  - No rebase.

## Architecture

Git state flow:

```text
master HEAD -> pre-sync anchor -> sync/upstream-20260514 later
```

## Related Code Files

- Modify: none expected.
- Create: none expected.
- Delete: none.

## Implementation Steps

1. Inspect branch:
   ```powershell
   git branch --show-current
   git status --short --branch
   git rev-parse --short HEAD
   git remote -v
   ```
2. If `git status --porcelain=v1` returns output:
   ```powershell
   git add -A
   git commit -m "chore: checkpoint local changes before upstream sync"
   ```
3. Save anchor hash:
   ```powershell
   git rev-parse HEAD
   ```
4. Optional safety tag if user wants extra rollback marker:
   ```powershell
   git tag pre-upstream-sync-20260514
   ```

## Verification And Tests

- `git status --porcelain=v1` returns empty.
- `git status --short --branch` shows current branch clearly.
- `git log --oneline --max-count=5` shows checkpoint if one was needed.

## Todo List

- [ ] Confirm current branch.
- [ ] Confirm clean worktree.
- [ ] Commit checkpoint if needed.
- [ ] Record pre-sync commit hash.
- [ ] Confirm no destructive commands were used.

## Success Criteria

- Clean working tree.
- Pre-sync commit hash known.
- Ready to add/fetch upstream.

## Risk Assessment

- Risk: untracked files missed.
  - Mitigation: use `git status --porcelain=v1`, not only `git diff`.
- Risk: checkpoint includes secrets.
  - Mitigation: inspect `git diff --cached --name-only`; do not commit `.env` or credentials.

## Security Considerations

- Do not commit API keys, `.env`, tokens, database credentials.
- Check staged file list before checkpoint commit.

## Next Steps

- Proceed to Phase 02.
