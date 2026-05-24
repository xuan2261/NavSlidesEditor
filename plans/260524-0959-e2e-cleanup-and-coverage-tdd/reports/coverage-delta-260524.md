# E2E Coverage Delta - Post-Phase 8 Local Verification

Date: 2026-05-24

## Local Gate Summary

| Gate | Result |
|---|---|
| `npm test` | 169 files passed, 1 skipped; 1439 tests passed, 9 skipped |
| `npm run test:e2e` | 454 passed, 17 skipped |
| `npx playwright test --repeat-each=3` | 1362 passed, 51 skipped |
| `npm run lint` | 0 errors, 109 existing warnings |
| `npm run build` | Passed; existing chunk-size / empty `vendor-reveal` warnings |
| `npm run test:coverage` | 169 files passed, 1 skipped; 1439 tests passed, 9 skipped |

## Wallclock Comparison

| Run | Baseline | Post-Phase 8 | Delta |
|---|---:|---:|---:|
| `npm run test:e2e` | 291.05s, exit 1 | 258.90s, exit 0 | -32.15s (-11.05%) |

Budget: <= +5%. Status: pass.

## Repeatability

| Run | Result | Wallclock |
|---|---|---:|
| `npx playwright test --repeat-each=3` | 1362 passed, 51 skipped, exit 0 | 725.67s |

## Coverage Summary

| Metric | Baseline | Post-Phase 8 | Delta |
|---|---:|---:|---:|
| Statements | 38.39% | 38.38% | -0.01pp |
| Branches | 32.17% | 32.19% | +0.02pp |
| Functions | 33.04% | 33.00% | -0.04pp |
| Lines | 39.99% | 39.99% | 0.00pp |

Statement/function drift is a global aggregate effect from changed file/instrumentation set; line coverage is unchanged and branch coverage improved. The plan's new coverage surfaces are enforced through targeted unit/E2E tests listed below.

## Added Coverage Surfaces

| Surface | Added verification |
|---|---|
| Smart guides | `tests/e2e/canvas/smart-guides.spec.js` |
| Clipboard offsets | `tests/e2e/canvas/clipboard.spec.js`, `tests/unit/clipboard-offset-source.test.js` |
| Element hide/show | `tests/e2e/canvas/element-hide-show.spec.js`, `tests/unit/element-hide-feature-source.test.js` |
| PPTX export | `tests/e2e/export/pptx-export.spec.js` |
| Markdown import | `tests/e2e/import/markdown-import.spec.js` |
| rclone sync | `tests/e2e/sync/rclone-proton-drive.spec.js`, `tests/unit/sync-routes-contract.test.js` |
| Game shortcuts | `tests/e2e/games/keyboard-shortcuts.spec.js`, game shortcut unit contracts |
| Visual matrix | `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js` |
| Selector/testid catalog | `tests/unit/data-testid-presence.test.js`, `tests/e2e/selectors-contract.spec.js` |
| Architecture guards | Phase 7 audit unit tests |

## waitForTimeout Sites

| Run | Count |
|---|---:|
| Baseline Phase 1 | 20 across 10 files |
| Post-Phase 8 | 0 in `tests/e2e/**` |

## CI Status

Not verified in this local run. The worktree is uncommitted/unpushed, so GitHub Actions cannot validate the branch-specific 4-job E2E matrix yet.

## Unresolved Questions

- CI branch verification remains pending until commit/push.
