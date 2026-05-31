# Reviewer Report - Phase 8 Async Import + SSE

Date: 2026-05-25
Plan: `plans/260524-1729-pptx-import-review`
Phase: `phase-08-async-import-and-sse-progress.md`

## Review Scope

- Async PPTX import job contract: `POST /api/pptx/import -> 202 { jobId }`.
- Job routes: poll, SSE stream, and cancel.
- Job manager concurrency, TTL, SSE client lifecycle, and terminal-state behavior.
- Worker/parser/mapping/media cancellation and progress propagation.
- Client API, HomePage SSE handling, and affected E2E consumers.

## Findings

Reviewer status: `DONE_WITH_CONCERNS`.

1. Concurrency limit was originally enforced after upload parsing, so a rejected second import could still write the upload to disk before returning `429`.
2. Cancel originally marked the job cancelled but did not fully abort parser/mapping/media persistence work.
3. Client SSE error path originally failed the import immediately instead of recovering through job polling.
4. Route-level SSE lifecycle coverage needed to prove progress and terminal events are delivered.

## Fixes Applied

- Reserved the job before `multer`, returning `429` with `Retry-After: 60` before upload disk write when another import is running.
- Propagated `AbortSignal` through parser worker, mapping, and media persistence before writes.
- Added client fallback polling when the SSE connection errors.
- Added route-level SSE lifecycle test coverage.

## Verification

- `npx vitest run server/routes/pptx-import.test.js server/services/pptx-import/mapper/map-presentation.test.js server/services/pptx-import-job-manager.test.js server/services/pptx-import/worker-runner.test.js client/src/utils/api.test.js`
- `npx vitest run server/services/pptx-import server/services/pptx-import-job-manager.test.js server/routes/pptx-import.test.js client/src/utils/api.test.js shared/tests/element-renderers.test.js`
- `npm run build`
- `npx playwright test tests/e2e/pptx-import-async.spec.js --project=chromium`
- `npx playwright test tests/e2e/pptx-import-fidelity.spec.js --project=chromium`
- `npx playwright test tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js --project=chromium`
- `npm run test:corpus` - 4/4 passed, semantic 100.0%, round-trip 99.0%.
- `npm test` - 182 files passed, 1 skipped; 1515 tests passed, 9 skipped.
- `npx vitest run --coverage` - statements 37.26%, branches 32.03%, functions 31.92%, lines 38.75%.

## Remaining Notes

- Manual large-file UI verification remains unchecked because the checked-in `PPTX/` corpus has no file above 5MB; largest is `STTre_Duc.pptx` at about 2.88MB.

**Status:** DONE
**Summary:** Phase 8 review concerns were addressed and verified by targeted, full, corpus, build, coverage, and affected Playwright gates.
**Concerns/Blockers:** Manual >5MB UI verification needs a larger fixture.
