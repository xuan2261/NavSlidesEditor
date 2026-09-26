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
operations inside a clean dedicated Windows local account or disposable VM with
no project secrets and fail-closed bounded egress. Phase 1 must first provide an
affirmative feasibility receipt for that exact isolation profile; absence or
failure blocks G1. Supersede historical launcher/protected-copy/provider/KMS
prerequisites without rewriting their historical evidence, but do not supersede
the real isolation requirement. Qualify version and package validation for
the exact `1.0.135` / `33,111,928` byte /
`937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`
binary, use a hash-bound bounded cache, enforce concurrency/time/temp/output
limits, prove exact cache/workspace/process-tree cleanup physically, and publish
truthful residual limitations.

## Scope / Non-goals

### In scope

- One configured canonical absolute Windows `OFFICECLI_PATH`.
- An affirmative Phase 1 isolation-feasibility receipt bound to the exact binary,
  Windows image/build, account-or-VM profile, egress policy, and cleanup policy.
- Execution only in a dedicated clean non-administrator Windows local account or
  disposable clean VM snapshot with no repository/project secrets or inherited
  developer credentials and bounded fail-closed egress.
- Exact release manifest, path safety, version, length, SHA-256, and launch-bound
  identity verification.
- Only `--version` and `validate <private-input> --json`.
- Shell-free direct Node child execution.
- Shared bounded admission, immutable deadlines, output/temp/input budgets.
- Hash-bound qualification cache for capability reads.
- Timeout/cancel/shutdown/output-flood Windows tree termination and residual scan.
- Exact positive/negative cache invalidation and cleanup on shutdown/drift/failure.
- Real physical qualification, process cleanup, and isolation/security runs with
  immutable local receipts.
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
- Claiming memory/process hard caps, escape-proof profile isolation, or descendant
  containment beyond the exact observed physical tests. The required clean
  account/VM, secret absence, and bounded egress are operational isolation proofs,
  not a general sandbox claim.

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
- Direct execution in a developer's normal logged-in account is not acceptable:
  filtered environment variables do not prevent filesystem/profile credential
  access or outbound network use.
- If Phase 1 did not prove the exact binary is usable in the required clean
  account/VM with the egress policy active, Phase 8 is infeasible and G1 remains
  blocked. The plan must not silently weaken isolation to make qualification pass.

## Requirements

### Feasibility and isolation admission

1. Phase 1 owns a hash-bound immutable local feasibility receipt for the exact OfficeCLI
   tuple. It records a successful `--version` and valid/invalid validation smoke in
   a clean dedicated Windows standard account or disposable VM, with the intended
   egress policy active and no project secrets present.
2. Phase 8 verifies that receipt before implementation qualification. It must bind
   exact binary hash/length/version, Windows build/architecture, isolation mode and
   immutable image/snapshot or account-policy digest, egress policy digest,
   qualification policy digest, and timestamp/freshness rule.
3. Missing, stale, mismatched, skipped, synthetic, or negative Phase 1 feasibility
   blocks G1. If real isolation infrastructure is unavailable, report
   `G1_BLOCKED_ISOLATION_UNAVAILABLE`; do not run in the developer account or
   weaken egress/secret controls.
4. The execution identity is a non-administrator dedicated local account with a
   clean profile and no interactive/saved-logon use, or a disposable clean VM
   snapshot with equivalent dedicated identity. The normal developer/service
   account is forbidden.
5. The isolated identity/VM receives only the pinned OfficeCLI binary, fixed
   runner bundle, current validated private input copy, and empty private
   workspace. It has no repository checkout, `.env`, SSH keys, Git credentials,
   cloud credentials, browser profiles/cookies, package registry tokens, signing
   keys, release tokens, rclone config, application data roots, or inherited
   secret-bearing environment variables.
6. Egress is deny-by-default and bounded by a checked-in policy. Because
   `--version` and local `validate` require no network, the G1 allowlist is empty.
   A VM must have networking disabled or an equivalent outbound-deny rule; an
   account/process deployment must use a preinstalled administrator-controlled
   firewall/WFP rule bound to the exact executable/isolation identity. Failure to
   inspect or enforce the rule blocks execution.
7. Qualification physically proves secret and network boundaries with non-secret
   sentinels: filtered environment/profile, denied access to out-of-scope sentinel
   files/data roots, and denied DNS/TCP/HTTP attempts from the isolated execution
   boundary. Tests must not copy or print real secrets.
