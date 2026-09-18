---
phase: 13
title: 'CI platform security and release claim gates'
status: in-progress
effort: '4-6 weeks'
dependsOn: [1, 3]
priority: P0
gates: [G3, G4-release, G5]
---

# Phase 13: CI platform security and release claim gates

<!-- Updated: Validation Session 1 - claim level 5 stays disabled until an organization-owned protected licensed PowerPoint runner exists. -->

## Overview

Turn all phase contracts into reproducible CI, platform, security, fuzz, resource, packaging, and release gates. Generate one fresh composite evidence run from the exact release candidate and fail closed unless every prerequisite for the advertised claim level is present, aligned, authentic, and passing.

Phase 13 owns authoritative built-artifact evidence and protected release
infrastructure. Source/config packaging scans remain development checks. Build
once, then pass immutable artifacts by digest to smoke and provider workflows.

## Required CI Lanes

Lanes are required by claim level and supported target, not universally. Phase 13 establishes the gate after Phases 1 and 3, then consumes Phase 2/4/5/7-12 capability evidence only when the requested claim needs it.

| Claim                                       | Required capability lanes                                                                                                                                                            | Microsoft provider |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 1. Original recovery                        | native import, unit/lint, package guards, durable jobs, ownership, exact original hash, migration/restart                                                                            | no                 |
| 2. Package preservation                     | level 1 plus no-edit exact bytes, complete OPC/unknown-part inventory retention, storage transaction/recovery, and package security checks; no edited export implied                 | no                 |
| 3. Valid edited package                     | level 2 plus edited untouched/unknown-part preservation, qualified OfficeCLI target, process containment, ZIP/OPC graph, native re-import, impact, resource, and security validation | no                 |
| 4. Feature editability                      | level 3 plus exact promoted-row semantic, journal, patch, roundtrip, feature-matrix coverage, and Phase 12 central mutation-surface gating                                           | no                 |
| 5. PowerPoint compatibility/visual fidelity | level 4 plus protected Microsoft PowerPoint open/render/behavior evidence on a disposable Windows runner                                                                             | yes                |

Docker/Electron packaging, malicious-corpus/fuzz, resource/stress, privacy, and rollback lanes are selected for the deployed target and exercised surfaces. The composite gate consumes exact artifacts from one commit/build/run lineage. Informative LibreOffice or local Office/OfficeCLI rendering never satisfies the level-5 provider field.

Level 5 is also required for product wording that claims PowerPoint compatibility, PowerPoint-open behavior, or 1:1 visual fidelity. Levels 1-4 must not imply those properties.

First-release policy: publish level 5 as `unavailable`, not `failed` or manually
attested, until the organization provisions the protected licensed runner and
trust root. The cloud/hypervisor destruction source and external KMS/HSM vendor
are deliberately selected during G5 provisioning, then pinned in protected
policy. Local/manual PowerPoint evidence remains informative only. Lower selected
claims may release independently.

## Target Claim Ceilings

| Target state                                                    | Maximum first-release claim      |
| --------------------------------------------------------------- | -------------------------------- |
| Docker/Linux                                                    | Level 2                          |
| Windows Electron/server without qualified external OfficeCLI    | Level 2                          |
| Windows with direct manifest-pinned OfficeCLI execution         | Level 2; no containment claim    |
| Windows with exact external OfficeCLI and proven G1 containment | Level 3, then exact level-4 rows |
| Protected disposable PowerPoint provider                        | Scoped level 5                   |

## Reproducibility Contract

- Pin Node/npm lockfile, OS runner image, fonts, OfficeCLI assets/hashes, Office/PowerPoint build, locale, DPI, rendering settings, corpus manifest, and thresholds.
- Build/package once; tests and provider rendering consume the same artifact/revision hashes.
- Store command versions, environment manifest, artifact hashes, and test shard map.
- Every claim manifest requires cryptographic attestation from protected CI; level 5 additionally requires the protected PowerPoint provider attestation. Artifact hashes in an unsigned self-authored manifest are informative only.
- The producing workflow is triggered only from protected commits/tags, pins actions by commit SHA, requires environment approval, and receives immutable artifacts without executing pull-request checkout code.
- The disposable PowerPoint guest never receives an evidence signing key. It
  emits an unsigned, hash-bound result receipt to the organization control plane.
  After the infrastructure control plane proves the VM was terminated/deallocated
  and its ephemeral disk destroyed, a separate organization-owned KMS/HSM signing
  service verifies workflow identity, artifact/subject/result hashes, and
  destruction attestation before issuing the provider signature.
