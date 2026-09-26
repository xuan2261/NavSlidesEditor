---
phase: 10
title: 'Physical edited-package seed and G2 closure'
description: 'Establish the canonical physical native-editability manifest and qualify one real single-plain-run R0/R1 pair through public import, edit, asynchronous edited export, restart, replay, deletion, and re-import without making a Level-4 editability claim.'
status: pending
priority: P0
effort: '2-3 weeks'
issue: null
branch: master
dependencies: [8, 9]
gates: [G2]
tags: [pptx, integration, physical-evidence, api, restart, idempotency, tdd]
created: 2026-09-25
---

# Phase 10: Physical Edited-Package Seed and G2

## Context

- Phase 9 makes the transaction/job pipeline production-capable but does not prove a physical edited package.
- Existing `critical-pptx-journey.spec.js` uses a large corpus deck and accepts unavailable edited export. That is useful regression coverage, not a G2 qualification.
- Existing materialization tests use synthetic ZIPs and injected validators. They cannot close G2.
- G2 means claim level 3: a valid edited package was produced from an immutable source package through the production public route and all required validators.
- The seed row remains `primitive.text.run.plain-replacement` with `level4Promoted: false`.

## Goal

Check in one minimal, real, plain-text, single-run `.pptx` and prove this physical sequence:

```text
public upload/import
  -> authoritative R0 + source map
  -> public GET
  -> public PUT one exact text-run edit
  -> public async edited-export job
  -> physical R1 download
  -> process restart
  -> same-key retry/replay returns same R1
  -> permanent delete
  -> re-import downloaded R1 as a new presentation
  -> edited text and exact new immutable original survive
```

## Scope

- Minimal checked-in binary fixture with independent SHA-256 manifest.
- One slide, one ordinary text shape, one paragraph, one run, no theme-dependent field, macro, external relation, image, chart, notes, animation, or extension.
- Real public Express routes and production importer/package store.
- Real direct qualified OfficeCLI from Phase 8.
- Real strict native re-import and Phase 9 collateral checks.
- Actual server/package-store shutdown and restart against a temporary data root.
- Durable same-key replay, no duplicate successor.
- Permanent-delete lifecycle and re-import of the exported R1.
- Machine-readable G2 receipt bound to fixture, R0, R1, matrix, OfficeCLI, native receipt, and commands.
- Canonical physical native-editability manifest/schema/loader later consumed unchanged by primitive and chart promotion gates.
- Checked-in positive R0, checked-in expected R1, boundary-negative physical fixtures, exact native IDs/parts/relationships, hashes, and property-specific PowerPoint expected-evidence contract for the seed row.

## Non-goals

- No browser visual fidelity threshold.
- No PowerPoint oracle or G5 claim.
- No Windows artifact/G3 claim.
- No Level-4 claim for text editing.
- No broad corpus or multiple text variants.
- No synthetic validator, fake OfficeCLI, mocked route, or in-memory-only package.
- No generation of the fixture during qualification.

## Key Insights

1. A fixture generated inside the test proves the generator, not a checked-in physical input.
2. A skipped test cannot close a release gate. Missing OfficeCLI/config/platform exits blocked and non-zero.
3. The public route must be the qualification boundary; direct service calls are supporting tests only.
4. Restart replay must prove identical revision ID and SHA-256, not merely equivalent bytes.
5. Delete/recreate should use exported R1 as the new import input. This proves the product can consume its physical output.
6. G2 validates one edited package. It does not prove the UI mutation is generally reliable enough for G4.
7. A matrix row name or generated-in-test ZIP is not physical evidence. Every manifest path must resolve to a tracked file and every declared hash/native locator must be verified before a row can be considered promotable.

## Requirements

### Fixture

- `server/data/test-corpus/native-editability/native-editability-manifest.json` is the single canonical physical manifest. Per-fixture sidecar manifests may exist only as generated/read-only projections of this authority.
- The canonical manifest is schema-versioned and records, for each row:
  - exact `rowId`, promotion state, positive R0 path, expected R1 path, byte length, SHA-256, and fixed requested mutation;
  - every required boundary-negative fixture path/hash and the exact reason code it must produce;
  - exact slide part, native object ID/name/type, paragraph/run or property locator, dependent part URIs, relationship IDs/types/targets, content types, and exclusive/shared ownership expectation;
  - expected R0 and R1 hashes plus allowed changed-part/relationship closure;
  - a tracked PowerPoint expected-evidence JSON path describing object selection, editable property/action, save/reopen observation, expected unchanged properties, and whether observed G5 evidence is required for the current gate;
  - matrix/reason-code subject fields completed by the qualification receipt.
