---
title: "Package-First PPTX Plan Red-Team Review"
date: "2026-07-10"
status: "applied"
plan: "../plan.md"
reviewers: [security-adversary, failure-mode-analyst, assumption-destroyer, scope-complexity-critic]
---

# Package-First PPTX Plan Red-Team Review

## Summary

Four hostile reviewers examined the 13-phase plan under security, failure, assumption, and complexity lenses. Every retained finding has actual repository evidence. Duplicate findings were merged and the result was capped at 15.

- Findings: 15
- Critical: 10
- High: 5
- Medium: 0
- Accepted and applied: 14
- Rejected: 1
- Plan edits applied across `plan.md`, Phases 1-13 where affected, and supporting research/decision records

## Findings

### 1. Aggregate-head CAS lacks a durable cross-process transaction

- **Severity:** Critical
- **Location:** Phases 3, 5, and 11, aggregate-head lifecycle
- **Flaw:** Atomic rename is not compare-and-swap, process-local locks do not coordinate replicas, and the durability sequence omits file and parent-directory synchronization.
- **Failure scenario:** Two processes publish generation N+1 from the same base and both report success; power loss can also leave a published head whose blob was not durable.
- **Evidence:** `server/services/storage.js:22` stores locks in a module-local `Map`; `server/services/storage.js:69` writes and renames without a persisted compare predicate or fsync.
- **Suggested fix:** Select an explicit durability model: SQLite transaction, or a documented single-process boundary plus interprocess fencing/lock and write-ahead recovery. Require file sync, directory sync, generation check, two-process contention tests, and power-loss fault tests.
- **Disposition:** Accept

### 2. Legacy direct deletion can destroy shared content-addressed blobs

- **Severity:** Critical
- **Location:** Phase 3, package ownership and migration
- **Flaw:** Current route rollback and permanent-delete paths call a physical unlink helper. The plan does not make package-store reference release the only permitted deletion boundary.
- **Failure scenario:** Two presentations share one deduplicated original; deleting or rolling back one presentation unlinks bytes still referenced by the other.
- **Evidence:** `server/services/pptx-import/original-package.js:92` directly unlinks package bytes; current import and presentation routes call that helper from rollback/permanent-delete paths.
- **Suggested fix:** Remove route-visible physical deletion. Use provisional leases, transactional owner-reference acquisition/release, quarantine, and GC-only unlinking. Add a repository guard test forbidding direct package deletion outside the collector.
- **Disposition:** Accept

### 3. History restore can publish an old head as the current generation

- **Severity:** Critical
- **Location:** Phase 3, history lifecycle
- **Flaw:** The current restore spreads historical data into the live record. The plan says history owns revisions but does not explicitly require restore to allocate a new forward generation.
- **Failure scenario:** Restoring generation 4 after generation 9 resurrects stale head/source-map/journal metadata and confuses ownership or GC.
- **Evidence:** `server/routes/history.js:123` spreads `snapshot.data` directly into the live presentation and changes only `id` and `updatedAt`.
- **Suggested fix:** Treat restore as a new forward transaction: lease snapshot dependencies, derive a new source-map/journal state, CAS from the current aggregate generation, acquire new ownership, then release the predecessor.
- **Disposition:** Accept

### 4. Sync uses one destructive global staging directory

- **Severity:** Critical
- **Location:** Phase 3, sync portability
- **Flaw:** Full and single sync empty, populate, and remove the same directory, then run destructive `rclone sync`.
- **Failure scenario:** Concurrent syncs erase each other's staging content and upload an incomplete tree, causing rclone to delete valid remote files.
- **Evidence:** `server/routes/sync.js:125` empties global `SYNC_DIR`; `server/routes/sync.js:141` runs `rclone sync`; `server/routes/sync.js:167` reuses the same directory for single-presentation sync.
- **Suggested fix:** Use an immutable per-job workspace, destination-scoped lock, pinned aggregate generation, verified portable manifest, remote temporary revision, and atomic remote manifest/pointer publication.
- **Disposition:** Accept