- The verifier pins OIDC issuer, repository, workflow path/ref, protected environment, artifact/policy digest, release commit, transparency evidence, and monotonic evidence epoch.
- A protected release authority owns an append-only epoch ledger per release channel, claim ID, and policy digest. Release workflows are serialized by that key, verify the latest signed ledger entry and transparency inclusion, allocate exactly `previous + 1`, and publish a signed successor linked by predecessor hash only after the claim verdict is final. Rollback/revocation creates a higher epoch, never decrements or rewrites history.
- Independent verification resolves the highest transparency-backed ledger entry for that key and rejects older, forked, missing-predecessor, concurrently duplicated, or policy-mismatched epochs. If the ledger or transparency service is unavailable, only the affected new claim release fails closed.
- Shards cannot omit corpus rows; aggregation requires exact manifest coverage.
- Baseline or threshold changes require explicit review and cannot be generated from the candidate under test without trusted provider lineage.
- CI logs/artifacts follow corpus privacy and retention policy.

## Release Gate

Evaluate independently:

- exact original availability and hash;
- no-edit exact bytes;
- package manifest/relationship validity;
- supported edited semantic roundtrip;
- untouched-part preservation;
- security/non-execution;
- resource budgets;
- platform packaging/provenance;
- PowerPoint open/render and feature visual thresholds;
- complete feature/tier coverage;
- product wording requested for the release.

For the lanes selected by the requested claim/target matrix, the gate rejects missing artifacts, stale timestamps, wrong hashes, wrong OfficeCLI/Office/font/provider versions, placeholder images, self-comparison, incomplete shards, skipped required tests, unexplained drift, unsupported claim wording, or unsigned evidence manifests where signing is required.

## TDD Matrix

| Test first                         | Expected red                                      | Green behavior                                                                        |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Current debt baseline              | 1:1 could be inferred                             | Release gate rejects placeholder/stale evidence                                       |
| Missing CI shard                   | Aggregate still passes                            | Exact corpus/feature coverage required                                                |
| Wrong binary/font/Office build     | Evidence accepted                                 | Provenance mismatch fails                                                             |
| Rewritten manifest and hashes      | Tampered evidence appears internally consistent   | Protected-runner/provider attestation fails verification                              |
| Older valid attestation            | Replayed evidence satisfies newer release         | Release commit, policy digest, and monotonic epoch fail verification                  |
| Concurrent release epochs          | Two runs allocate the same successor              | Protected per-key serialization and append-only predecessor chain allow one successor |
| Ledger rollback/fork               | Deleted pointer makes old evidence appear latest  | Transparency-backed highest epoch and predecessor verification reject it              |
| Malicious pull request             | Protected runner executes PR scripts              | Artifact-only protected workflow refuses untrusted checkout                           |
| Candidate self-golden              | SSIM passes                                       | Provider lineage check rejects                                                        |
| Required test skipped              | Green job                                         | Gate treats skip/missing as failure                                                   |
| Malicious ZIP/XML deck             | Host/network affected before parser policy        | Raw-directory/XML pre-parser gate rejects or contains it                              |
| Resource overrun                   | Host destabilized                                 | Budget failure, cleanup, no publication                                               |
| Docker/Electron contains OfficeCLI | First-release no-bundling policy violated         | Packaging test fails; disabled/configuration capability state remains correct         |
| Upgrade regression                 | New OfficeCLI deploys                             | Compatibility suite blocks and rollback works                                         |
| Migration rollback                 | Legacy access lost                                | Previous version/original remains usable                                              |
| Evidence privacy                   | Customer content public                           | Approved corpus and restricted artifacts only                                         |
| Marketing claim mismatch           | Higher wording ships                              | Claim-level policy blocks release                                                     |
| Lower claim without provider       | Original recovery release is blocked              | Only requested claim-level lanes are required                                         |
| Guest signs its own receipt        | Compromised VM forges authoritative evidence      | Guest has no signing key; external signer verifies control-plane destruction first    |
| Guest claims self-destruction      | Deleted marker substitutes for VM teardown        | Cloud/hypervisor control-plane attestation proves VM and ephemeral disk destruction   |
| G4 UI bypass                       | Promoted server row ships through ungated control | Phase 12 mutation-registration and server-authorization audit blocks release          |

