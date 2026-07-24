# PPTX P1+ Research — Client Import Lifecycle

**Date:** 2026-07-24  
**Mode:** read-only research (no app code changes)  
**Scope:** Audit P1 items 1–3, UX cancel/Retry-After notes; F-02 partial, F-03, F-04  
**Primary sources:** client admission/wait stack, server job routes/constants, P0 phase-01 notes, existing unit tests  
**Audience:** deep-TDD planner for P1 reliability work

---

## 1. Verdict (ranked)

| Rank | Finding | Status after P0 | P1 action |
| --- | --- | --- | --- |
| **1** | Unified abort across upload → busy sleep → SSE/poll → post-wait | **Partial** — admission only | Must fix |
| **2** | Client wait window races server 120s deadline; SSE has no client deadline | **Open** | Must fix |
| **3** | jobId ownership before wait | **Mostly fixed** in HomePage; wait helper still incomplete | Small polish |
| **4** | Retry-After honor + abortable busy sleep | **Fixed by P0** | UX countdown optional only |

**Recommendation for P1 plan:** treat lifecycle as one thin contract change set, not four independent features.

1. Extend `waitForPptxJob` / `pollPptxJobUntilTerminal` with optional `signal` + wait budget slack.
2. Wire one HomePage controller (or keep admission controller and pass same signal into wait).
3. Optionally return `deadlineMs` / `expiresAt` from server job create/status; client may hardcode slack without API change if YAGNI.
4. Do **not** reopen P0 Retry-After delay grammar unless regression found.

---

## 2. Current lifecycle (source)

```text
HomePage.handleImportPptx
  activeImport = { admissionController, connection:null, jobId:null }
  api.importPptxAsync(file, { retryOnBusy, signal: admissionController.signal })
    POST /api/pptx/import  (AbortSignal on fetch)
    on 429 import-in-progress → sleepWithSignal(Retry-After or fallback)
  activeImport.jobId = jobId
  if unmounted → cancelPptxJob(jobId); return
  waitForPptxJob({ jobId, api, onProgress, onConnection })
    EventSource /api/pptx/jobs/:id/stream
    onerror → pollPptxJobUntilTerminal (120 × 1s default)
    no EventSource → poll only
  on success → onOpen(presentationId)
  finally → abort admission, close ES, clear ref
unmount cleanup → abort admission, close ES, cancel if jobId
```

Evidence: `client/src/pages/HomePage.jsx:642-715`, `client/src/utils/api.js:153-181`, `client/src/utils/pptx-job-wait.js:24-158`, `server/routes/pptx-import.js:381-480`.

Server side:

- Reserve job before multer body; busy → `429` + `Retry-After: 60` — `server/routes/pptx-import.js:381-393`.
- `202 { jobId }` then fire-and-forget `runImport` — `server/routes/pptx-import.js:396-426`.
- Global deadline `IMPORT_TIMEOUT_MS = 120_000` aborts import — `server/services/pptx-import/constants.js:10`, `server/routes/pptx-import.js:182-204`.
- Upload limiter POST-only after P0 — `server/index.js:123-124`.

---

## 3. What already works (P0 fixed / solid)

### 3.1 Retry-After honored (F-02 largely closed)

Audit F-02 claimed fixed delay only. **Current code no longer matches audit text.**

| Behavior | Evidence |
| --- | --- |
| Raw header preserved | `api.js:10-13` → `err.retryAfter`, `err.retryAfterRaw` |
| Canonical decimal seconds only | `api.js:28-36` `/^[0-9]+$/` |
| Cap 300_000 ms | `api.js:21-25`, `api.js:32` |
| Invalid → fallback clamp | `api.js:28-36` |
| Abortable sleep | `api.js:44-65`, used at `api.js:175` |
| Fetch gets signal | `api.js:165-169` |
| Server still sends `Retry-After: 60` | `pptx-import.js:389` |

P0 phase-01 explicitly completed this and deferred full lifecycle abort (`plans/260722-1630-.../phase-01-...md:16-18`, `:41`, `:185`).

**Remaining UX gap (not correctness):** busy message is static string; no countdown of next retry — audit UX note `readiness-audit.md:416`. Low priority for reliability P1.

### 3.2 Admission abort on unmount

HomePage stores `admissionController` and passes signal into `importPptxAsync` — `HomePage.jsx:652-663`.  
Unmount aborts admission — `HomePage.jsx:300-306`.  
Tests: `HomePage.pptx-import-lifecycle.test.jsx:53-77`, `api.test.js:205-301`.

### 3.3 jobId stored before wait (partial F-03 fix)

