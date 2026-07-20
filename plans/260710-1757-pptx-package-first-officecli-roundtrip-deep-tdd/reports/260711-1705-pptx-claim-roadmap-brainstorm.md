---
title: 'PPTX Claim-Driven Next-Steps Brainstorm'
description: 'Approved decision report and reordered roadmap for validated edited export, OfficeCLI containment, packaging smoke, feature matrix expansion, and protected PowerPoint evidence.'
status: approved
date: '2026-07-11'
sourcePlan: '../plan.md'
incorporatedInto: '../plan.md'
requestedModes: []
targetClaims: [3, 4, 5]
architectureConstraints:
  - 'Keep the five-level release claim ladder'
  - 'OfficeCLI remains external and administrator-provided'
  - 'No new product UI beyond existing fidelity surfaces'
---

# PPTX Claim-Driven Next-Steps Brainstorm

## Executive Summary

The approved strategy replaces the proposed strict sequence `1 -> 2 -> 3 -> 4 -> 5`
with a claim-driven dependency sequence:

1. Establish the minimum canonical feature-matrix contract while implementing
   Windows OfficeCLI containment in parallel.
2. Connect real native re-import and contained OfficeCLI qualification validators
   to the existing edited-export transaction, then release claim level 3.
3. Complete Docker and Electron smoke tests against real packaged artifacts.
4. Promote preserve-only capabilities row by row, then release claim level 4 only
   for rows with complete evidence.
5. Provision a disposable protected PowerPoint runner after level-4 evidence
   subjects are stable, then enable claim level 5.

The route, transaction engine, immutable package lifecycle, and evidence contracts
already exist. The main risk is not missing architecture. It is enabling claims
before the validators, containment, capability scope, and artifact lineage are
actually qualified.

## Approved Requirements

### Expected Output

- One decision report.
- One reordered roadmap spanning all five priorities.
- Tasks, dependencies, gates, tests, stop conditions, risks, and success metrics.

### Acceptance Criteria

- The roadmap is actionable down to workstream, task, gate, and validator.
- Claim level 3 ships before levels 4 and 5.
- Work may be reordered and parallelized according to real dependencies.
- Docker and Electron behavior is validated on built artifacts, not only source.
- Level 5 uses a GitHub Actions self-hosted disposable Windows VM with licensed
  PowerPoint and protected evidence signing.

### Scope

Included:

- Validated edited-export and qualification validators.
- Windows Job Object containment and restricted execution for OfficeCLI.
- Docker and Electron package smoke tests.
- Preserve-only feature-matrix expansion.
- Protected PowerPoint evidence provider.

Excluded:

- New product UI or unrelated editor features.
- Universal PowerPoint editability.
- Bundling OfficeCLI in Docker or Electron.
- Replacing the five-level claim ladder.
- Treating local/manual PowerPoint runs as authoritative evidence.

### Primary Touchpoints

- `server/services/validated-edited-export.js`
- `server/services/pptx-import/transactional-export-validators.js`
- `server/services/pptx-import/mutation-transaction.js`
- `server/services/pptx-import/transactional-patch-planner.js`
- `server/services/pptx-import/importer.js`
- `server/services/pptx-import/officecli/`
- `server/services/pptx-import/*-feature-matrix.js`
- `server/services/pptx-import/presentation-capabilities.js`
- `server/services/pptx-import/complex-object-policy.js`
- `server/services/pptx-import/fidelity-contract.js`
- `server/services/pptx-import/evidence/`
- `server/routes/pptx-edited-export.js`
- `server/routes/presentations.js`
- `client/src/hooks/use-export-actions.js`
- `client/src/components/PptxFidelityPanel.jsx`
- `scripts/pptx-package-claim-gate.js`
- `.github/workflows/`
- `Dockerfile`
- `electron-builder.yml`

## Problem-First Analysis

### 1. Solution-Jumping Diagnosis

The five proposed tasks are symptoms of one deeper gap: NavSlides cannot yet
produce an independently verifiable chain from an editor mutation to an honest
release claim about the resulting PPTX.

The edited-export endpoint exists but is intentionally unavailable. Packaging
checks inspect declarations more than final artifacts. Capability matrices use
inconsistent terms and granularity. Level-5 evidence contracts exist without an
authoritative provider.

### 2. Underlying Problem