## Implementation Steps

1. Inventory current GitHub Actions, local scripts, corpus, oracle, Docker, and Electron coverage.
2. Add deterministic composite-run orchestration, artifact manifest aggregation,
   anti-replay verification, protected-CI attestation for every claim, and
   additional `protected-powerpoint-provider` attestation for level 5.
3. Add a protected build-once workflow that emits signed Docker OCI and Electron
   artifact manifests. Downstream jobs download by digest and never rebuild.
4. Wire fast PR lanes and scheduled/release provider, fuzz, resource, and packaging lanes.
5. Build Docker artifact smoke: inspect every OCI layer and merged filesystem,
   inventory executable signatures/hashes, start the image, import a synthetic PPTX,
   probe fidelity capability, verify exact original recovery, and prove no OfficeCLI
   workspace/process path.
6. Resolve Electron version drift, then inspect NSIS/portable/unpacked/ASAR
   contents, hash executable inventory and the allowed first-party launcher, start
   the packaged app, probe no-OfficeCLI and qualified-external capability states,
   and verify full shutdown.
7. Define the separate protected release workflow contract. Provision an
   ephemeral GitHub Actions self-hosted runner on a disposable organization-owned
   Windows VM with licensed Office, pinned fonts, no interactive prompts, disabled
   macros/add-ins/external links, egress isolation, clean profiles, one-job runner
   registration, and forced teardown only after level-4 evidence subjects
   stabilize; until then level 5 remains unavailable.
8. Define durable `PackageJobRecord` provider jobs addressed by the full evidence
   subject hash, with idempotent IDs, immutable artifact handoff, unsigned
   hash-bound guest results, prompt watchdogs, cancellation, restart recovery,
   and cloud/hypervisor control-plane VM plus ephemeral-disk destruction evidence.
   The guest cannot assert its own destruction.
9. Add property fuzzers and a minimized malicious corpus with deterministic seeds.
10. Add process-wide weighted resource budgets for application-host import,
    OfficeCLI, native parser, vector conversion, raster, sync, and export jobs.
    Add a separate serialized provider-orchestrator quota and per-VM limits; never
    claim an in-process semaphore controls a remote disposable VM.
11. Add migration and OfficeCLI upgrade/rollback matrices.
12. Implement the protected, serialized, append-only per-channel/claim/policy epoch ledger, independent highest-epoch verifier, rollback/revocation rules, and concurrent-release tests.
13. Require fresh claim-selected composite evidence in the fail-closed SLA CLI/harness; remove static evidence shortcuts and converge on one evaluator.
14. Add claim wording/tier matrix as a reviewed release input.
15. Add artifact access, redaction, retention, and deletion controls.
16. Run the full gate on a release candidate and record failures before enabling any claim.
17. Keep only the affected claim level fail-closed when provider or epoch infrastructure is unavailable; lower previously verified claim entries remain unchanged and independently releasable.
18. Implement an external provider-signing interface backed by the selected
    organization KMS/HSM. It accepts only protected-workflow identity,
    artifact/subject/result hashes, policy digest, control-plane destruction
    attestation, and epoch input. The provider guest has no credential capable of
    producing a claim-authoritative signature.
19. Make Phase 12's complete mutation-registration/server-authorization report a
    mandatory G4 artifact. Any ungated ribbon, panel, canvas, keyboard, clipboard,
    context-menu, store, autosave, or API path blocks row release.

## File Plan

- Modify `.github/workflows/` with scoped jobs and protected provider secrets.
- Modify PPTX test scripts and SLA CLI aggregation.
- Modify `Dockerfile`, `electron-builder.yml`, and packaging scripts to enforce first-release OfficeCLI absence and the correct disabled/configuration capability state.
- Add test harnesses under existing `scripts/`, `tests/`, and PPTX service conventions.
- Add generated reports to CI artifacts, not source-controlled mutable baselines unless policy explicitly requires reviewed fixtures.

## Verification

