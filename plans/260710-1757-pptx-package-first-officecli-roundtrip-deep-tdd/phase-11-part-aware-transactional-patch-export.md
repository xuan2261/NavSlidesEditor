---
phase: 11
title: 'Part-aware transactional patch export'
status: in-progress
effort: '5-7 weeks'
dependsOn: [3, 4, 5]
priority: P0
gates: [G2, G4-integration]
---

# Phase 11: Part-aware transactional patch export

<!-- Updated: Validation Session 1 - first-release edited export blocks signed, encrypted, macro-enabled, ActiveX, and OLE packages. -->

## Overview

Harden and broaden the authoritative transaction engine and endpoint created by
the Phase 5 handoff. Compile transaction-eligible capability rows into allowlisted
part operations, patch a private byte copy of the current immutable revision,
verify exact impact closure, run layered validation, and publish through the
Phase 3 metadata-root transaction. The exact Phase 7 plain-run seed slice is
required for G2; feature phases otherwise feed adapters incrementally and do not
block this phase as whole units. Any failure leaves the prior head and original
untouched.

This phase exclusively closes `G2`. Phase 5 supplies the identity/journal handoff
but does not publish edited bytes. The current route remains fail-closed until
both production validators and all qualification predicates are operational.

## Context Links

- [Approved claim-driven roadmap](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
- [G1 containment](./phase-04-sandboxed-officecli-process-gateway.md)
- [G2 handoff](./phase-05-stable-source-identity-and-mutation-journal.md#g2-contract-handoff)

## Authoritative Export Surfaces

- **Download Original:** always returns immutable upload bytes.
- **Export Edited Revision:** returns the current validated package-backed revision or creates one from pending journal operations.
- **Generate New PPTX:** existing client/PptxGenJS path, if retained, is explicitly labeled as reconstruction and is never presented as a faithful roundtrip.

Server package-first orchestration is authoritative. `client/src/utils/exportPptx.js`, `client/src/hooks/use-export-actions.js`, `server/utils/server-export.js`, and route behavior must not silently select divergent semantics.

Creating or materializing an edited revision is asynchronous:

- `POST /api/presentations/:id/pptx-edited-exports` returns `202`, durable job ID,
  initial state, and a bearer capability delivered in an
  `HttpOnly`/`SameSite=Strict` scoped cookie where supported or one explicit
  response header for the fetch client. It never appears in a URL.
- Authenticated/capability-bearing fetch endpoints expose status, bounded event
  streaming, cancellation, and terminal download. Native `EventSource` is not
  used because it cannot set the required capability header.
- Terminal states and reason codes survive restart; refresh resumes by durable job
  ID plus private cookie/session capability transport.

## Transaction State Machine

```text
requested(base revision, journal hash)
  -> leased
  -> staged clone
  -> preconditions verified
  -> operations applied
  -> layered validation
  -> impact/drift verification
  -> durable PackageJobRecord enters committing
  -> one metadata-root transaction publishes blob/revision/head/owners, releases export lease, and records export job completed
  -> completed response available
  -> optional durable protected-powerpoint-provider job against exact evidence subject
  -> immutable evidence committed and independently verified
  -> one metadata transaction advances only the matching claim-evidence entry, releases provider lease, and records provider job completed
```

Failure before package publication discards/quarantines staging. Publication advances one `PackageStoreStateRoot` containing the complete `PresentationPackageHead`, owner references, leases, and durable job outcome. The head contains projection revision, new package revision, source-map version, compacted journal state, a per-claim evidence map, generation, and predecessor. Provider failure changes only its target claim entry to `failed`; it never retracts package validity or lower verified claims. A generation conflict retains the candidate as unreferenced/quarantined for audit and never overwrites the newer head. Recovery accepts the complete new root or its verified predecessor, never a field-wise mixture. During the documented retention window, retries with the same idempotency key return the same durable outcome.

The process-scoped interprocess owner lock remains held for the server lifetime,
but the FIFO metadata-publication mutex is never held while copying, patching,
calling OfficeCLI/native workers, validating, or hashing. The job pins an
immutable base/lease in one short transaction, releases the mutex for external
work, then reacquires it and revalidates fencing epoch, aggregate generation,
base revision, journal, and matrix hash immediately before publication.

Cancellation states are explicit: `cancellable`, `committing`, `committed`. Cancellation before `committing` aborts; afterward it returns `commit-in-progress` and clients reconcile the durable idempotency outcome.

Idempotency keys are bounded to 128 bytes, normalized as opaque ASCII, scoped by
presentation and operation, and retained with terminal outcomes for 30 days.
Per-presentation and store-wide quotas fail new admission before staging rather
than evicting live records. After retention, a retry is treated as a new request
and must still pass the current base-generation/journal preconditions; the API
does not promise the original response indefinitely.

## Patch Planning Contract

- Input: base package revision, source map version, compacted journal, capability matrix.
- Output: ordered operations, adapter selection, precondition hashes, exact touched parts, relationship impact closure, validation requirements, signature/security effects, and fallback/block reason.
- Every operation is an allowlisted domain mutation.
- `raw-set` is prohibited as generic fallback. A native raw patch adapter may exist only for one reviewed schema/path and must preserve unknown siblings/extensions.
- Operations sharing parts or dependencies are topologically ordered and applied as one transaction.
- Unknown impact, ambiguous identity, unsupported security state, or stale source hash blocks export.
- First-release preflight classifies any signed, encrypted/protected, macro-enabled, ActiveX, or OLE package as original-recovery-only before staging or adapter execution.

## Layered Validation

1. ZIP safety, entry, CRC, duplicate path, and size checks.
2. OPC content type and relationship graph validation.
3. OfficeCLI validation through Phase 4.
4. Native production re-import and semantic comparison against expected projection.
5. Touched-part closure and unrelated-part byte hash comparison.
6. Media/embedding integrity and security-policy validation.
7. Microsoft PowerPoint open/render/behavior validation only for claim level 5 evidence.

Passing OfficeCLI validation alone is never sufficient.

### Production Qualification Predicates

`editedExportAvailability()` returns true only when the current aggregate head,
projection, source map, journal, matrix hash, package security state, target
platform, isolated native re-import validator, exact OfficeCLI binary, and G1
containment tuple all match. Executable presence is never qualification.

### Native Re-Import Validator

- Materialize candidate bytes in a private validation workspace.
- Invoke production `importPptxFile()` with isolated temp/media storage. Native
  media persistence receives a private in-memory hash scope rather than the
  persisted upload-hash index; failed validation rolls that transaction back before
  staging cleanup, while ordinary imports retain their global transaction path. This
  is a local partial closure of the native media-index corruption blocker, not proof
  of a real package importer-to-mapper media run.
- Canonicalize the re-imported projection. `buildImportSourceMap()` now consumes an
  explicit `sourceMapIdentity.presentationId` when the mapped projection has no
  persisted `id`; focused source-map/importer regressions cover this local Phase 11
  repair. Strict real-package native re-import and broader provenance/collateral
  checks remain open.
- Compare only the exact G0-defined transaction-eligible rows in the request
  claim scope against `expectedProjection`. For G2 this is the seed row, even
  though it is not yet level-4 promoted.
- Return row/property/source-ref diffs without paths or slide content.
- Remove a normal validation job root after validation. If removal fails, attempt a UUID-named configured quarantine target by renaming the whole job root. Preserve a validation failure as the primary error with cleanup detail attached; fail closed when both removal and rename fail. A double failure has no durable residual record or sweeper.
- Before staging, canonicalize the workspace root, reject final and intermediate symbolic-link/junction components, and require the configured quarantine root to remain below that workspace. Recheck the path boundary before quarantine creation, rename, and after rename. These are application path checks, not OS-handle-based protection against a concurrent rename swap.
- Never publish on missing, skipped, or cleanup-uncertain validation.

## TDD Matrix

| Test first                               | Expected red                                      | Green behavior                                                                           |
| ---------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Empty journal                            | Rebuilds package                                  | Returns exact current/original bytes                                                     |
| Multi-operation batch                    | Partial changes publish                           | All operations commit or none                                                            |
| Stale base/head                          | Newer revision overwritten                        | Metadata generation conflict, no head change                                             |
| Wrong source hash                        | Patch hits changed XML                            | Preconditions fail before mutation                                                       |
| OfficeCLI partial failure                | Staging reused                                    | Staging discarded/quarantined                                                            |
| Unexpected part drift                    | Validator ignores collateral rewrite              | Export blocked with diff report                                                          |
| Allowed canonicalization                 | All byte differences fail                         | Reviewed allowlist with semantic/hash evidence                                           |
| Native re-import mismatch                | Package still publishes                           | Semantic gate blocks                                                                     |
| Power loss boundaries                    | Half commit visible                               | Recovery restores previous valid head                                                    |
| Split-head fault                         | Projection/package/journal generations differ     | One state-root transaction and predecessor recovery                                      |
| Cancel races with publication            | Client believes cancelled while revision commits  | Point-of-no-return and durable idempotency outcome                                       |
| Provider fails after package publication | Valid revision appears PowerPoint-verified        | Only the level-5 claim entry fails; package validity and lower evidence remain unchanged |
| Retry request                            | Duplicate revisions                               | Idempotent response                                                                      |
| Reused key, different request            | Old result returned                               | Request hash mismatch fails without mutation                                             |
| Duplicate/delete race                    | Blob reclaimed                                    | Lease/reference ownership protects data                                                  |
| Signature/encryption/macro/ActiveX/OLE   | Silent damage or execution risk                   | Edited export blocked before staging; exact original remains available                   |
| Large deck                               | Multiple memory copies exhaust host               | Streaming/bounded staging and backpressure                                               |
| Export path selection                    | Client silently regenerates                       | Explicit surface and capability state                                                    |
| Metadata mutex held externally           | Save/import stalls behind OfficeCLI or parser     | Mutex released during copy/patch/validation; publication revalidates all predicates      |
| Lost refresh/stream capability           | EventSource URL leaks secret or refresh loses job | Fetch stream plus scoped cookie/header resumes without URL capability                    |
| Idempotency flood/forever retention      | Unbounded durable job index                       | Key/record quotas and 30-day outcome retention fail admission safely                     |

## Implementation Steps

1. Extend the Phase 5 transaction schemas and endpoint; prohibit a second orchestration path.
2. Write adapter contract tests and fake patcher fault harnesses.
3. Compile journal operations into impact-aware plans.
4. Add signed, encrypted/protected, macro-enabled, ActiveX, and OLE package
   preflight, then implement a private staged byte copy using package-store leases
   and host-wide admission reservations only for eligible packages. Reject
   hardlinks, reparse points, and source-hash drift.
5. Apply the exact native
   `primitive.text.run.plain-replacement` adapter for G2 and invoke OfficeCLI only
   as the contained package validator. Later OfficeCLI mutation adapters enter the
   transaction only after an exact candidate row selects and qualifies them.
6. Implement the isolated production native re-import validator and contained
   OfficeCLI `validatePackage()` adapter; add deterministic validation aggregation.
7. Implement touched-part and collateral-drift comparison against the base revision.
8. Commit content-addressed bytes/manifest and publish the complete aggregate head, owner references, leases, and export-job outcome through one Phase 3 metadata-root transaction.
9. Persist export `PackageJobRecord` state with durable idempotency, explicit cancellation point-of-no-return, restart recovery, stale-head, and retry behavior.
10. Bind every idempotency key to a canonical request hash and reject key reuse
    with a different base generation, journal, matrix, or target.
11. Consolidate server/client export decisions and API contracts.
12. Preserve previous revisions and quarantine unreferenced candidates indefinitely; first-release export never invokes physical GC. Expose safe recovery.
13. Enqueue a durable provider job asynchronously against an exact subject hash over package revision, projection revision, source-map version, compacted journal, feature-matrix version, and policy digest. After independent verification, use a metadata transaction to advance only that matching claim entry; never mutate the package revision or unrelated claims.
14. Add edited-roundtrip scenarios incrementally for completed capability rows from Phases 7-10; full family matrices remain expansion work.
15. Route all owner release through package-store quarantine/collector APIs; no export rollback may unlink bytes.
16. Remove `_pptxEdited` as export authority after migration gates pass.
17. Add asynchronous create/status/fetch-stream/cancel/download API contracts with
    capability transport outside URLs and bounded stream replay/backpressure.
18. Snapshot under a short metadata mutex, release it for all external work, then
    reacquire and revalidate the complete publication predicate.
19. Enforce 128-byte keys, request/store quotas, 30-day terminal-outcome
    retention, deterministic expiry semantics, and quota-safe compaction.

## File Plan

- Replace/extend `roundtrip-policy.js` and `roundtrip-original-parts.js`.
- Extend the Phase 5 transaction, patch planner, validation, and drift modules; add feature-family adapters without creating another orchestrator.
- Modify presentation/export routes and `use-export-actions.js`.
- Resolve divergence with `client/src/utils/exportPptx.js` and `server/utils/server-export.js` through explicit surfaces.
- Add route, integration, fault-injection, corpus, and provider tests.

## Verification

```powershell
npx vitest run server/services/pptx-import/edited-roundtrip.test.js
npx vitest run server/services/pptx-import/transactional-patch.test.js
npx vitest run server/routes/presentations.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

Run the edited-roundtrip rows currently promoted, transaction fault matrix, export-job restart recovery, large-deck resource tests, and Docker/Electron smoke where export is enabled. When level 5 is requested, also run protected PowerPoint evidence on exact subject hashes. Fault every write/sync/rename between aggregate preparation and state-root publication, then assert only the complete predecessor or successor generation is visible.

## Deep File Inventory

| Action | File/interface                               | Planned change                                               | Test impact                           |
| ------ | -------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| Modify | `server/services/validated-edited-export.js` | Replace hardcoded unavailable state; inject validators       | Availability/route tests              |
| Modify | `transactional-export-validators.js`         | Structured layered results and row diffs                     | Validator tests                       |
| Modify | `mutation-transaction.js`                    | Durable job/lease/admission/cancellation lifecycle           | Fault/restart tests                   |
| Modify | `transactional-patch-planner.js`             | Consume canonical rows and adapter registry                  | Planner/matrix tests                  |
| Modify | `export-job-state.js`                        | Requested/running/committing/terminal recovery               | Job-state tests                       |
| Modify | `pptx-edited-export.js`                      | Request-hash idempotency and typed failures                  | Route tests                           |
| Modify | edited-export route/stream/download surfaces | Durable async API and cookie/header capability transport     | Route/restart/security tests          |
| Create | `native-reimport-validator.js`               | Production importer with isolated media/temp storage         | Semantic integration tests            |
| Create | `edited-export-qualification.js`             | Explicit package/source/matrix/platform/validator predicates | Qualification tests                   |
| Create | `officecli-validation-adapter.js`            | Typed contained gateway validation only                      | Gateway integration tests             |
| Create | Real G2 fixture and fault harness            | Exact strict TipTap plain-run seed through route to R1       | End-to-end evidence                   |
| Delete | None                                         | Keep one engine and endpoint                                 | Architecture test prevents duplicates |

## Function and Interface Checklist

- [ ] Preserve `createMutationTransactionService().execute()`.
- [ ] Preserve `compilePatchPlan()` and `runLayeredValidators()`.
- [x] Implement isolated production `nativeReimport(context)`.
- [ ] Implement contained `officeCli(context)` via `validatePackage()`.
- [ ] Replace availability hardcode with explicit qualification predicates.
- [ ] Bind idempotency key to canonical request hash.
- [ ] Bound idempotency key size, retained outcomes, job count, and stream replay.
- [ ] Release the metadata mutex before every external worker call and revalidate
      all publication predicates after reacquisition.
- [ ] Publish only after all required layers and cleanup certainty pass.

## Tests Before

1. Availability remains `QUALIFIED_VALIDATORS_UNAVAILABLE`.
2. Executing directly injects `validators: {}` and cannot validate.
3. Native semantic tests use stubs instead of production importer.
4. Idempotency key reuse with a different request is not rejected.
5. Export jobs lack complete requested/running/restart/cancel lifecycle.
6. Fill/stroke/image/chart/structure candidates are not all planner-integrated.
7. Export creation is synchronous or streams capability in a URL.
8. External validation holds the metadata publication mutex.
9. Idempotency records can grow without retention or admission bounds.

## Refactor

Add validators and qualification behind the existing engine. Keep candidate adapters
incremental. Do not create another route, transaction, package publication, or
claim evaluator.

## Tests After

| Scenario                        | Required assertion                                      |
| ------------------------------- | ------------------------------------------------------- |
| No-op                           | Exact current/original bytes; no mutation               |
| Exact plain-run seed edit       | R1 published once with all G2 layers                    |
| Native semantic mismatch        | Candidate quarantined; R0 remains current               |
| OfficeCLI/containment failure   | Availability false or transaction aborts before publish |
| Stale generation/source/matrix  | Typed conflict; no staged mutation                      |
| Retry same request              | Same durable outcome; no R2                             |
| Reused key/different request    | Request-hash conflict                                   |
| Cancel before commit            | Abort and release lease                                 |
| Cancel after commit point       | Durable `commit-in-progress` reconciliation             |
| Restart/power fault             | Complete predecessor or successor only                  |
| Large deck/resource pressure    | Admission rejects before unsafe cloning                 |
| Refresh/stream/cancel/download  | Capability-bearing fetch resumes; no URL secret         |
| Concurrent save during validate | Export conflicts at publication; save is not blocked    |
| Idempotency expiry/quota        | Typed expiry/admission result; no partial staging       |

## Dependency Map

```text
G0 canonical matrix + G1 contained OfficeCLI
  + Phase 3 current head/R0/jobs
  + Phase 5 source/journal handoff
  + Phase 7 exact plain-run seed qualification
  -> isolated native re-import + layered validators
  -> atomic validated R1
  -> G2 claim level 3
  -> G4 adapter integration
```

## Debug and Reports

- `reports/phase-11/patch-plan-and-impact.json`
- `reports/phase-11/transaction-fault-matrix.json`
- `reports/phase-11/untouched-part-hash-report.json`
- `reports/phase-11/layered-validation.json`
- `reports/phase-11/export-surface-audit.md`
- `reports/phase-11/edited-roundtrip-corpus.json`

## Risks and Controls

- **Collateral OOXML rewrite:** exact drift gate plus reviewed canonicalization allowlist.
- **Partial publication:** immutable staging, layered validation, metadata-root transaction, idempotency, recovery scan.
- **Split-brain state:** one aggregate head record and predecessor recovery, never independent projection/package pointer writes.
- **Ambiguous cancellation:** durable point-of-no-return and idempotency result reconciliation.
- **Long critical section:** external work runs outside the metadata mutex and
  publishes only after full predicate revalidation.
- **Evidence gap:** package validation and each release claim are separate. Only independently verified evidence may advance its exact per-claim entry.
- **Two export truths:** one authoritative server path and explicit reconstruction fallback label.
- **Resource exhaustion:** streaming copies/hashes, bounded concurrency, disk/memory admission control.
- **Unpatchable edits:** fail with recovery choices, never silently regenerate as faithful export.

## Success Criteria

- [ ] No-op exports are exact and multi-operation exports are atomic/idempotent.
- [ ] Projection, package, source-map, journal, per-claim evidence, owner references, leases, and export-job outcome publish through one metadata-root transaction with no split state.
- [ ] Cancellation before commit aborts; cancellation after the point-of-no-return returns a durable reconcilable outcome.
- [ ] Async create/status/stream/cancel/download survive refresh/restart and never
      place bearer capabilities in URLs.
- [x] Stale revisions, ambiguous identity, source drift, unexpected part changes, and validation failures never publish.
- [x] Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages never enter edited-export staging in the first release.
- [ ] Every published revision passes ZIP, OPC, OfficeCLI, native re-import, impact, and security gates.
- [ ] `editedExportAvailability()` is true only for an exact current qualified
      subject; executable presence or partial validator availability never enables it.
- [ ] Production native re-import runs in Phase 4 containment with isolated
      media/temp storage and compares only exact transaction-eligible rows.
- [ ] Idempotency keys are request-hash bound, size/quota limited, durable across
      restart for the documented 30-day retention window, and safely expired.
- [ ] PowerPoint compatibility/visual claims also pass protected open/render/behavior evidence tied to the exact full evidence subject.
- [ ] Provider failure changes only its target claim entry; lower verified claims and package validity remain intact, and evidence can advance only an exact unchanged subject.
- [x] Phase 11 extends the Phase 5 engine and endpoint; no parallel transaction implementation exists.
- [x] Original, edited revision, and reconstructed PPTX are distinct honest surfaces.
- [ ] Focused, route, corpus, fault, resource, lint, unit, and build validators pass; protected provider validators additionally pass when level 5 is requested.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active containment, Docker, and protected
provider requirements above.

### Active Transaction and Validation Pipeline

1. Lease the current immutable package head and copy it into private per-job
   staging.
2. Reverify generation, fencing epoch, the package data directory's global
   monotonic `matrixAuthorityEpoch`, source refs, source hashes, canonical matrix
   subject, compacted server-derived journal, row eligibility, and impact
   closure. Crash recovery may never lower the authority epoch.
3. Apply only the exact allowlisted row adapter. Net-zero journals return the
   byte-identical Original and create no successor or edited claim.
4. Pass recursive ZIP/XML/OPC and active-content guards, security policy, direct
   qualified OfficeCLI validation, native re-import, semantic comparison, impact
   closure, and untouched-part hashing outside the metadata publication window.
5. Content-address the validated candidate and atomically publish the immutable
   successor, aggregate head, owner refs, job outcome, lease release, and exact
   evidence subject through one state-root transaction.
6. On cancellation, timeout, drift, validator failure, or publication fault,
   preserve the immutable Original and previous valid head.

OfficeCLI runs through the Phase 4 direct local typed gateway. Native re-import
uses bounded isolated local staging with application-level workspace/quarantine
boundary checks, but those checks make no independent OfficeCLI containment claim
and are not race-proof OS-handle isolation. Local PowerPoint is an optional
post-publication oracle for `G5`; it never authorizes package bytes or overwrites
the published revision.

Matrix evolution or restore-forward authority changes must atomically reissue
current authority to every live presentation head or invalidate unreissued heads
fail-closed before any subsequent save or export. Every transaction worker must
inventory every non-success return and prove that it emits registered
`reasonCodes` plus the current `reasonCodeSubject`.

### Active Dependencies, Validation, and Completion

Phase 3 owns package storage and guards, Phase 5 owns journals and source
authority, Phases 7 through 10 own row adapters, Phase 12 owns honest UX, and
Phase 13 owns Windows artifact and local PowerPoint evidence. There is no active
Docker or remote-provider dependency.

Run focused seed-path, no-op, stale-subject, idempotency, restart, cancellation,
fault-injection, layered-validation, native re-import, semantic, untouched-part,
active-content, and publication-atomicity tests, followed by route, corpus,
resource, lint, unit, and build validators. Run local PowerPoint checks only when
the exact subject requests `G5`.

`G2` closes only when one real edited revision traverses this production pipeline
and every layered validator passes, the global matrix-authority epoch cannot
regress, stale heads cannot save or export, and all worker non-success returns
carry current registered reason authority. `G4` rows remain independently gated.
Environment-bound local PowerPoint evidence may close `G5` without independent
isolation, attestation, or separate approvers.
