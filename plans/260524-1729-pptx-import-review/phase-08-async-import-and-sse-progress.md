---
phase: 8
title: "Async import + SSE progress"
status: pending
priority: P1
effort: "4d"
dependencies: [6]
---

# Phase 8 — Async Import + SSE Progress

45s blocking sync request unacceptable for 1MB file; 100MB unusable. Replace POST /api/pptx/import with `202 Accepted + {jobId}`. Client polls SSE `/api/pptx/jobs/:jobId/stream` for live progress. In-memory job map + TTL cleanup pattern reused from `game-room-manager-singleton-service.js`. Breaking change to client; sync route removed.

## Context Links

- Brainstorm: P1-E
- Research: `plans/260524-1729-pptx-import-review/research/researcher-260524-async-progress.md` (use verbatim API designs)
- Pattern to reuse: `server/services/game-room-manager-singleton-service.js:6-111` (Map + TTL cleanup)
- Worker progress prerequisite: Phase 6 (added `isProgressMessage` guard + `options.onProgress` callback)

## Overview

- Priority: P1
- Brief: Three changes. (a) New `pptx-import-job-manager.js` service — Map<jobId, JobRecord> + TTL. (b) POST `/api/pptx/import` returns 202 + jobId. New routes: GET `/api/pptx/jobs/:jobId`, GET `/api/pptx/jobs/:jobId/stream` (SSE), DELETE `/api/pptx/jobs/:jobId`. (c) Client: `importPptxAsync`, `pollPptxJob`, `cancelPptxJob`; replace `handleImportPptx` static states with EventSource listener.

## Key Insights (from research + red-team)

- Single-user app: no need for Redis/Bull. In-memory job map sufficient.
- Existing `game-room-manager-singleton-service.js` is the exact pattern (Map + TTL + cleanup timer).
- Worker progress hooks already added in Phase 6 (`isProgressMessage`, `options.onProgress`).
- SSE is zero-dependency; one-direction; trivially proxied by Vite.
- Max concurrent running jobs: 1 (return 429 + `Retry-After: 60` if another running — validation-confirmed for v1).
- Job TTL after completion: 10 minutes.
- **Red-team verified:** `req.file.path` cleanup must live INSIDE the background promise's `finally`, not the handler's `finally`. Handler returns 202 immediately; if cleanup runs in handler `finally`, the file is deleted BEFORE the background worker reads it.
- **Red-team verified:** breaking-change disclosure missed 3 additional consumers — `client/src/utils/api.test.js:4,19`, `tests/e2e/pptx-import-fidelity.spec.js:22`, `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js:15,47,56`. All require update in the same commit.
- **Red-team verified:** SSE TTL leak — if `scheduleCleanup` runs while clients are still attached (e.g. user keeps viewer tab open after completion), the response sockets are dropped mid-stream. `attachSseClient` must cancel any pending `cleanupTimer`; `detachSseClient` re-schedules only if no clients remain. Pattern mirrors but improves on `game-room-manager-singleton-service.js:128-134` (which does NOT currently cancel timer on participant leave).
- **Red-team verified:** `vite.config.js:14-21` has no SSE proxy config. Must verify `proxy.{ws|configure}` allows `text/event-stream` streaming in dev before relying on SSE for the demo.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import-job-manager.js` | Create | +130 |
| `server/services/pptx-import-job-manager.test.js` | Create | +180 |
| `server/routes/pptx-import.js` | Modify (rewrite handler; cleanup INSIDE background promise) | +60/-25 |
| `server/routes/pptx-import.test.js` | Modify | +80 |
| `server/index.js` | Modify (add `:jobId` param validator) | +5 |
| `server/services/pptx-import/parse-worker.js` | Modify (emit progress events) | +15 |
| `server/services/pptx-import/importer.js` | Modify (accept `options.onProgress`) | +20 |
| `client/src/utils/api.js` | Modify | +25 |
| `client/src/utils/api.test.js` | Modify (lines 4, 19 — update importPptx → importPptxAsync) | +10/-5 |
| `client/src/pages/HomePage.jsx` (lines 565-592) | Modify | +35/-15 |
| `client/vite.config.js` | Verify proxy supports SSE streaming (line 14-21) | +3 (configure block) |
| `tests/e2e/pptx-import-async.spec.js` | Create | +120 |
| `tests/e2e/pptx-import-fidelity.spec.js` | Modify (line 22 — switch to async) | +15/-5 |
| `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js` | Modify (lines 15, 47, 56 — switch to async polling) | +20/-10 |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `pptx-import.test.js` | Yes (rewrite — 202 contract) | Breaking change |
| `pptx-import-e2e-flow.test.js` (217 LOC) | Yes — update to async flow | Breaking change |
| `worker-runner.test.js` | Verify still green (Phase 6 added progress forwarding) | |
| New: `pptx-import-job-manager.test.js` | Create | Job lifecycle, TTL, cancellation, SSE client list |
| New: `tests/e2e/pptx-import-async.spec.js` (Playwright) | Create | UI shows progress; cancel works; large file completes |

New tests: +2 files, +30 cases.

## Function/Interface Checklist

### `pptx-import-job-manager.js`

```js
const jobs = new Map()
const JOB_TTL_MS = 10 * 60 * 1000
const MAX_CONCURRENT_RUNNING = 1
const uuidv4 = () => require('node:crypto').randomUUID()