### 5. CAS breaks the existing autosave queue without generation rebasing

- **Severity:** Critical
- **Location:** Phases 5 and 12, save transport and conflicts
- **Flaw:** The editor discards successful PUT responses and queues snapshots before the preceding save resolves. Teardown retries stale bodies blindly.
- **Failure scenario:** Save A advances generation 12 to 13; queued save B still carries 12 and conflicts with the same editor's immediately preceding save.
- **Evidence:** `client/src/pages/EditorPage.jsx:341` awaits but discards the save result; `client/src/pages/EditorPage.jsx:368` stores queued snapshots unchanged; `client/src/pages/EditorPage.jsx:445` sends keepalive PUTs without outcome reconciliation.
- **Suggested fix:** Make generation transport state, return successor generation, rebase queued snapshots, define deterministic 409 payloads, add idempotency keys, and disable blind stale teardown retries.
- **Disposition:** Accept

### 6. Import job recovery is process-volatile

- **Severity:** High
- **Location:** Phases 3 and 12, import lifecycle and refresh recovery
- **Flaw:** Jobs, cancellation handlers, SSE clients, and progress state live only in memory.
- **Failure scenario:** Restart after original storage but before presentation publication makes the browser's job ID disappear and leaves an ownerless staged blob with no deterministic resume/rollback decision.
- **Evidence:** `server/services/pptx-import-job-manager.js:5` stores jobs in a module-local `Map`; current startup has no durable import-job recovery record.
- **Suggested fix:** Persist import transaction ID, stage, intended presentation ID, lease, terminal outcome, and recovery predecessor. Reclassify/recover jobs on startup and keep polling outcomes stable across restart.
- **Disposition:** Accept

### 7. Windows OfficeCLI isolation and process-tree termination are unproven

- **Severity:** Critical
- **Location:** Phase 4, execution policy
- **Flaw:** `shell: false`, private temp paths, and direct-child signals do not restrict filesystem/network access or kill descendants on Windows.
- **Failure scenario:** A crafted PPTX compromises OfficeCLI, reads Electron user data, spawns a surviving helper, and exfiltrates credentials while cleanup reports success.
- **Evidence:** `server/services/pptx-import/worker-runner.js:57` signals only the immediate child; Electron runs with disabled sandboxing and stores app/server state under the user profile.
- **Suggested fix:** Require a restricted worker identity, denied access to app data, Windows Job Objects with kill-on-close, process/child limits, and deny-by-default egress. Disable mutations on platforms where containment cannot be proven.
- **Disposition:** Accept

### 8. Protected PowerPoint evidence runner lacks a complete trust protocol

- **Severity:** Critical
- **Location:** Phases 11 and 13, provider evidence
- **Flaw:** The plan does not fully separate pull-request code from the protected runner or define revision-addressed transport, disposable runner ownership, prompt watchdogs, signed receipts, and evidence publication ordering.
- **Failure scenario:** Malicious repository code executes on the licensed runner, steals signing identity, or evidence is attached to a different head generation after publication.
- **Evidence:** `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:3` runs on pull requests and `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:29` executes repository-controlled npm installation. Current provider tooling is local and filesystem-path based.
- **Suggested fix:** Use a separate protected tag/commit workflow, immutable artifact handoff, pinned actions, environment approval, disposable isolated VM, revision-hash job IDs, signed input/output receipts, and evidence hash included in the head CAS or a separate non-claim-to-claim status CAS.
- **Disposition:** Accept

### 9. ZIP and XML safety are not enforced before every parser

