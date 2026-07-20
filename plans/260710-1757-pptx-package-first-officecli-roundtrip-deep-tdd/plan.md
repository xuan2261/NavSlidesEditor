---
title: 'PPTX Package-First OfficeCLI Roundtrip Deep TDD'
description: 'Package-first PPTX import, edit, and export with immutable originals, content-addressed revisions, stable OOXML identity, server-derived mutation journals, contained validation, and provider-rendered fidelity evidence.'
status: in-progress
progress: '76/244 phase checklist items closed; 0/6 claim gates closed; all 13 phases remain in-progress'
priority: P1
branch: 'master'
tags: [deep, tdd, pptx, package-first, officecli, ooxml, roundtrip, fidelity]
blockedBy: []
blocks: []
supersedes:
  - '../260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd/plan.md'
created: '2026-07-10T10:59:09.788Z'
createdBy: 'ck:plan'
source: skill
mode: '--deep --tdd'
scopeDecision: 'hold'
executionModel: 'claim-driven-gates'
targetClaims: [3, 4, 5]
decisionReports:
  - './reports/260711-1705-pptx-claim-roadmap-brainstorm.md'
architectureChoice: 'immutable-original-content-addressed-working-package-editable-projection'
officeCliBaseline: '1.0.135, exact release asset and SHA-256 required before use'
claimOracle: 'Microsoft PowerPoint for PowerPoint-specific visual claims'
---

# PPTX Package-First OfficeCLI Roundtrip Deep TDD

## Session 4 Approved Local Windows Rebase

This section is the active contract for all gates and phases. Earlier references
to repository-owned launchers, protected providers, cloud/VM execution,
independent containment or teardown attestation, KMS/HSM signing, Docker, or
non-Windows artifact lanes are historical design records, not active
requirements and cannot be reinterpreted as local evidence.

- `G0` owns one versioned deterministic local editability/evidence matrix. Its
  schema version, matrix version, canonical UTF-8 bytes, and SHA-256 form the
  required subject for planners, journals, adapters, qualifications,
  capabilities, corpus records, receipts, and claims. Closed catalogs bind every
  row to exactly one impact policy, production transport/schema,
  normalization/version, eligibility policy/version, and adapter policy.
- The five allowed tiers are `native-editable`, `structured-partial`,
  `replace-only-visual`, `preserved-opaque`, and `unsupported-blocking`.
  Adapter qualification, transaction eligibility, and promotion are independent
  exact-row states. Unknown, missing, duplicate, contradictory, stale, or
  noncanonical matrix bindings fail closed before adapter selection or claim
  issuance.
- A matrix or row-policy evolution creates a new subject. Historical matrices,
  journals, qualifications, jobs, receipts, and claims remain byte-immutable
  under their original subject and cannot gain current authority by migration,
  rollback, sibling evidence, or default substitution. Pending dependent
  authority becomes stale until independently rederived or requalified.
- Fail-closed results use the versioned reason-code schema with deterministic
  primary and supplemental ordering. Unknown internal codes map to the safe
  public fallback, never to success.
- `G1` directly executes only the administrator-configured, regular,
  non-reparse OfficeCLI path after each exact version, length, and SHA-256
  verification. Execution is typed, allowlisted, shell-free, bounded, and local,
  with no PATH fallback, launcher, provider, container, runtime download, or
  resident/update mode.
- `G2` uses the immutable package-state root, server-derived journals, private
  copied staging, allowlisted adapters, layered package/native validation, and
  atomic content-addressed publication. `G3` validates Windows Electron NSIS and
  portable artifacts only. `G4` promotes rows only with independent exact-row
  evidence. `G5` is a local PowerPoint oracle over the exact package subject.
- Evidence authority is `local`, bound to the recorded Windows, Office,
  OfficeCLI, fonts, locale, DPI, corpus, configuration, and artifact hashes.
  It does not establish independent isolation, egress isolation, descendant
  containment, teardown attestation, separation of duties, or universal
  compatibility. One disclosed owner may issue App/Storage, Security, and
  Release receipts.

## Implementation Status Sync

- **Overall:** In progress. Existing focused tests demonstrate substantial scaffolding, but no claim gate above level 2 is closed. Prior `87/130` checkbox coverage is retained only as historical implementation evidence and no longer represents release readiness.
- **OfficeCLI containment slice (work in progress):** focused tests now prove a fail-closed contract: a Windows candidate is only identity-checked before containment; the gateway accepts only `validate` through a typed launcher client when a qualified receipt binds the candidate hash/version to a reverified protected execution copy, launcher identity, and policy digest. Candidate-only state, direct target spawning, receipt/copy mismatch, and non-Windows execution are rejected. This is contract coverage only: no repository-owned Win32 launcher or physical Windows containment evidence exists, so `G1` remains Open.
- **Newly demonstrated software coverage:** lifecycle ownership across duplicate/history/template/delete/restart, portable/sync fail-closed publication and package inclusion, generation-safe queued saves and forward history restore, durable terminal fidelity state after refresh, responsive keyboard-accessible fidelity UX, complex-object corpus tier audit, and fail-closed edited-export endpoint behavior.
- **Unavailable or deferred blockers:** validated edited-package qualification and the full primitive/chart/complex-object/behavior matrices, proven Windows Job Object/restricted-identity/app-data/egress containment, protected PowerPoint provider and trust root, Docker/Electron packaging smoke, and physical OfficeCLI/PowerPoint integration evidence.
- **Completion rule:** gates `G0-G5`, not raw checkbox count, control claim readiness. No phase is complete until its scoped success criteria and regression gate pass; unavailable provider, platform, route, expansion, and physical-integration criteria remain open.

## Approved Decision Source

