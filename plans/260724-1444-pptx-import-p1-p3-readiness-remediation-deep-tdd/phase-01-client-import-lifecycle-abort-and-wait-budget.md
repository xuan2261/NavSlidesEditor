---
phase: 1
title: "Client Import Lifecycle Abort And Wait Budget"
status: completed
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 1: Client Import Lifecycle Abort And Wait Budget

## Overview

Unify AbortSignal from admission through SSE/poll, add wait budget slack past server deadline, make poll-only emit connection identity, and guard `onOpen` after unmount. Closes audit P1.1–P1.3 and residual F-03/F-04.

## Context Links

- Research: `../reports/2026-07-24-pptx-p1plus-research-client-lifecycle.md`
- Audit: `../reports/2026-07-22-pptx-import-readiness-audit.md` P1 items 1–3, UX cancel notes
- P0 deferred: full lifecycle controller (phase-01 P0 left wait path open)
- Code: `client/src/utils/pptx-job-wait.js`, `client/src/utils/api.js`, `client/src/pages/HomePage.jsx` (~642-715), `server/services/pptx-import/constants.js` (`IMPORT_TIMEOUT_MS`)

## Requirements

### Functional

- `pollPptxJobUntilTerminal` and `waitForPptxJob` accept optional `signal` and `maxWaitMs` (or derive from attempts×interval with absolute deadline).
- Poll sleep aborts on signal; poll/cancel fetches pass signal where supported.
- SSE path: on signal abort → close EventSource, cancel job, reject with abort-class error (not user failure toast if intentional).
- Absolute wait budget default: `IMPORT_TIMEOUT_MS + 30_000` (document constant; share via shared constant or duplicated documented number).
- SSE must not hang forever: same absolute budget timer.
- Poll-only path calls `onConnection({ jobId })` immediately and `onConnection(null)` on settle.
- HomePage: one controller for admission + wait; unmount aborts + cancels if jobId; success only if `pptxImportRef.current === activeImport` before warnings/`onOpen`.
- Leave/cancel policy (align plan AD7):
  - Pre-publish: abort + cancel → no package head.
  - Post-publish pre-visibility: server must not leave openable `done` without listable row (rollback preferred).
  - Post-visibility: unmount must **not** `onOpen`; **keep presentation** in library; cancel may no-op (Validation V2).
- Intentional unmount/abort/cancelled → silent cleanup (no “Failed to import PPTX” toast). Map cancelled + AbortError + ownership-abandon.
- Absolute wait budget hardcoded client-side (`IMPORT_TIMEOUT_MS + 30_000`); **do not** edit `server/routes/pptx-import.js` in this phase (file owned by phase 2+).

### Non-functional

- Fake timers in unit tests; no real 120s waits.
- Preserve `PptxJobOutcomeError` codes including `PPTX_JOB_OUTCOME_UNKNOWN`.
- Do not regress P0 Retry-After grammar.
- If `pptx-job-wait.js` would exceed ~200 LOC, split abortable sleep / poll / SSE into sibling modules.

## Architecture

```text
admissionController (AbortController)
  -> importPptxAsync({ signal })
  -> waitForPptxJob({ signal, maxWaitMs, onConnection })
       EventSource + abort listener
       OR poll loop with abortable sleep
  unmount -> abort() + cancelPptxJob(jobId)
  success -> ownership guard -> onOpen
```

## File Inventory

| Path | Action | ~Size | Test impact |
| --- | --- | --- | --- |
| `client/src/utils/pptx-job-wait.js` (+ split modules if needed) | Modify/create | keep ≤200 LOC each | Primary |
| `client/src/utils/pptx-job-wait.test.js` | Modify | — | Expand |
| `client/src/utils/api.js` | Modify | poll/cancel signal opts only | `api.test.js` |
| `client/src/pages/HomePage.jsx` or extract `use-pptx-import.js` | Modify/create | import slice only | lifecycle tests |
| `client/src/pages/HomePage.pptx-import-lifecycle.test.jsx` | Modify | — | Expand |
| `server/routes/pptx-import.js` | **Do not touch** | — | Phase 2+ |

## Dependency Map

- None. Independent of phases 2–8.
- Touches same HomePage as UI plans — **narrow import-only edits**.

## Tests Before (TDD) — concrete red contracts

1. Poll: after abort mid-sleep → reject `AbortError` (or DOMException abort); `pollPptxJob` call count frozen (no further polls).
2. SSE `maxWaitMs`: fire timer → `cancelPptxJob` called once → reject with `PPTX_JOB_OUTCOME_UNKNOWN` or cancelled path (assert `code`); EventSource closed.
3. Poll-only (`EventSourceImpl` undefined): `onConnection` called with `{ jobId }` before first poll; `onConnection(null)` on settle.
4. HomePage: start wait → unmount → mock wait resolves `done` later → `onOpen` call count **0**; no failure toast for intentional abandon.
5. Same AbortController instance passed to `importPptxAsync` and `waitForPptxJob`.
6. Regression T6: Retry-After still honored (existing api tests remain green).

## Refactor / Implementation Steps

1. Add `sleepWithSignal` reuse or local abortable sleep in `pptx-job-wait.js`.
2. Thread `signal` + absolute deadline through poll and SSE waiters.
3. Wire poll/cancel API methods to accept signal.
4. HomePage: pass controller into wait; ownership guard; finally aborts wait ownership.
5. Optional: server deadline fields.

## Tests After

- Integration-style unit: SSE error → poll → abort during poll.
- HomePage busy-then-unmount during wait (not only admission).

## Regression Gate

```bash
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js
```

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| T1 | Abort during poll sleep | Critical |
| T2 | Abort during SSE open | Critical |
| T3 | maxWaitMs fires; cancel + unknown outcome if needed | Critical |
| T4 | Poll-only onConnection | High |
| T5 | Success after unmount suppressed | Critical |
| T6 | Retry-After still works | High regression |

## Function / Interface Checklist

- [ ] `pollPptxJobUntilTerminal({ signal, maxWaitMs })`
- [ ] `waitForPptxJob({ signal, maxWaitMs })`
- [ ] `api.pollPptxJob(id, { signal })` / `cancelPptxJob(id, { signal })`
- [ ] HomePage ownership guard

## Success Criteria

- [ ] All T1–T6 pass
- [ ] No real long sleeps in CI
- [ ] Unmount never navigates to editor for abandoned import

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Double cancel noise | Swallow cancel errors on abort path |
| AbortError shown as import failure | Map intentional abort to silent cleanup |
| Slack too small under proxy latency | 30s default; document constant |

## Security Considerations

- Cancel still requires knowing job UUID (existing model).
- No new multi-tenant auth.

## Todo

- [ ] Tests Before for abort + budget + onConnection
- [ ] Implement wait signal + budget
- [ ] HomePage wire + ownership guard
- [ ] Regression gate green
