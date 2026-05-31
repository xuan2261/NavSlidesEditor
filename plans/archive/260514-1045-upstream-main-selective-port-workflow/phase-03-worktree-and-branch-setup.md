# Phase 03 - Worktree And Branch Setup

## Context Links

- [Plan](./plan.md)
- [Candidate Matrix](./reports/candidate-matrix.md)
- [Git Strategy Research](../reports/researcher-260514-1045-upstream-main-selective-port-workflow.md)

## Overview

- Priority: P1
- Status: Complete
- Goal: isolate implementation from the main workspace using a dedicated worktree and topic branches.

## Key Insights

- Worktree isolation lowers risk when cherry-pick conflicts occur.
- Direct work on `master` is forbidden until final integration.
- Topic branches keep rollback granular.

## Requirements

- Functional:
  - Create `sync/upstream-selective-port-20260514` from current safe `master`.
  - Create linked worktree for sync branch.
  - Confirm old unrelated merge branch is not used.
- Non-functional:
  - No code edits in main worktree.
  - No destructive branch delete without verifying branch target.

## Architecture

```text
D:\NCKH_2025\NavSlidesEditor                 -> main worktree, master
D:\NCKH_2025\NavSlidesEditor-sync-upstream   -> linked worktree, sync branch
```

## Related Code Files

- Modify: none expected.
- Create: linked worktree directory outside/alongside project root.
- Delete: none.

## Implementation Steps

1. From main worktree, ensure clean:
   ```powershell
   git status --short --branch
   ```
2. Create sync branch if missing:
   ```powershell
   git switch master
   git branch sync/upstream-selective-port-20260514
   ```
3. Create worktree:
   ```powershell
   git worktree add ..\NavSlidesEditor-sync-upstream sync/upstream-selective-port-20260514
   ```
4. Enter worktree and verify:
   ```powershell
   Set-Location ..\NavSlidesEditor-sync-upstream
   git branch --show-current
   git status --short --branch
   ```
5. Install dependencies if worktree needs fresh `node_modules`:
   ```powershell
   npm install
   ```

## TDD / Verification

- Git:
  ```powershell
  git worktree list
  git branch --show-current
  git status --short --branch
  ```
- Build smoke in worktree:
  ```powershell
  npm run build
  ```

## Todo List

- [x] Confirm main worktree clean.
- [x] Create sync branch.
- [x] Create linked worktree.
- [x] Verify branch in linked worktree.
- [x] Run `npm install` if needed.
- [x] Run build smoke.

## Success Criteria

- Worktree exists and points to sync branch.
- Main `master` worktree remains untouched.
- Build smoke passes or failure is documented as pre-existing/dependency setup issue.

## Risk Assessment

- Risk: editing wrong worktree.
  - Mitigation: run `git branch --show-current` before every phase.
- Risk: duplicate branch already exists from partial run.
  - Mitigation: inspect branch/worktree before creating; reuse only if clean.

## Security Considerations

- Do not copy `.env` into worktree.
- `npm install` must not require private tokens.

## Next Steps

- Proceed to Phase 04 first low-risk port.