The approved report
[`260711-1705-pptx-claim-roadmap-brainstorm.md`](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
reorders execution without creating a second package, transaction, matrix, or
evidence architecture.

### Scope Challenge Result

- **Existing code reused:** package store, mutation transaction, fail-closed endpoint,
  typed OfficeCLI gateway, native adapters, evidence contracts, and fidelity UI.
- **Minimum complete change:** canonical matrix contract, qualified Windows
  containment, production validators, real artifact smoke, row promotion, and a
  protected provider.
- **Deferred:** broad feature expansion after level 3; provider provisioning after
  level-4 evidence subjects stabilize.
- **Complexity:** cross-cutting by necessity, but constrained to one transaction
  engine, one matrix source, one Windows launcher protocol, and one claim evaluator.
- **Selected scope:** HOLD. Cover all five approved workstreams. Add no unrelated UI.

## Claim Gate Roadmap

| Gate                      | Claim effect                     | Owning phases                    | Entry                                   | Exit evidence                                                                                               | Status |
| ------------------------- | -------------------------------- | -------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| `G0` Canonical contract   | Defines exact level-3/4 subjects | 1; consumed by 6-13              | Existing matrices inventoried           | One versioned schema/hash drives planner, DTO, corpus, and claims; lane names normalized                    | Open   |
| `G1` Windows containment  | Qualifies OfficeCLI for level 3  | 2, 4; evidenced by 13            | Exact external binary manifest          | Assignment-before-execution, full-tree kill, restricted identity, app-data isolation, egress/resource proof | Open   |
| `G2` Valid edited package | Enables claim level 3            | 3, 5, 7-seed, 11; surfaced by 12 | `G0`, `G1`, authoritative R0/source map | Real edited export passes ZIP/OPC, OfficeCLI, native re-import, impact, security, and atomic publication    | Open   |
| `G3` Artifact packaging   | Proves target capability honesty | 13                               | Final capability wiring from `G2`       | Built Docker/Electron artifacts inspected, started, hashed, and capability-probed                           | Open   |
| `G4` Feature editability  | Enables exact claim level 4 rows | 7-12, released by 13             | `G0`, `G2`                              | Each promoted row has adapter/transaction evidence and every mutation surface is centrally row-gated        | Open   |
| `G5` PowerPoint provider  | Enables scoped claim level 5     | 1, 3, 11, 13                     | Stable `G4` evidence subject            | Disposable protected PowerPoint run, signed receipts, independent verification, and epoch publication       | Open   |

### Gate Invariants

1. `G0` and the independent G1 binary/launcher feasibility spikes start in
   parallel. Evidence-receipt integration waits for G0; package integration waits
   for Phase 3.
2. `G2` cannot close before both `G0` and `G1`.
3. `G3` proves packaging and runtime honesty but does not raise a claim by itself.
4. `G4` promotes rows independently; preserve-only completion is not editability.
5. `G5` never blocks levels 1-4 and remains unavailable until protected infrastructure exists.

### Gate Ownership Roles

| Role        | Accountable gates                                 | Required approval                                                                          |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| App/Storage | G0, G2, candidate-row implementation inputs to G4 | Matrix/schema, package authority/recovery, production transaction, row evidence            |
| Security    | G1 and security predicates consumed by G2/G5      | OfficeCLI provenance, launcher/isolation, parser containment, provider trust policy        |
| Release     | G3, G4 release, G5                                | Artifact lineage/smoke, surface-gating evidence, wording, provider signer/epoch/revocation |

One person may hold multiple roles in a small team, but every gate receipt names
the approving role. Missing approval fails only that gate and higher dependent
claims.

## Overview

Replace the lossy whole-deck regeneration path with a package-first dual representation:

1. Preserve the uploaded PPTX as an immutable, content-addressed original.
2. Create immutable working-package revisions with complete OPC inventories.
3. Project supported content into editable NavSlides JSON while retaining server-owned OOXML source identity.
4. Derive a granular mutation journal from optimistic-concurrency-checked saves.
5. Patch only the affected package closure through allowlisted native patchers and a bounded OfficeCLI gateway.
6. Validate, render, and publish a new revision transactionally, leaving the previous revision intact on failure.

The plan does not promise universal semantic editability. It separates exact original recovery, package validity, editable feature coverage, untouched-part preservation, edited roundtrip fidelity, and PowerPoint visual fidelity into independently evidenced claims.

## Problem Statement

Current imports preserve original bytes only until `_pptxEdited` is set. Any edit then routes through hybrid/PptxGenJS reconstruction, losing unsupported OOXML, inheritance, charts, groups, animations, and package relationships. Existing scene-graph work improves import semantics but cannot by itself preserve every package feature. Existing SSIM evidence uses placeholder goldens and the final `test:pptx:sla-1to1` gate correctly rejects a 1:1 product claim.

## Goals

- Exact original download for the lifetime of an imported presentation.
- Immutable, content-addressed working revisions with crash-safe ownership and cleanup.
- Stable, authoritative OOXML source identity that survives reorder and blocks ambiguous patching.
- Server-derived, idempotent, replayable mutation journals with lock-scoped aggregate-generation predicates and durable metadata-root publication.
- Part-aware edited export that preserves unknown and untouched content.
- Explicit editability tiers for primitives, charts, and complex objects.
- Sandboxed, reproducibly verified administrator-provided OfficeCLI integration:
  version and `validatePackage()` for G1/G2, read-only inspection when Phase 6
  consumes it, mutation/render test-lane qualification only after a named
  candidate row selects them, production dispatch only after transaction
  eligibility, and claim wording only after level-4 promotion.
- Fresh corpus, package, semantic, security, resource, and, only for claim level 5, protected PowerPoint evidence for each requested release claim.
- A recovery-first UX that never makes the immutable original dependent on OfficeCLI availability.

## Non-Goals

- Claiming that every PowerPoint feature is natively editable.
- Treating OfficeCLI, LibreOffice, NavSlides, or self-comparison screenshots as the oracle for a PowerPoint-specific claim.
- Exposing arbitrary `officecli` verbs, raw XML mutation, filesystem paths, or package authority to clients.
- Replacing existing ZIP bomb and package guards with OfficeCLI validation.
- Making the OfficeCLI resident/watch SDK a production dependency in the first release.
- Silently rasterizing unsupported objects and describing them as editable.

## Decisions Carried Forward

- New plan is independent and supersedes the stopped native-OOXML plan, while reusing its scene graph, mappers, native parsers, corpus gates, and oracle code.
- Original bytes are immutable. Every edited package is a new immutable revision.
- Server package-first export is authoritative. Client-generated PPTX remains an explicitly labeled non-roundtrip fallback until retired.
- Source metadata, package paths, revision IDs, and journal records are server-owned and stripped from client authority.
- For package-backed presentations, the package state root is the sole
  authoritative projection. `presentations.json` becomes a compatibility/read
  model updated through a durable outbox and cannot authorize save/export.
- One process-scoped package-store instance acquires the interprocess writer lock
  at startup and releases it only on verified shutdown. A FIFO in-process mutex
  serializes short metadata publication windows.
- Node invokes only a repository-owned, digest-pinned Windows containment launcher. The launcher creates OfficeCLI suspended or job-associated at creation, assigns a kill-on-close Job Object, applies the qualified identity/ACL/egress/resource policy, then resumes it. Direct Node `spawn` of OfficeCLI is never a qualified production path.
- The baseline under qualification is OfficeCLI `1.0.135`; production use requires an exact upstream asset, checksum, license record, and packaging verification.
- Microsoft PowerPoint-rendered output is required for a PowerPoint-specific 1:1 visual claim. Pinned LibreOffice may be an informative secondary renderer, not a substitute.
- Unknown, external-link, and 3D content follows preserve-without-execution/tier policy. Macro, ActiveX, OLE, signed, and encrypted/protected packages are original-recovery-only in the first release.
- The first implementation uses one durable, non-expiring exclusive writer lock plus a monotonic fencing epoch per data directory. Startup fails closed if another writer may still exist or stale ownership cannot be proved. Multi-replica/shared-volume deployment is unsupported until a transactional database backend exists.
- Physical package deletion is collector-only. Routes and rollback paths acquire/release owner references or provisional leases but never unlink package bytes directly.
- Committed blobs are never hard-linked into mutable workspaces. All staging uses
  byte copies or qualified copy-on-write clones whose writes cannot affect source
  bytes. Package-store files use explicit owner/service-only ACLs.
- Server records never flow directly to external sinks. Explicit editor, public, portable-archive, and provider DTOs are required before package authority fields are persisted.
- Release gates are selected by requested claim level and supported target, so missing PowerPoint infrastructure cannot block an original-recovery-only release.
- The first release commits to the file-backed single-writer/WAL/state-root backend; a SQLite or multi-backend abstraction is deferred.
- OfficeCLI is administrator-provided on Windows and must match the pinned manifest. It is not bundled in the first release; other targets expose native/original capabilities only.
- The first release derives journals from canonical server-side snapshot diffs; an explicit operation transport is deferred.
- Unreferenced revisions remain quarantined indefinitely and physical GC stays disabled in the first release.
- Embedded workbook cells/formulas are authoritative for the single candidate
  chart row if it is later promoted; chart caches update atomically.
- Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages are original-recovery-only in the first release; edited package export is blocked.
- Rich notes and hidden-slide state are preserve-only in the first edited-roundtrip milestone.
- Claim level 5 remains disabled until an organization-owned protected licensed PowerPoint runner exists; local/manual evidence is informative only.

## Target Architecture

```text
upload stream
  -> ZIP/OPC guards
  -> immutable original blob (sha256)
  -> package inventory + security classification
  -> immutable working revision R0
  -> contained native importer + optional contained OfficeCLI shadow inventory
  -> reconciled editable projection + server source map
  -> presentation JSON head @ R0

save(aggregate generation, client projection)
  -> schema validation + strip authority fields
  -> canonical server diff
  -> mutation journal + touched-part impact closure
  -> lock-scoped metadata transaction checks base generation
  -> durable state-root publication returns successor generation

export(head revision, journal)
  -> clone revision into private staging area
  -> apply allowlisted native operations or typed contained OfficeCLI operations
  -> validate ZIP + OPC + OfficeCLI + native re-import
  -> verify untouched-part hashes and impact closure
  -> content-address staged bytes
  -> lock-scoped metadata transaction publishes new immutable revision as validated
  -> optional protected PowerPoint job against exact evidence subject hash
  -> control plane destroys VM and ephemeral disk
  -> external KMS/HSM signer verifies result + destruction
  -> independently verify signed evidence
  -> evidence transaction updates only the matching per-claim evidence entry
  -> retain previous revision and original for recovery
```

## Core Data Contracts

- `PackageBlob`: SHA-256, byte length, media type, created time, immutable storage locator.
- `PackageRevision`: immutable revision hash, original hash, parent hash, manifest hash, and validation summary. Mutable ownership/lifecycle state lives only in state-root metadata indexes.
- `PackageStoreStateRoot`: immutable metadata-index hashes, store generation, fencing epoch, transaction ID, and predecessor root; one durable root publication makes aggregate heads, owner references, leases, and job outcomes visible together.
- `PresentationPackageHead`: one atomically replaced aggregate containing projection revision, package revision, source-map version, pending journal hash, a per-claim evidence map, generation, fencing epoch, and recovery predecessor.
- `PackageJobRecord`: durable import/export/provider job kind, transaction ID, intended presentation/revision, stage, provisional lease, hashed per-job capability, idempotency key, cancellation point, terminal outcome, and recovery predecessor. Raw capabilities exist only in private client transport/session state.
- `OpcManifest`: all parts, CRC/size/hash, content types, relationships, external targets, signatures, embedded packages, unknown extensions, and security flags.
- `SourceRef`: package generation, part URI, object kind, native ID, relationship chain, ancestry/fragment path, and source hash.
- `MutationJournal`: base revision, operation IDs, canonical before/after values, source refs, impact closure, inverse/recovery data, patchability reason, and final net effect.
- `FidelityEvidence`: exact input/export hashes, corpus manifest, OfficeCLI hash/version, PowerPoint/OS/font identity, test versions, thresholds, policy digest, release commit, monotonic evidence epoch, timestamps, artifact hashes, and protected-runner attestation.
- `ClaimEvidenceState`: claim ID, exact subject hash over package/projection/source-map/journal/feature-matrix/policy versions, and append-only evidence attempts. One attempt moves only `pending -> verified|failed|expired`; retries create a new attempt, subject changes initialize a new `unproven` entry, and revocation/expiry requires a higher evidence epoch. Higher-claim failure cannot alter lower-claim entries.
- `EvidenceEpochRegistry`: protected release authority, release channel, claim ID, policy digest, epoch, predecessor ledger hash, release commit, signature, and transparency inclusion proof.
- `EditabilityTier`: `native-editable`, `structured-partial`, `replace-only-visual`, `preserved-opaque`, or `unsupported-blocking`.

All schemas must be versioned, server validated, migration tested, and excluded from public/share payloads unless explicitly safe.

## Cross-Phase Invariants

1. `sha256(upload) == originalHash` for the presentation lifetime.
2. No-edit export returns the exact original bytes.
3. Every committed package revision is immutable and content-addressable.
4. Projection, package, source-map, journal, per-claim evidence, owner references, leases, and durable job outcomes change through one lock-scoped metadata transaction and durable state-root publication; split-brain combinations are never observable.
   4a. Package-backed reads never combine a state-root generation with projection
   content from an unrelated `presentations.json` generation.
5. Client input cannot authorize source identity, package paths, revisions, or journal entries.
6. Journal replay is deterministic and idempotent; net-zero edits produce no package mutation.
7. Heuristic or ambiguous source identity can inform diagnostics but cannot authorize patching.
8. Touched parts equal the declared relationship impact closure; all other parts remain byte-identical unless a documented canonicalizer is allowlisted.
9. Any patch, validation, timeout, cancellation, or publication failure preserves the previous valid head.
10. Every object is mapped authoritatively, assigned an explicit preservation tier, or blocks the relevant claim.
11. OfficeCLI unavailability never blocks original download.
12. Release evidence is generated from the exact exported revision and cannot be satisfied by stale or placeholder artifacts.
13. Only the package-store collector may unlink package blobs; direct unlink helpers are prohibited outside quarantine/GC.
14. Every server process must hold the exclusive data-directory writer lock and current fencing epoch before it can publish a metadata root or collector decision. Rename is the publication primitive, not a cross-process compare-and-swap.
15. Every external/public sink uses an explicit allowlisted DTO and cannot serialize a server storage record.
16. Imported media has durable job ownership and publishes with the package-backed
    projection or remains quarantined; upload hashes are never a separate unowned side effect.
17. Initial import and native re-import parse untrusted documents under a stripped
    environment, restricted identity, private workspace, denied app-data/profile
    access, denied egress, and full-tree termination.
18. Provider guests never hold claim-authoritative signing keys or attest their
    own destruction. An external signer requires cloud/hypervisor teardown proof.
19. G4 release requires a complete inventory proving every UI/store/API mutation
    path is mapped to one canonical row and independently server-authorized.

## TDD Operating Model

Each phase follows Red, Green, Refactor:

1. Add contract tests and fixtures that fail for the intended reason.
2. Record the red command/output in the phase report.
3. Implement the smallest production slice behind explicit capability flags.
4. Run focused unit/integration tests, then repository validators.
5. Refactor only while all focused tests remain green.
6. Publish machine-readable phase evidence and update the capability matrix.

No phase is complete with skipped required fixtures, placeholder evidence, stale corpus manifests, unexplained package drift, or a failing validator. When the intended result is a fail-closed product claim, a test harness must assert the expected non-zero reason codes and itself exit successfully.

## Dependency Graph

```text
G0: 01 canonical matrix/evidence contract
  |-> 06 reconciliation row evidence
  |-> 07-10 family row candidates
  |-> 11 planner/native semantic scope
  `-> 12/13 DTO, wording, and claim subject

G1: 02 binary qualification + 04 native Windows containment
  `-> 11 contained OfficeCLI validator

03 package lifecycle + 05 source identity/journal
  + G0 + G1
  + 07 exact seed-row qualification
  `-> G2: 11 validated edited export
       |-> 12 recovery UX
       |-> G3: 13 Docker/Electron artifact smoke
       `-> G4: 07-10 row promotion + 12 surface gate + 13 release evidence
            `-> G5: 13 protected PowerPoint provider
```

Phase 5 stops at authoritative identity, canonical diff, journal, generation,
idempotency, and transaction interfaces. Phase 11 exclusively closes the
production level-3 vertical slice, using the same existing engine and endpoint.
Phase 7 supplies one exact G2 seed-row capability without requiring the whole
phase or implying level-4 promotion. Phases 7-10 supply later candidates
incrementally. Any local PowerPoint probe is diagnostic only.

## Phases

| Phase | Name                                                                                                                         | Status      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1     | [Evidence provenance and claim contract](./phase-01-evidence-provenance-and-claim-contract.md)                               | In Progress |
| 2     | [OfficeCLI qualification and reproducible distribution](./phase-02-officecli-qualification-and-reproducible-distribution.md) | In Progress |
| 3     | [OPC package inventory and working-package lifecycle](./phase-03-opc-package-inventory-and-working-package-lifecycle.md)     | In Progress |
| 4     | [Sandboxed OfficeCLI process gateway](./phase-04-sandboxed-officecli-process-gateway.md)                                     | In Progress |
| 5     | [Stable source identity and mutation journal](./phase-05-stable-source-identity-and-mutation-journal.md)                     | In Progress |
| 6     | [Shadow import and differential reconciliation](./phase-06-shadow-import-and-differential-reconciliation.md)                 | In Progress |
| 7     | [Package-backed primitive and inheritance parity](./phase-07-package-backed-primitive-and-inheritance-parity.md)             | In Progress |
| 8     | [Native charts and embedded workbooks](./phase-08-native-charts-and-embedded-workbooks.md)                                   | In Progress |
| 9     | [Complex-object preservation and editability tiers](./phase-09-complex-object-preservation-and-editability-tiers.md)         | In Progress |
| 10    | [Presentation semantics and behavior](./phase-10-presentation-semantics-and-behavior.md)                                     | In Progress |
| 11    | [Part-aware transactional patch export](./phase-11-part-aware-transactional-patch-export.md)                                 | In Progress |
| 12    | [Fidelity UX diagnostics and recovery](./phase-12-fidelity-ux-diagnostics-and-recovery.md)                                   | In Progress |
| 13    | [CI platform security and release claim gates](./phase-13-ci-platform-security-and-release-claim-gates.md)                   | In Progress |

## Dependencies

- Reuse, do not restart, the prior plan's completed original-package storage, import jobs, scene graph, native parsers, corpus fixtures, and oracle utilities after contract review.
- The approved OfficeCLI Windows release asset, SHA-256, and Apache-2.0 notices
  must be available for administrator installation to enable its G2 validation
  role. Native mutation remains restricted to exact row adapters.
- A controlled Windows runner with licensed Microsoft PowerPoint and pinned fonts is required before enabling a PowerPoint-specific fidelity claim.
- A separate organization-owned KMS/HSM signer and cloud/hypervisor destruction
  verifier are required before provider evidence can become claim-authoritative.
- Existing presentations remain readable throughout migrations; original download and legacy export remain available behind explicit capability labels.

## Execution Strategy

- **Wave 0, `G0`:** Phase 1 defines the canonical row schema/hash and evidence
  subject. Phases 6-10 migrate to it without broadening claims.
- **Wave 1A, `G1`:** Phases 2 and 4 qualify the exact external binary and implement
  the Windows launcher. Phase 3 supplies guarded immutable revisions and durable jobs.
- **Wave 1B, `G2`:** Phases 5, the Phase 7 seed slice, and Phase 11 connect
  authoritative source identity, one strictly eligible TipTap single-plain-run
  text operation, contained native re-import, contained OfficeCLI
  validation, and atomic publication. Release level 3 after the gate passes.
- **Wave 1C, `G3`:** Phase 13 inspects and starts final Docker/Electron artifacts.
  Source-only scans remain non-authoritative development checks.
- **Wave 2, `G4`:** Phases 7-10 promote exact rows one by one. Phase 11 integrates
  adapters, Phase 12 proves all mutation surfaces are centrally row-gated, and
  Phase 13 releases only row IDs with complete evidence.
- **Wave 3, `G5`:** Phase 13 completes provider contracts first, then provisions the
  disposable self-hosted PowerPoint VM after `G4` subject stability.

### Gate-Scoped MVP Cuts

- G2 excludes image crop until one canonical client/server representation exists.
- G2 qualifies OfficeCLI version and package validation only. Inspection belongs
  to Phase 6; OfficeCLI mutation/render remains deferred until a row selects it.
- Full timing-tree modeling remains deferred while timing is preserve-only.
- Portable archive/sync hardening remains a Phase 3 completion track but does not
  block the G2 seed slice; affected operations fail closed until their owner
  adapters pass.
- First-release admission is process-wide because the data directory permits one
  server process. G2 integrates import, OfficeCLI, export staging, and native
  re-import; cross-process/provider scheduling uses separate platform controls.

### Cross-Plan Coordination

- `260711-1038-editorpage-ui-ux-remediation-deep-tdd`: serialize its Phase 8
  save/export controller extraction with PPTX Phase 12; earlier layout work may proceed.
- `260522-1339-qa-confidence-uplift-5-phase-tdd`: reuse generic Electron launch
  harness patterns; this plan owns PPTX artifact absence and capability assertions.
- `260609-0830-element-control-functional-fixes-tdd`: preserve reconstructed-export
  wording; reconcile its stale plan status separately.
- No whole-plan `blockedBy` edge is added because unrelated phases remain executable.

## Repository Validation Baseline

Run focused tests during each phase, then before a phase merge:

```powershell
npm run lint
npm run test
npm run test:corpus
npx vitest run server/services/pptx-import/sla-failclosed.test.js
```

Run `npx vitest run server/services/pptx-import/sla-failclosed.test.js` as the accepted fail-closed SLA diagnostic harness until Phase 13 has complete claim evidence. The harness invokes the CLI and succeeds only when expected missing-evidence or trust-boundary rejections occur, so that rejection is not a phase validator failure. Run `npm run build` only for phases that change client, shared build surfaces, packaging, or release artifacts. Run Playwright, Docker, Electron, resource, security, and PowerPoint-provider jobs where specified by the phase.

## Reports and Evidence

Each phase writes a report under `reports/phase-NN/` containing:

- red/green/refactor command log and exit codes;
- fixture and corpus manifest hashes;
- capability matrix delta;
- package touched-part and collateral-drift report;
- known degradations and recovery behavior;
- performance/security findings;
- unresolved decisions and named owner.

Release evidence is generated output, not hand-edited baseline data.

## Release Claim Ladder

1. **Original recovery:** exact uploaded bytes remain downloadable.
2. **Package preservation:** no-edit export is byte-identical, package revisions retain complete OPC/unknown-part inventories, and no edited-roundtrip capability is implied.
3. **Valid edited package:** an edited export preserves unknown and untouched parts and passes ZIP, OPC graph, OfficeCLI, native re-import, impact, and security checks. No Microsoft provider claim is implied.
4. **Feature editability:** only matrix rows with passing semantic and roundtrip tests are claimed editable.
5. **PowerPoint compatibility and visual fidelity:** only corpus/provider combinations with fresh provenance, required coverage, passing open/render/behavior checks, and passing thresholds may claim PowerPoint compatibility or use 1:1 wording.

Failure at one level must not erase evidence for lower levels, but product copy must not imply a higher level.

## Remaining Decision Checkpoints

- Phase 1: corpus governance, SSIM/perceptual thresholds, artifact visibility, and retention after a protected provider exists.
- Phase 2: unsigned administrator-provided binary acceptance and upgrade policy; Linux/Docker mutation stays disabled.
- Phase 3: storage quota warnings, deduplication ownership, backup, and sync policy; automatic GC stays disabled.
- Phase 5: identity ambiguity UX and legacy migration rollout; canonical snapshot diff is the selected transport.
- Phases 8-10: expansion rows beyond the confirmed workbook-authoritative basic chart and preserve-only notes/hidden state.
- Phase 11: permitted schema-specific raw OOXML adapters and retirement timing for reconstructed fallback; active-content edited export stays blocked.
- Phase 13: select the organization-owned KMS/HSM signing implementation and
  cloud/hypervisor destruction-attestation source during G5 provisioning. Until
  selected, G5 remains unavailable while G0-G4 proceed.
- At implementation kickoff, map named people to the approved App/Storage,
  Security, and Release roles.

Until approved, use fail-closed defaults: no PowerPoint-specific claim, no generic `raw-set`, no execution of embedded active content, no mutation on ambiguous identity, and no deletion of reachable revisions.

## Definition of Done

- `G0-G5` close with no required skip for the requested target and claim.
- All 13 phase exit criteria pass with no required skips for their scoped gates.
- Migration and rollback are exercised on existing imported presentations.
- The administrator-provided Windows OfficeCLI binary is pinned and verified; no
  unsupported or unqualified OfficeCLI operation may execute.
- Fresh composite evidence is produced from the exact release candidate.
- The fail-closed `pptx-sla-1to1-cli.js` diagnostic rejects missing provenance, corpus alignment, or other evidence required by the requested claim level; its focused harness verifies that rejection.
- Product wording matches the achieved claim-ladder level and editability matrix.

This definition closes the full roadmap. Earlier releases may close a lower claim milestone when every gate required by that claim passes and higher-level wording remains disabled.

## Red Team Review

### Session — 2026-07-10

**Findings:** 15 (14 accepted, 1 rejected)
**Severity breakdown:** 10 Critical, 5 High, 0 Medium
**Report:** [`reports/from-red-team-reviewers-to-planner-package-first-plan-review-report.md`](./reports/from-red-team-reviewers-to-planner-package-first-plan-review-report.md)

| #   | Finding                                      | Severity | Disposition | Applied To                   |
| --- | -------------------------------------------- | -------- | ----------- | ---------------------------- |
| 1   | Durable fenced aggregate-state publication   | Critical | Accept      | Plan, Phases 3/5/11          |
| 2   | Collector-only package deletion              | Critical | Accept      | Phases 3/5/11                |
| 3   | Forward-only history restore                 | Critical | Accept      | Phase 3                      |
| 4   | Isolated destructive sync publication        | Critical | Accept      | Phase 3                      |
| 5   | Autosave generation rebasing                 | Critical | Accept      | Phases 5/12                  |
| 6   | Durable import-job recovery                  | High     | Accept      | Phases 3/12                  |
| 7   | Windows containment and tree kill            | Critical | Accept      | Phases 2/4/13                |
| 8   | Protected PowerPoint provider protocol       | Critical | Accept      | Phases 1/11/13               |
| 9   | Raw ZIP and XML pre-parser hardening         | High     | Accept      | Phases 3/4/9/13              |
| 10  | Host-wide resource admission                 | High     | Accept      | Phases 3/4/5/11/13           |
| 11  | Explicit DTO boundaries                      | Critical | Accept      | Phases 3/5/12                |
| 12  | Evidence anti-replay verification            | High     | Accept      | Phases 1/13                  |
| 13  | Production/corpus entrypoint before evidence | Critical | Accept      | Phases 1/6                   |
| 14  | Claim-level milestones and scope cuts        | High     | Accept      | Plan, Phases 2/3/5/7-11/13   |
| 15  | Mandatory application authentication         | Critical | Reject      | Trusted-proxy model retained |

### Whole-Plan Consistency Sweep

Completed after applying the 14 accepted findings:

- Re-read `plan.md`, all 13 phase files, the adjudicated report, and supporting architecture/decision records.
- Replaced filesystem-CAS ambiguity with one non-expiring exclusive writer lock, fencing epoch, WAL, immutable metadata indexes, and a single durable state-root publication/recovery protocol.
- Verified collector-only unlink, forward-only history restore, isolated sync/portable publication, autosave generation rebasing, generalized durable jobs, Windows containment, pre-parser ZIP/XML gates, host-wide admission, and DTO boundaries across every affected phase.
- Verified Phase 1 removes the corpus-only extractor, Phase 6 only adds shadow reconciliation, and Phases 5/11 use one transaction engine and endpoint.
- Aligned direct `dependsOn` edges with capability feeds so Phases 11-13 and lower claim releases do not wait for full feature-matrix completion.
- Replaced scalar evidence status with per-claim exact-subject attempts and added a protected append-only epoch ledger with independent highest-epoch verification.
- Aligned the claim ladder and Phase 13 lane matrix: levels 1-4 require no Microsoft provider; PowerPoint compatibility/open/1:1 wording requires level 5.
- Final independent hostile audit: **PASS**, with 0 Critical, 0 High, and no lower-severity consistency notes.

**Unresolved implementation-blocking contradictions: 0.**

## Claim-Driven Deep TDD Refresh

### Session 2 — 2026-07-11

- **Source:** approved brainstorm report linked above.
- **Scope:** HOLD, all five workstreams.
- **Plan action:** update this existing 13-phase plan; do not create a duplicate.
- **Deep scout:** phases 1-5, 6-10, and 11-13 inspected against current production
  and test files.
- **Current release ceiling:** level 2. Levels 3-5 remain fail-closed.
- **Physical blockers:** configured OfficeCLI, native Windows build environment,
  Docker artifact runner, and protected licensed PowerPoint infrastructure.
- **Validation state:** prior Session 1 red-team/validation is historical and must
  be rerun after the Session 2 phase updates.

### Session 2 Hostile Review Disposition

**Findings:** 15 (14 accepted, 1 rejected)

|   # | Finding                                                        | Disposition | Applied to                                                                                               |
| --: | -------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
|   1 | Dual projection authorities                                    | Accept      | Plan, Phases 3/5/11                                                                                      |
|   2 | Request-local writer locks contradict process ownership        | Accept      | Plan, Phase 3                                                                                            |
|   3 | Native import/re-import parsers escape containment             | Accept      | Plan, Phases 3/4/11                                                                                      |
|   4 | TipTap transport is incompatible with plain-run adapter        | Accept      | Phases 1/7/11                                                                                            |
|   5 | G2 seed eligibility is conflated with G4 promotion             | Accept      | Plan, Phases 1/7/11                                                                                      |
|   6 | Edited export lacks durable asynchronous API/capability stream | Accept      | Phases 4/11/12                                                                                           |
|   7 | Metadata mutex may span external validation                    | Accept      | Phases 3/11                                                                                              |
|   8 | OfficeCLI path TOCTOU and mutable-link staging                 | Accept      | Plan, Phases 2/3/4/11                                                                                    |
|   9 | Embedded XLSX can bypass outer ZIP/XML guards                  | Accept      | Plan, Phases 3/8                                                                                         |
|  10 | Import media is outside aggregate ownership                    | Accept      | Plan, Phase 3                                                                                            |
|  11 | Duplicate/fork/template/history can lose package authority     | Accept      | Phase 3                                                                                                  |
|  12 | Provider signing and destruction boundary is incomplete        | Accept      | Plan, Phase 13                                                                                           |
|  13 | G4 can release before centralized mutation gating              | Accept      | Plan, Phases 12/13                                                                                       |
|  14 | G2 includes operations/commands/models not needed by the seed  | Accept      | Plan, Phases 2/4/7/10/11                                                                                 |
|  15 | Add a multi-user authentication epic                           | Reject      | Trusted-proxy/single-user scope retained; Host/Origin explicitly treated only as a CSRF/deployment check |

The accepted findings are plan requirements, not evidence that implementation
already exists. Session 2 formatting, strict validation, consistency review, and
the deep validation interview are complete.

## Session 3 Implementation Sync — 2026-07-15

- **Scope executed:** Phase 2/4 OfficeCLI candidate, receipt, execution-copy, and bounded-gateway hardening; no claim-gate promotion.
- **TDD result:** OfficeCLI/export focused suite green at 11 files / 69 tests; touched-file ESLint, repository lint, client build, and `git diff --check` pass. Full Vitest/corpus results remain recorded separately when their delegated runs complete.
- **Controls added:** candidate-only qualification rejected before read/stage; receipt binds candidate/execution-copy/launcher/policy/input hash and terminal exit status; failed receipts remain typed; revoked qualification is re-read; protected copy reuse/link/root checks fail closed; bounded failures wait for launcher close/grace; native launcher target receives no-resident/no-update flags.
- **Evidence:** [`reports/phase-02/officecli-hardening-red-green.md`](./reports/phase-02/officecli-hardening-red-green.md) and [`reports/phase-04/gateway-containment-red-green.md`](./reports/phase-04/gateway-containment-red-green.md).
- **Gate status:** G1/G2/G3/G4/G5 remain open where physical launcher, OfficeCLI, artifact, edited-package, or protected PowerPoint evidence is unavailable. Production composition remains intentionally fail-closed.

## Validation Log

### Session 2 — 2026-07-13

**Trigger:** deep-plan validation interview after Session 2 hostile-review
propagation

#### Questions and Answers

1. **[Architecture]** How should NavSlides enforce Windows
   assignment-before-execution for administrator-provided `OfficeCLI.exe`?
   - **Answer:** Build a repository-owned C++/Win32 launcher with CMake.
   - **Rationale:** Node does not expose the complete suspended-process,
     `STARTUPINFOEX`, Job Object, restricted-token, and completion-port contract.
     The launcher supervises but does not modify or bundle OfficeCLI.
2. **[Security]** What fallback is allowed if OfficeCLI is incompatible with
   AppContainer?
   - **Answer:** Dedicated service identity plus private ACL and WFP/firewall,
     accepted only after equivalent physical tests.
   - **Rationale:** A restricted token alone does not prove app-data isolation or
     egress denial.
3. **[Infrastructure]** Which cloud control plane and external KMS/HSM signer
   should G5 use?
   - **Answer:** Select during provider provisioning.
   - **Rationale:** G5 stays unavailable until selected; this does not block
     levels 1-4.
4. **[Operations]** How should gate ownership be recorded?
   - **Answer:** Split App/Storage, Security, and Release roles.
   - **Rationale:** Keeps approval boundaries explicit while allowing one person
     to hold multiple roles in a small team.

#### Confirmed Decisions

- The containment launcher uses C++/Win32, CMake, and the CI-qualified MSVC
  toolchain.
- AppContainer remains preferred; dedicated service identity plus ACL/WFP is the
  only allowed fallback and must pass the same physical control rows.
- Provider/signing vendor selection is deferred to G5 provisioning; G5 remains
  unavailable beforehand.
- Gate receipts identify App/Storage, Security, and Release approver roles.

#### Verification Results

- Independent whole-plan audit: **PASS**, zero remaining consistency issues.
- Prettier: **PASS** for `plan.md`, all 13 phase files, and the planning journal.
- `ck plan validate --strict`: **PASS**, 13 phases, 0 errors, 0 warnings.
- `git diff --check`: **PASS**; only pre-existing repository LF-to-CRLF warnings
  were emitted.
- Physical OfficeCLI, Windows/MSVC, Docker, and protected PowerPoint gates remain
  unavailable rather than mocked or skipped.

### Session 1 — 2026-07-10

**Trigger:** `/ck:plan validate plans/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md`
**Questions asked:** 8

#### Verification Results

- **Tier:** Full (13 phases)
- **Guard:** Existing evidence-backed `## Red Team Review` allowed verification sampling to be skipped.
- **Additional claims checked:** 0
- **Verified:** 0 | **Failed:** 0 | **Unverified:** 0
- **`[UNVERIFIED]` tags found:** 0

#### Questions & Answers

1. **[Architecture]** Phase 3 currently chooses a file-backed WAL and durable state-root under one exclusive writer. Which persistence boundary should the implementation commit to for the first release?
   - Options: File-backed single writer (Recommended) | SQLite transaction backend | Abstract both backends now
   - **Answer:** File-backed single writer (Recommended)
   - **Rationale:** Avoids premature backend abstraction while retaining explicit durability and recovery semantics.
2. **[Scope]** Phase 2 needs a concrete first-release OfficeCLI deployment target and acquisition policy. Which scope should be authoritative?
   - Options: Windows, admin-provided pinned binary (Recommended) | Windows, bundled pinned binary | Windows and Docker/Linux after separate qualification | No OfficeCLI mutation in first release
   - **Answer:** Windows, admin-provided pinned binary (Recommended)
   - **Rationale:** Limits supply-chain and packaging scope while preserving exact binary verification.
3. **[Architecture]** Phase 5 can preserve the existing save API by deriving journals from canonical snapshots, or add a new operation protocol. Which mutation transport should MVP use?
   - Options: Server snapshot diff (Recommended) | Explicit operation API | Hybrid snapshot and operations
   - **Answer:** Server snapshot diff (Recommended)
   - **Rationale:** Fits the current save flow and minimizes client protocol churn.
4. **[Risk]** Phase 3 must choose safe retention defaults before GC can run. What should MVP do with unreferenced revisions and blobs?
   - Options: Quarantine indefinitely, GC disabled (Recommended) | Configurable quota and retention | Automatic 30-day collection
   - **Answer:** Quarantine indefinitely, GC disabled (Recommended)
   - **Rationale:** Prioritizes data safety until ownership and reachability evidence mature.
5. **[Architecture]** Phase 8 proposes one editable non-shared column/bar chart row. Which source should be authoritative when an embedded workbook and chart caches both exist?
   - Options: Workbook authoritative, sync caches (Recommended) | Chart caches authoritative | Preserve-only charts for MVP
   - **Answer:** Workbook authoritative, sync caches (Recommended)
   - **Rationale:** Matches formula/data ownership and prevents divergent chart consumers.
6. **[Risk]** Phases 9 and 11 need a first-release policy for signed, encrypted, macro-enabled, ActiveX, and OLE packages. Which fail-closed boundary should apply?
   - Options: Block edited export, original only (Recommended) | Allow unrelated edits, preserve active bytes | Add explicit invalidation consent flow
   - **Answer:** Block edited export, original only (Recommended)
   - **Rationale:** Avoids signature invalidation and active-content corruption/execution risk.
7. **[Scope]** Phase 10 leaves rich notes and hidden-slide behavior as checkpoints. What presentation-semantics scope should the first edited-roundtrip milestone claim?
   - Options: Preserve-only notes and hidden state (Recommended) | Add hidden-slide editing only | Add structured notes and hidden-slide editing
   - **Answer:** Preserve-only notes and hidden state (Recommended)
   - **Rationale:** Keeps the structural MVP focused while preserving source behavior.
8. **[Assumption]** Phase 13 requires a protected licensed PowerPoint runner for level-5 claims. What should releases do until that organization-owned runner exists?
   - Options: Disable level 5, ship lower claims (Recommended) | Accept local manual evidence temporarily | Block all edited-package releases
   - **Answer:** Disable level 5, ship lower claims (Recommended)
   - **Rationale:** Preserves the evidence trust boundary without blocking lower validated claims.

#### Confirmed Decisions

- First release uses file-backed single-writer metadata transactions only.
- Windows administrator-provided pinned OfficeCLI is the sole external OfficeCLI
  deployment target; G2 uses it for contained validation and uses the exact native
  seed adapter for mutation.
- Canonical server snapshot diff is the mutation transport.
- GC is disabled and unreferenced data remains quarantined indefinitely.
- Embedded workbook authority drives the basic chart row and synchronizes caches.
- Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages are original-recovery-only.
- Rich notes and hidden-slide state remain preserve-only for the first milestone.
- Level 5 stays disabled until the protected PowerPoint runner exists.

#### Action Items

- [x] Propagate decisions to Phases 2-5 and 8-13 where contracts or UX are affected.
- [x] Run the post-propagation whole-plan consistency sweep and strict validation.

#### Impact on Phases

- Phase 2: administrator-provided Windows OfficeCLI; no first-release bundling or Linux/Docker mutation.
- Phase 4: configured manifest-matching Windows path is the only gateway executable source.
- Phase 3: fixed file-backed backend and indefinite quarantine with GC disabled.
- Phase 5: snapshot-diff journal derivation selected.
- Phase 8: workbook authority/cache synchronization selected.
- Phase 9: signed, encrypted/protected, macro-enabled, ActiveX, and OLE package edits blocked.
- Phase 10: notes/hidden state preserve-only in MVP.
- Phase 11: fail-closed active-content export policy.
- Phase 12: capability UX exposes original-only active packages, preserve-only notes/hidden state, and unavailable level 5.
- Phase 13: level 5 unavailable until protected provider ownership is established.

#### Whole-Plan Consistency Sweep

- Re-read `plan.md`, all 13 phase files, and the applied red-team report after propagating the eight confirmed decisions.
- Checked each decision across overview text, architecture/contracts, TDD rows, implementation steps, file plans, verification commands, risks, success criteria, UX, and release gates.
- Reconciled stale references and contradictions involving PATH/bundled OfficeCLI invocation, non-Windows mutation, pre-spawn ZIP/XML safety, first-release physical GC, complete active-package blocking, preserve-only hidden/notes behavior, level-5 provider availability, actual repository seams, and PowerShell validator filters.
- Preserved the rejected multi-user-authentication decision while restoring configured same-origin trusted-proxy controls and unguessable hashed per-job capabilities for package/job routes.
- Verified atomic metadata-root publication covers aggregate heads, owner references, lease release, and durable job outcomes.
- Final independent certification audit: **PASS**, with 0 Critical, 0 High, 0 Medium, and 0 Low findings.
- `ck plan validate --strict`: **PASS**, 13 phases, 0 errors, 0 warnings.
- `git diff --check`: **PASS**; only the pre-existing predecessor-plan LF-to-CRLF warning was emitted.

**Unresolved implementation-blocking contradictions: 0.**

## Session 4 Local Scope Rebase: 2026-07-16

### Authority and Supersession

This section is the active execution contract for the mission. It supersedes
earlier active goals, dependencies, gate descriptions, execution instructions,
commands, and completion criteria wherever they require a native launcher,
independent process or network isolation, protected infrastructure, non-Windows
release artifacts, or independent approvers. Session 1 and Session 2 remain
unchanged historical decision records. Session 3 remains an implementation
history record whose launcher-oriented controls are not evidence for this local
scope and must be migrated or retired rather than bypassed.

Local evidence provides integrity and traceability for the recorded host. It does
not prove profile isolation, network egress isolation, independent descendant
containment, teardown attestation, independent attestation, or separation of
duties.

### Active Gate Roadmap

| Gate | Active local contract                | Required exit evidence                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `G0` | Canonical local contract             | One versioned schema and deterministic matrix hash drive planner, adapters, DTOs, corpus, evidence subjects, capabilities, and wording. Historical evidence retains its original authority and is never relabeled as local.                                                                                                                                                                                                                        |
| `G1` | Direct local OfficeCLI qualification | OfficeCLI `1.0.135`, byte length `33,111,928`, and SHA-256 `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588` execute only from the configured canonical absolute Windows path through fixed typed operations, `shell:false`, filtered environment, bounded output/resources/time/concurrency, cancellation, cleanup, and redacted diagnostics. The receipt records the residual limitations above and makes no containment claim. |
| `G2` | Locally validated edited package     | A canonical server-derived journal is applied in private staging and passes recursive ZIP/XML/OPC and active-content guards, direct qualified OfficeCLI validation, native re-import, semantic comparison, security policy, impact closure, and untouched-part checks before an immutable successor is atomically published.                                                                                                                       |
| `G3` | Windows Electron artifacts           | Build, hash, inspect, install or launch, and capability-probe only the Windows Electron NSIS installer and portable `.exe`, using isolated app/data roots. OfficeCLI stays administrator-provided and unbundled.                                                                                                                                                                                                                                   |
| `G4` | Exact row editability                | Each row independently passes adapter, journal, patch, re-import, semantic, roundtrip, untouched-part, and mutation-surface evidence. Every UI, store, hook, and API mutation path maps to a canonical row and the server independently authorizes it.                                                                                                                                                                                             |
| `G5` | Local PowerPoint oracle              | Local Microsoft PowerPoint opens the exact published package hash without repair or blocking prompts, renders or exports it, preserves required behavior, and passes approved thresholds. Evidence is bound to Windows, Office, fonts, locale, DPI, corpus, matrix, configuration, thresholds, source/export, and application artifact hashes.                                                                                                     |

One disclosed owner may issue the distinct `app-storage`, `security`, and
`release` receipts. The three records remain separate and immutable, but do not
represent independent approval.

### Canonical Matrix and Reason-Code Rules

- The only active editability/evidence subject is the versioned canonical matrix:
  its schema version, semantic matrix version, canonical UTF-8 bytes, and
  SHA-256 travel together. Canonicalization sorts object keys, rows, and
  identifier sets so equivalent permutations have one subject.
- The closed tier vocabulary is `native-editable`, `structured-partial`,
  `replace-only-visual`, `preserved-opaque`, and `unsupported-blocking`.
  Every row binds exactly one cataloged impact policy, transport/schema,
  normalization contract/version, and eligibility policy/version.
- An executable or promoted row binds one exact currently-qualified adapter.
  Qualification, transaction eligibility, and level-4 promotion are independent
  row states. Family, sibling, prior, or inferred evidence cannot substitute.
  Preservation and blocking rows bind no adapter and remain unqualified and
  transaction-ineligible.
- Every planner result, journal, adapter or qualification receipt, capability,
  corpus record, evidence manifest, and claim carries the full matrix subject.
  Missing, unknown, duplicate, contradictory, stale, or noncanonical bindings
  fail closed before an adapter starts or a claim is issued.
- The versioned reason-code schema defines deterministic primary-code precedence
  and ordered supplemental codes. Unknown internal codes map to the safe public
  fallback and never imply authorization or expose internal content.
- Matrix evolution creates a new subject. Historical matrices, journals,
  qualifications, capabilities, and evidence remain byte-immutable history;
  dependent pending authority becomes stale and must be rederived or requalified.
  A rollback never resurrects a promotion or relabels prior evidence as current
  local evidence.
- `matrixAuthorityEpoch` is one global monotonic high-water epoch for the entire
  package data directory, not a per-presentation counter. Crash recovery may
  retain or advance it but may never lower it. Matrix evolution or a
  restore-forward authority change must atomically reissue current authority to
  every live presentation head, or invalidate unreissued heads fail-closed,
  before any later save or export.
- Every transaction worker inventories every non-success return. Each return
  carries registered `reasonCodes` and the current `reasonCodeSubject`; missing,
  unregistered, or stale reason-code authority fails closed.

### Active Architecture and Invariants

- Preserve package-first admission, immutable content-addressed originals and
  revisions, complete package inventory, byte-identical no-edit recovery,
  server-owned source identity, canonical snapshot-diff journals, impact closure,
  fencing/generation checks, and atomic state-root publication.
- Keep `presentations.json` a compatibility/read model only. Never accept client
  package paths, source refs, revision IDs, journals, or evidence authority.
- Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages remain
  original-recovery-only. No OfficeCLI or PowerPoint execution and no edited
  export staging is allowed for them.
- PowerPoint and OfficeCLI are validators only. Neither can overwrite immutable
  originals or become package authority.
- Original recovery remains available when OfficeCLI or PowerPoint is absent,
  stale, blocked, cancelled, timed out, or failed.

### Repository Preservation and Commit Policy

- Before every code-changing feature, review `git status`, `git diff`, and
  `git diff --cached`.
- Stage and commit only an explicit reviewed path allowlist. Generated `.tmp`
  content, package-store runtime blobs, indexes, WAL files, screenshots, reports,
  build outputs, and unrelated artifacts are denied unless an exact
  mission-owned fixture is named in the allowlist.
- The user authorizes rewriting or amending local commit `a6cb42f3` only to split
  and recommit its G0 changes under a reviewed path allowlist. Preserve every
  working-tree file and every unrelated user-owned change. Do not use
  `reset --hard`, clean, deletion, or any operation that risks file loss.

### Active Dependencies and Execution Strategy

1. Phase 1 closes `G0` and the local evidence/wording schema.
2. Phases 2 and 4 close `G1` with the direct typed gateway. No native launcher,
   protected execution copy, restricted identity, firewall policy, or provider
   prerequisite is active.
3. Phases 3 and 5 establish immutable package authority, guarded staging,
   source maps, generation-safe saves, and deterministic journals.
4. Phase 11 integrates the first real row from Phase 7 and closes `G2`.
5. Phases 7 through 12 promote exact rows and mutation surfaces for `G4`.
6. Phase 13 closes `G3` for the NSIS and portable artifacts and composes the
   local release evidence.
7. After a stable exact `G4` subject exists, Phase 13 runs the local PowerPoint
   oracle serially to close `G5`.

Unit and review work may use up to five independent workers. Browser, Electron,
OfficeCLI, and PowerPoint flows run one at a time. Every validation service uses
isolated temporary data, upload, staging, and app-data roots and stops its exact
process tree before handoff.

### Active Validation Commands

```powershell
npm run lint
npm run test -- --exclude client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm run test:corpus
npx vitest run server/services/pptx-import/sla-failclosed.test.js
```

The full-unit command above is the `commands.test` manifest command from the
mission's `services.yaml`. It excludes only the reproducible unrelated
pre-existing
`client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx`
failure. Its isolated command,
`npx vitest run client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx`,
fails `undo restores the prior snapshot after an edit`. Do not fix it within
this PPTX mission or broaden the exclusion. This is not a global waiver; every
other test and every additional failure remains blocking.

Run `npm run build` for client/shared wording and Electron milestones. Run
focused OfficeCLI, package-store, transaction, evidence, artifact, and
PowerPoint-oracle suites for their owning gates. Run focused Playwright or
`npm run test:e2e` for UX surfaces. For `G3`, build and smoke both configured
Windows Electron targets. There is no active Docker, Linux, or macOS release
lane, and LibreOffice is not claim authority.

### Active Definition of Done

- `G0` through `G5` meet the active local contracts above for one exact release
  subject, with lower claims remaining independent when higher evidence is absent.
- OfficeCLI runs directly from the exact configured pinned binary only through
  the bounded typed gateway, and all receipts disclose that independent
  isolation and attestation are not proven.
- Validated edited revisions are immutable, atomically published, and pass every
  layered package validator. Every failure preserves the previous valid head and
  exact Original.
- The package data directory's global matrix-authority high-water epoch never
  regresses, authority changes atomically reissue or invalidate all live heads
  before save/export, and every transaction-worker non-success path emits
  registered reason codes under the current reason-code subject.
- Every promoted row and mutation entry point is centrally matrix-gated and
  independently server-authorized.
- Only the Windows Electron NSIS and portable `.exe` are release-gated, hashed,
  inspected, started, capability-probed, and shut down cleanly.
- Local PowerPoint evidence binds the exact environment and subjects, uses three
  distinct one-owner role receipts, and supports only environment-bounded
  compatibility and fidelity wording.
- The applicable focused tests and milestone validators pass under strict TDD,
  with expected fail-closed rejection asserted by a passing harness.
