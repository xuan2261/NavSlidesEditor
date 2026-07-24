---
title: "PPTX Import P0 Readiness Remediation Deep TDD"
description: "Test-first closure of every P0 finding from the 2026-07-22 PPTX import readiness audit without expanding into native-feature parity work."
status: blocked
priority: P1
effort: "10-14 engineer-days plus controlled local PowerPoint rendering time"
branch: master
tags: [bugfix, pptx, import, api, frontend, testing, fidelity, critical, tdd]
blockedBy: []
blocks: [260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd]
created: 2026-07-22
mode: "--deep --tdd"
scopeDecision: hold
sourceReport: "../reports/2026-07-22-pptx-import-readiness-audit.md"
---

# PPTX Import P0 Readiness Remediation Deep TDD

## Overview

Close all seven P0 recommendations from the fresh readiness audit: scope the upload limiter, honor and abort server-directed busy waits, remove false parser fallback claims, split metric and importer strictness, propagate native evidence, exercise the real package-backed lifecycle, and replace placeholder visual evidence with controlled all-slide Microsoft PowerPoint evidence.

## Current Execution Status — 2026-07-24

- **Completed software phases:** transport, importer-evidence, and package-backed critical-journey (including authority repairs) are complete with focused regression evidence.
- **Authority verification:** Phase 3 authority repairs are implemented with focused regression evidence (2026-07-24): sanitized server `409` reconciliation `reasonCode` propagates through job-lifecycle timeout errors and package-backed capture cleanup reports; missing-head rollback no-ops require matching job and presentation identity. Focused suites 71/71 across package-store, package-backed actuals, HTTP boundary, and durable-job routes.
- **Evidence gate:** oracle software contracts are implemented, but no trusted controlled Microsoft PowerPoint golden bundle with its matching local evidence envelope and three role receipts is available. Phase 4 and the plan remain blocked; no PowerPoint visual-fidelity or 1:1 claim is authorized.
- **Truth-gate result:** manifest-bound importer qualification remains deliberately non-zero for current native unmapped/placeholder evidence. That is a structured qualification blocker, not a failed best-effort regression or a reason to widen this plan into native-capability work.

## Delivery Contract

- **Outcome:** best-effort import remains usable; P0 transport and evidence contracts become truthful, reproducible, hash-bound and fail-closed.
- **Constraints:** preserve package authority/generation/idempotency contracts; preserve public best-effort behavior; TDD first; keep new code files under 200 LOC; never overwrite unrelated dirty work.
- **Non-goals:** the full P1 upload → job wait → cancellation AbortController; durable job recovery/outbox work; EMF/native-node capability implementation; editable-chart promotion; OfficeCLI automation; multi-tenant auth; P2/P3 performance work.
- **Acceptance:** implementation/unit/integrity tests are green; truth gates emit deterministic pass or structured blocked results; no unavailable result is relabeled as qualification.

## Scope Challenge

- **Existing code reused:** Express limiters, async job route, `handleResponse`, corpus harness, scene reconciliation, corpus/local evidence contracts, package generation fencing, E2E helpers, SSIM oracle and present capture.
- **Minimum set:** four rollback-safe phases. No new service framework. Small helpers are allowed only for corpus qualification, package-backed actual capture, and golden validation to keep owners below 200 LOC.
- **Complexity:** cross-client/server/test/docs by necessity. The phases isolate HTTP behavior, evidence semantics, package lifecycle and physical visual evidence.
- **Selected scope:** HOLD — every audit P0, including abortable admission retry sleep; no P1/P2/P3 expansion.

## Cross-Plan Dependency

This plan blocks `../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/`. P0 must land first because both plans touch package evidence, corpus naming, visual claims and critical journeys. After P0 produces trusted numeric visual evidence, the broad plan may resume even when scores are below its claim threshold; its `G5` remains open until that broader gate passes.

## Architecture Decisions

1. Mount upload quota on `POST /api/pptx/import` only; generic `/api/` quota still covers job reads.
2. Accept canonical positive decimal `Retry-After` delta-seconds, cap at 300,000 ms, preserve configured zero-delay fallback, and abort admission fetch/sleep on caller signal. The full job-lifecycle controller remains P1.
3. Runtime import has one parser: `pptxtojson`. Remove production `pptx2json` inspection/telemetry/dependency; the isolated parser benchmark remains.
4. Keep parser-relative corpus metrics as best-effort regression. Add manifest-bound two-pass importer qualification: best-effort evidence collection, then `{ strict: true }` decision on the same deck hash.
5. Public stats preserve finite native scene counts. Missing/non-finite native evidence is a qualification blocker, never an inferred zero.
6. E2E retains the package-backed presentation ID through edit, generation advance, reload, original hash and validated-export checks.
7. Microsoft PowerPoint is the visual authority. Claim-capable comparison uses the active local evidence contract and three distinct one-owner role receipts, package-backed actuals, exact corpus/golden hashes, all-slide identity, and existing `phase08_full` thresholds (mean 0.99, minimum slide 0.97). This is environment-bounded local evidence, not independent/public attestation.

