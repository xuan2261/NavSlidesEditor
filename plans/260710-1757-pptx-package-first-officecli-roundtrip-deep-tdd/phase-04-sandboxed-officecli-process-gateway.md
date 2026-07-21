---
phase: 4
title: 'Direct local OfficeCLI process gateway'
status: in-progress
effort: '2-3 weeks'
dependsOn: [2]
priority: P0
gates: [G1]
---

# Phase 4: Direct local OfficeCLI process gateway

<!-- Updated: Validation Session 1 - gateway accepts only the configured administrator-provided Windows binary matching the pinned manifest. -->

## Overview

Implement the only production boundary through which OfficeCLI may run and the
shared containment contract for native import/re-import parser workers. The
gateway exposes typed PPTX domain operations, never arbitrary commands, and
enforces executable provenance, private paths, one-shot execution, resource
limits, cancellation, process-tree cleanup, and post-mutation validation.

Direct Node `spawn` is the selected production execution boundary for this
scope. It invokes only the manifest-pinned staged binary through a fixed typed
command builder with `shell: false`, a filtered environment, bounded I/O, timeout,
and direct-child cancellation. This does not provide Job Object containment,
process-tree cleanup, restricted identity, ACL/profile isolation, or egress
control; `G1` remains open and direct execution cannot support level-3 claims.
Other targets reject OfficeCLI work before workspace creation or process launch.

## Work-in-Progress Evidence

Focused gateway tests cover the direct typed Node boundary: non-Windows and
candidate/pin failures reject before document work, only `validate` is permitted,
and direct-child output, timeout, cancellation, cleanup, and redaction paths fail
closed. They use fakes or mocked process inputs. This workspace has no successful
real direct OfficeCLI validation and no direct qualified receipt, so `G1` remains
Open. Prior launcher-oriented reports and non-Windows provider evidence remain
historical and are not evidence for the active local topology.

## Context Links

