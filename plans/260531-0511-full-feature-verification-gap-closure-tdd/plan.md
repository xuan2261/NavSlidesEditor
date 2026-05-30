---
title: "Full Feature Verification Gap Closure TDD"
description: "Close editor-core capability gaps, add release-grade user journey verification, then extend the matrix to export/import, presentation, live, games, AI, sync, and release gates."
status: pending
priority: P1
effort: "12-16 dev-days"
branch: master
tags: [qa, testing, tdd, coverage, e2e, ci, release-grade]
blockedBy: []
blocks: []
created: 2026-05-31
---

# Full Feature Verification Gap Closure TDD

## Overview

Follow-up to the completed capability matrix plan. Do not rebuild the matrix. Use it to remove false confidence: convert `ALLOWED` gaps to real PASS where practical, add risk-based E2E journeys, then extend coverage beyond editor-core.

Red-team adjustment: this plan is release-confidence work, not a full product-surface verification rewrite. MVP scope is Phase 1, high-risk editor-core gap closure, and the smallest critical journeys needed to prove persistence and share/security behavior. Extended domain expansion and heavy release lanes are bounded to inventory/tagging plus explicitly listed high-risk smoke/security checks.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| Builds on | [Feature Coverage Traceability Matrix System](../260530-0854-feature-coverage-traceability-matrix-system-tdd/plan.md) | completed |
| Complements | [QA Confidence Uplift MVP](../260522-1339-qa-confidence-uplift-5-phase-tdd/plan.md) | pending |
| Complements | [E2E Test Cleanup and Coverage Expansion](../260524-0959-e2e-cleanup-and-coverage-tdd/plan.md) | completed |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Baseline and Verification Contract](./phase-01-baseline-and-verification-contract.md) | Pending |
| 2 | [Editor Core Gap Closure](./phase-02-editor-core-gap-closure.md) | Pending |
| 3 | [Critical User Journey E2E Coverage](./phase-03-critical-user-journey-e2e-coverage.md) | Pending |
| 4 | [Extended Domain Matrix Expansion](./phase-04-extended-domain-matrix-expansion.md) | Pending |
| 5 | [CI Gates and Release Confidence](./phase-05-ci-gates-and-release-confidence.md) | Pending |
| 6 | [Docs, Manual QA, and Maintenance Loop](./phase-06-docs-manual-qa-maintenance-loop.md) | Pending |

## Execution Strategy

Phase 1 first. Phase 2 and 3 can run parallel only after Phase 1 publishes the baseline schema and file ownership is split. Phase 4 starts after Phase 1 but is limited to inventory/tagging plus share/live/PPTX/import/AI security-risk smoke where existing infrastructure supports it. Phase 5 waits for 2-4. Phase 6 finalizes docs and operating process.

Parallel ownership rule:

- Phase 2 owns editor-core unit/component tests and capability allowlist removals.
- Phase 3 owns Playwright journey specs and POM helpers.
- Phase 4 owns manifest namespace additions and domain retagging.
- `scripts/feature-inventory/coverage-gate-allowlist.json` merge happens serially after each phase regenerates `npm run matrix:gate`.

## Success Criteria

- `docs/feature-coverage-matrix.md` remains generated source of truth, not hand-edited.
- Editor-core baseline denominator is fixed from Phase 1. All P0/P1 editor-core gaps from that fixed baseline become PASS or have dated, owner-assigned debt. The 90/100 count is secondary, not the primary exit gate.
- Extended domain success is measured separately: 100% of added domain IDs are classified by risk/layer, and only explicitly listed smoke/deep IDs count as verified.
- Critical user journeys have Playwright coverage with stable POM selectors.
- Extended domains have capability IDs and first-pass smoke/deep policy.
- `npm run matrix:gate`, `npm test`, and selected E2E core lane pass before completion.
- Release checklist tells user what is verified, what is manual, what remains risk.

## Dependencies

- Existing Vitest, Playwright, k6 setup.
- Existing `scripts/feature-inventory/*` matrix system.
- Existing POM helpers in `tests/e2e/pages/`.
- Docs: `docs/feature-coverage-matrix.md`, `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`, `docs/code-standards.md`.

## Out Of Scope

- Product behavior rewrites unless tests reveal real bugs.
- New dashboard app; Markdown/JSON is enough.
- 100% line coverage target.
- Full PPTX fidelity perfection; use existing strict PPTX audit for release signoff.

## Cook Handoff

Run implementation with:

```bash
/ck:cook --auto C:\Work\NavSlidesEditor\plans\260531-0511-full-feature-verification-gap-closure-tdd\plan.md
```

## Red Team Review

### Session - 2026-05-31

**Findings:** 15 deduplicated from 35 reviewer findings (13 accepted, 2 rejected)
**Severity breakdown:** 5 Critical, 8 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Scope exceeds effort without MVP cutoff | Critical | Accept | Plan, Phase 4, Phase 5 |
| 2 | PASS target lacks fixed denominator and risk semantics | Critical | Accept | Plan, Phase 1, Phase 2 |
| 3 | Baseline report has no machine-readable contract | Critical | Accept | Phase 1 |
| 4 | TDD can encode current behavior instead of product behavior | High | Accept | Phase 2 |
| 5 | Autosave/undo misses data-loss recovery paths | Critical | Accept | Phase 2 |
| 6 | E2E export/PPTX smoke lacks artifact validation | High | Accept | Phase 3 |
| 7 | Live reconnect lacks multi-client timing and authz checks | High | Accept | Phase 3, Phase 4 |
| 8 | Security assertions are too vague for share/import/upload/AI/socket | Critical | Accept | Phase 4 |
| 9 | External integrations can be mocked but still counted as verified | High | Accept | Phase 3, Phase 4 |
| 10 | Parallel phases edit shared test/matrix files without ownership | High | Accept | Plan |
| 11 | CI gates lack runtime budget, rollback, quarantine, branch-protection mapping | High | Accept | Phase 5 |
| 12 | Destructive CI guard and secret/artifact scanning are not enforceable | High | Accept | Phase 5 |
| 13 | Release summary/docs/manual checklist can drift from generated evidence | Medium | Accept | Phase 6 |
| 14 | Fully removing CI/docs contract tests | Medium | Reject | Phase 5, Phase 6 |
| 15 | Removing roadmap/changelog/manual checklist updates | Medium | Reject | Phase 6 |

