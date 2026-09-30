---
phase: 7
title: 'Package Authority and Matrix G0'
status: pending
priority: P0
effort: '12-18 engineer-days'
dependencies: [6]
---

# Phase 7: Package Authority and Matrix G0

## Context Links

- [Plan overview](./plan.md)
- [Phase 6: compatibility projection and durable media recovery](./phase-06-compatibility-projection-and-durable-media-recovery.md)
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\plan.md`
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\phase-03-opc-package-inventory-and-working-package-lifecycle.md`
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\phase-05-stable-source-identity-and-mutation-journal.md`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-feature-matrix.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\schemas.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\lifecycle.js`
- `C:\Work\NavSlidesEditor\server\services\generation-safe-save.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-transaction-execution.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\validated-edited-export-context.js`

## Goal

Close G0 for the exact current canonical matrix and current package authority.
Introduce immutable presentation lifecycle identity, bind every replay and
authority-bearing record to that lifecycle, make `matrixAuthorityEpoch` evolution
atomic and fail-closed, validate source-map/head/journal/capability subjects as
one current tuple, and recover committed candidate blobs without data loss or
false publication. Before any lifecycle/matrix migration, require a verified
offline backup, forensic inventory, explicit proof classification, and a canary
against a real restored snapshot. Legacy-unknown state never receives current
authority automatically, and one global canonical epoch remains the only epoch
authority. Extend the existing package store only.

## Scope / Non-goals

### In scope

- Exact current canonical matrix bytes, schema version, semantic version, hash,
  and global authority epoch.
- Immutable `lifecycleId` for every package-backed presentation incarnation.
- Lifecycle-bound idempotency/replay and compatibility identity.
- Atomic matrix-authority reissue or explicit invalidation for every live head.
- Exact source-map/head/journal/capability/evidence subject binding.
- Current-authority availability checks before affirmative UI/API capability.
- Candidate blob intent, publication recovery, and quarantine/audit recovery.
- Legacy migration that fails closed when lifecycle or matrix authority cannot be
  inferred safely.
- Offline migration admission from a Phase 5 both-volume backup.
- Read-only forensic inventory and explicit per-record proof rules.
- A non-authoritative canary on a real restored snapshot before production
  migration.

### Non-goals

- OfficeCLI execution or G1; Phase 8 owns it.
- Native patch publication or G2; later phases own it.
- Promoting additional matrix rows, chart editability, or G4.
- Physical deletion of orphan/candidate blobs.
- A new SQL store, matrix service, capability database, or evidence ledger.
- Rewriting historical matrices, journals, qualifications, or evidence to look current.
- Online/in-place first-run migration without a verified backup and canary.
- Automatic assignment of lifecycle or current matrix authority to
  `legacy-unknown` records.
- Per-head, per-batch, canary, or restore-specific authority epochs.

## Key Insights

- Current heads have matrix authority fields, but source maps, jobs, capabilities,
  mutation results, compatibility writes, and replay keys are not uniformly bound
  to the exact current matrix authority.
- `restoreForward()` advances one global epoch and reissues heads, but there is no
  general matrix-change transaction proving every dependent record is reissued or
  invalidated.
- Presentation IDs can be deleted/quarantined and recreated. Current replay lookup
  by presentation ID + idempotency key can disclose predecessor bytes.
- Source maps currently bind presentation ID, revision, and generation, but not an
  immutable lifecycle or exact head hash.
- Journals bind matrix schema/version/hash and epoch, but not lifecycle, source-map
  revision hash, or base head hash.
- `candidateBlobs[]` records basic blob identity. They do not prove which
  lifecycle/operation intended ownership or how startup should converge after a
  crash between blob commit and head publication.
- A schema migration that merely fills missing fields would manufacture
  authority. Legacy records need positive lineage proof, not plausibility.
- The Phase 5 backup drill is a hard migration prerequisite because lifecycle and
  matrix subjects affect every replay and mutation boundary. A database-style
  migration without both volumes cannot be safely rehearsed or reversed.
- A synthetic fixture cannot reveal real predecessor chains, duplicate IDs,
  partially written jobs, unknown fields, or orphan candidates. Canary input must
  be an operator-selected real snapshot restored into isolated roots.
