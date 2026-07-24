---
phase: 4
title: "PowerPoint Visual Oracle and P0 Release Gate"
status: blocked
priority: P1
effort: "3-5 days plus controlled local PowerPoint rendering"
dependencies: [2, 3]
---

# Phase 4: PowerPoint Visual Oracle and P0 Release Gate

## Overview

Replace placeholders and first-slide self-snapshots with exact-corpus, package-backed, all-slide Microsoft PowerPoint comparison under the active local evidence authority. Missing evidence blocks this phase; below-threshold numeric evidence blocks the visual claim but does not force native fidelity fixes into P0.

## Status — Blocked on Physical Evidence (2026-07-24)

The oracle's software contracts are implemented, including Phase 3 authority repairs with focused regression evidence (2026-07-24): sanitized server `409` reconciliation `reasonCode` propagates through job-lifecycle timeout errors and package-backed capture cleanup reports; missing-head rollback no-ops require matching job/presentation identity. Earlier focused authority/oracle suite: 21 files / 142 passed / 1 skipped, plus isolated Node loopback capture. Remaining gate is physical evidence only: no trusted controlled Microsoft PowerPoint golden bundle, matching local evidence envelope, three matching role receipts, package-backed actual manifest, or signed numeric comparison result is available. Integrity and qualification therefore remain blocked and no numerical visual-fidelity or 1:1 claim is recorded.

**Cook re-verify 2026-07-24:** independent tester re-ran Phase 4 oracle software contracts green; integrity without evidence stays structured-blocked (`missing-evidence-manifest`). Runbook capture command corrected to drop forbidden `--actual-manifest-out` (published run dir writes `actual-manifest.json`). Still no physical PowerPoint evidence — phase remains blocked.

<!-- Updated: Red Team Review 1 + Validation Session 1 - local evidence authority, package-backed actuals, slide identity and finite policy -->

## Context Links

- Fresh failure: `../reports/pptx-oracle-runs/pptx-oracle-2026-07-22T08-59-44-928Z.json`.
- Current placeholder rejection: `server/services/pptx-import/oracle/compare-goldens.js:53-73`.
- Current direct-import bypass: `server/services/pptx-import/oracle/pptx-oracle-cli.js:132-157`.
- Current repeated-slide risk: `server/services/pptx-import/oracle/capture-present.js:59-73`.
- Current null policy/off bypass: `server/services/pptx-import/oracle/pptx-oracle-cli.js:25-46`, `server/services/pptx-import/oracle/pptx-oracle-cli.js:235-245`.
- Existing final visual policy: `server/services/pptx-import/sla-contract.js:89-109` (mean 0.99, minimum 0.97).
- Active broad-plan authority: local PowerPoint oracle with environment-bounded wording and three one-owner role receipts (`../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md:58-72`, `:878-880`).

## Requirements

### Functional

- Delete repository 8×8 placeholders from evidence eligibility.
- Use Phase 2's exact 11-deck qualification manifest; visual runs reject missing/extra/hash-drift/duplicate corpus decks.
- Every external golden bundle records:
  - exact source filename, SHA-256 and byte length;
  - renderer `Microsoft PowerPoint`, Office version/build and Windows identity digests;
  - font-set, locale, DPI/scale, viewport, pixel dimensions, crop/letterbox and resampling policy digests;
  - source slide count measured from the OOXML slide list;
  - contiguous `slide-0.png` … `slide-N.png` entries;
  - per-image SHA-256, byte length and dimensions.
- An active local evidence envelope binds corpus, golden manifest, application artifacts, environment, threshold policy and result artifacts.
- Three distinct App/Storage, Security and Release role receipts bind the same subject/result under the existing one-owner local policy.
- Evidence without the local envelope/receipts is diagnostic only and cannot satisfy P0 integrity.
- Actual capture must use HTTP import job → package commit → authoritative GET, not direct `importPptxFile()`.
- Report binds `presentationId`, package revision/head, aggregate generation, source/R0 hash and actual PNG hashes; cleanup deletes that ID afterward.
- Capture navigates every slide by Reveal API/index, selects only the active slide, and asserts expected index before screenshot.
- Exact source/golden/actual slide counts and indexes must match.
- Add non-skippable integrity and qualification modes:
  - integrity rejects off/debt/null/untrusted/incomplete evidence and requires finite all-slide scores;
  - qualification additionally enforces existing `phase08_full` mean `>=0.99` and every-slide `>=0.97`.
- Rename/repurpose the one-slide Playwright spec as editor visual regression; it must not claim source visual fidelity.

### Non-functional

