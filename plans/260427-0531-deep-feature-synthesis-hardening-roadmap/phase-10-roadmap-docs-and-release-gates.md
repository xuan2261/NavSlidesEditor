---
phase: 10
title: "Roadmap Docs And Release Gates"
status: pending
priority: P1
effort: "1-2d"
dependencies: [2, 3, 4, 5, 6, 7, 8, 9]
---

# Phase 10: Roadmap Docs And Release Gates

## Context Links

- Docs management rule: update roadmap/changelog/architecture/code standards after feature implementation.
- Docs: `docs/project-roadmap.md`, `docs/project-changelog.md`, `docs/system-architecture.md`, `docs/code-standards.md`
- Plan: this folder's `plan.md` and phase files.

## Overview

Close the roadmap with docs, tests, review, and release gates. This phase makes
implementation traceable and prevents stale synthesis claims from returning.

## Key Insights

- The source brainstorm mixed useful priorities with stale PPTX assumptions.
- Docs already include PPTX coordinate hardening and E2E selector contracts.
- Any shipped implementation must update roadmap/changelog and relevant architecture docs.
- Project workflow requires testing and code review after implementation.

## Requirements

- Functional: update docs for shipped phases only, not deferred ideas.
- Functional: record no-go decisions for Slide Master/PDF/analytics if gates reject them.
- Functional: run full verification commands before final handoff.
- Non-functional: concise docs; no AI references in commit messages if committed later.
- Non-functional: keep unresolved questions at end of reports/docs where relevant.

## Architecture

```text
implemented phases
  -> docs updates
  -> changelog entry
  -> roadmap status
  -> final test matrix
  -> code review
  -> cook/ship handoff
```

## Related Code Files

- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/system-architecture.md` if architecture changed.
- Modify: `docs/code-standards.md` if command/shortcut/canvas conventions changed.
- Modify: `docs/pptx-import-fidelity-report.md` if Phase 6 ran.
- Modify: `README.md` if user-visible shortcuts/PDF/analytics behavior changed.
- Modify: plan phase statuses through `ck plan check` when phases complete.
- Delete: none.

## Implementation Steps

1. For each completed code phase, list actual files changed and tests run.
2. Update `docs/project-changelog.md` with added/changed/fixed entries.
3. Update `docs/project-roadmap.md` statuses and next limitations.
4. Update `docs/system-architecture.md` for command layer, canvas components, analytics service, or PDF/PPTX changes.
5. Update `docs/code-standards.md` if new shortcuts/canvas/test conventions were introduced.
6. Update `README.md` shortcut table or feature descriptions only if user-visible behavior changed.
7. Mark completed phases with `ck plan check <phase-id>` instead of hand-editing phase status.
8. Run final verification matrix.
9. Run code review workflow per project rule after tests pass.
10. Prepare commit summary without secrets and without AI references if user requests commit.

## Todo List

- [ ] Changelog updated for shipped changes.
- [ ] Roadmap updated for completed/deferred items.
- [ ] Architecture/code standards updated where needed.
- [ ] Plan statuses updated through `ck plan check`.
- [ ] Full verification matrix recorded.
- [ ] Code review completed after tests pass.

## Verification & Tests

Minimum final gate after any code phase ships:

```bash
npm run lint
npm run test
npm run build
```

Targeted E2E gate based on completed phases:

```bash
npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/element-interactions.spec.js tests/e2e/visual-regression.spec.js tests/e2e/pptx-import-fidelity.spec.js tests/e2e/live.spec.js tests/e2e/sharing.spec.js
```

PPTX-specific gate if Phase 6 ships:

```bash
npm run test:corpus
```

Optional gates:

```bash
npm run test:e2e
npm run test:load:api
npm run test:load:ws
```

Do not ignore failed tests to pass build.

## Success Criteria

- [ ] Docs reflect actual implementation, not aspirational scope.
- [ ] All required tests pass or blockers are documented with owner.
- [ ] Code review findings are addressed or explicitly deferred with rationale.
- [ ] Plan has clear handoff path for `/ck:cook` or `/ck:ship`.

## Risk Assessment

- Risk: docs overstate P2 spikes as shipped features.
- Mitigation: document `validated`, `deferred`, or `spike complete` precisely.
- Risk: full E2E suite is slow or flaky.
- Mitigation: run targeted gates first, then full suite when preparing push/release.

## Security Considerations

- Confirm no `.env`, tokens, credentials, or real private corpus files are committed.
- Review analytics changes for privacy and token access guard.
- Review PDF/PPTX import changes for file parsing limits and unsafe embedded content.

## Next Steps

Use `/ck:cook` with this `plan.md` to execute. Use `/ck:ship` only after tests,
review, docs, and user approval for commit/push.

## Unresolved Questions

- Which optional gates are mandatory for release: full E2E, load tests, Electron build, or all?
