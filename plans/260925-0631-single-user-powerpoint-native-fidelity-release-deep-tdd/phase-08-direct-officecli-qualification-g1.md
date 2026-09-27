---
phase: 8
title: 'Direct OfficeCLI Qualification G1'
status: pending
priority: P0
effort: '10-15 engineer-days'
dependencies: [1, 7]
---

# Phase 8: Direct OfficeCLI Qualification G1

## Context Links

- [Plan overview](./plan.md)
- [Phase 1: start and feasibility evidence](./phase-01-start.md)
- [Phase 7: package authority and matrix G0](./phase-07-package-authority-and-matrix-g0.md)
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\phase-02-officecli-qualification-and-reproducible-distribution.md`
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\phase-04-sandboxed-officecli-process-gateway.md`
- `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\phase-13-ci-platform-security-and-release-claim-gates.md`
- `C:\Work\NavSlidesEditor\docs\journals\260715-0215-officecli-containment-contract-open-native-gates.md`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-manifest.json`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway.js`
- `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\bounded-runner.js`
- `C:\Work\NavSlidesEditor\server\services\validated-edited-export.js`

## Goal

Close G1 under one explicit active policy: direct local execution of the exact
administrator-configured OfficeCLI Windows binary through fixed typed Node
operations under the invoking single-user application's ordinary Windows account.
The exact supported tuple is `1.0.135` / `33,111,928` bytes /
`937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`. Use a
hash-bound bounded cache, enforce concurrency/time/temp/output/path/cleanup
contracts, qualify real valid and invalid fixtures, and publish truthful residual
limitations. Phase 1 must still provide real fixture, decoder, and binary
evidence; its receipt is not an isolation attestation.

**Current operator waiver (2026-09-27):** For this direct-local OfficeCLI 1.0.135
G1 lane only, a dedicated clean Windows account or disposable VM and
deny-by-default outbound egress are not required. OfficeCLI runs with the ordinary
developer account's filesystem credentials and outbound network access. There is
no filesystem, credential, network, or process containment claim. This waiver
does not change the pinned binary, fixed typed operations, valid/invalid fixture
requirements, path or process limits, cleanup, G0/G1 evidence, or any protected-
provider/PowerPoint claim boundary. G1 remains blocked until every unwaived gate
passes; this policy decision does not pass G1 or complete a phase.

Supersede historical launcher/protected-copy/provider/KMS prerequisites without
rewriting their evidence. Historical clean-account/egress decisions remain
immutable evidence and are superseded only for this scoped G1 policy.

## Scope / Non-goals

### In scope

- One configured canonical absolute Windows `OFFICECLI_PATH`.
- An affirmative Phase 1 physical feasibility receipt bound to the exact binary,
  Windows build, real valid/invalid fixture results, decoder behavior, and cleanup
  policy. It records the ordinary local execution context without claiming
  account, filesystem, credential, or network isolation.
- Execution under the invoking application's current Windows account/token.
  Dedicated-account/VM isolation and deny-by-default outbound egress are waived;
  the ordinary account's filesystem credentials and outbound network access remain
  available to OfficeCLI.
- A filtered child-process environment and redacted receipts/logs. These constrain
  explicit inputs and disclosure only; they do not restrict filesystem or network
  access available to the current account.
- Exact release manifest, path safety, version, length, SHA-256, and launch-bound
  identity verification.
- Only `--version` and `validate <private-input> --json`.
- Shell-free direct Node child execution.
- Shared bounded admission, immutable deadlines, output/temp/input budgets.
- Hash-bound qualification cache for capability reads.
- Timeout/cancel/shutdown/output-flood Windows tree termination and residual scan.
- Exact positive/negative cache invalidation and cleanup on shutdown/drift/failure.
- Real physical qualification and process-cleanup runs with immutable local
  receipts that state the waived isolation boundary and residual risk.
- Final wording that says what is observed and what is not proven.

### Non-goals

- Native launcher, protected execution copy, AppContainer, or independent
  teardown attestation.
- Cloud/VM provider, protected runner, external KMS/HSM, independent signer, or
  separation of duties.
- Bundling, downloading, updating, discovering through PATH/registry, or silently
  installing OfficeCLI.
- OfficeCLI mutation, rendering, generic raw commands, resident/watch mode, or
  exposing paths/argv/environment to a route/client.
