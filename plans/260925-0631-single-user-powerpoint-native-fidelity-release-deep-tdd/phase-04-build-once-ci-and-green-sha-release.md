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
- [Current monolithic CI workflow](../../.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml)
- [Current release workflow](../../.github/workflows/release.yml)
- [Current Dockerfile](../../Dockerfile)
- [Current Docker ignore rules](../../.dockerignore)
- [Electron package preparation](../../scripts/prepare-electron.js)
- [Runtime closure verification](../../scripts/verify-runtime-closure.js)
- [Electron builder config](../../electron-builder.yml)
- [Runtime/action pin contract](../../tests/unit/production-runtime-closure-contract.test.js)
- [Electron release contract](../../tests/unit/electron-release-readiness-contract.test.js)
- [Package-first Phase 13 release design](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/phase-13-ci-platform-security-and-release-claim-gates.md)
- [Historical Windows release plan](../archive/260522-0922-windows-electron-v1-9-1-release/phase-04-commit-tag-push-readiness.md)

## Goal/Overview

Build the client exactly once for a verification subject, hash it, and reuse the
same immutable artifact in every E2E, load, Docker, Electron, and release
consumer. Centralize release verification in a reusable workflow. Publish only
from an existing strict SemVer git tag whose target commit is the exact green
verification SHA and whose version equals the governed package version.

Model qualification as a multi-host receipt DAG. Linux owns build-once,
unit/coverage, Playwright, load, and Docker. Windows owns Electron packaging,
Authenticode verification, and physical Office/OfficeCLI lanes. Linux/macOS
desktop artifact qualification is enabled only when the Phase 1 release policy
explicitly selects those public assets from earlier recommendations. Every child
receipt binds the same subject SHA and prebuilt client digest; no host rebuilds
the client.

Remove all paths that synthesize a tag from manual input or timestamps.

Current exact problems:

- CI has a dedicated client build job, but every Chromium shard plus PPTX import,
  live, mobile, visual, and load jobs runs `npm run build` again. Current workflow
  therefore compiles the client ten times before considering Docker’s internal
  source build.
- Docker always runs `npm run build` in its builder stage.
- Release builds the client again on Windows before Electron packaging.
- The workflow has no explicit multi-host receipt DAG; host-specific evidence
  can be green without one root proving exact subject/artifact ancestry.
- Public Windows assets have no mandatory Authenticode identity/timestamp gate.
- `release.yml` manual dispatch accepts a version string and can create that tag
  in GitHub Releases without proving an existing git tag.
- Its fallback branch synthesizes `v0.0.0-dev.<timestamp>`.
- Release publication is not bound to the exact SHA that passed the main required
  checks.

## Scope and Non-Goals

### Scope

- One reusable Linux verification root plus policy-selected host qualification
  workflows in one receipt DAG.
- One Linux-built client artifact per subject SHA.
- Manifest includes SHA-256 and byte length for every `client/dist` file plus:
  commit, dirty=false, Node/npm/Vite versions, lock hash, and build command.
- Downstream jobs download and verify before use; no downstream client rebuild.
- CI Playwright, load, Docker, Windows Electron/Office, and any selected
  Linux/macOS desktop consumers reuse the artifact.
- Docker retains a normal source-build default for local users and adds a CI
  prebuilt target/path.
- Release accepts only an existing strict SemVer tag.
- Tag target, package version, verification subject, client artifact manifest,
  Electron receipt, and GitHub Release target commit must match.
- Manual dispatch is rerun/recovery only and requires an existing tag name.
- All third-party actions in touched workflows are pinned by immutable SHA.
- Receipt DAG has one root policy receipt and host child receipts for Linux,
  Windows, and optional selected desktop hosts.
- Public Windows NSIS/portable executables must be Authenticode-signed by the
  approved publisher identity and timestamped before publication.
- Artifact attestations/provenance are signed through GitHub artifact attestation
  (Sigstore-backed) and bind subject SHA, workflow identity, artifact SHA-256,
  client manifest digest, lock hashes, and parent receipt hashes.
- Existing required checks remain required; future native-fidelity gates attach
  to the same reusable receipt without changing lineage semantics.

### Non-Goals

- No automatic tag creation.
- No branch push release.
- No force-push, tag rewrite, release deletion, or actual publish in this phase.
- No automatic Linux/macOS publication expansion. Qualify those desktop
  artifacts only if Phase 1/earlier recommendations select them in the release
  target policy; otherwise emit explicit `not-selected`, not pass.
