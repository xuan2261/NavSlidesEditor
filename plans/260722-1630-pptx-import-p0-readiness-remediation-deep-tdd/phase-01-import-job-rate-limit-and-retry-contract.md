---
phase: 1
title: "Import Job Rate Limit and Retry Contract"
status: completed
priority: P1
effort: "2 days"
dependencies: []
---

# Phase 1: Import Job Rate Limit and Retry Contract

## Overview

Fix the production quota collision, obey the server busy delay, and make that admission wait abortable. Preserve job IDs, SSE/polling, server cancellation and one-import concurrency behavior.

## Completion Status — 2026-07-22

Implemented and covered by the focused transport contracts. The admission signal ends at job creation; full job-lifecycle cancellation remains explicitly deferred to its P1 boundary.

<!-- Updated: Red Team Review 1 + Validation Session 1 - exact delay grammar and narrow abort ownership -->

## Context Links

- Audit P0: `../reports/2026-07-22-pptx-import-readiness-audit.md:423-433`.
- Existing admission contract: `server/routes/pptx-import.js:312-327` returns `429`, `Retry-After: 60`, `import-in-progress`.
- Current limiter defect: `server/index.js:123-124` mounts upload quota on all `/api/pptx` methods.
- Current uninterruptible client wait: `client/src/utils/api.js:98-116`.
- Current HomePage cleanup owner: `client/src/pages/HomePage.jsx:281`, `client/src/pages/HomePage.jsx:300-305`.

## Requirements

### Functional

- Upload limiter applies only to `POST /api/pptx/import`.
- Job status, SSE and DELETE remain under normal `/api/` quota, never upload quota.
- Valid header grammar is canonical HTTP decimal digits only; value must parse to a positive safe integer number of seconds.
- Valid delay is `min(seconds * 1000, 300_000)`.
- Missing, zero, unsafe, signed, decimal, exponent, hex or whitespace-padded values use configured fallback.
- Fallback is finite milliseconds clamped to `[0, 300_000]`; default remains 5,000 and explicit zero remains immediate.
- `importPptxAsync` accepts optional `signal`; it aborts current admission fetch and retry sleep.
- HomePage aborts admission ownership on unmount. Full SSE/poll/deadline/cancel controller unification remains P1.
- Retry count, callback and non-busy error propagation remain compatible.

### Non-functional

- No queue, scheduler or retry dependency.
- No real 60-second unit wait; use fake timers.
- Production limiter behavior is tested through exported Express app behavior.
- Intentional abort must not trigger a later POST or user-visible failure notice.

## Architecture

### Server middleware order

```text
/api global limiter
  -> POST /api/pptx/import upload limiter
  -> /api/pptx router
       GET status/stream and DELETE cancel bypass upload limiter
```

Minimal server change:

```js
app.post('/api/pptx/import', uploadLimiter)
app.use('/api/pptx', pptxImportRouter)
```

### Client delay contract

`handleResponse()` keeps current numeric `err.retryAfter` for compatibility and adds raw `err.retryAfterRaw`. Delay selection uses only the raw canonical field:

```text
/^[0-9]+$/ AND safe integer > 0
  -> min(seconds * 1000, 300000)
otherwise
  -> clamp(finite busyRetryDelayMs, 0, 300000)
```

A local `sleepWithSignal(ms, signal)` clears its timer/listener and rejects with `AbortError`. The same optional signal is passed to `fetch`. HomePage stores the admission controller in `pptxImportRef` until the server returns a job connection.

## File Inventory

| Action | File | Rough change | Test impact |
| --- | --- | --- | --- |
| Modify | `server/index.js` | XS | POST-only limiter mount |
| Create | `server/index-pptx-rate-limit.test.js` | M, <200 LOC | Production quota behavior |
| Modify | `client/src/utils/api.js` | M | Raw header, exact delay, abortable fetch/sleep |
| Modify | `client/src/utils/api.test.js` | L | Fake-timer grammar/boundary/abort matrix |
| Modify | `client/src/pages/HomePage.jsx` | S | Admission controller lifecycle |
| Create | `client/src/pages/HomePage.pptx-import-lifecycle.test.jsx` | M, <200 LOC | Unmount abort/no delayed POST |
| Verify | `server/routes/pptx-import.test.js` | No behavior change | Existing admission/deadline/cancel contract |
| Verify | `client/src/utils/pptx-job-wait.js` | No P0 refactor | P1 lifecycle boundary |

## Function and Interface Checklist

