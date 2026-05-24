---
phase: 6
title: "Worker ACK handshake + route rate limit"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 6 — Worker ACK Handshake + Route Rate Limit

Two lightweight infra fixes. (a) Worker silent crash currently waits PARSER_TIMEOUT_MS = 60s before failing (per journal 260425-1637). Add ACK round-trip so importer detects worker-up within ~200ms. (b) `/api/pptx/import` only inherits `apiLimiter` (300 req/15min); add stricter `uploadLimiter` (30 req/15min) since import is heavy (60s timeout, 100MB upload).

## Context Links

- Brainstorm: P1-F, S1
- Source: `server/services/pptx-import/worker-runner.js` (135 LOC), `server/index.js:75-82,108`
- Pattern: `uploadLimiter` already defined at `server/index.js:77-82`, applied at line 82 to `/api/upload`

## Overview

- Priority: P1
- Brief: Worker forks with no ACK. `child.send({filePath})` fires at `worker-runner.js:126` without confirming worker booted. ACK pattern: worker emits `{type:'ready'}` immediately after `process.on('message')` wiring; parent waits ~500ms for it before sending work; on timeout, kill child and report.

## Key Insights

- `worker-runner.js:50-52` already has `isParserWorkerResult` type guard — add sibling `isProgressMessage` (Phase 8 also needs this) and `isReadyMessage`.
- `parse-worker.js:83` LOC — small. Ready emission must happen **AFTER** `process.on('message')` is registered (at `parse-worker.js:59`); emitting at top-of-file races with parent sending `{filePath}` before the handler binds.
- Rate-limit fix is a single line: `app.use('/api/pptx', uploadLimiter)` BEFORE line 108.
- `apiLimiter` and `uploadLimiter` already configured; reuse exactly.
- **Red-team verified:** `server/index.js:77-82` `uploadLimiter` definition has ONLY `max` and `windowMs` — no `skip: () => process.env.NODE_ENV === 'test'`. Tests calling `/api/pptx/import` repeatedly WILL hit 429. Either add `skip` to the limiter or scope the new limit to a sub-router that tests can bypass.
- **Red-team verified:** `waitForAck` inside `new Promise((resolve, reject) => ...)` body must catch and route to `reject()`. A naked `await waitForAck()` that throws escapes as unhandled rejection.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import/worker-runner.js` | Modify | +30/-5 |
| `server/services/pptx-import/parse-worker.js` | Modify | +5 |
| `server/services/pptx-import/worker-runner.test.js` | Modify | +60 |
| `server/index.js` | Modify | +1 |
| `server/routes/pptx-import.test.js` | Modify | +20 (rate-limit test) |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `worker-runner.test.js` (101 LOC) | Yes | Add ACK tests |
| `pptx-import.test.js` (route-level) | Yes | Add rate-limit test (429 after 30 in 15min) |
| `pptx-import-e2e-flow.test.js` (217 LOC) | Verify still green | |

New tests: +4-5 cases.

## Function/Interface Checklist

### Worker ACK
- `parse-worker.js`: emit ready **AFTER** the `process.on('message', ...)` registration (currently at line 59), not at top-of-file. Pinned ordering:
  ```js
  // line ~59
  process.on('message', async (msg) => { /* existing handler */ })
  process.send({ type: 'ready' })  // only after handler is bound
  ```
- `worker-runner.js`:
  - Add `isReadyMessage(msg)` near `isParserWorkerResult` (line ~50-52).
  - In `runParserWorker`, after `child = fork(...)` (line 60), wait for ready message with timeout BEFORE `child.send({filePath})` (line 126). **Promise body must guard the await:**
    ```js
    const ACK_TIMEOUT_MS = Number(process.env.PPTX_WORKER_ACK_MS ?? 1000)
    try {
      await waitForAck(child, ACK_TIMEOUT_MS)
    } catch (e) {
      killChild(child)
      reject({ ok: false, error: { type: 'worker-startup-failed', cause: e?.message } })
      return
    }
    child.send({ filePath })
    ```
  - New helper `waitForAck(child, ms)` — returns Promise; resolves on `isReadyMessage`, rejects after `ms`. Internal helper, not called from Promise body without try/catch.

### Rate Limit
- `server/index.js` before line 108:
  ```js
  app.use('/api/pptx', uploadLimiter)
  ```
- Update `uploadLimiter` definition at `server/index.js:77-82` to add test-env skip (the existing definition has NO skip — verified by red-team):
  ```js
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    skip: () => process.env.NODE_ENV === 'test'  // NEW
  })
  ```

### Worker Progress (preparation for Phase 8)
- `worker-runner.js`: also add `isProgressMessage(msg)` here so Phase 8 picks it up. Listener forwards via `options.onProgress?.(message)` when message matches; otherwise current behavior.

## Dependency Map

- Blocks: Phase 7 (split happens after infra fixes), Phase 8 (SSE needs worker progress forwarding)
- Blocked by: Phase 1

## Tests Before (Characterization Gate)

- [ ] Confirm `npm test` green
- [ ] `npx vitest run server/services/pptx-import/worker-runner.test.js` — green
- [ ] Verify `uploadLimiter` exists at `server/index.js:77-82` — read source

## Refactor / Implement

- [ ] In `parse-worker.js`, add `process.send({type:'ready'})` **AFTER** the `process.on('message', ...)` registration at line 59 — NOT at top-of-file (handler-before-emit ordering invariant).
- [ ] In `worker-runner.js`:
  1. Add `isReadyMessage` and `isProgressMessage` type guards near line 50.
  2. Add `waitForAck(child, timeoutMs)` helper that listens once for `isReadyMessage`.
  3. Wrap fork+send in Promise body with explicit try/catch around `await waitForAck` → `kill + reject`. Do NOT let the await throw to the unhandled-rejection path.
  4. Inside `child.on('message')` handler (line ~96), filter progress messages: if `isProgressMessage`, call `options.onProgress?.(msg)` and `return` early.
- [ ] In `server/index.js`:
  1. Add `skip: () => process.env.NODE_ENV === 'test'` to existing `uploadLimiter` at lines 77-82 (the limiter has NO skip clause today — verified).
  2. Add `app.use('/api/pptx', uploadLimiter)` before line 108.

## Tests After (New Unit Tests)

- [ ] `worker-runner.test.js`:
  - `it('waits for ready message before sending filePath')`
  - `it('kills child and rejects when ready not received within 500ms')`
  - `it('forwards progress messages to options.onProgress')`
  - `it('still emits result message after ready+progress sequence')`
- [ ] `pptx-import.test.js`:
  - `it('returns 429 after 31 requests in 15 minutes')` (or test stub uploadLimiter at low threshold)

## Regression Gate

- [ ] `npm test` — full suite green
- [ ] `npm test -- --coverage` — thresholds preserved
- [ ] LOC budget: `worker-runner.js` <= 180 LOC (currently 135; +30 -> ~165)
- [ ] LOC budget: `parse-worker.js` <= 180 LOC (currently 83; +5 -> 88)
- [ ] `npm run test:corpus` — no perf regression (ACK adds ~50ms once per import)

## Success Criteria

- Worker startup failure detected in < 1s instead of 60s.
- `/api/pptx/import` returns 429 when uploadLimiter exceeded.
- Existing import flow unchanged on happy path.

## Risk Assessment

- Risk: ACK timeout (1000ms) too tight on slow systems / Electron startup. Mitigation: env override `PPTX_WORKER_ACK_MS` already wired.
- Risk: progress message forwarding before `options.onProgress` is wired (Phase 8) — they're ignored silently, which is fine (existing behavior).
- Risk: rate limit hits in dev/test. Mitigation: `skip: () => process.env.NODE_ENV === 'test'` added to limiter definition (verified missing today — Phase 6 adds it).
- Risk: emit-before-handler race on slow Node startup. Mitigation: pinned ordering — `process.on('message')` MUST register before `process.send({type:'ready'})`.

## Rollback Plan

- Revert `worker-runner.js`, `parse-worker.js`, `server/index.js` one-liner. Tests revert with them.

## Unresolved Questions

1. ACK timeout value: 500ms vs 1000ms vs 2000ms. Recommend 1000ms with env override.
2. Should `worker-startup-failed` retry once before giving up? KISS: no retry; surface error to client.
3. Rate limit in dev/Electron: should we exempt localhost or trust the limiter's existing skip rules? Verify `uploadLimiter` skip-in-test config.
