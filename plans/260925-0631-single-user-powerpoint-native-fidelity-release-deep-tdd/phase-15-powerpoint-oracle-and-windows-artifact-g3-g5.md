---
title: 'Phase 15: Microsoft PowerPoint G5 and Windows Evidence'
description: 'Qualify exact-subject OfficeCLI and local Microsoft PowerPoint evidence through a separate environment-bounded claim contract; Windows executable publication and G3 are out of scope.'
status: pending
priority: P0
effort: 8d
issue: null
branch: master
phase: 15
dependencies: [4, 10, 11, 12, 13, 14]
tags: [windows, electron, powerpoint, oracle, pptx, release, tdd]
created: 2026-09-25
---

# Phase 15: Microsoft PowerPoint G5 and Windows Evidence

## Context

- The Windows evidence lane consumes exact-subject OfficeCLI and Microsoft PowerPoint receipts; it does not publish Windows executables or qualify G3.
- Existing oracle capture is browser Reveal capture. It validates evidence envelopes and fixed SSIM policy, but it is not Microsoft PowerPoint rendering.
- Existing evidence policy correctly denies protected-provider claims. This phase intentionally uses a local Windows machine and local Microsoft PowerPoint only.
- G5 means selected local PowerPoint open/render oracle evidence. This phase makes no Windows artifact G3 claim and no universal compatibility claim.
- Phase 14 module characterization/decomposition runs first. Phase 15 evidence exercises the post-cleanup modules while preserving the Phase 13 shared export IR.
- The physical run uses a reverted clean Windows VM and dedicated non-admin user with no inherited secrets. Setup egress is allowlisted; qualification itself is loopback/offline.

## Goal

From one clean commit, one prebuilt client payload, and one deterministic Windows environment:

1. Verify unpacked Windows Electron runtime closure from the exact prebuilt client without producing a distributable installer or portable package.
2. Open exact R0 and R1 PPTX packages in installed Microsoft PowerPoint through a repository-owned COM harness.
3. Prove no repair/protected-view/modal prompt, exact package identity, unchanged-region preservation, expected edited-region change, and fixed SSIM thresholds.
4. Evaluate a dedicated local-PowerPoint claim kind without touching or satisfying the protected-provider evaluator.
5. Import external OfficeCLI and PowerPoint G5 receipts only when their subject SHA and client digest match this run.
6. Publish only environment-bounded wording.

## Scope / Non-Goals

### In scope

- Windows 10/11 x64 local evidence runner.
- Pinned Node/npm/PowerPoint build, locale, DPI, fonts, and GPU/render settings.
- Unpacked Electron runtime-closure check using the exact prebuilt client; this is not G3 and uploads no executable as a release artifact.
- Exact-subject external OfficeCLI evidence and local PowerPoint G5 evidence.
- PowerPoint COM open, slide export, prompt detection, process cleanup, and receipts.
- Exact SHA-256 for R0, R1, independent expected packages/goldens, runtime receipt, and captured PNG files.
- Canonical decoded-RGBA hashes for render repeatability; raw PNG SHA-256 only for artifact integrity.
- Whole-slide and region-of-interest SSIM.
- Receipt export/import across the Windows evidence host and the Phase 16 coordinator.

### Non-goals

- No executable package or public Windows artifact publication; no NSIS/portable qualification or G3 claim.
- No code signing, Authenticode verification, public-artifact eligibility check, or signer dependency.
- No KMS, HSM, protected provider, external signer, or protected release capability.
- No OfficeCLI substitution for PowerPoint.
- No macro-enabled, encrypted, password-protected, rights-managed, Protected View, or external-linked corpus.
- No broad “works in PowerPoint”, “1:1”, or platform-independent claim.
- No upload of customer decks or screenshots.
- No creation of expected packages or visual goldens from the candidate package/capture under test.

## Key Insights

