---
phase: 9
title: 'Native re-import and transactional publication'
description: 'Close the production edited-package transaction with strict whole-projection re-import, live abort propagation, proven process drain/cleanup, durable leases/jobs/residuals, and one atomic package-state publication.'
status: pending
priority: P0
effort: '6-8 weeks'
issue: null
branch: master
dependencies: [7, 8]
gates: [G2-foundation]
tags: [backend, api, pptx, native-fidelity, transactions, durability, security, tdd]
created: 2026-09-25
---

# Phase 9: Native Re-import and Transactional Publication

## Context

- Phase 7 supplies one canonical matrix authority and immutable package-head model.
- Phase 8 supplies the direct qualified OfficeCLI validation lane. This phase consumes it; it does not create a second process gateway.
- Current transaction owner: `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-transaction-execution.js`.
- Current package state-root owner: `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\state-store.js`.
- Current native validator checks only journal text and stable provenance. It does not prove the complete expected projection/source map or native collateral closure.
- Current cleanup can quarantine a workspace locally, but quarantine/residual ownership is not durable and no bounded sweeper exists.
- Current edited-export route is synchronous. `export-job-state.js` models states but does not own durable execution.
- Current candidate blobs can survive a publication loser. Physical deletion is intentionally disabled, so a narrowly safe loser collector is still missing.

## Goal

Produce one reusable production transaction pipeline:

```text
durable request + exact head
  -> short atomic lease/job publication
  -> private candidate staging
  -> adapter application
  -> ZIP/OPC/security/OfficeCLI validation
  -> strict native full-projection/source-map re-import
  -> byte impact + semantic collateral proof
  -> short atomic successor publication
  -> durable async status/download/replay
```

Any uncertainty leaves the current immutable package head visible and returns a registered fail-closed reason.

## Scope

- Strict native re-import against the complete canonical expected projection.
- Complete source-map key/cardinality/provenance comparison.
- Exact byte-level touched-part and semantic impact/collateral proof.
- Durable native-workspace residual/quarantine records and bounded sweeper.
- Runtime export leases pinned to one immutable base revision/head/matrix subject.
- Atomic state-root publication of revision, head, source map, journal, owner, lease release, and job outcome.
- Lifecycle-safe cleanup for staging files and unreferenced publication-loser blobs.
- Durable asynchronous create/status/cancel/download edited-export jobs.
- Request-hash idempotency, restart recovery, quotas, retention, and cancellation point-of-no-return.
- One live `AbortController` per admitted execution, propagated through every adapter, OfficeCLI process, native importer worker, validator, and cleanup boundary.
- Cancellation drain receipts proving child-process exit, validator settlement, rollback, workspace cleanup/quarantine handoff, and lease/candidate reconciliation before any terminal cancellation response.
- Compatibility shim for the existing `/pptx-edited` endpoint, backed by the same job service only.

## Non-goals

- No new OOXML mutation engine or alternate package store.
- No new feature row promotion. Phase 10 proves physical G2; Phases 11-12 promote exact G4 rows.
- No Microsoft PowerPoint/G5 claim.
- No broad package garbage collector. Collection is limited to proven transaction losers/residuals.
- No remote queue, multi-user account model, or distributed worker cluster.
- No assumption that OfficeCLI success proves semantic fidelity.

## Key Insights

1. Native validation must compare the entire canonical result, not only changed journal values.
2. Source hashes may change only for exact touched native objects. Stable provenance and all untouched refs must remain exact.
3. OPC impact and semantic impact are separate gates; both must pass.
4. A candidate blob made visible before head publication needs durable loser ownership until safely collected.
5. A lease is a state-root record, not an in-memory mutex. Long parser/OfficeCLI work must run outside the metadata publication lock.
6. Cancellation after `committing` cannot promise rollback. The durable idempotency outcome is authoritative.
7. Cleanup failure is transaction state. Logging an orphan path is not cleanup.
8. Restart recovery must inspect durable state and either resume from immutable inputs or fail retry-safe; it must never infer success from temp files.
9. A durable `cancelRequestedAt` flag is not cancellation completion. The same live signal must reach every process-owning layer, and `cancelled` is terminal only after a drain receipt proves no child, validator, workspace, lease, or candidate remains unaccounted for.

