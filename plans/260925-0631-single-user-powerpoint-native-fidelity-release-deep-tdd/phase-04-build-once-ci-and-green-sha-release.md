---
phase: 4
title: 'Build-once CI and exact green-SHA release'
status: pending
priority: P0
effort: '4-6 engineer-days'
dependencies: [2, 3]
---

# Phase 4: Build-once CI and exact green-SHA release

## Context Links

- [Phase 2 version and docs governance](./phase-02-release-state-and-documentation-governance.md)
- [Phase 3 Vitest topology](./phase-03-vitest-topology-and-full-suite-performance.md)
- [CI workflow and reusable verification](../../.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml)
- [Release workflow](../../.github/workflows/release.yml)
- [Container supply-chain workflow](../../.github/workflows/reusable-container-supply-chain.yml)
- [Windows evidence workflow](../../.github/workflows/reusable-windows-qualification.yml)
- [Release target policy](../../config/release-target-policy.json)
- [Container vulnerability policy](../../config/container-vulnerability-policy.json)
- [Dockerfile](../../Dockerfile)
- [Client artifact manifest verifier](../../scripts/ci/verify-client-dist-manifest.mjs)
- [Release receipt verifier](../../scripts/ci/release-receipts.mjs)
- [Phase 15 Windows and PowerPoint evidence](./phase-15-powerpoint-oracle-and-windows-artifact-g3-g5.md)
- [Phase 16 release rehearsal](./phase-16-final-full-verification-and-release-rehearsal.md)

## Goal/Overview

Build the client once for an exact clean subject SHA and make Linux tests, the
prebuilt Docker image, and private Windows qualification consume those bytes.
The release subject is an existing strict SemVer tag resolving to that same
green SHA; no manual-version or timestamp-derived tag is allowed. A root receipt
joins exact-subject Linux and Windows child evidence before protected publication.

The release deliverable is the exact prebuilt Docker image, its digest and
GitHub artifact attestation evidence, the green-SHA root receipt, raw Trivy
report, SPDX SBOM, and container supply-chain receipt. HIGH/CRITICAL findings
under the [container vulnerability policy](../../config/container-vulnerability-policy.json)
are user-risk-accepted **advisory**, not a security pass or remediation. Never
substitute a newly built image during release promotion.

Windows is a **private evidence host**: qualify the unpacked Electron runtime
without an installer or portable executable, import exact-subject OfficeCLI G3
physical evidence and local Microsoft PowerPoint G5 evidence, and bind those to
the Linux receipt. Windows executable-artifact G3 is **not selected**; no
Windows EXE, Authenticode signature, or Windows executable attestation is a
release requirement or public asset. The OfficeCLI physical gate and local
PowerPoint gate are not interchangeable. Linux/macOS desktop publication is
unselected by the [release target policy](../../config/release-target-policy.json).

This phase remains **pending**. Repository workflow and contract-test presence
does not prove a completed main-branch CI run, physical OfficeCLI/PowerPoint
receipt, G5 result, rehearsal, tag, or published release. Those gates require
actual evidence from their owning hosts and Phase 16.

## Scope and Non-Goals

### Scope

- Reusable exact-SHA verification with one Linux-built client artifact and a
  sorted manifest of paths, hashes, build metadata, and lock hashes.
- Consumers verify the manifest before use; no downstream client rebuild in
  Playwright, load, Docker, or Windows unpacked-runtime qualification.
- Preserve a normal source-build Docker path for local users; CI/release use the
  explicit prebuilt path and promote the **same qualified image tar/digest**.
- Linux receipt binds software gates, prebuilt Docker identity, and the
  supply-chain advisory receipt; Windows receipt binds unpacked runtime closure
  and selected private physical gates. Root evaluates the policy-selected DAG.
- GitHub artifact attestations for the client and Docker image bind producer
  workflow and subject digest; image attestation must verify before promotion.
- Strict existing-tag verification binds tag target, package version, green CI
  subject, client digest, image digest, and root receipt.
- Keep immutable action pins and least-privilege verification jobs; protect
  staging and final publication environments.

### Non-Goals

- No automatic tag creation, branch release, force-push, tag rewrite, or release
  deletion. Manual dispatch selects an **existing** tag only.
- No public Windows NSIS/portable asset, signing key, signer, signature gate,
  Windows executable attestation, or Windows artifact G3 claim.