function createJob() // returns jobId, throws if running count >= MAX
function getJob(jobId)
function attachSseClient(jobId, res)   // MUST clear pending cleanupTimer
function detachSseClient(jobId, res)   // MUST re-schedule cleanup only when no clients remain
function emitProgress(jobId, payload)
function completeJob(jobId, result)
function failJob(jobId, error)
function cancelJob(jobId) // returns 'ok' | 'unknown' | 'conflict'
function scheduleCleanup(jobId)        // MUST be idempotent — clearTimeout(existing) before setTimeout

module.exports = { createJob, getJob, attachSseClient, detachSseClient, emitProgress, completeJob, failJob, cancelJob }
```

**SSE TTL leak guard (red-team verified):**
- `attachSseClient`: if a `cleanupTimer` is pending on this job, `clearTimeout(job.cleanupTimer); job.cleanupTimer = null`.
- `detachSseClient`: after removing the client, if `job.sseClients.size === 0 && job.terminalState`, call `scheduleCleanup(jobId)`. Otherwise leave timer null.
- `scheduleCleanup`: if `job.cleanupTimer` already set, `clearTimeout` first; then `setTimeout(() => jobs.delete(jobId), JOB_TTL_MS)`.

### Route shapes (verbatim from research)

- POST `/api/pptx/import`: returns `202 { jobId }`. Spawns `importPptxFile(filePath, { onProgress: (p) => emitProgress(jobId, p) })` in a **separate async function** (NOT in handler body). File deletion lives in that function's `finally`, **NOT** in the handler's `finally` (red-team verified — handler returns 202 immediately; handler-finally would delete the file before the background read). **On concurrency-limit conflict:** returns `429 { error: 'import-in-progress' }` with `Retry-After: 60` response header (validation-confirmed for v1).
- GET `/api/pptx/jobs/:jobId`: returns `200 { jobId, status, stage, percent, message, result?, error? }` or `404`.
- GET `/api/pptx/jobs/:jobId/stream` (SSE): sets `Content-Type: text/event-stream`. Sends `event: progress` / `done` / `failed` / `cancelled`. On `req.on('close')` detaches client.
- DELETE `/api/pptx/jobs/:jobId`: returns `204` or `404` or `409` (already done).

### `:jobId` param validator (`server/index.js:50-58`)

Add alongside existing `app.param('id', ...)`:
```js
app.param('jobId', (req, res, next, jobId) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return res.status(400).json({ error: 'Invalid jobId' })
  }
  next()
})
```

### Client `client/src/utils/api.js:41-45`

```js
importPptxAsync: (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch(`${BASE}/pptx/import`, { method: 'POST', body: fd }).then(handleResponse)
},
pollPptxJob: (jobId) => fetch(`${BASE}/pptx/jobs/${jobId}`).then(handleResponse),
cancelPptxJob: (jobId) => fetch(`${BASE}/pptx/jobs/${jobId}`, { method: 'DELETE' }).then(handleResponse),
```

Old `importPptx` removed.

### Client `HomePage.jsx:565-592` — replace 3 static states

```js
async function handleImportPptx(file) {
  setImportProgress('Uploading PPTX...')
  const { jobId } = await api.importPptxAsync(file)
  await new Promise((resolve, reject) => {
    const es = new EventSource(`/api/pptx/jobs/${jobId}/stream`)
    es.addEventListener('progress', e => setImportProgress(JSON.parse(e.data).message))
    es.addEventListener('done', async e => {
      es.close()
      const { result } = JSON.parse(e.data)
      setImportProgress('Creating presentation...')
      const pres = await api.createPresentation(result.presentation)
      onOpen(pres.id)
      resolve()
    })
    es.addEventListener('failed', e => { es.close(); reject(new Error(JSON.parse(e.data).error)) })
    es.onerror = () => { es.close(); reject(new Error('Connection lost')) }
  })
}
```

Status text UI at HomePage.jsx:875-882 unchanged (still renders `importProgress` string).

### Worker / mapper progress hooks

- `parse-worker.js`: emit `process.send({type:'progress', stage:'parsing', percent: 5, message:'Reading PPTX archive'})` then `percent: 80` after parse; setInterval heartbeat at 2s for mid-parse animation.
- `importer.js`: pass `options.onProgress` to `mapPptxOutput`. In `mapPptxOutput` loop: emit `{stage:'mapping', percent: (i/total)*100, message: 'Processing slide N of M'}` per slide.

## Dependency Map

- Blocks: Phase 9 (acceptance gate)
- Blocked by: Phase 6 (worker progress IPC), Phase 7 (mapper split keeps `onProgress` plumbing intact across files)

## Tests Before (Characterization Gate)

- [ ] Confirm `npm test` green
- [ ] Confirm `pptx-import-e2e-flow.test.js` (217 LOC) green on current sync behavior
- [ ] Document current contract: `POST /api/pptx/import -> 200 { presentation, stats, warnings }`
- [ ] **Verify Vite SSE proxy:** read `client/vite.config.js:14-21`. If proxy lacks `configure` block, manually test SSE in dev: `curl -N http://localhost:5173/api/pptx/jobs/test/stream` should stream, not buffer. If buffered, add explicit proxy configuration.