- For this phase the plain-text row remains `promotionState: "candidate"` and `level4Promoted: false`, but its complete physical mapping is present.
- Manifest loading rejects missing/untracked/unreadable paths, directories, symlinks/reparse escapes, duplicate paths, zero-byte files, hash/length mismatches, unresolved native locators, or a boundary-negative list with no physical file.
- Fixture integrity tests validate central directory, CRC, OPC relationships, exact declared native identities, and manifest hashes before any qualification.
- A deterministic fixture-authoring script may be retained for maintainers, but the gate reads the checked-in bytes only.

### Physical run

- Use temporary `SLIDES_DATA_DIR` and `SLIDES_UPLOADS_DIR`.
- Start the actual Express server on loopback and a random port.
- Import through `POST /api/pptx/import`; poll durable status with capability header.
- Read presentation through `GET /api/presentations/:id`; assert package-backed generation and one authoritative source.
- Save only the text content through `PUT /api/presentations/:id` with generation/base revision/idempotency envelope.
- Create export through `POST /api/presentations/:id/pptx-edited-exports`; poll and download through public job routes.
- Assert physical R1 is ZIP/OPC-valid, differs from R0, changes only declared parts, and contains edited text.
- Assert physical R1 byte-for-byte matches the checked-in expected-R1 SHA-256 in the canonical manifest; if deterministic byte equality is intentionally impossible, the row cannot use this gate until a reviewed canonical repack rule and replacement hash are added to the manifest.
- Stop and restart the actual server using the same temporary data roots.
- Retry the same export request/key; assert same job, revision, generation, and package SHA-256; revision count remains two.
- Permanently delete the first presentation and verify it is not listable/openable.
- Re-import R1 through the public import route as a new presentation; assert edited text and immutable-original hash equal R1.
- Clean up the recreated presentation through public lifecycle routes.

### Claim discipline

- Receipt says `claimLevel: 3`, `gate: G2`, `rowId`, and `level4Promoted: false`.
- Receipt binds the canonical manifest schema/version/hash and exact row entry hash.
- Matrix row remains non-Level-4 after this phase.
- No wording such as “editable text fidelity” or “PowerPoint-compatible” is emitted.
- A failed, skipped, stale, or partially mocked run cannot produce a passing receipt.

## Architecture and Data Flow

### Qualification driver

`scripts/pptx-g2-physical-qualification.js` owns the run:

1. Verify fixture manifest and required physical prerequisites.
2. Create isolated data/uploads/evidence directories.
3. Spawn real server with exact OfficeCLI configuration and loopback binding.
4. Drive public HTTP routes only.
5. Persist bounded private run artifacts under an ignored operator-selected directory.
6. Hash/redact into a tracked-style receipt output path supplied by the caller.
7. Restart the server process, then continue replay/delete/re-import.
8. Exit `0` only after every assertion and cleanup succeeds.

The driver must fail before server start when any canonical manifest path is unresolved. It may not synthesize, download, copy from a temporary directory, or rewrite R0/R1/negative fixture bytes during qualification.

### Evidence subject

Receipt subject includes:

- fixture SHA-256;
- canonical native-editability manifest schema/version/hash and row-entry hash;
- R0 revision ID/SHA-256/generation;
- canonical matrix schema/version/hash/epoch;
- reason-code subject;
- OfficeCLI binary/version/policy receipt digest from Phase 8;
- mutation journal hash and compiled plan hash;
- R1 revision ID/SHA-256/generation;
- expected checked-in R1 path/hash match;
- exact native object/part/relationship locator digest;
- boundary-negative fixture set digest;
- PowerPoint expected-evidence contract digest and explicit `observedPowerPointEvidenceRequired: false`;
- native full-comparison receipt hash;
- impact/collateral receipt hash;
- server runtime/version/commit SHA;
- command and run ID.

Private paths, package contents, text beyond fixed fixture literals, and capabilities are excluded.

## Absolute File Inventory

### Modify