## Requirements

### Functional

- Native re-import receives `expectedProjection`, `expectedSourceMap`, compiled plan, matrix subject, base identity, and candidate identity.
- Canonical imported projection equals expected projection after only row-owned normalization.
- Source-map comparison proves:
  - identical key set and entry count;
  - identical presentation/revision/generation binding expected for the candidate;
  - untouched entries byte-equivalent after canonical serialization;
  - touched entries retain stable native identity, relationship chain, ancestry, occurrence path, kind, and authoritative status;
  - only expected touched source hashes change.
- Byte impact proves the candidate changed no undeclared OPC part and introduced/deleted no undeclared part or relationship.
- Semantic impact proves no property outside journal `affectedProperties` changed.
- A durable export lease pins presentation, base revision, generation, matrix epoch/hash, journal hash, job ID, fencing epoch, and expiry.
- Job states survive restart: `queued`, `running`, `committing`, `completed`, `failed`, `cancelled`.
- `cancelling` and `cleanup-pending` are nonterminal states. Terminal states remain `completed`, `failed`, and `cancelled`.
- Transaction states remain monotonic: `requested -> leased -> staged -> validated -> committing -> committed`.
- Same idempotency key + same request hash returns one job/outcome. Same key + different hash returns conflict.
- Cancellation before `committing` aborts and releases the lease. Cancellation at/after `committing` returns `commit-in-progress` or committed outcome.
- Admission creates exactly one live `AbortController` for each running attempt. Its `signal` is passed by object identity through `export-job-worker -> mutation transaction -> primitive/chart adapter -> layered validators -> staged OfficeCLI gateway/bounded runner -> native re-import -> importer/parser worker/media transaction`.
- No layer may replace the signal with a Boolean snapshot such as `request.cancelled`, create an unrelated controller without linking the parent signal, or swallow `AbortError`/registered cancellation codes.
- Every long-running layer checks `signal.throwIfAborted()` before work, after each awaited external/process step, and before returning success.
- `DELETE` records `cancelRequestedAt` and returns nonterminal `202 cancelling`; it does not return `cancelled`. The worker may publish terminal `cancelled` only after a durable drain receipt proves:
  - all OfficeCLI and parser/import child processes emitted `close`, not merely `exit` or a sent kill signal;
  - all validator/adapter promises settled and their child registries are empty;
  - media rollback/commit reached a known state;
  - staging/native workspaces were removed or atomically quarantined with a durable residual owner;
  - candidate blob ownership was discarded or converted to a durable loser residual;
  - lease/quota reservations were released in the same state-root mutation that publishes the terminal result.
- If drain or cleanup cannot be proven within the bounded grace period, keep `cleanup-pending` and return `CANCELLATION_DRAIN_UNPROVEN`/`CANCELLATION_CLEANUP_PENDING`; recovery/sweeper owns reconciliation. Never misreport terminal cancellation.
- Publication writes all successor authority and terminal job state in one package state-root mutation.
- Compatibility JSON remains an outbox projection, never package authority.
- Durable residuals cover workspace cleanup failure, quarantine failure, stale staging, and candidate-blob losers.
- Sweep is bounded by age/count/bytes, hash verifies every target, and never deletes owned/revisioned/leased/job-referenced bytes.

### Non-functional

- No metadata mutex held during ZIP copying, adapter work, OfficeCLI, native import, or hashing.
- Per-job and store-wide byte/job quotas reject before staging.
- Job and residual records have bounded diagnostics; no slide text, raw XML, private path, or capability plaintext.
- Terminal idempotency outcomes retained for 30 days; expiry semantics explicit.
- All non-success exits include current registered `reasonCodes` and `reasonCodeSubject`.

## Architecture and Data Flow

### Durable job admission

1. `POST /api/presentations/:id/pptx-edited-exports`.
2. Validate headers before state reads: `Idempotency-Key`, `If-Pptx-Generation`.
3. Resolve current server-owned pending projection/journal; derive canonical request hash.
4. In one short state-root mutation:
   - create/replay durable export job;
   - create export lease and job owner;
   - bind exact base/head/matrix/journal;
   - reserve quota.
