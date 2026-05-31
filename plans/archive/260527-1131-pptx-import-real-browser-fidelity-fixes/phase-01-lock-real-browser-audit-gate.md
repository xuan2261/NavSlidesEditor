# Phase 01 Lock Real Browser Audit Gate

## Context Links

- Report: [Real Browser Audit](../reports/pptx-import-real-browser-audit.md)
- JSON: [Real Browser Audit JSON](../reports/pptx-import-real-browser-audit.json)
- Harness: [pptx-import-real-browser-audit.spec.js](../../tests/e2e/pptx-import-real-browser-audit.spec.js)
- Baseline: [Phase 01 Baseline Report](./reports/phase-01-baseline-report.md)
- Existing async UI import: [pptx-import-async.spec.js](../../tests/e2e/pptx-import-async.spec.js)

## Overview

Priority: P0. Status: complete. Convert current one-off browser audit into a stable regression gate with clear categories: real failures, accepted intentional bleed, and diagnostics. No product fix yet.

## Key Insights

- Current audit can import all 5 decks and visit all 227 slides in headed Chromium.
- Current raw status fails 222 slides, but many `outOfCanvas` hits are decorative full-width/overscan lines from `Bai3_HinhChieuVuongGoc.pptx`.
- Need avoid false positives before fixing layout. Otherwise implementation may "fix" intentional design.

<!-- Updated: Validation Session 1 - Confirmed bleed classification requires source geometry evidence or explicit allowlist, and audit artifacts must redact text diagnostics with trusted/failure-only screenshot retention. -->

## Requirements

- Functional: audit must import via UI, open editor, visit every slide, screenshot every slide.
- Functional: report must include per deck and per slide counts for text, image, out-of-canvas, zero-sized, console.
- Functional: immutable raw baseline must be captured before any classifier changes: corpus hashes, Playwright/Chromium version, viewport, raw JSON, and timestamped artifact directory.
- Functional: classify out-of-canvas into `unexpected` vs `acceptedBleedCandidate`, but candidates do not pass strict mode until backed by source geometry or an explicit allowlist entry.
- Non-functional: no `waitForTimeout`; use state-based waits.
- Non-functional: deterministic output under timestamped `plans/reports/` run directories with an atomic latest pointer; never delete another active run.

## Architecture

```text
Playwright UI import
  -> editor canvas traversal
  -> DOM measurement per element
  -> issue classifier
  -> JSON + Markdown + screenshots
  -> strict assertions controlled by env flag
```

## Related Code Files

- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pptx-import-real-browser-audit.spec.js`
- Create: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-helper.js`
- Create: `C:/Work/NavSlidesEditor/tests/e2e/pptx-import-real-browser-audit.spec.js` only if harness is not kept; prefer updating existing file.
- Create: `C:/Work/NavSlidesEditor/plans/260527-1131-pptx-import-real-browser-fidelity-fixes/reports/phase-01-baseline-report.md`

## Implementation Steps

1. RED: add strict expectation mode `PPTX_IMPORT_AUDIT_STRICT=1` expecting current baseline to fail when any strict category is non-zero. Store exact counts as evidence only, not brittle assertions.
2. Capture immutable raw baseline before classifier work:
   - SHA-256 for every PPTX corpus file
   - Playwright/Chromium version and OS
   - fixed viewport/canvas scale
   - raw JSON and screenshots under a timestamped run directory
   - no classifier-normalized counts replacing raw counts
3. Extract audit helpers: import deck, select slide, measure canvas, classify issues.
4. Add `acceptedBleedCandidate` classifier as candidate-only:
   - shape/line only
   - near-horizontal/vertical decorative strips
   - source PPTX geometry also extends beyond slide bounds, or explicit allowlist `{deck, slide, elementId, reason, screenshot}`
   - no text/image accepted as bleed
   - no hyperlink/action/pointer-events/user interaction
5. Report raw, candidate, accepted, and strict counts separately.
6. Add machine-readable `summary` block to JSON.
7. Keep screenshots in timestamped run folders; cleanup only by explicit retention policy after final report links the run.
8. Run headed and headless once to prove consistency.

## Tests

- RED test: strict audit fails on current baseline before fixes.
- Unit-style helper test: classifier marks thin full-width shape as bleed candidate, text outside canvas as unexpected.
- E2E: headed Chromium imports all decks and writes 227 screenshots.
- Verification:
  ```bash
  npx eslint tests/e2e/pptx-import-real-browser-audit.spec.js tests/e2e/pages/pptx-import-audit-helper.js
  npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0 --reporter=line
  ```

## Todo List

- [x] Split helper from spec if file grows over 200 LOC.
- [x] Add strict/non-strict mode.
- [x] Add accepted bleed classifier.
- [x] Regenerate baseline report.
- [x] Commit no product logic changes in this phase.

## Completion Evidence

- Targeted unit test passed: `npx vitest run tests/unit/pptx-import-audit-helper.test.js`.
- Targeted lint passed: `npx eslint tests/e2e/pptx-import-real-browser-audit.spec.js tests/e2e/pages/pptx-import-audit-helper.js tests/unit/pptx-import-audit-helper.test.js`.
- Non-strict headless Playwright audit passed for 5 decks and 227 slides.
- Strict headless Playwright audit failed as expected with `strictFailures=840`, proving the RED gate.
- Non-strict headed Playwright audit passed and matched the headless summary.

## Success Criteria

- Baseline report records totals similar to current evidence: 227 slides, 655 text, 28 image, 141 raw out-of-canvas, 16 console errors. Exact totals are evidence, not test pass criteria.
- Strict mode fails before product fixes.
- Non-strict mode completes and writes reports/screenshots.
- No strict pass depends on heuristic-only bleed classification.

## Risk Assessment

- Risk: accepted bleed classifier hides real defects. Mitigation: classifier applies only to non-text/non-image decorative shapes and reports raw counts.
- Risk: classifier normalizes away baseline evidence. Mitigation: raw immutable baseline remains unchanged and candidate classification is a separate layer.
- Risk: headed test slow. Mitigation: keep single worker and 15 minute timeout per large deck.

## Security Considerations

- Treat imported PPTX as untrusted, even when using local corpus. Add hostile fixtures or checks for zip/archive limits, normalized internal paths, blocked external relationships, allowed relationship schemes, XML parser safety, parser error sanitization, and max media/XML sizes.
- Screenshots and text diagnostics may contain slide content. Default to redacted text diagnostics, keep artifacts in ignored local/CI paths, and upload screenshots only for trusted branches/manual workflows with short retention.
- Validation confirmed screenshots must not be committed to the repo; CI uploads should be failure-only, trusted-context only, and short-retention.

## Next Steps

Proceed to Phase 02 text root-cause tracing after the gate is stable.