## Refactor / Implement

### Step 1 — Job manager service
- [ ] Create `pptx-import-job-manager.js` mirroring `game-room-manager-singleton-service.js` structure.
- [ ] Implement Map + TTL + SSE client list + 1-concurrent-running enforcement.
- [ ] Create `pptx-import-job-manager.test.js` with full lifecycle coverage.

### Step 2 — Route rewrite
- [ ] Add `app.param('jobId', ...)` validator at `server/index.js:~58`.
- [ ] Rewrite POST handler in `server/routes/pptx-import.js`:
  - Multer accepts file (existing).
  - Call `createJob()` -> jobId.
  - Spawn an `async function runImport(jobId, filePath)` (named, not inline arrow inside handler) — its body wraps `importPptxFile(filePath, { onProgress })` in `try/catch/finally`. The `finally` deletes `filePath`. The handler does NOT have a `finally` for the file.
  - Return `202 { jobId }` immediately from handler.
  - On completion/error inside `runImport`: `completeJob`/`failJob` -> SSE emits; then `finally` deletes file.
- [ ] Add GET `/api/pptx/jobs/:jobId` handler (poll).
- [ ] Add GET `/api/pptx/jobs/:jobId/stream` SSE handler (set headers, attach client, on `req.on('close')` detach). `attachSseClient` MUST cancel any pending cleanup timer.
- [ ] Add DELETE `/api/pptx/jobs/:jobId` handler (cancel).

### Step 3 — Worker progress
- [ ] In `parse-worker.js`, emit `process.send({type:'progress', ...})` at start, mid (heartbeat), and end of parse.
- [ ] In `importer.js`, accept `options.onProgress`; pass to `worker-runner` (already wired in Phase 6) and to `mapPptxOutput`.
- [ ] In `mapPptxOutput` (`map-presentation.js` after Phase 7), call `options.onProgress?.({stage:'mapping', ...})` per slide.

### Step 4 — Client
- [ ] Update `client/src/utils/api.js:41-45` — replace `importPptx` with `importPptxAsync`, add `pollPptxJob`, `cancelPptxJob`.
- [ ] Rewrite `HomePage.jsx:565-592` `handleImportPptx` with EventSource pattern from research.
- [ ] Add React cleanup: on unmount during import, call `cancelPptxJob(jobId)` and `es.close()`.

