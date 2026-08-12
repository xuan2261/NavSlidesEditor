---
phase: 5
title: "PPTX Compatibility Receipts and Compensation"
status: pending
priority: P1
effort: "4-6 engineer-days"
dependencies: [4]
---

# Phase 5: PPTX Compatibility Receipts and Compensation

## Context Links

- [Plan overview](./plan.md)
- [PPTX reliability research](./research/pptx-reliability-research.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\plan.md`
- `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`

## Overview

Replace count-only compatibility drain success with exact per-write outcomes.
Make import visibility and cancellation compensation durable and idempotent so
false `done`, ghost rows, and unrepairable mid-drain cancellation cannot occur.

## Requirements

### Functional

- Every drain returns an outcome for every attempted write.
- Import package publication returns and persists its exact compatibility write ID.
- `runImport()` calls `completeJob()` only after its exact upsert is `applied`.
- Zero-attempt, stale, missing, dead-lettered, or unrelated-only receipts do not
  satisfy import visibility.
- Apply succeeded but acknowledgement failed remains retryable and does not create
  duplicate presentation rows.
- Cancellation after package publish persists compensation intent before removing
  authority.
- Compensation queues an identity-fenced compatibility removal that cannot delete
  a newer presentation incarnation/generation.
- Cancellation is terminal only after exact removal is applied/already absent and
  package authority is rolled back.
- Failed compensation becomes durable `reconcile-required`; it is never mislabeled
  cancelled, done, or fully rolled back.
- Public serialization maps durable `compatibilityState:'reconcile-required'`
  to the already client-supported wire status `reconcile-required`; persisted
  package job status remains within the existing schema enum.
- Startup resumes pending visibility/compensation idempotently before exposing
  terminal durable results.

### Non-functional

- Preserve public import POST/SSE/GET/DELETE payloads and capability checks.
- Preserve existing fields while adding the already-supported
  `reconcile-required` terminal wire status and stable repair code.
- Preserve package state schema version 1 through additive optional fields.
- Legacy import jobs without new fields load unchanged and keep current fail-closed
  listability semantics.
- Preserve package-store lock ordering. Never hold package mutation serialization
  while writing `presentations.json`.
- No generic saga engine or new database.

## Architecture

### Exact drain receipt

```js
{
  attempted: 2,
  acknowledged: 1,
  outcomes: [{
    id,
    presentationId,
    generation,
    operation: 'upsert' | 'remove',
    status: 'applied' | 'stale' | 'dead-lettered',
    effect: 'changed' | 'already-absent' | 'none',
    code
  }]
}
```

`applyCompatibilityWrites()` returns outcomes. Runtime dead-letter isolation
adds `dead-lettered` outcomes. A failed outbox acknowledgement rejects the drain,
because the write remains retryable.

### Additive durable import fields

```js
{
  compatibilityWriteId,
  compatibilityState:
    'pending' | 'applied' | 'compensating' |
    'rolled-back' | 'reconcile-required',
  compensationWriteId,
  reconciliationCode
}
```

Keep existing `status`, `transactionState`, cancellation point, and outcome
identity for backward compatibility.

### Compensation

```text
begin:
  exact-check job + package head + outcome identity
  persist compatibilityState=compensating
  queue removal {
    presentationId,
    generation,
    compensatesWriteId,
    expectedHeadHash
  }
  remove package authority

drain:
  removal deletes only absent row or exact imported head

finish:
  exact removal receipt -> rolled-back
  mismatch/dead-letter -> reconcile-required
```

Startup recovery first drains active outbox, then:

- `pending`: mark applied only if exact row/head identity is observable; otherwise
  retain pending or mark reconcile-required when matching dead letter exists.
- `compensating`: requeue exact removal and resume.
- `reconcile-required`: expose repair status; retry only through explicit
  reconciliation or bounded operator workflow, not an infinite boot loop.

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-view.js` | Return exact apply/stale/remove outcomes and identity fence | View/outbox tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-outbox.js` | Receipt IDs and fenced removal fields | Outbox tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime.js` | Structured drain/dead-letter receipt | Runtime tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\schemas.js` | Validate optional visibility/compensation fields | Schema/store tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\import-commit.js` | Persist write ID and atomic compensation primitives | Package-store tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-compatibility-coordinator.js` | Exact visibility, compensation, startup recovery | New unit/integration tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-compatibility-coordinator.test.js` | State/race/recovery matrix | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import.js` | Require exact receipt; use coordinator | Route/crash tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import.test.js` | Zero/poison/mixed receipt | Route gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import-crash-points.test.js` | Mid-apply cancel and real restart | Crash gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import-durable-job.test.js` | Durable pending/reconcile status | API gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-outbox.test.js` | Mixed/dead-letter/ack replay | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\package-store.test.js` | Additive schema/fault boundaries | Store gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\presentations.js` | Consume target receipts for package-backed save/delete/restore paths | Route tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\history.js` | Consume target receipt for package-backed restore | History tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\presentations.test.js` | Non-import target receipt policy | Route gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\history-restore-snapshot.test.js` | Restore target receipt policy | History gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\history-package-lock-order.test.js` | Preserve lock ordering | History gate |
| Verify only | `C:\Work\NavSlidesEditor\server\index.js` | Continue awaiting the single runtime initializer | Startup tests |

## Function and Interface Checklist

- [ ] Enumerate all `drainPackageCompatibilityOutbox` callers and count assumptions.
- [ ] Enumerate all `applyCompatibilityWrites` callers/tests.
- [ ] Preserve non-import outbox behavior while returning richer receipts.
- [ ] Migrate all seven production drain invocations. Package-backed save,
  delete/rollback, duplicate/lifecycle and history restore must either prove
  their target write outcome or return a bounded 503/reconcile response.
- [ ] Persist `compatibilityWriteId` from the actual queued record.
- [ ] Define exact `applied` versus `stale` semantics for upsert/remove.
- [ ] Fence compensation by job, presentation, generation and head hash.
- [ ] Keep rollback repeated-call idempotency.
- [ ] Preserve durable job capability and listability withholding behavior.
- [ ] Map reconcile-required consistently across volatile Map/SSE and durable
  GET serializers without adding it to persisted `JOB_STATUSES`.
- [ ] Bound dead-letter metadata and avoid raw diagnostics.
- [ ] Prove lock order with existing lock-order test seam.

## Dependency Map

```text
package publish -> queued write ID -> structured drain receipt
                                 -> mark exact visibility applied
                                 -> volatile done

abort/error -> persist compensation intent + remove authority
            -> fenced compatibility removal
            -> exact receipt
            -> rolled-back OR reconcile-required

startup -> drain outbox -> recover pending/compensating jobs
```

Depends on Phase 4 only as an execution sequencing gate. Phase 6 depends on
this phase's durable import/compensation state. Phase 5 and Phase 6 form one
release unit: do not deploy Phase 5 independently. Existing immediate media
writes remain the temporary prerequisite until Phase 6 replaces their ordering.

## Tests Before (RED)

| Scenario | Expected |
|---|---|
| Drain has no writes | target import not done |
| Mixed batch: unrelated applied, target dead-lettered | target import fails/reconciles |
| Target stale | no done; stable visibility code |
| Apply success, acknowledgement fault | retry produces one row |
| Cancel after real JSON write, before drain settles | no row/head after compensation |
| Cancel before drain | queued upsert removed; compensation converges |
| Crash after apply before ack | restart replay idempotent |
| Crash after compensation intent | restart completes removal |
| Newer row/head present | compensation refuses delete; reconcile-required |
| Repeated reconcile | no-op success after exact rollback |
| Legacy durable job | existing pending/listability behavior |
| Volatile/durable reconcile-required | identical public status/code |
| Package save/delete/history target dead-letter | no false 2xx visibility claim |

Use deferred promises and real temporary package/presentation stores. Do not use
timeouts as race coordination.

## Implementation Steps

1. Write RED compatibility apply/receipt tests.
2. Return structured outcomes from view/outbox/runtime without changing callers yet.
3. Persist the target write ID at package publication.
4. Write RED route tests for zero/mixed/stale/dead-letter outcomes.
5. Require exact target `applied` before Map completion.
6. Write RED mid-drain cancellation and restart tests.
7. Add compensation primitives/coordinator and startup recovery.
8. Migrate all non-import drain consumers to an explicit target-receipt policy.
9. Add durable/volatile API reconcile behavior and lock-order tests.
10. Update lifecycle, error and operations documentation.

## Refactor

- Keep file-store operations replayable rather than pretending they are atomic.
- Add one coordinator, not a general workflow framework.
- Avoid further growth in the 845-line route; move orchestration behind injected,
  testable functions.

## Tests After (GREEN)

- Healthy mixed batches acknowledge all healthy records and isolate poison.
- Import exact write proof is mandatory for immediate done.
- Durable GET still withholds `presentationId` until exact listability.
- Every injected cancellation/crash point converges or exposes reconcile-required.
- No compensation can delete a newer deck incarnation.

## Regression Gate

```powershell
npx vitest run server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js server/services/pptx-import/import-compatibility-coordinator.test.js server/services/pptx-import/package-store/package-store.test.js
npx vitest run server/routes/pptx-import.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import-crash-points.test.js server/routes/presentations.test.js server/routes/history-restore-snapshot.test.js server/routes/history-package-lock-order.test.js
npm run test:pptx:best-effort
npm run lint
```

## Success Criteria

- [ ] Count-only drain success is eliminated from import completion.
- [ ] False `done` reproduction is a deterministic passing regression test.
- [ ] Mid-drain cancel ghost-row reproduction is a passing regression test.
- [ ] Compensation is identity-fenced and restart-safe.
- [ ] Failed repair remains observable as reconcile-required.
- [ ] Legacy durable state and public DTOs remain compatible.
- [ ] All production drain consumers use an explicit target receipt policy.
- [ ] Focused, best-effort and lint gates pass.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| Structured receipt breaks non-import caller | focused caller test expects number | Adapt caller explicitly; no temporary implicit coercion |
| Compensation removes newer row | generation/head mismatch test changes data | Stop release; tighten exact identity fence |
| Dead letter loops startup | repeated boot writes/fails indefinitely | Persist reconcile-required and require explicit retry |
| Crash window remains unowned | fault matrix yields neither terminal nor repair state | Add one durable transition at source; do not add ad hoc cleanup |
| Existing package-first work conflicts | overlapping plan modifies same contract | Keep package-first blocked and rebase after this phase |

## Security and Data Integrity

- Compatibility JSON remains a read model; package state remains authority.
- Fail closed on ambiguous identity or lifecycle.
- Diagnostics and dead letters remain bounded and non-sensitive.

## Todo

- [ ] Write RED receipt and false-success tests.
- [ ] Implement structured drain outcomes.
- [ ] Persist exact write identity.
- [ ] Write RED cancellation/restart fault matrix.
- [ ] Implement durable compensation/recovery coordinator.
- [ ] Run all phase gates and update lifecycle docs.
