# Red Team Review - Upstream Main Merge Sync Plan

## Verdict

Plan is viable if strict git gates are followed. Biggest failure mode is rushing conflict resolution and treating all upstream changes as better.

## Critical Risks

1. Dirty worktree before sync.
   - Mitigation: phase 01 requires clean status or checkpoint commit.

2. Lockfile conflict resolved manually wrong.
   - Mitigation: regenerate via `npm install`; inspect diff after.

3. Local UI/UX overhaul overwritten.
   - Mitigation: conflict policy favors local app chrome unless upstream fixes a clear defect.

4. Tests pass but app visually regresses.
   - Mitigation: targeted Playwright + manual smoke for dashboard/editor/presenter.

5. Merging upstream `dev` by mistake.
   - Mitigation: plan uses only `upstream/main`; `dev` is explicitly out of scope.

6. Final merge to `master` before validation complete.
   - Mitigation: sync branch is the only integration surface until all gates pass.

## Required Plan Hardening

- Include rollback commands in phase 01 and phase 08.
- Include exact commands for every phase.
- Include decision rules for `ours` vs `theirs`.
- Include docs update gate only after successful validation.

## Status

DONE_WITH_CONCERNS

## Concerns/Blockers

No blocker. Concern: upstream source history relationship may be non-linear; phase 02 must inspect unrelated-history risk before merge.