| Absolute path                                                                               | Change                                                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\package.json`                                                      | Add `test:pptx:g2:physical` and fixture-integrity commands.                      |
| `C:\Work\NavSlidesEditor\tests\e2e\helpers\pptx-import-api-helper.js`                       | Reusable capability-header import polling if needed; no qualification shortcuts. |
| `C:\Work\NavSlidesEditor\tests\e2e\critical-pptx-journey.spec.js`                           | Keep broad journey honest; do not let unavailable export count as G2.            |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\evidence\release-claim-policy.js`      | Accept G2 only from exact physical receipt subject.                              |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\evidence\release-claim-policy.test.js` | Reject synthetic/skipped/stale/Level-4-overstated receipts.                      |

### Create

| Absolute path                                                                                                                          | Purpose                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\native-editability-manifest.json`                                  | Canonical row-to-physical-file/native-identity/R0-R1/PowerPoint-expectation authority.           |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\native-editability-manifest.schema.json`                           | Closed schema; rejects unresolved paths and incomplete row evidence.                             |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-text-plain-replacement\positive-r0.pptx`                 | Real checked-in single-run seed package.                                                         |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-text-plain-replacement\expected-r1.pptx`                 | Checked-in exact edited successor expected from the fixed mutation.                              |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-text-plain-replacement\negative-multi-run.pptx`          | Physical multi-run boundary negative.                                                            |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-text-plain-replacement\negative-field-or-hyperlink.pptx` | Physical field/hyperlink boundary negative.                                                      |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-text-plain-replacement\powerpoint-expected.json`         | Tracked expected select/edit/save/reopen evidence contract; not an observed G5 claim.            |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-editability-manifest.js`                                                   | Strict canonical manifest loader, path containment/hash/identity resolver, and row evidence API. |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-editability-manifest.test.js`                                              | Missing file, hash, native ID, relationship, negative coverage, and promotion-state tests.       |
| `C:\Work\NavSlidesEditor\scripts\pptx-g2-fixture-integrity.js`                                                                         | Hash/CRC/OPC/source-shape verifier.                                                              |
| `C:\Work\NavSlidesEditor\scripts\pptx-g2-fixture-integrity.test.js`                                                                    | Manifest tamper and fixture-shape tests.                                                         |
| `C:\Work\NavSlidesEditor\scripts\pptx-g2-physical-qualification.js`                                                                    | Public-route/restart/delete/re-import qualification driver.                                      |
| `C:\Work\NavSlidesEditor\scripts\pptx-g2-physical-qualification.test.js`                                                               | Driver contract tests using controlled child-process boundaries, not claim success.              |
| `C:\Work\NavSlidesEditor\tests\e2e\pptx-g2-public-route.spec.js`                                                                       | Public-route characterization against a running qualified environment.                           |

### Delete

- None.

## RED Tests

1. Fixture bytes differ from manifest hash.
2. Fixture contains two runs, a field, external relationship, macro, chart, image, or unsupported object.
3. Qualification environment lacks direct qualified OfficeCLI; command exits non-zero with blocked receipt.
4. Import uses a service call instead of the public multipart route.
5. Source map is missing/diagnostic/ambiguous for the only text object.
6. PUT changes title, geometry, formatting, structure, or another property with text.
7. Export endpoint returns bytes synchronously instead of durable job identity.
8. R1 changes an undeclared part or fails strict re-import.
9. Restart retry creates R2, a new job, or a different SHA.
10. Retry key with changed generation/request is incorrectly accepted.
11. Permanent delete leaves a live head/owner or makes old presentation listable.
12. Re-imported R1 loses the edited literal or immutable-original hash.
13. Receipt claims Level 4/G4 or lacks exact evidence bindings.
14. Canonical manifest points to a missing/generated/temp file, wrong hash, wrong native ID, wrong part, wrong relationship target/type, or absent PowerPoint expectation.
15. Expected R1 file is absent or the downloaded R1 hash differs from the manifest.
16. Any boundary-negative physical fixture is accepted as the positive row or returns a different/unregistered reason.

## Implementation Steps