```670:674:client/src/pages/HomePage.jsx
      activeImport.jobId = jobId
      if (pptxImportRef.current !== activeImport) {
        if (jobId) api.cancelPptxJob(jobId).catch(() => {})
        return
      }
```

Unmount after admission can cancel server job via `jobId` without needing `onConnection`. This is stronger than the 2026-07-22 audit snapshot for “no jobId until EventSource”.

### 3.4 SSE → poll fallback + deadline cancel reconcile

- SSE error falls back to poll — `pptx-job-wait.js:142-156`.
- Poll deadline cancels then final poll; can recover late `done` — `pptx-job-wait.js:39-76`.
- Tests cover fallback + outcome-unknown — `pptx-job-wait.test.js:5-85`.
- Server cancel + durable finished 409 — `pptx-import.js:462-480`.

### 3.5 Upload quota no longer starves status/SSE/cancel

P0: `app.post('/api/pptx/import', uploadLimiter)` then router — `server/index.js:123-124`.  
Audit F-01 (production GET 31 → 429) addressed at middleware scope; not re-probed this session.

---

## 4. Remaining defects (exact file:line)

### D1 — P1 item 1: AbortController not end-to-end

**Severity: High**

| Stage | Abortable today? | Evidence |
| --- | --- | --- |
| Upload POST | Yes (admission signal) | `api.js:165-169` |
| Busy retry sleep | Yes | `api.js:175` + `sleepWithSignal` |
| `waitForPptxJob` SSE | **No signal** — only external `connection.es.close()` | `pptx-job-wait.js:79-157` |
| Poll loop sleep | **No** plain `setTimeout` sleep | `pptx-job-wait.js:1`, `:36` |
| `pollPptxJob` / `cancelPptxJob` fetch | **No signal** | `api.js:179-181` |
| Post-wait `onOpen` after unmount | **No guard** | `HomePage.jsx:675-702` |

Concrete failure modes:

1. **Unmount during poll wait:** cleanup sets `pptxImportRef = null`, closes ES, fires cancel — `HomePage.jsx:300-306`. Poll loop **keeps running** (`pptx-job-wait.js:31-37`) because no signal. Cancel usually prevents orphan work, but:
2. **Success race after leave:** if server reaches `done` before cancel applies (or cancel 409 already finished), `waitForPptxJob` resolves and HomePage continues to `onOpen(presentationId)` **without** re-checking `pptxImportRef.current === activeImport` — `HomePage.jsx:675-702`. User can navigate into editor after leaving HomePage.
3. **Admission abort in `finally` is wrong tool for job wait:** success/error finally always `admissionController.abort()` — `HomePage.jsx:709-710`. Harmless after admission settled; does not abort wait helper.
4. **SSE hang:** if EventSource stays open without terminal event and never errors, promise never settles — no client max wait on SSE path (`pptx-job-wait.js:98-157`).

P0 phase-01 explicitly left this open: “Do not pass this controller into `waitForPptxJob`; that P1 unification stays deferred” — phase-01 `:135-136`.

### D2 — P1 item 2: jobId emit before EventSource vs polling

**Severity: Low–Medium** (mostly mitigated)

| Path | jobId to HomePage? | onConnection? |
| --- | --- | --- |
| Admission success | Yes, before wait — `HomePage.jsx:670` | n/a |
| SSE | jobId already on ref | `{ es, jobId }` after ES construct — `pptx-job-wait.js:99-102` |
| Poll-only (`!EventSourceImpl`) | jobId already on ref | **Never called** — early return `pptx-job-wait.js:88-96` |
| SSE→poll fallback | jobId on ref; ES closed in onerror | onConnection(null) only after `finish` |

**Remaining defect:** poll-only path never registers connection identity via `onConnection`. Today HomePage does not need that for cancel (uses `jobId`), but any future consumer that only listens to `onConnection` still broken. Also `onConnection(null)` not invoked on poll-only exit — connection cleanup asymmetric.

Audit claim “unmount only cancels when jobId set” is still true for pre-admission phase (correct — no server job yet). Post-admission jobId is set promptly.

### D3 — P1 item 3 / F-04: client wait vs server deadline slack

**Severity: High**

| Clock | Value | Source |
| --- | --- | --- |
| Server import deadline | **120_000 ms** from `runImport` start | `constants.js:10`, `pptx-import.js:182-197` |
| Client poll budget | **120 attempts × 1000 ms** between polls | `pptx-job-wait.js:24-36`, defaults `:85-86` |
| Client SSE budget | **∞** until error/terminal | `pptx-job-wait.js:98-157` |
| Server→client deadline metadata | **None** on 202 or status payload | `pptx-import.js:426`, serialize paths |

