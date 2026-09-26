---
title: 'Phase 16: Final Full Verification and Release Rehearsal'
description: 'Freeze one RC, then verify build-once artifacts through mandatory multi-host software, browser, PPTX, load, package, rollback, and supply-chain gates.'
status: pending
priority: P0
effort: 5d
issue: null
branch: master
phase: 16
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
tags: [release, verification, ci, pptx, electron, docker, tdd]
created: 2026-09-25
---

# Phase 16: Final Full Verification and Release Rehearsal

## Context

- This is the only release-candidate rehearsal for the plan. It verifies one immutable commit and one artifact set.
- Focused phase tests are necessary but insufficient.
- Mandatory tests cannot be skipped, converted to warn-only, retried until green without root cause, or replaced by previous receipts.
- Physical gates G0–G5 apply only where selected by the canonical matrix and environment manifests.
- Release docs, changelog, version, workflows, generated descriptors, and claim wording are finalized before the RC SHA is cut. The rehearsal permits no tracked-file edit, generated tracked diff, snapshot update, or post-hoc claim correction.
- Evidence is produced on multiple isolated hosts and joined as a hash-linked receipt DAG: Linux CI/Docker/load, Windows Electron/OfficeCLI/PowerPoint, and optional Linux/macOS desktop lanes.
- Dependency order is Phase 13 shared export IR, then Phase 14 characterization-only module cleanup, then Phase 15 Windows/PowerPoint evidence. Phase 16 rejects receipts from any other lineage.

## Goal

Produce one auditable RC evidence bundle proving:

- clean dependency installation and release state;
- lint, all Vitest shards, merged coverage, and full unsharded test;
- one prebuilt client artifact reused without rebuild by source runtime, Docker, Electron, and every package;
- build, frozen docs, matrix, audits, and all Playwright projects/full E2E;
- strict PPTX importer/package-first and selected physical G0–G5 gates;
- full browser audit, adversarial/performance/load tests;
- Docker and Electron runtime/artifact closure;
- multi-host exact-SHA receipts, checksums, application/image/OS/browser SBOM and vulnerability results, provenance, rollback/down-migration evidence, and final release decision.

## Scope / Non-Goals

### In scope

- One clean clone/worktree at one RC commit.
- One exact Node/npm/toolchain manifest.
- Release evidence in a run-owned directory.
- All mandatory commands and physical gates.
- Release decision and rollback rehearsal.
- Pre-RC documentation/changelog freeze and post-freeze tracked-tree immutability.
- One content-addressed client build imported by every packaging host.
- Required Linux and Windows receipt lanes plus explicitly optional Linux/macOS desktop receipts.

### Non-goals

- No production publish, tag push, GitHub Release creation, or remote deployment.
- No test baseline update during rehearsal.
- No dependency upgrade except through a new RC commit and full restart.
- No waiver for a mandatory failure.
- No universal PowerPoint claim.
- No rebuild of client assets inside Docker, Electron, installer, portable, or desktop packaging.
- No tracked documentation/changelog edit during rehearsal.

## Key Insights

- Build once is meaningful only if every artifact and receipt points to the same clean SHA.
- “Build once” includes client bytes. A package that reruns Vite is a different lineage even when source SHA matches.
- Sharded tests catch topology/runtime issues; the full unsharded run catches shard omissions and shared-state assumptions. Both are mandatory.
- Coverage merge must prove exact shard inventory; partial merge is a false green.
- Release evidence is data: commands, exit codes, durations, hashes, environment, and artifact lineage must be machine-readable.
- A failed mandatory gate invalidates the RC. Fixes create a new SHA and require a fresh rehearsal.
- Multi-host evidence needs parent hashes, not filenames. Each child receipt binds exact SHA, host role, input subjects, tool/environment hashes, outputs, and parent receipts.
- Rollback confidence requires both a pre-upgrade state snapshot and execution of the previous binary against restored or explicitly down-migrated cloned data.

## Requirements

### Immutable RC

