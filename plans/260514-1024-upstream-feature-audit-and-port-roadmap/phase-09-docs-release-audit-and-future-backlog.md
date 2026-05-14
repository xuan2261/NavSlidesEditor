# Phase 09 - Docs Release Audit And Future Backlog

## Context Links

- [Plan](./plan.md)
- `docs/project-roadmap.md`
- `docs/project-changelog.md`
- `docs/system-architecture.md`
- `docs/codebase-summary.md`

## Overview

- Priority: P1
- Status: Complete
- Estimate: 2h
- Goal: document actual port results and future upstream backlog.

## Key Insights

- Docs update should reflect shipped behavior only.
- Deferred plugin/timeline work should be backlog, not implied as done.

## Requirements

- Update changelog after implementation.
- Update roadmap if feature status changes.
- Update architecture docs only if architecture changes.
- Add backlog section for skipped/deferred upstream ideas.
- Keep concise, no AI references.

## Architecture

Docs flow:

```text
candidate matrix + shipped commits
  -> changelog entry
  -> roadmap progress
  -> architecture/codebase summary if structural changes
  -> future backlog
```

## Related Code Files

- Modify likely:
  - `docs/project-changelog.md`
  - `docs/project-roadmap.md`
  - `docs/system-architecture.md`
  - `docs/codebase-summary.md`
- Create optional:
  - `docs/journals/260514-upstream-feature-port.md`
- Delete: none.

## Implementation Steps

1. Read current docs before editing.
2. Add changelog entry with:
   - shipped upstream-inspired fixes
   - test gates passed
   - skipped/deferred topics
3. Update roadmap:
   - mark upstream selective port roadmap progress.
   - add optional future epics if user wants.
4. Update architecture/codebase summary only if:
   - new element type
   - plugin system
   - storage abstraction
   - renderer/export architecture changed.
5. Add journal entry if implementation was non-trivial.

## Todo List

- [x] Read current docs.
- [x] Update changelog.
- [x] Update roadmap.
- [x] Update architecture/codebase summary if needed.
- [x] Add future backlog.
- [x] Verify links.

## Success Criteria

- Docs match actual changes.
- Deferred items are explicit.
- No stale claims about full upstream sync.
- Links to plan/reports work.

## Verification

```powershell
rg -n "upstream|timeline|plugin|Copy URL|HTML embed|LaTeX|fragment" docs plans/260514-1024-upstream-feature-audit-and-port-roadmap
```

Optional:
```powershell
npm run lint
```

## Risk Assessment

- Risk: docs overstate future work.
- Mitigation: only write what shipped; future items under backlog.

## Security Considerations

- Do not include tokens, local paths containing credentials, or private config values.

## Next Steps

- Commit with conventional message after gates:
  - `docs(plan): add upstream feature audit port roadmap`
  - later implementation commits split by batch.

## Unresolved Questions

- Phase 08 corpus blocker must be resolved or explicitly accepted before merge.