Timing analysis:

- First poll is immediate; then up to 119 × 1s sleeps → ~119s pure sleep + RTT × 120. Roughly co-terminal with server 120s, **no intentional slack**.
- Client wait starts after upload + 202; server deadline starts inside `runImport` after 202. Upload time is outside both clocks (good), but network RTT makes client more likely to cancel while server still finishing last stages (package commit / presentation create around 92–98% — `pptx-import.js:221-282` region).
- On client deadline: cancel + final poll; may emit `PPTX_JOB_OUTCOME_UNKNOWN` even if server later completes — `pptx-job-wait.js:56-64`.
- **No shared constant** between client defaults and `IMPORT_TIMEOUT_MS`.

### D4 — F-02 residual (P0 partial only on UX)

**Severity: Low**

Correctness of delay selection: **done**.  
UX countdown / next-retry display: **not done** — static message `HomePage.jsx:664-667`.  
Server Retry-After remains hard-coded `60`, not derived from remaining job time — `pptx-import.js:389`. Acceptable for single-slot concurrency.

### D5 — Related non-goals for this research slice

Out of scope here but adjacent: durable job after restart (audit P1.6), multi-tenant job secrets (audit comment `pptx-import.js:374-379`), warning report persistence (P1.4).

---

## 5. Existing tests and gaps

### Present

| Suite | Covers | Gap |
| --- | --- | --- |
| `client/src/utils/api.test.js` | multipart POST; busy retry; Retry-After grammar/cap; non-busy 429; signal on fetch; abort sleep; poll/cancel URLs | No signal on poll/cancel; no wait integration |
| `client/src/pages/HomePage.pptx-import-lifecycle.test.jsx` | unmount during **admission**; no overlapping import | No unmount during **wait**; no post-wait onOpen guard; no SSE/poll cancel |
| `client/src/utils/pptx-job-wait.test.js` | SSE→poll fallback; deadline cancel then done race; OUTCOME_UNKNOWN | No AbortSignal; no wait-budget > server deadline; no poll-only onConnection; no SSE hang/timeout |
| P0 server limiter suite (referenced phase-01) | POST-only upload quota | Not re-run this research |
| `server/routes/pptx-import` tests (referenced) | admission/deadline/cancel contracts | Client clocks not coupled |

### Missing tests for P1 (minimal set)

1. **Red:** unmount/signal during poll sleep → no further `pollPptxJob`; cancel once; no `onOpen`.
2. **Red:** unmount after job `done` already in flight → no `onOpen` if ref cleared (or explicit cancelled flag).
3. **Red:** default/configured wait budget > server deadline by documented slack (e.g. +30s or +25%).
4. **Red:** poll-only path invokes `onConnection({ jobId })` before first poll (if API keeps callback).
5. **Red:** SSE path honors same overall deadline (timer → close ES → poll-or-cancel path).
6. **Green retain:** existing Retry-After fake-timer matrix; admission unmount; SSE fallback; deadline reconcile done race.

---

## 6. Recommended minimal API surface for P1

YAGNI order: prefer client-only slack + signal before new server fields.

### 6.1 Preferred minimal (client-first)

**`waitForPptxJob` / `pollPptxJobUntilTerminal`**

```js
// additive options only
{
  signal,                 // AbortSignal — required wiring from HomePage
  maxWaitMs,              // wall-clock budget; default IMPORT_TIMEOUT_MS + SLACK
  maxPollAttempts,        // keep for back-compat; derive from maxWaitMs/pollInterval if both set
  pollIntervalMs,
  onConnection,           // call once with { jobId, es? } for both SSE and poll-only
}
```

**`api.pollPptxJob(jobId, { signal })` / `api.cancelPptxJob(jobId, { signal })`**  
Optional; only needed if abort mid-flight fetch matters. Cancel on unmount can stay fire-and-forget.

**HomePage**

- One controller for full lifecycle **or** pass `admissionController.signal` into wait after job create (simplest reuse).
- After `waitForPptxJob` resolves/rejects: gate success path on `pptxImportRef.current === activeImport` (and/or `!signal.aborted`).
- Keep jobId assignment before wait (already correct).

**Constants (shared or duplicated with comment)**

```text
CLIENT_IMPORT_WAIT_SLACK_MS = 30_000  // or 0.25 * deadline
CLIENT_IMPORT_MAX_WAIT_MS   = IMPORT_TIMEOUT_MS + SLACK  // 150_000
```

Avoid exporting server constants into Vite client unless already shared package path exists; a client-local mirror + comment link to `constants.js:10` is fine (KISS).

### 6.2 Optional server metadata (only if planner wants single source of truth)

