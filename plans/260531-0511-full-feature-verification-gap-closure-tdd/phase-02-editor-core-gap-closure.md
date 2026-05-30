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

## Architecture

Layering:

```text
pure hooks/store logic -> Vitest
ribbon/control dispatch -> React Testing Library
canvas DOM interaction -> Playwright or focused hook test
visual layout risk -> Playwright screenshot only when needed
```

## Related Code Files

- Modify: `client/src/hooks/*test*`
- Modify: `client/src/stores/*test*`
- Modify: `client/src/components/ribbon/**/*.test.*`
- Modify: `client/src/components/canvas/**/*.test.*`
- Modify: `tests/e2e/pages/*` if POM method needed
- Modify: `tests/e2e/*.spec.js` or focused subfolder specs
- Modify: `scripts/feature-inventory/coverage-gate-allowlist.json`

## Implementation Steps

1. Red: pick highest-risk allowed capability from baseline report; write failing tagged test.
2. Green: make minimal source/test helper change to assert real behavior.
3. Refactor: extract shared fixtures/helpers only after second duplicate.
4. Repeat by priority: high-risk flow, canvas, command/control, then low-risk controls.
5. Remove resolved allowlist entries in same change as passing tests.
6. Run targeted Vitest, then `npm run matrix:gate`.

## Todo List

- [ ] Add deep autosave verification or justified debt.
- [ ] Add undo/redo behavior coverage.
- [ ] Add z-order behavior coverage.
- [ ] Add insert text/shape command coverage.
- [ ] Add group/ungroup command path coverage.
- [ ] Add chart/timeline deep coverage or extraction path.
- [ ] Shrink allowlist.

## Success Criteria

- Editor-core PASS count >= 90/100.
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
