# Phase 04 - End To End Workflow Expansion

## Context Links

- [Plan](./plan.md)
- [Critical User Journeys](../../docs/critical-user-journeys.md)
- `tests/e2e/fixtures/test-fixtures.js`
- `tests/e2e/pages/`
- `tests/e2e/elements/`
- `tests/e2e/export/`
- `tests/e2e/live/`
- `tests/e2e/games/`

## Overview

Priority: P0  
Status: completed-with-concerns  
Description: Add durable Playwright workflows only where browser integration is the real risk: composed editor UI, autosave/reload, import/export, live sync, games, keyboard/touch, and responsive controls.

## Key Insights

- E2E should not duplicate every unit test.
- Best E2E shape: perform a user action, reload/open exported artifact, assert final state.
- Existing POM helpers should be reused and extended, not bypassed.

## Requirements

- Use `testPresentation` for create/cleanup.
- Prefer `data-testid` and role selectors.
- No `waitForTimeout`.
- Each new E2E file stays under 200 LOC.
- Every flow asserts persisted JSON or downloaded artifact where relevant.
- Default budget: add no more than 8 new E2E specs and no more than 12 new browser tests without updating Phase 1 backlog rationale.
- Any workflow touching shared state or live/game sockets must document worker mode and isolation assumptions.
- <!-- Updated: Validation Session 1 - keep default E2E cap; unit/component tests handle combinatorics. -->

## Architecture

```text
Playwright action -> API/persisted JSON -> reload/present/export assertion
```

## Related Code Files

Modify:
- `tests/e2e/pages/*.js` helpers as needed.
- Existing domain specs where small extension is cleaner.

Create:
- `tests/e2e/coverage-depth/` specs or focused specs under existing domain folders.

Delete:
- None.

## Implementation Steps

1. Create a minimum E2E depth set:
   - editor control -> autosave -> reload
   - element property -> present/export rendering
   - slide management -> reload
   - import -> edit -> export
   - live presenter -> viewer sync/reconnect
   - game presenter -> player score/leaderboard
2. Write failing E2E assertions before fixes or helper changes.
3. Extend page objects for repeated stable interactions.
4. Add artifact inspection for HTML/PPTX/archive/PDF print trigger where practical.
5. For each new browser test, record expected runtime bucket: `<30s`, `30-90s`, or `>90s`.
6. Run targeted Playwright specs locally.
7. Run full `npm run test:e2e` when slices stabilize.

## Todo List

- [x] Add editor control persistence E2E.
- [x] Add element property export/present E2E.
- [x] Add import/edit/export E2E expansion.
- [x] Add live/game E2E depth assertions.
- [x] Add responsive/keyboard/touch depth where missing.
- [x] Track browser test count and runtime buckets against the validated cap.

## Progress Notes

- Added 3/12 browser tests for editor control persistence, element-property export, and Markdown import/edit/export. Runtime buckets: focused control spec `<30s`, Markdown import spec expected `30-90s`.
- New spec: `tests/e2e/coverage-depth/editor-control-persistence.spec.js`.
- The workflow edits shape geometry and fill through the real properties panel, asserts persisted JSON, reloads, and verifies the controls rehydrate from saved state.
- Added export artifact inspection for shape rotation and fill after UI edits.
- Extended Markdown import E2E to edit imported text, assert persisted JSON, export HTML, and inspect the artifact.
- Tagged existing live reconnect and game scoring E2E tests with `sync`/`behavior` depth evidence; no new browser tests added for this todo.
- Tagged existing File menu keyboard test with `a11y` depth evidence and recorded existing responsive/touch specs as Phase 4 evidence without adding new capability IDs.
- Browser test budget: 3 new tests / 12 cap, 1 new spec file / 8 cap. Focused targeted runtime remained under 30s per spec on this machine.
- Validation: targeted Playwright specs passed for coverage-depth editor controls, Markdown import, game scoring, critical live reconnect, keyboard a11y, and touch gestures; `npm run matrix:gate` passed with 0 warnings. After stabilizing markdown export rehydration, PPTX direct API import contention, live presenter-disconnect cleanup, plugin runtime API polling, and PPTX browser-audit import setup, full `npm run test:e2e` passed on 2026-06-16 with 475 passed, 22 skipped, and 0 retry-passed flakes.

## Success Criteria

- Critical UI flows prove final persisted/exported behavior, not only button clicks.
- New specs are stable with run-level data isolation.
- Full Playwright suite remains practical for CI sharding.
- Added browser coverage stays inside the test-count/runtime budget or has explicit Phase 1 evidence for exceeding it.

## Risk Assessment

- Risk: slow suite. Mitigation: one E2E per high-value workflow, unit tests for combinatorics.
- Risk: flaky waits. Mitigation: use state-based waits and existing helpers.
- Risk: shared run-level data creates cross-worker flakes. Mitigation: live/game/settings/template tests must run with explicit worker constraints or isolated fixtures.
- Residual flake evidence from full suite: none in latest full `npm run test:e2e`.

## Security Considerations

- Destructive API helpers must keep loopback guard.
- Share/live tests must assert viewer cannot mutate presenter-only state.

## Next Steps

- Phase 5 covers external boundaries without real credentials.

## Red Team Notes

- Accepted finding: without a hard E2E budget, "long-term coverage" turns into a slow brittle suite. Phase 4 now caps browser test growth and requires runtime/isolation notes.

## Unresolved Questions

- None.
