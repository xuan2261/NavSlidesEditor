---
title: "Upstream Parity Verification TDD"
description: "Build a full verification system to prove NavSlides Editor features, elements, controls, logic, and flows match approved upstream behavior."
status: in_progress
priority: P0
effort: "2-3 weeks single dev / 1-1.5 weeks with 3 lanes"
branch: master
tags: [upstream, parity, qa, testing, playwright, vitest, visual-regression, tdd]
created: 2026-05-23
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
blockedBy: [260523-0900-smoke-test-bug-fixes-tdd]
blocks: []
---

# Upstream Parity Verification TDD

## Overview

Goal: prove behavior parity with approved upstream, not just "tests pass". Use upstream as oracle, then verify current repo via traceability matrix, golden fixtures, automated E2E, state assertions, visual/export/live gates, and manual bug-bash.

## Context

| Source | Use |
|---|---|
| `README.md` | Feature inventory: editor, 20 element types, live, export, games, AI |
| `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` | Existing Vitest, Playwright, k6 commands |
| `plans/260519-1200-comprehensive-test-coverage-expansion/` | Completed coverage/e2e foundation |
| `plans/260522-1339-qa-confidence-uplift-5-phase-tdd/` | Pending MVP QA confidence; this plan expands deferred full matrix |
| `plans/260514-1045-upstream-main-selective-port-workflow/` | Upstream sync/port precedent |

## Phases

| # | Phase | Status | Priority | File |
|---|---|---|---|---|
| 1 | Upstream Baseline And Diff Oracle | blocked | P0 | [phase-01-upstream-baseline-and-diff-oracle.md](./phase-01-upstream-baseline-and-diff-oracle.md) |
| 2 | Feature Parity Matrix And Test Map | blocked | P0 | [phase-02-feature-parity-matrix-and-test-map.md](./phase-02-feature-parity-matrix-and-test-map.md) |
| 3 | Golden Fixtures And State Assertions | pending | P0 | [phase-03-golden-fixtures-and-state-assertions.md](./phase-03-golden-fixtures-and-state-assertions.md) |
| 4 | Editor Elements Controls E2E Parity | pending | P0 | [phase-04-editor-elements-controls-e2e-parity.md](./phase-04-editor-elements-controls-e2e-parity.md) |
| 5 | Export Import Present Live Game Parity | pending | P0 | [phase-05-export-import-present-live-game-parity.md](./phase-05-export-import-present-live-game-parity.md) |
| 6 | Visual Manual QA And Bug Bash Gate | pending | P1 | [phase-06-visual-manual-qa-and-bug-bash-gate.md](./phase-06-visual-manual-qa-and-bug-bash-gate.md) |
| 7 | CI Gate Docs And Release Readiness | pending | P0 | [phase-07-ci-gate-docs-and-release-readiness.md](./phase-07-ci-gate-docs-and-release-readiness.md) |

## Dependency Graph

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7
```

Phase 5 remains sequential after Phase 4 because it reuses finalized state helpers and P0 gate semantics. Split only sub-suites inside a phase when file ownership, ports, and temp storage are isolated.

## Success Criteria

- `docs/upstream-parity-matrix.md` covers every README feature area and links tests.
- Same smoke/parity intent runs against upstream worktree and current repo through a reviewed adapter command map where tooling differs.
- Golden fixture decks catch state, persistence, export, and render regressions.
- Core editor/elements/controls/live/export/game suites pass locally and in CI.
- Manual checklist has no P0/P1 open before release.
- Final report records pass/fail/unknown count and unresolved questions.
- P0 rows are release-ready only when `Pass` or covered by an explicit waiver with owner, approved by, approval date, expiry, rationale, user impact, rollback decision, and follow-up issue.
- Security invariants override upstream parity: matching an insecure upstream behavior is still a release blocker unless waived.

## Recommended Cook Command

```powershell
/ck:cook --tdd C:\Work\NavSlidesEditor\plans\260523-0500-upstream-parity-verification-tdd\plan.md
```

## Unresolved Questions

- Approved upstream is `https://github.com/jbirky/parallax-presentations.git` at `ce548c535abc7701ac45cc3164560caba121adce`, approved by `Xuan` (`Project owner`) on `2026-05-23`; upstream baseline is currently blocked by approved upstream dependency/build failure.