- `matrixAuthorityEpoch` is one store-global high-water. Dry runs, inventory,
  canaries, individual heads, and restore-forward must not mint parallel epochs.

## Requirements

### Migration admission, backup, and forensic proof

1. Lifecycle/matrix schema migration is disabled by default until an offline
   migration bundle is admitted. Admission requires the service stopped, exclusive
   package writer ownership, and a successful Phase 5 backup manifest containing
   both data and uploads archives with verified hashes.
2. Before any write, a read-only forensic inventory enumerates every state root,
   live/quarantined/deleted head, revision, owner, job, mutation result,
   compatibility write/dead letter/repair receipt, source map, journal,
   capability, candidate blob, evidence reference, upload ownership record, and
   relevant physical blob/file.
3. Inventory emits content-free IDs/hashes/counts and classifies every record as
   `proven-current-lineage`, `proven-historical-lineage`,
   `proven-unbound-safe-to-invalidate`, `legacy-unknown`, or `corrupt`.
   Duplicate IDs, broken predecessor links, absent bytes, hash mismatch, cycles,
   conflicting owners, partial authority, and unrecognized authority-bearing
   fields are never downgraded to warnings.
4. Proof rules are checked in code and versioned in the migration report:
   - same-incarnation proof requires a unique R0/original owner and an unbroken,
     hash-valid predecessor/successor chain to the exact head;
   - duplicate/template proof requires a recorded creation edge and new original
     owner, never matching presentation IDs or content hashes alone;
   - restore-forward proof requires the exact historical revision and recorded
     restore operation inside the same proven chain;
   - dependent-record proof requires exact presentation, generation/revision,
     head/base hash, operation/request identity, and predecessor-chain membership;
   - matrix proof requires exact canonical bytes/version/hash already recorded;
     absent or partial subjects are not proof.
5. `legacy-unknown` and `corrupt` records fail closed. They retain original bytes
   and receive only durable invalidated/reconcile-required classification; no
   lifecycle ID, current matrix subject, capability, replay result, or affirmative
   availability is synthesized for them.
6. A canary restores the verified real backup into isolated data/uploads roots,
   reruns inventory, executes the exact migration code in non-production mode,
   restarts against the migrated snapshot, and proves semantic/byte inventories,
   original recovery, invalidation behavior, and all G0 tests. The canary report
   binds backup hashes, pre/post inventory hashes, migration code/policy digest,
   and zero writes to production roots.
7. Synthetic fixtures remain unit-test inputs but cannot satisfy migration
   admission. If no real snapshot exists, explicitly prove an empty/fresh store
   path; do not claim a legacy migration canary.
8. Production migration requires the exact admitted backup, forensic inventory,
   canary report, code/policy digest, and pre-migration state-root hash to still
   match. Any drift aborts before writes.

### Exact current matrix authority

9. G0 authority is one tuple:
   `{schemaVersion, matrixVersion, canonicalBytesSha256, matrixAuthorityEpoch}`.
10. Canonical bytes are deterministic UTF-8 from the checked-in matrix owner.
11. Startup verifies the tuple against durable state before enabling save/export.
12. Matrix byte/version change is never silently adopted. A named migration
    transaction increments the global epoch and processes every live head.
13. Inventory, dry run, canary, per-head preparation, restart recovery, and
    restore-forward do not allocate separate epochs. Production migration reserves
    one successor `matrixAuthorityEpoch` from the single durable global high-water
    and publishes every reissued/invalidated live head under that exact epoch.
14. Each live head exits migration as either:

- `current`: exact new subjects issued and all current dependencies proven; or
- `invalidated`: durable reason, prior bytes/history retained, save/export blocked.

15. `current` is never automatic for a legacy head. It requires
    `proven-current-lineage`, exact source bytes, exact prior matrix subject where
    required, and successful reissue of every required dependency. Missing proof
    yields `invalidated`, not a best-effort current head.
16. Crash recovery exposes either the complete predecessor epoch or the one
    complete reserved successor epoch. It may never lower the durable high-water,
    mint another recovery epoch, or expose mixed epochs.
17. Rollback/restore cannot reactivate a stale qualification, journal, capability,
    promotion, or evidence subject.

### Lifecycle and replay isolation