- No Docker registry push and no implicit Linux/macOS desktop asset expansion.
- No claim that SHA-256 hashes alone provide signed producer authenticity.
- No security-green claim for accepted HIGH/CRITICAL container findings.
- No final PowerPoint or OfficeCLI pass claim until physical evidence is imported
  and evaluated; Phase 16 owns the full rehearsal and separate publish decision.

## Key Insights

1. Build-once means every consumer gets verified bytes, not merely the same
   source SHA followed by another compilation.
2. A green CI run for a branch SHA cannot authorize a tag targeting another
   commit. Artifact names alone do not authenticate subject or bytes.
3. A root DAG must reject absent required children, mixed SHA/digests, or a
   private Windows evidence receipt masquerading as a public asset gate.
4. Unpacked Windows runtime closure does not qualify a distributable EXE;
   OfficeCLI G3 physical evidence does not replace local PowerPoint G5.
5. The accepted container finding disposition is evidence-bearing: preserve
   raw Trivy JSON and SBOM alongside the receipt, and disclose advisory risk.
6. GitHub attestation proves producer identity for the client and Docker image;
   local hashes and a JSON receipt alone do not.

## Requirements

### Functional

1. Reusable verification resolves and checks out the exact subject SHA, verifies
   `git rev-parse HEAD`, and accepts an explicit CI/release mode and release
   target policy version.
2. Build the client once, record a deterministic manifest and digest, then
   download and verify them before each E2E, load, Docker, and Windows consumer.
   No consumer runs Vite or silently rebuilds missing bytes.
3. CI Docker uses the explicit prebuilt target and verifies image/runtime
   identity. Release downloads the already-qualified image tar from the green
   subject's CI run; it does **not** rebuild an image or client for publication.
4. Produce a Linux child receipt for required quality gates, Docker runtime,
   image/client digests, attestation, and container supply-chain evidence.
5. Produce a private Windows child receipt from the same client payload and
   Linux parent: unpacked Electron `dir` runtime closure, imported exact-subject
   OfficeCLI physical evidence and local PowerPoint G5 evidence. Do not build,
   upload, sign, or attest NSIS/portable Windows executables.
6. Emit explicit `not-selected` receipts for unselected desktop targets; do not
   treat their absence as an implicit pass. Only a policy change could select
   future Linux/macOS public assets.
7. Root receipt checks policy, child hashes, subject SHA, client digest, lock
   hashes, and selected gate identities. It exists only after all required
   children pass, and carries the container advisory status without claiming
   security pass.
8. Trivy HIGH/CRITICAL scan and SPDX SBOM apply to the **exact prebuilt image**.
   Follow the explicit user-risk-accepted disposition in
   [container vulnerability policy](../../config/container-vulnerability-policy.json):
   missing, malformed, stale/mismatched image or evidence blocks; accepted
   findings are surfaced as advisory and published with raw report/SBOM/receipt,
   not suppressed or recast as fixed.
9. Tag push or manual dispatch must resolve an **existing** strict SemVer tag;
   reject `vv1.7.0`, loose versions, timestamp tags, or a manual version string.
   `v${package.version}-rc.N` is RC draft-only; final public publish requires
   exactly `v${package.version}`. Peeled tag target equals green CI SHA and
   root receipt subject; GitHub Release `target_commitish` binds that commit.
10. Stage exact verified Docker tar/digest, root receipt, attestation evidence,
    Trivy JSON, SPDX SBOM, and supply-chain receipt on the existing tag before
    final protected publication. A missing or mismatched asset fails closed.
11. Pin touched third-party actions to immutable commit SHAs; verification
    jobs use least privilege, while protected publish alone receives
    `contents: write`. Never run pull-request code in a privileged Windows
    physical-evidence or publish environment.

### Non-Functional

- Artifact identity includes complete subject SHA and schema version; retention
  permits existing-tag rerun or requires fresh full verification of that SHA.
- Release concurrency serializes by tag without cancelling active publication.
- Receipts use canonical JSON, verified parent hash, subject, client digest,
  lock hashes, policy, and schema; absent required evidence cannot pass.
- Keep required-check contexts stable or migrate branch protection with actual
  green runs, never by assuming new workflow files are sufficient.
- RC drafts and final publication are separate protected decisions. Actual
  physical gates and green CI are pending until observed on qualified hosts.

## Architecture/Data Flow