## Red Team Review

### Session — 2026-05-23

**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 7 Critical, 7 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Upstream oracle is floating / not approved | Critical | Accept | Phase 1 |
| 2 | Baseline install and tooling are non-deterministic and unsafe | Critical | Accept | Phase 1 |
| 3 | README inventory is not a behavior spec | High | Accept | Phase 2 |
| 4 | P0 rows can be ticketed instead of blocked | Critical | Accept | Phase 2, 4, 5, 7 |
| 5 | Fixture provenance can encode current behavior, not upstream | Critical | Accept | Phase 3 |
| 6 | State and artifact isolation/cleanup is missing | Critical | Accept | Phase 3, 5 |
| 7 | State assertions omit production storage and subsystem contracts | High | Accept | Phase 3 |
| 8 | Scope creates all-or-nothing parity instead of MVP/extended gates | Critical | Accept | Phase 2, 4, 5, 6, 7 |
| 9 | Security invariants are subordinate to upstream parity | Critical | Accept | Phase 2, 5, 7 |
| 10 | Share/live/game authorization negative tests are too thin | High | Accept | Phase 5 |
| 11 | Malicious import fixtures are missing | High | Accept | Phase 5 |
| 12 | Export validation is too shallow for parity | High | Accept | Phase 5 |
| 13 | Visual baseline workflow can bless regressions | High | Accept | Phase 6 |
| 14 | CI enforcement lacks staged rollout, hardening, and rollback | High | Accept | Phase 7 |
| 15 | Manual signoff owner is undefined | Medium | Accept | Phase 6 |

Accepted changes were applied inline to phase files with `Red Team Adjustment` sections. Key direction: make Phase 1 a hard gate, define MVP vs extended parity, keep P0 release semantics strict, and add negative security/failure-mode coverage where trust boundaries exist.

## Validation Log