- No Docker registry publication.
- No repository-managed signing key. Windows signing uses a protected
  environment and external certificate/Key Vault/HSM provider; absence blocks
  public Windows release.
- No claim that local hashes are independent attestation.
- No removal of final downstream PPTX/PowerPoint gates owned by later phases.

## Key Insights

1. Build-once means downstream jobs consume bytes, not merely use the same source
   SHA and rebuild independently.
2. A GitHub Actions artifact name is not sufficient identity. Consumers must
   verify a checked-in-schema manifest of file hashes.
3. A green branch SHA cannot authorize release of a different tag target.
4. `workflow_dispatch` is useful for rerunning a failed packaging/publication
   job, but it must resolve an existing tag and never manufacture one.
5. The malformed historical tag `vv1.7.0` demonstrates why strict SemVer
   validation must be executable.
6. The release workflow can reuse the same client artifact while still building
   Windows Electron packaging once; Electron packaging is a distinct artifact
   build, not a client rebuild.
7. Later OfficeCLI/PowerPoint gates may be unavailable during Phase 4
   implementation. The reusable workflow must fail closed only for gates selected
   by release mode and must expose an extension point for later exact-subject
   receipts.
8. Cross-host green is a DAG, not a bag of artifacts. Every Windows/macOS/Linux
   desktop or Office receipt must name the Linux root receipt, subject SHA, and
   client digest.
9. SHA-256 manifests prove identity but not producer authenticity. Signed
   provenance/attestations and protected signing environments are required for
   public artifacts.

## Requirements

### Functional

1. Create reusable workflow `workflow_call` inputs:
   - `subject_sha` required;
   - `mode` enum `ci|release`;
   - `release_tag` required only for release;
   - exact gate-policy version;
   - release target policy selecting `windows`, optional `linux-desktop`, and
     optional `macos-desktop`.
2. Reusable workflow must checkout `subject_sha`, then verify
   `git rev-parse HEAD == subject_sha`.
3. Linux build job runs `npm ci` and `npm run build` exactly once.
4. Build job creates `client-dist-manifest.json` with sorted normalized paths and
   hashes, uploads artifact, and exposes manifest/artifact digest outputs.
5. Every consumer verifies the manifest before starting.
6. Remove `npm run build` from E2E, live, PPTX import, mobile, visual, load,
   Docker prebuilt, Windows Electron/Office, and selected Linux/macOS desktop
   packaging jobs.
7. Docker CI uses a prebuilt client target and proves image bytes match the
   client manifest.
8. Windows release packaging downloads the green client artifact before
   `prepare-electron.js` and `electron-builder`. Windows physical OfficeCLI and
   PowerPoint lanes consume only immutable package/fixture artifacts produced by
   the verified subject.
9. Define child receipts:
   - `linux-ci-receipt`: inventory, coverage, Playwright, load, Docker, and
     prebuilt client hashes;
   - `windows-qualification-receipt`: Electron artifact hashes, runtime closure,
     OfficeCLI/PowerPoint selected gate hashes, Authenticode result, signer
     thumbprint/subject, and RFC 3161 timestamp evidence;
   - optional `linux-desktop-receipt` / `macos-desktop-receipt`: only when target
     policy selects public desktop artifacts; otherwise explicit `not-selected`;
   - `green-sha-root-receipt`: policy evaluation over all required child hashes.
10. Green-SHA root receipt is produced only after every policy-selected child
    receipt passes. It includes:

- subject SHA;
- release tag when selected;
- workflow path/ref and run ID/attempt;
- lock hashes;
- client artifact digest;
- required host/job names/results and parent/child receipt hashes;
- selected fidelity gate receipt hashes;
- schema/policy version.

11. Release workflow must:
    - trigger on `v*` tag push;
    - optionally allow manual dispatch with required existing `tag`;
    - reject `vv1.7.0`, loose versions, timestamp tags, and version-only input;
    - resolve annotated or lightweight tag to one commit;
    - accept `v<package.version>-rc.N` for RC verification/draft publication and
      `v<package.version>` for final publication;
    - require tag target equals verified subject SHA;
    - require green receipt and artifact hashes;
    - publish with `target_commitish`/tag bound to that commit.
12. Remove synthetic fallback branches and `tag_name` derived from a manual
    version string.
13. Preserve Windows-only public assets unless the selected target policy
    explicitly adds qualified Linux/macOS artifacts.