5. Return `202`, job DTO, and one control capability outside the URL.

### Worker

1. Read immutable leased base bytes.
2. Recheck lease/head/matrix/fencing predicates.
3. Stage private candidate.
4. Apply existing compiled patch plan and registered adapter with the attempt's live `AbortSignal`.
5. Run recursive ZIP/OPC and active-content checks.
6. Run direct qualified OfficeCLI validation from Phase 8 with the same signal through `probeCapability`, gateway, launcher, and bounded child process.
7. Run strict production importer in isolated native workspace with the same signal through parser worker, ZIP/XML/media mapping, and native validators.
8. Compare full canonical projection/source map and prove semantic/byte collateral closure.
9. Content-address candidate and register it as job-owned.
10. Set durable job to `committing`.
11. Reacquire package writer; revalidate every predicate.
12. Publish successor revision/head/authority/owner/job outcome and release lease in one root.

### Failure and cleanup

- Pre-commit failure: current head unchanged; job terminal; lease released; staging cleanup requested.
- Publication conflict: candidate becomes a durable loser residual, never a revision.
- Workspace cleanup failure: residual record points to an opaque workspace ID, not a public path.
- Sweeper claims one residual under writer authority, performs bounded filesystem work, then records completion/failure.
- Crash during sweep uses `pending -> claimed -> removed|quarantined|retryable-failed`; no unrecorded unlink.

### Cancellation and drain protocol

1. `export-job-service` owns one runtime attempt record `{ jobId, attemptId, controller, drainPromise }`; durable state stores only hashes/timestamps/state, never the controller.
2. Cancel atomically records `cancelRequestedAt`, moves `queued|running|staged|validated -> cancelling`, then calls that attempt's controller.
3. Linked child controllers are allowed only when parent abort synchronously aborts the child and the parent signal is still passed to APIs that support it.
4. `runBoundedProcess` and `runParserWorker` resolve their drain handles only on `close`; TERM/KILL request or abort acknowledgment is insufficient.
5. Adapter, OfficeCLI, native importer, and layered validator scopes register drain promises before starting work and unregister only after settlement.
6. The worker awaits the aggregate drain, media rollback, cleanup/quarantine handoff, candidate reconciliation, and lease release.
7. One atomic root mutation publishes the cancellation drain receipt hash and terminal `cancelled`. Unproven drain remains `cleanup-pending` for restart recovery.

### Async API

- `POST .../pptx-edited-exports` — create/replay; `202`.
- `GET .../pptx-edited-exports/:jobId` — bounded status/event cursor.
- `DELETE .../pptx-edited-exports/:jobId` — cancel.
- `GET .../pptx-edited-exports/:jobId/download` — terminal bytes only.
- Existing `POST .../pptx-edited` becomes a compatibility wrapper around create/wait/download with a bounded timeout; it never calls the transaction directly.

## Absolute File Inventory

### Modify

