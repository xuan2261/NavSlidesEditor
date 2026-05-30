# Phase 02 - Editor Core Gap Closure

## Context Links

- [Plan](./plan.md)
- [Baseline phase](./phase-01-baseline-and-verification-contract.md)
- [Feature coverage matrix](../../docs/feature-coverage-matrix.md)

## Overview

Priority: P1. Status: Pending. Convert editor-core `ALLOWED` entries into real PASS where practical, starting with high-risk behavior.

## Key Insights

- Known important gaps include autosave, undo/redo, z-order, insert commands, group/ungroup command paths, chart/timeline deep coverage.
- Unit tests should cover pure logic. Playwright should cover real user flows only where DOM/integration matters.

## Requirements

- TDD per capability or small capability cluster.
- No fake behavior or empty render-only assertions.
- Use `[cap:<id>]` and `tier:deep` where required.
- Keep new test files below 200 LOC.
- For every P0/P1 gap, record the behavior oracle before writing the test: README/docs expectation, existing user-facing behavior spec, or issue/report that defines the expected outcome.
- Avoid production refactors solely to make a gap easy to test. If behavior is not safely testable without refactor, leave dated debt with the extraction target.
- <!-- Updated: Validation Session 1 - do not encode guessed/current behavior for P0/P1 gaps without a clear oracle. -->

## Architecture

Layering:

```text
pure hooks/store logic -> Vitest
ribbon/control dispatch -> React Testing Library
canvas DOM interaction -> Playwright or focused hook test
visual layout risk -> Playwright screenshot only when needed
```

High-risk recovery paths are first-class capability tests, not optional edge cases:

- autosave rapid edits coalesce correctly
- failed save shows visible failure and does not produce false saved timestamp
- retry persists the latest state
- reload before debounce flush does not silently lose acknowledged changes
- undo/redo around failed save preserves local state and recovery behavior

## Related Code Files

- Modify: `client/src/hooks/*test*`
- Modify: `client/src/stores/*test*`
- Modify: `client/src/components/ribbon/**/*.test.*`
- Modify: `client/src/components/canvas/**/*.test.*`
- Modify: `tests/e2e/pages/*` if POM method needed
- Modify: `tests/e2e/*.spec.js` or focused subfolder specs
- Modify: `scripts/feature-inventory/coverage-gate-allowlist.json`

## Implementation Steps

1. Red: pick highest-risk allowed capability from validated baseline JSON.
2. Confirm behavior oracle before encoding the failing tagged test; if no oracle exists, record dated debt with spec or extraction target instead of writing a guess-based test.
3. Green: make minimal source/test helper change to assert real behavior.
4. Refactor: extract shared fixtures/helpers only after second duplicate and only if it does not change product behavior.
5. Repeat by priority: P0/P1 recovery and security-adjacent flow, canvas, command/control, then low-risk controls.
6. Remove resolved allowlist entries in same change as passing tests.
7. Run targeted Vitest, then `npm run matrix:gate`.

## Todo List

- [ ] Add deep autosave verification or justified debt.
- [ ] Add autosave failure/retry/debounce recovery coverage or explicit debt.
- [ ] Add undo/redo behavior coverage.
- [ ] Add z-order behavior coverage.
- [ ] Add insert text/shape command coverage.
- [ ] Add group/ungroup command path coverage.
- [ ] Add chart/timeline deep coverage or extraction path.
- [ ] Shrink allowlist.

## Success Criteria

- All P0/P1 editor-core gaps from the Phase 1 fixed baseline are PASS or have owner/date/reason debt.
- Editor-core PASS count >= 90/100 remains a secondary health metric.
- No high-risk gap remains silently allowed.
- `npm run matrix:gate` passes.
- Targeted tests pass locally.

## Risk Assessment

- Risk: deep test requires extracting logic from large components. Mitigation: extract smallest pure function seam, no broad refactor.
- Risk: E2E flakes. Mitigation: use POM, state-based waits, no `waitForTimeout`.

## Security Considerations

- Tests must use local run data only.
- Do not bypass loopback guard.

## Next Steps

Phase 3 covers end-to-end user confidence beyond isolated capability checks.