18. Every newly created package-backed presentation incarnation has a random
    `lifecycleId`, created with R0 and changed on recreate/duplicate/template
    instantiation; restore-forward of the same incarnation retains it.
19. Legacy migration may assign a lifecycle ID only to one uniquely
    `proven-current-lineage` incarnation and its exact proven historical chain.
    The migration report records the proof edges; IDs are never inferred from
    presentation ID, timestamps, generation proximity, or content equality.
20. Heads, owners where relevant, jobs, mutation results, compatibility writes,
    dead letters, source maps, journals, capabilities, candidate blobs, and
    evidence references bind the lifecycle ID.
21. Idempotency lookup requires lifecycle ID plus request hash and expected base
    identity. Same presentation ID/key/hash in a later lifecycle is not a replay.
22. Delete/quarantine/recreate cannot return predecessor bytes or acknowledge a
    predecessor compatibility write.
23. Legacy records without lifecycle identity are migration-only. Ambiguous
    records become invalidated/reconcile-required, never guessed.

### Source-map/head/journal/capability binding

24. The current head binds lifecycle ID, package revision, projection hash,
    source-map hash, journal hash/pending hash, current matrix authority, generation,
    predecessor hash, and fencing epoch.
25. A source map binds lifecycle ID, presentation ID, package revision,
    package generation, current head hash/base head hash as applicable, and matrix
    authority subject.
26. A journal binds lifecycle ID, base head hash, base revision, exact source-map
    revision hash, exact matrix subject/epoch, reason-code subject, and operation IDs.
27. Durable package/job capability state binds lifecycle ID, operation class,
    package/head subject, matrix subject/epoch, policy version, and expiry/revocation.
28. Availability is affirmative only when the current head, source map, pending
    journal, security capability, row authority, and required validator capability
    all match exact current subjects.
29. Execution repeats the same checks after admission wait and immediately before
    publication; availability is not authorization.

### Candidate blob recovery

30. Candidate intent is durable before or atomically adjacent to blob commit and
    binds candidate ID, lifecycle ID, presentation ID, operation/idempotency key,
    expected base head hash, expected SHA-256/length, and state.
31. Publication consumes candidate intent in the same state-root transaction that
    adds blob/revision/owner/successor head.
32. Startup recovery classifies each candidate:
    - referenced by exact committed successor: clear candidate as published;
    - matching retryable operation/base head: resume publication;
    - blob exists but ownership cannot be proven: quarantine/audit, never publish;
    - staged bytes only: retain/recover or quarantine by exact intent;
    - byte/hash mismatch: reconcile-required.
33. No candidate recovery physically deletes a blob in the first release.
34. Shutdown enrolls candidate creation through publication/compensation in one
    runtime lease so writer release cannot race a committed unowned blob.

## Architecture / Data Flow

### Authority subject

```js
{
  schemaVersion: 1,
  matrixVersion: '1.0.0',
  hash: '<sha256 canonical matrix bytes>',
  evolutionEpoch: 7
}
```

### Head and dependent records

```text
PresentationPackageHead
  lifecycleId
  generation + predecessorId
  package/projection/sourceMap/journal pointers
  matrixAuthorityEpoch + exact subjects
       |
       +-> SourceMap(lifecycleId, head/base hash, matrix subject)
       +-> Journal(lifecycleId, base head, source-map hash, matrix subject)
       +-> Capability(lifecycleId, head hash, matrix subject, policy)
       +-> MutationResult(lifecycleId, request hash, exact outcome)
       +-> CompatibilityWrite(lifecycleId, generation, expected head hash)
```

### Matrix evolution

```text
stop service + acquire exclusive package writer
  -> verify Phase 5 both-volume backup hashes
  -> read-only forensic inventory + proof classification
  -> restore real snapshot into isolated roots
  -> canary exact migration code; no production-root writes
  -> verify admitted backup/inventory/canary/code digests still match
  -> reserve one successor from the global epoch high-water
  -> for each proven live head in memory:
       exact proof + reissuable dependencies -> issue successor-epoch subjects
       otherwise -> invalidate at same successor epoch with stable code
  -> publish one state root + one global high-water
  -> recovery exposes predecessor or complete successor, never mixed epochs
```

Historical records retain their old subjects. Reissue creates new current
authority references; it does not mutate old evidence or journals. `legacy-unknown`
records never become current by migration.