14. For every public Windows `.exe`:
    - sign before upload with the protected approved publisher identity;
    - require `Get-AuthenticodeSignature` status `Valid`;
    - require signer subject/thumbprint match policy;
    - require a trusted RFC 3161 timestamp/countersignature;
    - verify again after download from the staged release asset;
    - block publication on missing, invalid, expired-at-signing, or mismatched
      signature. Unsigned artifacts may exist only in non-public CI evidence.
15. Generate signed provenance/attestations for client, Docker, Electron, and
    every selected desktop artifact. Verify attestation subject digest and
    workflow identity before root receipt/publish.
16. Keep final release publish job environment-protected and `contents: write`;
    all verification/build jobs use least privilege.
17. All action `uses:` references in touched workflows, including checkout,
    setup-node, upload/download-artifact, cache, attest-build-provenance, and
    release actions, use full immutable commit SHAs. A contract test rejects
    floating tags/branches and records upstream action version comments.

### Non-Functional

- Artifact names include full subject SHA and schema version.
- Retention permits tag rerun long enough for release operations.
- Concurrency serializes release by tag; never cancels an in-progress publish.
- Download jobs use immutable action pins and explicit expected artifact name.
- Receipt generation deterministic except timestamps/run identity.
- No job can pass with a missing artifact.
- Host receipts are canonical JSON and verify parent hash, subject SHA, client
  digest, lock hashes, target policy, and schema/policy version.
- Signing secrets are available only to protected Windows publish/sign jobs;
  pull-request code never reaches those jobs.

## Architecture/Data Flow

```text
PR/push/tag/manual-existing-tag
  -> resolve exact subject SHA
  -> reusable Linux verification workflow
       -> npm ci
       -> build client once
       -> hash + upload client-dist artifact
       -> lint + three-project Vitest coverage
       -> consumers download + verify same bytes
            -> Chromium shards
            -> PPTX import E2E
            -> live/mobile/visual E2E
            -> load smoke
            -> Docker prebuilt target + runtime qualification
       -> linux-ci-receipt

linux-ci-receipt + same client digest
  -> protected Windows workflow
       -> Electron assembly without client rebuild
       -> runtime closure
       -> physical OfficeCLI/PowerPoint policy-selected lanes
       -> Authenticode sign + post-sign verify
       -> signed provenance
       -> windows-qualification-receipt

linux-ci-receipt + same client digest
  -> optional selected Linux/macOS desktop assembly/qualification
       -> platform receipt or explicit not-selected

required host receipts + target policy
  -> verify DAG edges, subject, client digest, locks, signatures, attestations
  -> green-SHA-root-receipt

existing SemVer tag -> resolve tag commit
  -> require tag commit == green root receipt SHA
  -> publish only signed, attested, policy-selected assets to existing tag
```

Build boundaries:

- Client compilation: once per subject SHA.
- Docker assembly: once, consuming client bytes.
- Electron Windows assembly: once, consuming client bytes.
- Optional Linux/macOS Electron assembly: once per selected target, consuming the
  same client bytes.
- Tests never rebuild client.
- Release publication never changes tag identity.

## Deep File Inventory