- Linux, Docker, or macOS OfficeCLI support.
- Claiming memory/process hard caps, filesystem/credential/network isolation,
  deny-egress, escape-proof profile isolation, or descendant containment beyond
  the exact observed physical cleanup tests. This lane is not a sandbox and has no
  account/VM or egress isolation proof.

## Key Insights

- Production composition already selects the direct gateway, but dead launcher
  wiring and a historical launcher-required journal create a release-policy
  contradiction.
- Qualification currently probes `--version` on each capability check. Repeated
  fidelity availability reads can amplify unbounded child processes.
- The gateway passes `maxMemoryBytes` and `maxProcesses`, but the direct runner
  does not enforce them. G1 should not claim unsupported hard limits.
- `child.kill()` terminates only the direct child on Windows and provides no proof
  that descendants exited.
- Exact file hashing is the authority. A cache may suppress repeated version
  probes only when bound to the exact hash/path/file identity, policy, matrix, and
  bounded age; execution still revalidates the binary and input.
- The exact OfficeCLI asset is unsigned and administrator-provided. Hash pinning
  and release metadata provide local integrity, not publisher signing or
  independent attestation.
- The operator accepted direct execution in the ordinary developer account for
  this G1 lane. Its filesystem credentials and outbound network access remain
  available to OfficeCLI; filtered child environment variables do not contain it.
- The scoped waiver removes only clean-account/VM and deny-egress prerequisites.
  A local physical run now accepts the PowerPoint-generated fixture with the
  corrected decoder and rejects both malformed fixtures at production preflight.
  G1 remains blocked by clean exact-source receipt review, G0 authority, and the
  independent process/cleanup/cache gates; this run does not prove containment.

## Requirements

### Feasibility and ordinary-account execution

1. Phase 1 owns a hash-bound immutable local feasibility receipt for the exact
   OfficeCLI tuple and an independently reviewed clean source commit. It records
   a successful `--version`, real valid/invalid validation through the production
   gateway, decoder behavior, and cleanup results. Its schema-v2 claim scope is
   local physical feasibility, not release authority. It records ordinary-account
   execution without asserting filesystem, credential, or network isolation.
2. Phase 8 verifies the receipt against its independently supplied source SHA
   before qualification. It binds binary hash/length/version, Windows build,
   fixture hashes/results, qualification policy digest, and freshness. A clean
   Git source tree is a provenance requirement, not the waived clean-account/VM
   or deny-egress isolation proof; no egress-policy or secret-boundary receipt is
   required.
3. Missing, stale, mismatched, skipped, synthetic, or negative Phase 1 feasibility
   blocks G1 because the physical binary/fixture/decoder evidence is missing or
   invalid. The waiver does not convert missing evidence into a pass or permit mock
   fixtures.
4. OfficeCLI runs under the invoking application's current Windows account/token.
   A dedicated clean account or disposable VM is not required. Use the process's
   existing token without privilege elevation or impersonation; record its actual
   privilege context and do not characterize it as isolated.
5. The fixed runner receives only the pinned OfficeCLI binary, fixed operation,
   current validated private input copy, allowlisted child environment, and private
   workspace as explicit process inputs. Do not intentionally pass credentials or
   unrelated files as inputs. The ordinary account's existing filesystem access
   and credentials remain available; this input discipline is not a containment
   boundary.
6. Deny-by-default outbound egress, a firewall/WFP rule, disabled VM networking,
   and an empty-allowlist network proof are not G1 prerequisites. The invoking
   account retains its configured outbound network access. No egress-denial claim
   is made, and environment filtering does not prevent network access.
7. Receipts and logs remain redacted: do not copy or print real secrets, document
   content, local usernames, configured paths, or raw process output. Do not add
   sentinel or DNS/TCP/HTTP-denial assertions as isolation evidence.
8. Before each launch, reverify the canonical executable, exact binary identity,
   validated input, fixed operation, and immutable time/output/temp budgets. The
   account profile, credential availability, and egress state are not isolation
   admission checks and do not block a launch under this waiver.

### Active policy and supersession

9. A checked-in policy record names `direct-local-officecli-v1` as the sole G1
   policy and explicitly supersedes launcher/protected-copy/provider/KMS
   prerequisites for this local single-user release. The operator waiver also
   supersedes only the clean-account/VM and deny-by-default-egress requirements for
   this G1 lane. It does not establish containment or change any other gate.
10. Historical records remain intact and are labeled historical/superseded; they
    are never relabeled as direct-local evidence. The current waiver is additive;
    it does not rewrite the Phase 1 reports or decisions.