### Candidate lifecycle

```text
reserve runtime lease
  -> durable candidate intent
  -> commit/verify content-addressed blob
  -> validate target head unchanged
  -> atomic blob+revision+owner+head+result publication and candidate consume
  -> release runtime lease

crash -> startup classify by exact intent/head/blob -> resume or quarantine
```

## Absolute Deep File Inventory

| Action | Absolute path                                                                                      | Planned change                                                                   | Mechanical proof    |
| ------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-feature-matrix.js`                  | Export exact current matrix authority/reissue helpers                            | Matrix tests        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-feature-matrix-contract.js`         | Canonical-byte and subject validation contract                                   | Property tests      |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-feature-matrix.test.js`             | Permutation, stale subject, epoch tests                                          | G0 gate             |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\authority-forensic-inventory.js`              | Read-only all-record/physical-byte inventory and versioned proof classification  | Forensic tests      |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\authority-forensic-inventory.test.js`         | Duplicate/cycle/partial/unknown/corrupt and proof-rule matrix                    | Migration gate      |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\matrix-authority-migration.js`                | Atomic reissue/invalidation transaction                                          | Fault tests         |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\matrix-authority-migration.test.js`           | Backup admission, all-head/fault/one-epoch/high-water/no-auto-authority matrix   | G0 gate             |
| Create | `C:\Work\NavSlidesEditor\scripts\canary-package-authority-migration.js`                            | Restore verified real snapshot into isolated roots and run exact migration       | Physical canary     |
| Create | `C:\Work\NavSlidesEditor\scripts\canary-package-authority-migration.test.js`                       | Production-root isolation, digest drift, empty-store and failure contract        | Focused Vitest      |
| Create | `C:\Work\NavSlidesEditor\scripts\migrate-package-authority.js`                                     | Offline admitted production migration with backup/inventory/canary checks        | Physical migration  |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\schemas.js`                     | Add lifecycle/current-invalidated/candidate/capability bindings                  | Store tests         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\state-migrations.js`            | Versioned lifecycle/matrix migration; ambiguity rejection                        | Migration tests     |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\state-store.js`                 | Preserve monotonic matrix high-water and recovery                                | Fault tests         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\index.js`                       | Lifecycle allocation, migration and recovery API                                 | Store tests         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\original-commit.js`             | Create lifecycle ID with R0                                                      | Store tests         |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\import-commit.js`               | Bind lifecycle to import job/head/outcome/write                                  | Import tests        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\lifecycle.js`                   | Duplicate/recreate/new lifecycle; restore-forward retention; exact replay fences | Lifecycle tests     |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\lifecycle.test.js`              | Delete/recreate, duplicate, restore matrix                                       | Focused gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\legacy-state-migration.test.js` | Legacy lifecycle/authority migration matrix                                      | Migration gate      |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\source-map.js`                                | Bind lifecycle/head/matrix subject                                               | Source-map tests    |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\source-map.test.js`                           | Cross-lifecycle/head/matrix rejection                                            | Focused gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-journal.js`                          | Bind lifecycle/base head/source-map/current matrix                               | Journal tests       |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-journal.test.js`                     | Stale lifecycle/source-map/epoch cases                                           | Focused gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\generation-safe-save.js`                                  | Validate exact current tuple before deriving/publishing journal                  | Route/save tests    |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\transactional-patch-planner.js`               | Require lifecycle and complete current authority                                 | Planner tests       |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-transaction-execution.js`            | Lifecycle replay isolation; candidate intent/recovery; current checks            | Transaction tests   |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\mutation-transaction.test.js`                 | Same-ID recreate and candidate crash tests                                       | G0 gate             |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\candidate-blob-recovery.js`                   | Startup resume/quarantine classifier                                             | Fault tests         |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\candidate-blob-recovery.test.js`              | Every candidate/blob/head state combination                                      | Focused gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store-runtime.js`                     | Run matrix/candidate recovery before readiness                                   | Runtime tests       |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\validated-edited-export-context.js`           | Resolve only exact current bound context                                         | Availability tests  |
| Modify | `C:\Work\NavSlidesEditor\server\services\validated-edited-export.js`                               | Exact-current availability and execution recheck                                 | Service tests       |
| Modify | `C:\Work\NavSlidesEditor\server\services\validated-edited-export.test.js`                          | Stale affirmative capability regressions                                         | G0 gate             |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\fidelity-contract.js`                         | Require lifecycle/current matrix/capability tuple                                | Fidelity tests      |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\fidelity-contract.test.js`                    | Cross-subject/mixed-evidence rejection                                           | Focused gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\compatibility-outbox.js`                      | Bind lifecycle and exact head identity                                           | Phase 6 regressions |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\portable.js`                    | New lifecycle on import; historical subjects preserved                           | Portable tests      |
| Modify | `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md`                                       | Define exact G0/current authority                                                | Docs contract       |
| Modify | `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`                                      | Lifecycle/matrix/candidate recovery limits                                       | Docs contract       |

