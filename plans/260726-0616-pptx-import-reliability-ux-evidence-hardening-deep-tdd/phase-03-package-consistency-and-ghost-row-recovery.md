---
phase: 3
title: "Package Consistency And Ghost Row Recovery"
status: pending
priority: P1
effort: "7-10d"
dependencies: [1]
---

# Phase 3: Package Consistency And Ghost Row Recovery

## Overview

Own the server-side import lifecycle, Contract B, compatibility consistency, durable repair authority, shared-reader isolation, multipart admission, and monotonic job progress. Close the apply/ack/post-visibility failure window without holding package and presentation locks simultaneously or allowing stale compensation to delete a newer incarnation.

## Requirements

- Functional: durable import lifecycle and repair intent are persisted before cross-store side effects and advance through explicit saga states.
- Functional: compatibility projection carries server-only provenance sufficient to fence job/incarnation/write/head identity; equal-generation replacements survive stale repair.
- Functional: `publishImport`, outbox drain, compensation, rollback, and startup replay are idempotent and distinguish apply, ack, media, and repair failures.
- Functional: authoritative visibility is one identity-bound read of package head, expected generation/revision/hash, and projection provenance. Row existence alone is not openability.
- Functional: GET and durable DELETE both hide `presentationId` until the authoritative resolver returns `listable: true`; pending/false/unknown visibility returns `pending-visibility` or `reconcile-required`.
- Functional: in-memory Map status serialization and durable fallback serialization use the same resolver and never leak an ID from a non-listable row.
- Functional: a known missing-head row is classified/quarantined per policy while healthy presentations remain readable. `/api/presentations` remains a bare array; repair metadata uses an additive header or separate diagnostics/repair surface.
- Functional: presentations, explore, bulk sync, and single sync have explicit policies for shared-reader classification; no caller silently loses data.
- Functional: multipart admission has idle/total deadlines, request-abort handling, and exactly-once cleanup/release after body/temp settlement.
- Functional: running progress is monotonic (`max(previous, clampedIncoming)`) with explicit terminal-state rules.
- Functional: cancellation before publication can roll back; after visibility it is `too-late/done` and never removes referenced media/package authority.
- Non-functional: no second compatibility writer; package-store authority remains canonical; existing lock order is preserved.
- Security: sensitive job controls require a per-job capability or verified proxy-principal binding; UUID secrecy alone is not authorization.

## Architecture

```text
reserve admission + durable lifecycle
  -> staged upload/parse/map/report
  -> persist repair intent + package receipt + projection provenance + outbox
  -> apply compatibility batch
  -> acknowledge/replay per-record or explicitly fenced batch
  -> authoritative visibility resolver
  -> durable media finalization policy
  -> in-memory completion

failure after any side effect:
  -> durable saga state
  -> identity-fenced compensation/quarantine
  -> package/projection/media recovery
  -> startup retry or reconcile-required
```

The package writer and presentation writer are serialized independently in the existing order. Never hold the package-store lock while mutating `presentations.json`; instead persist intent, release the package operation, perform the presentation locked RMW, and persist the next saga state. A poisoned outbox record is isolated/dead-lettered for repair rather than preventing server startup.

## Related Code Files

| Action | File/area | Change |
|---|---|---|
| Modify | `server/routes/pptx-import.js` | Admission lifecycle, status/control authority, saga integration, post-visibility cancel policy, durable view resolver |
| Modify | `server/routes/presentations.js`, `server/routes/explore.js`, `server/routes/sync.js` | List isolation and explicit shared-reader policies |
| Modify | `server/services/pptx-import-job-manager.js` | Admission reservation timeout, monotonic progress, durable/terminal lifecycle integration |
| Modify | `server/services/pptx-import/package-store-runtime.js` | Applied/acknowledged identity result, per-record replay/isolation, startup degraded recovery |
| Modify | `server/services/pptx-import/compatibility-outbox.js` | Provenance-bearing upsert/removal payloads and idempotent repair intent |
| Modify | `server/services/pptx-import/compatibility-view.js` | Server-only provenance and conditional locked RMW |
| Modify | `server/services/pptx-import/create-imported-presentation.js` | Sole-writer/provenance-aware removal path; no ID-only delete for repair |
| Modify | `server/services/pptx-import/package-store/import-commit.js` | Durable import receipt, repair states, report summary, identity fence, no newer-head deletion |
| Modify | `server/services/pptx-import/package-store/schemas.js`, `server/services/pptx-import/package-store/index.js`, `server/services/pptx-import/package-store/state-store.js` | Durable lifecycle schema/index/WAL fields and serialized job persistence; lifecycle surface only, not retention compaction |
| Modify | `server/services/pptx-import-job-manager.js`, `server/services/pptx-import/package-store/dto.js` | In-memory Map and durable fallback DTO serialization through the same visibility policy |
| Contract | Direct job-control callers, including Phase-7 oracle adapters | Capability/principal propagation contract; Phase 7 owns oracle fixture adaptation |
| Modify | `server/services/package-backed-presentation-read.js` | Authoritative visibility resolver and bulk classification result |
| Test/create | `server/routes/explore-reader-policy.test.js` | Explore caller policy for quarantined/missing-head rows |
| Test/create | Route, reader, sync, crash/outbox/package-store/job-manager suites | Real failure injection and contract regressions |

