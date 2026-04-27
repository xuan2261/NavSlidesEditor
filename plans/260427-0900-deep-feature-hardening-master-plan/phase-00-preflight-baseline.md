---
phase: 0
title: "Pre-flight & Baseline"
status: completed
priority: P0
effort: "1d"
dependencies: []
---

# Phase 0: Pre-flight & Baseline

## Context Links

- Audit: `plans/reports/debugger-260427-0823-refactoring-plan-audit.md`
- Old plan: `plans/260427-0531-deep-feature-synthesis-hardening-roadmap/plan.md`
- Read: `client/src/components/SlideCanvas.jsx` (2759 LOC)
- Read: `client/src/pages/EditorPage.jsx` (1662 LOC)
- Read: `client/src/hooks/use-keyboard.js`
- Read: `client/src/hooks/use-clipboard.js`

## Overview

Verify the working-tree state before Phase 1. Commit the `use-history.js` deletion,
capture LOC baselines, and run the test matrix to create a clean starting point.

## Key Insights

- `use-history.js` is deleted in working copy but uncommitted — must be formally committed or restored.
- `AnimationPreviewModal` was added in a previous commit and needs changelog entry.
- `presenterToken` live-presentation hardening was added — needs changelog entry.
- SlideCanvas LOC baseline: **2759** — target `<=1200` after Phase 2, `<=~600` after Phase 3.
- EditorPage LOC baseline: **1662** — target reduction as interaction hooks extract.

## Requirements

- Functional: capture LOC for all target files.
- Functional: run full test matrix to identify baseline failures.
- Functional: commit `use-history.js` deletion with explanation.
- Non-functional: no behavior changes; just capture and commit.

## Related Code Files

- Read: `client/src/hooks/use-history.js` (verify deletion state)
- Modify: commit `client/src/hooks/use-history.js` deletion
- Modify: `docs/project-changelog.md` — add AnimationPreviewModal, presenterToken, command-layer fixes entries
- Modify: `docs/project-roadmap.md` — update phase statuses

## Implementation Steps

1. Run `git status --short` to confirm working tree state.
2. Record baseline LOC: SlideCanvas.jsx, EditorPage.jsx, all hooks, all stores.
3. Commit `use-history.js` deletion with message: `chore: remove deprecated use-history.js (logic inlined into EditorPage)`.
4. Run baseline test suite to capture pre-existing failures:
   ```bash
   npm run test -- --reporter=verbose 2>&1 | head -100
   ```
5. Run `npm run lint` and record any errors.
6. Run `npm run build` and confirm it succeeds.
7. Run Playwright smoke to confirm editor loads:
   ```bash
   npx playwright test tests/smoke.spec.js --reporter=line 2>&1 | head -50
   ```
8. **Verify `use-history.js` is unused before committing deletion:**
   ```bash
   grep -r "use-history" client/src/ --include="*.js" --include="*.jsx"
   ```
   If zero results → safe to commit deletion. If any import found → restore and investigate.
9. Commit `use-history.js` deletion with message: `chore: remove deprecated use-history.js (logic inlined into EditorPage)`.
10. Update `docs/project-changelog.md` with:
    - AnimationPreviewModal feature
    - `presenterToken` live presentation hardening
    - Command layer improvements (locked-element guards, paste-on-empty, stale closure fixes)
    - PPTX export hardening (12 files, separate from import fidelity plan)
11. Update `docs/project-roadmap.md` to reflect current state.

## Todo List

- [x] LOC baseline captured for all target files.
- [x] `use-history.js` deletion formally committed (after usage audit).
- [x] All pre-existing test failures documented (0 pre-existing failures).
- [x] `npm run build` succeeds.
- [x] `docs/project-changelog.md` updated with recent features.
- [x] `docs/project-roadmap.md` updated.

## Baseline Results (2026-04-27)

| File | LOC |
|------|-----|
| `client/src/components/SlideCanvas.jsx` | 2759 |
| `client/src/pages/EditorPage.jsx` | 1662 |
| `client/src/hooks/use-keyboard.js` | 146 |
| `client/src/hooks/use-clipboard.js` | 81 |
| `client/src/stores/presentation-store.js` | 133 |
| `client/src/stores/editor-store.js` | 69 |

**Test suite:** 381/381 passed, 67 test files
**Lint:** passed (no errors)
**Build:** passed (warning: chunk >500kB)
**`use-history.js`:** confirmed unused → committed deletion (c1dae07)
**Pre-existing failures:** 0

## Verification Commands

```bash
# LOC baseline
wc -l client/src/components/SlideCanvas.jsx client/src/pages/EditorPage.jsx \
  client/src/hooks/use-keyboard.js client/src/hooks/use-clipboard.js \
  client/src/stores/presentation-store.js client/src/stores/editor-store.js

# Test baseline
npm run test 2>&1 | tail -20

# Build baseline
npm run build 2>&1 | tail -10

# Smoke
npx playwright test tests/smoke.spec.js --reporter=line 2>&1 | tail -20
```

## Success Criteria

- [ ] Baseline LOC recorded in phase file comments.
- [ ] `use-history.js` deletion is a proper git commit.
- [ ] `npm run build` passes.
- [ ] Pre-existing test failures are known and isolated.
- [ ] Changelog and roadmap are updated.

## Risk Assessment

- Risk: pre-existing test failures mask Phase 1 bugs.
- Mitigation: record failures as baseline; fix only blockers, not all failures.
- Risk: `use-history.js` deletion commit is accidental.
- Mitigation: confirm the hook is fully unused before committing.

## Next Steps

Proceed to Phase 1 only after this phase is committed.