- **Severity:** High
- **Location:** Phases 3, 4, 9, and 13, input security
- **Flaw:** Current guards trust JSZip's normalized entry map and do not define raw central-directory collision checks or XML grammar/depth/entity limits.
- **Failure scenario:** Different consumers resolve duplicate/canonicalized part names differently, or DTD/entity/deep XML reaches native/OfficeCLI parsers before policy checks.
- **Evidence:** `server/services/pptx-import/pptx-guards.js:95` loads through JSZip with CRC checking disabled; `server/services/pptx-import/pptx-guards.js:104` inventories normalized entries; required parts are checked only by exact names at `server/services/pptx-import/pptx-guards.js:129`.
- **Suggested fix:** Add raw central/local-directory validation, separator/case/Unicode/dot-segment collision rejection, CRC policy, and a pre-parser XML safety pass with per-part/total budgets and DTD/entity/XInclude rejection.
- **Disposition:** Accept

### 10. Resource controls are siloed instead of host-wide

- **Severity:** High
- **Location:** Phases 3, 4, 5, and 11, admission and quotas
- **Flaw:** Import has one semaphore, but diffing, OfficeCLI, vector conversion, rasterization, export cloning, sync, and provider rendering do not share admission or temporary-storage accounting.
- **Failure scenario:** Concurrent parser, browser, OfficeCLI, sync, and provider work exceed memory/temp disk, causing process death during staged publication.
- **Evidence:** `server/services/pptx-import-job-manager.js:4` limits only import jobs; `server/services/pptx-import/worker-runner.js:66` independently forks parser workers; request schemas permit unbounded slide/element arrays and passthrough fields at `server/middleware/schemas.js:29`.
- **Suggested fix:** Add strict request-structure budgets before canonicalization and one weighted host-wide admission controller covering memory, CPU, child processes, browser slots, temp disk, and every workspace type.
- **Disposition:** Accept

### 11. Server-only package authority will leak through full-document serializers

- **Severity:** Critical
- **Location:** Phases 3, 5, and 12, DTO boundaries
- **Flaw:** Safe DTOs arrive after new authority metadata. Existing GET, GitHub, sync, project archive, explore, template, history, share, and live paths serialize or spread complete presentation records.
- **Failure scenario:** Source refs, journal/recovery data, aggregate pointers, or internal hashes are uploaded to GitHub/rclone or exposed through public APIs.
- **Evidence:** `server/routes/github.js:94` serializes the complete presentation; `server/routes/sync.js:135` serializes the complete normalized record; normal presentation GET returns the stored object directly.
- **Suggested fix:** Move explicit `server record`, `editor DTO`, `public DTO`, and `portable archive DTO` schemas to Phase 3 and require every outbound sink to use one allowlisted serializer.
- **Disposition:** Accept

### 12. Evidence attestation lacks anti-replay and independent verification

- **Severity:** High
- **Location:** Phases 1 and 13, evidence trust root
- **Flaw:** Signing alone does not pin accepted issuer/subject/workflow, policy digest, release commit, or monotonic evidence epoch.
- **Failure scenario:** An older valid attestation or broadly authorized workflow signs downgraded thresholds and authorizes a newer release claim.
- **Evidence:** `server/services/pptx-import/pptx-sla-1to1-cli.js:104` aggregates mutable local evidence and only evaluates checks; no independent identity, transparency-log, freshness, or rollback verifier exists.
- **Suggested fix:** Define and test a verifier policy with pinned OIDC issuer, repository, workflow path/ref, protected environment, artifact/policy digest, release commit, transparency evidence, and monotonic epoch.
- **Disposition:** Accept

### 13. Claim evidence is produced before corpus and production importer converge

- **Severity:** Critical
- **Location:** Phases 1, 5, and 6, evidence ordering
- **Flaw:** Production/corpus unification is deferred to Phase 6 while Phase 1 creates evidence contracts and Phase 5 creates vertical-slice evidence.
- **Failure scenario:** Early reports prove a corpus-only mapper path that omits production guards, scene-graph construction, strict policy, or acceptance checks.
- **Evidence:** Production import uses the full importer, while `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:61` independently loads ZIP bytes, invokes the parser, and calls `mapPptxOutput`.
- **Suggested fix:** Move production-entrypoint/corpus unification into the first evidence phase. Leave OfficeCLI shadow reconciliation in Phase 6, but prohibit claim evidence until the shared production path is proven.
- **Disposition:** Accept