## Evidence Baseline

- Fresh browser structural audit: 5 decks / 227 slides passed.
- Fresh visual oracle: unavailable; all 11 golden directories contained 8×8 placeholders and mean SSIM was `null`.
- Strict importer probes: `Bai_2_1.pptx` blocked by `emf-convert-disabled`; `STTre_Duc.pptx` exposed 174 unmapped native leaf nodes.
- These are baseline facts, not implementation failures to hide or native capability scope to absorb.

## Phases

| Phase | Name | Priority | Dependencies | Status |
| --- | --- | --- | --- | --- |
| 1 | [Import Job Rate Limit and Retry Contract](./phase-01-import-job-rate-limit-and-retry-contract.md) | P1 | — | Completed |
| 2 | [Import Evidence and Strict Contract](./phase-02-import-evidence-and-strict-contract.md) | P1 | — | Completed |
| 3 | [Package-Backed Critical Journey](./phase-03-package-backed-critical-journey.md) | P1 | 1, 2 | Completed — authority repairs have focused regression evidence |
| 4 | [PowerPoint Visual Oracle and P0 Release Gate](./phase-04-powerpoint-visual-oracle-and-p0-release-gate.md) | P1 | 2, 3 | Blocked — trusted PowerPoint evidence unavailable |

## Execution Strategy

`Phase 1 + Phase 2 -> Phase 3 -> Phase 4`

Phases 1 and 2 have separate owners and may be implemented independently; default cook execution stays sequential. Phase 3 consumes both contracts. Phase 4 owns physical evidence and final claim evaluation.

## Global Success Criteria

- [x] More than 30 PPTX job GET/stream/DELETE requests never consume upload quota; import POST remains limited.
- [x] Client obeys canonical `Retry-After`, caps at five minutes, preserves zero fallback and aborts pending admission wait on unmount/cancel signal.
- [x] Runtime source, telemetry and current docs contain no `pptx2json fallback` claim.
- [x] Metrics and importer-qualification lanes have explicit names and incompatible policies cannot be conflated.
- [x] Qualification is bound to the checked-in 11-deck names/hashes with no silent corpus fallback/substitution.
- [x] Two-pass results retain finite evidence even when strict import rejects; missing evidence remains blocked.
- [x] Critical journey uses one imported ID and proves `G2 > G1`, reload persistence, immutable R0 and typed validated-export outcome.
- [x] Claim-capable visual actuals must come only from HTTP import/package commit/authoritative read and bind ID, revision, generation and original hash; reconciliation `reasonCode` propagation and rollback no-op identity fencing have focused regression evidence.
- [x] Capture navigates exact Reveal slide indexes; three distinct test slides prove slide identity, not only file count.
- [ ] A trusted local PowerPoint bundle still must bind corpus/source/golden hashes, environment, fixed thresholds, and three role receipts before visual evidence can be accepted.
- [x] Missing/untrusted evidence blocks Phase 4; no current result promotes the visual claim or broad-plan `G5`.
- [x] Existing broad package-first plan records this plan as a blocker.

## Validation Commands

```bash
npx vitest run server/index-pptx-rate-limit.test.js server/routes/pptx-import.test.js client/src/utils/api.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx
npx vitest run server/services/pptx-import/importer.test.js server/services/pptx-import/pptx-import-qualification.test.js server/services/pptx-import/pptx-import-corpus-cli.test.js server/services/pptx-import/evidence/corpus-manifest.test.js
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js tests/e2e/pptx-import-fidelity.spec.js tests/e2e/critical-pptx-journey.spec.js
npm run test:pptx:browser-audit:full
npm run test:pptx:oracle:integrity -- --evidence-manifest <local-manifest> --role-receipts <receipts>
npm run test:pptx:oracle:qualify -- --evidence-manifest <local-manifest> --role-receipts <receipts>
npm run lint
npm run build
```

`test:pptx:importer-qualification` and `test:pptx:oracle:qualify` are truth gates. Known native gaps or below-policy visual scores may keep them non-zero. Their harness/unit contracts must pass and their structured blocker reports must be retained; red truth gates are not green qualification evidence.

## Dirty-Worktree Boundary

`docs/export-fidelity-and-limits.md`, `docs/project-changelog.md` and the blocked package-first `plan.md` already contain user changes. Implementation must reread and patch narrowly; never replace them wholesale. No application source targeted by P0 was dirty at planning time.

## Red Team Review

### Session 1 — 2026-07-22