- Goldens are produced outside NavSlides by controlled local PowerPoint operation.
- Evidence remains environment-bounded/local; it does not establish public independent attestation or universal compatibility.
- LibreOffice may generate a separate diagnostic report only.
- No full PNG bundle is committed by default; exact hashes and bounded metadata may be committed/reviewed.
- No absolute local path, username, machine ID, secret or private key appears in committed data.
- Threshold policy is pre-existing and cannot be derived/overridden from candidate scores.

## Architecture

### Evidence layers

```text
external controlled bundle
  golden-manifest.json
  goldens/<deck>/slide-N.png

local authority records
  local-evidence-manifest.json
  three role receipts bound to subject/result

repository
  exact corpus manifest
  validators + fixed phase08_full threshold identity
  no eligible placeholder PNGs
```

The local evidence subject binds exact corpus hash, PowerPoint environment digests, application artifact hashes, configuration/capture policy, thresholds and output hashes. It reuses `local-evidence-contract.js`, `local-evidence-validator.js` and `local-role-receipts.js`; it does not resurrect historical protected-provider/KMS requirements.

### Actual capture flow

```text
start isolated loopback server with temporary data/uploads
  -> POST /api/pptx/import
  -> poll /jobs/:id to terminal presentationId
  -> authoritative GET /presentations/:id
  -> GET pptx-original; verify source/R0 hash
  -> capture all presentation slides by Reveal.slide(index)
  -> record ID/revision/generation/hash/actuals
  -> DELETE imported presentation in finally
```

Claim-capable CLI requires package-backed base URL/isolated runner. Modify `startServer(port)` to use `port ?? PORT` so integration tests can safely request ephemeral port `0`.

### Gate semantics

- `test:pptx:oracle:integrity`: trusted physical evidence exists, every slide compared, all scores finite; returns zero regardless whether scores meet claim policy and records verdict.
- `test:pptx:oracle:qualify`: same integrity plus mean 0.99/min 0.97; returns non-zero when below policy.
- Missing/untrusted evidence means Phase 4 remains open.
- A trusted numeric below-policy report closes this P0 evidence-remediation phase but leaves PowerPoint visual claim and broad-plan `G5` open.
- The broader 1:1 composite remains owned by the blocked package-first plan.

## File Inventory

| Action | File | Rough change | Test impact |
| --- | --- | --- | --- |
| Create | `server/services/pptx-import/oracle/golden-evidence.js` | M, <200 LOC | Golden manifest/source/hash/count validation |
| Create | `server/services/pptx-import/oracle/golden-evidence.test.js` | L; split if >200 LOC | Tamper/provenance/inventory cases |
| Create | `server/services/pptx-import/oracle/package-backed-actuals.js` | M, <200 LOC | HTTP import/read/hash/cleanup client |
| Create | `server/services/pptx-import/oracle/package-backed-actuals.test.js` | L; split if >200 LOC | Package identity and cleanup |
| Modify | `server/services/pptx-import/oracle/compare-goldens.js` | M | Exact contiguous source/golden/actual match |
| Modify | `server/services/pptx-import/oracle/compare-goldens.test.js` | L | Gap/extra/count/tamper/low-score cases |
| Modify | `server/services/pptx-import/oracle/capture-present.js` | M | Reveal index navigation + active slide only |
| Modify | `server/services/pptx-import/oracle/capture-present.test.js` | M | Three visually distinct slide identities |
| Modify | `server/services/pptx-import/oracle/pptx-oracle-cli.js` | M; extract to keep <200 LOC | Integrity/qualification modes and reports |
| Modify | `server/services/pptx-import/oracle/pptx-oracle-cli.test.js` | L | Off/null/debt/ad-hoc threshold rejection |
| Modify | `server/index.js` | XS | Permit `startServer(0)` via nullish fallback |
| Verify | `server/services/pptx-import/evidence/local-evidence-contract.js` | Existing authority | Bind safe local subject/artifacts |
| Verify | `server/services/pptx-import/evidence/local-evidence-validator.js` | Existing authority | Environment-bounded validation |
| Verify | `server/services/pptx-import/evidence/local-role-receipts.js` | Existing authority | Three distinct role receipts |
| Rename | `tests/e2e/pptx-import-visual-fidelity.spec.js` → `tests/e2e/pptx-import-editor-visual-regression.spec.js` | M | Remove source-fidelity wording; real imported ID |
| Rename/delete | `tests/e2e/pptx-import-visual-fidelity.spec.js-snapshots/*` | Generated | Preserve only editor-regression snapshots |
| Delete | `server/services/pptx-import/oracle/goldens/*/slide-0.png` | 11 placeholders | No repository placeholder evidence |
| Invalidate then regenerate | `server/services/pptx-import/oracle/baseline-ssim.json` | Generated after trusted run only | Bind evidence/policy digest |
| Modify | `package.json` | S | Add integrity/qualification commands |
| Create | `docs/pptx-visual-evidence-runbook.md` | M | Controlled local PowerPoint procedure |
| Modify | `docs/pptx-import-fidelity-report.md` | S | Current numeric result and boundary |
| Modify narrowly | `docs/export-fidelity-and-limits.md` | S | Keep visual/1:1 claim unavailable unless qualified |