| Absolute path                                                                                                | Action                 |           Rough size | Planned change                                                                    | Test impact                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------: | --------------------------------------------------------------------------------- | ---------------------------------- |
| `C:\Work\NavSlidesEditor\.github\workflows\reusable-green-sha-verification.yml`                              | Create                 |        350-500 lines | Linux build-once verification and Linux child receipt                             | Workflow contract tests            |
| `C:\Work\NavSlidesEditor\.github\workflows\reusable-windows-qualification.yml`                               | Create                 |        220-350 lines | Windows Electron/Office lanes, signing, attestation, child receipt                | Windows DAG/signing contracts      |
| `C:\Work\NavSlidesEditor\.github\workflows\github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | Modify                 | 405 -> ~50-100 lines | Trigger/permissions wrapper calling reusable workflow                             | Existing required checks preserved |
| `C:\Work\NavSlidesEditor\.github\workflows\release.yml`                                                      | Modify                 | 132 -> 140-220 lines | Existing-tag verification, reusable gate, artifact reuse, Windows package/publish | Release contract                   |
| `C:\Work\NavSlidesEditor\config\release-target-policy.json`                                                  | Create                 |          30-60 lines | Required host/artifact/gate/signing/attestation policy                            | DAG policy contract                |
| `C:\Work\NavSlidesEditor\scripts\ci\create-client-dist-manifest.mjs`                                         | Create                 |        100-150 lines | Sorted file hashes and build metadata                                             | Unit + workflow tests              |
| `C:\Work\NavSlidesEditor\scripts\ci\verify-client-dist-manifest.mjs`                                         | Create                 |         90-140 lines | Fail closed on missing/extra/hash/subject drift                                   | Unit + consumer jobs               |
| `C:\Work\NavSlidesEditor\scripts\ci\verify-release-subject.mjs`                                              | Create                 |        100-160 lines | Strict SemVer, existing tag, package version, exact SHA checks                    | Negative release tests             |
| `C:\Work\NavSlidesEditor\scripts\ci\create-host-receipt.mjs`                                                 | Create                 |        100-160 lines | Canonical Linux/Windows/optional desktop child receipts                           | Receipt tests                      |
| `C:\Work\NavSlidesEditor\scripts\ci\create-green-sha-receipt.mjs`                                            | Create                 |        120-180 lines | Verify receipt DAG and create canonical root receipt                              | Receipt tests                      |
| `C:\Work\NavSlidesEditor\scripts\ci\verify-authenticode.ps1`                                                 | Create                 |         80-140 lines | Publisher/thumbprint/timestamp/post-download verification                         | Windows signing gate               |
| `C:\Work\NavSlidesEditor\scripts\ci\verify-artifact-attestation.mjs`                                         | Create                 |         80-140 lines | Verify signed provenance subject/workflow identity                                | Provenance gate                    |
| `C:\Work\NavSlidesEditor\scripts\ci\client-artifact-manifest.test.js`                                        | Create                 |        100-160 lines | Hash/missing/extra/path traversal tests                                           | Focused TDD                        |
| `C:\Work\NavSlidesEditor\scripts\ci\release-subject.test.js`                                                 | Create                 |        120-180 lines | Tag/SemVer/SHA/version negative matrix                                            | Focused TDD                        |
| `C:\Work\NavSlidesEditor\tests\unit\github-actions-build-once-contract.test.js`                              | Create                 |        140-200 lines | Parse workflow; count build; require downloads/verifiers                          | Primary workflow gate              |
| `C:\Work\NavSlidesEditor\tests\unit\github-actions-green-sha-release-contract.test.js`                       | Create                 |        140-200 lines | No synthetic tag; exact receipt/tag/SHA checks                                    | Primary release gate               |
| `C:\Work\NavSlidesEditor\tests\unit\github-actions-multi-host-receipt-contract.test.js`                      | Create                 |        140-200 lines | DAG edges, selected hosts, same subject/client digest                             | Multi-host release gate            |
| `C:\Work\NavSlidesEditor\tests\unit\github-actions-signing-provenance-contract.test.js`                      | Create                 |        120-180 lines | Authenticode, timestamp, attestation, and SHA-pinned actions                      | Public artifact gate               |
| `C:\Work\NavSlidesEditor\tests\unit\production-runtime-closure-contract.test.js`                             | Modify                 |            126 lines | New workflow path/action pins/Docker target assertions                            | Runtime regression                 |
| `C:\Work\NavSlidesEditor\tests\unit\electron-release-readiness-contract.test.js`                             | Modify                 |             45 lines | Existing-tag and artifact-reuse contract                                          | Release regression                 |
| `C:\Work\NavSlidesEditor\Dockerfile`                                                                         | Modify                 |   51 -> 70-110 lines | Add normal source-build and CI prebuilt production targets                        | Docker artifact gate               |
| `C:\Work\NavSlidesEditor\.dockerignore`                                                                      | Modify                 |              8 lines | Permit prebuilt context through explicit staging path, not arbitrary local dist   | Docker contract                    |
| `C:\Work\NavSlidesEditor\scripts\verify-runtime-closure.js`                                                  | Modify                 |            109 lines | Optionally verify client manifest/digest in assembled artifact                    | Runtime tests                      |
| `C:\Work\NavSlidesEditor\scripts\prepare-electron.js`                                                        | Verify/modify narrowly |            125 lines | Consume downloaded client dist; never rebuild                                     | Electron package gate              |
| `C:\Work\NavSlidesEditor\package.json`                                                                       | Modify                 |            155 lines | Manifest/verify/receipt scripts; Electron prepare semantics if needed             | Script contract                    |
| `C:\Work\NavSlidesEditor\docs\deployment-guide.md`                                                           | Modify                 |                Large | Tag-only publish and rerun policy                                                 | Docs contract                      |
| `C:\Work\NavSlidesEditor\docs\project-changelog.md`                                                          | Modify                 |           536+ lines | Record CI/release governance change under Unreleased                              | Docs contract                      |

## Tests Before (RED)

Write contract tests first.

### Build-once RED assertions

1. Exactly one literal client compilation command exists in the reusable
   verification workflow.
2. No consumer job contains `npm run build`.
3. Every consumer contains artifact download plus manifest verification.
4. Docker uses the prebuilt target in CI.
5. Release Windows job downloads verified client bytes and does not compile.
6. Missing, extra, altered, or path-escaping artifact files fail manifest verify.
7. Playwright starts the checked-in production server against downloaded
   `client/dist`; no `webServer.command`, fixture, or helper may invoke Vite/build.
8. Docker and every Electron target consume the identical client manifest digest.

### Multi-host, signing, and provenance RED assertions

1. Root receipt cannot pass without Linux and Windows child receipts.
2. Optional Linux/macOS desktop receipts are required only when selected by
   target policy; an unselected host must be `not-selected`, never synthetic pass.
3. Every child names the same subject SHA, lock hashes, client digest, policy
   version, and parent/root-candidate identity.
4. Windows receipt cannot pass without Electron runtime closure plus selected
   Office/OfficeCLI receipts.
5. Public Windows assets cannot pass without valid Authenticode publisher,
   thumbprint, trusted timestamp, post-download verification, and matching file
   SHA-256.
6. Client, Docker, Windows Electron, and selected desktop artifacts each have a
   verified signed provenance/attestation bound to workflow identity and digest.
7. Every `uses:` in touched workflows matches a full 40-character commit SHA;
   floating `@v4`, `@main`, or branch refs fail.

### Green-SHA release RED assertions

1. Release workflow contains no `version` input.
2. Release workflow contains no `v0.0.0-dev`, timestamp tag, or fallback
   `tag_name`.
3. Manual dispatch requires an existing `tag`.
4. Strict SemVer accepts `v${package.version}-rc.1` in RC mode and final
   `v${package.version}` in final mode, and rejects:
   - `vv1.7.0`;
   - `1.16.0`;
   - `v1.16`;
   - `v01.16.0`;
   - arbitrary branch names.
5. Final-mode tag must equal `v${package.version}`; RC-mode tag must equal
   `v${package.version}-rc.N`.
6. Tag peeled commit must equal receipt subject SHA and checkout HEAD.
7. Publish job cannot run without reusable verification success and green receipt.
8. Release assets must come from exact verified artifact lineage.

Run:

```powershell
npx vitest run scripts/ci/client-artifact-manifest.test.js scripts/ci/release-subject.test.js tests/unit/github-actions-build-once-contract.test.js tests/unit/github-actions-green-sha-release-contract.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/production-runtime-closure-contract.test.js
npx vitest run tests/unit/github-actions-multi-host-receipt-contract.test.js tests/unit/github-actions-signing-provenance-contract.test.js
```

Expected RED: reusable workflow/scripts absent; current CI rebuilds repeatedly;
current release supports version-based synthetic tags; no host DAG, mandatory
Authenticode gate, or signed provenance exists.

## Implementation Steps

1. Define JSON schemas for client manifest and green receipt.
   Define child host receipt and root DAG schemas at the same time.
2. Implement manifest create/verify scripts with path containment and
   missing/extra file rejection.
3. Add reusable Linux workflow build job:
   - immutable checkout/setup/action pins;
   - `npm ci`;
   - Phase 3 inventory + coverage;
   - one `npm run build`;
   - manifest creation;
   - artifact upload;
   - digest outputs.
4. Move existing required jobs into the reusable workflow without weakening:
   - lint;
   - unit + coverage;
   - Chromium four shards;
   - PPTX import E2E;
   - live;
   - mobile;
   - visual;
   - PPTX corpus metrics;
   - load smoke;
   - Docker artifact qualification.
5. In each consumer:
   - checkout exact SHA;
   - `npm ci` where runtime dependencies are needed;
   - download exact artifact name;
   - verify manifest and subject;
   - execute existing command without build.
6. Replace repeated build artifacts in E2E with the downloaded `client/dist`.
   Playwright uses one production server command (`npm start` or an explicit
   no-build server helper) and `reuseExistingServer: false` in CI. Contract tests
   scan workflow YAML, Playwright configs, and package scripts for hidden build or
   Vite compilation paths.
7. Refactor Dockerfile into:
   - normal default source-build target for local `docker build .`;
   - CI prebuilt target consuming a dedicated staged client artifact directory;
   - shared production runtime stages;
   - runtime verification proving assembled bytes match manifest.
8. Keep `.dockerignore` excluding arbitrary local `client/dist`; allow only the
   CI staging directory created from the verified artifact.
9. Make current CI workflow a small caller of the reusable workflow. Preserve
   stable required-check context or coordinate branch-protection migration before
   deleting old context.
10. Add final Linux summary job. It must use `if: always()` and fail on any
    required failure/cancel/timeout, then issue `linux-ci-receipt`.
11. Create protected Windows qualification workflow:
    - download and verify Linux client artifact/receipt;
    - assemble Electron without client build;
    - run runtime closure;
    - run policy-selected physical OfficeCLI/PowerPoint lanes;
    - sign selected public `.exe` assets;
    - verify Authenticode publisher/thumbprint/timestamp;
    - attest artifacts and issue `windows-qualification-receipt`.
12. If release policy selects Linux/macOS desktop publication, add one
    no-client-rebuild assembly/qualification child per host using earlier
    recommendation acceptance criteria. Otherwise record `not-selected`.
13. Verify every child edge and generate/upload the green-SHA root receipt only
    after all policy-selected children pass.
14. Refactor `release.yml`:
    - tag-push official path;
    - manual input `tag` only;
    - fetch tags;
    - verify final/RC strict SemVer, package core equality, mode, and peeled commit;
    - call reusable workflow for that commit in `release` mode;
    - download same client artifact and green receipt;
    - consume already qualified/signature-verified host artifacts and receipts;
    - verify signed provenance/attestations;
    - upload only policy-selected artifacts;
    - publish to the same existing tag.
15. Set release concurrency key to tag and `cancel-in-progress: false`.
16. Keep publish in protected environment with minimum `contents: write`;
    verification defaults to read-only.
17. Add explicit gate receipt slots for:
    - importer qualification;
    - full browser audit;
    - package-first exact claim;
    - Windows artifact qualification;
    - PowerPoint oracle.
      A selected release policy with a missing required receipt fails closed.
18. Pin each third-party action by full commit SHA, add a version comment, and
    make the action-pin contract fail on any floating ref.
19. Configure Windows signing only in the protected release environment. Never
    expose certificate/private-key material to PR or general verification jobs.
20. Verify each signed asset again after artifact download and before GitHub
    Release publication.
21. Generate GitHub/Sigstore artifact attestations and verify them before adding
    their hashes to the root receipt.
22. Run workflow syntax/action pin tests locally.
23. Execute a PR/branch CI dry run before enabling release.
24. Execute an RC dry run against a newly created `vNEXT_VERSION-rc.1` tag with
    draft/non-public publication in a disposable test environment. Never reuse or
    mutate `v1.16.0`.
25. Promote required-check context only after two green target-branch runs.

## Refactor

- One artifact manifest implementation used by Docker and Electron consumers.
- One release-subject verifier used by tag and manual paths.
- One reusable verification workflow, not copied CI/release job graphs.
- Keep source-build and prebuilt Docker paths explicit; avoid shell conditionals
  that silently select local unverified bytes.
- Preserve stable job names where branch protection depends on them.
- Remove old synthetic-version and repeated-build code after contract tests pass.

## Tests After (GREEN)

Focused:

```powershell
npx vitest run scripts/ci/client-artifact-manifest.test.js scripts/ci/release-subject.test.js tests/unit/github-actions-build-once-contract.test.js tests/unit/github-actions-green-sha-release-contract.test.js tests/unit/github-actions-multi-host-receipt-contract.test.js tests/unit/github-actions-signing-provenance-contract.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/production-runtime-closure-contract.test.js
```

Local artifact proof:

```powershell
npm ci
npm run build
node scripts/ci/create-client-dist-manifest.mjs --root client/dist --subject (git rev-parse HEAD) --out .tmp/client-dist-manifest.json
node scripts/ci/verify-client-dist-manifest.mjs --root client/dist --manifest .tmp/client-dist-manifest.json --subject (git rev-parse HEAD)
npm run runtime:verify
```

Docker prebuilt proof:

```powershell
docker build --target production-prebuilt --tag navslides-editor:prebuilt-ci .
docker run --rm --publish 127.0.0.1:3002:3002 navslides-editor:prebuilt-ci
```

Windows signature and provenance proof:

```powershell
pwsh -File scripts/ci/verify-authenticode.ps1 `
  -Path dist-electron/NavSlides-Editor-Setup.exe `
  -ExpectedSubject $env:WINDOWS_SIGNING_SUBJECT `
  -ExpectedThumbprint $env:WINDOWS_SIGNING_THUMBPRINT `
  -RequireTimestamp