`server/services/pptx-import/package-store/import-commit.js` is modified only by this phase. Phase 4 and Phase 6 consume its interfaces.

## Implementation Steps

1. Write green characterization tests for pre-apply failure, apply-success/ack-failure, post-visibility failure, missing-head 422, durable DELETE visibility bypass, startup drain failure, and current ID-only repair behavior.
2. Define a single durable import/repair record with bounded stage/reason data, package receipt identity, job/incarnation token, expected generation/revision/head hash, outbox write identities, media finalization state, `terminalAt`, retention class, failure stage/code, `reconcileRequired`, and bounded `reportSummary`. Do not duplicate authority in an unrelated repair record.
3. Persist `apply-pending`/repair intent before the first compatibility side effect; advance `applied-unacked`, `compensating`, `reconcile-required`, and `resolved` after each durable step. Preserve `reconcile-required` after rollback/compensation failure instead of reporting ordinary `failed`.
4. Add server-only projection provenance or sidecar authority index. Make outbox drain return exact applied/acknowledged identities and make removal a conditional locked RMW. Cover mixed-job batches, equal-generation reincarnation, duplicate compensation, and replay after failed ack.
5. Add one authoritative visibility resolver that reads the expected package head and projection identity. Use it in GET, DELETE, reconcile/repair, and recovery, including both in-memory Map status and durable fallback serialization. `pending-visibility` is returned for false/unknown visibility; no openable ID is emitted.
6. Isolate known missing-head rows for bulk list/explore/sync according to caller-specific policy, preserve healthy rows, and expose bounded repair metadata via array-compatible diagnostics. Keep single-read/editor paths fail-closed.
7. Add per-job capability or verified principal binding to cancel/status/repair routes according to the approved deployment decision. Publish a caller contract covering Home, E2E fixtures, direct API callers, and Phase-7 oracle adapters; when capability mode is selected, every POST response handoff and subsequent SSE/GET/DELETE/repair request carries the capability without persistence/logging. Never export/persist the secret capability itself; Phase 7 owns oracle fixture propagation tests.
8. Add pre-Multer admission idle/total deadlines, `req.aborted`/`req.close` handling, upload-stream destroy, tracked temp cleanup, and exactly-once terminal/release logic. Test zero-byte stall, byte-dribble, disconnect after temp creation, and timeout/callback races.
9. Normalize progress at the job-manager source (`max(previous, clampedIncoming)`) and define terminal 100/cancelled/failed rules.
10. Define media visibility ordering. If durable media manifest/replay is selected, bind staged media to the import receipt and replay commit/rollback on startup. Otherwise keep media cleanup explicitly best-effort and block any crash-safe media-consistency claim.
11. Define post-visibility cancellation as `too-late/done`; never roll back media or package authority referenced by a visible presentation.
12. Add startup retry/dead-letter handling so one poisoned outbox record does not make the package store unavailable. Preserve repair state and expose manual repair status.

## Tests Before

- CP2/pre-apply failure exists; apply-success/ack-failure is not covered.
- Missing package head causes whole-list HTTP 422; no literal 500 assertion is valid for this seam.
- `GET` checks a weak row-existence predicate; durable `DELETE` can serialize without listability.
- Repair/removal fences only presentation ID/generation.
- Multipart reservation occurs before body completion with no scoped body timeout.
- Progress accepts a lower finite value.
- Startup drain failure can prevent normal recovery.
- Media transaction is process-memory only.

## Tests After

- Real package-store + presentations interleave pauses after outbox snapshot and before apply, then aborts and awaits drain/cleanup.
- Ack-after-apply, post-visibility, rollback-failure, and mixed-job batch tests leave durable repair states and no stale-delete path.
- Replaying compensation is a no-op; equal-generation newer incarnation survives.
- GET and DELETE both hide IDs until the same authoritative resolver proves visibility, in both Map and durable fallback DTOs.
- Missing/invalid job capability or verified principal is rejected for every sensitive caller; the selected authority mode is propagated to E2E/oracle callers without secret persistence.
- Healthy rows remain returned; missing-head/quarantine metadata is observable without changing array shape.
- Explore and sync do not silently drop or mislabel quarantined rows; the dedicated Explore policy suite covers its adapter.
- Stalled/disconnected multipart releases the sole slot only after body/temp cleanup settles.
- Progress never regresses; operationPending remains held until child/media cleanup settles.
- Post-visibility cancel returns `too-late/done` and preserves visible media/package authority.
- Startup isolates/retries a poisoned outbox record without taking down unrelated imports.
- Durable media manifest/replay passes, or release evidence explicitly records the narrower best-effort media claim.