```text
exact commit -> one client build + manifest -> Linux quality/E2E/load
                                      -> prebuilt Docker image + GitHub attestation
                                      -> raw Trivy + SPDX SBOM + advisory receipt
                                      -> Linux child receipt
Linux child + same client -> private Windows unpacked runtime closure
                          -> imported OfficeCLI G3 + local PowerPoint G5 receipts
                          -> Windows child receipt (no public EXE/executable G3)
required child hashes + target policy -> green-SHA root receipt
existing SemVer tag -> verify tag == green subject and image ancestry
                    -> protected draft -> protected final Docker publication
```

The [release workflow](../../.github/workflows/release.yml) owns publish
sequencing, the [release target policy](../../config/release-target-policy.json)
owns selected hosts/assets and advisory posture, and Phase 15/16 own the
physical-evidence contract and full rehearsal. A receipt describes a gate; it
does not manufacture the physical observation.

## Tests Before (RED)

Behavioral contracts, not workflow-source snapshots, must reject:

1. Altered, missing, extra, or path-escaping client artifact files; consumers
   cannot recover by rebuilding the client.
2. Mismatched Docker image digest, missing GitHub attestation, wrong attestation
   subject or producer workflow, or release staging from a different CI run.
3. Missing Linux/Windows required child, mismatched subject/client/lock/policy
   identity or parent hash, forged `not-selected` pass, and any selected physical
   gate without an exact-subject receipt.
4. Windows evidence that claims public EXE eligibility, signing, attestation,
   or Windows executable-artifact G3 instead of unpacked runtime closure,
   OfficeCLI physical evidence, and local PowerPoint G5.
5. Missing/malformed Trivy or SBOM, a different scanned image digest, changed
   acceptance policy, or an advisory improperly described as security passed.
   Accepted HIGH/CRITICAL findings remain visible as risk-accepted evidence.
6. Absent/loose/synthetic tag, incorrect package version, RC in final mode,
   mismatched green SHA, missing root receipt, or unverified release asset.

The behavioral suites live beside the [manifest verifier](../../scripts/ci/verify-client-dist-manifest.mjs),
[receipt verifier](../../scripts/ci/release-receipts.mjs),
[release subject](../../scripts/ci/release-subject.mjs),
[promotion verifier](../../scripts/ci/verify-release-promotion.mjs), and
[container supply-chain verifier](../../scripts/verify-container-supply-chain.js).
Use these executable owners for focused test commands; workflow source-text
assertions cannot replace receipt and promotion behavior.
RED is a development method, not evidence that current workflows are absent.

## Implementation Steps

1. Define and verify the deterministic client manifest, including sorted file
   hashes, build/lock metadata, exact SHA, and path confinement.
2. Build once in the Linux client-artifact workflow and retain that manifest
   with the bytes. Migrate each E2E/load consumer to download and verify it
   before running the required check; ensure production server startup never
   triggers a client rebuild.
3. Qualify Docker from the verified prebuilt client path while preserving
   source-build `docker build .` for local use. Save the qualified image tar,
   digest, runtime receipt, and GitHub attestation from the same green CI run.
4. Scan **that** image with Trivy, generate raw SPDX SBOM and the supply-chain
   receipt, and compare image/evidence digests at promotion. Record
   HIGH/CRITICAL findings as the policy's user-risk-accepted advisory; missing
   or invalid evidence is a block, not an advisory.
5. Generate Linux child receipt after its required quality, Docker, attestation,
   and advisory evidence succeeds; do not equate an uploaded receipt file with
   attested producer identity.
6. Import the Linux parent and exact client into the private Windows lane.
   Verify unpacked Electron runtime closure without building NSIS/portable,
   then import exact-subject OfficeCLI G3 and local PowerPoint G5 physical
   receipts. Qualify Windows **evidence only**; never upload a public EXE.
7. Validate required child edges, policy-selected gates, and explicit
   `not-selected` optional desktop receipts before issuing the green-SHA root.
   A missing physical input blocks root creation; code/tests cannot fill it.
8. Preserve strict existing-tag resolution for push and manual rerun, exact
   green SHA/package-version checks, tag-keyed noncancelling concurrency,
   immutable action pins, and least-privilege verification permissions.
9. Stage the already-qualified Docker tar/digest, root receipt, raw Trivy,
   SBOM, supply-chain receipt, and attestation evidence to a draft on the
   existing tag. Final `v${package.version}` publication is separately
   environment-protected and uses those same staged bytes; RC stays draft.
