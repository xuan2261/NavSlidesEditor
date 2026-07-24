---
phase: 7
title: "Full Validation and Regression Sweep"
status: completed
priority: P0
dependencies: [2, 3, 4, 5, 6]
---

# Phase 07: Full Validation and Regression Sweep

## Overview

Run the full verification gate after all fixes and reconcile the implementation against the original debug report.

## Requirements

- Functional: every defect in D1-D7 is closed with tests.
- Non-functional: full unit suite, lint, and build pass before handoff.

## Architecture

Use layered validation:
1. Targeted tests for edited areas.
2. Full Vitest suite.
3. ESLint.
4. Production build.
5. Mandatory scoped Playwright smoke for browser-only interaction contracts.
6. Formatting check when non-writing Prettier check is available.

## Related Code Files

- Read/verify: all files changed in Phases 1-6
- Modify: tests only if final validation reveals missing assertions

## Validation Commands

Run targeted commands first:

```bash
npx vitest run client/src/editor-interaction-bug-repro.test.js
npx vitest run client/src/components/canvas/use-canvas-pointer-interaction.test.js
npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx
npx vitest run client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx
npx vitest run client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx
npx vitest run client/src/utils/element-update-fanout.test.js
npx vitest run client/src/utils/active-slide-selection.pointer-down.test.js
npx vitest run client/src/components/canvas/rubber-band-marquee-selection.test.js
npx vitest run client/src/hooks/use-clipboard.test.js
# Add the shared renderer/export test path created in Phase 06.
npx playwright test tests/editor-element-interactions.spec.js
```

Then final gate:

```bash
npm run test
npm run lint
npm run build
```

Formatting gate:

```bash
npx prettier --check .
```

If project Prettier check is unavailable or too broad for the changed scope, record that `npm run format` was intentionally not run because it writes files, and rely on `npm run lint` plus targeted formatter output.

## Regression Checklist

- [x] D1: unselected line direct click and context menu verified.
- [x] D2: batch/group drag shared delta verified at all edges.
- [x] D3: arrow-key nudge clamp verified at all edges.
- [x] D4: locked element mutation blocked through controls/ribbon.
- [x] D5: context Cut target semantics and locked behavior verified.
- [x] D6: group selection semantics verified for marquee and shift/additive paths.
- [x] D7: line export overflow verified.
- [x] Red-team: strict lock-only payload and bypass inventory verified.
- [x] Red-team: mixed locked group atomic no-op verified.
- [x] Red-team: context-menu target-aware selection has no async race.
- [x] Red-team: multi-select snap/guide/clamp contract verified.
- [x] Red-team: Playwright line hit target smoke verified.
- [x] Validation: shared renderer/export line path tests are included in targeted commands.
- [x] Validation: helper tests for lock fanout, active-slide selection, marquee selection, and clipboard/context behavior are included.
- [x] Validation: Prettier check is run or explicitly documented as skipped because only write-mode `npm run format` exists.
- [x] Search confirms no D1-D7 `it.fails`, `test.fails`, `.skip`, or bug-present tripwire remains.
- [x] Existing element/control tests remain green.

## Implementation Steps

1. Re-read the debug report and this plan.
2. Run targeted tests and fix any failures.
3. Search newly touched tests for `it.fails`, `test.fails`, `.skip`, and bug-present assertions.
4. Produce a defect-to-test mapping in final validation notes.
5. Generate a defect-to-test command map from the actual touched files and run every command in that map, not only the static list above.
6. Run full validators.
7. Run Prettier check when available, or document why it is skipped.
8. If final validators fail, fix root cause and rerun the failed validator plus affected targeted tests.
9. Update plan status only after fresh passing evidence.

## Success Criteria

- [x] Full validator gate passes.
- [x] Every defect has a mapped test.
- [x] No D1-D7 regression remains as `fails` or `skip`.
- [x] Scoped Playwright smoke passes.
- [x] Actual touched-test command map is complete and executed.
- [x] Formatting gate outcome is recorded.
- [x] No unresolved contradictions remain between implementation and plan.
- [x] Final summary includes exact commands run and outcomes.

## Risk Assessment

Full test suite may reveal stale characterization tests expecting old buggy behavior. Convert only tests that encode confirmed fixed behavior, do not weaken unrelated assertions.