11. Production code contains no launcher selection, launcher environment variables,
    launcher receipt acceptance, protected-copy requirement, provider hop, or KMS
    dependency.
12. Final artifacts contain no OfficeCLI binary, downloader, updater, or launcher.

### Exact binary qualification

13. Supported tuple is exactly:

- version: `1.0.135`
- byte length: `33,111,928`
- SHA-256:
  `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`
- platform: `win32`
- acquisition: administrator-provided configured absolute path.

14. Reject absent, relative, current-directory, PATH, registry, UNC, device,
    alternate-data-stream, symlink, junction/reparse, non-regular, or hardlinked
    paths before execution.
15. Resolve canonical path and bind volume/file identity, link count, size, hash,
    last-write metadata, manifest digest, and policy digest.
16. Run one bounded `--version` probe; accept only exact `1.0.135` output and exit
    behavior. Re-read exact identity/hash after the probe.
17. Before every package validation, reverify canonical path, regular-file safety,
    length, SHA-256, and final launch-bound identity. Cache never replaces this
    execution check.

### Hash-bound cache

18. Capability-read cache key includes canonical path, file identity, exact binary
    SHA-256, manifest digest, operation-policy digest, environment-policy digest,
    direct-local waiver/policy digest, limits-policy digest, G0 matrix subject/epoch,
    and OfficeCLI version result hash. It has no clean-profile, secret-boundary, or
    egress-isolation authority.
19. Positive cache TTL is 30 seconds; negative cache TTL is at most 5 seconds.
20. Cache capacity is bounded (maximum 8 tuples), single-flight, and process-local.
21. Any stat/hash/path/policy/matrix drift, validation failure, cleanup uncertainty,
    shutdown, or explicit revocation synchronously invalidates the exact tuple and
    rejects waiters. Account credential availability and egress changes are not
    isolation-policy drift under this waiver.
22. Cache entries contain no paths, document data, stdout/stderr, secrets, or
    reusable authority beyond the exact advisory qualification tuple. Shutdown
    clears the map and tests prove zero entries and no pending single-flight
    promise remain.
23. Availability may use an unexpired cache after cheap binary and policy checks;
    actual validation always performs the exact hash/identity check under shared
    admission.

### Typed bounded execution

24. Only fixed templates `officecli.version.v1` and `officecli.validate.v1` exist.
25. Spawn uses `shell:false`, ignored stdin, allowlisted non-secret environment,
    the invoking application's current Windows account/token, private cwd,
    `windowsHide:true`, and no client-supplied executable/verb/path/argv/env.
26. Environment includes `OFFICECLI_NO_AUTO_RESIDENT=1` and
    `OFFICECLI_SKIP_UPDATE=1`; secrets and unrelated process environment are absent.
27. Validation receives only a private copied package that already passed current
    recursive ZIP/XML/OPC/active-content guards and exact G0 lifecycle/head checks.
28. Default budgets are explicit and immutable per job:
    - shared OfficeCLI capacity `1`
    - bounded queue `8`
    - input `50 MiB`
    - temp workspace `75 MiB`
    - stdout `64 KiB`
    - stderr `64 KiB`
    - wall time `30 s`
    - cleanup grace `5 s`.
29. Output overflow, malformed JSON, non-zero exit, timeout, cancellation, binary
    drift, input drift, temp overflow, shutdown, or cleanup uncertainty publishes
    no successful receipt/result.

### Exact workspace, cache, and Windows tree cleanup

30. Each run uses a new unpredictable private workspace owned by the current
    process. It records a pre-run tree/inventory, input copy hash, expected outputs,
    and exact created-file set without following links/reparse points.
31. The runner tracks direct PID, process creation identity/start time, job ID,
    workspace, and current process execution context before accepting output.
32. Failure first stops result acceptance, then terminates the direct child and
    invokes fixed-system `taskkill.exe /PID <pid> /T /F` (shell-free) when needed.
33. The runner waits bounded cleanup grace, inventories attributable descendants
    using PID/parent/start-time/process-creation evidence, and accepts cleanup only
    when no observed attributable process remains. PID reuse, inaccessible process
    metadata, or an escaped/unattributable candidate is uncertainty, not success.
34. On every success and typed validation failure, close handles, verify output
    bounds, remove exact owned input/output/temp files, remove the empty workspace,
    clear job-local cache/material, and physically prove no workspace, handle, or
    attributable process remains. Never recursively delete an unverified path.