| Absolute path                                                                            | Change                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-validator.js`       | Full projection/source-map comparator, impact receipt, residual recorder integration.   |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-workspace.js`       | Opaque workspace IDs, durable cleanup handoff, bounded quarantine metadata.             |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\transactional-export-validators.js` | Ordered structured gates; exact impact and collateral results.                          |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-transaction-execution.js`  | Lease-driven worker, atomic commit, loser registration, cancellation checks.            |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-transaction.js`            | Keep one orchestration facade; expose async worker entry.                               |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\export-job-state.js`                | Durable state transitions, restart and cancellation reconciliation.                     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\schemas.js`           | Versioned export lease/job/residual/candidate-cleanup schemas and quotas.               |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\index.js`             | Atomic lease/job/residual APIs and recovery entry points.                               |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\state-store.js`       | Fault-tested complete-root publication/recovery for new records.                        |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\collector.js`         | Proven-loser/residual collection only; owner/lease/revision/job checks.                 |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\blob-store.js`        | Safe stage discard, quarantine rename, hash-verified loser removal primitives.          |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime.js`           | Startup recovery/sweeper and shutdown worker drain.                                     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\primitive-adapter-registry.js`      | Require adapter `apply(bytes, operation, { signal })`; reject signal-dropping adapters. |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\primitive-ooxml-adapters.js`        | Abort checks around ZIP/XML reads, patching, hashing, and result publication.           |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-chart-adapter.js`            | Same live-signal contract for workbook/cache mutation.                                  |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\staged-validator.js`      | Require signal and pass it to preflight, capability probe, and package validation.      |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway.js`               | Link parent abort, track validation drain, and expose only post-cleanup settlement.     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\bounded-runner.js`        | TERM/KILL escalation and resolve/reject only after child `close`; return drain receipt. |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\importer.js`                        | Require/forward signal across parser, ZIP, mapper, reconciliation, and media stages.    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\worker-runner.js`                   | Await `workerClosed` before cancellation settles; prove kill escalation and IPC drain.  |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\parse-worker.js`                    | Cooperative abort acknowledgment plus bounded shutdown; no post-abort success result.   |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\media-dedup.js`                     | Abort-aware commit/rollback and known-state receipt.                                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\reason-code-contract.js`            | Register cancellation/drain/cleanup failure codes and subjects.                         |
| `C:\Work\NavSlidesEditor\server\services\validated-edited-export.js`                     | Compose durable job service with existing transaction and validators.                   |
| `C:\Work\NavSlidesEditor\server\routes\pptx-edited-export.js`                            | Async create/status/cancel/download handlers and compatibility wrapper.                 |
| `C:\Work\NavSlidesEditor\server\routes\presentations.js`                                 | Mount plural job routes; remove direct synchronous execution.                           |
| `C:\Work\NavSlidesEditor\server\index.js`                                                | Start recovery workers and drain edited-export workers before store release.            |
| `C:\Work\NavSlidesEditor\client\src\utils\api.js`                                        | Async job create/poll/cancel/download with capability header.                           |
| `C:\Work\NavSlidesEditor\client\src\utils\pptx-job-wait.js`                              | Generalize bounded import/export polling without URL capabilities.                      |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-export-actions.js`                         | Save fence, create job, poll, download, cancel, successor generation adoption.          |
| `C:\Work\NavSlidesEditor\package.json`                                                   | Add focused edited-export durability and physical prerequisite scripts.                 |

### Create

| Absolute path                                                                            | Purpose                                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-comparator.js`      | Pure full-projection/source-map/semantic-diff comparator.                                      |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\export-job-service.js`              | Durable admission, worker dispatch, replay, cancellation, restart recovery.                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\export-job-worker.js`               | One worker around the existing transaction engine.                                             |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\residual-sweeper.js`                | Durable bounded workspace/candidate loser sweeper.                                             |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-comparator.test.js` | Complete projection/source-map/collateral RED/GREEN suite.                                     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\export-job-service.test.js`         | Idempotency, restart, cancellation, quota, capability tests.                                   |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\residual-sweeper.test.js`           | Crash-safe cleanup and shared-blob protection tests.                                           |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\export-cancellation-drain.test.js`  | Signal identity, process close, rollback, cleanup, restart recovery, and terminal-truth tests. |
| `C:\Work\NavSlidesEditor\server\routes\pptx-edited-export-job.test.js`                   | Public async route contract tests.                                                             |

### Delete

- None. Remove obsolete direct-call branches only after compatibility tests prove the shim uses the job service.

## RED Tests

Write failures before production changes:

1. Native re-import changes an untouched title, slide order, element property, or element count while edited text matches; validation must fail.
2. Imported source map drops/adds a key, downgrades authority, changes native ID, chain, ancestry, occurrence path, or untouched hash; fail.
3. Candidate changes an undeclared OPC part, relationship, content type, or package entry; fail.
4. Journal declares a part but semantic diff changes another property in that same part; fail.
5. Cleanup remove and quarantine both fail; durable residual exists before validator returns.
6. Restart finds a residual and sweeps it without exposing paths/content.
7. Export starts, presentation is duplicated/deleted/restored, or a newer save publishes; lease prevents wrong-head publication.
8. Candidate blob loses publication race; it is retained as a durable loser and later removed only when unowned/unleased/unreferenced.
9. Same candidate hash becomes owned by another revision before sweep; collector must not unlink it.
10. Same idempotency key/request returns same job across restart; different request conflicts.
11. Cancel before commit yields cancelled/no successor; cancel during commit yields reconcilable `commit-in-progress`.
12. Fault after index/WAL/root/completion exposes complete predecessor or complete successor only.
13. Job capability absent/wrong/placed in URL is rejected.
14. Quota/retention overflow rejects admission without staging or evicting live outcomes.
15. Cancel during adapter execution observes the same signal instance in adapter, OfficeCLI, native importer, parser worker, and every validator.
16. OfficeCLI or parser acknowledges abort but has not emitted `close`; status remains `cancelling`, lease remains owned, and download is unavailable.
17. Child refuses TERM and requires KILL; terminal cancellation is withheld until `close` and workspace cleanup/quarantine proof.
18. Native importer aborts while media rollback or workspace cleanup is pending; status is `cleanup-pending`, never `cancelled`.
19. Cleanup/drain exceeds grace or restart interrupts cancellation; durable recovery resumes reconciliation and returns registered bounded failure state without publishing R1.

## Implementation Steps

1. Version package-state schemas for export jobs, leases, residuals, and cleanup claims; add migration tests before enabling writes.
2. Implement pure full native comparator. Make matrix row normalization an explicit dependency; default is exact equality.
3. Extend native validator to return a structured receipt rather than literal `true`; keep public output redacted.
4. Split validator layers into pure receipts: ZIP/OPC, security, OfficeCLI, native projection, source map, impact, collateral.
5. Add durable residual registration before a cleanup result can be reported as uncertain.
6. Implement bounded sweeper with state claims, age floor, count/byte budget, hash recheck, and no-follow path checks.
7. Extend package store with short atomic `admitExportJob`, `markExportStage`, `publishExportSuccess`, `finishExportFailure`, and cleanup-claim methods.
8. Add export lease acquisition/release. Never hold writer lock during external work.
9. Refactor existing transaction execution to consume the lease snapshot, require a live signal at entry, pass it by identity through adapters/validators/importer, and publish via `publishExportSuccess`.
10. Make candidate commit job-owned before content-addressed visibility; publication loser becomes residual.
11. Build durable job service and in-process bounded worker. Recover nonterminal jobs at startup from immutable request/head data.
12. Add plural async routes and capability transport. Bound status payload/event replay.
13. Convert old synchronous route to the same service with bounded wait; remove direct execution access.
14. Update client API/export action to create, poll, cancel, download, and adopt terminal successor generation.
15. Wire startup recovery and shutdown drain in `server/index.js`.
16. Refactor OfficeCLI and parser runners so abort settlement awaits child `close`; aggregate adapter/validator/process/media cleanup into a durable cancellation drain receipt.
17. Add `cancelling`/`cleanup-pending` recovery and prohibit terminal state or terminal API payload before proven drain and cleanup ownership.
18. Add fault injection at every root/filesystem/process boundary and prove predecessor/successor visibility.
19. Add registered reason codes and contract tests for every non-success branch.

## Refactor

- Keep `createMutationTransactionService().execute()` as the package mutation core.
- Move comparison out of `native-reimport-validator.js`; it should orchestrate importer/workspace/transaction only.
- Move job lifecycle out of route code.
- Keep package state as sole durable authority. In-memory worker maps are caches only.
- Do not broaden collector into general GC.
- Keep compatibility outbox drain after package publication; its failure marks sync pending, not package failure.

## GREEN Tests

- Full projection and full source map compare exactly for the seed edit.
- Allowed touched source hash changes; every untouched source record remains exact.
- Byte and semantic impact receipts list exactly the compiled closure.
- Every validator failure preserves R0/current head and a terminal durable job.
- Restart returns/resumes the same job and same final revision.
- Cancellation semantics match durable transaction state.
- Cancellation reaches adapters, OfficeCLI, native importer, parser worker, validators, and media cleanup through the same live signal; no terminal cancellation appears before process drain and cleanup proof.
- State-root fault matrix exposes no mixed generation.
- Residual sweeper removes only proven losers and records retryable failures.
- Async route never leaks capability in URL/loggable DTO.
- Compatibility shim and new routes produce the same job/revision.