```powershell
npm run lint
npm run test
npm run test:corpus
npx vitest run server/services/pptx-import/sla-failclosed.test.js
npm run build
npm run test:e2e
```

Also run only the Docker, Electron, malicious-corpus, fuzz, resource, migration, Windows OfficeCLI, and PowerPoint-provider lanes selected by the claim/target matrix. The SLA command may pass only when the requested claim level has complete fresh evidence.

## Deep File Inventory

| Action | File/interface                                              | Planned change                                                  | Test impact             |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------------- | ----------------------- |
| Modify | `evidence/composite-run.js`, `claim-evaluator.js`           | One authoritative evaluator and canonical lane names            | Evidence/CLI tests      |
| Modify | `pptx-sla-1to1-cli.js`, `pptx-claim-composite.js`           | Require pinned trusted config and exact lineage                 | CLI tests               |
| Modify | `pptx-package-claim-gate.js`                                | OCI layers, ASAR/nested artifacts, executable signatures/hashes | Package scanner tests   |
| Modify | `Dockerfile`, `electron-builder.yml`, `prepare-electron.js` | Deterministic artifact inputs; resolve Electron drift           | Build/package tests     |
| Modify | Existing CI/release workflows                               | SHA-pin actions, build once, fail on missing artifacts          | Workflow contract tests |
| Create | Docker artifact smoke script/workflow                       | Inspect, start, import, capability probe, cleanup               | G3 Docker lane          |
| Create | Electron Windows artifact smoke script/workflow             | Extract, start packaged app, probe, shutdown                    | G3 Electron lane        |
| Create | Protected provider receipt/job contracts                    | Exact subject and negative trust tests                          | G5 contract tests       |
| Create | Protected artifact-only provider workflow                   | Disposable VM orchestration                                     | Physical provider lane  |
| Create | External provider signer and destruction verifier           | KMS/HSM signature only after control-plane teardown proof       | Trust/destruction tests |
| Create | Production trust config/epoch interfaces                    | Independent verification and rollback                           | Trust/ledger tests      |
| Delete | None                                                        | Existing diagnostics remain non-authoritative                   | Architecture tests      |

## Function and Interface Checklist

- [ ] Normalize `protected-powerpoint-provider` across policy and aggregation.
- [ ] Choose one authoritative `evaluateClaim()` composite path.
- [ ] Bind every lane receipt to release commit, workflow identity, artifact digest,
      matrix hash, policy digest, corpus hash, and fixed required test IDs.
- [ ] Inspect Docker layers and final merged root.
- [ ] Inspect Electron installer, portable, unpacked, ASAR, nested executables, and
      the exact allowed launcher digest.
- [ ] Start final artifacts and probe runtime capability ceilings.
- [ ] Keep provider input artifact-only with no repository/PR checkout.
- [ ] Keep every claim-authoritative signing credential outside the provider VM.
- [ ] Sign provider evidence only after independent control-plane proof of VM and
      ephemeral-disk destruction.
- [ ] Require Phase 12's complete central mutation-gating report for G4.

## Tests Before

### Packaging

| Red scenario                                    | Required result                         |
| ----------------------------------------------- | --------------------------------------- |
| Missing/stale artifact                          | Lane fails                              |
| OfficeCLI renamed or deleted in later OCI layer | Identity/layer scan detects it          |
| ASAR/nested executable not inspected            | Lane fails as incomplete                |
| Runtime downloader introduced                   | Policy fails                            |
| Container/app starts without API                | Smoke fails                             |
| Target capability exceeds ceiling               | Smoke fails                             |
| Original download hash differs                  | Smoke fails                             |
| Electron package/runtime version drift          | Build fails                             |
| Docker unavailable                              | Infrastructure failure, never skip/pass |

### Provider

| Red scenario                            | Required result                            |
| --------------------------------------- | ------------------------------------------ |
| PR-triggered provider job               | Refused before runner allocation           |
| Wrong artifact/commit/matrix/policy     | Refused before PowerPoint                  |
| Repository checkout on provider         | Policy failure                             |
| Local/manual or mutable runner evidence | Informative only                           |
| Office/font/locale/DPI drift            | Fail closed                                |
| First-run dialog/hang                   | Watchdog failure and VM destruction        |
| Macro/add-in/external-link activity     | Quarantine/fail                            |
| Self-golden or incomplete row set       | Reject                                     |
| VM destruction unverifiable             | No provider signature                      |
| Signing key visible in guest            | Policy and credential scan fail before run |
| Guest-generated destruction marker      | Rejected without control-plane attestation |
| Receipt replay                          | Subject/epoch verification fails           |
| Provider outage                         | Level 5 unavailable; levels 1-4 unchanged  |

