# Phase 1: Safety Baseline

**Priority:** P0
**Status:** pending
**Effort:** 1h

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md)
- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

Create backup branch, verify current tests pass, establish baseline before any changes.

## Implementation Steps

1. Fetch latest upstream: `git fetch upstream`
2. Create backup branch from master: `git checkout -b backup/pre-upstream-v2-port-260516`
3. Push backup: `git push origin backup/pre-upstream-v2-port-260516`
4. Create worktree for porting: `git worktree add ../NavSlidesEditor-port-upstream-v2 -b sync/upstream-v2-port-260516 master`
5. Run baseline tests in worktree:
   - `npm run lint` — must pass
   - `npm run test` — must pass (record count)
   - `npm run build` — must succeed
   - `npm run test:corpus` — record fidelity percentage
6. Record baseline commit hash and test results
7. Verify existing worktree `NavSlidesEditor-sync-upstream` can be cleaned up if no longer needed

## Todo List

- [ ] Fetch upstream
- [ ] Create backup branch
- [ ] Push backup to origin
- [ ] Create worktree for porting
- [ ] Run lint baseline
- [ ] Run unit tests baseline
- [ ] Run build baseline
- [ ] Run corpus test baseline
- [ ] Record baseline metrics

## Success Criteria

- Backup branch exists on origin
- Worktree created on new branch
- `npm run lint` passes
- `npm run test` passes (baseline count recorded)
- `npm run build` succeeds
- Baseline metrics documented

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing worktree conflicts | Check `git worktree list`, clean up stale worktrees |
| Tests fail on clean master | Document failures, fix before proceeding |
| Upstream fetch fails | Verify remote URL, network connectivity |

## Verification Commands

```bash
git worktree list
git branch -a | grep backup
npm run lint 2>&1 | tail -5
npm run test 2>&1 | tail -10
npm run build 2>&1 | tail -5
```
