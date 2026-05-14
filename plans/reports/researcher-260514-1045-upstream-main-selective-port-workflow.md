# Research Report: Upstream Main Selective Port Workflow

## Executive Summary

The attempted sync from `upstream/main` is not a normal merge case. Local `HEAD` and `upstream/main` have no merge base, so a bulk merge is structurally wrong for this repo state. The safe path is a selective import workflow built around a backup ref, an isolated worktree, topic-based cherry-pick batches, and manual porting only when a commit is too cross-cutting for clean replay.

This approach preserves local NavSlidesEditor customizations, keeps rollback cheap, and avoids history rewrite. It is also the only strategy that scales to a 9,609-file unrelated-history diff without flooding `master` with an unreviewable merge commit.

## Local Git Facts

- `git merge-base HEAD upstream/main` fails
- Local branch: `master`
- Local `master` is ahead of `origin/master` by 4 commits
- Unique commits:
  - local-only: 49
  - upstream-only: 122
- Upstream tip: `6c3ef006`
- Local tip: `6ac3b60b`

## Source Quality

Primary sources only:

1. Git merge documentation: `git merge` refuses unrelated histories by default, and `--allow-unrelated-histories` is explicitly framed as a rare exception.
2. Git cherry-pick documentation: `cherry-pick` replays changes as new commits, `-n` supports batch grouping, `-x` preserves provenance on clean picks, and `--abort` exists for failed sequences.
3. Git worktree documentation: `worktree add` creates an isolated linked worktree for parallel, non-destructive branch work.
4. Git revert documentation: `revert` records new commits that reverse earlier commits, which makes it the correct rollback primitive after a bad import.

## Recommendation

Ranked choice:

1. Topic-based cherry-pick in a scratch worktree. This is the main path.
2. Manual port for commits that are conceptually right but mechanically too noisy.
3. Merge with `--allow-unrelated-histories` only on a throwaway scratch branch if absolutely necessary for history inspection, not for the real sync.

Reject:

- Rebase
- Force-push
- Direct merge into `master`

## Trade-Off Matrix

| Option | Performance | Complexity | Maintenance | Risk | Fit |
| --- | --- | --- | --- | --- | --- |
| Topic cherry-pick + worktree | Good | Medium | Good | Low | Best |
| Manual port | Medium | High | Medium | Medium | Good fallback |
| Unrelated-history merge | Good | Low | Poor | High | Poor |
| Rebase / history rewrite | Good | Medium | Poor | Very high | Reject |

## Notes On Scope

- Upstream diff is not just application code. It also includes generated output, docs artifacts, workflows, and vendored/dependency noise.
- That means a selection matrix is mandatory. A blind range replay is too risky.
- The likely port candidates are small, subsystem-local fixes. Anything cross-cutting should be evaluated manually.

## Verification Plan

Phase-level gates:

- backup ref exists before any change
- scratch worktree created
- commit selection matrix approved
- each cherry-pick batch builds cleanly
- targeted tests for impacted areas pass
- full lint/build/test pass before merge-back
- rollback path remains available until final integration

Suggested commands:

```powershell
git status --short --branch
git rev-parse HEAD upstream/main
git log --oneline --reverse HEAD..upstream/main
git diff --stat HEAD..upstream/main
git cherry-pick --abort
git revert <commit>
```

## Risks

- Picking too many commits because they look adjacent in upstream history.
- Importing upstream-generated files that should stay local.
- Losing local customizations if manual port is done without a comparison matrix.

## Acceptance Criteria

- The selected upstream subset is explicit.
- No history rewrite is used.
- Local product behavior is preserved.
- Every imported batch is auditable and reversible.

## References

- Git merge docs: https://git-scm.com/docs/git-merge
- Git cherry-pick docs: https://git-scm.com/docs/git-cherry-pick
- Git worktree docs: https://git-scm.com/docs/git-worktree
- Git revert docs: https://git-scm.com/docs/git-revert

## Unresolved Questions

- Final commit shortlist still needs a subsystem-by-subsystem matrix.
- Some upstream fixes may be better deferred if they collide with local product direction.