## Function and Interface Checklist

- [x] `validateGoldenEvidence()` accepts plain data, relative paths and finite safe counts/dimensions only.
- [x] Source hash/count comes from exact package and matches Phase 2 corpus manifest.
- [x] Per-image hashes are checked before PNG decode/SSIM.
- [x] Slide inventory rejects gaps, duplicates, unexpected names, extras and source-count mismatch.
- [x] Local evidence manifest/three receipts bind exact subject, outputs and fixed thresholds.
- [x] `capturePackageBackedActuals()` uses POST/poll/GET/original/DELETE and records ID/revision/generation/R0 hash.
- [x] No claim/integrity path calls `importPptxFile()` directly.
- [x] `capturePresentSlides()` calls Reveal slide API, waits for expected index/current slide and screenshots only active slide.
- [x] Three-slide test proves red/green/blue or equivalent distinct content/pixels/hashes in order.
- [x] `compareDeck()` requires exact expected/golden/actual counts and finite per-slide scores.
- [x] Integrity rejects `PPTX_ORACLE=off`, debt mode, null policy, untrusted role receipts and missing actuals.
- [x] Qualification uses only `phase08_full` 0.99/0.97; no CLI score override.
- [x] Report includes evidence subject/digest, package identities, per-slide scores and separate integrity/claim verdicts.

## Dependency Map

```text
Phase 2 exact corpus --------> source/golden manifest
Phase 3 package journey -----> HTTP actual capture identity
local G5 contract -----------> environment/role receipts
PowerPoint goldens ----------> exact all-slide comparison
fixed phase08 policy --------> claim verdict
trusted numeric report ------> P0 remediation complete
claim pass ------------------> broad G5 may eventually close
```

## Tests Before

1. Missing/malformed golden manifest fails integrity.
2. Source hash, source slide count or PNG hash drift fails before SSIM.
3. Missing/duplicate/extra/gapped slide index fails.
4. Actual count mismatch fails.
5. Placeholder image fails even if listed.
6. Missing/invalid/mixed role receipts fail integrity.
7. Diagnostic/LibreOffice evidence cannot satisfy PowerPoint mode.
8. Direct-import actual lacking ID/revision/generation/R0 fails.
9. Two- and three-slide captures prove unique ordered slide identity; current code fails with repeated slide 0.
10. `PPTX_ORACLE=off`, debt mode, null thresholds and ad-hoc override fail integrity/qualification.
11. Complete low-SSIM evidence passes integrity but fails qualification.
12. Exact 0.99 mean/0.97 minimum boundary cases are deterministic.

## Refactor

1. Add pure golden/source/inventory validator.
2. Add package-backed HTTP actual client with `finally` cleanup.
3. Allow ephemeral server port for tests.
4. Replace keyboard navigation/union selector with exact Reveal index/current-slide capture.
5. Tighten comparison count/hash/finite-score logic.
6. Reuse active local evidence/receipt contracts.
7. Split CLI into diagnostic, integrity and qualification behavior without growing one file beyond 200 LOC.
8. Rename the old visual snapshot lane as editor regression.
9. Delete placeholder evidence and invalidate old baseline.
10. Document controlled PowerPoint export/normalization/receipt procedure.
11. Produce/review external goldens and run package-backed actual capture.
12. Record numeric integrity and qualification verdicts; never tune threshold from result.

## Tests After

- Any corpus/source/golden/actual byte or count drift fails before claim evaluation.
- Every slide is captured exactly once at the expected Reveal index.
- Every claim-capable actual has package identity and immutable source evidence.
- Only trusted local PowerPoint evidence can pass integrity.
- Integrity always yields finite all-slide data.
- Qualification applies fixed finite thresholds and cannot be disabled.
- Below-policy result remains honest and does not promote PowerPoint/1:1 wording.

## Test Scenario Matrix

