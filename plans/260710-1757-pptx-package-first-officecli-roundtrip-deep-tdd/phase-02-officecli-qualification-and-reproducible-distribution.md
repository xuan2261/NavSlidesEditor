---
phase: 2
title: 'OfficeCLI qualification and reproducible distribution'
status: in-progress
effort: '2-3 weeks'
dependsOn: []
priority: P0
gates: [G1-input]
---

# Phase 2: OfficeCLI qualification and reproducible distribution

<!-- Updated: Validation Session 1 - Windows administrator-provided pinned binary selected; first-release bundling and Linux/Docker mutation deferred. -->

## Overview

Establish one exact OfficeCLI candidate as an external tool, provide immutable
provenance and version/validation test vectors, and make Windows
administrator-provided discovery reproducible while other targets fail closed.
Phase 2 does not execute the candidate or close G1 independently. Phase 4 composes
these inputs with containment and owns physical qualification.

Start independently with provenance, discovery, protected execution-copy staging,
and fixture/receipt contracts. Phase 2 owns candidate binary identity and
non-execution predicates. Phase 4 exclusively implements the launcher, executes
version/validation fixtures, and emits the qualified tuple. Phase 13 owns
authoritative final-artifact smoke.

## Work-in-Progress Evidence

Focused candidate tests cover configured absolute-path discovery, exact
size/hash identity, no PATH fallback, and a reverified content-addressed execution
copy that remains valid if the administrator source is later replaced. Candidate
verification does not execute OfficeCLI or enable validation. It is not a
qualification receipt and does not close `G1`.

## Context Links

