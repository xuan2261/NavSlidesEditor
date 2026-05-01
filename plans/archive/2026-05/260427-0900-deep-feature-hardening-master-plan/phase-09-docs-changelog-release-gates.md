---
phase: 9
title: "Phase 10: Roadmap Docs, Changelog & Release Gates"
status: completed
priority: P1
effort: "1-2d"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8]
completed: "2026-04-27"
---

# Phase 9: Roadmap Docs, Changelog & Release Gates

## Context Links

- All preceding phases (0-8)
- Docs: `docs/project-roadmap.md`, `docs/project-changelog.md`, `docs/system-architecture.md`, `docs/code-standards.md`
- Plan: this folder's `plan.md` and phase files

## Overview

Close the roadmap with docs updates, test matrix, code review, and release gates.
Make implementation traceable and prevent stale synthesis claims from returning.

## Key Insights

- Only update docs for **shipped phases**, not aspirational scope.
- Record no-go/spike/deferred decisions for P2 phases.
- Run full verification matrix before handoff.
- No AI references in commit messages.

## Requirements

- Functional: update docs for each completed phase.
- Functional: record no-go decisions for deferred phases.
- Functional: run full verification before handoff.
- Non-functional: concise docs; no AI references in commits.
- Non-functional: keep unresolved questions at end of phase docs.

## Related Code Files

- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/system-architecture.md` (if architecture changed: command layer, canvas components, analytics service)
- Modify: `docs/code-standards.md` (if new conventions: shortcut registry, canvas extraction patterns)
- Modify: `docs/pptx-import-fidelity-report.md` (if Phase 5 ran)
- Modify: `README.md` (if shortcuts, PDF, analytics behavior changed user-visible)
- Modify: this plan's `plan.md` (update phase statuses)
- Modify: each phase file (update status from `pending` to `completed`)

## Implementation Steps

### Per Completed Phase

For each phase that completed:

1. **List actual files changed** and tests run.
2. **Mark phase file status** as `completed`.
3. **Update `plan.md`** phase table.

### Phase-specific Doc Updates

**Phase 1 (Command Layer):**
- `docs/system-architecture.md`: document command callback architecture
- `docs/code-standards.md`: add convention for command callbacks

**Phase 2 (Canvas Render Decomposition):**
- `docs/system-architecture.md`: add canvas components section
- `docs/code-standards.md`: add convention for element renderer extraction

**Phase 3 (Canvas Chrome):**
- `docs/system-architecture.md`: add interaction hooks section

**Phase 4 (Shortcut Registry):**
- `README.md`: update shortcut table
- `docs/code-standards.md`: add shortcut registry convention

**Phase 5 (PPTX Import):**
- `docs/pptx-import-fidelity-report.md`: update corpus results
- `docs/system-architecture.md`: update import pipeline

**Phase 6 (Slide Master):**
- `docs/project-roadmap.md`: mark deferred or approved with rationale

**Phase 7 (PDF Spike):**
- `docs/project-roadmap.md`: document decision and rationale

**Phase 8 (Analytics):**
- `docs/system-architecture.md`: add analytics service
- `docs/project-roadmap.md`: document privacy decisions

### Changelog

**Update `docs/project-changelog.md`:**

For each shipped feature:
```md
## [Unreleased]

### Added
- Command layer unification: SlideCanvas no longer owns clipboard/keyboard
- Canvas render decomposition: 15 element types extracted to canvas/components/
- Custom shortcut registry with localStorage overrides
- PPTX import fidelity hardening (per-type corpus gates, chart metadata)

### Changed
- SlideCanvas reduced from 2759 to ~600 LOC

### Deprecated
- (list deprecated features)

### Fixed
- (list bug fixes)