Users need an edited PPTX that preserves unsupported package content and fails
safely when NavSlides cannot prove the change. Maintainers need release claims
that match exact evidence, target platform, feature rows, and artifact lineage.
The current implementation cannot enable those claims end to end.

### 3. Assumption Challenges

| Assumption                                  | Risk if wrong                                                    | Validation                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Edited-export can finish before containment | OfficeCLI executes outside the required security boundary        | Availability stays false unless containment qualification passes |
| Job Object equals sandbox                   | Descendants die but process still reads app data or uses network | Physical descendant, token, ACL, app-data, and egress tests      |
| Full matrix completion must precede export  | Level 3 waits indefinitely for open-ended feature work           | Use a canonical contract plus a small promoted row set           |
| Static packaging scan proves absence        | Renamed or nested payload reaches the artifact                   | Extract final artifacts and inventory files/executables          |
| OfficeCLI validation proves semantics       | Structurally valid package contains the wrong edit               | Production native re-import and matrix-aware semantic comparison |
| A machine with PowerPoint is a provider     | Evidence is mutable, stale, or tied to the wrong artifact        | Protected artifact-only workflow with signed receipts            |

### 4. Problem Statement

Imported-PPTX users cannot yet rely on edited roundtrip export because the
production qualification validators are unavailable, OfficeCLI containment is
unproven, feature scope is fragmented, packaging evidence is incomplete, and
PowerPoint evidence has no protected provider. Success means independently
verified claims that advance from level 3 to 5 without overstating support or
blocking lower claims when higher-level infrastructure is unavailable.

### 5. Alternative Framings

#### Frame A: Export Feature Completion

Focus on wiring the existing route and validators. This produces visible progress
but fails if semantic scope and process containment remain implicit.

#### Frame B: Security and Platform Hardening

Finish containment and packaging before export. This is safer but can delay user
value and still leaves the semantic qualification contract unresolved.

#### Frame C: Evidence Pipeline Completion

Treat each feature as one input to a claim pipeline. Define exact subjects,
qualification predicates, artifact provenance, and independent gates. This is the
approved framing because it keeps lower claims releasable and prevents false
confidence.

### 6. Evidence Status

Overall status: **medium-to-strong implementation evidence, weak physical-platform
evidence**.

- Strong: immutable package lifecycle, source authority, mutation transaction,
  fail-closed endpoint, claim schemas, and negative evidence tests.
- Medium: typed OfficeCLI gateway, bounded runner, packaging scanner, feature
  matrices, and edited-roundtrip test skeletons.
- Weak: physical Windows process containment, real OfficeCLI integration,
  built-artifact smoke, protected PowerPoint rendering, and positive level-5
  evidence.

### 7. Validation Plan

- Run one real level-3 vertical slice before broad matrix expansion.
- Use physical Windows fixtures for containment properties that mocks cannot prove.
- Inspect and start final Docker/Electron artifacts.
- Promote matrix rows only with fixtures, semantic comparison, patch evidence, and
  adjacent preserve-only checks.
- Run the provider only against immutable release artifacts addressed by digest.
- Reject the design if any claim can pass using missing, local, stale, skipped,
  self-authored, or mismatched evidence.

### 8. Stakeholder Message

> Keep the five goals and claim ladder, but execute dependency-first. Lock the
> matrix contract and containment first, then ship one real level-3 edited-export
> slice. Packaging, row-by-row matrix expansion, and the protected PowerPoint
> provider raise confidence to levels 4 and 5 without making expensive
> infrastructure block lower-value releases.

## Evaluated Delivery Approaches

| Approach                       | Advantages                                                | Disadvantages                                        | Decision |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------- | -------- |
| Strict `1 -> 5` sequence       | Simple tracking                                           | Violates dependencies; export stays fake or disabled | Rejected |
| Platform and full matrix first | Strong safety baseline                                    | Delays value; matrix scope is open-ended             | Rejected |
| Claim-driven vertical slices   | Correct dependencies; early level 3; progressive evidence | Requires disciplined gates and lineage               | Approved |

## Target Dependency Model

```text
G0 canonical matrix contract
  |-- native semantic qualification -------\
  `-- exact level-3 subject definition      |
                                             |--> G2 validated edited export
G1 Job Object + restricted containment -----/
                  |
                  `--> G3 artifact packaging smoke

G2 + row-by-row expansion --> G4 feature editability
G4 stable subject/evidence --> protected provider --> G5
```

## Reordered Roadmap

## Wave 0: Canonical Contract and Baseline

### Objective