- [Approved claim-driven roadmap](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
- [Phase 4 containment implementation](./phase-04-sandboxed-officecli-process-gateway.md)

## Baseline and Decisions

- Candidate: OfficeCLI `1.0.135`.
- Local qualification hash observed during research: `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`. Recompute from the selected official asset before pinning.
- Upstream: `https://github.com/iOfficeAI/OfficeCLI`, Apache-2.0.
- Physical invocation belongs to Phase 4: one-shot direct Node execution of the
  staged manifest-pinned binary, never resident/watch SDK. This is not containment
  evidence and does not close G1.
- Runtime environment: `OFFICECLI_NO_AUTO_RESIDENT=1`, `OFFICECLI_SKIP_UPDATE=1`.
- G1/G2 qualify only version probing and `validatePackage()`. Phase 6 separately
  qualifies read-only inspection when needed. Mutation and rendering stay
  prohibited until a named row/provider contract selects them.
- First-release acquisition: administrator-provided Windows binary at a configured absolute path, accepted only when version and SHA-256 match the approved manifest.
- Docker/Linux and macOS mutation are capability-disabled. Electron does not bundle OfficeCLI in the first release.

## Qualification Contract

- Exact upstream repository, release tag, release asset URL/name, byte length, SHA-256, license, notices, SBOM/provenance status, and supported platform.
- Immediate capability matrix for version and `validate`; deferred rows for
  inspect/read, mutation, raw operations, and rendering.
- Command classification records version/validate as immediate, with all
  inspection, mutation, raw, and rendering classes prohibited until separately
  selected and qualified.
- Expected version/validation fixture and receipt contract; Phase 4 captures and
  verifies real output/exit behavior under containment.
- Upgrade policy with compatibility suite and immediate rollback to the last qualified asset.
- First-release target map: configured administrator-provided on Windows; feature-disabled on Docker/Linux/macOS; never bundled.

## TDD Matrix

| Test first                      | Expected red                          | Green behavior                                                          |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Binary absent                   | Integration fails opaquely            | Capability probe reports unavailable without breaking original download |
| Wrong version/hash              | Any binary executes                   | Startup and packaging reject mismatch                                   |
| Auto-update/resident disabled   | Tool may persist/update               | Environment and process tests prove one-shot behavior                   |
| No-op drift                     | Read or save changes package          | Drift is zero or explicitly classified and blocks unsafe command        |
| Malformed output                | Parser trusts stdout                  | Schema parser rejects truncation/noise safely                           |
| Timeout/hang                    | Child leaks                           | Gateway cancels full process tree                                       |
| Output flood                    | Memory grows unbounded                | stdout/stderr limits terminate job                                      |
| Unsupported object              | Tool silently degrades                | Capability result is explicit and source remains preserved              |
| Platform variance               | Windows result assumed on Linux       | Per-platform matrix and feature availability                            |
| Upgrade rollback                | New binary replaces old blindly       | Failed qualification retains prior pinned binary                        |
| Windows descendant process      | Direct child dies but helper survives | Job Object kill-on-close terminates the complete tree                   |
| Platform packaging before proof | Unusable binary is bundled            | Packaging starts only after target capability and containment pass      |

## Implementation Steps

1. Download selected release assets out of band through the approved dependency process and record immutable provenance.
2. Recompute SHA-256 and compare with independent release metadata when available.
3. Inventory license and bundled third-party notices. For an unsigned asset,
   require two independently authenticated acquisition records bound to the
   upstream release commit/asset metadata plus explicit policy approval; otherwise
   qualification remains unavailable.
4. Define the disposable Windows physical test vectors for version, validate,
   malformed package, no-op drift, timeout, and output limits. Phase 4 runs them.
5. Define the qualification receipt emitted by Phase 4: launcher
   hash/version, containment policy digest, external binary identity, isolation
   mode, physical fixture-suite version, and verdict. Do not implement a second
   launcher in this phase.
6. Build a minimal G2 validation fixture set: valid primitives, opaque/unknown
   parts, active/signed/protected blocks, nested workbook, and malformed packages.
7. Define strict machine-readable version/validate decoders and expected
   output/exit behavior. Phase 4 captures physical receipts.
8. Define no-op ZIP/OPC hash assertions for Phase 4 validation. Defer other
   command classes until a consuming phase names them.
9. Define compatibility assertions that must pass before changing the pinned binary.
10. Add a binary manifest and checksum verifier used by Windows startup and CI;
    keep source/config absence scans as development checks.
11. Implement administrator-provided Windows binary discovery and exact manifest
    verification. Copy verified bytes into an ACL-protected content-addressed tool
    directory and reverify the copy without executing it. Hand its identity to
    Phase 4 for contained probing.
12. Add capability detection so unsupported/uninstalled targets degrade to original-preservation and native-import mode.
13. Record startup latency, per-command latency, memory, temporary disk, and maximum safe concurrency.
14. Publish the approved and prohibited command matrix.
15. Hand final Docker/Electron extraction, startup, executable inventory, and
    capability probes to Phase 13 `G3`.

## File Plan

- Add a checked-in binary manifest without binary payloads or secrets under a suitable config/service path.
- Modify `Dockerfile`, `electron-builder.yml`, and `scripts/prepare-electron.js` only to assert OfficeCLI is absent and mutation is capability-disabled on unqualified/bundling-disabled targets.
- Add OfficeCLI capability/provenance modules under `server/services/pptx-import/officecli/`.
- Add qualification tests and fixtures under existing PPTX test conventions.
- Add required license notices to packaged legal resources, not to README.

## Verification

```powershell
npx vitest run server/services/pptx-import/officecli/qualification.test.js
npm run lint
npm run test
npm run build
```

Phase 2 tests manifest/provenance, discovery, protected execution-copy staging,
strict decoders, and fixture contracts without invoking OfficeCLI. Phase 4 owns
the physical exact-version/validation/containment test. Final Docker/Electron
evidence belongs to Phase 13. Never resolve an arbitrary PATH binary.

## Deep File Inventory

| Action | File/interface                              | Planned change                                                      | Test impact                      |
| ------ | ------------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| Modify | `officecli/qualification.js`                | Split non-executing candidate identity from Phase 4 qualified tuple | Candidate/contract tests         |
| Modify | `officecli/qualification-manifest.json`     | Exact external asset and legal metadata                             | Manifest tests                   |
| Modify | `officecli/command-policy.js`               | Publish version/validate now; defer all unused classes              | Contract tests                   |
| Modify | `officecli/packaging.test.js`               | Keep source/config guard explicitly non-authoritative               | Static guard tests               |
| Modify | `package.json`, `electron-builder.yml`      | Resolve Electron version drift before G3                            | Package contract tests           |
| Create | Real OfficeCLI qualification fixture matrix | Version, validate, no-op drift, malformed behavior                  | Physical Windows integration     |
| Delete | None                                        | Direct probe code is refactored, not replaced by another path       | Architecture test forbids bypass |

## Function and Interface Checklist

- [ ] Preserve `discoverConfiguredPath()` and exact canonical-path checks.
- [ ] Make `probeVersion()` unavailable from the Phase 2 candidate service; Phase
      4 alone exposes contained probing.
- [ ] Define, but do not self-issue, the launcher/policy/isolation qualification
      receipt schema.
- [ ] Invalidate cached qualification when any tuple field changes.
- [ ] Stage and reverify one protected execution copy; never execute the mutable
      administrator path directly.
- [ ] Keep unsupported targets unavailable before workspace or process creation.

## Tests Before

1. Direct version spawn is detected as an architecture failure.
2. Candidate identity alone cannot produce an available qualified tuple.
3. Read/no-op command drift blocks that command class.
4. Upgrade failure retains the prior qualified tuple.
5. Electron version mismatch blocks authoritative packaging.

## Refactor

Share one binary identity implementation and one contained invocation path between
qualification and the gateway. Keep final artifact logic out of this phase.

## Tests After

- Exact candidate manifest, discovery path, protected-copy hash, and release
  records without execution.
- Fixture/decoder contracts consumed by Phase 4 physical validation.
- Rollback to the prior tuple after failed upgrade qualification.
- Stable typed reason codes without path or document leakage.

## Dependency Map

```text
external OfficeCLI manifest -> Phase 2 candidate identity/test vectors
Phase 2 candidate + Phase 4 launcher/physical suite -> qualified tuple
qualified tuple + G0 receipt integration -> Phase 11 OfficeCLI validator
manifest/policy inputs -> Phase 13 artifact smoke
```

## Debug and Reports

- `reports/phase-02/officecli-provenance.json`
- `reports/phase-02/officecli-capability-matrix.json`
- `reports/phase-02/noop-package-drift.json`
- `reports/phase-02/platform-packaging-matrix.md`
- `reports/phase-02/license-and-supply-chain-review.md`

## Risks and Controls

- **Unsigned binary:** explicit risk acceptance alone is insufficient. Require
  independent authenticated release/asset records, checksum pinning, protected
  staging, and restricted execution; otherwise G1 remains open.
- **Two similarly named package streams:** pin repository, release asset, and hash, never resolve by package name alone.
- **Runtime download compromise:** prohibit self-update and runtime acquisition.
- **Linux feature mismatch:** advertise per-target capabilities and fail closed.
- **Premature enablement:** candidate identity alone exposes no operation;
  version/validate require Phase 4, and later command classes require their own
  consuming-row qualification.
- **License omission:** make notice verification part of packaging tests.

## Success Criteria

- [ ] Exact release assets, hashes, licenses, and supported targets are recorded and verified.
- [ ] Version/validation fixture, decoder, drift, timeout, and output-limit
      contracts are ready for Phase 4; all unused classes remain prohibited.
- [x] No generic OfficeCLI command or arbitrary PATH resolution is part of the application contract.
- [ ] Source/config guards prove no declared OfficeCLI bundling or downloader;
      Phase 13 owns final Docker/Electron artifact evidence.
- [ ] Windows executes only an ACL-protected, content-addressed copy of the
      configured administrator-provided binary after exact path, version, hash, and
      release-record verification.
- [x] Candidate identity cannot enable validation or mutation before Phase 4 full
      descendant, identity, app-data, egress, and resource evidence passes.
- [x] No target distribution work proceeds before its capability, drift, and containment rows pass.
- [x] OfficeCLI unavailable/wrong-hash behavior is recoverable and preserves original download.
- [ ] Candidate/provenance/contract, lint, unit, and build validators pass;
      physical qualification belongs to Phase 4 and packaging smoke to Phase 13.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active launcher, protected-copy,
containment, non-Windows target, and Docker packaging requirements above. Existing
implementation reports remain historical evidence only.

### Active Goal and Qualification Contract

- Qualify only administrator-provided OfficeCLI `1.0.135` at the configured
  canonical absolute Windows path, with byte length `33,111,928` and SHA-256
  `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`.
- Reverify version, length, hash, canonical path role, regular-file safety, and
  final launch-bound file identity for each qualified invocation. Reject PATH,
  registry, current-directory, resource, relative, request-supplied, link,
  reparse, UNC, alternate-stream, and other fallback authority.
- Expose only fixed typed operation classes and argument templates. Disable
  updates and resident mode, filter the environment, bound input/output/time/temp
  storage/concurrency, and redact paths and document content.
- Emit immutable local qualification receipts bound to binary identity, operation
  policy, matrix subject, environment policy, limits, fixture/result hashes,
  Windows identity, age policy, and the canonical residual limitations.
- Keep OfficeCLI unbundled and never download, update, or acquire it at runtime.
  The only release targets in this mission are Windows Electron NSIS and portable
  `.exe`.

### Active Handoff, Validation, and Completion

Phase 2 owns the pinned identity, typed contracts, decoders, drift rules, and
capability model. Phase 4 owns the direct Node execution gateway and physical
local runs. Phase 13 verifies the exact binary is absent from final Windows
Electron artifacts and probes missing, wrong, and exact configurations.

Qualification makes no sandbox, restricted-identity, profile-isolation, egress,
independent descendant-containment, or teardown-attestation claim. It records
those controls as not proven.

Run focused identity, path, version-decoder, stale-receipt, operation-allowlist,
no-update/no-resident, packaging-absence, and wrong/missing/exact capability
tests, then the repository milestone validators. The phase is complete when the
exact pin is the only qualifying identity, all drift and fallback cases fail
before document work, the direct-gateway handoff is versioned, Original remains
recoverable on every failure, and applicable tests pass.
