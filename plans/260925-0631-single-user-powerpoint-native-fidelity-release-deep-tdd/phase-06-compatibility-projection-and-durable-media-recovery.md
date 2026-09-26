---
phase: 6
title: 'Compatibility Projection and Durable Media Recovery'
status: pending
priority: P0
effort: '10-15 engineer-days'
dependencies: [5]
---

# Phase 6: Compatibility Projection and Durable Media Recovery

## Context Links

- [Plan overview](./plan.md)
- [Phase 5: single-user operational hardening](./phase-05-single-user-operational-hardening.md)
- `C:\Work\NavSlidesEditor\plans\260810-0921-verified-production-readiness-remediation-deep-tdd\phase-05-pptx-compatibility-receipts-and-compensation.md`
- `C:\Work\NavSlidesEditor\plans\260810-0921-verified-production-readiness-remediation-deep-tdd\phase-06-pptx-durable-media-recovery.md`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-view.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-outbox.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\import-commit.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\media-dedup.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import.js`
- `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`

## Goal

Consume and supersede the still-open compatibility-compensation and durable-media
work from the 260810 plan. Make `presentations.json` an exactly receipted,
repairable projection of current package authority and make imported media owned
by the existing durable package job from first staged byte through finalize,
rollback, and restart recovery. Reuse Phase 5's workflow-neutral physical media
placement ownership primitive, require exact receipts for both compatibility and
media repair/dead-letter disposition, and degrade readiness when convergence is
not proven without introducing a competing state machine.

## Scope / Non-goals

### In scope

- Exact per-write compatibility outcomes and target receipt consumption.
- Dead-letter reprojection from the current package-authoritative head, never from
  stale serialized payloads.
- Durable import visibility/compensation states inside existing package-store
  state.
- Durable PPTX media manifests owned by existing import jobs.
- Reuse of Phase 5's single low-level media placement primitive for exact
  file/hash-index transitions and ownership receipts.
- Exact, immutable repair receipts for compatibility dead letters and media
  recovery attempts.
- Ordered startup recovery: media, compatibility, compensation, then ready.
- Readiness degradation for unresolved projection/media reconciliation.
- Migration of every production compatibility drain caller from count-based
  assumptions to exact target outcomes.

### Non-goals

- A second outbox, second package state root, separate media database, generic
  saga framework, or external queue.
- A PPTX-specific physical file/hash ownership engine or workflow state inside the
  shared placement primitive.
- Making `presentations.json` package authority.
- Legacy media garbage collection or global reference counting.
- Physical package-blob GC; first-release quarantine/audit policy remains.
- G0 matrix evolution, lifecycle replay isolation, or OfficeCLI; Phases 7-8 own
  those gates.

## Key Insights

- `drainPackageCompatibilityOutbox()` currently returns only an applied count.
  A target write can dead-letter while unrelated writes make the count positive.
- Dead letters preserve the original write payload. Replaying that payload can
  resurrect a stale projection after a newer package head exists.
- Package publication currently marks an import job completed before exact
  compatibility visibility and before durable imported-media finalization.
- `media-dedup.js` writes final public files and global hash entries immediately.
  Process-memory rollback cannot recover a crash after file/hash mutation.
- The package store already owns jobs, leases, heads, outbox, dead letters, WAL,
  and startup writer ownership. Extending it is safer than creating parallel
  workflow state.
- Data and uploads may be distinct Docker volumes, so cross-volume atomic rename
  is impossible. Correctness requires durable intent plus idempotent recovery,
  not pretending publication is atomic across volumes.
- Phase 5 owns the only physical placement primitive. Phase 6 must not recreate
  stage/promote/hash-index/rollback logic in `media-dedup.js` or recovery code;
  the package job remains the sole durable PPTX workflow and consumes primitive
  receipts.

## Requirements

### Exact compatibility receipts

1. Every drained write returns one immutable outcome:
   `applied`, `stale`, `already-applied`, `already-absent`, or `dead-lettered`.
2. Each outcome binds `writeId`, operation, presentation ID, lifecycle/generation
   available at this phase, expected head hash, observed head hash/generation,
   effect, stable reason code, and timestamp.
3. A caller may claim success only when its exact target write is
   `applied`/`already-applied` or an exact removal is `already-absent`.
4. Zero writes, unrelated successes, stale outcomes, or target dead letters never
   satisfy visibility.
5. Apply-success/ack-failure stays retryable and produces one projection row.
6. All production drain callers explicitly declare target-write policy.
7. Every compatibility repair attempt emits an immutable receipt that binds
   repair attempt ID, dead-letter ID, superseding write ID, current authority
   subject/hash, exact drain outcome, terminal disposition, stable reason code,
   and timestamp. A dead letter is terminally `repaired` only from that exact
   target outcome.

### Authority-based dead-letter reprojection

8. Repair never replays the dead-letter payload. It loads the current package
   head plus current canonical projection and emits a new compatibility write.
9. Reprojection carries `supersedesDeadLetterId`, current head hash/generation,
   and a new deterministic write ID.
10. Missing/malformed current authority, lifecycle ambiguity, or projection/hash
    mismatch remains `reconcile-required`; no stale row is published.
11. A repaired dead letter is retained as bounded history with its exact repair
    receipt; it is not silently deleted, count-acknowledged, or inferred repaired
    from queue absence.

### Durable media ownership

12. Before the first imported media byte is written, the existing durable import
    job records a bounded media manifest/lease.
13. New files stage under
    `<SLIDES_UPLOADS_DIR>/.pptx-import-staging/<jobId>/`; reused files are recorded
    but never owned.
14. Each record binds kind, SHA-256, byte length, MIME/extension, original name,
    safe relative staging key, final filename/URL, owner identity, and ownership
    state.
15. All physical stage/reuse/elect/promote/hash-index/rollback operations call the
    Phase 5 `media-placement-ownership` primitive. The primitive returns exact
    immutable receipts; it does not read or transition package jobs.
16. Every media receipt binds operation ID, owner ID/kind, requested hash/length,
    staging/final relative keys, prior and resulting ownership state, exact file
    effect, exact hash-index effect, verification result, and stable reason code.
    Package job recovery may advance only after consuming its exact receipt.
17. Package publish binds the manifest while the job remains nonterminal.
18. Finalization verifies bytes, promotes to final paths, updates the existing
    upload hash index exactly, and is idempotent across every crash boundary.
19. Compatibility visibility occurs only after media state is `finalized`.
20. Rollback removes only exact manifest-owned files and exact matching hash
    records. Reused and unknown files survive.
21. Same-hash concurrent jobs deterministically elect one owner through the shared
    primitive; losing jobs consume a `reused` receipt before terminal state.
22. Static serving denies staging and quarantine namespaces.
23. Legacy jobs/media without manifests are not inferred, swept, or deleted.
24. There is one PPTX state machine: `state.jobs[].mediaManifest`. The shared
    primitive may keep bounded idempotency/ownership records required for exact
    file/hash transitions, but no `pending/finalizing/completed` PPTX workflow,
    alternate outbox, or autonomous cleanup worker.

### Recovery and readiness

25. Startup under the package-store writer runs, in order: durable media recovery,
    compensation recovery, current-authority dead-letter reprojection, normal
    outbox drain, bounded stale-stage sweep.
26. Every recovery step records its exact media or compatibility repair receipt
    before changing the package job/dead-letter disposition. Missing, ambiguous,
    unrelated, or count-only receipts do not prove repair.
27. Recoverable work keeps readiness `503` until convergence.
28. Unrecoverable exact mismatch becomes durable `reconcile-required`; liveness
    remains `200`, readiness remains degraded, original recovery remains available.
29. Public import DTOs expose stable status/code only, not paths, hashes,
    manifests, capabilities, or low-level receipts.

## Architecture / Data Flow

### Structured drain result

```js
{
  attempted: 2,
  acknowledged: 1,
  outcomes: [{
    writeId,
    operation: 'upsert' | 'remove',
    presentationId,
    expectedGeneration,
    expectedHeadHash,
    status: 'applied' | 'already-applied' | 'already-absent' |
            'stale' | 'dead-lettered',
    effect: 'changed' | 'none',
    reasonCode
  }]
}
```

### Additive existing-store state

```js
job.compatibility = {
  targetWriteId,
  state: 'pending' | 'visible' | 'compensating' | 'rolled-back' | 'reconcile-required',
  compensationWriteId,
  reconciliationCode,
}