Define one minimum capability contract that can qualify level 3 without waiting
for every preserve-only feature to become editable.

### Tasks

1. Define a versioned canonical matrix schema with:
   - stable row ID and family;
   - exact property or operation scope;
   - import tier and edited-export tier;
   - claim ceiling;
   - source-authority rule;
   - patch adapter identifier;
   - fixtures and required tests;
   - preservation or blocking reason;
   - schema version and content hash.
2. Map existing primitive, chart, complex-object, and presentation rows into this
   schema without broadening claims.
3. Mark only already supported patch operations as promoted.
4. Make unknown rows fail closed.
5. Derive product DTO, patch-planner policy, corpus feature rows, and claim subject
   from the same matrix version/hash.
6. Normalize tier vocabulary to:
   - `native-editable`;
   - `structured-partial`;
   - `replace-only-visual`;
   - `preserved-opaque`;
   - `unsupported-blocking`.
7. Repair the provider lane mismatch:
   - policy requires `protected-powerpoint-provider`;
   - composite lookup currently uses `protected-provider`.
8. Baseline claims 1-2 and assert claims 3-5 remain fail-closed.

### Gate G0

- Every runtime and evidence row has one stable identity.
- No broad row implies unsupported sub-properties.
- Unknown or unmapped content cannot reach an adapter.
- UI, planner, corpus, and evidence report the same matrix hash.
- A local/manual provider cannot satisfy level 5.

### Validators

```powershell
npx vitest run server/services/pptx-import/primitive-feature-matrix.test.js
npx vitest run server/services/pptx-import/chart-support-matrix.test.js
npx vitest run server/services/pptx-import/complex-object-policy.test.js
npx vitest run server/services/pptx-import/presentation-capabilities.test.js
npx vitest run server/services/pptx-import/evidence/release-claim-policy.test.js
npx vitest run server/services/pptx-import/evidence/composite-run.test.js
npm run test:pptx:phase13
npm run test:corpus
```

### Stop Conditions

- Stop promotion if a row lacks exact property scope or a source-authority rule.
- Do not redesign all feature adapters in this wave.
- Do not enable edited-export from matrix completion alone.

## Wave 1A: Windows OfficeCLI Containment

### Objective

Prove that every OfficeCLI process executes inside a Windows boundary that
terminates descendants, limits resources, and prevents access outside its job
workspace.

### Architecture

Use a narrow repository-owned Windows containment launcher:

1. Validate a typed job contract.
2. Create a Job Object with kill-on-close.
3. Apply process-count and resource limits.
4. Create a restricted worker token.
5. Launch OfficeCLI suspended.
6. Assign it to the Job Object before resume.
7. Apply private workspace ACLs.
8. Monitor timeout, cancellation, output overflow, and shutdown.
9. Close the Job Object to terminate the entire tree.
10. Return bounded JSON diagnostics without raw paths or document content.

The launcher is not OfficeCLI and does not violate the external-binary policy.
Direct Node `spawn()` remains insufficient because assignment after a normal
spawn creates an escape race.

### Tasks

1. Route version probing and all gateway operations through the same containment
   boundary.
2. Bind qualification to exact binary path, hash, version, launcher version,
   containment policy, and platform.
3. Add fake executables for child/grandchild creation, floods, hangs, partial
   writes, path access, and network attempts.
4. Prove restricted identity cannot access:
   - `server/data`;
   - Electron application data;
   - unrelated job workspaces;
   - user profile secrets.
5. Add explicit egress verdict and fail closed when the target cannot enforce it.
6. Preserve one host-wide weighted admission budget.
7. Keep mutation disabled on every target without proven containment.

### Gate G1

- OfficeCLI cannot execute before Job Object assignment.
- Timeout, cancellation, server shutdown, and output overflow kill descendants.
- No failed job publishes a revision or retains an active workspace.
- App-data and cross-workspace reads are denied.
- Linux, macOS, and Docker reject before workspace creation or spawn.
- The current hardcoded `descendantTermination: false` is replaced by measured
  containment evidence.

### Validators

```powershell
npx vitest run server/services/pptx-import/officecli/
npx vitest run server/routes/pptx-import.test.js
npm run lint
npm run test
```

Required physical Windows tests:

- child/grandchild termination;
- restricted-token identity;
- workspace ACL isolation;
- server and Electron app-data denial;
- egress denial;
- nested-job and shutdown behavior.

### Stop Conditions

