---
phase: 3
title: 'OPC package inventory and working-package lifecycle'
status: in-progress
effort: '5-7 weeks'
dependsOn: [1]
priority: P0
gates: [G2-foundation, G5-job-foundation]
---

# Phase 3: OPC package inventory and working-package lifecycle

<!-- Updated: Validation Session 1 - file-backed single-writer backend confirmed; unreferenced data quarantined indefinitely and GC disabled for first release. -->

## Overview

Turn original-package preservation into a complete immutable package lifecycle. Stream uploads into content-addressed blobs, inventory every OPC part and relationship, create immutable working revisions, and manage references across presentations, duplication, history, templates, project export/import, sync, deletion, quotas, crash recovery, and garbage collection.

`G2` requires the normal production import route, not only tests, to publish
immutable original bytes, revision R0, OPC manifest, canonical projection, source
map, durable media ownership, owner, and durable job through one aggregate
state-root transaction. That state-root projection becomes authoritative before
edited export is enabled.

## Context Links

- [Approved claim-driven roadmap](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
- [Phase 11 validated export](./phase-11-part-aware-transactional-patch-export.md)

## Existing Seams

- `server/services/pptx-import/original-package.js`
- `server/services/pptx-import/pptx-guards.js`
- `server/services/pptx-import/ooxml-scene-graph/`
- `server/routes/pptx-import.js`
- `server/routes/presentations.js`
- `server/routes/history.js`
- `server/routes/templates.js`
- `server/routes/sync.js`
- `server/routes/github.js`
- `server/services/storage.js`
- `client/src/utils/export-project.js`

Preserve existing ZIP bomb and upload guards. Replace UUID-copy ownership with hash-addressed bytes plus explicit references without breaking legacy records.

## Delivery Slices

- **G2 seed MVP:** process-scoped file-backed writer lock/fencing,
  WAL/state-root publication, immutable original and revision R0, sole
  package-backed projection authority, durable media ownership, explicit
  presentation ownership, duplicate/delete integration, safe DTO boundaries,
  durable import/export jobs, package-store ACLs, and no physical deletion.
- **Hardening:** history/templates/portable archives/sync adapters, deduplication, quota warnings, leases, indefinite quarantine, and crash recovery. The collector may audit but physical GC stays disabled for the entire first release.

## Lifecycle Model

```text
staging -> validated -> committed -> reachable -> retained
                    \-> rejected
reachable -> unreferenced -> quarantined - - -> collected (post-first-release policy only)
```

- Blob bytes are immutable and keyed by SHA-256.
- Revision metadata is immutable and keyed by manifest/revision hash.
- Presentation stores one aggregate `PresentationPackageHead` containing original, projection, package, source-map, journal, per-claim evidence map, generation, fencing epoch, and predecessor pointers.
- The server opens exactly one process-scoped package-store instance before
  accepting routes and holds its durable exclusive data-directory writer lock
  until verified shutdown. Route/job code receives that instance and cannot call
  `openPackageStore()` or acquire/release the interprocess lock request-locally.
  A FIFO process-local mutex protects only short metadata publication windows.
  Lock acquisition uses an atomic create/no-replace primitive and records a
  random instance nonce plus host/boot identity, PID, and OS process-creation
  time; it is not time-expired while the owner may still write. Startup may
  reclaim a stale record only after OS-level checks prove that exact
  host/boot/PID/creation-time owner instance is absent, then increments the
  durable fencing epoch. A namespace/host identity that cannot be verified fails
  closed rather than reclaiming. Every publication revalidates lock ownership and
  fencing epoch immediately before root replacement.
- Reference records identify owner type and ID, not just a count.
- Leases protect in-flight imports, exports, history, and recovery.
- Authoritative mutable metadata is never published as independently updated JSON records. Under the writer lock, build immutable next metadata indexes for heads, owner references, leases, and durable jobs; write and sync a prepared WAL record; sync every new index; revalidate lock, fencing epoch, and expected store/head generation; atomically replace and sync one `PackageStoreStateRoot`; then write a completion marker. The root contains the transaction ID, index hashes, predecessor root, store generation, and fencing epoch.
- Rename/replacement of the state root is the single publication point, not a cross-process CAS primitive. Recovery validates the selected root and every referenced index hash. A published root without a completion marker is completed idempotently; an unreferenced prepared transaction is quarantined; an invalid root restores the verified predecessor.
- Blob commit order is stage, sync/close, rename on one volume, sync parent directory, reread/verify hash, then include its immutable manifest and ownership in the next metadata-root transaction.
- Projection/package/source-map/journal/per-claim-evidence pointers are never published in separate records. Recovery validates the complete aggregate or restores its predecessor.
- The package state root is the sole authority for package-backed projection
  reads and writes. A durable outbox in the same root updates
  `presentations.json` only as a compatibility/index read model. Outbox lag or
  failure cannot make the compatibility copy authoritative and blocks any legacy
  path that would otherwise overwrite package-backed state.
- Import-created media blobs and references are staged under the import job lease
  and publish in the same aggregate transaction as R0/projection, or remain
  quarantined. No media upload is committed as an ownerless side effect.
- Duplicate, fork, template creation, history snapshot/restore, and portable
  import create complete aggregate snapshots with fresh owner references and
  generations. They never copy only presentation JSON while silently sharing or
  dropping package authority.
- Routes never unlink package bytes. The collector is the only component that may ever unlink, but first-release configuration permits audit only and performs no physical deletion.
- History restore is a new forward generation. Historical aggregate metadata is never copied directly into the live head.
- Generalized import/export/provider job state and provisional ownership are durable and recoverable across restart.
- Recovery scans staged/quarantined records without deleting reachable user data.
- Package-store roots, blobs, workspaces, lock records, and execution inputs have
  explicit service-account/owner-only ACLs verified at startup and in packaged
  runtime smoke.
- Mutable staging always copies source bytes. Hardlinks, junctions, symlinks, and
  unqualified reflinks from committed blobs into mutable workspaces are rejected.

## OPC Inventory Contract

For each package record:

- ZIP entry path, compressed/uncompressed sizes, CRC, SHA-256, and duplicate/case-collision flags.
- Raw central/local-directory names and headers, with rejection of separator aliases, case/Unicode normalization collisions, dot segments, absolute paths, invalid encodings, and header mismatches before JSZip or OfficeCLI.
- `[Content_Types].xml` defaults/overrides.
- Internal and external relationships with normalized source/target and relationship type.
- Package, presentation, slide, layout, master, theme, notes, comments, chart, workbook, media, OLE, ActiveX, custom XML, signature, macro, 3D, and unknown part classification.
- Dangling targets, relationship cycles, traversal attempts, encrypted/protected status, and security flags.
- XML part budgets for depth, attributes, text size, total XML bytes, and unconditional rejection of DTDs, entities, and XInclude before any parser.
- Embedded OPC/ZIP payloads, including XLSX workbooks, are recursively guarded
  with per-entry, per-container, aggregate-recursion, depth, ratio, XML, and
  relationship budgets before any workbook/native parser opens them.
- Relationship impact graph used later by patch export.

## TDD Matrix

| Test first                   | Expected red                                                  | Green behavior                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate upload             | Two full copies                                               | One blob, two owner refs                                                                                                        |
| Partial write/crash          | Orphan or corrupt head                                        | Previous head valid, staged blob recoverable                                                                                    |
| Hash mismatch                | Corrupt blob accepted                                         | Commit rejected before reference publication                                                                                    |
| Delete one duplicate         | Shared bytes removed                                          | Remaining owner retains access                                                                                                  |
| History/template refs        | Revision lost                                                 | Explicit owner graph preserves reachable revisions                                                                              |
| Project export/import/sync   | IDs without bytes or silent stripping                         | Carry every referenced blob/revision and verify hashes, or block the operation before producing an incomplete portable artifact |
| History restore              | Old head metadata copied live                                 | Restore allocates a new forward generation and owner transaction                                                                |
| Concurrent sync              | Shared staging erased                                         | Per-job immutable workspace and destination-scoped publication lock                                                             |
| Partial project import       | Uploaded blobs leak                                           | Server-side portable import transaction commits all owners or none                                                              |
| Case/duplicate ZIP paths     | Ambiguous inventory                                           | Guard rejects or quarantines deterministically                                                                                  |
| External relationships       | Target ignored                                                | Inventory and security classification preserve target                                                                           |
| Unknown parts                | Dropped from model                                            | Hash and relationships preserved                                                                                                |
| Quota exceeded               | Disk fills                                                    | Import/export stops before commit with recoverable error                                                                        |
| Premature collection attempt | In-flight revision deleted                                    | First-release collector audit never unlinks; leases and current state-root keep it non-collectable                              |
| Legacy UUID original         | Existing deck breaks                                          | Lazy/eager migration preserves exact download                                                                                   |
| Dual-head crash              | Projection and package point to different generations         | One metadata-root transaction or predecessor recovery exposes one consistent generation                                         |
| Second server process        | Both writers accept generation N                              | Exclusive writer lock and fencing epoch reject the second or stale writer                                                       |
| Power loss after rename      | Head points to non-durable blob                               | File+directory sync, reread verification, predecessor recovery                                                                  |
| Crash between metadata files | Owner/head/job records disagree                               | WAL plus one state-root publication exposes the complete predecessor or successor transaction                                   |
| Direct deletion regression   | Route unlinks shared bytes                                    | Repository guard permits unlink only in collector                                                                               |
| Restart during import        | Job ID and provisional owner vanish                           | Durable job record resumes or terminally rolls back                                                                             |
| ZIP/XML ambiguity            | Parsers consume different or hostile parts                    | Raw-directory and pre-parser XML gate rejects package                                                                           |
| Request-local store open     | Concurrent requests release shared writer ownership           | Architecture test allows one bootstrap owner and injected store only                                                            |
| Projection dual authority    | Legacy JSON overwrites package-backed state                   | State-root projection wins; durable outbox updates compatibility view or blocks legacy mutation                                 |
| Import media crash           | Media remains ownerless or projection points to missing bytes | Media owner refs publish with R0 or remain quarantined                                                                          |
| Duplicate/fork/template      | JSON copy drops or aliases package authority                  | New aggregate snapshot and explicit package/media owner refs                                                                    |
| Nested XLSX bomb             | Outer guards pass, workbook parser expands hostile ZIP        | Recursive guard rejects before workbook parsing                                                                                 |
| Staging hardlink mutation    | Patch changes committed source bytes                          | Link-type guard and post-test source hash prove copy isolation                                                                  |

## Implementation Steps

1. Define versioned `PackageBlob`, `PackageRevision`, `PackageStoreStateRoot`, `PresentationPackageHead`, generalized `PackageJobRecord`, `OpcManifest`, metadata-index, owner-reference, lease, fencing-epoch, WAL, and lifecycle schemas.
2. Implement and fault-test the non-expiring exclusive writer-lock protocol, exact-owner stale recovery, and monotonic fencing epoch. Multi-writer startup must fail before any read-modify-write path; automatic timeout takeover while a writer may still run is forbidden.
   Open it once during server bootstrap, inject the process-scoped store into
   routes/workers, and add an architecture test forbidding request-local opens.
3. Introduce explicit server-record, editor, public, portable-archive, and provider DTO schemas; migrate every outbound sink before persisting authority metadata.
4. Write property tests for canonical manifest hashing, raw ZIP-name normalization, central/local header agreement, and XML safety budgets.
5. Add streaming hash/copy so upload bytes are not repeatedly loaded into memory.
6. Build the full OPC inventory with raw-directory validation, CRC policy, XML
   pre-parser guards, existing decompression limits, and recursive guards for
   embedded XLSX/OPC/ZIP payloads.
7. Implement durable blob staging: sync file, rename on one volume, sync parent, and reread/verify before metadata publication.
8. Implement the lock-scoped metadata WAL and immutable indexes, then publish exactly one durable `PackageStoreStateRoot` after expected store/head-generation and fencing checks. Fault every file/directory sync, rename, prepared/completed marker, and recovery boundary.
   Add a durable compatibility-outbox index and make the package projection the
   sole package-backed read/write authority before enabling G2.
9. Persist generalized import/export/provider jobs, hashed per-job capabilities, provisional leases, idempotency keys, intended presentation/revision IDs, cancellation points, and terminal outcomes in metadata-root transactions; raw capabilities remain outside durable/public records. Recover or roll back deterministically on startup.
10. Replace every direct deletion path with owner-reference release and quarantine. Add a guard test that only the collector may unlink package blobs.
11. Integrate duplicate, fork, permanent delete, template creation/instantiation,
    and history snapshot/restore one owner adapter at a time. Each copy-like
    operation creates a complete package-backed aggregate snapshot; history
    restore always creates a new forward generation.
12. Move portable project creation/import server-side with streamed revision traversal, manifest hashes, transaction rollback, and quotas.
13. Replace global sync staging with per-job immutable workspaces, destination locks, pinned heads, remote temporary revisions, and verified manifest/pointer publication.
14. Add host-wide storage/admission accounting for blobs, revisions, temp workspaces, child processes, browser slots, and in-flight jobs.
15. Add legacy migration from UUID originals and `_pptxEdited` metadata without mutating original bytes.
16. Implement a dry-run reachability auditor and collector metrics, but keep physical GC disabled for the first release even after owner adapters pass.
17. Add metrics for byte dedupe, live/quarantined storage, writer-lock state, operation leases, fencing failures, durable jobs, and recovery actions.
18. Replace the normal import route's legacy-original-only publication with the
    authoritative package-store commit. Keep legacy UUID storage migration-only.
19. Stage imported media under the durable import job and atomically publish all
    media owner references with the R0 aggregate.
20. Apply and verify owner/service-only ACLs for the data root and every package
    subdirectory. Reject symlink/junction/hardlink mutable staging.

## File Plan

- Refactor `original-package.js` into small modules under `server/services/pptx-import/package-store/`.
- Extend scene-graph package inventory or extract shared OPC inventory modules.
- Modify relevant routes/services only through the package-store API.
- Modify history, templates, sync, GitHub, explore, share/live, project archive, and presentation routes to use explicit DTO/owner adapters.
- Add migration code with versioned markers and rollback tests.
- Add focused unit, integration, crash-recovery, and large-package tests.

## Verification

```powershell
npx vitest run server/services/pptx-import/package-store
npx vitest run server/routes/pptx-import.test.js server/routes/presentations.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

Run fault injection at every blob and metadata-root durability boundary and a disk-quota/large-media stress suite. Add two-process shared-directory contention, stale-fencing-epoch, power-loss, prepared-versus-completed WAL recovery, durable import/export/provider job restart, concurrent sync, history restore, partial portable import, and direct-unlink guard tests.

## Deep File Inventory

| Action | File/interface                                         | Planned change                                            | Test impact                  |
| ------ | ------------------------------------------------------ | --------------------------------------------------------- | ---------------------------- |
| Modify | `server/routes/pptx-import.js`                         | Publish production import through package store           | Route/integration tests      |
| Modify | `server/index.js` and package-store bootstrap          | Open/inject one process-scoped store before serving       | Lifecycle/architecture tests |
| Modify | `create-imported-presentation.js`, `importer.js`       | Build R0, projection, source map, manifest as one job     | Import/corpus tests          |
| Modify | `package-store/original-commit.js`                     | Make OPC manifest authoritative                           | Store/property tests         |
| Modify | `package-store/state-store.js`, `writer-lock.js`       | Complete fault and stale-owner coverage                   | Crash/two-process tests      |
| Modify | `original-package.js`                                  | Migration compatibility only; no primary ownership/unlink | Legacy migration tests       |
| Modify | owner/portable/sync adapters                           | Carry all reachable bytes or block                        | Route/portable tests         |
| Modify | media import/storage ownership                         | Stage media under job lease and publish owner refs        | Crash/rollback tests         |
| Modify | duplicate/fork/template/history adapters               | Create complete package-backed aggregate snapshots        | Ownership/generation tests   |
| Create | Production import-to-package-store integration service | One orchestration seam                                    | End-to-end R0 test           |
| Create | XML budget and direct-unlink guard tests               | Enforce pre-parser and collector boundaries               | Security architecture tests  |
| Delete | None                                                   | Legacy bytes remain immutable until migration completes   | Recovery tests               |

## Function and Interface Checklist

- [ ] Preserve `openPackageStore()`, `commitOriginal()`, and state-root publication.
- [ ] Restrict `openPackageStore()` to bootstrap/tests; inject one live store.
- [ ] Make `buildOpcInventory()` mandatory during production commit.
- [ ] Publish R0/head/owner/job atomically before presentation visibility.
- [ ] Keep durable export/provider job schemas generic for Phases 11 and 13.
- [ ] Remove primary-route reliance on `persistOriginalPptx()`.
- [ ] Make package-state projection authoritative and drain a durable compatibility outbox.
- [ ] Publish import media references in the R0 transaction.

## Tests Before

1. Production import currently completes without a package head.
2. Fault every blob/WAL/index/root durability boundary.
3. Restart import/export/provider jobs from each durable state.
4. Legacy direct unlink and incomplete portable/sync output are rejected.
5. Recursive outer/nested ZIP and XML budgets fail before native/workbook parsers.
6. Request-local package-store construction fails the architecture test.
7. Duplicate/fork/template/history operations cannot produce JSON-only snapshots.

## Refactor

Move normal import ownership to package store, then narrow legacy UUID helpers to
migration compatibility. Keep collector-only deletion and first-release GC disabled.

## Tests After

- Real import creates exact original, R0, complete OPC manifest, projection,
  source map, owner, and terminal job atomically.
- Recovery exposes only complete predecessor or successor roots.
- Portable/sync/history/template operations include reachable bytes or fail before publication.
- Quota and large-media admission fail without partial ownership.
- Compatibility-view failure preserves the authoritative root and cannot authorize
  a stale save/export.
- Imported media is fully owned by the aggregate or remains quarantined.

## Dependency Map

```text
raw ZIP/XML guards -> OPC inventory -> immutable blob/R0
R0 + aggregate state root -> Phase 5 source authority
durable export jobs -> Phase 11
durable provider jobs -> Phase 13
```

## Debug and Reports

- `reports/phase-03/opc-inventory-schema.json`
- `reports/phase-03/lifecycle-fault-injection.json`
- `reports/phase-03/storage-reference-audit.json`
- `reports/phase-03/legacy-migration-report.json`
- `reports/phase-03/quota-and-gc-policy.md`

## Risks and Controls

- **Cross-presentation data loss:** owner references plus reachability audit before deletion.
- **Filesystem non-atomicity:** stage and publish on the same volume; qualify the exact target's replace/fsync semantics and fail closed where the durability contract cannot be proven.
- **Lost update across processes:** durable exclusive writer lock plus fencing epoch; multi-replica mode remains unsupported.
- **In-process race:** one injected store plus FIFO metadata mutex; never emulate
  ownership with per-request lock files.
- **Unbounded storage:** quota warnings, indefinite quarantine metrics, and admin visibility; do not trade data safety for automatic deletion in the first release.
- **Migration corruption:** immutable legacy bytes, checkpointed migration, and download fallback.
- **Sensitive package exposure:** private storage, opaque IDs, no raw paths in API payloads.
- **Mutable alias:** copy-only staging and link/ACL verification prevent a patch
  process from mutating a committed blob through another directory entry.
- **Incomplete portable artifacts:** project export/import, sync, templates, and history carry verified reachable bytes or are blocked before publication.
- **Premature GC:** physical collection remains disabled for the entire first release; owner adapters and reachability audits prepare a later policy decision.

## Success Criteria

- [ ] Every production import route has immutable original bytes, a complete
      manifest, revision R0, canonical projection/source map, owner, and durable job.
- [x] Duplicate/history/template/delete/restart scenarios preserve correct ownership.
- [ ] Fault injection never publishes a corrupt or partial metadata root or head.
- [ ] No crash or concurrent writer can expose mismatched projection, package, source-map, journal, evidence, owner-reference, lease, or job generations.
- [ ] Package-backed projection has one authority; `presentations.json` is only a
      durable-outbox-fed compatibility read model.
- [ ] One process-scoped store owns the data-directory lock for the server
      lifetime; a second process or stale fencing epoch cannot publish state.
- [x] Every published blob survives durability/restart verification or the aggregate recovers to its verified predecessor.
- [x] No route, rollback, history, template, or migration path can physically unlink package bytes.
- [x] First-release configuration cannot enable physical GC; unreferenced bytes remain quarantined indefinitely and visible in metrics.
- [x] History restore creates a new forward aggregate generation.
- [x] Durable import, export, and provider jobs survive restart or reach one deterministic rollback/terminal outcome.
- [x] Every public/external sink uses an allowlisted DTO.
- [ ] Imported media owner refs publish with R0 or remain quarantined.
- [ ] Duplicate/fork/template/history snapshots carry complete package authority.
- [x] Concurrent sync and partial portable import cannot publish or delete incomplete remote/local state.
- [ ] Raw ZIP ambiguity and unsafe outer or recursively embedded ZIP/XML are
      rejected before native, OfficeCLI, workbook, diagram, or provider parsing.
- [x] Portable/copy/sync surfaces include all referenced package bytes with verified hashes or fail before creating an artifact.
- [x] Unknown parts and external relationships are inventoried without execution.
- [x] Legacy presentations retain exact original download and recoverable export behavior.
- [ ] Package, route, corpus, lint, unit, client build, quota, and crash-recovery validators pass.

## Session 4 Local Scope Rebase: Active Phase Contract

This phase remains the immutable local package-state foundation. Earlier
provider-job, protected-runner, or container assumptions are historical only.
Every R0/head, durable journal, job, qualification, and evidence reference must
persist the exact G0 matrix schema, version, and hash alongside its immutable
package subject. Missing, malformed, or stale subjects block durable mutation,
adapter work, and claim issuance without rewriting the prior record.

Package-state publication preserves the original blob, committed revisions,
historical matrices, journals, and evidence byte-for-byte. Matrix evolution
creates a new subject and stales pending dependent work; rollback may recover a
prior package head but may not reactivate a prior row qualification or promotion.
Local evidence is recorded as local traceability only, never as a protected or
independently attested provider result. Original recovery remains available when
any qualification or local evidence is absent.

`matrixAuthorityEpoch` is one global monotonic high-water epoch per package data
directory. Durable metadata recovery may retain or advance it but may never lower
it. Matrix evolution or restore-forward authority changes must publish one atomic
state-root transaction that either reissues current authority to every live
presentation head or invalidates any unreissued head fail-closed. Until that
transaction is durable, and for every invalidated head afterward, save and export
remain blocked.
