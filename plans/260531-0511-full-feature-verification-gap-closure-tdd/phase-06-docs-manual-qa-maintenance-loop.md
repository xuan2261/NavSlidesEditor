# Phase 06 - Docs, Manual QA, and Maintenance Loop

## Context Links

- [Plan](./plan.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Roadmap](../../docs/project-roadmap.md)
- [Changelog](../../docs/project-changelog.md)

## Overview

Priority: P2. Status: Pending. Make the verification system usable by future releases: concise docs, checklist, and maintenance rules.

## Key Insights

- Manual QA should cover only what automation cannot reasonably cover.
- Docs must say current truth, not aspirational state.
- Allowlist must shrink or stay justified.

## Requirements

- Update roadmap/changelog after implementation.
- Produce release verification checklist.
- Add maintenance cadence for allowlist and matrix.
- Keep docs short and actionable.

## Architecture

Artifacts:

```text
docs/testing guide -> commands and policy
docs/manual smoke checklist -> human fallback
docs/project-roadmap -> phase progress
docs/project-changelog -> implemented verification improvements
plan reports -> evidence captured during work
```

## Related Code Files

- Modify: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`
- Create/modify: `docs/manual-smoke-checklist.md`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/release-verification-summary.md`

## Implementation Steps

1. Red: add docs contract test if docs links/scripts are expected.
2. Update manual smoke checklist with automation boundaries.
3. Update testing guide with final lane commands and interpretation.
4. Update roadmap/changelog with actual delivered changes.
5. Write release verification summary: pass/fail/debt.
6. Run docs-related tests and link checks if available.

## Todo List

- [ ] Write/update manual smoke checklist.
- [ ] Update testing guide.
- [ ] Update roadmap.
- [ ] Update changelog.
- [ ] Write release verification summary.

## Success Criteria

- A maintainer can answer: what is tested, where, and by which command.
- Manual checklist is under 45 minutes.
- Unresolved risks are listed at end of summary.

## Risk Assessment

- Risk: docs drift immediately. Mitigation: generated matrix remains source of truth; docs link to it.
- Risk: checklist gets too long. Mitigation: only manual-only items included.

## Security Considerations

- Checklist must not request secrets.
- Do not publish private environment details.

## Next Steps

Use `/ck:cook` on the plan path to implement.