- [Approved claim-driven roadmap](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
- [Phase 2 binary qualification](./phase-02-officecli-qualification-and-reproducible-distribution.md)

## G1/G2 Gateway API

Immediately active operations:

- `probeCapability()`
- `validatePackage(inputRevision)`
- `runNativeImport(inputRevision, importRequest)`
- `runNativeReimport(inputRevision, reimportRequest)`

Deferred operations remain absent from the active command policy until a consuming
phase supplies fixtures and evidence:

- `inspectPresentation(inputRevision, selector)`
- `inventoryObjects(inputRevision, slideRef)`
- `readRawPart(inputRevision, allowlistedPart)`
- `renderInformativePreview(inputRevision, renderRequest)`
- `applyTextPatch(stagedRevision, patch)`
- `applyShapePatch(stagedRevision, patch)`
- `applyChartPatch(stagedRevision, patch)`
- `applyRelationshipPatch(stagedRevision, patch)`
- `applyAllowlistedBatch(stagedRevision, operations)`

No route or client may submit executable names, verbs, selectors, raw command lines, environment variables, or paths. Generic `raw-set`, resident `open/watch`, self-update, and arbitrary `add-part` remain prohibited unless a later reviewed adapter provides a narrower contract.

The single-user trusted-proxy model still requires deployment boundary protection.
Package/job creation routes enforce configured same-origin Host/Origin policy as a
CSRF/deployment check, not caller authentication. Creation returns a random
256-bit per-job bearer capability whose digest is stored server-side; status,
stream, download, and cancellation require the matching capability, compare it in
constant time, and never expose it through URLs, public DTOs, analytics, or logs.
Direct internet exposure without the trusted proxy/origin policy remains
unsupported; this is not a multi-user authentication design.

## Execution Policy

- Resolve only the configured administrator-provided Windows absolute path after
  matching it to the verified Phase 2 manifest. Copy it into an
  ACL-protected content-addressed execution directory, reverify bytes and signer
  metadata where available, and execute that immutable copy. Never use PATH,
  a mutable administrator path, hardlink, or bundled fallback.
- Node launches only the digest-pinned first-party containment launcher using a
  bounded stdin/stdout protocol. The launcher owns OfficeCLI process creation;
  no generic executable, environment, command, or raw argv authority crosses a
  route boundary.
- Accept only immutable revisions carrying a verified Phase 3 raw ZIP-directory/XML-safety verdict, then recheck the exact revision hash immediately before every OfficeCLI read or mutation. OfficeCLI never receives unguarded package bytes.
- Create one private temp directory per job with random opaque IDs and restrictive ACLs.
- Copy only the staged input revision into that directory, reject hardlinks and
  reparse points, verify the copied hash, and open it without following links.
  Output must remain inside the private directory.
- On Windows, use `PROC_THREAD_ATTRIBUTE_JOB_LIST` where qualified, with
  `CREATE_SUSPENDED` plus immediate native assignment as the only permitted
  fallback. Apply kill-on-close, active-process, memory, CPU, timeout, and output
  limits before execution.
- Prefer an AppContainer identity with no network capabilities. If real OfficeCLI
  compatibility fails, allow a dedicated worker identity plus explicit DACL and
  WFP/firewall enforcement only after equivalent physical evidence. A restricted
  token by itself is insufficient.
- Limit argv length, stdin, stdout, stderr, wall time, idle time, process count, memory where supported, temp disk, and package size.
- Reserve capacity through one application-host weighted admission controller
  shared by imports, OfficeCLI, native parsers, vector conversion, rasterization,
  export staging, and sync. Default OfficeCLI concurrency is one until evidence
  raises it. Remote provider VMs use Phase 13 orchestration quotas instead.
- Use `batch --stop-on-error` only for reviewed operations.
- Kill the full process tree on timeout, cancellation, server shutdown, or output overflow.
- Scrub logs and return typed reason codes without paths, raw XML, or slide content.
- Run ZIP/OPC and OfficeCLI validation after every mutation before returning success.
- Run initial import and native re-import in a separately manifested parser worker
  under the same stripped-environment, restricted-identity, private-workspace,
  no-profile/app-data, no-egress, resource, admission, cancellation, and
  full-tree-zero contract. OfficeCLI and native workers have distinct executable
  allowlists and typed protocols.
- Disable OfficeCLI mutation on any platform where full descendant termination, restricted identity, app-data isolation, and resource controls cannot be proven. Authoritative PowerPoint evidence uses the separate Phase 13 provider protocol, never this gateway.

## TDD Matrix

| Test first                                | Expected red                                          | Green behavior                                                                                     |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Argument injection                        | User selector reaches shell                           | Literal argv, shell disabled, typed selector validation                                            |
| Path traversal/symlink                    | Job escapes temp root                                 | Canonical path containment rejects it                                                              |
| Wrong binary hash                         | Binary executes                                       | Gateway refuses before spawn                                                                       |
| Unguarded package revision                | OfficeCLI parses before ZIP/XML policy                | Gateway refuses before workspace creation or spawn                                                 |
| Timeout/cancel                            | Child/grandchild leaks                                | Entire process tree terminates                                                                     |
| Windows helper process                    | Direct child dies only                                | Job Object kill-on-close terminates descendants                                                    |
| stdout/stderr flood                       | Host memory grows                                     | Limit kills job with typed error                                                                   |
| malformed JSON/noise                      | Parser crashes/trusts text                            | Strict output decoder rejects safely                                                               |
| partial batch failure                     | Earlier mutations persist                             | Staging revision discarded                                                                         |
| concurrent jobs                           | CPU/memory spikes                                     | Queue, semaphore, and backpressure                                                                 |
| server restart                            | Temp dirs leak forever                                | Startup sweeper quarantines safe stale jobs                                                        |
| untrusted active content                  | Package triggers execution/network                    | Non-execution and egress policy enforced                                                           |
| Cross-workload pressure                   | Import/raster/parser bypass gateway semaphore         | Application-host weighted admission rejects or queues safely                                       |
| Cross-site browser or guessed job request | Browser creates work cross-site or guesses access     | Origin policy rejects cross-site creation; bearer capability rejects status/stream/download/cancel |
| unavailable platform                      | Endpoint 500s                                         | Capability-disabled response and original recovery                                                 |
| secret/path leakage                       | API exposes stderr                                    | Redacted diagnostics only                                                                          |
| Mutable binary replacement                | Verified admin path changes before process creation   | Protected content-addressed copy is reverified and bound to receipt                                |
| Native parser escape                      | Re-import parser reads profile/network or leaks child | Same containment/admission/tree-zero contract blocks it                                            |

## Implementation Steps

1. Define typed request/result/error schemas and command allowlist.
2. Write a fake executable harness for hangs, floods, malformed output, child processes, partial writes, and path attacks.
3. Implement binary manifest verification and OfficeCLI capability caching.
4. Implement private job workspace creation and canonical path guards.
5. Write the launcher contract and fake launcher first. Implement a small
   C++/Win32 launcher with CMake, CI-pinned MSVC, and static runtime linkage that
   owns Job Object creation, process-at-job or suspended assignment, handle
   inheritance, bounded I/O, watchdog, completion port, and full-tree drain.
6. Add per-operation argument builders with no generic passthrough.
7. Enforce the Phase 3 raw ZIP/XML verdict and exact revision hash before
   workspace creation, and prove validation does not mutate input bytes.
8. Implement only contained version and `validatePackage()` for G1/G2. Defer
   inspection and mutation adapters until their consuming phases.
9. Run physical feasibility gates for AppContainer compatibility, nested jobs in
   Electron/CI, assignment race, ACL/reparse/TOCTOU defense, and egress denial.
   Select the simplest isolation mode that passes all required evidence; otherwise
   keep OfficeCLI unavailable.
10. Integrate with the application-host weighted admission controller before
    reading or copying package bytes.
11. Add observability for queue time, execution time, peak output, temp bytes, cancellations, capacity reservations, and reason codes.
12. Integrate with generalized durable `PackageJobRecord` import/export/provider jobs, cancellation, and server lifecycle: stop admission, cancel, await tree termination, quarantine workspaces, then close HTTP.
13. Add trusted-proxy Host/Origin enforcement for package/job creation plus hashed 256-bit job capabilities for polling/cancellation; use constant-time verification and redact capabilities from every DTO/log.
14. Fuzz typed selectors and gateway output parsers.
15. Add a manifested native parser worker and route both initial import and
    validation re-import through the shared containment/admission lifecycle.
16. Stage and reverify executable/input copies, reject hardlinks/reparse points,
    and bind execution-copy hashes to terminal receipts.

## File Plan

- Add focused modules under `server/services/pptx-import/officecli/`, each under project size limits.
- Add a focused C++/Win32 CMake project under
  `native/windows-officecli-launcher/`; pin the MSVC/CMake inputs and split
  protocol, Job Object, process launch, identity, ACL, I/O, and watchdog modules
  below 200 project-owned LOC where practical.
- Reuse import job/semaphore patterns from `server/routes/pptx-import.js` where safe.
- Add fake CLI fixtures under test-only directories.
- Add route tests proving no command/path authority crosses the API boundary,
  cross-site browser creation is rejected, and guessed capabilities cannot access
  status, stream, download, or cancellation.

## Verification

```powershell
npx vitest run server/services/pptx-import/officecli/
npx vitest run server/routes/pptx-import.test.js
npm run lint
npm run test
```

Run process-tree, resource-flood, cancellation, restart-sweep, and path-containment tests on Windows. On Linux/Docker/macOS, assert mutation is capability-disabled before workspace creation/spawn and original recovery remains available.
The authoritative launcher build runs on the pinned Windows/MSVC CI image; lack of
a local native toolchain is an infrastructure limitation, never a mock pass.

## Deep File Inventory

| Action | File/interface                           | Planned change                                                     | Test impact                          |
| ------ | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| Create | `native/windows-officecli-launcher/`     | C++/Win32 CMake launcher and test fixtures                         | Physical Windows suite               |
| Create | `officecli/launcher-contract.js`         | Versioned bounded request/receipt schemas                          | Unit/property tests                  |
| Create | `officecli/launcher-client.js`           | Invoke only the trusted launcher and verify receipt                | Fake-launcher tests                  |
| Create | shared containment policy/worker modules | OfficeCLI and native-parser executable manifests, limits, receipts | Qualification/security tests         |
| Modify | `officecli/bounded-runner.js`            | Run launcher only or retire direct target spawn                    | Execution tests                      |
| Modify | `officecli/qualification.js`             | Route version probe through launcher                               | No-bypass tests                      |
| Modify | `officecli/gateway.js`                   | Require fresh qualified containment tuple                          | Gateway tests                        |
| Modify | `officecli/workspace.js`                 | Windows DACL and reparse-safe workspace contract                   | Physical ACL tests                   |
| Modify | native import/re-import entry points     | Execute manifested parser worker through containment               | Import/export security tests         |
| Modify | shutdown/job hooks                       | Await tree-zero and quarantine uncertain workspaces                | Restart/cancel tests                 |
| Delete | None                                     | Keep compatibility seams until all callers migrate                 | Architecture guard blocks direct use |

## Function and Interface Checklist

- [ ] Parse one length-bounded launcher request and one terminal receipt.
- [ ] Bind receipt to job ID, launcher hash/version, binary hash/version, and policy digest.
- [ ] Create target at job association or suspended before assignment.
- [ ] Await `ACTIVE_PROCESS_ZERO` before success or cleanup.
- [ ] Deny app-data, profile-secret, and cross-job reads.
- [ ] Prove DNS, loopback, LAN, and public egress denial.
- [ ] Route OfficeCLI version/validate and native import/re-import through their
      typed manifested targets on one containment lifecycle.
- [ ] Bind executable execution-copy and input-copy hashes to the receipt.

## Tests Before

1. Immediate child/grandchild escapes ordinary Node spawn.
2. Timeout/cancel/output flood kills only the current direct child.
3. Version probe and native re-import bypass containment.
4. Worker can read known server/Electron/profile secret fixtures.
5. Network probes succeed without a qualified egress policy.

## Refactor

Introduce the launcher seam behind OfficeCLI version/validate and native parser
worker methods. Delete no compatibility path until architecture tests prove that
production cannot invoke these targets outside containment.

## Tests After

| Scenario                             |           Contract/unit |                    Physical Windows |
| ------------------------------------ | ----------------------: | ----------------------------------: |
| Request/receipt bounds and redaction |                Required |              Receipt identity check |
| Assignment-before-execution          |           State machine |        Immediate descendant fixture |
| Full-tree timeout/cancel/shutdown    |           Fake launcher |         Child/grandchild disappears |
| Active-process/memory/CPU limits     |          Policy mapping |             Real limit notification |
| App-data/cross-job/profile denial    |            ACL contract |                Access-probe fixture |
| Egress denial                        |         Policy contract |      DNS/loopback/LAN/public probes |
| Nested Electron/CI parent jobs       |      Capability mapping |             Packaged/runtime matrix |
| Reparse and binary replacement       |              Path tests |             Junction/TOCTOU fixture |
| Native parser identity/isolation     | Protocol/manifest tests | Import and re-import escape fixture |

## Dependency Map

```text
Phase 2 exact external binary
  -> native launcher + qualified OfficeCLI containment tuple
Phase 3 guarded revision/workspace/admission
  -> contained native import/re-import worker
  -> typed OfficeCLI gateway
  -> Phase 11 OfficeCLI validator
  -> Phase 13 packaged Windows proof
```

## Debug and Reports

- `reports/phase-04/gateway-contract.json`
- `reports/phase-04/process-fault-matrix.json`
- `reports/phase-04/platform-containment.md`
- `reports/phase-04/resource-envelope.json`
- `reports/phase-04/log-redaction-audit.md`

## Risks and Controls

- **Untrusted parser exploitation:** least privilege, no egress where feasible, private temp scope, strict limits, patched pinned binary.
- **Process leakage:** full-tree kill, shutdown hooks, stale-job sweeper.
- **Arbitrary OOXML mutation:** domain adapters only; no remote raw command surface.
- **Denial of service:** one concurrent job initially, bounded queue, quotas, timeouts, and admission control.

## Success Criteria

- [x] No API/client can choose executable, command verb, raw argv, environment, or filesystem path.
- [x] Configured same-origin checks reduce cross-site browser creation but are not
      authentication; status/stream/download/cancel require scoped bearer
      capabilities without claiming multi-user identity.
- [x] No OfficeCLI process or workspace starts unless the exact immutable revision passed Phase 3 raw ZIP-directory and XML safety gates.
- [ ] Timeout, cancellation, flood, partial batch, and server-restart tests leave no published revision.
- [ ] Windows child and grandchild processes terminate through Job Object kill-on-close.
- [ ] OfficeCLI is assigned before executing, and completion evidence proves the
      full process tree reached zero.
- [ ] Restricted identity, app-data/profile/cross-job isolation, and egress denial
      pass physical Windows tests.
- [x] OfficeCLI mutation remains disabled where restricted identity, app-data isolation, egress/resource controls, or full-tree termination are unproven.
- [ ] Import, OfficeCLI, native parser, raster, conversion, sync, and export
      workloads share one application-host admission budget; provider VMs use
      separate orchestrator quotas.
- [x] Wrong or unavailable OfficeCLI degrades safely without blocking original download.
- [x] Linux/Docker/macOS mutation remains capability-disabled in the first release; only a manifest-matching configured Windows binary can reach spawn.
- [ ] G2 input copies, OfficeCLI validation, and native import/re-import run in
      private contained staging; later mutations inherit the same boundary.
- [ ] Verified mutable source paths cannot be replaced between qualification and
      execution because receipts bind protected execution-copy hashes.
- [ ] Supported platform containment and known gaps are evidenced.
- [ ] Gateway tests, security fuzzing, route tests, lint, and unit suite pass.

## Session 4 Local Scope Rebase: Active Phase Contract

The filename is retained for link stability. This section supersedes
contradictory active native-launcher, protected execution-copy, Job Object,
restricted-identity, firewall, provider, and non-Windows requirements above.
Earlier launcher-oriented implementation reports remain historical inputs to
migration, not qualification evidence for the approved direct topology.

### Active Direct Gateway

- Production starts the administrator-configured canonical OfficeCLI file itself
  as the direct application child with `shell:false`; no first-party launcher,
  intermediary executable, resident service, cloud hop, or protected execution
  copy is required or invoked.
- Accept only fixed typed version and package-validation operations. No client can
  choose an executable, verb, raw argument, environment value, XML payload, or
  filesystem path.
- Before each operation, verify the exact `1.0.135`, `33,111,928` byte,
  `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`
  binary tuple and final launch-bound file identity.
- Pass only a private byte-copied, hash-verified immutable package revision after
  current recursive ZIP/XML/OPC and active-content guards pass. Never pass store
  paths, upload paths, links, or stale guard subjects.
- Set `OFFICECLI_NO_AUTO_RESIDENT=1` and `OFFICECLI_SKIP_UPDATE=1`, filter the
  environment, bound output, duration, memory/process observations, temp storage,
  and weighted concurrency, and use immutable whole-job deadlines.
- Timeout, cancellation, shutdown, overflow, and decoder failure irrevocably stop
  result acceptance, terminate the direct child, wait bounded cleanup grace, and
  inventory attributable processes. Uncertain cleanup quarantines the workspace
  and publishes no success.
- Record typed redacted diagnostics and explicitly state that profile isolation,
  egress isolation, restricted identity, independent descendant containment, and
  teardown attestation are not proven.

### Active Dependencies, TDD, and Completion

Phase 2 supplies the pinned binary and typed qualification contracts. Phase 3
supplies guarded immutable copies. Phase 11 consumes the local validator before
atomic publication. Phase 13 exercises the gateway from final Windows Electron
artifacts. Native import/re-import uses its own bounded local worker contract and
does not inherit an unproven containment claim from OfficeCLI.

Start with failing direct-topology, shell-free argv, final-file-identity,
guard-before-workspace, output race, timeout, cancellation, cleanup, redaction,
and residual-risk tests. Run physical OfficeCLI flows serially through the
production gateway, then run focused route/security suites and the repository
milestone gate.

`G1` closes when exact-pin direct qualification and one production validation run
pass with bounded typed execution, current receipts, private inputs, deterministic
failure behavior, and observed cleanup. No independent containment evidence is
required or claimed.