### Removed
- use-history.js (logic inlined into EditorPage)
```

### Roadmap Update

**Update `docs/project-roadmap.md`:**

- Mark all completed phases
- Mark P2 phases as: `validated+approved`, `spike complete`, or `deferred`
- Update next limitations and open questions

### Final Verification Matrix

Run minimum gate:
```bash
npm run lint
npm run test
npm run build
```

Run targeted E2E based on completed phases:
```bash
npx playwright test \
  tests/e2e/keyboard-shortcuts.spec.js \
  tests/e2e/element-interactions.spec.js \
  tests/e2e/visual-regression.spec.js \
  tests/e2e/pptx-import-fidelity.spec.js \
  tests/e2e/live.spec.js \
  tests/e2e/sharing.spec.js \
  tests/e2e/settings.spec.js
```

If Phase 5 shipped:
```bash
npm run test:corpus
```

Optional:
```bash
npm run test:e2e
npm run test:load:api
npm run test:load:ws
```

### Code Review

Run code review workflow per project rule after tests pass.

### Commit

Prepare commit summary (no secrets, no AI references):
```bash
git add -p  # review changes
git commit -m "$(cat <<'EOF'
feat(refactor): unify command layer and decompose canvas

- Remove inline clipboard/keyboard from SlideCanvas
- Extract 15 element renderers to canvas/components/
- Extract canvas chrome to canvas/components/
- Add custom shortcut registry with localStorage overrides
- PPTX import fidelity per-type corpus gates
- SlideCanvas reduced from 2759 to ~600 LOC

Closes #...
EOF
)"
```

## Todo List

- [ ] All completed phase files marked `completed`
- [ ] `plan.md` phase table updated
- [ ] `docs/project-changelog.md` updated
- [ ] `docs/project-roadmap.md` updated
- [ ] `docs/system-architecture.md` updated where architecture changed
- [ ] `docs/code-standards.md` updated where new conventions introduced
- [ ] `README.md` updated if user-visible shortcuts changed
- [ ] `docs/pptx-import-fidelity-report.md` updated if Phase 5 ran
- [ ] Final verification matrix run and passing
- [ ] Code review completed
- [ ] Changes committed with clean commit message

## Verification Commands

```bash
# Final gate
npm run lint && npm run test && npm run build

# E2E based on completed phases
npx playwright test \
  tests/e2e/keyboard-shortcuts.spec.js \
  tests/e2e/element-interactions.spec.js \
  tests/e2e/visual-regression.spec.js

# If Phase 5 shipped
npm run test:corpus
```

## Success Criteria

- [ ] Docs reflect actual implementation, not aspirational scope
- [ ] All required tests pass or blockers are documented with owner
- [ ] Code review findings addressed or explicitly deferred with rationale
- [ ] Plan has clear handoff path for `/ck:cook` or `/ck:ship`
- [ ] No secrets or AI references in commit message

## Release Gates (MUST ALL PASS before merge)

| Gate | Criteria | Tool |
|------|---------|------|
| 1 | All P0 phases complete + tests green | `npm run test` |
| 2 | LOC targets: SlideCanvas <= 1200 (P2), <= ~900 (P3) | `wc -l` |
| 3 | No new `console.error` introduced by refactoring | grep + manual |
| 4 | Playwright E2E: all tests green | `npx playwright test` |
| 5 | Visual regression: no unexpected diffs | `tests/e2e/visual-regression.spec.js` |
| 6 | Bundle size: <= 10% increase from baseline | Vite build |
| 7 | PPTX corpus: semantic >= 95%, round-trip >= 98% | `npm run test:corpus` |
| 8 | `npm run lint` + `npm run build` pass | CI gate |

> **Do not ignore failed tests to pass build.**

## Risk Assessment

- Risk: docs overstate P2 spikes as shipped features.
  - Mitigation: document `validated`, `deferred`, or `spike complete` precisely.
- Risk: full E2E suite slow or flaky.
  - Mitigation: run targeted gates first; full suite only when preparing release.

## Security Considerations

- Confirm no `.env`, tokens, credentials, or real private corpus files committed.
- Review analytics changes for privacy and token access guard.
- Review PDF/PPTX import changes for file parsing limits and unsafe content.

## Next Steps

Use `/ck:cook` with completed phases. Use `/ck:ship` only after tests, review, docs, and user approval.