## Tests Before (RED)

1. Delete then recreate same presentation ID/key/hash returns predecessor bytes.
2. Duplicate inherits the source lifecycle ID.
3. Restore-forward accidentally creates a new incarnation or revives stale evidence.
4. A source map from lifecycle A authorizes lifecycle B.
5. A journal with current matrix hash but stale epoch executes.
6. Availability returns true with stale head subjects or mismatched source-map hash.
7. Capability receipt is current by hash but belongs to another lifecycle/head.
8. Matrix change updates only one head before crash.
9. Epoch high-water regresses after predecessor recovery.
10. Matrix rollback revives old promotion/evidence.
11. Candidate blob committed, process exits before publication, startup ignores it.
12. Candidate from old lifecycle publishes into recreated presentation ID.
13. Shutdown releases writer after blob commit but before candidate disposition.
14. Legacy partial lifecycle fields are guessed into a valid head.
15. Migration writes before a verified both-volume offline backup exists.
16. Synthetic fixtures pass while a restored real snapshot contains duplicate IDs,
    broken chains, unknown authority fields, or orphan bytes.
17. A `legacy-unknown` head is assigned a lifecycle and current matrix authority
    from matching presentation ID/hash/timestamps.
18. Canary writes production roots or uses different migration code/policy than
    production.
19. Per-head migration or crash recovery mints multiple successor epochs.
20. Production state drifts after canary but migration continues.

## Numbered Implementation

1. Freeze lifecycle/G0 authority schemas and versioned forensic proof rules. Write
   backup-admission, real-canary, legacy-unknown, one-epoch, and replay RED tests.
2. Implement read-only forensic inventory before adding any migration write path.
3. Require a verified Phase 5 both-volume offline backup and exact state-root hash.
4. Add lifecycle ID to new R0/import creation and every lifecycle adapter.
5. Bind mutation results, jobs, outbox/dead letters, source maps, journals, and
   capability state to lifecycle identity.
6. Make every idempotency/replay lookup lifecycle-scoped.
7. Define exact current authority validation shared by availability, save,
   planning, execution, and publication.
8. Implement fail-closed legacy proof classification; assign lifecycle/current
   authority only where exact lineage proof succeeds.
9. Implement matrix migration as one all-head state-root transaction with one
   reserved canonical successor epoch and reissue-or-invalidate outcomes.
10. Preserve historical subjects and block invalidated heads without deleting
    original recovery.
11. Add source-map/head/journal/capability hash and epoch checks.
12. Expand candidate intent before blob publication and consume it atomically with
    successor ownership.
13. Add startup candidate classifier/resume/quarantine logic.
14. Enroll candidate-to-publication work in the runtime shutdown lease/tail.
15. Update portable, duplicate, template, history, compatibility, and import
    adapters to the lifecycle contract.
16. Add current-authority diagnostics/readiness degradation without leaking internals.
17. Restore an operator-selected real backup to isolated roots and run the exact
    canary; bind its hashes/digests to production admission.
18. Run offline production migration only if backup, forensic inventory, canary,
    code/policy digest, and state root remain exact; fault every root/high-water
    boundary.

## Refactor

- One `assertCurrentPackageAuthority()`-style service, not repeated field checks.
- One lifecycle allocator and one lifecycle comparison helper.
- One matrix migration path; restore-forward calls the same authority reissue seam.
- One global epoch allocator/high-water; canary and per-head helpers never allocate.
- One versioned forensic proof classifier shared by inventory and migration.
- One candidate recovery classifier; no route-specific orphan cleanup.
- Keep schema evolution additive/versioned and historical records immutable.