### Session 1 - 2026-05-23
**Trigger:** `/ck:plan validate plans\260523-0500-upstream-parity-verification-tdd\`
**Questions asked:** 6

#### Questions & Answers

1. **[Assumption]** Upstream ref nào là source of truth?
   - Options: Pin exact commit SHA + named approver trước Phase 2 (Recommended) | Dùng `upstream/main` floating ref | Dùng tag/release nếu có | Chưa quyết, Phase 1 tự đề xuất
   - **Answer:** Pin exact commit SHA + named approver trước Phase 2.
   - **Rationale:** Prevents floating upstream behavior from invalidating reports, fixtures, and release gates.

2. **[Scope]** MVP parity gate có nên giới hạn đúng các P0 flows trong Phase 2 không?
   - Options: Có, P0 = release gate; P1/P2 = visible backlog/report-only (Recommended) | Không, tất cả README features phải block release | Chỉ editor/export/import block release, live/game/cloud report-only
   - **Answer:** Có, P0 = release gate; P1/P2 = visible backlog/report-only.
   - **Rationale:** Keeps release gate strict without turning extended parity into an all-or-nothing blocker.

3. **[Architecture]** Golden fixtures parity nên tạo như thế nào?
   - Options: Generate từ approved upstream SHA, lưu checksum/provenance (Recommended) | Check-in manual fixtures và đối chiếu bằng reviewer signoff | Dùng current repo fixtures làm baseline smoke-only, không claim upstream parity
   - **Answer:** Generate từ approved upstream SHA, lưu checksum/provenance.
   - **Rationale:** Ensures fixture evidence comes from the approved oracle, not current implementation drift.

4. **[Risk]** AI/cloud/GitHub/rclone flows nên test parity ở mức nào?
   - Options: Mock/local canary only; không dùng real credentials trong parity gate (Recommended) | Có opt-in real provider smoke ngoài CI mặc định | Defer toàn bộ AI/cloud/GitHub/rclone sang extended audit
   - **Answer:** Mock/local canary only; không dùng real credentials trong parity gate.
   - **Rationale:** Covers integration contracts and leak detection without exposing real credentials or making CI depend on external services.

5. **[Release]** CI parity gate rollout nên bắt đầu ra sao?
   - Options: Report-only observation trước, sau đó block MVP smoke khi ổn định (Recommended) | Block MVP smoke ngay trên PR | Chỉ chạy full parity trên release candidate, không block PR
   - **Answer:** Report-only observation trước, sau đó block MVP smoke khi ổn định.
   - **Rationale:** Avoids blocking development on unproven flakes while still moving toward enforceable MVP parity.

6. **[Ownership]** Manual go/no-go signoff ai chịu trách nhiệm?
   - Options: Gán named DRI trước Phase 6, không có DRI thì Phase 6 blocked (Recommended) | Dev thực hiện Phase 6 tự signoff | Bỏ named signoff, chỉ cần checklist pass
   - **Answer:** Gán named DRI trước Phase 6, không có DRI thì Phase 6 blocked.
   - **Rationale:** Makes manual release risk acceptance explicit and auditable.

#### Confirmed Decisions

- Upstream oracle: approved immutable commit SHA with named approver before Phase 2.
- Release scope: MVP P0 gates block release; P1/P2 remain visible backlog/report-only unless promoted.
- Fixtures: parity fixtures generated from approved upstream SHA with checksum/provenance.
- External integrations: AI/cloud/GitHub/rclone parity uses mock/local canary only in default gate.
- CI rollout: report-only observation first, then blocking MVP smoke after stability.
- Manual QA: Phase 6 requires named DRI/signoff before go/no-go.

#### Action Items

- [x] Phase 1: approve exact upstream SHA, approver, date, and change policy.
- [x] Phase 1: capture current repo metadata and create baseline report scaffold.
- [x] Phase 1: create upstream oracle approval record template.
- [x] Phase 1: refresh candidate upstream evidence snapshot without approving it.
- [x] Phase 1: draft upstream adapter harness design without running upstream baseline.
- [x] Phase 1: create approved upstream worktree and record upstream setup/build failure.
- [x] Phase 2: draft pre-approval feature inventory notes without parity status.
- [x] Phase 2: draft pre-approval matrix schema without parity status.
- [x] Phase 2: draft pre-approval matrix audit checklist without parity status.
- [x] Phase 2: draft pre-approval matrix row seeds with no `Pass` status.
- [x] Phase 2: draft upstream build failure decision record without creating the matrix.
- [x] Phase 2: add ready-to-sign approval checklist for unavailable upstream automation.
- [x] Phase 2: draft manual oracle capture protocol for Path C without creating the matrix.
- [x] Phase 2: draft post-approval matrix creation runbook without creating the matrix.
- [x] Phase 2: draft future matrix audit report template without creating the matrix.
- [x] Phase 2: draft approval request summary without approving the decision record.
- [x] Phase 2: approve unavailable-upstream-automation decision.
- [x] Phase 2: create draft-blocked upstream parity matrix.
- [x] Phase 2: create matrix audit report showing not release-ready.
- [x] Phase 2: keep MVP P0 release gate separate from P1/P2 backlog.
- [x] Phase 2: capture current-repo local regression evidence for `editor-create-save-reload` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `editor-rich-text-formatting` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `elements-representative-insert-edit-render` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `editor-undo-redo-clipboard` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `present-navigation` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `export-html-pdf-offline-archive` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `share-password-revoke` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local security invariant evidence for `security-presenter-token-cross-room` without promoting it to upstream parity `Pass`.
- [x] Phase 2: capture current-repo local regression evidence for `navslides-import-export-roundtrip` without promoting it to upstream parity `Pass`.
- [ ] Phase 3: generate parity fixtures from approved upstream SHA and store checksums/provenance.
- [ ] Phase 5: keep external provider flows mock/local canary only by default.
- [ ] Phase 6: assign named DRI before manual execution.
- [ ] Phase 7: run CI parity report-only observation before blocking MVP smoke.

#### Impact on Phases

- Phase 1: upstream source-of-truth requirement confirmed.
- Phase 2: MVP/P1/P2 gate semantics confirmed.
- Phase 3: fixture provenance strategy confirmed.
- Phase 5: external provider and secret-safety scope confirmed.
- Phase 6: DRI requirement confirmed.
- Phase 7: staged CI rollout confirmed.