1. Clean worktree and exact commit SHA.
2. `npm ci` from checked-in lockfile.
3. Release-state command from Phase 2 passes and records version/docs/lock/runtime consistency.
4. README, docs, roadmap, changelog, version, release workflows, generated matrices/descriptors, and local-PowerPoint wording are committed and frozen before gate start.
5. `git status --porcelain=v1 --untracked-files=all` and tracked-file hashes remain unchanged through rehearsal; only ignored run-owned evidence/output paths may change.
6. Evidence bundle records every command, exit code, start/end, environment, exact Git SHA, parent receipt hashes, and output artifact hash.
7. A Linux build receipt creates one content-addressed client archive. Every package imports and verifies it; package scripts run with client build disabled.
8. Every receipt, log index, SBOM, scan, package, screenshot, and derived manifest is bound to exact SHA. Unbound evidence is invalid even when its artifact hash is present.

### Mandatory gates

- Lint.
- Every Vitest shard.
- Exact shard merge and coverage thresholds.
- Full unsharded `npm test`.
- Client build and docs build.
- Documentation contracts and stale-diff checks.
- Feature inventory/matrix/audit gates.
- `npm audit --audit-level=moderate`.
- Every configured Playwright project plus full E2E.
- Strict PPTX importer qualification.
- Package-first no-OfficeCLI claim gate.
- Selected G0–G5 physical gates.
- Full PPTX browser audit.
- PPTX adversarial and full performance matrices.
- API and WebSocket smoke/load/stress according to release policy.
- Docker build/runtime/persistence/restart.
- Windows NSIS and portable Electron artifacts and G3 smoke.
- Phase 15 `local_powerpoint_environment` claim evaluation through its dedicated schema/evaluator/CLI; protected-provider policy remains false and separate.
- Runtime closure for source, Docker, unpacked Electron, NSIS, and portable.
- Linux CI/Docker/load and Windows Electron/OfficeCLI/PowerPoint receipt DAG validation.
- Optional Linux/macOS desktop packages only when declared optional before RC; if included, they consume the same prebuilt client and produce exact-SHA child receipts.
- Previous-release upgrade snapshot, candidate upgrade, previous-binary rollback, and cloned-data down-migration rehearsal.
- Checksums, application/package/container/OS/browser SBOMs, vulnerability scans, provenance, and frozen release notes/changelog/docs.

## Architecture

```text
clean RC SHA
  -> frozen docs/changelog/version + release-state snapshot
  -> dependency install
  -> one content-addressed client build
  -> Linux CI/browser/PPTX/load/Docker receipt
  -> Windows Electron/OfficeCLI/PowerPoint receipt
  -> optional Linux/macOS desktop receipts
  -> receipt DAG import and exact-SHA validation
  -> rollback/down-migration receipt
  -> checksums/SBOM/vulnerability/provenance
  -> evidence inventory validation
  -> release decision matrix
```

### Rehearsal runner

- Repository-owned Node coordinator executes a declarative gate manifest.
- It never suppresses a non-zero exit.
- It supports `blocked` only for optional diagnostics. Mandatory physical gates are `pass` or `fail`; unavailable means release `NO-GO`.
- It hashes command inputs and generated artifacts.
- It validates the host receipt DAG and rejects missing parents, mixed SHA, cycles, duplicate host roles, mutated imports, or undeclared optional lanes.
- It writes a canonical final manifest and a human-readable summary.
- It cannot publish or tag.
- It has no skip, exclude, pass-with-no-tests, update-snapshot, rebuild-client, or force-green option.

### Multi-host receipt DAG

- Root receipt: frozen RC SHA, tracked-tree manifest, lockfiles, version/docs/changelog hashes, gate manifest, and prebuilt-client hash.
- Linux required child: lint/unit/coverage/build/docs/browser/PPTX software/load/Docker plus container, OS, and browser evidence.
- Windows required child: imported prebuilt client, Electron/NSIS/portable, OfficeCLI when selected, Phase 15 G3/G5, Authenticode inventory, and `local_powerpoint_environment` result.
- Optional desktop children: Linux/macOS packaging and smoke only when marked optional in the root manifest before execution. Optional failure cannot satisfy or weaken any mandatory claim.
- Rollback child: previous-version subjects, pre-upgrade snapshot, candidate upgrade, previous-binary restoration, down-migration/restore results, and exact data hashes.
- Final aggregate receipt references child receipt hashes; it never copies or rewrites their claims.