## Scenario Matrix

| Scenario                           | Expected result                                              |
| ---------------------------------- | ------------------------------------------------------------ |
| Exact seed edit                    | Validated candidate can reach committing.                    |
| Full projection collateral drift   | `NATIVE_REIMPORT_PROJECTION_MISMATCH`; no publish.           |
| Source-map key/provenance drift    | `NATIVE_REIMPORT_SOURCE_MAP_MISMATCH`; no publish.           |
| Undeclared part drift              | `IMPACT_CLOSURE_MISMATCH`; no publish.                       |
| OfficeCLI unavailable              | Admission unavailable or job fails before adapter execution. |
| Stale generation during validation | Candidate becomes loser residual; current head wins.         |
| Duplicate idempotent request       | Same durable job/result; no R2.                              |
| Key reused with changed request    | 409 conflict; no work.                                       |
| Cancel while staged                | Job cancelled; lease and staging released.                   |
| Cancel while child still open      | `202 cancelling`; no terminal flag/download; await `close`.  |
| Cancel with cleanup unresolved     | `202 cleanup-pending`; durable residual/recovery owner.      |
| Cancel while committing            | 409 `commit-in-progress`; poll for truth.                    |
| Crash before root replace          | Verified predecessor.                                        |
| Crash after root replace           | Complete successor and completed/recoverable job.            |
| Cleanup double failure             | Durable residual, fail closed.                               |
| Shared candidate hash              | Physical blob retained.                                      |
| Job/residual quota full            | 429/503 typed admission refusal; no staging.                 |

## Exact Failure Responses

| Boundary                                                  | HTTP / durable response          | Required body/state                                                                         |
| --------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Cancel accepted before `committing`                       | `202`                            | `{ state: "cancelling", terminal: false, reasonCode: "CANCEL_REQUESTED" }`                  |
| Child/validator drain not yet complete                    | `202` status                     | `{ state: "cancelling", terminal: false }`; never `cancelled`                               |
| Cleanup ownership recorded but removal/quarantine pending | `202` status                     | `{ state: "cleanup-pending", terminal: false, reasonCode: "CANCELLATION_CLEANUP_PENDING" }` |
| Drain grace exhausted without proof                       | `503` status/read retry response | `CANCELLATION_DRAIN_UNPROVEN`; durable job stays nonterminal/recoverable                    |
| Cancel at/after `committing`                              | `409`                            | `COMMIT_IN_PROGRESS`; client polls authoritative outcome                                    |
| Proven cancellation                                       | `200` status                     | `{ state: "cancelled", terminal: true }` only with cancellation drain receipt hash          |
| Download before `completed`                               | `409`                            | `EXPORT_NOT_COMPLETED`; no bytes                                                            |

## Regression Commands

```powershell
npx vitest run server/services/pptx-import/native-reimport-validator.test.js server/services/pptx-import/native-reimport-containment.test.js server/services/pptx-import/native-reimport-comparator.test.js
npx vitest run server/services/pptx-import/transactional-patch.test.js server/services/pptx-import/export-job-service.test.js server/services/pptx-import/residual-sweeper.test.js
npx vitest run server/services/pptx-import/export-cancellation-drain.test.js server/services/pptx-import/officecli/execution.test.js server/services/pptx-import/officecli/staged-validator.test.js server/services/pptx-import/worker-runner.test.js
npx vitest run server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/state-root-bounded-chain.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js
npx vitest run server/routes/pptx-edited-export.test.js server/routes/pptx-edited-export-job.test.js server/services/validated-edited-export.test.js server/services/validated-edited-export-materialization.test.js
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/hooks/use-export-actions.test.js
npm run test:pptx:package:no-officecli
npm run test:pptx:importer-qualification
npm run lint
npm run test
npm run build
```

Run fault/restart suites with one worker:

```powershell
npx vitest run --maxWorkers=1 --no-file-parallelism server/services/pptx-import/export-job-service.test.js server/services/pptx-import/residual-sweeper.test.js server/services/pptx-import/package-store/package-store.test.js
```

