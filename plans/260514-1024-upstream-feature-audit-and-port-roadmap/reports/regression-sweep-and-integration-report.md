# Regression Sweep And Integration Report

Date: 2026-05-14

## Summary

Phase 08 is `Ready for Merge`.

All regular gates passed, including full Vitest and full Playwright E2E. Conditional corpus strict gate now passes after fixing the semantic fidelity scorer for flattened PPTX groups.

No merge performed.

## Diff Review

Code diff is scoped to accepted ports:

- export/HTML spacing and embed renderer tests
- LaTeX controls/render parity
- fragment `strike` option
- video trim/playback rate controls/render parity
- `.ogv` upload/listing

Planning/docs artifacts added under the active plan directory.

## Verification

Passed:

```powershell
npm run test -- client/src/components/canvas/canvas-element-wrapper.test.jsx shared/tests/element-renderers.test.js client/src/components/properties/import-fidelity-properties.test.jsx server/routes/api-surface.test.js
npm run lint
npm run build
npm run test
npm run test:e2e -- tests/e2e/element-properties.spec.js tests/e2e/export.spec.js
npm run test:e2e
```

Results:

- Targeted Vitest: 4 files, 22 tests passed.
- Lint: passed.
- Build: passed.
- Full Vitest: 106 files, 934 tests passed.
- Targeted Playwright: 9 tests passed.
- Full Playwright: 155 tests passed.

Secret scan:

```powershell
git diff | Select-String -Pattern "(api[_-]?key|token|password|secret|credential)" -CaseSensitive:$false
```

Result: no matches.

## Blocking Gate

Initially failed:

```powershell
npm run test:corpus
```

Observed result:

- Files: 4 total, 4 passed, 0 failed.
- Avg Semantic Fidelity: 66.0%.
- Avg Round-trip Stability: 99.0%.
- Exit reason: `Strict mode failed: average semantic fidelity is below 95%`.

Per-file semantic fidelity:

- `Bai_2_1.pptx`: 65.0%
- `Bai_2_2.pptx`: 51.0%
- `Bai_2_5.pptx`: 48.0%
- `STTre_Duc.pptx`: 100.0%

## Root Cause

`computeSemanticFidelity()` counted grouped PPTX children in the denominator but skipped matching/capture for those children. Shape-heavy grouped decks therefore dropped to 48-65% semantic fidelity even though import/export round-trip remained stable.

Fix:

- Flatten non-empty source groups before semantic matching, matching the importer and detailed metrics behavior.
- Add a regression test that grouped source text/shape children score as captured after flattening.

## Resolved Corpus Gate

Passed:

```powershell
npm run test:corpus
```

Resolved result:

- Files: 4 total, 4 passed, 0 failed.
- Avg Semantic Fidelity: 98.0%.
- Avg Round-trip Stability: 99.0%.

Per-file semantic fidelity:

- `Bai_2_1.pptx`: 97.0%
- `Bai_2_2.pptx`: 99.0%
- `Bai_2_5.pptx`: 97.0%
- `STTre_Duc.pptx`: 100.0%

Additional verification after fix:

```powershell
npm run test -- server/services/pptx-import/roundtrip-matching.test.js
npm run lint
npm run test
npm run build
```

Results:

- Roundtrip matching test: 1 file, 8 tests passed.
- Lint: passed.
- Full Vitest: 106 files, 935 tests passed.
- Build: passed.

## Merge Status

Ready, but not merged.

## Unresolved Questions

- Merge not performed yet.