## Absolute File Inventory

### Create

- `C:\Work\NavSlidesEditor\scripts\release\release-rehearsal-manifest.js` — ordered mandatory gate catalog.
- `C:\Work\NavSlidesEditor\scripts\release\run-release-rehearsal.js` — fail-closed coordinator.
- `C:\Work\NavSlidesEditor\scripts\release\release-evidence-schema.json` — final evidence contract.
- `C:\Work\NavSlidesEditor\scripts\release\validate-release-evidence.js` — exact gate/artifact inventory validation.
- `C:\Work\NavSlidesEditor\scripts\release\generate-checksums.js` — SHA-256 manifest.
- `C:\Work\NavSlidesEditor\scripts\release\generate-sbom.js` — CycloneDX generation/normalization.
- `C:\Work\NavSlidesEditor\scripts\release\scan-release-subjects.js` — fail-closed vulnerability scans for application, image/OS, and browser subjects.
- `C:\Work\NavSlidesEditor\scripts\release\export-host-receipt.js` — canonical host receipt with exact SHA and parent hashes.
- `C:\Work\NavSlidesEditor\scripts\release\verify-prebuilt-client.js` — content-addressed client import and no-rebuild enforcement.
- `C:\Work\NavSlidesEditor\scripts\release\rehearse-rollback.js` — snapshot, previous-binary, and cloned-data down-migration coordinator.
- `C:\Work\NavSlidesEditor\scripts\release\generate-provenance.js` — local SLSA-style provenance statement without signing claim.
- `C:\Work\NavSlidesEditor\scripts\release\run-release-rehearsal.test.js`
- `C:\Work\NavSlidesEditor\scripts\release\validate-release-evidence.test.js`
- `C:\Work\NavSlidesEditor\scripts\release\verify-prebuilt-client.test.js`
- `C:\Work\NavSlidesEditor\scripts\release\rehearse-rollback.test.js`
- `C:\Work\NavSlidesEditor\scripts\release\scan-release-subjects.test.js`
- `C:\Work\NavSlidesEditor\scripts\release\generate-provenance.test.js`
- `C:\Work\NavSlidesEditor\docs\release-rehearsal.md` — operator runbook and rollback.

### Modify

- `C:\Work\NavSlidesEditor\package.json` — canonical release rehearsal/checksum/SBOM/scan/provenance/rollback commands and Phase 2/3 aliases.
- `C:\Work\NavSlidesEditor\.github\workflows\github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` — align mandatory gate names after local rehearsal proves them.
- `C:\Work\NavSlidesEditor\.github\workflows\release.yml` — require validated local/CI evidence inputs before future publish; no publish in this phase.
- `C:\Work\NavSlidesEditor\scripts\runtime-receipt.js` — include final artifact inventory.
- `C:\Work\NavSlidesEditor\scripts\release\import-host-receipt.js` — extend Phase 15 Windows import into complete multi-host DAG validation.
- `C:\Work\NavSlidesEditor\scripts\release\import-host-receipt.test.js` — add Linux/optional-desktop/DAG-cycle and mixed-role cases.
- `C:\Work\NavSlidesEditor\electron-builder.yml` — consume the verified prebuilt client payload and fail if packaging invokes a client rebuild.
- `C:\Work\NavSlidesEditor\Dockerfile` — copy the verified prebuilt client payload; no in-image client build.
- `C:\Work\NavSlidesEditor\docs\deployment-guide.md`
- `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md`
- `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`
- `C:\Work\NavSlidesEditor\docs\project-roadmap.md`
- `C:\Work\NavSlidesEditor\docs\project-changelog.md`
- `C:\Work\NavSlidesEditor\README.md`

### Evidence output, generated and not hand-edited