### 14. Phase scope and release gates lack implementable milestones

- **Severity:** High
- **Location:** Plan execution strategy; Phases 2, 3, 5, 7-11, and 13
- **Flaw:** Several phases combine platform distribution, persistence replacement, complete primitive/chart/behavior matrices, and duplicate transaction engines. Phase 13 then appears to require top-level infrastructure for lower claim levels.
- **Failure scenario:** Useful original/package preservation cannot ship because full PowerPoint, every chart/behavior family, and every platform remain unfinished. Phase 5 builds a disposable export transaction that Phase 11 replaces.
- **Evidence:** Current contracts are much narrower: text is primarily HTML at `shared/src/types/presentation.js:32`, chart import reads caches and defaults unsupported charts at `server/services/pptx-import/ooxml-chart-parser.js:93`, and animation parsing is a flat inventory at `server/services/pptx-import/ooxml-animation.js:32`.
- **Suggested fix:** Define claim-level release milestones, one incremental export transaction engine, a Windows text-patch qualification spike before distribution expansion, blocking MVP feature rows, and preservation-only tiers for non-MVP families. Require only checks relevant to the requested claim and supported targets.
- **Disposition:** Accept

### 15. Application authentication is missing from the package gateway

- **Severity:** Critical
- **Location:** Phase 4, gateway API
- **Flaw:** Typed commands do not add user authentication or multi-tenant ownership.
- **Failure scenario:** An internet-exposed deployment allows unauthorized job creation, cancellation, or package access.
- **Evidence:** `server/index.js:110` mounts presentation routes without application authentication; import jobs are addressed by UUID only.
- **Suggested fix:** Add application authentication and principal ownership to every package/job route.
- **Disposition:** Reject
- **Rationale:** NavSlides explicitly uses a single-user, self-hosted trusted-proxy security model. A multi-tenant authentication program is out of scope. Accepted findings still require unguessable job capabilities, same-origin/deployment controls, safe DTOs, quotas, and admission limits.

## Recommendations

Findings 1-14 are applied. Finding 15 remains rejected unless product scope changes from single-user/trusted-proxy to multi-user or directly internet-exposed operation.

## Application Result

- File-backed storage now has one non-expiring exclusive writer lock, monotonic fencing epoch, lock-scoped WAL, immutable metadata indexes, and one durable state-root publication. Multi-replica/shared-volume mode remains unsupported.
- Only the package collector may physically unlink package bytes; history restore is forward-only; sync/project publication is isolated and verified.
- Autosave rebases successor generations; import/export/provider work uses generalized durable job records.
- Windows mutation remains disabled until Job Object, restricted identity, app-data isolation, egress, resource, and full-tree termination tests pass.
- PowerPoint claim evidence runs only through the protected disposable-runner protocol and updates an exact per-claim evidence subject after independent verification.
- Raw ZIP/XML gates precede every parser; expensive workloads share host-wide admission; external sinks use explicit DTOs.
- Anti-replay uses a protected append-only per-channel/claim/policy epoch ledger with independent highest-epoch verification.
- Phase 1 removes the corpus-only extractor; Phases 5 and 11 share one export engine; dependency and release gates consume completed capability rows rather than whole matrices.
- The edited-roundtrip MVP is plain run text, basic geometry/fill/stroke, whole-image replacement/crop, one non-shared basic column/bar chart row, preserve-only complex objects, and slide add/delete/reorder/duplicate with target repair.

## Unresolved Questions

No implementation-blocking consistency question remains. Product decision checkpoints in `plan.md` retain explicit fail-closed defaults.

## Final Consistency Validation

- Whole-plan reread completed across `plan.md`, all 13 phase files, this report, and supporting architecture/decision records.
- Independent hostile audit verdict: **PASS**.
- Remaining Critical findings: 0.
- Remaining High findings: 0.
- Remaining lower-severity consistency notes: 0.