- COM success is not enough. The harness must detect modal windows, repair notifications, and process leaks.
- R0 and R1 must be identified by exact bytes before PowerPoint opens them. A filename is not identity.
- Repeatability belongs in the gate: capture R0 twice, decode through the pinned decoder, normalize to width/height plus RGBA8 bytes, and require exact normalized hashes. Encoder metadata/compression differences do not define render repeatability.
- Expected changes need two comparisons: R1 versus expected edited golden, and R1 edited ROI versus R0 to prove the edit is visible.
- Unchanged regions need masks. Whole-slide SSIM can hide collateral damage or dilute a small intended edit.
- Local evidence can close a local physical gate. It cannot satisfy the protected-provider lane in `release-claim-policy.js`.
- Expected-package and expected-golden provenance must be independent: predating the candidate run, produced by a distinct pinned recipe/source, stored outside run output, and mounted read-only.
- Windows runtime closure consumes the same prebuilt client payload but is not executable publication or G3; G5 is bound to exact R0/R1 package inputs and independent expectations.

## Requirements

### Windows runtime closure (not G3)

1. Use a clean `npm ci` and the exact client payload bound to the current subject SHA.
2. Build only the unpacked Windows `dir` target; do not build NSIS or portable distributables.
3. Record exact commit, prebuilt-client hash, tool versions, and runtime-closure receipt.
4. Verify runtime closure against the unpacked runtime and do not upload its executable or package.
5. Do not sign, inspect Authenticode, attest Windows executables, or claim G3/public artifact eligibility.

### PowerPoint G5

1. Use installed desktop Microsoft PowerPoint discovered through COM; reject Store/web placeholders.
2. Record executable path, file hash, product/version/build, bitness, Windows build, locale, timezone, DPI, fonts, and display scale.
3. Run with alerts suppressed only through documented COM controls; any unexpected prompt/modal fails.
4. Open exact R0 and R1 read-only, without links, macros, or external updates.
5. Confirm slide count and successful open; no repair, conversion, Protected View, or password prompt.
6. Export every slide to PNG at fixed dimensions.
7. Repeat R0 capture and require exact normalized decoded-RGBA hashes; record raw PNG SHA-256 separately for file integrity only.
8. Validate whole-slide fixed policy: mean SSIM `>= 0.99`, minimum slide SSIM `>= 0.97`.
9. Validate unchanged ROI minimum SSIM `>= 0.995`.
10. Validate edited ROI against the expected R1 golden `>= 0.99` and against R0 `<= 0.995`.
11. Verify expected changed OOXML closure and unchanged package parts by exact hash policy established in earlier phases.
12. Kill only the harness-owned PowerPoint process tree; no existing user PowerPoint process may be attached or terminated.
13. Validate expected R1 package, rendered goldens, and masks through independent provenance. Reject any expectation created in the current run, copied from candidate output, located under the run directory, or lacking a distinct producer/recipe receipt.
14. Emit claim kind `local_powerpoint_environment` through its own schema, evaluator, and CLI. It must not deserialize as, delegate to, or satisfy a protected-provider claim.
15. Export a canonical receipt bundle binding every file to exact Git SHA, R0/R1 package hashes, host role, environment hash, and parent receipt hashes. Phase 16 imports and revalidates it without rewriting evidence.

### Execution environment

1. Revert a pinned clean Windows VM snapshot before each physical attempt.
2. Use a dedicated non-admin local user with a fresh profile and no mounted developer home, credential-manager entries, SSH keys, cloud tokens, or production data.
3. Record VM image ID/hash, Windows update level, local-user SID hash, and network-policy hash.
4. Default-deny outbound traffic. Permit only loopback during runtime and PowerPoint qualification; close any setup allowlist before evidence capture.
5. Transfer inputs and export receipts through a run-owned, hash-verified staging channel. The destination coordinator treats imported receipts as immutable.

## Architecture

```text
clean source subject + exact prebuilt-client receipt
  -> unpacked Windows runtime-closure check (not G3)

exact-subject external OfficeCLI receipt
exact R0 + exact R1 + expected-edit manifest
  -> isolated local COM worker
  -> open/read-only/no links/no macros
  -> export fixed-size slide PNGs
  -> prompt/process/slide receipts
  -> raw PNG integrity hashes + normalized decoded-RGBA hashes
  -> whole-slide SSIM + ROI SSIM + OOXML hash checks
  -> environment-bounded G5 receipt

```

Expected packages, visual goldens, and masks are independent, provenance-pinned, read-only inputs. Candidate outputs never become expectations.

### Process isolation