Three hostile reviewers covered assumption/scope, TDD/failure modes and evidence/security. Ten deduplicated findings survived the `file:line` evidence filter.

| ID | Severity | Finding | Disposition | Plan correction |
| --- | --- | --- | --- | --- |
| RT-01 | Critical | Phase 4 allowed unavailable visual evidence to satisfy success (`phase-04...md:209-216`). | Accept (modified) | Missing/untrusted evidence blocks; trusted numeric pass **or below-threshold result** closes evidence remediation, but only threshold pass authorizes a claim. |
| RT-02 | Critical | Oracle provenance and thresholds were mutable/optional (`pptx-oracle-cli.js:25-46,235-245`; `sla-contract.js:48-58`). | Accept (modified) | Use active local evidence authority/three receipts and fixed `phase08_full` 0.99/0.97 policy; reject off/null/debt/ad-hoc claim runs. Protected-provider signing was rejected because the broad plan's active local contract supersedes it. |
| RT-03 | High | Oracle actual capture bypassed package commit (`pptx-oracle-cli.js:132-157`; `pptx-import.js:154-180`). | Accept | Require HTTP POST/poll/authoritative GET/original hash/cleanup and record package identity. |
| RT-04 | High | Audit P0 required abortable retry sleep (`readiness-audit.md:430-433`; `api.js:98-116`). | Accept | Add optional signal for admission fetch/sleep and HomePage unmount ownership; keep full lifecycle controller P1. |
| RT-05 | High | Marker edit could pass without generation advance (`generation-safe-save.js:139-185`). | Accept | Require stable post-save `G2 > G1` and equality after reload/fidelity read. |
| RT-06 | Critical | Qualification accepted substituted/fallback corpora (`pptx-import-corpus-cli.js:91-127`; tester `:1305-1321`). | Accept | Require exact checked-in manifest, no fallback, no missing/extra/hash drift/duplicate hashes, and report manifest digest. |
| RT-07 | High | Current capture can repeat slide 0 (`capture-present.js:59-73`). | Accept | Navigate by Reveal index/API, select active slide only, and verify three distinct slide identities/pixels/hashes. |
| RT-08 | High | Strict import throws before stats assembly (`importer.js:87-106,136`). | Accept | Two-pass qualifier combines best-effort finite evidence with typed strict outcome on the same source hash. |
| RT-09 | High | E2E prose said serial but command used default workers (`playwright.config.js:22-25`). | Accept | Add `--workers=1` to executable gates. |
| RT-10 | Medium | Retry grammar/bounds were unspecified (`api.js:98-115`; `api.test.js:45-55`). | Accept | Canonical digits, safe positive integer, 300,000 ms max, fallback 0..300,000 ms; reject alternate numeric syntaxes. |

User review was not re-prompted because the continuation directive explicitly required no further questions. Only evidence-backed corrections within the already selected HOLD-all-P0 scope were applied.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all four `phase-*.md` files.
- Decision deltas checked: 10 accepted/modified findings.
- Reconciled stale-reference categories: 10 (abort scope, retry grammar, corpus identity, strict evidence, generation, worker count, package-backed capture, slide identity, local authority, thresholds).
- Unresolved contradictions: 0.

## Validation Log

### Session 1 — 2026-07-22

**Trigger:** deep/TDD scope challenge and post-plan verification.
**Questions asked:** 2 in the earlier scope gate; no additional questions after the no-further-questions continuation directive.

#### Questions & Answers

1. **[Scope]** Dựa trên audit: hầu hết hạ tầng đã có, P0 tối thiểu vẫn phải sửa client/server contracts, evidence lanes, package-backed E2E và visual oracle. Anh/chị muốn giữ phạm vi nào cho kế hoạch?
   - Options: Giữ toàn bộ P0 (Recommended) | Thu gọn release blockers | Mở rộng qualification
   - **Answer:** Giữ toàn bộ P0 (Recommended)
2. **[Dependency]** Plan đang chạy `260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd` trùng package authority, evidence và PowerPoint gates. Quan hệ nào nên ghi nhận?
   - Options: P0 plan blocks broad plan (Recommended) | P0 blocked by broad plan | Không dependency
   - **Answer:** P0 plan blocks broad plan (Recommended)

#### Verification Results

- **Tier:** Standard (4 phases; Fact Checker + Contract Verifier with hostile supplements)
- **Claims sampled:** 40
- **Verified initially:** 30 | **Failed then corrected:** 10 | **Unverified:** 0
- **Failures:** RT-01 through RT-10 above.

#### Confirmed Decisions