35. Timeout/cancel/shutdown/flood/decoder failures perform process-tree termination
    first. If exact file ownership and tree-zero are proven, cleanup removes the
    workspace; otherwise it moves only the verified owned workspace to a non-served
    owner-only quarantine and records its digest.
36. Any residual or unverifiable process/file/handle/cache inventory returns
    `CLEANUP_UNCERTAIN`, invalidates the exact cache tuple, and blocks G1.
37. The qualification receipt states that only the exact local child-tree and
    workspace cleanup was observed. It makes no assignment-before-execution, Job
    Object, escape-proof descendant, filesystem/credential/network containment,
    deny-egress, independent teardown-attestation, hard memory/process-limit, or
    general-sandbox claim. It explicitly discloses that OfficeCLI runs with the
    ordinary account's filesystem credentials and outbound network access.

### Receipt and G1 gate

38. A qualifying receipt binds the Phase 1 feasibility receipt, exact binary/path
    identity, version probe hash, validated fixture input/output hashes, matrix
    subject/epoch, lifecycle/head subject where applicable, operation/environment/
    limits/tree-cleanup/waiver policy digests, redacted execution-context
    description, Windows build/architecture, timestamps, cache lineage, exact
    cleanup inventory, and limitations. Execution context is provenance only, not
    an isolation attestation; no egress or secret-boundary receipt is required.
39. At least one real valid fixture and one malformed/invalid fixture run through
    the production gateway. The valid fixture succeeds; invalid fixture fails with
    the expected typed result and no residue.
40. Physical qualification also runs timeout, cancellation, stdout/stderr flood,
    malformed output, child/grandchild cleanup, and cache drift/shutdown checks.
    It does not require sentinel-access or DNS/TCP/HTTP-denial tests and must not
    characterize those boundaries as contained. Receipts/logs contain no real
    secrets or raw document content.
41. Missing/wrong OfficeCLI or unavailable required fixture/feasibility evidence
    leaves original recovery available and capability disabled; it does not make
    server startup fail.

## Architecture / Data Flow

```text
capability read
  -> G0 current authority
  -> Phase 1 physical feasibility + direct-local policy subject (no isolation proof)
  -> shared admission for uncached probe
  -> canonical path + exact identity/hash
  -> exact --version
  -> post-probe identity/hash
  -> hash-bound 30s receipt cache
  -> available/unavailable capability
```

```text
validate package
  -> current lifecycle/head/matrix/source guards
  -> invoking account context; no clean-account or egress admission gate
  -> shared capacity=1 admission
  -> exact binary hash/identity recheck (cache is not authority)
  -> private workspace + copied/hashed input
  -> direct spawn fixed argv
  -> bounded stdout/stderr/time/temp
  -> strict decoder
  -> exact cache/workspace/handle/tree-zero observation
  -> terminal local receipt
```

```text
timeout/cancel/shutdown/overflow/decoder failure
  -> irrevocably reject output
  -> child.kill()
  -> fixed taskkill.exe /T /F if process remains
  -> bounded attributable-process inventory
  -> exact owned-file/cache cleanup
  -> clean OR CLEANUP_UNCERTAIN + quarantine + G1 blocked
```

No launcher/client/provider/signer exists in the active execution chain.

## Absolute Deep File Inventory