## Todos

- [ ] Add versioned lease/job/residual schemas and migrations.
- [ ] Write full native comparator RED tests.
- [ ] Add strict source-map and semantic collateral proof.
- [ ] Add durable residual recording and sweeper.
- [ ] Add lifecycle-safe candidate loser cleanup.
- [ ] Add async export job service/routes/client.
- [ ] Add restart/idempotency/cancellation/fault tests.
- [ ] Propagate one live abort signal through adapters, OfficeCLI, importer workers, validators, and cleanup.
- [ ] Prove child `close`, validator settlement, rollback, cleanup ownership, and lease release before terminal cancellation.
- [ ] Inventory all non-success reason authority.
- [ ] Run focused, full unit, lint, and build gates.

## Success Criteria

- [ ] Every published edited revision passes complete projection, complete source-map, byte-impact, semantic-collateral, security, OfficeCLI, and native re-import gates.
- [ ] Revision/head/projection/source-map/journal/owner/lease/job outcome publish atomically through one state root.
- [ ] No long-running work holds the metadata publication lock.
- [ ] Export jobs and idempotency outcomes survive restart.
- [ ] Cancellation is truthful around the commit point.
- [ ] `cancelled` is impossible until a durable drain receipt proves all child processes closed and all cleanup/ownership work reached a known state.
- [ ] Cleanup uncertainty always has a durable owner and bounded retry path.
- [ ] No candidate/staging loser is unlinked while owned, revisioned, leased, or job-referenced.
- [ ] Existing transaction/package architecture is reused; no duplicate engine exists.
- [ ] G2 remains open until Phase 10 completes a real physical public-route run.

## Risks, Signals, Responses

| Risk                                         | Signal                                         | Response                                                                                        |
| -------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Importer normalization causes false mismatch | Same candidate fails on stable fields          | Permit only row-versioned normalization; never global ignore lists.                             |
| State root grows from jobs/residuals         | Index size/latency trend                       | Retention/quotas/compaction with protected live records.                                        |
| Cleanup races ownership                      | Blob hash appears in new revision during sweep | Recheck state under claim before rename/unlink; abort on any reference.                         |
| Worker restart loops                         | Repeated attempts for same job                 | Attempt cap and terminal retry-safe reason.                                                     |
| Signal dropped by one layer                  | Cancellation test sees a different/no signal   | Runtime contract assertion plus identity tests at every adapter/validator boundary.             |
| Kill request mistaken for drain              | Terminal state while child handle remains open | Require `close`, child-registry zero, and aggregate drain receipt before terminal publication.  |
| Cleanup stalls after abort                   | Job remains `cancelling` beyond grace          | Move to durable `cleanup-pending`; recovery/sweeper owns it; never claim cancellation complete. |
| Capability disclosure                        | Capability appears in URL/log                  | Header/cookie only; tests scan DTO/routes/log inputs.                                           |
| Publication starvation                       | Long queued writer time                        | External work outside writer; FIFO short commits; admission backpressure.                       |

## Security

- Treat imported PPTX/XLSX/XML and OfficeCLI output as hostile.
- Keep no-follow/reparse checks at every workspace and quarantine transition.
- Store only capability hashes; compare timing-safe.
- Never include raw XML, slide text, absolute paths, executable paths, or capability plaintext in job/residual DTOs.
- Reject macro, signature, encryption/protection, ActiveX, OLE, unknown active content before adapter execution.
- Bound archive bytes, entries, nesting, compression ratio, parser time, worker count, status payloads, and residual retries.
- Local single-user ingress policy remains required; this work does not claim multi-user authentication.

## Dependencies and Next

- Requires Phase 7 matrix/package authority and Phase 8 qualified direct OfficeCLI.
- Phase 10 consumes this exact async public pipeline for physical G2 closure.
- Phase 11 plugs independently promoted primitive rows into this transaction.
- Phase 12 plugs one exact chart/workbook row into the same transaction.
- Phase 15 supplies G3/G5 artifact/PowerPoint evidence; it cannot authorize publication.