- Keep every audit P0; include only narrow abortable admission sleep, not the full P1 controller.
- P0 blocks the broad package-first plan.
- Importer qualification may remain deterministically blocked by current native gaps; false-green qualification is forbidden.
- `test:pptx:strict` becomes a deprecated alias for actual importer qualification; metrics use explicit names.
- PowerPoint goldens remain an external hash-bound local bundle; do not commit full PNG evidence by default.
- Repurpose/rename the one-slide Playwright spec as editor visual regression; it is not source visual fidelity evidence.
- Use the broad plan's active local G5 authority and role-receipt limitations, not historical protected-provider requirements.

#### Impact on Phases

- Phase 1: exact retry grammar/cap and narrow abort ownership.
- Phase 2: exact corpus manifest and two-pass qualification.
- Phase 3: serialized gate and strict generation advance.
- Phase 4: package-backed capture, slide identity, local evidence receipts and fixed finite claim thresholds.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all four `phase-*.md` files.
- Validation decisions checked: 7.
- Reconciled stale-reference categories: 7.
- Unresolved contradictions: 0.

#### Planning-time schema verification

- AgentKit parse: 4 phases / 100 unchecked checklist items **at planning time**.
- New P0 plan validation: valid, 0 errors.
- Blocked broad plan validation after reciprocal metadata edit: valid, 0 errors.
- `git diff --check`: clean; Windows LF→CRLF warning only on the pre-existing dirty broad plan.

### Execution Validation — 2026-07-22

- The direct Phase 1 focused gate passed 5 files / 51 tests, including all 27 API tests.
- Focused importer-evidence contracts passed, and the corpus metrics lane completed 11/11 decks. `npm run test:pptx:importer-qualification` remains correctly non-zero for native unmapped/placeholder evidence; this is the required fail-closed qualification outcome.
- The package-backed critical-journey Vitest gate passed 12 files / 166 tests, and the serialized Playwright journey passed all 3 covered specs.
- The initial durable-receipt hardening suite passed 34/34 package-store tests, then independent review found a legacy receipt matrix/fencing epoch bypass in automatic migration. The corrected policy retains receipts lacking immutable outcome coordinates and rejects their rollback with `LEGACY_IMPORT_RECEIPT_UNSUPPORTED`, including after matrix-authority epoch advance. The affected package-store and route rerun passed 2 files / 53 tests; targeted lint of the receipt and reconciliation owners passed. Final blocker-only review confirmed that policy but identified two P0 repair cases: preserve server `409` reconciliation `reasonCode` through job-lifecycle timeout/reconciliation errors and cleanup reporting; and validate job/presentation binding before an already-rolled-back no-op permits cleanup. Focused regression evidence and blocker-only review of those repairs remain open.
- The authority/oracle focused suite passed 21 files with 142 passed and 1 skipped tests. Its isolated Node-environment loopback test exercised HTTP import, package snapshot/original fencing, capture identity, and permanent cleanup.
- `npm run lint` completed with 0 errors and 25 existing warnings; `npm run build` passed.
- Broad `npm test` was unresolved on 2026-07-22: 3 matrix-contract failures in `client/src/data/element-defaults.test.js` (deleted live report path) and 4 skipped feature-inventory tests, then stopped without an aggregate summary.
- **2026-07-24 matrix triage:** restored then relocated matrix machine reports to stable `scripts/feature-inventory/reports/feature-coverage-matrix.{json,md}`; consumers (`build-matrix`, coverage gate, baseline-gap, tag-retrofit guard, element-defaults drift guard) no longer depend on archived plan paths. Matrix-related tests 5 files / 59 pass. Full `npm test` aggregate not re-run in this session.
- The PowerPoint oracle remains blocked because no trusted Microsoft PowerPoint evidence bundle, local envelope, matching role receipts, package-backed actual manifest, or signed numeric comparison result was supplied. No numeric visual result or release claim is recorded.

### Execution Validation — 2026-07-24

- Closed the two Phase 3 authority repairs from the 2026-07-22 review:
  - Job-lifecycle timeout errors and package-backed capture cleanup reports preserve sanitized server `409` `reasonCode` values via shared `safeServerReasonCode` (not only `LEGACY_IMPORT_RECEIPT_UNSUPPORTED`).
  - Missing-head rollback no-ops require matching job and presentation identity; wrong jobId or presentationId fails closed without mutating durable state.
- Focused regression suite: `package-store.test.js` + `package-backed-actuals.test.js` + `http-boundary.test.js` + `pptx-import-durable-job.test.js` → 4 files / 71 tests pass; scoped ESLint clean.
- Phase 3 recorded complete. Phase 4 and plan remain blocked solely on trusted PowerPoint evidence.
- Wider authority-related gate 8 files / 128 tests pass (package-store, package-backed actuals, HTTP boundary, durable-job, pptx-original, presentations, package-authority-snapshot, package-revision-resolver).

## Unresolved Questions

None. Missing physical PowerPoint evidence and the known strict-importer blocker are explicit execution results, not unresolved design choices.