## Tests After (GREEN)

- Same presentation ID across incarnations has isolated replay/outcomes.
- No lifecycle/matrix migration writes occur without a verified offline backup and
  successful real-snapshot canary.
- Legacy-unknown/corrupt records retain original bytes and fail closed without
  synthesized current authority.
- Every affirmative availability and execution uses the same current authority tuple.
- Matrix migration publishes all heads at one canonical successor epoch or exposes
  the predecessor.
- Invalidated heads keep original recovery and cannot save/export.
- Candidate crashes resume or quarantine deterministically without physical loss.
- Shutdown cannot leave an unclassified committed candidate.

## Scenario Matrix

| Scenario                                  | Lifecycle/matrix result               | Allowed action                                |
| ----------------------------------------- | ------------------------------------- | --------------------------------------------- |
| R0 import                                 | new lifecycle/current epoch           | save/export eligibility evaluation            |
| Duplicate/template instantiate            | new lifecycle/current epoch           | independent replay namespace                  |
| Restore-forward same deck                 | same lifecycle/new generation         | stale dependent records invalidated/reissued  |
| Delete + recreate same ID                 | new lifecycle                         | predecessor replay denied                     |
| Clean matrix evolution                    | all heads reissued atomically         | current heads proceed                         |
| Pending stale journal on evolution        | head invalidated                      | original only until rederived                 |
| Crash before new authority root           | predecessor epoch                     | old complete state only                       |
| Crash after root before completion marker | recover complete successor            | never mixed epochs                            |
| Candidate + unchanged base                | resume publication                    | exact successor only                          |
| Candidate + changed head/lifecycle        | quarantine/audit                      | no publication                                |
| Candidate byte mismatch                   | reconcile-required                    | original only                                 |
| Legacy complete authority                 | lifecycle/current only if exact proof | proceed after proof                           |
| Legacy ambiguous/unknown authority        | invalidated/reconcile-required        | original bytes only; no guessed authorization |
| Backup absent/tampered                    | migration blocked                     | no state writes                               |
| Real-snapshot canary fails                | migration blocked                     | isolated snapshot retained for diagnosis      |
| State/code drift after canary             | migration blocked                     | rerun inventory/canary                        |
| Per-head epoch allocation attempted       | migration blocked                     | one global successor epoch only               |

## Regression Commands

```powershell
npx vitest run server/services/pptx-import/canonical-feature-matrix.test.js server/services/pptx-import/authority-forensic-inventory.test.js server/services/pptx-import/matrix-authority-migration.test.js server/services/pptx-import/source-map.test.js server/services/pptx-import/mutation-journal.test.js
npx vitest run server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/lifecycle.test.js server/services/pptx-import/package-store/legacy-state-migration.test.js server/services/pptx-import/candidate-blob-recovery.test.js
npx vitest run server/services/pptx-import/transactional-patch.test.js server/services/pptx-import/mutation-transaction.test.js server/services/validated-edited-export.test.js server/services/pptx-import/fidelity-contract.test.js
npx vitest run server/routes/presentations.test.js server/routes/history-restore-snapshot.test.js server/services/pptx-import/package-store/portable.test.js server/services/pptx-import/compatibility-outbox.test.js
node scripts/canary-package-authority-migration.js --backup-manifest <phase05-backup-manifest> --isolated-root .tmp/g0-canary
npm run test:pptx:best-effort
npm run lint
```

Mechanical G0 gate: a generated report must enumerate every live head and every
authority-bearing record, show one exact current canonical matrix subject, prove
the single durable epoch high-water, and report zero unbound/ambiguous records
among current authority. It must bind a verified Phase 5 both-volume backup and a
passing exact-code canary on a real restored snapshot; legacy-unknown records must
appear only as invalidated/reconcile-required. A green unit suite without this
state inspection does not close G0.

## Todos