job.mediaManifest = {
  schemaVersion: 1,
  state:
    'owned' |
    'staged' |
    'finalizing' |
    'finalized' |
    'rolling-back' |
    'rolled-back' |
    'reconcile-required',
  records: [/* bounded records */],
  totalNewBytes,
  lastPlacementReceiptIds: [/* bounded exact operation receipts */],
}
```

No new top-level store. These fields live in `state.jobs[]`; outbox and dead
letter remain the existing `state.compatibilityOutbox` and
`state.compatibilityDeadLetter`.

### Import order

```text
durable import job + media owner/lease
  -> shared placement primitive stage/reuse -> exact receipt
  -> publish R0/head/projection + bound media manifest + target write ID
  -> shared placement primitive finalize exact media/hash entries -> exact receipt
  -> media state finalized
  -> drain exact compatibility write
  -> exact applied receipt
  -> terminal completed/done
```

### Dead-letter repair

```text
dead letter
  -> read current package head
  -> load exact current projection/source-map authority
  -> verify head/projection binding
  -> enqueue fresh upsert/remove superseding dead letter
  -> drain target and record exact outcome + exact repair receipt
  -> repaired OR reconcile-required
```

### Rollback

```text
persist compensating intent
  -> suppress/remove pending upsert
  -> shared placement primitive rollback manifest-owned media
  -> consume exact rollback receipts
  -> remove package authority under exact outcome identity
  -> enqueue fenced compatibility removal
  -> exact removal receipt
  -> rolled-back OR reconcile-required