1. Define the closed canonical manifest schema and strict loader first.
2. Author positive R0, expected R1, multi-run negative, and field/hyperlink negative once with PowerPoint/standards-compliant OOXML; inspect and freeze every hash/native locator.
3. Add the tracked PowerPoint expected-evidence contract for the exact plain-text property while explicitly recording that G2 does not require observed PowerPoint evidence.
4. Add fixture integrity verifier. Ensure qualification never rewrites fixture bytes.
5. Add release-claim policy RED tests for exact physical G2 receipt and Level-4 prohibition.
6. Implement qualification driver preflight: platform, server runtime, canonical manifest/path/hash/native-locator integrity, Phase 8 OfficeCLI qualification.
7. Add isolated server spawn/stop helpers with random loopback port and temporary data/upload roots.
8. Implement public import/poll and assert durable R0 authority.
9. Locate the fixed shape by manifest part/name/native identity and submit one plain-text edit through public PUT.
10. Create/poll/download the Phase 9 async export job; verify all terminal headers/receipt hashes and exact expected-R1 hash.
11. Stop server cleanly, restart against same roots, and repeat same-key request.
12. Inspect package store through safe test-only offline verifier after shutdown; assert no R2 and one terminal job outcome.
13. Permanently delete first presentation through API; verify compatibility and package authority removal.
14. Re-import downloaded R1; assert edited text and original hash; delete recreated deck.
15. Run every physical boundary-negative through import/save/export and assert the manifest reason code and no successor.
16. Emit bounded evidence receipt only after cleanup and all checks pass.
17. Run the same driver twice to prove fixture/run determinism while run IDs remain unique.

## Refactor

- Reuse import polling and server lifecycle helpers; do not duplicate production importer/export logic.
- Keep qualification assertions in the script, not production routes.
- Keep private bytes/logs out of tracked reports.
- Make the broad existing E2E test a regression lane; only the dedicated command can close G2.
- Keep fixture manifest literals minimal so tests do not depend on unstable mapper ordering.

## GREEN Tests

- Fixture hash/CRC/OPC contract passes.
- Canonical manifest resolves every declared physical file and exact native ID/part/relationship; expected R1 and negative fixtures are immutable and hash-verified.
- Public import produces one R0 and authoritative source entry.
- Public save creates one pending journal with exact row.
- Async export produces one physical R1 through all Phase 9 validators.
- Restart replay returns identical job/revision/SHA and no R2.
- Permanent delete releases live presentation authority safely.
- Public re-import of R1 produces a new presentation containing edited text.
- G2 receipt validates at claim level 3 and is rejected if relabelled Level 4.

## Scenario Matrix

| Scenario                           | Expected                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Clean qualified Windows host       | Full sequence passes; G2 receipt emitted.                                    |
| OfficeCLI missing/hash mismatch    | Blocked non-zero; no claim.                                                  |
| Fixture hash mismatch              | Stop before server start.                                                    |
| Import source ambiguous            | Stop before edit/export.                                                     |
| Extra mutation in PUT              | 422; R0 remains current.                                                     |
| Export validator failure           | Terminal failed job; no R1.                                                  |
| Crash/restart before commit        | Same job resumes/fails retry-safe; no mixed head.                            |
| Restart after commit               | Replay same R1.                                                              |
| Same key, changed request          | 409 idempotency conflict.                                                    |
| Delete cleanup temporarily blocked | Typed retryable failure; do not re-import until reconciled.                  |
| Re-import R1                       | New deck, edited literal present, original hash equals R1.                   |
| Attempted G4 label                 | Receipt-policy rejection.                                                    |
| Missing physical manifest file     | Preflight non-zero; `PHYSICAL_EVIDENCE_FILE_MISSING`; no server start/claim. |
| Native locator/relationship drift  | Preflight non-zero; `PHYSICAL_EVIDENCE_IDENTITY_MISMATCH`.                   |
| Expected R1 hash mismatch          | Qualification fails; no G2 receipt.                                          |
| Boundary-negative accepted         | Qualification fails; row remains candidate.                                  |

## Exact Failure Responses

| Failure                                   | Command/API outcome                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Missing/unreadable/untracked fixture path | Driver exits non-zero with blocked receipt `PHYSICAL_EVIDENCE_FILE_MISSING`; no row claim.                                        |
| Hash/length mismatch                      | Driver exits non-zero with `PHYSICAL_EVIDENCE_HASH_MISMATCH`.                                                                     |
| Native ID/part/relationship mismatch      | Driver exits non-zero with `PHYSICAL_EVIDENCE_IDENTITY_MISMATCH`.                                                                 |
| Expected R1 mismatch                      | Export job may be `completed`, but qualification exits non-zero with `PHYSICAL_R1_HASH_MISMATCH`; release policy rejects receipt. |
| Negative fixture wrongly allowed          | Save/export must fail with its declared row reason; otherwise qualifier exits non-zero with `BOUNDARY_NEGATIVE_ACCEPTED`.         |
| PowerPoint expectation absent             | Manifest invalid with `POWERPOINT_EXPECTATION_MISSING`; this is not an observed G5 result.                                        |

