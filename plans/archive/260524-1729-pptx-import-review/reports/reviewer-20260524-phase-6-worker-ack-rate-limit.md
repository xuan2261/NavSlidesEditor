# Phase 6 Code Review — Worker ACK + Rate Limit

## Scope

- `server/services/pptx-import/worker-runner.js`
- `server/services/pptx-import/worker-ipc.js`
- `server/services/pptx-import/parse-worker.js`
- `server/services/pptx-import/worker-runner.test.js`
- `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- `server/index.js`
- `server/routes/pptx-import.test.js`

## Result

Reviewer status: `DONE_WITH_CONCERNS`.

Concerns found:

- `onProgress` callback exceptions could escape the IPC event handler.
- `PPTX_WORKER_ACK_MS` accepted invalid, negative, or non-finite values.

Follow-up fixes:

- Wrapped `onProgress` callback failures and return controlled `import-failed` results.
- Added `getWorkerAckTimeoutMs` positive-number validation with default fallback.
- Added regression tests for throwing progress callbacks and invalid ACK timeout env values.
- Extracted worker IPC helpers to `worker-ipc.js` so `worker-runner.js` stays under hard LOC limit.

## Verification After Fixes

- `npx vitest run server/services/pptx-import/worker-runner.test.js server/routes/pptx-import.test.js` — 15 passed.
- `npx vitest run server/services/pptx-import server/routes/pptx-import.test.js shared/tests/element-renderers.test.js` — 253 passed, 1 skipped.
- `npm run test:corpus` — 4/4 passed; semantic 100.0%; round-trip 99.0%.
- `npm run build` — passed.
- `npm test` — 171 files passed, 1 skipped; 1477 passed, 9 skipped.

## Unresolved Questions

None.
