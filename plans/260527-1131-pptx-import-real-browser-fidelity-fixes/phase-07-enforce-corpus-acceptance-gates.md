# Phase 07 Enforce Corpus Acceptance Gates

## Context Links

- Corpus CLI: [pptx-import-corpus-cli.js](../../server/services/pptx-import/pptx-import-corpus-cli.js)
- Semantic tester: [pptx-import-semantic-and-roundtrip-fidelity-tester.js](../../server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js)
- Acceptance criteria: [acceptance-criteria.js](../../server/services/pptx-import/acceptance-criteria.js)
- Playwright audit: [pptx-import-real-browser-audit.spec.js](../../tests/e2e/pptx-import-real-browser-audit.spec.js)

## Overview

Priority: P0. Status: complete. Promote real-browser visual/layout gates into repeatable acceptance criteria so the same failures cannot return.

## Key Insights

- Existing `npm run test:corpus` validates semantic/roundtrip data, but missed real DOM overflow.
- Added a strict smoke browser audit for PR/runtime-sensitive verification and a full strict browser audit for release signoff.
- Audit artifacts are sanitized and ignored by git; screenshots stay in local run dirs.

<!-- Updated: Validation Session 1 - Confirmed policy: PR gate runs deterministic strict smoke subset; release signoff requires full 5-deck strict audit. -->

## Requirements

- Functional: strict layout audit must fail on text overflow, unexpected image clipping, unexpected out-of-canvas, zero-sized elements, console errors.
- Functional: preserve current semantic thresholds.
- Functional: PR/release blocking gate is defined in this phase, not deferred.
- Non-functional: CI runtime controlled; full screenshots can be optional artifact.

## Architecture

```text
npm run test:corpus
  -> semantic + roundtrip
npx playwright ... real browser audit
  -> DOM layout strict gate
optional CI job
  -> headless strict audit with artifacts on failure
```

## Related Code Files

- Modify: `C:/Work/NavSlidesEditor/package.json`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pptx-import-real-browser-audit.spec.js`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-report-helper.js`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-helper.js`
- Modify: `C:/Work/NavSlidesEditor/tests/unit/pptx-import-audit-helper.test.js`
- Create: `C:/Work/NavSlidesEditor/scripts/run-pptx-browser-audit.js`

## Implementation Steps

1. RED: strict layout gate fails on known bad fixture before fixes.
2. Add script aliases:
   - `test:pptx:browser-audit`
   - `test:pptx:browser-audit:headed`
   - `test:pptx:strict` combining corpus + browser audit if runtime acceptable.
3. Add summary JSON schema validation.
4. Add acceptance criteria for:
   - no raw units
   - finite fields
   - browser layout strict counts
5. Define blocking policy:
   - PR gate: deterministic strict smoke subset covering text overflow, image clipping, shape/out-of-canvas, and SVG console errors.
   - release gate: full 5-deck strict audit must pass before shipping this P0 fix.
   - full 5-deck CI can be nightly/manual if runtime is too high, but final Phase 08 signoff must include owner, command, artifact run id, and pass/fail result.
6. Add failure artifact paths to report without exposing slide contents by default.
7. Enforce artifact policy from validation: sanitized JSON/Markdown by default, screenshots uploaded only on trusted failure/manual contexts with short retention.

## Tests

- Unit:
  - summary JSON parser validates required counts.
  - acceptance criteria rejects non-zero strict counts.
- E2E:
  - full headless audit strict passes after Phases 03-06.
  - headed command used for manual verification.
- Commands:
  ```bash
  npm run test:corpus
  npm run test:pptx:browser-audit
  npm run test:pptx:browser-audit:headed
  npm run test
  npm run build
  ```

## Todo List

- [x] Add package scripts.
- [x] Add strict summary validation.
- [x] Add CI/manual mode decision.
- [x] Verify full audit passes.

## Gate Policy

- PR/runtime-sensitive gate: `npm run test:pptx:browser-audit` runs strict smoke scope on deterministic decks.
- Release-blocking gate: `npm run test:pptx:browser-audit:full` runs full 5-deck strict real-browser audit.
- Full combined release check: `npm run test:pptx:strict` runs semantic corpus plus full browser audit.
- Manual visual/debug gate: `npm run test:pptx:browser-audit:headed`.
- Screenshots and reports remain under ignored `plans/reports/pptx-import-real-browser-audit-runs/`.

## Progress Evidence

- `npx vitest run tests/unit/pptx-import-audit-helper.test.js` passed: 10 tests.
- `npm run test:pptx:browser-audit` passed: 3 Playwright tests, strict smoke scope.
- `npm run test:corpus` passed: 11 files, 11 passed, 0 failed.
- `npm run test:pptx:browser-audit:full` passed: 6 Playwright tests, strict full scope.
- Full strict audit artifact: `plans/reports/pptx-import-real-browser-audit-runs/2026-05-27T09-25-02-029Z-19104/pptx-import-real-browser-audit.json`.

## Success Criteria

- Strict browser audit passes with all target counts at 0: met.
- Existing corpus strict gate still passes: met.
- Developer has one documented command for real browser PPTX verification: met via package scripts.
- Regression protection is explicit: PR-blocking smoke gate plus release-blocking full audit: met.

## Risk Assessment

- Risk: CI runtime grows. Mitigation: split full audit into manual/nightly while keeping smoke strict in PR.
- Risk: flaky browser measurements. Mitigation: use stable viewport, deterministic canvas scale, state-based waits.

## Security Considerations

- CI artifacts may contain slide content. Use failure-only upload, trusted branches/manual workflows for screenshots, short retention, sanitized JSON/Markdown, no screenshots on fork PRs, and paths covered by `.gitignore`.

## Next Steps

Finalize docs and release evidence in Phase 08.