gh attestation verify dist-electron/NavSlides-Editor-Setup.exe `
  --repo xuan2261/NavSlidesEditor
node scripts/ci/create-green-sha-receipt.mjs `
  --policy config/release-target-policy.json `
  --linux-receipt .tmp/receipts/linux-ci.json `
  --windows-receipt .tmp/receipts/windows-qualification.json `
  --out .tmp/receipts/green-sha-root.json
```

Workflow proof:

- two target-branch green runs;
- one RC-mode dry run against newly created `vNEXT_VERSION-rc.1` in a disposable
  test repository/environment, or with publish job draft-only;
- root/child receipt subject, tag target, client digest, lock hashes, Docker
  receipt, Electron receipt, signatures, and attestation subjects all match.

## Test Scenario Matrix

| Priority | Scenario                                     | Expected result                                                         |
| -------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Critical | E2E job rebuilds client                      | Workflow contract fails                                                 |
| Critical | Artifact bytes changed after build           | Manifest verifier fails before tests/package                            |
| Critical | Tag points to non-green SHA                  | Release blocked before packaging                                        |
| Critical | Manual input invents absent tag              | Release blocked; no GitHub Release created                              |
| Critical | `vv1.7.0` selected                           | Strict SemVer rejection                                                 |
| Critical | Package version differs from tag             | Release blocked                                                         |
| Critical | Required receipt missing for selected policy | Publish blocked                                                         |
| Critical | Windows executable unsigned or wrong signer  | Publish blocked; unsigned artifact retained only as private CI evidence |
| Critical | Signature lacks trusted timestamp            | Publish blocked                                                         |
| Critical | Host child uses different client digest      | DAG verification fails                                                  |
| Critical | Artifact attestation subject mismatches      | Root receipt and publish blocked                                        |
| High     | Docker prebuilt target omits a file          | Runtime/manifest verification fails                                     |
| High     | Electron job runs build                      | Workflow contract fails                                                 |
| High     | Required job cancelled                       | Summary fails; no green receipt                                         |
| High     | Action uses floating major tag               | Action-pin contract fails                                               |
| High     | macOS/Linux desktop selected without receipt | Policy fails closed; no partial public target set                       |
| Medium   | Artifact expired before rerun                | Release reports infrastructure block; never rebuilds silently           |
| Medium   | Manual rerun targets valid existing tag      | Same commit/artifacts verified; publication idempotent                  |

