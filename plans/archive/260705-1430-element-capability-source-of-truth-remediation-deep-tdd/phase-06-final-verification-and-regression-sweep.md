---
phase: 6
title: "Final Verification and Regression Sweep"
status: completed
priority: P0
dependencies: [1, 2, 3, 4, 5]
---

# Phase 06: Final Verification and Regression Sweep

## Overview

Run the complete regression gate and ensure the source-of-truth cleanup did not change runtime behavior unexpectedly.

## Requirements

- Functional: all phase-specific tests pass.
- Functional: matrix gates pass and generated reports are deterministic.
- Non-functional: lint/build remain clean.

## Architecture

This phase is validation-only except for fixing failures discovered by validators. Treat any failure as a bug in earlier phases, not as a reason to weaken the tests.

## Related Code Files

- Read/verify: all files changed in Phases 1-5
- Modify only if validators expose a concrete defect

## Verification Steps

1. Run phase-specific tests from Phases 1-5.
2. Run unit test suite.
3. Run lint.
4. Run build.
5. Regenerate matrix output.
6. Run matrix gates.
7. Inspect generated diffs for accidental broad rewrites or generated artifact churn.

## Required Commands

```powershell
npx vitest run client/src/data/element-defaults.test.js
npx vitest run client/src/hooks/game-element-foundation.test.js
npx vitest run scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs
npx vitest run client/src/utils/exportPptx.test.js
npx vitest run client/src/components/ribbon/ribbon-tabs-config.test.js
npm run test
npm run lint
npm run build
npm run matrix
npm run matrix:gate
```

## Success Criteria

- [x] All targeted tests pass.
- [x] `npm run test` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `npm run matrix` regenerates deterministic matrix output.
- [x] `npm run matrix:gate` passes.
- [x] No generated matrix/report drift is left unstaged/unexplained.
- [x] No new source-of-truth duplication is introduced.

## Risk Assessment

Risk: full suite may reveal unrelated flaky tests. Mitigation: rerun once to confirm flake, capture exact output, and do not mark complete unless failure is fixed or explicitly waived by the user.