Rejected rationale:

- Contract tests stay, but are limited to changed scripts/workflows/docs links. They should not become broad meta-testing.
- Roadmap/changelog/manual checklist updates stay because repository workflow requires docs sync after implementation; Phase 6 now gates them against generated evidence to reduce drift.

## Validation Log

### Session 1 - 2026-05-31
**Trigger:** `/ck:plan validate C:\Work\NavSlidesEditor\plans\260531-0511-full-feature-verification-gap-closure-tdd\plan.md`
**Questions asked:** 6

#### Questions & Answers

1. **[Scope]** MVP release-blocking của plan là gì?
   - Options: Phase 1 + P0/P1 editor-core + create/edit/persist + share password/revoke (Recommended) | Thêm export/live/PPTX vào release-blocking ngay | Toàn bộ Phase 1-6 đều release-blocking
   - **Answer:** Phase 1 + P0/P1 editor-core + create/edit/persist + share password/revoke.
   - **Rationale:** Keeps release-blocking work bounded to the highest-risk confidence gaps.

2. **[Architecture]** Baseline gap report nên được tạo bằng cách nào?
   - Options: Script deterministic từ matrix/manifest/run output, JSON là source of truth (Recommended) | Manual JSON trong plan reports | Markdown-only report
   - **Answer:** Script deterministic từ matrix/manifest/run output, JSON là source of truth.
   - **Rationale:** Prevents manual drift and lets later phases consume a stable contract.

3. **[Assumption]** P0/P1 gap không có oracle rõ thì xử lý sao?
   - Options: Không viết test đoán hành vi; ghi dated debt + extraction/spec target (Recommended) | Encode current behavior thành expected behavior | Hỏi từng case trước khi làm
   - **Answer:** Không viết test đoán hành vi; ghi dated debt + extraction/spec target.
   - **Rationale:** Avoids turning accidental current behavior into product contract.

4. **[Tradeoff]** CI rollout gate nên cứng mức nào ban đầu?
   - Options: `matrix:gate` + lint/unit required; E2E/heavy lane report-only cho tới 2 green CI runs (Recommended) | Tất cả gate required ngay | Chỉ local verification, chưa đổi CI
   - **Answer:** `matrix:gate` + lint/unit required; E2E/heavy lane report-only cho tới 2 green CI runs.
   - **Rationale:** Preserves fast PR feedback while heavy gates prove stability before becoming required.

5. **[Risk]** External integrations AI/sync/GitHub/rclone được tính verified thế nào?
   - Options: Contract/local failure coverage only, không tính full E2E nếu không hermetic adapter (Recommended) | Dùng mocks và tính full verified | Bỏ khỏi plan này
   - **Answer:** Contract/local failure coverage only, không tính full E2E nếu không hermetic adapter.
   - **Rationale:** Keeps reported confidence honest for systems depending on external credentials/services.

6. **[Security]** Mandatory negative/security matrix trong Phase 4 có bắt buộc trước completion không?
   - Options: Bắt buộc cho share/live/import-upload/AI guard; phần còn lại có dated debt (Recommended) | Bắt buộc toàn bộ danh sách | Chỉ document, không cần tests/debt
   - **Answer:** Bắt buộc cho share/live/import-upload/AI guard; phần còn lại có dated debt.
   - **Rationale:** Forces coverage for high-risk trust boundaries without making the phase unbounded.

#### Confirmed Decisions

- MVP release-blocking scope: Phase 1, P0/P1 editor-core gaps, create/edit/persist, and share password/revoke.
- Baseline contract: deterministic generated JSON is the source of truth; Markdown is summary only.
- Behavior oracle: no guessed tests for unclear P0/P1 behavior; use dated debt with spec/extraction target.
- CI rollout: required `matrix:gate` + lint/unit first; E2E/heavy lanes become required only after two green CI runs.
- External integrations: contract/local failure coverage unless a hermetic adapter exists.
- Security scope: share/live/import-upload/AI guard negative tests are mandatory; remaining security entries need dated debt if deferred.

#### Action Items

- [ ] Ensure Phase 1 implementation creates deterministic baseline JSON from matrix/manifest/run output.
- [ ] Treat only the validated MVP scope as release-blocking.
- [ ] Reject P0/P1 tests without a clear oracle.
- [ ] Keep heavy CI gates report-only until two consecutive green CI runs.
- [ ] Label AI/sync/GitHub/rclone coverage honestly as contract-only unless hermetic.
- [ ] Require negative tests or dated debt for Phase 4 security matrix entries.

#### Impact on Phases

- Phase 1: Baseline JSON generation must be deterministic and authoritative.
- Phase 2: P0/P1 gaps need an oracle before tests; otherwise dated debt.
- Phase 3: MVP journeys are release-blocking; export/live/PPTX remain bounded.
- Phase 4: Security negative tests are mandatory for selected trust boundaries; external integrations are contract-only unless hermetic.
- Phase 5: Gate rollout starts with required lint/unit/matrix and report-only heavy lanes.
- Phase 6: Release summary must separate MVP verified, bounded verified, contract-only, and debt.