## Regression Gate Commands

Phase-focused:

```powershell
npx vitest run scripts/ci/client-artifact-manifest.test.js scripts/ci/release-subject.test.js tests/unit/github-actions-build-once-contract.test.js tests/unit/github-actions-green-sha-release-contract.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/production-runtime-closure-contract.test.js
npm run lint
npm run build
npm run runtime:verify
```

Reusable workflow required gates:

```powershell
npm run test:inventory
npm run test:coverage
npm run matrix:gate
npm run test:e2e
npm run test:pptx:corpus-metrics
npm run test:load:api:smoke
npm run test:load:ws:smoke
```

Final downstream native-fidelity release gates:

```powershell
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:package:no-officecli
npm run test:pptx:oracle:integrity
npm run test:pptx:oracle:qualify
```

Those final gates attach to the exact green subject when their owning later
phases make them release-required. No missing gate may be represented as pass.

## Todo

- [ ] Add RED artifact and release-subject tests.
- [ ] Add RED workflow build-count and green-SHA contracts.
- [ ] Implement client manifest create/verify scripts.
- [ ] Create reusable verification workflow.
- [ ] Build client exactly once.
- [ ] Convert every consumer to download + verify.
- [ ] Prove Playwright production server never rebuilds client.
- [ ] Add Docker prebuilt target.
- [ ] Preserve normal local Docker source-build target.
- [ ] Generate final green-SHA receipt.
- [ ] Generate Linux and Windows child receipts with verified DAG edges.
- [ ] Add optional selected Linux/macOS desktop receipt policy.
- [ ] Remove synthetic/manual version tag creation.
- [ ] Require existing strict SemVer tag.
- [ ] Bind tag, package version, checkout SHA, and receipt SHA.
- [ ] Reuse client artifact in Electron packaging.
- [ ] Require and verify Authenticode plus trusted timestamp for public Windows assets.
- [ ] Generate and verify signed provenance/attestations.
- [ ] Pin all touched third-party actions by SHA.
- [ ] Preserve/migrate required-check context safely.
- [ ] Run two green branch workflows.
- [ ] Run non-publishing release dry run.
- [ ] Run RC `-rc.1` draft dry run.
- [ ] Document rerun and rollback procedure.

