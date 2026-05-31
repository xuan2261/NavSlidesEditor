---
status: completed
priority: P0
effort: 1d
---

# Phase 01 - P0 Governance Contracts Repair

## Context Links

- Source report: [Test System Review And Roadmap](../reports/260531-1908-test-system-review-and-roadmap.md)
- Tests: `tests/unit/github-actions-ci-release-confidence-contract.test.js`, `tests/unit/release-verification-docs-contract.test.js`, `tests/unit/plan-completion-gate.test.js`
- Current failing command: `npm run test:coverage`

## Overview

Make coverage pass again without weakening release-confidence assertions. Fix brittle plan/report path assumptions and the skipped-suite collection bug.

## Key Insights

- `plans/` is operational history and can archive; tests must not require one movable top-level plan directory.
- `describe.skipIf()` does not protect filesystem reads executed while defining the skipped suite.
- Fix the governance seam before expanding feature coverage, otherwise new work lands on a red baseline.

## Requirements

- Functional: release-confidence tests resolve evidence from stable docs and/or active/archive plan paths.
- Functional: plan completion gate does no filesystem read unless `RUN_PLAN_GATE` is set.
- Non-functional: no test is relaxed to ignore missing required release facts.
- Non-functional: helper code stays small and testable.

## Architecture

Prefer a tiny test helper for evidence path resolution:

```js
const candidatePaths = [
  ['plans', planId, 'reports', file],
  ['plans', 'archive', planId, 'reports', file],
]
```

If evergreen docs fully replace plan reports in Phase 2, Phase 1 may keep this as a compatibility bridge only.

## Related Code Files

| Action | Path | Notes |
|---|---|---|
| Modify | `tests/unit/plan-completion-gate.test.js` | Move `readdirSync` inside guarded `it` or setup after env check |
| Modify | `tests/unit/github-actions-ci-release-confidence-contract.test.js` | Stop single hard-coded top-level report dependency |
| Modify | `tests/unit/release-verification-docs-contract.test.js` | Stop single hard-coded top-level summary dependency |
| Optional create | `tests/unit/helpers/release-evidence-paths.js` | Only if both contract tests need shared resolver |

## TDD Plan

1. RED: run `npm run test:coverage` and capture the three known failures.
2. RED: add/adjust focused expectations proving archived or evergreen evidence path works.
3. GREEN: guard `plan-completion-gate.test.js` so missing plan dir cannot fail when `RUN_PLAN_GATE` is unset.
4. GREEN: update release-confidence tests to use resolver or evergreen docs fallback.
5. REFACTOR: dedupe path-reading helper only if duplication appears in both tests.

## Tests For This Phase

| Test | Command | Expected |
|---|---|---|
| Focused plan gate | `npx vitest run tests/unit/plan-completion-gate.test.js` | Pass when `RUN_PLAN_GATE` unset |
| Focused release contracts | `npx vitest run tests/unit/github-actions-ci-release-confidence-contract.test.js tests/unit/release-verification-docs-contract.test.js` | Pass |
| Full coverage gate | `npm run test:coverage` | Pass or fail only on unrelated newly discovered issue |

## Todo List

- [x] Capture current failure output in plan report or implementation notes.
- [x] Fix skipped-suite collection read.
- [x] Replace brittle release evidence path reads.
- [x] Run focused Vitest.
- [x] Run `npm run test:coverage`.

## Success Criteria

- No `ENOENT` from archived/missing plan paths.
- `RUN_PLAN_GATE` unset means the plan completion gate is actually skipped.
- Required release terms are still asserted.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Resolver hides missing evidence | High | Assert at least one canonical evidence source exists and contains required text |
| Tests keep coupling to plan history | Medium | Phase 2 moves final facts to evergreen docs |

## Security Considerations

- Do not add logs that print secrets from CI artifacts.
- Keep secret/artifact scan requirements asserted in release docs.

## Next Steps

Proceed to Phase 2 after focused tests and `npm run test:coverage` are green.