- Do not enable OfficeCLI mutation with Job Object tree kill alone.
- Do not use `taskkill` as the primary containment guarantee.
- Do not run version probes through an uncontained side path.

## Wave 1B: Production Qualification Validators

### Objective

Enable one real validated edited-export vertical slice and satisfy claim level 3.

### Native Re-Import Validator

1. Materialize the staged candidate in a private validation workspace.
2. Re-import through the production `importPptxFile()` entrypoint.
3. Redirect media and temporary outputs away from normal uploads.
4. Canonicalize the resulting projection.
5. Compare only promoted matrix rows against `expectedProjection`.
6. Return structured differences by row ID, property, source reference, expected
   value, and actual value.
7. Delete or quarantine validation outputs according to transaction outcome.

### OfficeCLI Validator

1. Call only the typed `validatePackage()` gateway operation.
2. Require the G1 containment qualification.
3. Record binary hash, OfficeCLI version, launcher version, policy digest, and
   validation result.
4. Never call the binary directly from export code.

### Qualification Service

Availability is true only if:

- current package head exists;
- source map and canonical projection match the current generation;
- pending journal is patchable;
- package security state permits edited export;
- matrix version is accepted;
- native re-import validator is operational;
- OfficeCLI binary and containment are qualified;
- target platform supports the required lane.

### Tasks

1. Replace `QUALIFIED_VALIDATORS_UNAVAILABLE` with explicit qualification
   predicates and reason codes.
2. Inject production `nativeReimport` and `officeCli` validators into the existing
   mutation service.
3. Keep one transaction engine and one authoritative endpoint.
4. Add atomic no-publication assertions for every validation failure.
5. Exercise stale generation, idempotent retry, cancellation, restart recovery,
   and publication point-of-no-return.
6. Keep original, edited revision, and reconstructed export as honest distinct
   surfaces.

### Gate G2: Claim Level 3

- A real plain-text or basic-primitive mutation exports a validated PPTX.
- ZIP/OPC, security, OfficeCLI, native semantic, and impact validators pass.
- Unknown and untouched parts remain byte-identical.
- Any failed layer preserves the previous head and immutable original.
- Retry with the same idempotency key returns one durable result.
- Product wording does not imply PowerPoint compatibility or universal
  editability.

### Validators

```powershell
npx vitest run server/services/pptx-import/edited-roundtrip.test.js
npx vitest run server/services/pptx-import/mutation-transaction.test.js
npx vitest run server/services/pptx-import/transactional-patch.test.js
npx vitest run server/routes/pptx-edited-export.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

### Stop Conditions

- Do not infer validator readiness from executable presence.
- Do not compare unsupported preserve-only properties as editable semantics.
- Do not let production re-import write into normal media storage.
- Do not publish when any validator is skipped or unavailable.

## Wave 1C: Docker and Electron Artifact Smoke

### Objective

Validate final target artifacts and runtime capability behavior.

### Docker Tasks

1. Build from the exact release commit.
2. Inspect image layers and extracted filesystem.
3. Prove no OfficeCLI binary, renamed payload, or runtime downloader exists.
4. Start the image and run health checks.
5. Probe fidelity capability:
   - original recovery available;
   - OfficeCLI mutation disabled;
   - no unsupported workspace or spawn attempt.
6. Record image digest, executable inventory, and capability response.

### Electron Windows Tasks

1. Resolve Electron version drift between `package.json` and
   `electron-builder.yml`.
2. Build unpacked resources and installer from the release commit.
3. Extract resources and inspect ASAR content.
4. Prove OfficeCLI is absent.
5. Inventory and hash the containment launcher separately.
6. Start the packaged app and embedded server.
7. Without configured OfficeCLI, verify safe disabled state.
8. With a qualified external binary, verify G1/G2 capability state.
9. Record installer and unpacked artifact hashes.

### Gate G3

- CI invokes the package absence gate on final artifacts.
- Artifact and executable inventories are stored with hashes.
- No runtime downloader is present.
- Runtime capability matches target policy.
- Docker never attempts OfficeCLI work.
- Electron enables mutation only with a qualified external binary and containment.

### Validators

```powershell
docker build -t navslides-pptx-smoke .
npm run electron:build:win
npm run test:pptx:package:no-officecli -- <docker-root> <electron-resources>
npm run test:pptx:phase13
```

The authoritative workflow must provide Docker on a capable runner. Local Docker
absence is an infrastructure limitation, not passing evidence.

### Stop Conditions

- Do not treat source scanning as final artifact evidence.
- Do not use stale `dist-electron` output.
- Do not pass Electron smoke while package/runtime Electron versions disagree.

## Wave 2: Feature-Matrix Expansion

### Objective

Promote only independently evidenced rows and satisfy claim level 4 incrementally.

### Row Promotion Protocol

For every row:

1. Split the row to exact property or operation granularity.
2. Add a minimal fixture and an adjacent-edit preservation fixture.
3. Define authoritative source mapping.
4. Define exact touched-part and relationship closure.
5. Implement or assign a reviewed patch adapter.
6. Run native semantic comparison.
7. Run edited roundtrip.
8. Verify unknown siblings and preserve-only bytes remain unchanged.
9. Add corpus and claim evidence.
10. Recompute matrix hash and evidence subject.
11. Promote only after every required artifact passes.

### Promotion Order

1. Plain rich-text properties with stable source identity.
2. Basic geometry, transform, solid fill, and stroke.
3. Image replacement and crop.
4. Table cells, borders, merge state, sizing, and margins as separate rows.
5. Chart families by native type and workbook/cache authority mode.
6. Slide structure, notes, and hidden state.
7. SmartArt, vectors, media behavior, transitions, timing, custom XML, and
   unknown extensions last.

### Gate G4: Claim Level 4

- Every editable claim points to one promoted row.
- Every promoted row has fixture, adapter, semantic, roundtrip, and preservation
  evidence.
- Preserve-only rows cannot reach mutation adapters.
- Broad family labels do not imply untested sub-features.
- The release claim lists exact rows and the exact matrix hash.

### Validators

```powershell
npx vitest run server/services/pptx-import/primitive-feature-matrix.test.js
npx vitest run server/services/pptx-import/chart-roundtrip.test.js
npx vitest run server/services/pptx-import/complex-object-policy.test.js
npx vitest run server/services/pptx-import/presentation-capabilities.test.js
npx vitest run server/services/pptx-import/slide-structure-roundtrip.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