8. Isolation state is rechecked before every process launch. Drift in identity,
   privilege membership, profile/image, mounted/shared paths, secret scan, or
   egress rule invalidates cache, rejects execution, and blocks a successful
   receipt.

### Active policy and supersession

9. A checked-in policy record names `direct-local-officecli-v1` as the sole G1
   policy and explicitly supersedes launcher/protected-copy/provider/KMS
   prerequisites for this local single-user release while retaining the clean
   account/VM, no-secrets, bounded-egress requirement.
10. Historical records remain intact and are labeled historical/superseded; they
    are never relabeled as direct-local evidence.
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
    isolation identity/image/account-policy digest, egress-policy digest,
    secret-boundary receipt digest, limits-policy digest, G0 matrix subject/epoch,
    and OfficeCLI version result hash.
19. Positive cache TTL is 30 seconds; negative cache TTL is at most 5 seconds.
20. Cache capacity is bounded (maximum 8 tuples), single-flight, and process-local.
21. Any stat/hash/path/policy/matrix/isolation/egress drift, validation failure,
    cleanup uncertainty, shutdown, or explicit revocation synchronously
    invalidates the exact tuple and rejects waiters.
22. Cache entries contain no paths, document data, stdout/stderr, secrets, or
    reusable authority beyond the exact advisory qualification tuple. Shutdown
    clears the map and tests prove zero entries and no pending single-flight
    promise remain.
23. Availability may use an unexpired cache after cheap binary and isolation
    identity checks; actual
    validation always performs the exact hash/identity check under shared admission.

### Typed bounded execution

24. Only fixed templates `officecli.version.v1` and `officecli.validate.v1` exist.
25. Spawn uses `shell:false`, ignored stdin, allowlisted non-secret environment,
    isolated identity/VM, private cwd,
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

30. Each run uses a new unpredictable private workspace under the isolated
    profile/VM. It records a pre-run tree/inventory, input copy hash, expected
    outputs, and exact created-file set without following links/reparse points.
31. The runner tracks direct PID, process creation identity/start time, job ID,
    workspace, and isolation subject before accepting
    output.
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
35. Timeout/cancel/shutdown/flood/decoder/isolation failures perform the same
    process-tree termination first. If exact file ownership and tree-zero are
    proven, cleanup removes the workspace; otherwise it moves only the verified
    owned workspace to a non-served owner-only quarantine and records its digest.
36. Any residual or unverifiable process/file/handle/cache inventory returns
    `CLEANUP_UNCERTAIN`, invalidates the exact cache tuple, and blocks G1.
37. The qualification receipt states that this is observed isolated local tree and
    workspace cleanup,
    not assignment-before-execution, Job Object containment, escape-proof
    descendant control, independent teardown attestation, hard memory/process
    limits, or a general sandbox. It does positively claim only the exact clean
    identity/VM, no-project-secrets sentinel tests, and deny-egress policy proven
    by the current physical isolation receipt.

### Receipt and G1 gate

38. A qualifying receipt binds the Phase 1 feasibility receipt, exact binary/path
    identity, version probe hash,
    validated fixture input/output hashes, matrix subject/epoch, lifecycle/head
    subject where applicable, operation/environment/limits/tree-cleanup policy
    digests, isolation account/VM/image subject, egress and secret-boundary receipt
    digests, Windows build/architecture, timestamps, cache lineage, exact cleanup
    inventory, and limitations.
39. At least one real valid fixture and one malformed/invalid fixture run through
    the production gateway. The valid fixture succeeds; invalid fixture fails with
    the expected typed result and no residue.
40. Physical qualification also runs timeout, cancellation, stdout/stderr flood,
    malformed output, child/grandchild escape attempts, cache drift/shutdown,
    out-of-scope file sentinel access, inherited-secret sentinel, and DNS/TCP/HTTP
    egress attempts through the production isolation boundary. All must fail or
    clean exactly as policy specifies.
41. Missing/wrong OfficeCLI or unavailable isolation leaves original recovery
    available and capability
    disabled; it does not make server startup fail.

## Architecture / Data Flow