```

## Absolute Deep File Inventory

| Action | Absolute path                                                                                  | Planned change                                                                             | Mechanical proof       |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-view.js`                    | Return exact outcomes; enforce generation/head/lifecycle fences                            | View tests             |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-outbox.js`                  | Target IDs, supersession metadata, exact acknowledge semantics                             | Outbox tests           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-outbox.test.js`             | Mixed, ack fault, stale, removal matrix                                                    | Focused Vitest         |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-reprojection.js`            | Rebuild projection writes from current package authority                                   | Unit/integration tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-reprojection.test.js`       | Reject stale payload replay and prove repair                                               | Focused Vitest         |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-compatibility-coordinator.js`      | Visibility, compensation, recovery orchestration                                           | Fault tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-compatibility-coordinator.test.js` | Exact receipt and restart matrix                                                           | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime.js`                 | Structured drain; ordered recovery; readiness degradation                                  | Runtime tests          |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime-lock-order.test.js` | Preserve package/presentation lock ordering                                                | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\schemas.js`                 | Validate additive compatibility/media/recovery fields                                      | Store tests            |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\state-migrations.js`        | Load legacy jobs unchanged; no guessed manifests                                           | Migration tests        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\import-commit.js`           | Nonterminal publish, target write identity, compensation intent                            | Store tests            |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\package-store.test.js`      | Schema, exact state, crash boundaries                                                      | Store gate             |
| Modify | `C:\Work\NavSlidesEditor\server\services\media-placement-ownership.js`                         | Reuse Phase 5 primitive; add only generic receipt/idempotency seams needed by package jobs | Shared regressions     |
| Modify | `C:\Work\NavSlidesEditor\server\services\media-placement-ownership.test.js`                    | Cross-caller owner isolation, exact receipt and same-hash election cases                   | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\media-dedup.js`                           | Thin package-job adapter over shared stage/reuse receipts; no physical state machine       | Media tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-media-recovery.js`                 | Package-job finalize/rollback/recovery orchestration consuming exact primitive receipts    | Fault tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-media-recovery.test.js`            | Receipt/file/hash/restart/same-hash/no-second-state-machine matrix                         | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\media.test.js`                            | Durable versus ephemeral transactions                                                      | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\importer.js`                              | Thread durable job/media session                                                           | Importer tests         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mapper\map-image.js`                      | Consume staged media result                                                                | Mapper tests           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mapper\map-media.js`                      | Consume staged/reused media result                                                         | Mapper tests           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-validator.js`             | Keep explicit private ephemeral media mode                                                 | Validator tests        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-validator.test.js`        | Prove no durable/public media side effects                                                 | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import.js`                                         | Reorder publish/finalize/receipt/complete and cancellation                                 | Route tests            |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import.test.js`                                    | Exact target receipt cases                                                                 | Route gate             |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import-crash-points.test.js`                       | Child-process media/compatibility crash matrix                                             | Crash gate             |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import-durable-job.test.js`                        | Withhold listability until media+receipt proof                                             | API gate               |
| Modify | `C:\Work\NavSlidesEditor\server\routes\presentations.js`                                       | Consume exact receipts on package save/delete/duplicate paths                              | Route tests            |
| Modify | `C:\Work\NavSlidesEditor\server\routes\presentations.test.js`                                  | Target dead-letter/no-false-2xx cases                                                      | Route gate             |
| Modify | `C:\Work\NavSlidesEditor\server\routes\history.js`                                             | Consume exact receipt on restore                                                           | History tests          |
| Modify | `C:\Work\NavSlidesEditor\server\routes\history-restore-snapshot.test.js`                       | Restore target receipt policy                                                              | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\routes\history-package-lock-order.test.js`                     | Lock-order regression                                                                      | Focused Vitest         |
| Modify | `C:\Work\NavSlidesEditor\server\services\health-state.js`                                      | Accept durable projection/media degradation signals                                        | Health tests           |
| Modify | `C:\Work\NavSlidesEditor\server\index-health.test.js`                                          | Ready=503 on unresolved reconciliation                                                     | Integration gate       |
| Modify | `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`                                  | Exact visibility/media/recovery contract                                                   | Docs tests             |
| Modify | `C:\Work\NavSlidesEditor\docs\deployment-guide.md`                                             | Degraded readiness/operator recovery                                                       | Docs tests             |

