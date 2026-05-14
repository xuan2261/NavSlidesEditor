# Phase 09 - Docs Release Audit And Final Git Integration

## Context Links

- [Plan](./plan.md)
- [Final Validation Report](./reports/final-validation-report.md)
- [Project Changelog](../../docs/project-changelog.md)
- [Project Roadmap](../../docs/project-roadmap.md)

## Overview

- Priority: P1
- Status: Complete
- Goal: update docs, then merge validated sync branch to `master` with rollback path intact.

## Key Insights

- Docs should describe actual ported changes, not upstream wholesale sync.
- Final merge must be normal, auditable, and reversible.
- Push remains optional and should happen only after user approval.
- Final merge commit: `3907f049 merge: selective upstream copy url port`.
- Full `npm run test` required disabling Vitest file-level parallelism because server route tests share storage-backed `server/data` files.

## Requirements

- Functional:
  - Update changelog/roadmap/docs if port changed user or developer behavior.
  - Merge sync branch into `master` only after validation passes.
  - Record final commit hash and rollback commands.
- Non-functional:
  - No force push.
  - No rebase.
  - No confidential files.
  - Keep docs concise.

## Architecture

```text
validated sync branch -> docs update -> final gate -> master merge --no-ff -> optional push
```

## Related Code Files

- Modify as needed:
  - `docs/project-changelog.md`
  - `docs/project-roadmap.md`
  - `docs/codebase-summary.md`
  - `docs/system-architecture.md`
  - `plans/260514-1045-upstream-main-selective-port-workflow/plan.md`
  - phase status files
- Create:
  - `docs/journals/<timestamp>-upstream-selective-port.md` if session journal required.
- Delete: none.

## Implementation Steps

1. Inspect final diff:
   ```powershell
   git diff --stat master...sync/upstream-selective-port-20260514
   git diff --name-status master...sync/upstream-selective-port-20260514
   ```
2. Classify docs impact:
   - none: internal-only no behavior change.
   - minor: changelog entry.
   - major: changelog + roadmap/architecture/codebase summary.
3. Update docs and plan phase statuses.
4. Run final gate on sync branch:
   ```powershell
   npm run build
   npm run test
   git status --short --branch
   ```
5. Switch to master and merge:
   ```powershell
   git switch master
   git merge --no-ff sync/upstream-selective-port-20260514
   ```
6. Final verification on master:
   ```powershell
   npm run build
   npm run test
   git status --short --branch
   git log --oneline --decorate -n 10
   ```
7. Optional push only after approval:
   ```powershell
   git push origin master
   ```
8. Rollback commands:
   - Before final merge: delete/discard sync branch or worktree.
   - After final merge, before push:
     ```powershell
     git revert -m 1 <merge-commit>
     ```
   - After push:
     ```powershell
     git revert -m 1 <merge-commit>
     git push origin master
     ```

## TDD / Verification

- Docs/source final:
  ```powershell
  npm run build
  npm run test
  ```
- Git:
  ```powershell
  git status --short --branch
  git log --oneline --decorate -n 10
  ```
- Security:
  ```powershell
  git diff --cached | Select-String -Pattern "api[_-]?key|token|password|secret|credential" -CaseSensitive:$false
  ```

## Todo List

- [x] Inspect final diff.
- [x] Classify docs impact as minor.
- [x] Update docs and plan statuses.
- [x] Run final gate on sync branch.
- [x] Merge to `master`.
- [x] Run final build/test on `master`.
- [x] Record final merge hash.
- [x] Leave push for explicit user approval.

## Success Criteria

- `master` includes only approved selective port changes.
- Final tests pass on `master`.
- Changelog/docs match actual changes.
- Rollback path is documented.

## Risk Assessment

- Risk: docs overstate upstream sync.
  - Mitigation: phrase as selective port only.
- Risk: final merge conflict because `master` moved.
  - Mitigation: inspect log before merge; stop and revalidate if moved.

## Security Considerations

- Do not commit credentials.
- Do not push without explicit approval.

## Next Steps

- Archive or complete plan after successful implementation.