- A PowerShell coordinator starts a dedicated child PowerShell COM worker.
- Worker creates a new PowerPoint application; it never calls `GetActiveObject`.
- Coordinator records pre-existing `POWERPNT.EXE` PIDs.
- Worker returns its application HWND/PID and receipt over a run-owned JSON file.
- Timeout closes presentations, calls `Quit`, releases COM references, triggers GC, then terminates only the new PID tree if still alive.
- Existing PowerPoint instances make the run blocked unless policy explicitly allows side-by-side isolation and PID proof succeeds.

### Deterministic environment manifest

- Exact corpus, R0, R1, expected-golden, mask, runtime, and script hashes.
- VM base-image identity, dedicated-user identity hash, secret-scan result, and egress-policy hash.
- Prebuilt client payload hash and runtime-closure receipt.
- Display scale/DPI and export pixel dimensions.
- Installed font inventory hashes for required corpus fonts.
- Node/npm/Electron/electron-builder versions.
- Git SHA and clean-tree assertion.

### Claim separation and receipt transport

- `protected_provider` remains owned by the existing protected-provider policy and stays false.
- `local_powerpoint_environment` has a separate schema, evaluator, CLI command, allowed wording, and evidence ceiling.
- The local evaluator requires exact package/environment/capture/provenance receipts and returns only `pass`, `fail`, or `blocked`; no result is translated to a protected claim.
- The Windows host exports a canonical receipt bundle. The release coordinator imports it with schema validation, path confinement, exact file inventory, SHA-256 verification, DAG-parent verification, and exact Git SHA equality.
- Imported receipt files are never normalized in place. Derived coordinator indexes reference their hashes.

## Absolute File Inventory

### Create

- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-com-capture.ps1` — isolated COM worker.
- `C:\Work\NavSlidesEditor\scripts\windows\run-powerpoint-oracle.ps1` — coordinator, environment capture, cleanup, and receipts.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-environment.js` — normalize environment manifest.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-region-compare.js` — masks and ROI SSIM.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-rgba-hash.js` — pinned decode, RGBA8 normalization, and render-repeatability hash.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-oracle-manifest.schema.json` — fixed local manifest schema.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-oracle-manifest.json` — selected R0/R1/ROI cases and exact hashes.
- `C:\Work\NavSlidesEditor\scripts\windows\local-powerpoint-claim.schema.json` — schema only for `local_powerpoint_environment`.
- `C:\Work\NavSlidesEditor\scripts\windows\evaluate-local-powerpoint-claim.js` — dedicated local claim CLI/evaluator entry.
- `C:\Work\NavSlidesEditor\scripts\windows\export-windows-evidence-receipt.js` — immutable cross-host receipt bundle.
- `C:\Work\NavSlidesEditor\scripts\release\import-host-receipt.js` — exact-SHA receipt import and DAG-parent validation.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-com-capture.test.js` — mocked contract tests, not physical evidence.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-region-compare.test.js` — threshold/mask tests.
- `C:\Work\NavSlidesEditor\scripts\windows\powerpoint-rgba-hash.test.js` — decoder normalization and encoder-metadata invariance.
- `C:\Work\NavSlidesEditor\scripts\windows\local-powerpoint-claim.test.js` — claim separation, wording, and provenance tests.
- `C:\Work\NavSlidesEditor\scripts\release\import-host-receipt.test.js` — immutable multi-host import tests.

### Modify