## Success Criteria

- One client build per verification subject.
- All CI/runtime/package consumers use byte-identical verified client output.
- Docker and Electron receipts bind the same client artifact digest and subject
  SHA.
- Linux, Windows, and any selected desktop child receipts form one verified DAG
  with the same subject, client digest, locks, and policy.
- The declared multi-host receipt DAG is the only release verification graph.
- Green receipt exists only after all selected required gates pass.
- Release accepts only existing strict SemVer tag `v${package.version}`.
- RC verification accepts only existing `v${package.version}-rc.N`; final publish
  accepts only `v${package.version}`.
- Tag target equals exact green SHA.
- No synthetic timestamp/dev/manual-version tag path remains.
- Current required checks, coverage, E2E, corpus, load, Docker, and runtime gates
  remain green.
- Every public Windows executable has a valid approved Authenticode signature and
  trusted timestamp, verified again after download.
- Every selected public artifact has verified signed provenance/attestation.
- Publish job cannot execute on branch SHA, mismatched tag, stale artifact, or
  incomplete receipt.

## Risk Assessment

| Risk                            | Observable signal                             | Pre-decided response                                                     |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Required-check context changes  | Branch protection waits for removed job       | Run old/new contexts in parallel; migrate protection after two greens    |
| Artifact tampering/mix-up       | Manifest hash or subject mismatch             | Fail consumer immediately; never rebuild locally                         |
| Docker local UX breaks          | Default `docker build .` requires CI artifact | Keep default source-build target; add separate prebuilt target           |
| Artifact expiry blocks rerun    | Download reports missing artifact             | Re-run full verification for same tag SHA; do not package from a new SHA |
| Tag/package mismatch            | Verifier reports different versions           | Block; fix manifests and create a new tag, never move published tag      |
| Release race                    | Two runs target same tag                      | Concurrency serialize; no cancellation during publish                    |
| Workflow permissions too broad  | Verification job receives write token         | Split publish permissions/environment from reusable verification         |
| Future fidelity gates absent    | Receipt lacks required gate ID                | Selected release policy fails closed                                     |
| Cross-host artifact mix-up      | Child subject/client/lock hash differs        | Reject DAG; rerun missing host against exact root bytes                  |
| Signing unavailable             | Protected signer/certificate/timestamp fails  | Block public Windows release; never publish unsigned fallback            |
| Signing secret exposed          | Secret is available outside protected job     | Disable workflow, rotate/revoke credential, investigate before rerun     |
| Attestation unavailable/invalid | Provenance verification fails                 | Block root receipt/publication; do not downgrade to local hashes         |
| Optional desktop scope drifts   | Host artifact appears without selected policy | Reject asset; require explicit policy/recommendation update              |