## Refactor

Separate artifact producers, smoke consumers, provider consumers, and independent
verifier. No downstream lane may rebuild or select its own required test list.

## Tests After

- Signed build manifest ties Docker/Electron artifacts to one protected commit/run.
- Docker and Electron smoke receipts bind final artifact digest and runtime results.
- Exact promoted row IDs/matrix hash satisfy G4 without provider evidence.
- Disposable PowerPoint provider produces signed open/render/behavior evidence for
  the exact stable G4 subject.
- The external signer refuses a correct visual result when workflow identity,
  control-plane destruction evidence, subject hash, or epoch input is missing.
- Highest-epoch independent verification rejects replay, fork, downgrade, and
  wrong workflow identity.

## Dependency Map

```text
G0 claim/matrix contract + G1 physical containment + G2 validated export
  -> protected build-once artifacts
  -> G3 Docker/Electron artifact smoke
G2 + exact row evidence + Phase 12 mutation-surface gate -> G4 release claim
stable G4 subject -> disposable protected provider -> G5
```

## Debug and Reports

- `reports/phase-13/composite-evidence-manifest.json`
- `reports/phase-13/platform-release-matrix.json`
- `reports/phase-13/security-fuzz-results.json`
- `reports/phase-13/resource-stress-results.json`
- `reports/phase-13/migration-upgrade-rollback.json`
- `reports/phase-13/release-claim-verdict.json`

## Risks and Controls

- **Provider flakiness:** clean pinned runner, deterministic fonts/settings, retry only infrastructure failures, never threshold failures.
- **Protected-runner compromise:** no pull-request checkout/execution, immutable artifact-only handoff, pinned actions, environment approval, minimal permissions, and disposable VM.
- **Provider-forged evidence:** signing key remains in an external KMS/HSM service;
  a compromised guest cannot sign or attest its own destruction.
- **Cost/runtime growth:** fast PR subset plus complete scheduled/release matrix with exact shard coverage.
- **Evidence tampering:** artifact hashes, immutable run lineage, protected
  baseline review, protected-CI attestation for all claim manifests, and
  `protected-powerpoint-provider` attestation for level 5.
- **Privacy:** synthetic/licensed corpus, restricted artifacts, retention and redaction.
- **False release claim:** claim-ladder policy consumes the exact requested product wording and fails closed.

## Success Criteria

- [ ] Every lane required by the requested claim level and supported target passes; unrelated higher-level/provider lanes do not block lower claims.
- [x] One fresh composite manifest ties every artifact to the same release candidate and exact package revisions.
- [ ] Every claim manifest verifies against the approved protected-CI trust root;
      level 5 also verifies against the
      `protected-powerpoint-provider` trust root.
- [x] Replayed evidence, downgraded policy, unapproved workflow/ref, wrong release commit, or non-monotonic epoch fails closed.
- [ ] Protected PowerPoint jobs execute only immutable artifacts from protected commits/tags on disposable isolated runners.
- [ ] Docker OCI and final Electron artifacts are extracted, inventoried, started,
      capability-probed, and tied to one protected build lineage.
- [ ] Target claim ceilings prevent Docker or unqualified Windows artifacts from
      implying level 3 or higher.
- [ ] Provider signatures are issued externally only after artifact verification,
      test completion, and independent control-plane VM/ephemeral-disk destruction
      proof; the guest never possesses the signing key.
- [x] Without an organization-owned protected runner, release metadata marks level 5 unavailable and rejects local/manual evidence as claim-authoritative.
- [x] Provider outage or failed visual evidence blocks only claim level 5; the exact package remains validated and lower per-claim evidence entries remain unchanged.
- [x] Missing, stale, skipped, placeholder, self-comparison, provenance-mismatched, or incomplete evidence fails closed.
- [ ] Application-host weighted resource tests prove aggregate admission, timeout,
      cancellation, and cleanup; separate provider orchestration quotas and per-VM
      limits prove remote capacity without conflating the two boundaries.