| Action | Absolute path                                                                                           | Planned change                                                                                | Mechanical proof         |
| ------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------ |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-manifest.json`             | Freeze exact 1.0.135/length/hash asset and active direct policy metadata                      | Manifest tests           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification.js`                        | Exact direct path/hash/version/identity receipt; remove protected-copy path from active API   | Qualification tests      |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification.test.js`                   | Exact pin, unsafe path, drift, physical handoff cases                                         | Focused Vitest           |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-cache.js`                  | Bounded hash/policy/matrix-bound single-flight cache and exact clearing                       | Unit tests               |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-cache.test.js`             | TTL, drift, revocation, stampede, shutdown/waiter/zero-residue cases                          | Focused Vitest           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\process-contract.js`                     | Fixed env/argv/direct policy digest                                                           | Contract tests           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\bounded-runner.js`                       | Immutable deadline, output bounds, current-account launch, exact workspace/cache/tree cleanup | Runner tests             |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\windows-process-tree.js`                 | Fixed taskkill invocation and attributable-process scan                                       | Windows tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\windows-process-tree.test.js`            | Child/grandchild/uncertain cleanup matrix                                                     | Physical + fake tests    |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway-policy.js`                       | Enforce requested input/temp/output/time/concurrency only; truthful limitations               | Policy tests             |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway.js`                              | Cache/admission/final hash checks and cleanup receipt                                         | Gateway tests            |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway.test.js`                         | Probe stampede, drift, timeout, tree, quarantine                                              | G1 unit gate             |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway-command-contract.test.js`        | Only version/validate fixed argv                                                              | Architecture gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\__fixtures__\fake-officecli.cjs`         | Spawn descendant, hang, flood, malformed output, valid/invalid fixtures                       | Process tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-qualification.js`               | Run real exact binary fixtures and emit immutable local receipt                               | Physical gate            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-qualification.test.js`          | Schema, physical feasibility binding, residual-risk disclosure, exact cleanup                 | Focused Vitest           |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-process-cleanup.test.js`        | Real timeout/cancel/flood/child/grandchild/cache/workspace/handle zero-residue tests          | Physical cleanup gate    |
| Modify | `C:\Work\NavSlidesEditor\server\services\validated-edited-export.js`                                    | Remove launcher wiring; use cached direct gateway and G0 subjects                             | Service tests            |
| Modify | `C:\Work\NavSlidesEditor\server\services\validated-edited-export.test.js`                               | Assert no launcher path and bounded concurrent availability probes                            | G1 service gate          |
| Modify | `C:\Work\NavSlidesEditor\server\services\host-admission-controller.js`                                  | Named OfficeCLI capacity/queue metrics and shutdown                                           | Admission tests          |
| Delete | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\launcher-client.js`                      | Remove dead launcher execution authority after all consumers migrate                          | Import/architecture grep |
| Delete | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\native-launcher-client.test.js`          | Remove obsolete launcher contract tests                                                       | Test inventory           |
| Delete | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\native-launcher-contract.test.js`        | Remove obsolete launcher receipt authority tests                                              | Test inventory           |
| Delete | `C:\Work\NavSlidesEditor\native\windows-officecli-launcher`                                             | Remove inactive launcher source from release tree                                             | Package absence scan     |
| Create | `C:\Work\NavSlidesEditor\scripts\qualify-officecli-local.js`                                            | Non-interactive physical G1 qualification and cleanup receipt; no isolation claim             | Script tests             |
| Modify | `C:\Work\NavSlidesEditor\package.json`                                                                  | Add `test:pptx:officecli:unit` and `test:pptx:officecli:qualify`                              | Script contract          |
| Modify | `C:\Work\NavSlidesEditor\scripts\pptx-package-claim-gate.js`                                            | Reject bundled OfficeCLI, downloader, updater, and launcher remnants                          | Package gate tests       |
| Modify | `C:\Work\NavSlidesEditor\scripts\pptx-package-claim-gate.test.js`                                       | Final-tree absence cases                                                                      | Focused Vitest           |
| Create | `C:\Work\NavSlidesEditor\docs\officecli-direct-local-policy.md`                                         | Active policy, exact pin, operations, limits, limitations                                     | Docs contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\journals\260715-0215-officecli-containment-contract-open-native-gates.md` | Append explicit superseded-by marker; preserve history                                        | Docs contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md`                                            | G1 local claim wording and fallback                                                           | Docs contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\deployment-guide.md`                                                      | Administrator configuration and safe failure                                                  | Docs contract            |

## Tests Before (RED)

1. Historical launcher qualification is accepted by production composition.
2. Missing launcher env disables an otherwise exact direct binary.
3. PATH, UNC, reparse, ADS, hardlink, wrong size, wrong hash, or wrong version runs.
4. Capability polling starts one `--version` process per request.
5. Cache survives binary/policy/matrix drift.
6. Validation trusts a cache entry without final hash verification.
7. Queue exceeds bounded capacity or bypasses shared admission.
8. Timeout/output overflow kills only direct child; grandchild remains.
9. Cleanup uncertainty still returns validation success.
10. `maxMemoryBytes`/`maxProcesses` appear in receipt as enforced despite no enforcement.
11. Server logs expose configured path, stderr, fixture content, or hashes not
    intended for the receipt.
12. Physical valid fixture uses a mock and still closes G1.
13. Final artifact contains launcher or OfficeCLI payload/downloader.
14. G1 accepts a missing, stale, synthetic, or invalid Phase 1 physical-feasibility
    receipt, or accepts the real 1.0.135 success output without production-decoder
    compatibility.
15. A receipt claims filesystem/credential/network isolation or deny-egress without
    evidence, or presents this ordinary-account run as contained.
16. Cache remains populated or a single-flight waiter resolves after policy drift,
    shutdown, or revocation.
17. Success leaves the private input, output, temp file, workspace, handle, or
    attributable process behind.
18. A required physical fixture or process-cleanup test is skipped or mocked and
    G1 still closes.

## Numbered Implementation

1. Verify Phase 1 contains a current affirmative physical-feasibility receipt
   with real valid/invalid fixture results and actual 1.0.135 decoder behavior.
   If it is missing or fails, G1 remains blocked; do not label this an isolation
   blocker or infer a pass.
2. Record the explicit account/egress waiver, ordinary-account residual risk, and
   current direct-local policy before code changes; preserve historical reports and
   decisions unchanged.
3. Freeze the exact manifest tuple and operation/environment/limits/waiver-policy
   digests.
4. Delete launcher selection from production composition; make direct qualification
   the only accepted receipt kind.
5. Write exact pin/path/drift, output-decoder, fixture, receipt-redaction, and
   launch-bound RED tests. Do not add account-isolation or egress-denial gates.
6. Implement exact binary/input admission and pre-launch identity checks; do not
   require a dedicated account, clean profile, or deny-egress rule.
7. Implement the bounded single-flight qualification cache with exact keys/TTLs
   and synchronous shutdown/policy-drift clearing.
8. Put uncached probes and validations through shared admission.
9. Narrow runner/gateway limits to guarantees actually enforced.
10. Implement immutable whole-job deadlines and strict output/temp/input accounting.
11. Implement Windows direct-child plus `taskkill /T /F` termination and bounded
    attributable descendant inventory.
12. Implement exact success/failure workspace, file, handle, and cache cleanup;
    make any uncertainty terminal, quarantine exact owned evidence, and invalidate
    cache.
13. Bind qualification and validation receipts to Phase 1 feasibility,
    G0/lifecycle/head/policy/limits/cleanup subjects and the waiver policy.
14. Add real valid/invalid fixture qualification through production composition.
15. Add physical process-cleanup suites; any skip/mock/unavailable required
    qualification or cleanup boundary fails the G1 command. Do not claim
    filesystem, credential, or network isolation.
16. Remove dead launcher source/client/tests only after architecture grep proves no
    active consumer.
17. Extend final-package absence scans for binary/downloader/updater/launcher remnants.
18. Update docs with exact configuration, current-account execution and residual
    risks, blocked-without-required-evidence behavior, and explicit limitations.

## Refactor

- One direct qualification service shared by capability and validation.
- One cache with explicit advisory-versus-execution semantics.
- One process-tree cleanup module, Windows-only and injectable in tests.
- No separate account-isolation or egress-admission service; direct execution uses
  the invoking process's current account and reports its limits without containment.
- Remove unenforced limit fields rather than carrying aspirational configuration.
- Preserve typed operations; do not expose a generic subprocess wrapper.

## Tests After (GREEN)

- Only the exact configured direct binary tuple can qualify.
- Concurrent availability calls produce at most one version probe per cache key.
- Every validation rehashes/revalidates exact binary and input under admission.
- Every launch revalidates fixed operations, allowlisted child environment, and
  immutable budgets; the ordinary account context is not treated as containment.
- Timeout/cancel/shutdown/flood physical tests observe no attributable
  child/grandchild, workspace, handle, or cache residue.
- The receipt states that filesystem credentials and outbound network access are
  available to OfficeCLI; no isolation or deny-egress claim is made.
- Uncertain cleanup is fail-closed and leaves quarantined evidence, not success.
- Physical valid/invalid fixtures produce a current immutable local receipt.
- Final source/artifact scans find no launcher or OfficeCLI payload/downloader.

## Scenario Matrix

| Scenario                               | Capability/result             | Receipt/cleanup                                  |
| -------------------------------------- | ----------------------------- | ------------------------------------------------ |
| Missing `OFFICECLI_PATH`               | unavailable                   | original preserved                               |
| Missing/failed Phase 1 receipt         | unavailable; G1 remains open  | no OfficeCLI process                             |
| Ordinary invoking developer account    | permitted                     | actual file/network access; no containment claim |
| Outbound network available             | not an admission failure      | no deny-egress claim                             |
| Wrong platform                         | unavailable                   | no workspace/process                             |
| Relative/PATH/UNC/reparse/ADS/hardlink | unavailable                   | no process                                       |
| Exact pin, cold cache                  | available after one probe     | current hash-bound receipt                       |
| Exact pin, concurrent reads            | available                     | one single-flight probe                          |
| Cache within TTL, unchanged identity   | advisory available            | validation still rehashes                        |
| Binary replaced after cache            | unavailable                   | cache invalidated                                |
| G0 epoch/policy changes                | unavailable until requalified | old receipt historical                           |
| Valid package                          | validation success            | exact observed cleanup + local receipt           |
| Invalid package                        | typed validation failure      | exact workspace/cache/tree cleanup               |
| Timeout/cancel/output overflow         | failure                       | child/tree termination attempted                 |
| Residual descendant                    | `CLEANUP_UNCERTAIN`           | quarantine; G1 blocked                           |
| Server shutdown                        | admission closed/failure      | no accepted late output                          |
| Artifact scan                          | pass only if absent           | no binary/downloader/launcher                    |

## Regression Commands

```powershell
npm run test:pptx:officecli:unit
npx vitest run server/services/pptx-import/officecli/qualification.test.js server/services/pptx-import/officecli/qualification-cache.test.js server/services/pptx-import/officecli/gateway.test.js server/services/pptx-import/officecli/gateway-command-contract.test.js server/services/pptx-import/officecli/windows-process-tree.test.js server/services/pptx-import/officecli/physical-qualification.test.js server/services/validated-edited-export.test.js
npx vitest run server/services/pptx-import/transactional-export-validators.test.js server/services/pptx-import/mutation-transaction.test.js scripts/pptx-package-claim-gate.test.js
npm run test:pptx:package:no-officecli
npm run lint
npm run build
$env:OFFICECLI_PATH='C:\absolute\admin-provided\OfficeCLI.exe'
$env:OFFICECLI_PHASE1_FEASIBILITY_RECEIPT='C:\absolute\evidence\phase01-officecli-feasibility.json'
npm run test:pptx:officecli:qualify
```

Mechanical G1 gate runs on Windows with the real configured binary. It must:

1. recompute exact path/version/length/hash;
2. verify the Phase 1 receipt for real fixture/decoder evidence and record the
   actual invoking account context; do not require a dedicated account/VM or
   deny-egress state;
3. execute valid and invalid fixtures through production composition;
4. exercise real timeout/cancel/flood and child/grandchild process cleanup;
5. disclose that filesystem credentials and outbound network access remain
   available; do not assert secret-access or network-denial containment;
6. prove zero cache waiters/entries, workspace files/handles, and attributable
   processes after every terminal outcome;
7. emit one receipt bound to current feasibility/G0/policy/limits/cleanup subjects
   and the scoped waiver;
8. report the full residual-limitations set;
9. exit nonzero for missing feasibility, missing binary, mismatch, invalid fixture,
   decoder failure, residual process/file/handle/cache, stale receipt, cache drift,
   skipped fixture, mock runner, or stale subject.

Unit tests, mocks, or historical launcher/provider evidence cannot close G1.

## Todos

- [ ] Record the direct-local policy and scoped account/egress waiver.
- [ ] Verify Phase 1 physical-feasibility receipt and real valid/invalid fixture results.
- [ ] Verify production decoder behavior against actual 1.0.135 output.
- [ ] Record ordinary-account filesystem/network residual risk; make no containment claim.
- [ ] Write exact pin/path/drift RED tests.
- [ ] Implement hash-bound qualification cache.
- [ ] Bound probe/validation admission.
- [ ] Implement direct Windows tree termination/inventory.
- [ ] Implement exact cache/workspace/file/handle cleanup.
- [ ] Remove unenforced memory/process claims.
- [ ] Bind receipts to G0/lifecycle/head/policy and exact cleanup evidence.
- [ ] Remove dead launcher execution chain.
- [ ] Run real valid/invalid/timeout/tree physical qualification.
- [ ] Run physical process-cleanup suite with no skips.
- [ ] Run package absence scan and milestone regressions.

## Success Criteria

- [ ] Direct-local OfficeCLI is the sole active G1 policy.
- [ ] A current Phase 1 physical-feasibility receipt binds real valid/invalid fixture
      results and actual 1.0.135 decoder behavior; it does not prove isolation.
- [ ] The current operator waiver is scoped to this G1 lane and does not mark G1
      passed or complete any phase.
- [ ] The ordinary account's filesystem credentials and outbound network access are
      disclosed; no filesystem/credential/network containment or deny-egress claim
      is made.
- [ ] Historical launcher/cloud/KMS requirements are explicitly superseded, not
      silently ignored or relabeled.
- [ ] Only exact `1.0.135`, `33,111,928` byte, pinned-hash binary qualifies.
- [ ] No PATH/registry/UNC/reparse/ADS/hardlink or request-supplied authority exists.
- [ ] Cache is bounded, single-flight, hash/policy/matrix-bound, and never replaces
      execution revalidation.
- [ ] Cache clears exactly on shutdown, binary/input/policy drift, and failure.
- [ ] Concurrency, queue, input, temp, stdout, stderr, wall time, and cleanup grace
      are enforced.
- [ ] Windows timeout/cancel/shutdown/flood tests leave no observed attributable
      process.
- [ ] Every terminal run leaves no verified workspace/file/handle/cache residue.
- [ ] Cleanup uncertainty fails closed and quarantines the workspace.
- [ ] Receipt truthfully lists account, filesystem, credential, network, and
      process-containment limitations.
- [ ] Real physical valid/invalid qualification passes through production code.
- [ ] Final package/source scans contain no OfficeCLI binary/downloader/updater/launcher.
- [ ] All regression commands pass and G1 report is current.

## Risks with Signals / Responses

| Risk                                                | Observable signal                                                    | Pre-decided response                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Direct policy conflicts with old journal            | reviewers/tests still require launcher receipt                       | Append explicit supersession and remove active launcher acceptance before qualification     |
| Cache masks replacement                             | validation succeeds after binary swap                                | Execution always rehashes; invalidate cache and fail                                        |
| Capability probe stampede                           | process count grows with reads                                       | Single-flight cache + shared capacity/queue                                                 |
| `taskkill /T` misses escaped descendant             | process inventory finds residual                                     | `CLEANUP_UNCERTAIN`; block G1, no containment claim                                         |
| Taskkill terminates unrelated PID reuse             | start-time/parent evidence mismatches                                | Verify direct PID/start identity; avoid broad name-based kills                              |
| Hard memory cap unavailable                         | receipt says memory bounded                                          | Remove claim; observe/report only, keep concurrency/time/temp/output bounded                |
| Unsigned binary provenance overstated               | docs imply vendor signature                                          | State administrator-provided hash pin and local integrity only                              |
| Physical suite silently skips                       | CI output says skipped but exit 0                                    | Qualification command treats skip/missing env as failure                                    |
| Ordinary account has filesystem and network access  | user profile credentials/files or outbound connections are reachable | State the residual risk plainly; make no containment claim and do not call the run isolated |
| Environment filter mistaken for filesystem boundary | OfficeCLI can read account-accessible files                          | Keep explicit argv/input/env narrow; disclose that account access remains available         |
| Network denial assumed from local operation         | egress was not restricted or tested                                  | Make no deny-egress claim; retain ordinary host network behavior                            |
| Cleanup passes with cache/file residue              | post-run inventory nonempty                                          | `CLEANUP_UNCERTAIN`; quarantine exact owned workspace and block G1                          |
| Dead launcher files remain packaged                 | absence scan finds launcher strings/binary                           | Remove dead source/config and rebuild before G1                                             |

## Security

- OfficeCLI receives only guarded private package copies, never package-store or
  upload paths.
- No route/client controls executable, operation, argv, environment, cwd, or
  output path.
- Environment is allowlisted and update/resident behavior disabled; this does not
  restrict the current account's filesystem or network access.
- OfficeCLI runs under the invoking application's ordinary Windows account/token.
  That account retains its filesystem credentials and outbound network access; no
  dedicated account/VM, secret-access denial, or egress denial is required or
  claimed for this G1 lane.
- Paths, document content, stdout/stderr, and credentials are redacted from public
  errors/logs.
- Direct local execution is not a sandbox. Disclose: no assignment-before-execution,
  no Job Object/escape-proof descendant containment, no filesystem/credential/
  network containment, no deny-egress proof, no hard memory/process cap, no
  independent teardown attestation, no independent signer, and no separation of
  duties. Claim only the pinned binary, fixed operations, exact fixture outcomes,
  bounded resources that are enforced, and observed local process/workspace cleanup.
- Missing or failed OfficeCLI never blocks immutable Original recovery.

## Next Steps

Phase 9 may consume G1 only by exact current receipt subject. It must revalidate
G0/G1 after admission and before transactional publication; stale cache or
historical launcher/provider receipts provide no authority.
