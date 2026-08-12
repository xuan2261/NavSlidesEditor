---
phase: 6
title: "PPTX Durable Media Recovery"
status: pending
priority: P1
effort: "4-6 engineer-days"
dependencies: [5]
---

# Phase 6: PPTX Durable Media Recovery

<!-- Updated: Validation Session 1 - single package-store writer is the recovery boundary -->

## Context Links

- [Plan overview](./plan.md)
- [PPTX reliability research](./research/pptx-reliability-research.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- [Phase 5 compatibility contract](./phase-05-pptx-compatibility-receipts-and-compensation.md)
- `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`

## Overview

Replace process-memory-only imported-media ownership with durable job staging,
manifest binding, idempotent finalize/rollback, and startup recovery. Visibility
must never expose media URLs before their files/hash records are durable.

## Requirements

### Functional

- Every new PPTX media file is staged under a job-owned, non-public namespace on
  the same filesystem as final uploads.
- A durable staging owner/lease is recorded before the first file write. Recovery
  and sweep run only after acquiring the package-store writer lease and honor a
  bounded stale-age/heartbeat rule.
- Existing deduplicated files are recorded as reused and never deleted by rollback.
- New staged records contain hash, byte length, MIME/ext, original name, staging
  key, final filename and final `/uploads/...` URL.
- Package publication atomically binds a bounded media manifest to the durable
  import job before media finalization.
- Finalization verifies content, promotes files, and updates hash metadata
  idempotently.
- Exact compatibility visibility occurs only after media finalization.
- Failure/cancel compensation rolls back only manifest-owned staged/final files
  and exact matching hash entries.
- Startup recovers published manifests before compatibility outbox drain.
- Startup removes abandoned staging directories only after durable ownership
  recovery and stale-lease proof.
- Durable job/listability serializers require `mediaManifest.state:'finalized'`
  before returning `done` or a `presentationId`.
- Two manifests that converge on the same content hash choose one exact owner;
  the other becomes reused and its rollback cannot remove the shared final file.
- Legacy imported media/hash entries are never inferred, migrated, or swept.

### Non-functional

- Preserve existing public media URLs and aggregate/per-file import budgets.
- Preserve `pptx-import` hash-bucket compatibility unless a test proves a safe
  additive owner field is required.
- Keep staging outside static serving and enforce path/symlink containment.
- State schema remains version 1 with optional validated manifest fields.
- Recovery is bounded and fail-closed; no unbounded filesystem crawl.
- Native re-import validator keeps its private temporary hash scope.

## Architecture

### Staging namespace

```text
<UPLOADS_DIR>/.pptx-import-staging/<jobId>/<uuid>.<ext>
```

Static serving denies dotfiles/staging paths. Final file remains:

```text
<UPLOADS_DIR>/<uuid>.<ext>
```

### Manifest

```js
{
  schemaVersion: 1,
  records: [{
    kind: 'new' | 'reused',
    ownsFinalFile: true | false,
    hash,
    byteLength,
    mimeType,
    originalName,
    stagingKey,    // relative, new only
    finalFilename,
    url
  }],
  totalNewBytes,
  state: 'staged' | 'finalizing' | 'finalized' |
         'rolling-back' | 'rolled-back' | 'reconcile-required'
}
```

Do not persist absolute paths. Validate filenames, hashes, lengths, totals and
record count before package mutation.

### Revised import ordering

```text
map media to staged/reused records
  -> durable staging owner/lease before first write
  -> publish package + manifest + compatibility write ID as nonterminal
  -> durable media state=finalizing
  -> verify/move files + exact hash-index updates
  -> durable media state=finalized
  -> exact compatibility drain from Phase 5
  -> complete durable/volatile import
```

Crash recovery is idempotent:

- staged exists, final absent: verify then rename.
- final exists, staged absent: verify final then ensure hash entry.
- both exist: verify identity, keep one deterministic final, remove owned stage.
- hash present and exact: no-op.
- any mismatch/path escape: mark reconcile-required and do not expose deck.

`publishImport()` writes `status:'running'`/package-published for new manifest-backed
jobs. Only finalized media plus the Phase 5 exact compatibility receipt transition
the durable job to `completed`/committed. Legacy jobs without a manifest retain
their existing interpretation.

Rollback first records intent, removes exact hash entries, deletes only
manifest-owned matching files, then clears staging. Reused records are never
deleted.

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\media-dedup.js` | Stage/reuse records, job-aware transaction | Media tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-media-recovery.js` | Manifest validate/finalize/rollback/startup | New tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\import-media-recovery.test.js` | Fault/restart matrix | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\importer.js` | Thread job-owned transaction/manifest | Importer tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mapper\map-image.js` | Consume staged persistence result | Mapper/media tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mapper\map-media.js` | Consume staged persistence result | Mapper/media tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\schemas.js` | Validate optional bounded manifest/state | Store tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\import-commit.js` | Bind manifest to durable job | Package-store tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime.js` | Recover media before compatibility drain | Startup tests |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import.js` | Pass job ID, reorder finalization/visibility | Route/crash tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\storage.js` | Exact hash mutation helper if needed | Storage/media tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\media.test.js` | Stage/finalize/legacy behavior | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\routes\pptx-import-crash-points.test.js` | Media-aware crash points | Crash gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\temp-upload-sweep.js` | Keep PPTX temp sweep separate; no module-load media sweep | Sweep tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-validator.js` | Explicit ephemeral/private transaction mode | Native validator tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-validator.test.js` | Prove no durable/public staging in validator | Focused gate |
| Verify only | `C:\Work\NavSlidesEditor\server\index.js` | Await one package-runtime initializer only | Startup test |

## Function and Interface Checklist

- [ ] Enumerate all `createMediaTransaction` and `persistDedupedBuffer` callers.
- [ ] Preserve private `hashScope` behavior used by native re-import validation.
- [ ] Allocate final URL before publication without making file public.
- [ ] Validate manifest count and aggregate bytes against existing import limits.
- [ ] Store relative staging keys only.
- [ ] Make every file/hash transition idempotent and hash-verified.
- [ ] Ensure startup recovery runs before compatibility visibility.
- [ ] Persist staging ownership before the first media write and bind it to the
  package-store writer lease rather than process-local storage locks.
- [ ] Prohibit module-load staging sweeps; centralize ordered recovery in
  `initializePackageStore()`.
- [ ] Ensure Phase 5 compensation invokes media rollback in deterministic order.
- [ ] Preserve reused media and legacy `pptx-import` entries.
- [ ] Define same-hash two-job ownership conversion and rollback behavior.
- [ ] Keep native re-import in explicit ephemeral mode with private hash scope,
  temporary uploads directory and no durable manifest.
- [ ] Deny static access to staging paths.

## Dependency Map

```text
mapper -> media transaction stage/reuse
       -> projection final URLs + bounded manifest
       -> package publish
       -> media recovery/finalize
       -> Phase 5 exact compatibility receipt
       -> done

Phase 5 compensation -> media rollback -> terminal rollback/reconcile
startup/package writer lease
        -> manifest/media recovery
        -> compatibility drain/recovery
        -> ownership-aware stale staging sweep
        -> server accepts imports
```

Depends on Phase 5 durable state and compensation coordinator. This phase must
update Phase 5 ordering tests rather than maintain two competing commit orders.

## Tests Before (RED)

| Fault boundary | Restart/rollback expectation |
|---|---|
| Owner + file staged before package publish | stale lease rollback removes owned stage only |
| Crash after durable owner before first file | stale empty job/dir cleaned safely |
| Manifest published before finalize | startup finalizes before visibility |
| Before/after final rename | one verified final file |
| After rename before hash index | restart inserts exact hash entry |
| After hash index before state finalize | restart recognizes exact no-op |
| Finalized before compatibility drain | restart drains only after media proof |
| Cancel during finalization | compensation removes only owned records |
| Reused pre-existing media | never deleted by rollback |
| Final path/hash mismatch | reconcile-required; no visible presentation |
| Duplicate/replayed recovery | deterministic no-op |
| Legacy job without manifest | untouched and existing behavior preserved |
| Symlink/path escape | fail closed without external file access |
| Two jobs/manifests with same hash | one owner, one reused; either rollback preserves needed file |
| Durable GET while media staged/finalizing | no `presentationId`, never `done` |
| Second process with active writer lease | cannot sweep active first-process staging |
| Native re-import validator | private ephemeral files only, no durable job/manifest |

Use child processes and isolated `SLIDES_DATA_DIR`/`SLIDES_UPLOADS_DIR`. Kill at
explicit IPC fault hooks, reopen storage/package state, and assert physical files
plus hash JSON plus durable job state.

## Implementation Steps

1. Write RED manifest validation/staging tests.
2. Add durable owner/lease creation before staging and ownership-aware sweep tests.
3. Change media transaction to stage new files and describe reused records.
4. Bind manifest additively during package publication as a nonterminal job.
5. Write RED finalize/same-hash fault matrix and implement idempotent promotion/hash updates.
6. Reorder route and durable listability after media finalization.
7. Write RED rollback/restart/lease/abandoned-stage tests.
8. Integrate one ordered package-runtime recovery with Phase 5.
9. Add explicit native-validator ephemeral mode and staging static denial.
10. Update deployment/import limits, recovery and operational docs.

## Refactor

- Keep staging/finalization in one focused recovery module.
- Do not add global media reference counting or legacy garbage collection.
- Do not expose manifest internals in the public import DTO.
- Avoid absolute-path persistence and broad upload-route rewrites.

## Tests After (GREEN)

- Same-process abort/error cleanup remains green.
- New process-crash tests converge from every committed fault boundary.
- Presentation cannot become listable before media proof.
- Existing deduped/manual media survives rollback.
- Staging remains bounded and non-public.

## Regression Gate

```powershell
npx vitest run server/services/pptx-import/media.test.js server/services/pptx-import/import-media-recovery.test.js server/services/pptx-import/native-reimport-validator.test.js server/services/pptx-import/package-store/package-store.test.js server/routes/pptx-import-crash-points.test.js server/routes/pptx-import-durable-job.test.js
npm run test:pptx:best-effort
npm run test:pptx:adversarial
npm run lint
```

## Success Criteria

- [ ] Crash reproduction no longer leaves an unowned final file/hash entry.
- [ ] Every published manifest converges to finalized or reconcile-required.
- [ ] Compatibility visibility occurs only after media finalization.
- [ ] Durable status/listability never exposes staged/finalizing media.
- [ ] Rollback deletes only manifest-owned matching records.
- [ ] Same-hash multi-job and cross-process lease tests preserve live media.
- [ ] Legacy and reused media remain untouched.
- [ ] Child-process fault, focused PPTX and lint gates pass.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| Staging/final files span filesystems | rename returns `EXDEV` | Keep staging under uploads filesystem; reject invalid config |
| Final exists with wrong hash | recovery mismatch | Mark reconcile-required; never overwrite/delete unknown file |
| Hash JSON and file diverge | startup proof fails | Repair only exact manifest identity; otherwise stop/reconcile |
| Startup sweep deletes active stage | job-owned dir disappears | Run before accepting jobs and require absence of durable owner + bounded namespace |
| Second process races recovery | active owner/lease is observable | Refuse second writer/startup; never sweep uncertain files |
| Phase 5 ordering becomes stale | compatibility row visible first | Update whole fault matrix before implementation proceeds |

## Security and Data Integrity

- Path/symlink containment is mandatory at stage, finalize and rollback.
- Recovery never scans/deletes outside the dedicated staging namespace.
- Public import diagnostics must not expose staging paths or hashes unnecessarily.

## Todo

- [ ] Write RED stage/manifest tests.
- [ ] Implement job-owned media staging.
- [ ] Write RED child-process finalize/restart matrix.
- [ ] Implement durable finalize/rollback/recovery.
- [ ] Integrate Phase 5 visibility/compensation ordering.
- [ ] Run all phase gates and update docs.