10. Preserve required-check contexts or migrate protection only after observed
    green target-branch runs. Run an RC draft rehearsal and the Phase 16 full
    exact-subject rehearsal before declaring release readiness; do not infer
    physical success from workflow wiring.

## Refactor

- Keep one client manifest contract across Docker and private Windows runtime
  consumers; no implicit fallback to locally compiled bytes.
- Keep strict tag resolution shared by tag push and manual existing-tag paths.
- Keep local Docker source-build separate from CI prebuilt image promotion.
- Delete synthetic tags, repeated client builds, and obsolete executable-signing
  instructions rather than preserving compatibility prose.

## Tests After (GREEN)

Focused behavioral tests are the existing manifest, subject, receipt,
attestation-policy, promotion, and container-supply-chain suites. The tests
establish contract behavior; they do **not** certify a real CI run or physical
PowerPoint observation. Run each from its owning source path when relevant.

For artifact proof, verify the built client's manifest, qualify Docker's
prebuilt image, compare the exported tar/digest with the CI subject, and verify
GitHub Docker attestation against its producing workflow. The
[release workflow](../../.github/workflows/release.yml) owns the actual
promotion sequence; do not replace its inputs with a locally built image.

For release proof, require an observed exact-SHA green CI run, imported
OfficeCLI physical and local PowerPoint G5 receipts, a validated Linux/Windows
root receipt and container advisory evidence, then an existing-tag RC draft
rehearsal. Phase 16 owns the full gate manifest, rollback, and final decision.
None of these observations is established merely by this plan or passing tests.

## Test Scenario Matrix

| Priority | Scenario                                                             | Expected result                                                                 |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Critical | E2E/load/Docker/Windows consumer rebuilds or changes the client      | Build-once lineage invalid; no green receipt                                    |
| Critical | Client bytes or manifest changed after build                         | Consumer fails before use                                                       |
| Critical | Prebuilt image tar/digest differs from green CI image                | Promotion blocked; never rebuild silently                                       |
| Critical | Existing tag points to another SHA or package version                | Release blocked before staging                                                  |
| Critical | Manual input names absent tag or `vv1.7.0`                           | Strict tag resolution rejects it                                                |
| Critical | Required Windows OfficeCLI/G5 physical receipt missing or mismatched | Windows/root qualification blocked; no inferred pass                            |
| Critical | Windows runtime evidence presented as executable G3/public EXE       | Reject claim/asset; unpacked runtime remains private                            |
| Critical | Host child has wrong parent, subject, client digest, or lock hashes  | Root DAG validation fails                                                       |
| Critical | Docker GitHub attestation absent or wrong producer/subject           | Root or promotion blocked                                                       |
| Critical | Trivy/SBOM missing, stale, or for another image                      | Supply-chain gate and promotion blocked                                         |
| High     | Policy-accepted HIGH/CRITICAL findings present in valid raw scan     | Advisory published with raw scan/SBOM/receipt; no security-pass claim           |
| High     | New or changed findings outside approved disposition                 | Policy verification blocks pending explicit risk decision                       |
| High     | Optional desktop selected without qualifying child receipt           | Policy fails closed; no partial target set                                      |
| High     | Required quality job cancelled or failed                             | No green receipt                                                                |
| Medium   | CI artifact expired before rerun                                     | Requalify same subject through full CI; never package new bytes as old evidence |
| Medium   | Existing-tag manual rerun with intact exact-subject artifacts        | Same subject/assets reverified, not retagged                                    |

## Regression Gate Commands

The owning workflows and `package.json` define the current commands; do not
duplicate full release command sequences here. In particular, the existing
behavioral suites are under `scripts/ci/` and the container verifier's suite
is beside `scripts/verify-container-supply-chain.js`. The Phase 16 gate
manifest and physical-host receipts decide release readiness. Full branch CI,
two target-branch greens if required-check contexts change, RC draft rehearsal,
and local PowerPoint/OfficeCLI physical qualification are **pending** until
actually run; no missing gate is a pass.

## Todo

- [ ] Observe a passing target-branch CI run with one verified client build,
      Docker attestation, raw Trivy/SBOM, and advisory receipt tied to one image.
- [ ] Import exact-subject private Windows unpacked-runtime, OfficeCLI G3, and
      local PowerPoint G5 receipts; verify Linux parent and client digest.
- [ ] Validate the required-child root receipt and optional `not-selected`
      status against the release target policy.
