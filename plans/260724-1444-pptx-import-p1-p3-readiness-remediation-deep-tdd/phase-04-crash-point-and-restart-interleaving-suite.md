---
phase: 4
title: "Crash Point And Restart Interleaving Suite"
status: completed
priority: P1
effort: "2-3d"
dependencies: [2, 3]
---

# Phase 4: Crash Point And Restart Interleaving Suite

## Overview

Add DI crash-point and restart/interleaving tests proving ordered recovery around package publish → drain → media settle → completeJob, and GET/SSE/cancel/reconcile after simulated restart. Closes audit P1.7 and P2.8 (suite portion).

## Context Links

- Research durability §3 crash gaps, §8 recovery hooks
- Existing WAL faults: `package-store` / `state-store.js`
- Existing durable job HTTP tests: `pptx-import-durable-job.test.js`
- Reconcile rolls back completed package identity (not resume UX)

## Requirements

### Functional

**Real recovery barriers only** (media commit is **not** a barrier — files already on disk during map).

| CP | Fault site | Exact postconditions (must assert) |
| --- | --- | --- |
| CP1 | After publish, before drain | Outbox pending count ≥ 1; presentation **not** listable (or contract B non-openable); durable GET **not** openable done; head exists |
| CP2 | Drain throws | `packageRollback` called; job failed/cancelled; no openable done; outbox cleared or reconcile-safe; head rolled back per policy |
| CP3 | After drain, before in-memory completeJob | Presentation listable; report present; Map may still running; durable openable + reportSummary |
| CP4 | completeJob never called (Map miss) | Durable GET → openable done + presentationId + reportSummary; open presentation by id works |
| CP5 | Cancel during mapping (pre-publish) | No published head **or** rolled back; job cancelled; no list row |
| CP6 | Cancel after publish pre-drain | Rollback + non-openable; no ghost openable done |
| CP7 | Cancel after listable create (if still possible) | Documented policy: complete as done without client onOpen **or** rollback — assert chosen policy |
| CP8 | Restart: clear Map, GET job | Visibility-safe durable payload (not presentationId-only phantom) |
| CP9 | DELETE after durable terminal | 409 finished (P0) preserved |
| CP10 | Reconcile after success | Identity-bound rollback; P0 no-op fencing preserved |

### Non-functional

- **Hard gate:** CP1–CP5 use **real** temp `openPackageStore` + real presentations storage + outbox. Mock only the single fault injection point — not the whole authority stack.
- Fail CI if success path never calls `drainCompatibility`.
- No process kill required.
- Do not resume mid-import; terminal recovery only.

## Architecture

```text
runImport deps (required injectables):
  packageCommit, drainCompatibility, packageRollback, completeJob/failJob wrappers
// mediaTransaction.commit is NOT a crash barrier
```

## File Inventory

| Path | Action |
| --- | --- |
| `server/routes/pptx-import.js` | Ensure seams injectable (minimal) |
| `server/routes/pptx-import-crash-points.test.js` | Create |
| `server/routes/pptx-import-durable-job.test.js` | Extend restart/interleave |
| package-store tests | Reuse WAL where useful |

## Dependency Map

- Needs phase 2 single ordered path.
- Needs phase 3 report fields for CP4 assertions.
- Contributes evidence for phase 7 sandbox eval “restart” narrative.

## Tests Before (TDD)

Write **failing** tests with the exact postcondition table above for CP1–CP5 first (each `expect` on storage + job serialize), then CP6–CP10. No prose-only CPs.

## Refactor / Implementation Steps

1. Confirm/inject DI seams on `runImport` without behavior change.
2. Implement crash suite with temp package store + presentations storage.
3. Document SSE Map-only limitation in test comments/docs if unchanged.
4. Ensure reconcile still identity-fenced (P0).

## Tests After

- Full CP matrix green.
- No flaky timing: use deterministic throws, not sleeps.

## Regression Gate

```bash
npx vitest run server/routes/pptx-import-crash-points.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import.test.js
```

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| CP1–CP5 | Ordered publish/drain/complete | Critical |
| CP6 | Cancel mid-run | High |
| CP7–CP8 | Restart + DELETE 409 | Critical |
| CP9 | Concurrent reads | Medium |
| CP10 | Reconcile fencing | High |

## Function / Interface Checklist

- [x] Injectable drain/complete/rollback seams
- [x] Crash suite file
- [x] Restart Map-clear helper

## Success Criteria

- [x] CP1–CP8 green
- [x] P0 durable authority tests still green
- [x] Documented residual: SSE after restart still 404 (poll recovers)

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Over-mocking hides real bugs | Use real package-store temp roots where possible |
| Suite flakiness | No wall-clock waits |

## Security Considerations

- Reconcile remains destructive cleanup — tests must not weaken identity checks.

## Todo

- [x] Tests Before CP1–CP5
- [x] DI seams if missing
- [x] Full suite
- [x] Regression gate