- `C:\Work\NavSlidesEditor\package.json` — local-only G5 and Windows runtime-closure scripts.
- `C:\Work\NavSlidesEditor\scripts\runtime-receipt.js` — record unpacked Windows runtime closure, not distributable targets.
- `C:\Work\NavSlidesEditor\scripts\verify-runtime-closure.js` — verify unpacked Windows runtime closure.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\oracle\pptx-oracle-cli.js` — preserve browser mode and dispatch local qualification only to the dedicated local claim CLI.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\oracle\oracle-evidence-runner.js` — validate local COM capture authority.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\oracle\actual-evidence.js` — exact local capture inventory.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\oracle\comparison-evidence.js` — ROI evidence.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\oracle\oracle-gate.js` — fixed whole-slide plus ROI gates; no CLI threshold override.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\evidence\release-claim-policy.js` — reject local claim records at the protected-provider boundary; protected-provider requirement stays unchanged.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\evidence\local-powerpoint-claim-policy.js` — dedicated environment-bounded evaluator used only by the local CLI.
- `C:\Work\NavSlidesEditor\server\services\pptx-import\evidence\composite-run.js` — attach local G5 as a distinct claim kind without upgrading protected claim.
- `C:\Work\NavSlidesEditor\docs\deployment-guide.md` — local Windows qualification procedure.
- `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md` — exact environment-bounded claim text.
- `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md` — evidence outcome and limits after a real run.

### Delete

- No production capability. Never delete historical failed oracle receipts.

## RED Tests

1. Reject dirty working tree, stale runtime evidence, mismatched subject/client digest, or missing selected target.
2. Reject OfficeCLI or PowerPoint receipts whose exact subject SHA or client digest differs from this run.
3. Reject COM worker using `GetActiveObject`.
4. Reject missing PowerPoint executable hash/build/bitness.
5. Reject pre-existing PowerPoint attachment or ambiguous PID ownership.
6. Reject any modal/repair/Protected View/password/link-update prompt.
7. Reject slide count mismatch or missing PNG.
8. Prove PNGs with different encoder metadata but identical decoded RGBA pass repeatability; prove one pixel difference fails. Raw PNG hashes remain distinct integrity facts.
9. Reject source/candidate package hash mismatch.
10. Reject expected package/golden provenance from the current run, candidate output, mutable run path, same producer receipt, missing recipe hash, or post-candidate creation time.
11. Reject unexpected changed OOXML part or expected changed part left unchanged.
12. Reject whole-slide mean/minimum threshold failure.
13. Reject unchanged ROI below `0.995`.
14. Reject edited ROI that does not match expected R1 or does not differ from R0.
15. Reject CLI threshold override.
16. Reject wording such as “PowerPoint compatible” without environment qualifiers.
17. Reject any configuration requiring cloud, KMS, protected provider, external signer, Authenticode, or G3.
18. Reject a `local_powerpoint_environment` record passed to the protected-provider evaluator, or any local evaluator output labeled as protected.
19. Reject mixed-SHA/mixed-parent host receipts, changed imported files, unlisted files, or receipt path traversal.
20. Reject a Windows receipt claiming G3, Authenticode, signing, or attestation; selected gates are runtime closure, external OfficeCLI, and PowerPoint G5 only.
21. Reject package rebuild, non-isolated user/VM, secret presence, or open egress during qualification.

## Implementation

1. After Phase 14 is green, freeze selected physical rows and exact R0/R1 fixtures from Phases 10–12.
2. Add manifest schema with hashes, slide counts, edited ROIs, unchanged masks, expected changed OOXML closure, fixed thresholds, and independent expected-package/golden provenance.
3. Import and validate external OfficeCLI and PowerPoint G5 receipts against exact subject SHA and client digest; never synthesize either physical result.
4. Build only the unpacked Windows `dir` runtime and capture runtime closure; do not produce NSIS/portable distributables.
5. Implement COM worker:
   - create new PowerPoint instance;
   - disable macros and link updates;
   - open read-only;
   - record open state and slide count;
   - export fixed-size PNGs;
   - close and quit.
6. Add UI Automation/window enumeration only for detecting unexpected owned modal windows; do not dismiss and continue.
7. Run R0 twice; establish deterministic decoded-RGBA hashes and separately retain raw PNG integrity hashes.
8. Validate independent expected evidence, capture R1, and compare only to pre-existing provenance-pinned R1 goldens.
9. Run OOXML exact part-hash closure checks against the independently produced expected package manifest.
10. Extend the oracle envelope with environment, package, capture, prompt, process-cleanup, provenance, and receipt-DAG records; exclude Authenticode and executable-signing claims.
11. Keep protected-provider evaluation false and add negative cross-kind tests.
12. Generate and evaluate a `local_powerpoint_environment` claim record with exact allowed wording.
13. Export the immutable Windows evidence receipt for Phase 16 import.

## Refactor

- Keep PowerShell limited to Windows/COM/process operations.
- Keep JSON canonicalization, hashing, inventory, SSIM, and policy in testable Node modules.
- Reuse existing PNG decode/SSIM modules.
- Do not merge browser-present actuals and PowerPoint actuals under one authority label.
- Do not place local-PowerPoint claim logic inside `release-claim-policy.js`; shared low-level canonicalization is allowed, evaluator ownership is not.
- Never use encoded PNG bytes as the render-repeatability result.
- Split scripts before 200 LOC where practical.
- Preserve the current browser oracle as a separate lower-authority diagnostic lane.

## GREEN Tests

```powershell
npx vitest run scripts/windows/powerpoint-region-compare.test.js scripts/windows/powerpoint-rgba-hash.test.js scripts/windows/powerpoint-com-capture.test.js scripts/windows/local-powerpoint-claim.test.js scripts/release/import-host-receipt.test.js
npx vitest run server/services/pptx-import/oracle/ server/services/pptx-import/evidence/
npm run runtime:verify
npm run electron:builder -- --win dir --publish never
node scripts/verify-runtime-closure.js --root dist-electron/win-unpacked/resources --require-client-dist
npm run test:pptx:package:no-officecli
npm run test:pptx:powerpoint:g5
```

The Windows receipt binds only `runtime-closure`, exact-subject `officecli-physical`, and `fidelity-powerpoint` evidence. Runtime closure is not G3; mocked unit tests never count as physical evidence.

## Scenario Matrix

| Scenario                         | Expected                                                     |
| -------------------------------- | ------------------------------------------------------------ |
| Unpacked Windows runtime closure | Passes; no installer or portable package is uploaded        |
| External OfficeCLI receipt       | Exact subject SHA/client digest; mismatch rejected           |
| PowerPoint G5                    | Exact R0/R1, no repair/prompt, expected slide count          |
| Receipt tamper                   | Hash/parent mismatch rejected before import                 |
| R0 capture A/B                   | Exact normalized RGBA hashes                                 |
| Edited ROI                       | Matches expected R1 and differs from R0                      |
| Unexpected collateral part       | Exact OOXML closure failure                                  |
| Missing font/wrong DPI/locale    | Environment mismatch; run blocked                            |
| Existing PowerPoint process      | Block or prove isolated PID ownership                        |
| COM hang                         | Timeout, owned-process cleanup, failed receipt               |
| PowerPoint unavailable           | G5 blocked, never skipped/passed                              |
| Encoder metadata differs         | Raw hashes differ; normalized RGBA hashes match              |
| Candidate used as golden         | Provenance rejection before comparison                       |
| Generated or unsigned executable | Never uploaded or treated as a release artifact or G3        |
| Mixed-SHA imported receipt       | Import rejected; no coordinator evidence emitted             |
| Open egress or secret found      | Physical run rejected                                        |

## Regression Gates

- Existing oracle integrity and qualification tests stay green.
- Existing fixed `phase08_full` policy remains mean `0.99`, minimum `0.97`.
- Protected-provider lane remains unavailable.
- `test:pptx:package:no-officecli` validates the selected application bundle; external OfficeCLI physical evidence remains a separate exact-subject receipt.
- PowerPoint qualification opens only hash-verified R0/R1 inputs; it does not smoke Windows executables.
- Exact evidence inventory contains no unexpected file.
- Candidate outputs are never accepted as expected packages, goldens, or masks.
- Repeatability gates compare normalized decoded RGBA, not encoded PNG bytes.
- Local and protected claim kinds remain schema- and evaluator-disjoint.
- Imported receipts and evidence records bind exact Git SHA and exact parent/artifact hashes.
- Windows evidence receipt contains only `runtime-closure`, `officecli-physical`, and `fidelity-powerpoint`; no G3, Authenticode, signing, executable, or attestation claim.

## Todos

- [ ] Select and hash G5 fixtures.
- [ ] Pin independent expected-package/golden provenance.
- [ ] Add RED receipt, COM, RGBA, claim-separation, ROI, and wording tests.
- [ ] Attest clean VM/user, no secrets, and controlled egress.
- [ ] Validate receipt-only artifact inventory and avoid executable upload.
- [ ] Build isolated COM capture.
- [ ] Add prompt/process cleanup proof.
- [ ] Add exact package/capture hashes.
- [ ] Add normalized decoded-RGBA repeatability hashes.
- [ ] Add exact-subject external OfficeCLI and G5 receipt validation.
- [ ] Export and re-import the exact-SHA Windows evidence receipt.
- [ ] Add SSIM/ROI gates.
- [ ] Run real local PowerPoint oracle.
- [ ] Record truthful environment-bounded outcome.

## Success Criteria

- Exact-subject OfficeCLI and PowerPoint receipts pass their independent physical gates; the unpacked Windows runtime-closure check passes without creating a distributable artifact.
- R0 repeat capture has identical normalized decoded-RGBA hashes; raw PNG hashes are retained only for artifact integrity and may differ without failing repeatability.
- R1 opens in local Microsoft PowerPoint without repair or prompt.
- Exact package and capture hashes verify.
- Whole-slide and ROI thresholds pass for selected rows.
- Unchanged OOXML/visual regions remain unchanged within policy; edited regions change exactly as expected.
- Claim wording names the exact environment and selected corpus/rows.
- No cloud/KMS/protected-provider dependency or claim.
- Dedicated `local_powerpoint_environment` schema/evaluator/CLI passes while protected-provider evaluation remains false.
- Independent expected evidence, exact-subject physical receipts, clean VM/user, controlled egress, and multi-host receipt import all validate; no Windows G3, Authenticode, signing, executable, or attestation claim is emitted.

## Risks / Signals / Responses

| Risk                           | Signal                            | Response                                    |
| ------------------------------ | --------------------------------- | ------------------------------------------- |
| COM nondeterminism             | R0 hashes differ                  | Block G5; fix fonts/DPI/build/profile       |
| Hidden prompt                  | Owned modal window                | Fail immediately; capture title/class only  |
| Existing session harmed        | PID overlap                       | Never attach/kill; block run                |
| Collateral package mutation    | Unexpected part hash              | Reject R1 and investigate transaction       |
| Tiny edit hidden by whole SSIM | Whole slide passes, ROI unchanged | Require edited ROI delta                    |
| Overclaim                      | Unqualified release text          | Claim-policy test fails                     |
| Stale external evidence        | Subject/client digest mismatch    | Reject receipt; rerun physical gate         |
| Font substitution              | Font manifest mismatch            | Install/pin required fonts or block         |
| Candidate-as-golden leakage    | Golden provenance references run  | Reject before capture comparison            |
| PNG encoder nondeterminism     | Raw hash differs, RGBA same       | Keep raw integrity fact; use RGBA gate      |
| Claim-kind confusion           | Local receipt reaches protected   | Fail schema dispatch and evaluator          |
| Cross-host receipt tamper      | Imported hash/DAG mismatch        | Reject bundle; rerun originating host       |
| Executable publication         | EXE appears in uploaded files     | Reject evidence inventory; publish receipt only |

## Security

- No macros, ActiveX, OLE execution, external links, remote templates, or network retrieval.
- Corpus must be repository-controlled and hash-pinned.
- COM opens read-only with macro automation security forced disabled.
- Harness uses a reverted clean VM, dedicated non-admin user, fresh local profile/data root, no secrets, and loopback-only qualification networking.
- No secrets, cloud credentials, or protected-provider tokens.
- Receipts contain environment metadata, not user document content.
- Upload only the exact-subject evidence receipt; do not upload Windows executables, customer decks, or screenshots.

## Dependencies

- Phase 10 exact R0/R1 seed.
- Phase 11 selected promoted primitive rows and mutation gates.
- Phase 12 selected chart/workbook row if included.
- Phase 13 deterministic export semantics.
- Phase 14 characterization-only module decomposition must preserve the Phase 13 shared export IR.
- Installed Microsoft PowerPoint desktop application and external OfficeCLI evidence on the declared Windows host.
- Phase 16 consumes receipts; Phase 15 does not itself authorize release.

## Allowed Claim Wording

> On the recorded isolated Windows VM and Microsoft PowerPoint build, the selected hash-pinned R0/R1 package inputs and G5 corpus rows opened without repair or prompts and met the recorded whole-slide and region SSIM policies. This is a `local_powerpoint_environment` result, not a protected-provider, G3, executable-signing, or universal compatibility claim.

Forbidden: “PowerPoint compatible”, “pixel perfect”, “1:1”, “all decks”, “all Windows versions”, or any protected-provider implication.

## Unresolved Questions

- None. PowerPoint absence, nondeterministic repeat capture, or modal ambiguity is a blocking result.
