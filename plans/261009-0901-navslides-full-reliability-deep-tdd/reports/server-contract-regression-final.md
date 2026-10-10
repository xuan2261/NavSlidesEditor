# Server contract regression repair — final receipt

## Scope and root causes

Recorded RED: `artifact://537` contains the assigned history restore 422s, duplicate compensation 422/missed injection, duplicate-race timeouts/unhandled serialization error, and production/share/trash readiness 503s. It is failure evidence, not a fresh final-suite result.

- **Readiness fixtures:** importing `server/index.js` does not run startup recovery. Owned mounted-app fixtures now await `startServer(0, { host: '127.0.0.1' })` and use `stopServer` during cleanup. The fail-closed mutation readiness barrier remains unchanged.
- **Native authority fixtures:** fake `commitOriginal` buffers lacked authoritative projections. History and duplicate fixtures now generate real ZIP packages and publish via `commitImport` plus `buildImportSourceMap`; no synthetic package IDs/head hashes or authority mocks remain in these fixtures.
- **History publication:** stale compatibility fixture rewrites discarded the aggregate head. They now preserve the exact head while changing compatibility content, exercising canonical authority precedence. The fixture uses the same initialized native CJS runtime singleton as its HTTP routes; the previous independent/test-only store path could poison compatibility replay because `getPackageStore()` had no active singleton. Initialization, import replay, shutdown, and owned-root deletion follow the actual lifecycle.
- **Serialization concurrency:** an accepted same-source save legitimately invalidates a duplicate's source fingerprint. The retained concurrency regression now completes an unrelated HTTP save while package duplication is explicitly gated, then releases the gate and observes successful duplication. Internal lock-depth/read-call spies were removed; no timeout was increased.
- **Actual consumer defect:** after duplicate publication, response serialization errors now reach Express through `next(err)` without rollback. This preserves the committed winner and original error instead of attempting a second route-level JSON response that could escape the Express 4 async handler.

Every unexpected focused failure received a read-only counsel GO before repair. Intermediate receipts: `artifact://546` (fixture head loss/same-source race), `artifact://554` (uninitialized publication runtime), `artifact://556` (ESM/CJS split singleton). A subsequent mechanical hoisted-loader TDZ was repaired by naming the native loader `nodeRequire`.

## Edited paths

- `server/routes/history-package-integrity.test.js`
- `server/routes/presentations-duplicate-compensation.test.js`
- `server/routes/presentations-duplicate-race.test.js`
- `server/routes/share-no-password-bcrypt.test.js`
- `server/routes/soft-delete-share-guard.test.js`
- `server/index-pptx-rate-limit.test.js`
- `server/routes/pptx-import.test.js` — production limiter case only
- `server/routes/presentations-crud.js` — duplicate post-publication error propagation only

## Final verification

1. `npx vitest run --project=node-serial server/routes/history-package-integrity.test.js server/routes/presentations-duplicate-compensation.test.js server/routes/presentations-duplicate-race.test.js server/routes/share-no-password-bcrypt.test.js server/routes/soft-delete-share-guard.test.js server/index-pptx-rate-limit.test.js --maxWorkers=1 --no-file-parallelism`
   - **Exit 0; 6 files, 18/18 tests passed.** Final duration 23.00 seconds. No reported unhandled error.
2. `npx vitest run --project=node-serial server/routes/pptx-import.test.js -t "applies the upload limiter" --maxWorkers=1 --no-file-parallelism`
   - **Exit 0; 1/1 selected test passed; 19 cases unselected.** Final duration 3.38 seconds. This case uses the already-instantiated, harness-owned storage roots rather than allocating a misleading unused root after CJS storage evaluation.
3. `node server/server-contract-regression-smoke.cjs`
   - **Exit 0; one fresh-process actual production-server scenario passed.** Startup readiness returned 200. A consumer serializer threw once after native duplicate publication; HTTP returned 500 with the original message. The duplicate remained readable through the real API, and its original package bytes survived server shutdown/startup and another API read.
   - Owned temporary root was removed. Temporary smoke script was deleted after proof; no permanent smoke scaffold remains.

## Boundaries

No remaining observed failures in this owned slice. No full suite, build, or lint was run by this worker. The final global suite and source-frozen native publication/recovery/portable acceptance runtimes remain Main's verification responsibility. No commits, pushes, releases, or plan-status changes were made.
