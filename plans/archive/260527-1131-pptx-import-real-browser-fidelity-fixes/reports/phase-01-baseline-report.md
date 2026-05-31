# Phase 01 Baseline Report

Generated: 2026-05-27

## Scope

- Harness: `tests/e2e/pptx-import-real-browser-audit.spec.js`
- Helper: `tests/e2e/pages/pptx-import-audit-helper.js`
- Corpus: `PPTX/*.pptx`
- Viewport: `1600x1000`
- Artifact policy: raw JSON/Markdown/screenshots stay in ignored local run folders under `plans/reports/pptx-import-real-browser-audit-runs/`.

## Baseline Summary

Latest verified run: `2026-05-27T07-01-57-009Z-11828`

| Metric | Count |
| --- | ---: |
| Decks | 5 |
| Slides | 227 |
| Failed slides | 222 |
| Text overflow | 655 |
| Image clipping | 28 |
| Raw out-of-canvas | 141 |
| Accepted bleed candidates | 71 |
| Accepted bleed | 0 |
| Unexpected out-of-canvas | 70 |
| Zero-sized | 0 |
| Console errors | 16 |
| Import errors | 0 |
| Strict failures | 840 |

## Gate Evidence

- Non-strict headless command passed: `npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0 --reporter=line`
- Strict headless command failed as RED baseline: `PPTX_IMPORT_AUDIT_STRICT=1 npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0 --reporter=line`
- Strict failure: expected `strictFailures=0`, received `840`.
- Non-strict headed command passed with the same summary: `npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0 --reporter=line --headed`

## Classifier Notes

- Out-of-canvas raw counts remain immutable in the run JSON.
- Decorative strip detection is candidate-only: candidates still fail strict mode until backed by source geometry evidence or explicit allowlist.
- Text and image elements outside the canvas are always unexpected.
- Diagnostics avoid raw slide text in Markdown; screenshots stay out of git.

## Unresolved Questions

- None for Phase 01.