- [ ] Write same-ID cross-lifecycle replay RED test.
- [ ] Require and verify an offline Phase 5 both-volume backup.
- [ ] Produce read-only forensic inventory with versioned proof classifications.
- [ ] Fail closed on legacy-unknown/corrupt/partial authority.
- [ ] Run exact migration canary on a real restored snapshot.
- [ ] Add immutable lifecycle ID and migrations.
- [ ] Bind source map, journal, capability, outbox, jobs, and results.
- [ ] Implement shared exact-current authority validation.
- [ ] Implement atomic matrix reissue/invalidation.
- [ ] Prove one canonical successor epoch and monotonic recovery.
- [ ] Implement candidate intent and startup recovery.
- [ ] Enroll candidate publication in shutdown lease.
- [ ] Run legacy/fault/availability/fidelity gates.
- [ ] Produce mechanical G0 authority inventory.

## Success Criteria

- [ ] Every active package-backed deck has one immutable lifecycle ID.
- [ ] Migration begins only from a verified offline both-volume backup and exact pre-state inventory.
- [ ] A real restored snapshot passes the exact migration canary without production-root writes.
- [ ] Legacy-unknown/corrupt records receive no synthesized lifecycle or current authority.
- [ ] Replay cannot cross delete/recreate, duplicate, or template incarnations.
- [ ] Every live authority-bearing record is bound to exact lifecycle and current matrix authority.
- [ ] Matrix evolution atomically reissues or invalidates every live head.
- [ ] One global `matrixAuthorityEpoch` successor is used for the whole migration and never regresses.
- [ ] Availability and execution reject stale/mixed head/source-map/journal/capability subjects.
- [ ] Historical subjects remain immutable and cannot regain current authority.
- [ ] Candidate blobs always become owned successors, retryable intent, or durable quarantine/reconciliation.
- [ ] Original recovery remains available on every invalidation.
- [ ] Mechanical G0 report and all regression commands pass.

## Risks with Signals / Responses

| Risk                                                | Observable signal                      | Pre-decided response                                                            |
| --------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Lifecycle migration guesses wrong incarnation       | old replay unexpectedly succeeds       | Invalidate ambiguous legacy record; no heuristic identity                       |
| Migration starts without recoverable baseline       | no exact pre-state restore path        | Require stopped-service Phase 5 both-volume backup and verify hashes first      |
| Synthetic canary misses real corruption             | production inventory has unseen shape  | Require operator-selected real snapshot; empty-store path must be explicit      |
| Canary differs from production migration            | code/policy digest mismatch            | Abort before writes and rerun exact-code canary                                 |
| Multiple epoch authorities emerge                   | heads/report show different new epochs | One global allocator and one state-root publication; reject per-head allocation |
| Global matrix migration creates write amplification | root transaction exceeds budgets       | Preflight size/time; batch preparation in memory but publish one root or abort  |
| Restore-forward increments epoch unnecessarily      | unrelated heads churn repeatedly       | Advance only for authority-changing restore and reuse common migration seam     |
| Historical evidence is rewritten                    | old evidence hash changes              | Stop release; historical bytes are immutable                                    |
| Availability and execution use different checks     | availability true, execution stale     | Share one validator and test race recheck                                       |
| Candidate recovery publishes wrong deck             | lifecycle/head mismatch in fault test  | Quarantine; publication requires exact intent tuple                             |
| Candidate accumulation grows disk                   | audit metrics trend upward             | Expose bounded operator inventory; physical GC remains deferred                 |
| Schema expansion leaks server authority             | public DTO snapshots include fields    | Extend authority sanitizer/DTO tests before migration                           |

## Security

- Lifecycle IDs are internal authority, not authentication tokens; strip them from
  public/share/provider DTOs unless an explicit safe generation token is required.
- Never accept lifecycle, matrix, source-map, journal, capability, or candidate
  authority from client payloads.
- Fail closed on missing/duplicate/noncanonical authority.
- Never manufacture lifecycle/current authority for legacy-unknown state; preserve
  original bytes for forensic recovery.
- Backup, forensic inventory, and canary reports contain hashes/IDs rather than
  document content and are owner-only because they still reveal deployment state.
- Candidate recovery does not execute package content or delete unknown bytes.
- Current capability checks include active-content/security state; a current matrix
  hash alone is insufficient.

## Next Steps

Phase 8 may consume G0 only after the mechanical authority inventory is clean.
It then qualifies the exact direct local OfficeCLI binary and binds the
qualification/cache/validation receipts to the lifecycle, head, matrix, policy,
and package subjects established here.