| Priority | Scenario | Expected |
| --- | --- | --- |
| Critical | Placeholder/missing physical evidence | Integrity fail; Phase 4 open |
| Critical | Self-snapshot relabeled PowerPoint without receipts | Integrity fail |
| Critical | Direct importer actual | Missing package identity; fail |
| Critical | Repeated slide 0 capture | Identity/pixel test fail |
| Critical | Complete trusted all-slide evidence | Finite numeric integrity result |
| Critical | Mean/min below 0.99/0.97 | Integrity pass, qualification non-zero |
| Critical | Mean/min meet policy | Integrity and qualification pass |
| High | Source/PNG hash drift | Fail before SSIM |
| High | Missing/extra/gapped slide | Exact inventory fail |
| High | `off`/debt/null/ad-hoc threshold | Non-skippable gate fail |
| Medium | LibreOffice diagnostic | Separate non-authoritative report |

## Implementation Steps

1. Write golden/local evidence red tests.
2. Write package-backed actual client/tests.
3. Fix slide navigation/identity tests.
4. Add exact compare and gate modes.
5. Rename misleading Playwright lane.
6. Delete placeholders and invalidate old baseline.
7. Write local PowerPoint evidence runbook.
8. Produce exact-corpus renders and role receipts outside NavSlides.
9. Capture package-backed actuals.
10. Run integrity; require trusted finite report.
11. Run qualification; preserve pass or below-policy result.
12. Update fidelity/limits docs narrowly.

## Todo

- [x] Validate exact golden/source inventories.
- [x] Implement and test actual capture through package authority.
- [x] Reconfirm claim-capable capture contracts after focused regression evidence for Phase 3 reconciliation `reasonCode` and rollback no-op identity repairs (software path; physical PowerPoint evidence still open).
- [x] Prove slide identity with three distinct slides.
- [x] Implement the active local evidence-manifest and three-receipt binding.
- [x] Add non-skippable integrity/qualification modes.
- [x] Rename first-slide self-regression lane.
- [x] Remove placeholder evidence.
- [ ] Produce controlled PowerPoint goldens.
- [ ] Run and record numeric gate results from trusted physical evidence.

## Success Criteria

- [x] No placeholder or direct-import actual can pass integrity.
- [ ] All 11 exact corpus decks have controlled PowerPoint provenance and complete contiguous slides.
- [x] The package-backed capture contract binds ID/revision/generation/R0 hash and cleanup; its isolated loopback test passes.
- [x] The capture contract proves the expected Reveal slide identity with distinct-slide coverage.
- [ ] A local evidence envelope and role receipts must validate against trusted physical evidence with the documented environment-bounded limitations.
- [ ] An integrity report with finite per-slide, deck, and corpus values is not yet available.
- [x] Qualification enforces 0.99 mean and 0.97 minimum without bypass.
- [x] Missing/untrusted or below-policy evidence cannot promote visual/1:1 claims or broad `G5`.

## Regression Gate

```bash
npx vitest run server/services/pptx-import/oracle/golden-evidence.test.js server/services/pptx-import/oracle/package-backed-actuals.test.js server/services/pptx-import/oracle/compare-goldens.test.js server/services/pptx-import/oracle/capture-present.test.js server/services/pptx-import/oracle/pptx-oracle-cli.test.js server/services/pptx-import/evidence/local-evidence-contract.test.js server/services/pptx-import/evidence/local-role-receipts.test.js
npx playwright test --workers=1 tests/e2e/pptx-import-editor-visual-regression.spec.js
npm run test:pptx:browser-audit:full
npm run test:pptx:oracle:integrity -- --evidence-manifest <local-manifest> --role-receipts <receipts>
npm run test:pptx:oracle:qualify -- --evidence-manifest <local-manifest> --role-receipts <receipts>
```

The last command is a truth gate and may remain non-zero for below-policy visuals. The software contracts pass; integrity and qualification require a trusted local evidence manifest and receipts, so absent physical PowerPoint evidence remains a structured blocked result rather than green evidence. `test:pptx:sla-1to1` remains the broad plan's composite gate, not a P0 completion shortcut.

## Risk Assessment

- **Self-attestation confusion:** active local authority is explicitly environment-bounded; no public/independent claim.
- **Repository bloat:** external PNG bundle by default; commit hashes/metadata only.
- **Capture repeats slides/fragments:** direct Reveal index/current-slide assertion, not ArrowRight.
- **Package bypass:** HTTP terminal import and authoritative read are mandatory.
- **Threshold laundering:** fixed existing 0.99/0.97 policy; no candidate-derived override.
- **Environment drift:** bind Office/Windows/fonts/locale/DPI/capture policy digests.
- **Dirty docs:** reread and narrow-edit only.

## Rollback

Oracle validators, package client and renamed editor-regression lane can revert independently. Never restore placeholders as eligible evidence. If physical evidence is unavailable, leave Phase 4 open and all PowerPoint-specific claims unavailable.