- `C:\Work\NavSlidesEditor\plans\260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd\reports\release-candidate\<rc-id>\`

### Delete

- None. Failed evidence stays in its failed run directory; never overwrite it.

## RED Tests

1. Missing mandatory gate in manifest must fail validation.
2. Skipped, cancelled, timed-out, unavailable, or non-zero mandatory gate must produce `NO-GO`.
3. Duplicate gate name or incomplete shard set must fail.
4. Coverage merge with a missing shard must fail.
5. Evidence from mixed SHAs or dirty tree must fail.
6. Artifact hash mismatch must fail.
7. Runtime receipt missing NSIS or portable must fail.
8. SBOM missing a production workspace/package must fail.
9. Provenance subject not matching checksums must fail.
10. PPTX claim without exact G0–G5 receipts must fail.
11. Docs/changelog claiming more than evidence must fail.
12. Release workflow cannot publish when evidence validator fails.
13. Rehearsal runner has no `--skip-mandatory` or force-green option.
14. Any tracked-file change, generated tracked diff, snapshot update, or docs/changelog edit after RC freeze must fail and invalidate all later receipts.
15. Missing parent, mixed SHA, DAG cycle, duplicate host role, mutated imported receipt, or undeclared optional lane must fail.
16. Docker/Electron/desktop packaging that executes a client build or consumes a client hash other than the root receipt must fail.
17. A mandatory test result containing skipped, todo, pending, disabled, excluded, filtered, zero-discovered, or pass-with-no-tests status must fail.
18. A local PowerPoint record accepted by the protected-provider evaluator, or missing its dedicated `local_powerpoint_environment` contract, must fail.
19. Missing application/package/container/OS/browser SBOM or missing/stale vulnerability database/result must fail.
20. Vulnerability evidence not bound to the exact scanned subject digest, database digest, policy, tool version, and RC SHA must fail.
21. Rollback without verified previous binaries, a pre-upgrade snapshot, candidate-upgrade evidence, previous-binary launch, and applicable down-migration/restore proof must fail.
22. Any evidence or artifact lacking exact SHA, even if content-hashed, must fail final validation.

## Implementation

### 1. Prepare one RC

1. Before cutting the RC, finalize version, README, deployment/architecture/fidelity docs, roadmap, changelog, release workflows, generated matrices/descriptors, and exact local-PowerPoint wording.
2. Run all docs/contracts/generation checks, commit the results, and record the frozen tracked-tree manifest.
3. Confirm clean worktree, branch, SHA, lockfiles, runtime versions, and no secrets.
4. Create a fresh ignored run directory.
5. Run `npm ci`.
6. Run `npm run release-state`; save the root receipt.
7. Build the client exactly once, archive it deterministically, hash it, and make the archive read-only. All later package lanes import this subject.
8. Start continuous tracked-tree verification. Any tracked edit or generated tracked diff invalidates the RC; fixes require a new commit and a full restart.

### 2. Static, unit, coverage, build, docs

1. `npm run lint`.
2. Run all Vitest shards using Phase 3 canonical commands.
3. Validate exact shard inventory.
4. Merge coverage and enforce configured thresholds.
5. `npm run test` unsharded.
6. Verify the already-built client archive; do not rebuild it.
7. `npm run docs:build` from frozen source.
8. Run docs contract tests, generated descriptor checks, and `git diff --exit-code`.
9. `npm run matrix:gate`.
10. `npm run test:audit`.
11. `npm audit --audit-level=moderate`.

Every test runner also emits machine-readable results. The evidence validator rejects any mandatory skip/todo/pending/disabled/excluded/filtered/zero-test state, including environment-conditional skip. A missing runtime or host is `NO-GO`, never a passing skip.

### 3. Browser/E2E

Run every configured project explicitly, then the full command:

```powershell
npx playwright test --project=chromium
npx playwright test --project=tablet-touch
npx playwright test --project=chromium-live
npx playwright test --project=chromium-pptx-import --workers=1
npx playwright test --project=chromium-visual
$env:PLAYWRIGHT_MOBILE_CHROMIUM='1'; npx playwright test --project=mobile-chromium
npm run test:e2e
```

No snapshot update during rehearsal.

### 4. PPTX software and physical gates

```powershell
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification
npm run test:pptx:package:no-officecli
npm run test:pptx:browser-audit:full
npm run test:pptx:adversarial
npm run test:pptx:perf:full
npm run test:pptx:sla-1to1
npm run test:pptx:phase13
```

Then run selected physical gates and bind each receipt to the canonical matrix subject:

- **G0** exact package authority/original bytes and selected corpus hashes.
- **G1** direct local OfficeCLI qualification only if selected and available under earlier phases; no fake launcher receipt.
- **G2** exact physical R0→R1 edited-package seed and native re-import/collateral closure.
- **G3** build-once NSIS+portable Windows artifact smoke.
- **G4** exact selected canonical row/mutation-surface evidence.
- **G5** local Microsoft PowerPoint COM oracle from Phase 15, evaluated only as `local_powerpoint_environment`.

If the release claim requires a selected gate and that gate is unavailable, result is `NO-GO`.
The Windows host exports an immutable exact-SHA receipt whose parents are the root receipt and prebuilt-client receipt. The coordinator imports and validates it; the protected-provider evaluator remains false.

### 5. Load/performance

1. On the required Linux host, start the production-style server from the imported prebuilt client and isolated data roots.
2. Run API smoke, load, stress.
3. Run WebSocket smoke, load, stress.
4. Enforce thresholds; save k6 JSON summaries.
5. Stop server and prove no owned process remains.

### 6. Docker

1. Build the exact-SHA image by copying the verified prebuilt client; fail if any Docker layer invokes the client build.
2. Verify runtime closure inside image.
3. Start with run-owned volumes and loopback publish.
4. Smoke UI/API/vendor assets.
5. Import selected PPTX; verify exact original bytes.
6. Restart; verify presentation/package persistence.
7. Run package no-OfficeCLI gate inside artifact.
8. Record image digest, base-image digest, OS package inventory, browser/runtime inventory, inspect output, logs, and cleanup.

### 7. Electron

1. On the required Windows host, import and verify the root prebuilt-client archive, then prepare from the checked-in server lock.
2. Build NSIS and portable once with client rebuilding disabled.
3. Verify unpacked runtime closure.
4. Run Phase 15 G3 artifact smoke.
5. Record artifact hashes and runtime receipt.
6. Verify no stale/unexpected artifact in output directory and no final-byte drift after Authenticode inspection/smoke.
7. Export the Windows exact-SHA receipt containing OfficeCLI when selected, G3, G5, Authenticode, runtime closure, and local-PowerPoint claim results.

### 8. Optional desktop lanes

1. If and only if declared optional in the frozen root manifest, import the same prebuilt client on Linux and/or macOS packaging hosts.
2. Package without rebuilding client assets; record OS/toolchain/runtime closure and smoke results.
3. Export exact-SHA child receipts with root and prebuilt-client parent hashes.
4. Optional receipts never satisfy a required Linux or Windows gate and never raise the claim ceiling.

### 9. Supply-chain evidence

1. Generate SHA-256 checksums for all release subjects.
2. Generate normalized CycloneDX SBOMs for application workspaces, packaged server/runtime, each desktop package, container application layer, container/base-image OS packages, and bundled browser/Playwright runtime.
3. Run fail-closed vulnerability scans for application dependencies, desktop packages where supported, container/image OS packages, and browser/runtime versions. Record scanner version, policy, vulnerability database digest/timestamp, subject digest, and exact RC SHA.
4. Generate provenance with SHA, clean-state, commands, tool versions, inputs, outputs, parent receipt hashes, and host roles.
5. Do not claim cryptographic signing or protected provenance.
6. Validate subject hashes match checksum manifests, SBOM subjects, scan subjects, runtime receipts, and receipt-DAG parents.

### 10. Rollback and down-migration rehearsal

1. Verify previous-release binary/image checksums and provenance.
2. Start the previous release against cloned fixture data and create a full pre-upgrade snapshot of `server/data`, `server/uploads`, package blobs, settings, and schema/version metadata.
3. Upgrade the clone with the exact candidate artifacts; run migration and compatibility smoke; hash resulting state.
4. Restore the pre-upgrade snapshot and launch the exact previous binary/image. Verify data, package bytes, settings, and selected journeys.
5. On a separate copy of post-upgrade data, run the repository-owned down-migration path when schema/version changed, then launch the previous binary and verify the same invariants.
6. If no schema/data version changed, require a machine-readable no-migration receipt proving version equality; this does not replace the snapshot/previous-binary rehearsal.
7. Never run rollback/down-migration against production or the sole evidence copy.

### 11. Final evidence without edits

1. Re-run docs contract/drift checks and tracked-tree verification. Do not edit docs or changelog.
2. Import required Linux and Windows receipts and any declared optional desktop receipts.
3. Validate the receipt DAG, final evidence schema, exact inventory, all SHA bindings, and claim ceilings.
4. Apply release decision matrix.
5. Any documentation mismatch requires a new commit and complete new rehearsal.

## Refactor

- Keep rehearsal manifest declarative; no giant shell script.
- Reuse current commands rather than duplicate test logic.
- Store large raw logs separately; final manifest references hashes and paths.
- Keep each release script under 200 LOC where practical.
- Remove no failed evidence and mutate no prior receipt.

## GREEN Tests

### Ordered Rehearsal

The exact ordered release gate is:

1. pre-RC docs/changelog/version/workflow/generated-descriptor freeze and clean commit
2. root tracked-tree manifest and exact-SHA receipt
3. `npm ci`
4. `npm run release-state`
5. one client build and content-addressed archive
6. `npm run lint`
7. all Vitest shards
8. merged coverage gate
9. `npm run test`
10. verify prebuilt client; no rebuild
11. `npm run docs:build`
12. docs/contracts/generated-descriptor drift checks
13. `npm run matrix:gate`
14. `npm run test:audit`
15. `npm audit --audit-level=moderate`
16. every Playwright project
17. `npm run test:e2e`
18. strict PPTX/package-first gates
19. full PPTX browser audit and adversarial/performance gates
20. API/WS smoke/load/stress on Linux
21. Docker qualification from prebuilt client
22. Linux host receipt export
23. Electron/NSIS/portable build-once packaging from prebuilt client
24. selected Windows OfficeCLI and physical G0–G5, including dedicated local-PowerPoint claim
25. Windows host receipt export
26. declared optional Linux/macOS desktop lanes, if any
27. runtime closure for every produced subject
28. checksums; application/image/OS/browser SBOMs and vulnerability scans; provenance
29. pre-upgrade snapshot, candidate upgrade, previous-binary rollback, and applicable down-migration
30. immutable multi-host receipt-DAG import
31. docs/changelog and tracked-tree recheck without edits
32. final evidence validation

Any failure stops promotion. Diagnostics may continue in a separate failed run, but cannot turn the RC green.

## Scenario Matrix

| Domain        | Mandatory scenarios                                              |
| ------------- | ---------------------------------------------------------------- |
| Install       | Fresh lockfile install                                           |
| Unit          | Every shard + full unsharded                                     |
| Coverage      | Exact complete merge + thresholds                                |
| Build/docs    | Client and VitePress production builds                           |
| Matrix/audit  | Feature coverage, manifest completeness, UI/security audits      |
| Browser       | Chromium, touch, live, PPTX, visual, mobile, full suite          |
| PPTX importer | Exact manifest, strict pass, zero blockers/unmapped/placeholders |
| PPTX package  | Original bytes, R1, replay, native re-import, collateral closure |
| Physical      | Required G0–G5 receipts                                          |
| Adversarial   | CRC/XML/nested/external rel/macro/OLE/vector/RTL-CJK policies    |
| Performance   | Full importer matrix within budgets                              |
| Load          | API/WS smoke, load, stress thresholds                            |
| Docker        | Build, start, runtime, import, restart, persistence              |
| Electron      | NSIS, portable, install/launch/uninstall, runtime closure        |
| Multi-host    | Required Linux + Windows DAG; optional desktop child receipts    |
| Rollback      | Snapshot, upgrade, prior binary, down-migration/restore          |
| Supply chain  | Checksums, app/image/OS/browser SBOMs, scans, provenance         |
| Docs          | Frozen before RC; exact claims, commands, no rehearsal edits     |

## Regression Gates

- Zero skipped mandatory test.
- Zero todo/pending/disabled/excluded/filtered/zero-discovered mandatory test; no pass-with-no-tests behavior.
- Zero `test.only`, focused Playwright test, or quarantine marker.
- No changed visual baseline during rehearsal.
- No tracked-file mutation after RC freeze; no generated matrix/descriptor/docs diff.
- No moderate-or-higher npm audit finding.
- No untracked release subject.
- No mismatched SHA across receipts.
- No receipt-DAG gap, cycle, mixed SHA, undeclared host role, or mutated import.
- No required physical gate unavailable.
- No package rebuilt the client or consumed a different client archive.
- No process/container left running.
- No release claim above evidence ceiling.
- Protected-provider remains false; the PowerPoint result is only `local_powerpoint_environment`.
- Every release subject has exact-SHA checksums, applicable SBOMs, and vulnerability results.
- Previous-binary rollback and applicable down-migration/restore rehearsal pass.

## Release Decision Matrix

| Condition                                           | Decision                          | Action                                                                         |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| All mandatory gates pass; evidence valid            | GO                                | Approve exact SHA/artifacts for separate publish process                       |
| Software green, required physical G0–G5 unavailable | NO-GO                             | Keep claim disabled; rerun on qualified host                                   |
| Any mandatory test fails                            | NO-GO                             | Fix, commit new SHA, restart full rehearsal                                    |
| Flaky retry needed                                  | NO-GO                             | Root-cause flake; no receipt reuse                                             |
| Artifact/runtime hash mismatch                      | NO-GO                             | Delete run-owned artifact output, rebuild from clean SHA                       |
| Docs overclaim                                      | NO-GO                             | Correct docs, new SHA, full rerun                                              |
| Any tracked edit during rehearsal                   | NO-GO                             | Commit fix, cut new RC, restart from gate 1                                    |
| Package rebuilt client assets                       | NO-GO                             | Fix packaging to import root client subject; cut new RC                        |
| Receipt DAG invalid                                 | NO-GO                             | Reject imported lane; rerun exact host from root parents                       |
| Rollback/down-migration rehearsal fails             | NO-GO                             | Repair compatibility or recovery path before a new RC                          |
| Optional diagnostic fails only                      | CONDITIONAL REVIEW                | Release only if manifest marks it optional and no required claim depends on it |
| Security/audit/package safety failure               | NO-GO                             | Stop; security review before new RC                                            |
| PowerPoint SSIM/prompt/repair failure               | NO-GO for native-fidelity release | Retain lower claim only after docs and matrix are corrected on a new SHA       |

## Rollback Plan

### Before publish

- Mark RC rejected.
- Preserve failed evidence.
- Remove only run-owned containers, volumes, install paths, temp profiles, and processes.
- Do not delete source/package fixtures or historical receipts.
- Fix on a new commit; never amend evidence to point at new bytes.

### Rehearsed post-publish rollback

1. Keep previous release artifacts/checksums/provenance available.
2. Verify previous Docker digest and Electron checksums before rollback.
3. Restore the previous application artifact only after restoring the verified pre-upgrade snapshot or applying the tested down-migration to a cloned state.
4. Back up `server/data` and `server/uploads` before any version change.
5. If persistence schema is not backward-compatible, stop service and follow the rehearsed backup/restore or down-migration path; never destructively migrate the only data copy.
6. Revoke/withdraw the bad release through the actual publish process only after explicit maintainer action.
7. Record reason, affected hashes, user impact, and replacement status in changelog/advisory.

## Todos

- [ ] Add RED rehearsal/evidence tests.
- [ ] Implement declarative runner and validator.
- [ ] Freeze docs/changelog/version/workflows and exact RC SHA before rehearsal.
- [ ] Build and seal one prebuilt client subject.
- [ ] Execute every ordered gate once.
- [ ] Build and qualify Docker/Electron artifacts.
- [ ] Collect exact-SHA Linux, Windows, G0–G5, and declared optional desktop receipts.
- [ ] Validate dedicated local-PowerPoint claim; keep protected-provider false.
- [ ] Generate checksums, app/image/OS/browser SBOMs, scans, and provenance.
- [ ] Rehearse pre-upgrade snapshot, previous-binary rollback, and down-migration/restore.
- [ ] Validate final evidence.
- [ ] Apply GO/NO-GO matrix.
- [ ] Rehearse rollback.

## Success Criteria

- One clean RC SHA completes all 32 ordered gate groups.
- Every mandatory result is PASS; none skipped.
- Coverage shard inventory and merge are exact.
- All Playwright projects and full E2E pass.
- Strict PPTX, package-first, selected G0–G5, browser, adversarial, perf, and load gates pass.
- Docker, NSIS, and portable runtime closure passes.
- One client archive is reused unchanged by every package; no client rebuild occurs.
- Required Linux and Windows receipt-DAG lanes validate; any optional desktop lane is predeclared and exact-SHA bound.
- Checksums, application/image/OS/browser SBOMs, vulnerability scans, provenance, and runtime receipts agree.
- Previous-release snapshot, candidate upgrade, previous-binary rollback, and applicable down-migration/restore pass.
- Docs/changelog state only proven, environment-bounded claims.
- Docs/changelog were frozen before the RC and no tracked edit occurred during rehearsal.
- Local PowerPoint evidence passes only its dedicated claim contract; protected-provider remains false.
- Final evidence validator returns GO.

## Risks / Signals / Responses

| Risk                     | Signal                              | Response                           |
| ------------------------ | ----------------------------------- | ---------------------------------- |
| Mixed build lineage      | SHA/hash mismatch                   | Reject entire RC                   |
| Partial shard merge      | Missing shard receipt               | Fail coverage gate                 |
| Hidden skip              | skipped/only/quarantine marker      | Fail evidence validation           |
| Flaky green              | Pass only after retry               | Reject and fix flake               |
| Resource exhaustion      | Timeout/OOM/load breach             | Profile, fix, new RC               |
| Artifact drift           | Unexpected output file              | Clean run-owned output and rebuild |
| Overclaim                | Docs exceed claim evaluator         | Correct, new SHA, rerun            |
| Cleanup damage           | Non-run-owned target                | Stop cleanup; manual review        |
| Hidden package rebuild   | Client hash/tool invocation differs | Reject package; fix build graph    |
| Cross-host evidence mix  | Parent/SHA/role mismatch            | Reject receipt DAG                 |
| Stale vulnerability data | Scanner DB age/digest invalid       | Refresh in setup, restart lane     |
| Rollback incompatibility | Previous binary cannot read state   | Restore snapshot/fix migration     |

## Security

- Run on isolated local/CI roots with no production data.
- No secrets in logs, receipts, SBOM, provenance, or screenshots.
- Bind services to loopback except container-internal listener.
- Verify upload/package guards and external-network denial.
- `npm audit` failure is release-blocking at moderate level.
- No macros/OLE/ActiveX execution during PowerPoint qualification.
- Provenance is unsigned local evidence unless separately signed; never imply protected attestation.
- Cleanup targets only run-owned paths/processes/containers.
- Required host lanes use clean isolated users/VMs or ephemeral CI workers with controlled egress; Windows qualification follows Phase 15 no-secrets and loopback-only capture policy.
- Vulnerability database acquisition occurs in a declared setup step; scans record database digest/timestamp and do not silently fetch during offline qualification.
- Rollback/down-migration operates only on cloned fixture data and verified snapshots.

## Dependencies

- Every prior phase completed and merged into the exact RC SHA.
- Phase 2 release-state contract.
- Phase 3 shard/coverage merge commands.
- Phase 4 build-once/green-SHA lineage.
- Phases 7–12 package-first G0–G4 evidence.
- Phase 13 shared export parity.
- Phase 14 characterization-only decomposition after Phase 13 and before physical evidence.
- Phase 15 build-once Windows G3/G5 receipts and dedicated local-PowerPoint claim contract.
- Docker, k6, Chromium, SBOM/scanner tooling, a qualified Linux host, and a qualified isolated Windows/PowerPoint host available.

## Unresolved Questions

- None. Any unavailable mandatory environment or gate is `NO-GO`, not a waiver.
