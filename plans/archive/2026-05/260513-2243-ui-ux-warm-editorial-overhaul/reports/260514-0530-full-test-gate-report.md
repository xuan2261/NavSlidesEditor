# Test Report — 260514-0530 — UI UX Warm Editorial Overhaul

---
scope: full test gate after cook
plan: plans/260513-2243-ui-ux-warm-editorial-overhaul
status: done-with-blockers
---

## Summary

- Lint: PASS
- Build: PASS
- Unit: PASS
- E2E: PASS after fixing stale modal selectors
- Corpus strict: FAIL, semantic fidelity below strict threshold
- Load tests: BLOCKED, `k6` missing from PATH

## Commands

| Command | Status | Result |
|---|---:|---|
| `npm run lint` | PASS | 0 errors, 0 warnings after cleanup |
| `npm run build` | PASS | Vite production build complete |
| `npm run test` | PASS | 104 files, 914 tests passed |
| `npx playwright test tests/e2e/ai.spec.js tests/e2e/editor.spec.js tests/e2e/sharing.spec.js` | PASS | 11/11 passed |
| `npx playwright test tests/e2e/games/game-elements.spec.js -g "game element increments canvas element count" --repeat-each=3` | PASS | 3/3 passed |
| `npm run test:e2e` | PASS | 155/155 passed |
| `npm run test:corpus` | FAIL | 4/4 processed, strict average semantic fidelity failed |
| `npm run test:load:api` | BLOCKED | `k6` not recognized |
| `npm run test:load:ws` | BLOCKED | `k6` not recognized |

## Fixes Applied During Test Gate

- Updated e2e modal assertions from stale `h3:has-text(...)` selectors to accessible `getByRole('dialog', { name })`.
- Cleaned unused Playwright fixture args in `tests/e2e/games/game-elements.spec.js`.

## E2E Failure Root Cause

`ModalShell` now renders modal titles as `h2` and exposes modal identity through `role="dialog"` + `aria-labelledby`.
Some e2e tests still waited for old `h3` headings:

- `AI Copywriter`
- `AI Slide Generator`
- `Translate Presentation`
- `Share Presentation`
- `Version History`

After selector update, targeted rerun passed 11/11 and full e2e passed 155/155.

## Corpus Failure

`npm run test:corpus` result:

- Files: 4 total, 4 passed, 0 failed
- Avg Semantic Fidelity: 66.0%
- Avg Round-trip Stability: 99.0%
- Strict failure: average semantic fidelity below 95%

Lowest semantic fidelity:

| File | Semantic Fidelity | Round-trip Stability |
|---|---:|---:|
| `Bai_2_5.pptx` | 48.0% | 99.0% |
| `Bai_2_2.pptx` | 51.0% | 100.0% |
| `Bai_2_1.pptx` | 65.0% | 96.0% |
| `STTre_Duc.pptx` | 100.0% | 100.0% |

## Build Notes

- Build has existing large chunk warning for `index` and `icon-paths`.
- Vite unit run reports deprecated `vite:react-babel` esbuild option warnings.
- These are warnings, not command failures.

## Critical Issues

1. Corpus strict gate fails because average semantic fidelity is 66.0%, below required 95%.
2. Load gate cannot run until `k6` is installed and available in PATH.

## Recommendations

1. Investigate PPTX semantic fidelity separately. Geometry drift for shapes/text drives low scores in `Bai_2_1`, `Bai_2_2`, `Bai_2_5`.
2. Install `k6`, then rerun `npm run test:load:api` and `npm run test:load:ws`.
3. Keep e2e modal tests on role/name selectors to match accessibility contract.

## Unresolved Questions

- Is the current corpus strict threshold expected to block this UI overhaul, or is it a known importer baseline unrelated to this plan?
- Should `k6` be installed locally on this machine or run only in CI/container?