## Regression Commands

```powershell
npx vitest run scripts/pptx-g2-fixture-integrity.test.js scripts/pptx-g2-physical-qualification.test.js
npx vitest run server/services/pptx-import/native-editability-manifest.test.js
node scripts/pptx-g2-fixture-integrity.js --manifest server/data/test-corpus/native-editability/native-editability-manifest.json --row primitive.text.run.plain-replacement
npm run test:pptx:g2:physical
npx vitest run server/services/validated-edited-export-materialization.test.js server/routes/pptx-edited-export-job.test.js server/services/pptx-import/native-reimport-comparator.test.js
npx vitest run server/services/pptx-import/evidence/release-claim-policy.test.js
npx playwright test tests/e2e/pptx-g2-public-route.spec.js --project=chromium --workers=1
npm run test:pptx:importer-qualification
npm run test:pptx:package:no-officecli
npm run lint
npm run test
npm run build
```

The physical command must not convert unavailable prerequisites into a skip.

## Todos

- [ ] Check in and hash the real seed fixture.
- [ ] Check in expected R1, boundary-negative files, and PowerPoint expected-evidence contract.
- [ ] Create canonical physical manifest/schema/strict loader.
- [ ] Implement fixture integrity gate.
- [ ] Implement public-route physical qualification driver.
- [ ] Prove restart same-key replay and no R2.
- [ ] Prove permanent delete and R1 re-import.
- [ ] Add exact G2 receipt policy.
- [ ] Assert matrix row remains `level4Promoted: false`.
- [ ] Run focused and full regressions.

## Success Criteria

- [ ] One real checked-in PPTX completes import-edit-export-restart-retry-delete/re-import through public production routes.
- [ ] Canonical manifest resolves positive R0, expected R1, every boundary-negative, exact native IDs/parts/relationships, and PowerPoint expectation before the run.
- [ ] R0 remains byte-identical and recoverable.
- [ ] Exactly one R1 is published and replayed by identity/hash.
- [ ] All Phase 9 validation receipts bind to R1.
- [ ] Delete/recreate leaves no crossed presentation/job/owner identity.
- [ ] Release policy accepts exact G2 claim level 3 only.
- [ ] No Level-4, G4, G5, PowerPoint, or broad text-editability claim is made.

## Risks, Signals, Responses

| Risk                                     | Signal                                    | Response                                                                    |
| ---------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Fixture accidentally tests complex text  | Multiple `<a:r>`/field nodes              | Integrity gate rejects fixture.                                             |
| Environment-dependent pass               | Different binary/policy receipt           | Bind receipt; stale/mismatch blocks.                                        |
| Retry silently creates successor         | Revision count/generation increases       | Hard fail and preserve evidence.                                            |
| Delete race hides leaked owner           | Offline state verifier finds owner/head   | Fail run; no receipt.                                                       |
| Re-import mapper changes IDs             | Fixed literal exists but identity differs | Assert semantics plus fresh authoritative identity, not reused IDs.         |
| Manifest becomes a metadata-only fiction | Declared row exists but file does not     | Path/hash/native-locator resolver blocks before qualification or promotion. |

## Security

- Use loopback only and isolated temporary data roots.
- Do not print capabilities, private executable paths, package text beyond fixture literals, or raw OfficeCLI output.
- Hash evidence artifacts; keep raw runs under ignored/operator-controlled directory.
- Never execute macro/external content; fixture gate prohibits it.
- Qualification cleanup is mandatory. Cleanup failure makes the run fail.

## Dependencies and Next

- Requires Phase 8 direct qualified OfficeCLI and all Phase 9 transactional/job validators.
- Produces G2 input for Phase 11.
- Phase 11 independently promotes exact primitive rows to G4; G2 receipt alone is insufficient.
- Phase 15 later adds G3/G5 evidence against the same R1 subject.