## Security Considerations

- Use immutable action commit pins.
- Verification workflows use `contents: read`; only protected publish job gets
  `contents: write`.
- Never execute pull-request code on privileged/self-hosted PowerPoint or release
  environments; later provider lanes consume immutable artifacts only.
- Validate artifact paths against traversal and symlink escape.
- Do not put `GITHUB_TOKEN`, secrets, environment values, or raw slide content in
  manifests/receipts.
- Hashes establish artifact identity, not independent trust.
- Require GitHub/Sigstore signed artifact provenance and verify subject/workflow
  identity; do not treat an uploaded JSON receipt as a signature.
- Keep Authenticode keys in an external protected signing service or HSM-backed
  store. Never export a PFX into repository artifacts or general CI.
- Verify signer identity and timestamp after artifact download so signing cannot
  be bypassed by replacing bytes between jobs.
- Keep release environment approvals and tag protections external/manual where
  GitHub administration is required.

## Dependencies/Next Steps

- Depends on Phase 2’s exact version/tag contract and Phase 3’s faster complete
  test topology.
- Later phases add package-first, exact-row, and expanded PowerPoint receipts to
  this same subject without rebuilding the client; Windows Office/OfficeCLI lanes
  already attach through the host receipt DAG.
- Phase 16 performs final release rehearsal. It may publish only through this
  workflow and only after every selected downstream gate is green.
- Actual tag creation/push/release remains an explicit operator action outside
  this planning phase.