```text
capability read
  -> G0 current authority
  -> Phase 1 feasibility + current isolation/egress/secret-boundary subject
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
  -> current clean account/VM + deny-egress + no-secret admission
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

| Action | Absolute path                                                                                           | Planned change                                                                              | Mechanical proof         |
| ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-manifest.json`             | Freeze exact 1.0.135/length/hash asset and active direct policy metadata                    | Manifest tests           |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\isolation-policy.js`                     | Verify Phase 1 feasibility, clean account/VM, no-secret inputs, bounded egress              | Security tests           |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\isolation-policy.test.js`                | Missing/stale receipt, admin account, secret/mount/env, egress drift cases                  | Focused Vitest           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification.js`                        | Exact direct path/hash/version/identity receipt; remove protected-copy path from active API | Qualification tests      |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification.test.js`                   | Exact pin, unsafe path, drift, physical handoff cases                                       | Focused Vitest           |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-cache.js`                  | Bounded hash/policy/matrix/isolation-bound single-flight cache and exact clearing           | Unit tests               |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\qualification-cache.test.js`             | TTL, drift, revocation, stampede, shutdown/waiter/zero-residue cases                        | Focused Vitest           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\process-contract.js`                     | Fixed env/argv/direct policy digest                                                         | Contract tests           |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\bounded-runner.js`                       | Immutable deadline, output bounds, isolated launch, exact workspace/cache/tree cleanup      | Runner tests             |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\windows-process-tree.js`                 | Fixed taskkill invocation and attributable-process scan                                     | Windows tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\windows-process-tree.test.js`            | Child/grandchild/uncertain cleanup matrix                                                   | Physical + fake tests    |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway-policy.js`                       | Enforce requested input/temp/output/time/concurrency only; truthful limitations             | Policy tests             |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway.js`                              | Cache/admission/final hash checks and cleanup receipt                                       | Gateway tests            |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway.test.js`                         | Probe stampede, drift, timeout, tree, quarantine                                            | G1 unit gate             |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\gateway-command-contract.test.js`        | Only version/validate fixed argv                                                            | Architecture gate        |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\__fixtures__\fake-officecli.cjs`         | Spawn descendant, hang, flood, malformed output, valid/invalid fixtures                     | Process tests            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-qualification.js`               | Run real exact binary fixtures and emit immutable local receipt                             | Physical gate            |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-qualification.test.js`          | Schema, feasibility/isolation binding, exact cleanup, fail-closed receipt tests             | Focused Vitest           |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-isolation-security.test.js`     | Real identity/privilege, secret sentinel, out-of-scope ACL, deny-egress tests               | Physical security gate   |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-process-cleanup.test.js`        | Real timeout/cancel/flood/child/grandchild/cache/workspace/handle zero-residue tests        | Physical cleanup gate    |
| Modify | `C:\Work\NavSlidesEditor\server\services\validated-edited-export.js`                                    | Remove launcher wiring; use cached direct gateway and G0 subjects                           | Service tests            |
| Modify | `C:\Work\NavSlidesEditor\server\services\validated-edited-export.test.js`                               | Assert no launcher path and bounded concurrent availability probes                          | G1 service gate          |
| Modify | `C:\Work\NavSlidesEditor\server\services\host-admission-controller.js`                                  | Named OfficeCLI capacity/queue metrics and shutdown                                         | Admission tests          |
| Delete | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\launcher-client.js`                      | Remove dead launcher execution authority after all consumers migrate                        | Import/architecture grep |
| Delete | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\native-launcher-client.test.js`          | Remove obsolete launcher contract tests                                                     | Test inventory           |
| Delete | `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\native-launcher-contract.test.js`        | Remove obsolete launcher receipt authority tests                                            | Test inventory           |
| Delete | `C:\Work\NavSlidesEditor\native\windows-officecli-launcher`                                             | Remove inactive launcher source from release tree                                           | Package absence scan     |
| Create | `C:\Work\NavSlidesEditor\scripts\qualify-officecli-local.js`                                            | Non-interactive isolated physical G1/security/cleanup command                               | Script tests             |
| Modify | `C:\Work\NavSlidesEditor\package.json`                                                                  | Add `test:pptx:officecli:unit` and `test:pptx:officecli:qualify`                            | Script contract          |
| Modify | `C:\Work\NavSlidesEditor\scripts\pptx-package-claim-gate.js`                                            | Reject bundled OfficeCLI, downloader, updater, and launcher remnants                        | Package gate tests       |
| Modify | `C:\Work\NavSlidesEditor\scripts\pptx-package-claim-gate.test.js`                                       | Final-tree absence cases                                                                    | Focused Vitest           |
| Create | `C:\Work\NavSlidesEditor\docs\officecli-direct-local-policy.md`                                         | Active policy, exact pin, operations, limits, limitations                                   | Docs contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\journals\260715-0215-officecli-containment-contract-open-native-gates.md` | Append explicit superseded-by marker; preserve history                                      | Docs contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md`                                            | G1 local claim wording and fallback                                                         | Docs contract            |
| Modify | `C:\Work\NavSlidesEditor\docs\deployment-guide.md`                                                      | Administrator configuration and safe failure                                                | Docs contract            |

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
14. G1 runs without an affirmative exact Phase 1 isolation-feasibility receipt.
15. Qualification falls back to the normal developer/admin account when the clean
    account/VM is unavailable.
16. The isolated run inherits a project token, can read an out-of-scope sentinel
    or application data root, or reaches DNS/TCP/HTTP despite the empty allowlist.
17. Cache remains populated or a single-flight waiter resolves after
    shutdown/isolation drift.
18. Success leaves the private input, output, temp file, workspace, handle, or
    attributable process behind.
19. A physical cleanup/security test is skipped or mocked and G1 still closes.

## Numbered Implementation

1. Verify Phase 1 contains a current affirmative exact-isolation feasibility
   receipt. If not, stop with `G1_BLOCKED_ISOLATION_UNAVAILABLE`.
2. Record the direct-local policy decision and supersession before code changes,
   explicitly retaining clean account/VM, no-secrets, and deny-egress requirements.
3. Freeze the exact manifest tuple and policy/environment/isolation/egress/limits
   digests.
4. Delete launcher selection from production composition; make direct qualification
   the only accepted receipt kind.
5. Write isolation-feasibility, account/VM, secret sentinel, egress, unsafe-path,
   exact-pin, pre/post-probe drift, and launch-bound RED tests.
6. Implement isolation admission and pre-launch drift checks.
7. Implement the bounded single-flight qualification cache with exact keys/TTLs
   and synchronous shutdown/drift clearing.
8. Put uncached probes and validations through shared admission.
9. Narrow runner/gateway limits to guarantees actually enforced.
10. Implement immutable whole-job deadlines and strict output/temp/input accounting.
11. Implement Windows direct-child plus `taskkill /T /F` termination and bounded
    attributable descendant inventory.
12. Implement exact success/failure workspace, file, handle, and cache cleanup;
    make any uncertainty terminal, quarantine exact owned evidence, and invalidate
    cache.
13. Bind qualification and validation receipts to Phase 1 feasibility,
    G0/lifecycle/head/policy/isolation/egress subjects.
14. Add real valid/invalid fixture qualification through production composition.
15. Add physical process cleanup and isolation/security suites; any skip/mock/
    unavailable boundary fails the G1 command.
16. Remove dead launcher source/client/tests only after architecture grep proves no
    active consumer.
17. Extend final-package absence scans for binary/downloader/updater/launcher remnants.
18. Update docs with exact configuration, isolation setup, blocked-without-isolation
    behavior, and explicit residual limitations.

## Refactor

- One direct qualification service shared by capability and validation.
- One cache with explicit advisory-versus-execution semantics.
- One process-tree cleanup module, Windows-only and injectable in tests.
- One isolation admission service shared by capability and execution; no fallback
  to the current interactive account.
- Remove unenforced limit fields rather than carrying aspirational configuration.
- Preserve typed operations; do not expose a generic subprocess wrapper.

## Tests After (GREEN)

- Only the exact configured direct binary tuple can qualify.
- Concurrent availability calls produce at most one version probe per cache key.
- Every validation rehashes/revalidates exact binary and input under admission.
- Every launch revalidates clean identity/VM, no-secret inputs, and deny-egress.
- Timeout/cancel/shutdown/flood physical tests observe no attributable
  child/grandchild, workspace, handle, or cache residue.
- Physical security tests prove secret sentinels/data roots are inaccessible and
  DNS/TCP/HTTP egress is denied.
- Uncertain cleanup is fail-closed and leaves quarantined evidence, not success.
- Physical valid/invalid fixtures produce a current immutable local receipt.
- Final source/artifact scans find no launcher or OfficeCLI payload/downloader.

## Scenario Matrix

| Scenario                               | Capability/result                  | Receipt/cleanup                     |
| -------------------------------------- | ---------------------------------- | ----------------------------------- |
| Missing `OFFICECLI_PATH`               | unavailable                        | original preserved                  |
| Missing/failed Phase 1 feasibility     | `G1_BLOCKED_ISOLATION_UNAVAILABLE` | no OfficeCLI process                |
| Normal developer/admin account         | unavailable                        | no OfficeCLI process                |
| Isolation/egress/secret drift          | unavailable                        | cache cleared; no launch            |
| Wrong platform                         | unavailable                        | no workspace/process                |
| Relative/PATH/UNC/reparse/ADS/hardlink | unavailable                        | no process                          |
| Exact pin, cold cache                  | available after one probe          | current hash-bound receipt          |
| Exact pin, concurrent reads            | available                          | one single-flight probe             |
| Cache within TTL, unchanged identity   | advisory available                 | validation still rehashes           |
| Binary replaced after cache            | unavailable                        | cache invalidated                   |
| G0 epoch/policy changes                | unavailable until requalified      | old receipt historical              |
| Valid package                          | validation success                 | clean observed tree + local receipt |
| Invalid package                        | typed validation failure           | exact workspace/cache/tree cleanup  |
| Timeout/cancel/output overflow         | failure                            | child/tree termination attempted    |
| Residual descendant                    | `CLEANUP_UNCERTAIN`                | quarantine; G1 blocked              |
| Server shutdown                        | admission closed/failure           | no accepted late output             |
| Artifact scan                          | pass only if absent                | no binary/downloader/launcher       |

## Regression Commands

```powershell
npm run test:pptx:officecli:unit
npx vitest run server/services/pptx-import/officecli/qualification.test.js server/services/pptx-import/officecli/qualification-cache.test.js server/services/pptx-import/officecli/gateway.test.js server/services/pptx-import/officecli/gateway-command-contract.test.js server/services/pptx-import/officecli/windows-process-tree.test.js server/services/pptx-import/officecli/physical-qualification.test.js server/services/validated-edited-export.test.js
npx vitest run server/services/pptx-import/officecli/isolation-policy.test.js
npx vitest run server/services/pptx-import/transactional-export-validators.test.js server/services/pptx-import/mutation-transaction.test.js scripts/pptx-package-claim-gate.test.js
npm run test:pptx:package:no-officecli
npm run lint
npm run build
$env:OFFICECLI_PATH='C:\absolute\isolated\path\officecli.exe'
$env:OFFICECLI_PHASE1_FEASIBILITY_RECEIPT='C:\absolute\isolated\evidence\phase01-officecli-feasibility.json'
npm run test:pptx:officecli:qualify
```

Mechanical G1 gate runs on Windows with the real configured binary. It must:

1. recompute exact path/version/length/hash;
2. verify the exact affirmative Phase 1 feasibility receipt and current clean
   account/VM, no-secrets, and empty-allowlist egress state;
3. execute valid and invalid fixtures through production composition;
4. exercise real timeout/cancel/flood and child/grandchild process cleanup;
5. exercise real secret-sentinel/out-of-scope-file and DNS/TCP/HTTP denial tests;
6. prove zero cache waiters/entries, workspace files/handles, and attributable
   processes after every terminal outcome;
7. emit one receipt bound to current feasibility/G0/policy/isolation/egress/limits;
8. report the full residual-limitations set;
9. exit nonzero for missing isolation, missing binary, mismatch, residual process/
   file/handle/cache, egress success, secret-boundary failure, stale feasibility,
   cache drift, skipped fixture, mock runner, or stale subject.

Unit tests, mocks, or historical launcher/provider evidence cannot close G1.

## Todos

- [ ] Record direct-local policy supersession.
- [ ] Verify Phase 1 exact-isolation feasibility or block G1.
- [ ] Enforce clean dedicated Windows account/VM with no project secrets.
- [ ] Enforce and physically test empty-allowlist bounded egress.
- [ ] Write exact pin/path/drift RED tests.
- [ ] Implement hash-bound qualification cache.
- [ ] Bound probe/validation admission.
- [ ] Implement direct Windows tree termination/inventory.
- [ ] Implement exact cache/workspace/file/handle cleanup.
- [ ] Remove unenforced memory/process claims.
- [ ] Bind receipts to G0/lifecycle/head/policy.
- [ ] Remove dead launcher execution chain.
- [ ] Run real valid/invalid/timeout/tree physical qualification.
- [ ] Run physical process-cleanup and isolation/security suites with no skips.
- [ ] Run package absence scan and milestone regressions.

## Success Criteria

- [ ] Direct-local OfficeCLI is the sole active G1 policy.
- [ ] A current affirmative Phase 1 feasibility receipt proves the exact isolation profile.
- [ ] If clean real isolation is unavailable, G1 is blocked rather than weakened.
- [ ] Historical launcher/cloud/KMS requirements are explicitly superseded, not silently ignored or relabeled.
- [ ] Only exact `1.0.135`, `33,111,928` byte, pinned-hash binary qualifies.
- [ ] No PATH/registry/UNC/reparse/ADS/hardlink or request-supplied authority exists.
- [ ] Cache is bounded, single-flight, hash/policy/matrix-bound, and never replaces execution revalidation.
- [ ] Cache is also isolation/egress-bound and clears exactly on shutdown, drift, and failure.
- [ ] Concurrency, queue, input, temp, stdout, stderr, wall time, and cleanup grace are enforced.
- [ ] Windows timeout/cancel/shutdown/flood tests leave no observed attributable process.
- [ ] Every terminal run leaves no verified workspace/file/handle/cache residue.
- [ ] Physical security tests prove no project-secret access and no DNS/TCP/HTTP egress.
- [ ] Cleanup uncertainty fails closed and quarantines the workspace.
- [ ] Receipt truthfully lists unproven isolation/containment/resource guarantees.
- [ ] Real physical valid/invalid qualification passes through production code.
- [ ] Final package/source scans contain no OfficeCLI binary/downloader/updater/launcher.
- [ ] All regression commands pass and G1 report is current.

## Risks with Signals / Responses

| Risk                                       | Observable signal                                  | Pre-decided response                                                                    |
| ------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Direct policy conflicts with old journal   | reviewers/tests still require launcher receipt     | Append explicit supersession and remove active launcher acceptance before qualification |
| Cache masks replacement                    | validation succeeds after binary swap              | Execution always rehashes; invalidate cache and fail                                    |
| Capability probe stampede                  | process count grows with reads                     | Single-flight cache + shared capacity/queue                                             |
| `taskkill /T` misses escaped descendant    | process inventory finds residual                   | `CLEANUP_UNCERTAIN`; block G1, no containment claim                                     |
| Taskkill terminates unrelated PID reuse    | start-time/parent evidence mismatches              | Verify direct PID/start identity; avoid broad name-based kills                          |
| Hard memory cap unavailable                | receipt says memory bounded                        | Remove claim; observe/report only, keep concurrency/time/temp/output bounded            |
| Unsigned binary provenance overstated      | docs imply vendor signature                        | State administrator-provided hash pin and local integrity only                          |
| Physical suite silently skips              | CI output says skipped but exit 0                  | Qualification command treats skip/missing env as failure                                |
| Isolation unavailable                      | only developer account or unrestricted host exists | Block G1; do not fall back or relabel the run                                           |
| Secret boundary is assumed from env filter | isolated process reads profile/data sentinel       | Dedicated clean account/VM, minimal copied inputs, physical denial tests                |
| Egress rule drifts                         | physical DNS/TCP/HTTP probe succeeds               | Invalidate cache, terminate, block G1, repair administrator-controlled policy           |
| Cleanup passes with cache/file residue     | post-run inventory nonempty                        | `CLEANUP_UNCERTAIN`; quarantine exact owned workspace and block G1                      |
| Dead launcher files remain packaged        | absence scan finds launcher strings/binary         | Remove dead source/config and rebuild before G1                                         |

## Security

- OfficeCLI receives only guarded private package copies, never package-store or
  upload paths.
- No route/client controls executable, operation, argv, environment, cwd, or
  output path.
- Environment is allowlisted and update/resident behavior disabled.
- OfficeCLI runs only under the admitted clean dedicated account/VM. No repository,
  application data root, developer profile, or project secret is mounted/copied
  into that boundary.
- Outbound network is deny-by-default with an empty G1 allowlist and physical
  DNS/TCP/HTTP denial evidence.
- Paths, document content, stdout/stderr, and credentials are redacted from public
  errors/logs.
- Direct local execution is not a general sandbox. The release must explicitly
  disclose: no assignment-before-execution, no Job Object/escape-proof descendant
  containment, no hard memory/process cap, no independent teardown attestation,
  no independent signer, and no separation of duties. It may claim only the exact
  clean identity/VM, minimal-input/no-project-secret tests, empty-allowlist egress
  denial, and observed cleanup proven by current physical receipts.
- Missing or failed OfficeCLI never blocks immutable Original recovery.

## Next Steps

Phase 9 may consume G1 only by exact current receipt subject. It must revalidate
G0/G1 after admission and before transactional publication; stale cache or
historical launcher/provider receipts provide no authority.