### Stop Conditions

- Do not promote an entire family from one passing subtype.
- Do not treat “display mapping” as native editability.
- Do not mutate a preserve-only row to make adjacent supported edits easier.

## Wave 3: Protected PowerPoint Provider

### Objective

Produce authoritative PowerPoint open, render, behavior, and visual evidence for
claim level 5 without blocking levels 1-4.

### Stage 3A: Contract Before Infrastructure

1. Finalize provider lane naming and schema.
2. Define provider job IDs from the exact evidence subject hash.
3. Define signed input and output receipts.
4. Pin release commit, workflow identity, artifact digest, policy digest, Office
   build, fonts, locale, DPI, renderer, and corpus manifest.
5. Implement independent trust-root and append-only epoch verification.
6. Reject replay, wrong commit, wrong digest, wrong policy, self-golden, stale
   baseline, missing font, skipped row, and local/manual evidence.
7. Keep provider outage scoped to level 5.

### Stage 3B: Disposable Self-Hosted Windows VM

1. Create an organization-owned runner group and protected environment.
2. Provision licensed PowerPoint on a disposable Windows VM.
3. Trigger only from protected commits or tags.
4. Do not checkout or execute pull-request code.
5. Download immutable build artifacts by verified digest.
6. Pin Windows image, Office build, fonts, locale, DPI, and rendering settings.
7. Start from a clean Office profile.
8. Disable macros, add-ins, active content, and external links.
9. Apply network restrictions and minimal permissions.
10. Use dialog, hang, process-tree, and cleanup watchdogs.
11. Perform PowerPoint open, render, and required behavior checks.
12. Sign provider receipts using a protected key.
13. Upload restricted evidence artifacts.
14. Destroy or revert the VM after every job.

### Gate G5: Claim Level 5

- Positive end-to-end evidence comes from the exact release artifact.
- Independent verification validates provider signature, workflow identity,
  release commit, subject hash, policy digest, and evidence epoch.
- Local/manual, stale, self-comparison, and mismatched evidence fails.
- Provider outage does not alter level-3 or level-4 evidence.
- Product wording may use PowerPoint compatibility or visual-fidelity terms only
  for corpus and rows covered by current provider evidence.

### Stop Conditions

- Do not provision the expensive runner before level-4 subjects stabilize.
- Do not let the protected runner execute PR checkout code.
- Do not store signing keys in the repository or general-purpose runner context.
- Do not promote 1:1 wording from informative local runs.