## Tests Before (RED)

1. Empty drain returns success to an import completion path.
2. Unrelated applied write plus target dead letter marks the target done.
3. Apply succeeds, acknowledgement faults, retry duplicates the row.
4. Dead-letter repair replays an older serialized presentation over a newer head.
5. Cancellation after package publish leaves a ghost compatibility row.
6. Crash after final media rename but before hash-index write leaves an unowned file.
7. Crash after hash-index write but before job state leaves visible media without
   durable ownership.
8. Reused media is deleted by rollback.
9. Two jobs with the same hash both believe they own the final file.
10. Startup drains compatibility before finalizing media.
11. Durable GET exposes `presentationId` while media is staged/finalizing.
12. Legacy jobs are swept because they lack a manifest.
13. Native re-import writes durable/public media state.
14. Readiness remains `200` with dead-letter or media `reconcile-required`.
15. PPTX recovery duplicates Phase 5's hash-index/file ownership logic and the two
    implementations diverge at a crash boundary.
16. A media job advances on a count/truthy result or a receipt belonging to a
    different owner/operation.
17. A dead letter disappears from the queue and is marked repaired without an
    exact current-authority superseding-write receipt.
18. The shared placement primitive grows an autonomous PPTX finalizing/completed
    state machine that competes with `job.mediaManifest`.

## Numbered Implementation

1. Port the exact receipt contract from old Phase 5 into tests, updated for current
   schema v2 and current package authority.
2. Change compatibility application and runtime drain to return structured outcomes.
3. Migrate every production drain invocation to exact target receipt consumption.
4. Persist the import target write ID and compatibility state in the existing job.
5. Add current-authority reprojection and exact repair receipts; prohibit
   dead-letter payload replay or inferred/count-only repair.
6. Add durable compensation intent and exact fenced removal.
7. Extend Phase 5's low-level placement primitive only with generic exact receipt
   seams needed by durable jobs; keep it workflow-neutral.