- [ ] G4 cannot release until Phase 12 proves every production mutation entry point
      is centrally row-gated and independently server-authorized.
- [ ] OfficeCLI upgrade and application rollback paths preserve original/revision access.
- [x] Product wording cannot exceed the proven claim level or feature-tier matrix.
- [ ] All validators selected by the requested claim, supported target, and exercised surfaces pass; level-5 provider validators are not required for levels 1-4.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active protected-CI, protected-provider,
cloud/VM, external signer, independent teardown, Docker, Linux, macOS, native
launcher, and independent-approval requirements above. Those references remain
historical design context only and are not release prerequisites.

### Active Release and Claim Lanes

| Lane               | Active requirement                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical contract | Verify one current schema/version/matrix hash and exact local claim wording.                                                                                                                   |
| Package/security   | Run recursive package guards, active-content policy, layered edited-export validation, malicious fixtures, resource tests, migration/restart, and rollback checks.                             |
| Direct OfficeCLI   | Qualify and run only the exact configured OfficeCLI `1.0.135`, `33,111,928` byte, `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588` binary through the typed bounded gateway. |
| Windows artifacts  | Build the configured Electron NSIS installer and portable `.exe` from one release subject; hash, inspect, install or launch, capability-probe, and stop each with isolated app/data roots.     |
| Row editability    | Require exact per-row adapter/transaction evidence and a complete UI/store/hook/API mutation-surface audit with independent server authorization.                                              |
| Local PowerPoint   | Run the local Microsoft PowerPoint open/render/export/behavior oracle serially against the exact published package hash and Windows artifact subject.                                          |

OfficeCLI remains administrator-provided and unbundled. Inspect final artifacts to
prove there is no OfficeCLI binary, downloader, updater, launcher prerequisite,
or broader capability wording. Probe missing, wrong-version/hash, and exact
OfficeCLI configurations from both Windows artifact forms.

### Active Local Evidence and Release Gate

- One local evidence manifest binds commit/dirty-state digest, package and output
  hashes, matrix/corpus/policy/configuration/threshold hashes, commands,
  verifier hashes, OfficeCLI and PowerPoint identities, Windows/fonts/locale/DPI,
  Electron artifact hashes, invocation lineage, timestamps, outcomes, and
  artifacts.
- Hashes and three distinct owner receipts provide local integrity and
  traceability only. The same disclosed owner may approve `app-storage`,
  `security`, and `release`.
- Every claim-bearing representation states `authority:"local"` and discloses
  that profile isolation, network egress isolation, independent descendant
  containment, teardown attestation, independent attestation, and separation of
  duties are not proven.
- Compatibility and visual-fidelity wording is limited to the exact recorded
  local environment and corpus. LibreOffice, self-comparison, placeholders, and
  prior protected-provider evidence are never current claim authority.
- Lower claim levels remain valid independently when a higher local-oracle claim
  is unavailable or fails. Missing, stale, skipped, tampered, mixed-subject, or
  incomplete evidence fails only its exact subject.

### Active Execution and Verification

Run the baseline gate:

```powershell
npm run lint
npm run test
npm run test:corpus
npx vitest run server/services/pptx-import/sla-failclosed.test.js
npm run build
```

Also run focused evidence/wording, package/security, resource, migration,
OfficeCLI, Electron artifact, mutation-surface, and PowerPoint-oracle suites.
Build and smoke the NSIS and portable targets only. Electron, OfficeCLI, and
PowerPoint flows run serially, use isolated roots, and verify exact process
cleanup without representing the observation as independent teardown
attestation.

### Active Success Criteria

- `G3` passes only when both Windows artifacts share one release subject, are
  hashed and inspected, start successfully, report honest missing/wrong/exact
  capability states, and shut down with no observed attributable residual.
- `G4` passes only when every promoted exact row has current complete evidence and
  every production mutation surface is centrally matrix-gated and independently
  server-authorized.
- `G5` passes only when local PowerPoint opens the exact published hash without
  repair or blocking prompts, produces the required outputs/behavior, meets the
  approved thresholds, and the three one-owner role receipts bind the same exact
  local subject.
- All applicable validators pass, every failure preserves Original and the
  previous valid head, and release wording never exceeds the active local claim
  or tested row matrix.