## Cross-Cutting Gates

### Security

- Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages remain
  original-recovery-only in the first release.
- Every external process receives guarded immutable bytes only.
- Paths, raw XML, document text, tokens, and keys remain absent from diagnostics.

### Transaction Integrity

- Candidate bytes remain private until all required validation passes.
- Any failure preserves the prior package head and original.
- Idempotency and cancellation outcomes are durable.
- Provider failure changes only the matching level-5 claim entry.

### Evidence Integrity

- Every artifact belongs to one commit/build/run lineage.
- Evidence subject includes package, projection, source map, journal, matrix, and
  policy versions.
- Missing, skipped, stale, placeholder, or unsigned required evidence fails.

### Product Honesty

- Level 3 means valid edited package, not PowerPoint compatibility.
- Level 4 names exact editable rows.
- Level 5 wording is scoped to provider-covered corpus and capabilities.

## Success Metrics

| Metric              | Level 3 target                                | Level 4 target                             | Level 5 target                            |
| ------------------- | --------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| Export transaction  | Atomic success/failure on promoted MVP rows   | Same for every promoted row                | Same package subject consumed by provider |
| Untouched parts     | Byte-identical outside declared closure       | Byte-identical for every promoted scenario | Verified artifact digest unchanged        |
| Semantic validation | Native re-import passes MVP rows              | Passes all claimed rows                    | Provider behavior agrees for covered rows |
| Process containment | Child/grandchild cleanup and isolation proven | No regression                              | Separate provider isolation proven        |
| Packaging           | Docker disabled, Electron qualified-only      | Same                                       | Provider artifact-only handoff            |
| Claim behavior      | Level 3 independently releasable              | Exact row list and matrix hash             | Fresh protected PowerPoint evidence       |
| Failure isolation   | No head publication                           | No unrelated row promotion                 | Lower claims unchanged                    |

## Risks and Mitigations

| Risk                                                    | Severity | Mitigation                                                                     |
| ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| Windows launcher introduces native maintenance burden   | High     | Keep protocol narrow, versioned, independently tested, and Windows-only        |
| Assignment race lets descendants escape                 | Critical | Suspended launch, assign, then resume                                          |
| Production re-import pollutes normal media storage      | High     | Dedicated validation workspace and storage adapter                             |
| Matrix migration changes existing capability labels     | Medium   | Versioned mapping and backward-compatible DTO migration                        |
| Artifact scanner misses renamed executable              | High     | Executable inventory, hashes, layer extraction, and runtime checks             |
| Office update or first-run dialog causes provider drift | High     | Pinned image/build/profile plus watchdog and disposable VM                     |
| Signing key or runner compromise                        | Critical | Protected environment, minimal permissions, artifact-only input, key isolation |
| Provider cost blocks releases                           | Medium   | Keep levels 1-4 independently releasable                                       |
| Broad rows overclaim editability                        | High     | Property-level rows and mandatory adjacent-edit fixtures                       |

## Recommended Execution Order

1. Start Wave 0 and Wave 1A in parallel.
2. Begin native validator development during Wave 1A, but keep availability false.
3. Close G1, then close G2 and release claim level 3.
4. Complete G3 using final capability wiring and real artifacts.
5. Promote Wave-2 rows independently and release exact level-4 coverage.
6. Complete provider contract tests.
7. Provision the disposable PowerPoint VM only after level-4 subject stability.
8. Close G5 and enable tightly scoped level-5 wording.

## Final Decision

Use the claim-driven vertical-slice approach. The first product milestone is a
real level-3 validated edited-export, not full feature parity. Canonical matrix
scope and Windows containment are prerequisites. Packaging validates real
artifacts. Level 4 grows row by row. Level 5 uses a protected disposable
PowerPoint provider and never blocks lower claims.

## Next Steps

1. Convert this approved decision into a TDD implementation plan.
2. Reconcile the existing 13-phase plan with Waves 0-3 rather than creating a
   second transaction architecture.
3. Preserve the existing fail-closed route until G0 and G1 are complete.
4. Assign owners for Windows containment, package CI, feature-row promotion, and
   protected provider operations.

## Unresolved Questions

No unresolved question blocks planning. Exact implementation technology for the
narrow Windows launcher and the protected signing-key service should be selected
during the TDD plan after a focused feasibility spike.
