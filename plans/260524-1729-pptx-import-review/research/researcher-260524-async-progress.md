# PPTX Import: Async Job + Progress Streaming Research
**Date:** 2026-05-24 | **Scope:** NavSlides single-user, Electron-compatible, no new infra

---

## Recommended Pattern

**In-memory job map + SSE streaming.** No libraries. ~100 LOC total.

Rationale:
- Single-user: no isolation, no priority, no persistence across restarts needed
- Fork worker already exists (`worker-runner.js`) — extend via `process.send` progress messages
- SSE is zero-dependency, one-directional, trivially proxied. Socket.IO is overkill (it's for live presentation, not file import)
- Game room manager (`game-room-manager-singleton-service.js`) already proves the `Map + TTL cleanup` pattern is native to this codebase — REUSE it exactly

---

## Pre-existing In-Codebase Patterns to Reuse

| Pattern | File | Reuse |
|---------|------|-------|
| `rooms = new Map()` + TTL `setTimeout` cleanup | `server/services/game-room-manager-singleton-service.js:6-111` | Copy exact shape for jobs map |
| `ROOM_TTL_MS = 5 * 60 * 1000` + `clearTimeout(room.cleanupTimer)` | same, line 8,108 | Same TTL + timer approach for job cleanup |
| `fork()` + `child.on('message')` + `child.send()` | `server/services/pptx-import/worker-runner.js:60-128` | Extend: intercept non-result messages as progress before `isParserWorkerResult` check |
| `isParserWorkerResult` type guard | `worker-runner.js:50-52` | Add `isProgressMessage` sibling type guard |
| `importProgress` state + status text UI | `client/src/pages/HomePage.jsx:462, 875-882` | Wire to SSE events instead of manual state calls |
| `PARSER_TIMEOUT_MS = 60000` | `constants.js:7` | Extend to per-job timeout stored in job entry |

---

## Job Manager API Design

### New module: `server/services/pptx-import-job-manager.js`

Shape (mirrors game-room-manager pattern):

```
const jobs = new Map()
// jobId -> { status, stage, percent, message, result, error, startedAt, child, sseClients, cleanupTimer }

status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
```

### Endpoint shapes

**POST /api/pptx/import** (replace sync version — returns 202 + jobId immediately)
```
Request:  multipart/form-data  { file: <binary> }
Response: 202 { jobId: "uuid-v4" }
```
File is already written to disk by multer before handler runs — multer stays unchanged.

**GET /api/pptx/jobs/:jobId** (poll fallback — returns snapshot)
```
200 { jobId, status, stage, percent, message, result?, error? }
404 if unknown
```

**GET /api/pptx/jobs/:jobId/stream** (SSE — live progress)
```
Content-Type: text/event-stream
Cache-Control: no-cache

event: progress
data: {"stage":"parsing","percent":35,"message":"Parsing slide 8 of 23"}

event: done
data: {"jobId":"...","result":{presentation,stats,warnings}}

event: failed
data: {"jobId":"...","error":"PPTX parser timed out after 60s","type":"parse-failed"}
```
Client opens SSE, receives events, closes stream when `done`/`failed` fires.

**DELETE /api/pptx/jobs/:jobId** (cancel)
```
204 on success
404 if unknown
409 if already done/failed
```

### Memory bounds (single-user, conservative)

- Max retained completed jobs: **5** (single-user; one import at a time in practice)
- Job TTL after completion/failure: **10 minutes** (enough to re-fetch result on slow navigation)
- Max concurrent running jobs: **1** enforced via simple check (return 429 if `[...jobs.values()].some(j => j.status === 'running')`)
- SSE clients per job: unbounded in practice (only 1 tab), but store as array for correct cleanup

---

## Worker Progress Protocol

### Message shape (IPC)

Existing final-result shape: `{ ok: boolean, output?, error?, fallback?, ... }`

Add progress messages (non-result, filtered by `isParserWorkerResult` returning `false`):

```js
// parse-worker.js emits during work:
process.send({ type: 'progress', stage: 'parsing', percent: 20, message: 'Reading PPTX archive' })
process.send({ type: 'progress', stage: 'parsing', percent: 60, message: 'Parsing slide 14 of 23' })
process.send({ type: 'progress', stage: 'parsing', percent: 100, message: 'Parse complete' })
// then final result:
process.send({ ok: true, output: {...} })
```

Type guard to add in `worker-runner.js`:
```js
function isProgressMessage(msg) {
  return msg && msg.type === 'progress' && typeof msg.stage === 'string'
}
```

### Worker progress injection points in `parse-worker.js`

`parseFile()` currently: read file → call `parse()` → maybe `inspectWithPptx2Json()` → return.

Add `onProgress` callback param:
```js
async function parseFile(filePath, onProgress = () => {}) {
  onProgress({ stage: 'parsing', percent: 5, message: 'Reading PPTX archive' })
  // ... after parse():
  onProgress({ stage: 'parsing', percent: 80, message: `Parsed ${slides.length} slides` })
}
process.on('message', async ({ filePath }) => {
  try {
    const result = await parseFile(filePath, (p) => process.send({ type: 'progress', ...p }))
    process.send(result)
  } catch (err) { ... }
})
```

### Mapper progress (post-parse, in `importer.js`)

`mapPptxOutput` loops slides — emit one progress message per slide:
- Mapper runs in parent process (not worker), so job manager calls its `onProgress` directly
- `importPptxFile` already takes `options` — add `options.onProgress` callback

Slide-level granularity: `{ stage: 'mapping', percent: Math.round((i/total)*100), message: 'Processing slide N of M' }`

### Updated `worker-runner.js` contract

In `runParserWorker`, intercept in `child.on('message')`:
```js
child.on('message', (message) => {
  if (settled) return
  if (isProgressMessage(message)) {
    options.onProgress?.(message)  // bubble up to job manager
    return
  }
  if (!isParserWorkerResult(message)) { ... ignored ... }
  finish(message)
})
```
`options.onProgress` is a new optional param — backward-compatible (existing callers pass no `onProgress`).

---

## Client Integration Sketch

### In `client/src/utils/api.js` — add helpers:

```js
importPptxAsync: (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return fetch(`${BASE}/pptx/import`, { method: 'POST', body: fd }).then(handleResponse)
  // returns { jobId }
},
pollPptxJob: (jobId) =>
  fetch(`${BASE}/pptx/jobs/${jobId}`).then(handleResponse),
cancelPptxJob: (jobId) =>
  fetch(`${BASE}/pptx/jobs/${jobId}`, { method: 'DELETE' }).then(handleResponse),
```

SSE opened directly (no api.js wrapper needed):
```js
const es = new EventSource(`/api/pptx/jobs/${jobId}/stream`)
```

### In `HomePage.jsx:handleImportPptx` — replace 3 static states with real progress:

```js
async function handleImportPptx(file) {
  setImportProgress('Uploading PPTX...')
  const { jobId } = await api.importPptxAsync(file)

  await new Promise((resolve, reject) => {
    const es = new EventSource(`/api/pptx/jobs/${jobId}/stream`)
    es.addEventListener('progress', (e) => {
      const { message } = JSON.parse(e.data)
      setImportProgress(message)
    })
    es.addEventListener('done', async (e) => {
      es.close()
      const { result } = JSON.parse(e.data)
      setImportProgress('Creating presentation...')
      const pres = await api.createPresentation(result.presentation)
      onOpen(pres.id)
      resolve()
    })
    es.addEventListener('failed', (e) => {
      es.close()
      reject(new Error(JSON.parse(e.data).error))
    })
    es.onerror = () => { es.close(); reject(new Error('Connection lost')) }
  })
}
```

`importProgress` state and UI at line 875 stays unchanged — still renders a string.

---

## Cancellation + Error Recovery

### Cancellation
- `DELETE /api/pptx/jobs/:jobId` calls `killChild(job.child)` (already implemented in `worker-runner.js:43-48`), sets `status = 'cancelled'`, closes SSE clients with `event: cancelled`
- Client: if user navigates away, React cleanup (`useEffect` return) calls `cancelPptxJob(jobId)` and `es.close()`
- Worker temp file (`req.file.path`) deleted in `finally` block regardless of cancel

### Error Recovery (worker crash)

Current `worker-runner.js` already handles:
- `child.on('exit')` → `finish({ ok: false, error: { type: parseFailed, ... } })` (line 114-123)
- `child.on('error')` → `finish({ ok: false, ... })` (line 104-112)
- Timeout → `finish({ ok: false, message: 'timed out after 60s' })` (line 79-88)

Job manager wraps `importPptxFile` in try/catch:
- On any exception: set `status = 'failed'`, `error = err.message`, broadcast `event: failed` to all SSE clients
- Clients receive `event: failed` and show error — no silent hang

One improvement over current: SSE `failed` event fires immediately on crash, vs current 60s timeout. Worker crash triggers `exit` handler immediately.

### Orphaned SSE clients
If client disconnects before job finishes, `req.on('close')` removes the SSE response from `job.sseClients` array. Job continues running (single-user: we want to finish the import even if tab closed).

---

## Migration Path from Sync Endpoint

**Option A (recommended): replace in-place with graceful degradation**

Keep `POST /api/pptx/import` as the endpoint. Change response:
- Returns `202 { jobId }` instead of `200 { presentation, stats, warnings }`
- Add `GET /api/pptx/jobs/:jobId` + SSE stream as new routes

Client detects async by checking `response.status === 202` or presence of `jobId` in body. Old behavior was synchronous 200 — unambiguous.

No new URL path needed. One route, new contract.

**Option B: parallel path `/api/pptx/import/async`**

Adds URL churn, requires updating client, keeps dead sync path around. Not recommended per YAGNI.

**Breaking change scope:** only `api.importPptx` in `client/src/utils/api.js:41-45` and `HomePage.jsx:565-592`. No server-to-server consumers. No shared module dependency. Safe to replace.

**Test migration:** `server/routes/pptx-import.test.js` and `pptx-import-e2e-flow.test.js` need updating for 202 response + job polling. `worker-runner.test.js` tests are unaffected (unit-level).

---

## Trade-offs Summary

| Approach | Complexity | Infra | UX | Electron | Verdict |
|---|---|---|---|---|---|
| SSE + in-memory job map | Low (~100 LOC) | None | Good (real %) | Yes | **Chosen** |
| Socket.IO (existing) | Medium (coupling) | None | Good | Yes | Overkill for one-off |
| Polling (200ms) | Lowest | None | Acceptable | Yes | Fallback only |
| Redis + Bull | High | Redis required | Best | No (user must run Redis) | Hard constraint violation |

---

## Unresolved Questions

1. **Percent accuracy inside `pptxtojson`:** `parse()` is a third-party call with no callback API. Worker can emit `5%` on start and `100%` on finish — but mid-parse granularity may be impossible without patching the library or adding `setInterval` heartbeats. Recommend heartbeat: `setInterval(() => process.send({ type: 'progress', stage: 'parsing', percent: null, message: 'Parsing...' }), 2000)` as fallback animation trigger.

2. **Mapper percent accuracy:** `mapPptxOutput` loops slides synchronously in parent. Emitting per-slide is fine, but large media blobs (`persistImageForElement`) are the true bottleneck. Need to profile whether per-slide or per-media-blob granularity is worth it.

3. **Express timeout:** Default Express has no request timeout, but Vite proxy (`/api` → `localhost:3002`) may have one. With async pattern POST returns 202 immediately so this is moot — verify Vite proxy config doesn't impose a short SSE connection timeout in dev mode.

4. **Job ID validation:** `app.param('id', ...)` in `server/index.js:50-53` only covers `:id`, `:snapshotId`, `:presId`. New `:jobId` param needs its own `app.param` or inline validation in the jobs route.
