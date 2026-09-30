---
title: 'Phase 15: Private Windows Runtime and OfficeCLI Evidence'
description: 'Qualify the exact-source unpacked Windows runtime and OfficeCLI evidence; neither Windows executable G3 nor PowerPoint G5 is selected for v1.17.0.'
status: pending
priority: P0
effort: 8d
issue: null
branch: master
phase: 15
dependencies: [4, 10, 11, 12, 13, 14]
tags: [windows, electron, officecli, pptx, release, tdd]
created: 2026-09-25
---

# Phase 15: Private Windows Runtime and OfficeCLI Evidence

## Decision and boundary

The v1.17.0 Windows lane is evidence-only. It qualifies unpacked Electron runtime closure using the exact prebuilt client and imports independently produced, exact-source physical OfficeCLI evidence for G1. The selected physical release gates are G0/G1/G2/G4. No Windows installer or portable executable is a release asset; unpacked runtime closure is not executable-artifact G3.

Microsoft PowerPoint G5 is **not selected** for v1.17.0. Its local COM oracle remains a future, separately authorized environment-bounded evidence path, not a prerequisite, receipt, or claim of this release. Do not infer PowerPoint fidelity from the importer corpus, editor/browser snapshots, integrity-only oracle reports, local diagnostic screenshots, OfficeCLI success, or a native editable PPTX. The [PowerPoint visual-evidence runbook](../../docs/pptx-visual-evidence-runbook.md) is diagnostic/future guidance, not this phase's release gate. Native edited-PPTX requirements in Phases 10–12 remain selected and unchanged.

## Preconditions

- Phase 4 produces a clean source subject and one content-addressed prebuilt client archive; Windows imports the Linux parent and that client rather than rebuilding it.
- Phases 7–11 establish G0, direct local OfficeCLI G1, physical R0→R1 G2, and selected exact G4 row/mutation evidence. The G1 receipt must be physically produced for the final source subject; historical feasibility and parser/corpus results cannot stand in for it.
- Phase 14 characterization/decomposition precedes this runtime qualification, so the evidence addresses the release candidate's post-cleanup code.
- Windows qualification runs in an isolated local/CI environment using non-production data; recorded receipts exclude credentials and identifying machine/user information.

## Selected evidence contract

1. Import the exact prebuilt client, verify archive digest, source SHA, Linux parent receipt, lock/toolchain identity, and release-target policy before packaging. A mismatched parent or subject fails the Windows lane.
2. Build only Electron's unpacked Windows `dir` target. Exercise the actual unpacked runtime, server/UI and vendored assets under isolated loopback configuration, and verify runtime closure. Record the exact subject, client digest, runtime inputs, outcomes and hashes in a private child receipt. No NSIS/portable build, upload, signature, Authenticode check, executable attestation, or G3 claim is authorized.
3. Import the external direct-OfficeCLI physical qualification receipt for the **same** final source SHA and pinned binary identity. Validate G1 process/cleanup/claim constraints against the owning [Phase 8 contract](./phase-08-direct-officecli-qualification-g1.md); fail closed on missing, stale, mixed-subject or altered physical evidence. Do not synthesize OfficeCLI success on the Windows packaging host or substitute importer-corpus evidence.
4. Export a Windows child receipt referencing the Linux parent and prebuilt-client hash with only selected runtime-closure and OfficeCLI evidence. A diagnostic PowerPoint artifact, if independently collected, stays outside the selected gate/receipt DAG and cannot be labeled `fidelity-powerpoint`, G5 passed, or protected-provider evidence.
5. Phase 16 verifies the required Linux/Windows DAG and all selected G0/G1/G2/G4 gates before a release decision. This plan does not itself prove a physical run, green CI, a tag, or publication.

## Fail-closed scenarios

- Different source SHA, client digest, parent hash, or OfficeCLI binary identity: reject.
- Missing final-subject OfficeCLI receipt or failed process/cleanup/claim check: reject; historical feasibility is insufficient.
- Unpacked runtime fails its startup, UI/API, or runtime-closure check: reject.
- A receipt claims Windows executable G3, signing, public EXE eligibility, or PowerPoint G5 as a release requirement/pass: reject that claim; do not broaden selected gates.
- Local diagnostic COM screenshots, importer-corpus reports, or visual-integrity-only results masquerade as selected physical evidence: reject.

## Completion criteria

- [ ] One exact-subject unpacked Windows runtime has been exercised without producing or publishing a distributable executable.
- [ ] The independently produced final-subject OfficeCLI G1 physical receipt validates against its selected gate contract.
- [ ] The private Windows child receipt is bound to the Linux parent and identical prebuilt-client bytes.
- [ ] Neither G3 nor G5 is represented as selected or passed; no unqualified PowerPoint fidelity claim is issued.
- [ ] Phase 16 can consume the Windows evidence with the complete selected G0/G1/G2/G4 release bundle.