8. Port old Phase 6 media manifest tests; make package-job ownership durable before
   first byte and consume only owner/operation-matched primitive receipts.
9. Change media dedupe into a thin adapter that stages new files and describes
   reused records through the shared primitive.
10. Bind the bounded media manifest at import publication while job/head remain
    nonterminal for public visibility.
11. Implement idempotent finalize and same-hash ownership election by consuming
    exact shared-primitive receipts.
12. Implement exact rollback and startup recovery; fault every file/hash/receipt/
    package-state edge and reject unrelated receipts.
13. Add an architecture test proving one compatibility outbox/dead-letter set, one
    package media state machine, and one physical placement primitive.
14. Order startup recovery before normal outbox visibility and readiness.
15. Preserve native re-import's private ephemeral media scope.
16. Wire readiness degradation and bounded operator reason codes.
17. Update docs and remove the old plans' work from future active ownership; they
    remain historical context only.

## Refactor

- One compatibility outbox, one dead-letter index, one package store.
- One imported-media package-job recovery module and one shared physical placement
  primitive; no route-local cleanup algorithms or duplicate file/hash engines.
- Keep file/hash transitions replayable rather than simulating cross-volume
  transactions.
- Keep public DTOs free of internal manifests and paths.
- Split orchestration from the already large PPTX route.

## Tests After (GREEN)

- Target write proof is mandatory for every package-backed 2xx visibility claim.
- Dead letters repair only from exact current package authority and retain the
  exact superseding-write repair receipt.
- All media crash boundaries converge to finalized, rolled-back, or
  reconcile-required.
- Every package media transition consumes an exact owner/operation-matched
  placement receipt from the Phase 5 primitive.
- A presentation is never listable before final media and exact compatibility proof.
- Readiness is degraded for unresolved durable reconciliation.
- Legacy/reused media remains untouched.

## Scenario Matrix

| Scenario                                | Expected state             | Visibility/readiness         |
| --------------------------------------- | -------------------------- | ---------------------------- |
| Target upsert applied                   | compatibility visible      | done / ready                 |
| Target stale                            | reconcile-required         | hidden / not-ready           |
| Target dead-lettered                    | reconcile-required         | hidden / not-ready           |
| Apply then ack crash                    | retryable pending          | hidden / not-ready until ack |
| Current-authority reprojection succeeds | repaired                   | visible / ready              |
| Dead-letter payload older than head     | payload ignored            | current projection only      |
| New media staged, crash before publish  | stale owner rollback       | hidden                       |
| Manifest published, crash before rename | startup finalize           | hidden until finalized       |
| Rename done, hash missing               | startup inserts exact hash | hidden until finalized       |
| Hash exists, state not finalized        | startup verifies/no-op     | hidden until finalized       |
| Reused media rollback                   | rolled-back                | reused file survives         |
| Same hash, two jobs                     | one owner, one reused      | both converge safely         |
| Receipt belongs to another owner/op     | reconcile-required         | no package-state advance     |
| Final file wrong hash                   | reconcile-required         | hidden / not-ready           |
| Compensation meets newer head           | reconcile-required         | newer head preserved         |
| Legacy job without manifest             | legacy semantics           | no sweep/inference           |
| Native validator media                  | ephemeral cleanup          | no durable manifest          |

## Regression Commands

```powershell
npx vitest run server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/compatibility-reprojection.test.js server/services/pptx-import/import-compatibility-coordinator.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js
npx vitest run server/services/media-placement-ownership.test.js server/services/pptx-import/import-media-recovery.test.js server/services/pptx-import/media.test.js server/services/pptx-import/native-reimport-validator.test.js server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/legacy-state-migration.test.js
npx vitest run server/routes/pptx-import.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import-crash-points.test.js server/routes/presentations.test.js server/routes/history-restore-snapshot.test.js server/routes/history-package-lock-order.test.js server/index-health.test.js
npm run test:pptx:best-effort
npm run test:pptx:adversarial
npm run lint
```

Mechanical gate: fault-injection tests must inspect the reopened package state,
physical staging/final files, `upload-hashes.json`, `presentations.json`, and
`/health/ready`. The architecture test must also prove no second media ownership
engine/state machine. In-process mocks alone cannot close the phase.

