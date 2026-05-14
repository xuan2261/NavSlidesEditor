# Red Team Review - Upstream Selective Port Workflow

## Verdict

Plan is safer than unrelated-history merge. Main failure mode is scope creep: selective port can quietly become feature migration if timeline/citation commits are allowed in.

## Critical Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Cherry-picking commit chain drags hidden dependencies | High | Use candidate matrix; inspect `git show --name-status`; stop on broad dependency chain |
| Manual port overwrites local customization | High | Compare local behavior first; treat local custom UI as requirement |
| Tests pass but present/export behavior regresses | High | Add manual smoke plus export E2E for typography/embed changes |
| Worktree branch leaks into master before gates pass | Medium | Keep `master` untouched; merge only after Phase 08 |
| Generated docs/assets from upstream pollute repo | Medium | Exclude generated artifacts unless explicitly required |

## Required Hardening

- Phase 02 must create a candidate matrix before any code changes.
- Phase 04 and 05 must be separate commits so rollback is small.
- Phase 06 must reproduce an HTML embed issue before modifying renderer/export code.
- Phase 07 must explicitly document deferred upstream domains.

## Status

DONE_WITH_CONCERNS

## Concerns/Blockers

No blocker. Concern: implementation must resist broad cherry-pick ranges.