- [x] `uploadLimiter` mount is method/path-specific.
- [x] `handleResponse()` retains `err.retryAfter` and adds `err.retryAfterRaw`.
- [x] Local delay selector has exact canonical grammar and 300,000 ms ceiling.
- [x] `sleepWithSignal()` removes timer and abort listener on every terminal path.
- [x] `api.importPptxAsync(file, opts)` retains existing options and adds optional `signal`.
- [x] `fetch(..., { signal })` and retry sleep share only the admission signal.
- [x] `onBusyRetry(attempt)` call shape and maximum retry count stay unchanged.
- [x] HomePage cleanup aborts admission signal, then retains existing job cancellation when a job ID exists.

## Dependency Map

```text
server route scope ----------> production quota regression
raw Retry-After -------------> exact delay selector ----------> abortable sleep
HomePage admission owner ----> signal -------------------------> no late POST
Phase 1 -------------------------------------------------------> serialized Phase 3 journey
```

## Tests Before

1. More than 30 unknown job status GETs remain 404, not upload 429.
2. Repeat unknown stream and DELETE routes; they terminate 404 without consuming upload quota.
3. The 31st import POST returns upload 429 while earlier missing-file attempts are 400.
4. `Retry-After: 60` makes no second fetch before 59,999 ms and retries at 60,000 ms.
5. `0`, missing, decimal, exponent, hex, plus/minus, whitespace and unsafe integer values use fallback.
6. Huge valid decimal value clamps at 300,000 ms.
7. Explicit `busyRetryDelayMs: 0` remains immediate.
8. Abort during sleep clears timer and prevents second POST.
9. HomePage unmount aborts admission wait without an error notice.
10. Run current code first; retain expected red evidence.

## Refactor

1. Scope upload middleware to POST import.
2. Preserve raw header in `handleResponse` without breaking numeric metadata.
3. Add exact local delay selector and abortable sleep.
4. Pass optional signal to admission fetch and sleep.
5. Store/abort admission controller through existing HomePage import ref.
6. Do not pass this controller into `waitForPptxJob`; that P1 unification stays deferred.

## Tests After

- Server quota and API quota remain independent.
- Canonical delay behavior is deterministic under fake timers.
- Alternative JavaScript numeric syntax never becomes HTTP delta-seconds.
- Abort leaves one fetch, zero pending timers and no late retry.
- Existing job admission, deadline, stream fallback and cancel tests stay green.

## Test Scenario Matrix

| Priority | Scenario | Expected |
| --- | --- | --- |
| Critical | 31+ job GET/stream/DELETE | No upload-limit 429 |
| Critical | 31st import POST | Upload-limit 429 |
| Critical | Header `60` | Retry at 60,000 ms |
| Critical | Abort at 10 seconds | AbortError; no second POST |
| High | Header absent/`0`/invalid | Configured fallback |
| High | Huge canonical integer | 300,000 ms cap |
| High | Fallback `0` | Immediate compatibility behavior |
| High | Non-busy 429 | Throw immediately |
| Medium | Unmount while busy | Abort admission, no user error |

## Implementation Steps

1. Add server/client/HomePage red tests.
2. Patch middleware scope.
3. Patch raw header and exact delay selection.
4. Add abortable sleep and optional signal.
5. Wire narrow HomePage admission ownership.
6. Run focused suites, then async import E2E serially.

## Todo

- [x] Add production limiter regression.
- [x] Add delay grammar/boundary fake-timer tests.
- [x] Add abort and unmount tests.
- [x] Scope limiter to import POST.
- [x] Honor exact bounded delay.
- [x] Abort admission fetch/sleep without P1 expansion.
- [x] Run focused and async-import gates.

## Success Criteria

- [x] Job read/cancel traffic never consumes upload quota.
- [x] Import POST remains upload-limited.
- [x] Header `60` is honored exactly; max wait is five minutes.
- [x] Existing explicit zero fallback remains compatible.
- [x] Unmount/cancel signal cannot launch a delayed import.
- [x] Full job-lifecycle cancellation remains explicitly deferred.

## Regression Gate

```bash
npx vitest run server/index-pptx-rate-limit.test.js server/routes/pptx-import.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx client/src/utils/pptx-job-wait.test.js
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js
```

## Risk Assessment

- **Production env/cache leakage:** isolate module loading and restore env/limiter state.
- **Global API quota hides result:** keep total below 300.
- **Signal listener leak:** assert cleanup on resolve, reject and abort.
- **Compatibility break at zero delay:** preserve explicit zero by contract.
- **P1 scope creep:** signal ends after admission; no SSE/poll redesign.

## Rollback

Limiter, delay and admission-controller changes are independent and have no storage migration. If UI ownership regresses, retain API abort support and red lifecycle test while reverting only the HomePage wiring.