## Function / Interface Checklist

- [ ] Durable import/repair record is written before cross-store side effects.
- [ ] Schema/index persist `terminalAt`, retention class, failure stage/code, `reconcileRequired`, and bounded `reportSummary`.
- [ ] Projection provenance is persisted server-side and stripped from external DTOs.
- [ ] In-memory Map and durable fallback DTOs use the same authoritative visibility resolver.
- [ ] Drain reports exact per-record applied/ack identities or an explicitly fenced batch identity.
- [ ] `rollbackImport` and compensation cannot remove a newer head/projection.
- [ ] One authoritative visibility resolver is reused by GET, DELETE and repair.
- [ ] Bulk reader result and caller-specific policies, including Explore, are covered.
- [ ] Array response shape remains compatible; repair health is additive.
- [ ] Job control has capability/principal binding or an explicit deployment block.
- [ ] The selected authority is propagated to Home/E2E/direct/oracle callers and never persisted or logged.
- [ ] Multipart cleanup and progress normalization have one source owner.
- [ ] Media finalization policy is explicit and tested.

## Test Scenario Matrix

| Failure point | Required invariant |
|---|---|
| Before projection apply | Package rollback; no visible row; durable terminal state |
| After apply, before ack | `applied-unacked`; identity-fenced compensation/replay |
| Ack mutation failure | Same as above; unrelated batch records remain recoverable |
| After visibility hook | No stale row/head; repair state remains authoritative |
| Package head missing during list | Healthy rows returned; known row classified; 422 not generalized to 500 |
| Stale/equal-generation incarnation | Newer projection survives compensation |
| Multipart body stalls/disconnects | Request stream/temp settles before slot release |
| Progress event 80 → 70 | Job and client remain monotonic |
| Durable completed pre-drain | `pending-visibility`, no openable ID |
| Cancel after visibility | `too-late/done`; no referenced media deletion |
| Job-control caller omits capability/principal | Reject sensitive operation; no UUID-only fallback |
| Poisoned startup outbox | Isolated retry/dead-letter; service remains recoverable |

## Regression Gate

```bash
npx vitest run server/routes/pptx-import.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import-crash-points.test.js server/routes/presentations.test.js server/services/package-backed-presentation-read.test.js server/routes/explore-reader-policy.test.js server/routes/sync.test.js
npx vitest run server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/package-store-runtime-lock-order.test.js server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/lifecycle.test.js server/services/pptx-import/package-store/blob-store.test.js server/services/pptx-import-job-manager.test.js
```

Add new focused reader/interleave/retention tests only under the owning phase. Keep lock-order tests serial where required.

## Success Criteria

- [ ] Durable repair saga is crash-replayable and identity-fenced.
- [ ] No known ghost can make the whole presentation list unavailable; current 422 baseline is corrected without changing array shape.
- [ ] GET/DELETE/repair share authoritative openability and Contract-B semantics.
- [ ] Shared reader callers have explicit policies and regressions.
- [ ] Multipart admission has bounded lifecycle and exactly-once cleanup.
- [ ] Progress is monotonic at the job-manager source.
- [ ] Post-visibility cancel preserves visible authority.
- [ ] No second compatibility writer or lock inversion exists.

## Risk Assessment

- Risk: stale compensation deletes a newer incarnation. Mitigation: persisted provenance, generation/head fence, locked RMW, equal-generation tests.
- Risk: durable saga grows scope. Mitigation: bounded state/reason fields, reuse package-store writer/WAL, defer only unrequired claim promotion.
- Risk: reader isolation silently hides data. Mitigation: additive diagnostics, caller-specific tests, manual repair status, no auto-delete.
- Risk: media crash cleanup is overstated. Mitigation: durable manifest gate or explicit best-effort wording.
- Risk: per-job authority changes deployment behavior. Mitigation: additive capability/principal contract and trusted-proxy fallback only when explicitly verified.

## Security Considerations

Imported files are untrusted package input. Never accept client-supplied authority hashes/provenance. Sensitive job controls require server-issued capability or verified principal binding. Repair endpoints must not be exposed as anonymous UUID operations. Do not log capabilities, credentials, raw package names, or environment values.

## Next Steps

Phase 2 consumes the authoritative status/cancel contract. Phase 4 consumes the typed async error and package-commit boundaries. Phase 6 consumes durable lifecycle/repair/tombstone fields. Phase 7 records the resulting Contract-B and ghost-repair evidence.