### Step 5 — Tests
- [ ] Rewrite `pptx-import.test.js`: assert 202 + jobId; assert 4 routes work; assert validator rejects invalid jobId.
- [ ] Rewrite `pptx-import-e2e-flow.test.js`: poll loop until done; assert eventual `presentation` result.
- [ ] Update `client/src/utils/api.test.js` lines 4, 19 — switch `importPptx` calls to `importPptxAsync` + `pollPptxJob`.
- [ ] Update `tests/e2e/pptx-import-fidelity.spec.js:22` — switch to async flow (POST returns 202; poll for done).
- [ ] Update `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js` lines 15, 47, 56 — same async polling pattern.
- [ ] Create `tests/e2e/pptx-import-async.spec.js`: Playwright UI test — upload Bai_2_5.pptx, observe progress messages, presentation opens.

## Tests After (New Unit Tests)

- [ ] `pptx-import-job-manager.test.js`:
  - `createJob increments running count`, `throws when MAX_CONCURRENT_RUNNING exceeded`, `completeJob clears running`, `cancelJob kills child`, `TTL expires job after 10min`, `attachSseClient stores response`, `emitProgress writes to all SSE clients`, `detachSseClient on req close`.
- [ ] `pptx-import.test.js`:
  - 202 response shape, GET jobs/:jobId, SSE event sequence, DELETE cancels, 400 on bad jobId, 404 on unknown jobId, 409 on cancel-after-done.
- [ ] `tests/e2e/pptx-import-async.spec.js`: upload + progress text appears + presentation opens.

## Regression Gate

- [ ] `npm test` — full suite green
- [ ] `npm test -- --coverage` — thresholds preserved
- [ ] LOC budget: `pptx-import-job-manager.js` <= 180 LOC; `pptx-import.js` route <= 180 LOC (currently 59 -> ~95)
- [ ] `npm run test:corpus` — green
- [ ] `npm run test:e2e` (playwright) — async import scenario green
- [ ] Manually verify large file (>5MB) shows progressing percent in UI

## Breaking Change Disclosure

- POST `/api/pptx/import` response: `200 { presentation, ... }` -> `202 { jobId }`.
- Old `api.importPptx` removed from `client/src/utils/api.js`.
- **Confirmed consumers requiring same-commit update (red-team verified):**
  - `client/src/pages/HomePage.jsx:565-592` (importPptx call → importPptxAsync + SSE)
  - `client/src/utils/api.js:41-45` (API surface)
  - `client/src/utils/api.test.js:4,19` (test of importPptx)
  - `tests/e2e/pptx-import-fidelity.spec.js:22` (e2e using sync flow)
  - `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js:15,47,56` (e2e using sync flow)
- Grep `importPptx|/api/pptx/import` across `client/` + `tests/` confirmed only these 5 files. Verify again before merge.

## Success Criteria

- POST returns within 200ms (file upload time only).
- SSE emits at least 5 progress events for a 1MB file.
- UI shows live progress text changing.
- Cancel works mid-import.
- Worker crash surfaces via `event: failed` within 1s (not 60s).
- Memory: completed jobs cleared after 10min.

## Risk Assessment

- High risk: breaking change to client contract. Mitigation: client + server in same commit; e2e test covers full flow.
- Risk: SSE connection drop during slow imports. Mitigation: client `onerror` rejects with retry hint; user can re-poll via `pollPptxJob`.
- Risk: 1-concurrent enforcement too strict if user opens two tabs. Mitigation: 429 with `Retry-After: 60` header (validation-confirmed v1 stance); client UI shows "another import is running, please wait".
- Risk: `req.on('close')` not always fired on Express. Mitigation: also clear SSE clients on TTL expiry as defense-in-depth.
- Risk: Vite proxy times out SSE in dev. Mitigation: verify `vite.config.js` proxy config supports streaming; add `ws: true` if needed.

## Rollback Plan

- Revert client + server commits together. Old sync route returns. No data migration.

## Unresolved Questions

1. SSE heartbeat interval: 2s reasonable? Vite proxy default tolerates this.
2. Should `event: cancelled` also fire `done` semantically? Recommend distinct event for client clarity.
3. Multiple SSE clients per job (e.g., DevTools tab + UI tab) — both should receive same events; pattern supports this naturally.
4. Express + multer in async handler: `req.file.path` deletion timing — verify file deleted after worker reads it (not before).