- [ ] Observe two green target-branch runs before migrating any required-check
      context; confirm branch-protection state separately.
- [ ] Rehearse existing-tag RC draft staging and Phase 16 full release decision.
- [ ] Approve final protected publication only after all selected gates pass.

## Success Criteria

- Exactly one client build per verification subject; every CI/runtime consumer
  verifies identical bytes before use.
- One prebuilt Docker image tar and digest are carried from qualifying CI to
  draft and final release without rebuilding; GitHub Docker attestation
  verifies subject and producing workflow.
- Exact-subject Linux and private Windows receipts agree on client, locks,
  policy and parent; Windows records unpacked runtime, OfficeCLI G3 and local
  PowerPoint G5, not Windows executable-artifact G3.
- Root receipt exists only after all selected children and physical gates pass.
- Valid Trivy/SBOM/supply-chain evidence is published alongside the image;
  accepted HIGH/CRITICAL findings are explicitly advisory, never security green.
- Only an existing strict SemVer RC tag can stage a draft; only existing final
  `v${package.version}` with matching exact green SHA can publish through the
  protected environment. No Windows EXE becomes a public asset.
- Current required checks and Phase 16's selected gates pass in **observed**
  runs before any release-readiness claim.

## Risk Assessment

| Risk                           | Observable signal                                            | Pre-decided response                                                               |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Required-check context changes | Branch protection waits for a removed job                    | Run old/new contexts in parallel; migrate after two observed greens                |
| Client or image mix-up         | Manifest, image digest, attestation, or parent hash mismatch | Reject lineage; requalify exact subject rather than rebuild at publish             |
| Docker local UX breaks         | Default build unexpectedly needs CI artifact                 | Keep separate local source-build and CI prebuilt paths                             |
| Expired green artifact         | Exact-subject CI download absent                             | Re-run full verification for the same SHA; never substitute a new subject          |
| Tag/package mismatch           | Existing tag resolves to different version/SHA               | Block; create a new release subject, never move an existing published tag          |
| Release race                   | Two runs target the same tag                                 | Serialize by tag; do not cancel an in-progress publish                             |
| Physical host unavailable      | OfficeCLI/PowerPoint or unpacked-runtime receipt absent      | Keep release blocked; do not mark G5 or OfficeCLI pass                             |
| Container findings remain      | Valid HIGH/CRITICAL Trivy findings under accepted policy     | Publish raw scan/SBOM and explicit risk-accepted advisory; never claim remediation |
| Container evidence changes     | Missing/changed scan, SBOM, image digest, or policy          | Reject promotion until evidence/policy is requalified                              |
| Attestation invalid            | Wrong image subject or producer identity                     | Block root/promotion; local hash is not independent provenance                     |
| Optional desktop scope drifts  | Asset appears despite unselected target                      | Reject asset until explicit policy revision                                        |

## Security Considerations

- Keep immutable third-party action pins. Verification jobs need read-only
  content access and only scoped attestation permissions; protected staging
  and final publish alone receive `contents: write`.
- Never execute untrusted pull-request code in a privileged PowerPoint host or
  publish environment. Import hash-verified exact-subject artifacts/receipts.
- Validate artifact paths against traversal and symlink escape; exclude token
  values, secrets, and raw slide content from manifests and receipts.
- Verify GitHub client/Docker attestations for subject digest and producer
  workflow. Local hashes bind identity but do not authenticate a producer.
- HIGH/CRITICAL container findings accepted for the selected private single-user
  deployment remain disclosed as advisory with raw Trivy JSON, SPDX SBOM, and
  supply-chain receipt. Acceptance is not vulnerability remediation or a
  blanket permission to ignore missing, stale, or altered scans.
- Windows remains private unpacked runtime/OfficeCLI/PowerPoint evidence, not a
  signing or public executable path; do not export Windows EXE artifacts.
- Keep tag protections and release environment approvals explicit external
  release prerequisites; workflow files alone do not establish their status.

## Dependencies/Next Steps

- Phase 2 owns version/tag policy; Phase 3 owns complete test topology.
- Phase 15 owns private Windows runtime closure, external OfficeCLI receipt
  import, and local PowerPoint G5 evidence without Windows artifact G3.
- Phase 16 owns the full exact-subject rehearsal and release decision. Actual
  tag creation, push, and publication remain operator actions after the
  selected gates have produced real receipts.