On `202` and/or job serialize:

```json
{
  "jobId": "...",
  "deadlineMs": 120000,
  "recommendedClientWaitMs": 150000
}
```

Trade-off: better multi-version clients; costs route/test churn. **Not required** if monorepo ships client+server together.

### 6.3 Explicit non-changes

- Do not redesign Retry-After grammar (P0 locked).
- Do not merge upload limiter back onto GET/SSE/DELETE.
- Do not require user-facing cancel button for P1 reliability (unmount/signal is enough); optional UX later.
- Do not add multi-tenant job secrets in this slice.

---

## 7. Trade-off matrix

| Option | Reliability | Complexity | Maintenance | Architectural fit | Rank |
| --- | --- | --- | --- | --- | --- |
| **A. Signal + client slack only** | High for unmount/orphan/race | Low | Low | Fits current HomePage ref model | **1 — recommend** |
| **B. A + server deadline fields** | Slightly higher cross-version | Medium | Medium | Nice; YAGNI if co-deployed | 2 |
| **C. Wall-clock only, no signal (longer polls)** | Partial; unmount still races onOpen | Low | Low | Leaves D1 open | Reject |
| **D. Full state machine / job store in client** | High | High | High | Overkill vs ref + signal | Reject |

Adoption risk: **low**. Changes local to 3 files + tests; no storage migration. Main risk is over-cancelling successful imports if slack too small or cancel-on-unmount too aggressive when user navigates Home→Editor intentionally (today import already `onOpen`s; unmount cancel is correct if they leave dashboard mid-import).

---

## 8. Risk notes

| Risk | Mitigation |
| --- | --- |
| Cancel races terminal `done` → unknown/error flash | Keep final-poll reconcile; suppress UI if aborted |
| Slack too large → long hung UI | Cap slack (e.g. 30–60s); progress still via SSE/poll |
| Abort listener leaks on poll sleep | Mirror `sleepWithSignal` cleanup tests from `api.test.js` |
| Double cancel (unmount + poll deadline) | Idempotent DELETE; tolerate 404/409 |
| SSE close triggers onerror → poll after intentional abort | `settled`/`signal.aborted` guard before fallback poll |
| Shared constant drift client/server | Comment + single test asserting client maxWait ≥ server deadline + slack |
| Scope creep into durable restart jobs | Keep P1.6 separate |

Source credibility for this report: **primary = current source + P0 phase notes**; audit F-02 text is **stale** relative to post-P0 `api.js`. No fresh runtime probe of limiter or long import this session.

---

## 9. Mapping to audit checklist

| Audit item | Status 2026-07-24 |
| --- | --- |
| P1.1 One AbortController upload→busy→SSE/poll→cancel | **Open** (admission only) |
| P1.2 Emit/store jobId before EventSource vs poll | **Mostly done** in HomePage; helper poll-only incomplete |
| P1.3 Server deadline TTL + client slack | **Open** |
| F-02 Retry-After | **Fixed** (UX countdown optional) |
| F-03 upload/busy abort + poll job register | **Partial** (admission fixed; wait not) |
| F-04 client/server deadline race | **Open** |
| UX cancel coverage | **Partial** |
| P0 limiter POST-only | **Fixed** (not re-probed) |

---

## 10. Suggested P1 TDD phase split (for planner)

1. **Phase: wait abort + unmount success guard** — signal through poll/SSE; HomePage gate; tests 1–2 from §5.
2. **Phase: wait budget slack + SSE overall deadline** — defaults; tests 3,5; optional shared constant comment.
3. **Phase (tiny): onConnection parity for poll-only** — test 4; only if keeping callback contract.
4. **Optional later:** server `deadlineMs` field; Retry-After countdown UI.

Do not bundle fidelity/oracle/package-writer items into this client lifecycle plan.

---

## 11. Limitations

- No fresh browser/E2E reproduction of unmount race or 120s deadline collision.
- Did not re-run vitest suites; conclusions from source + existing tests only.
- Did not fully re-read `server/routes/pptx-import.test.js` / job-manager for cancel semantics beyond route handlers.
- Line numbers for audit F-02 still cite pre-P0 shapes; use this report’s current citations for planning.

---

## Unresolved questions

1. Product intent: should leaving HomePage mid-import **always** cancel server job, or allow background completion with toast on return?
2. Desired slack value (30s vs 25% vs expose server field)?
3. Is user-visible Cancel button in scope for P1 or unmount-only?
4. Should poll-only environments (no EventSource) be first-class in CI matrix?

---

**Report path:** `plans/reports/2026-07-24-pptx-p1plus-research-client-lifecycle.md`
