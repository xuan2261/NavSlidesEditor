# Phase 04 - Resolve Conflicts By Domain

## Context Links

- [Plan](./plan.md)
- [Research 02](./research/researcher-02-project-validation-and-risk.md)
- [Red Team Review](./reports/red-team-review.md)

## Overview

- Priority: P1
- Status: Pending
- Goal: resolve merge conflicts deliberately, grouped by impact area.

## Key Insights

- Local custom work likely lives in UI, tests, docs, PPTX import, game elements.
- Upstream may include bug fixes or dependency changes worth keeping.
- Conflict resolution must preserve product behavior, not just compile.

## Requirements

- Functional:
  - Resolve all unmerged files.
  - Preserve local custom features unless upstream fix is clearly superior.
  - Regenerate lockfile if dependency conflicts exist.
- Non-functional:
  - Keep changes minimal.
  - Avoid broad refactors.
  - Document any manual decisions in commit message or docs.

## Architecture

Conflict groups:

```text
package/deps -> shared contracts -> server -> client -> tests -> docs
```

## Related Code Files

- Modify: only files reported by `git diff --name-only --diff-filter=U`.
- Create: only if upstream introduces required files.
- Delete: only if upstream deletion is intentional and local feature not using file.

## Implementation Steps

1. List conflicts:
   ```powershell
   git diff --name-only --diff-filter=U
   ```
2. Resolve in order:
   - `package.json`, `package-lock.json`.
   - `shared/`.
   - `server/`.
   - `client/src/stores`, `client/src/hooks`, `client/src/components`.
   - `tests/`.
   - `docs/`, `plans/`.
3. Decision rules:
   - Use local side for UI/UX/product customizations.
   - Use upstream side for isolated bug fixes, dependency metadata, CI fixes.
   - Manually combine when both sides add different valid behavior.
   - Never accept deletion without checking usages:
     ```powershell
     rg "symbol-or-file-name"
     ```
4. After each file group:
   ```powershell
   git add <resolved-files>
   git diff --cached --check
   ```
5. Confirm all conflicts resolved:
   ```powershell
   git diff --name-only --diff-filter=U
   git status --short
   ```
6. Complete merge commit if Git has not auto-committed:
   ```powershell
   git commit
   ```
   Use concise message:
   ```text
   merge: sync upstream main into NavSlidesEditor
   ```

## Verification And Tests

- `git diff --name-only --diff-filter=U` returns empty.
- `git diff --check` returns no conflict markers or whitespace errors.
- `rg "<<<<<<<|=======|>>>>>>>"` returns no merge markers.
- `git status --short` has no unmerged paths.

## Todo List

- [ ] List conflicted files.
- [ ] Resolve dependency conflicts.
- [ ] Resolve shared/server conflicts.
- [ ] Resolve client conflicts.
- [ ] Resolve tests/docs conflicts.
- [ ] Search for conflict markers.
- [ ] Stage resolved files.
- [ ] Complete merge commit.

## Success Criteria

- Merge conflict-free.
- Local custom features intentionally preserved.
- No conflict markers remain.

## Risk Assessment

- Risk: conflict marker left in JSX/JS.
  - Mitigation: `rg "<<<<<<<|=======|>>>>>>>"`.
- Risk: local feature deleted by upstream.
  - Mitigation: usage search before accepting deletions.
- Risk: docs/plans overwritten.
  - Mitigation: docs conflicts resolved conservatively.

## Security Considerations

- Review any upstream changes touching file upload, share links, GitHub token storage, sync, server paths.

## Next Steps

- Proceed to Phase 05.