## Todos

- [ ] Write structured receipt RED tests.
- [ ] Return and consume exact target outcomes.
- [ ] Implement current-authority dead-letter reprojection.
- [ ] Persist exact compatibility dead-letter repair receipts.
- [ ] Persist compatibility compensation state.
- [ ] Write durable media manifest/restart RED tests.
- [ ] Reuse the Phase 5 placement primitive and exact ownership receipts.
- [ ] Stage imported media under the one durable package-job state machine.
- [ ] Implement finalize/rollback/same-hash recovery.
- [ ] Prove no competing media/outbox/dead-letter state machine exists.
- [ ] Order startup recovery and readiness degradation.
- [ ] Preserve native validator ephemeral mode.
- [ ] Run focused, PPTX, adversarial, health, and lint gates.

## Success Criteria

- [ ] Count-only compatibility success is absent from production callers.
- [ ] Dead-letter repair cannot publish a historical payload.
- [ ] Every repaired dead letter retains an exact current-authority superseding-write receipt.
- [ ] Exact compatibility write IDs and outcomes gate import completion.
- [ ] Failed compensation is durable and visible as reconcile-required.
- [ ] Every new imported media file is owned before first write and recoverable after restart.
- [ ] Every media transition consumes an exact owner/operation-matched receipt from the shared primitive.
- [ ] Rollback cannot delete reused, legacy, foreign, or hash-mismatched media.
- [ ] Startup recovery precedes projection visibility.
- [ ] Durable/public job state withholds done/presentation ID until both proofs pass.
- [ ] Readiness degrades on unresolved projection or media state.
- [ ] No second outbox/store/workflow database exists.
- [ ] No PPTX-specific duplicate physical placement engine or competing media state machine exists.
- [ ] All regression commands pass.

## Risks with Signals / Responses

| Risk                                         | Observable signal                                | Pre-decided response                                                                  |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Rich receipt breaks implicit numeric callers | test expects number/truthiness                   | Migrate caller explicitly; no coercion compatibility shim                             |
| Dead-letter repair uses stale payload        | repaired row hash differs from current authority | Stop release; delete replay path, rebuild from head                                   |
| Lock inversion                               | history/package test hangs                       | Preserve package intent -> release -> presentation RMW -> package acknowledgement     |
| Cross-volume rename assumption               | `EXDEV` or partial file/hash state               | Use copy/verify/final rename within uploads volume plus durable intent                |
| Same-hash owner race                         | either rollback removes shared file              | Elect ownership under canonical hash-index lock before terminal state                 |
| Shared primitive and PPTX adapter diverge    | same fault yields different file/hash state      | PPTX adapter delegates physical transitions and consumes exact primitive receipts     |
| Receipt confused across jobs                 | unrelated job advances                           | Bind owner/operation/hash/path; mismatch becomes reconcile-required                   |
| Startup loops poison forever                 | repeated repair attempts each boot               | Persist reconcile-required and stop automatic retries                                 |
| Readiness outage is too broad                | healthy non-PPTX reads blocked                   | Keep liveness and original recovery; readiness truthfully blocks new mutation traffic |
| Legacy media swept                           | pre-manifest file disappears                     | Never infer ownership; only manifest-owned records are mutable                        |

## Security

- Validate every persisted relative path and reject links/reparse escapes at stage,
  finalize, rollback, and recovery.
- Dead-letter diagnostics are bounded and content-free.
- Hash equality is necessary but ownership identity is also required for deletion.
- Exact receipts are server-only authority evidence; reject caller-supplied,
  unrelated, replayed-with-different-subject, or count-only outcomes.
- Staging/quarantine paths are never statically served.
- Job capabilities remain hashed; media manifests and compatibility receipts are
  server-only.
- Original download remains available when projection/media repair is blocked.

## Next Steps

Phase 7 builds G0 on this convergent storage base: immutable lifecycle identity,
current matrix authority, atomic authority reissue/invalidation, exact
source-map/head/journal/capability binding, and candidate-blob recovery.
