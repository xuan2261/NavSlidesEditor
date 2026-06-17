---
title: "Element Control Audit Matrix TDD Plan"
description: "Build a current, test-backed audit matrix for every element-control status across editor, canvas, HTML export, and PPTX export."
status: completed
priority: P0
effort: "10-14 dev-days"
branch: master
tags: [testing, qa, tdd, frontend, export, tech-debt]
blockedBy: []
blocks: []
created: 2026-06-17
createdBy: ck-plan-skill
mode: "--deep --tdd"
---

# Element Control Audit Matrix TDD Plan

## Overview

Turn the source audit report into a durable, executable matrix: every expected `element/control/surface` row gets one explicit status (`works`, `partial`, `broken`, `export-gap`) backed by tests, source evidence, and export policy.

Red-team update: the matrix status is now scoped per `element/control/surface`, not as one aggregate status across mixed surfaces. Phase 01 must create the validator, expected-control inventory, generated report, and `matrix:gate` integration before any control fixes are attempted.

## Source Context

| Source | Use |
|---|---|
| [Current audit report](../260609-0830-element-control-functional-fixes-tdd/reports/260617-element-control-audit-matrix-current-state-report.md) | Primary findings, current statuses, high-risk items |
| [Plan phase mapping report](./reports/planner-260617-element-control-audit-matrix-phase-mapping-report.md) | Maps audit findings to phases, TDD gates, and unresolved decisions |
| [Old functional fixes plan](../260609-0830-element-control-functional-fixes-tdd/plan.md) | Historical decisions; many findings now stale |
| [README](../../README.md) | Product feature surface and canonical 19 element types |
| [Code standards](../../docs/code-standards.md) | Test selector, file size, feature matrix rules |
| [System architecture](../../docs/system-architecture.md) | Editor/export architecture |
| [Codebase summary](../../docs/codebase-summary.md) | Current structure and testing surface |

## Scope

In scope:
- Current source-of-truth audit matrix for 19 canonical element types, expected controls, and each relevant surface.
- Test-first fixes for the first 3-5 high-risk `partial`, `broken`, and `export-gap` rows only after the matrix/gate can fail correctly.
- Matrix evidence tying UI controls, state mutation, canvas render, shared HTML render, and PPTX behavior.
- Documentation for accepted export limits.
- Security invariants for content-bearing controls: trust boundary, sanitizer/escaper, URL policy, sink, and negative payload tests where relevant.

Out of scope:
- Full rewrite of `EditorPage.jsx`.
- New element types.
- Full game engine redesign.
- Promising editable PPTX parity for dynamic/live-only content.
- Adding new product authoring features solely to make an audit row `works`; unsupported authoring should be marked `partial` unless an existing visible control is broken.

## Cross-Plan Dependencies

| Relationship | Plan | Status | Notes |
|---|---|---|---|
| Related | [Element and Control Functional Fixes](../260609-0830-element-control-functional-fixes-tdd/plan.md) | pending metadata, partly stale | This plan supersedes stale findings with current matrix evidence. Non-blocking. |
| Related | [Long Term Automated Coverage Expansion](../260615-1641-long-term-automated-coverage-expansion-tdd/plan.md) | completed-with-concerns | This plan implements a focused slice of deeper element-control coverage. |
| Related | [Upstream Parity Verification](../260523-0500-upstream-parity-verification-tdd/plan.md) | in_progress | Broader upstream parity. This plan is local current-state parity first. |

## Red Team Review

### Session - 2026-06-17
**Findings:** 15 (15 accepted, 0 rejected)
**Severity breakdown:** 8 Critical, 6 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Matrix status model ambiguous across surfaces | Critical | Accept | Phase 01 |
| 2 | Missing expected-control inventory allows false green | Critical | Accept | Phase 01 |
| 3 | Validator/source-of-truth/gate integration optional | Critical | Accept | Phase 01, Phase 08 |
| 4 | Scope too broad for one fix-all program | Critical | Accept | Plan, Phase 03, Phase 05, Phase 07, Phase 08 |
| 5 | Matrix lacks security invariants for content-bearing controls | Critical | Accept | Phase 01 |
| 6 | Shared control coverage misses renderer-family smoke and commands | High | Accept | Phase 02 |
| 7 | `videoUrl` migration can lose data without a fixed contract | Critical | Accept | Phase 03 |
| 8 | Trusted HTML and active exports lack boundary/warning contract | Critical | Accept | Phase 04, Phase 07 |
| 9 | Media URL policy lacks allowlist and negative fixtures | High | Accept | Phase 03 |
| 10 | SVG sanitization lacks adversarial payload contract | High | Accept | Phase 05 |
| 11 | Table merge read-only path lacks row/column mutation invariants | High | Accept | Phase 05 |
| 12 | Game subtype/fallback coverage can falsely mark `works` and leak private config | High | Accept | Phase 06 |
| 13 | Export fallback warnings lack schema and user-visible contract | High | Accept | Phase 07 |
| 14 | Export tests duplicate across phases instead of using matrix-driven contracts | High | Accept | Phase 07 |
| 15 | Final verification lacks blocking/optional gate classification and report redaction check | Medium | Accept | Phase 08 |

Reviewer lens coverage: Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Matrix Source Of Truth And Harness](./phase-01-matrix-source-of-truth-and-harness.md) | Completed |
| 2 | [Cross-Cutting Canvas And Selection Controls](./phase-02-cross-cutting-canvas-and-selection-controls.md) | Completed |
| 3 | [Media Element Controls](./phase-03-media-element-controls.md) | Completed |
| 4 | [Text Content And Embed Element Controls](./phase-04-text-content-and-embed-element-controls.md) | Completed |
| 5 | [Structured Vector And Data Elements](./phase-05-structured-vector-and-data-elements.md) | Completed |
| 6 | [Game Element And Live-Only Policy](./phase-06-game-element-and-live-only-policy.md) | Completed |
| 7 | [Export Fidelity And Accepted Limits](./phase-07-export-fidelity-and-accepted-limits.md) | Completed |
| 8 | [Governance Docs And Final Verification](./phase-08-governance-docs-and-final-verification.md) | Completed |

## Execution Strategy

Sequential. Phase 01 is a hard prerequisite: no control fix should start until the matrix schema, expected-control inventory, generated report, and gate integration exist. Later phases may only fix rows already represented in the matrix, and each phase should cap implementation to the highest-risk rows instead of chasing total parity.

Do not broaden scope to unrelated UI polish or new authoring features. When capability is intentionally not supported, record `partial` or `export-gap` with a decision, docs link, and warning/fallback contract.

Validation Session 1 confirmed Phase 01 must create the full expected-control inventory and matrix rows for all 19 canonical element types before control fixes start. Rows may honestly start as `partial` or `export-gap`; a skeleton with missing evidence is not acceptable.

## Success Criteria

- Matrix has one row per expected `element/control/surface` with exactly one of `works`, `partial`, `broken`, or `export-gap`.
- Expected-control inventory accounts for every included, deferred, and out-of-scope user-facing control.
- Validator fails on missing expected controls, mixed/ambiguous surface status, missing evidence/tests, and missing required security fields.
- Every `broken` row has a fix plan or explicit deferral.
- Every `export-gap` row has either executable fallback coverage or documented accepted limit.
- Export fallback warnings are user-visible through an export result modal/panel and also emitted as a machine-readable report.
- Tests cover state mutation, render impact, persistence/export where relevant.
- Blocking gates pass before completion: element-control validator through `npm run matrix:gate`, targeted phase tests, and export/browser audit when export rows changed. Skipped blocking gate means blocked, not complete.

## Validation Log

### Session 1 - 2026-06-17
**Trigger:** `$ck:plan validate C:/Work/NavSlidesEditor/plans/260617-0739-element-control-audit-matrix-tdd/plan.md`
**Questions asked:** 3

#### Questions & Answers

1. **[Scope]** Phase 01 nên chặn implementation ở mức nào trước khi sửa control?
   - Options: Full inventory (Recommended) | High-risk only | Skeleton first
   - **Answer:** Full inventory (Recommended)
   - **Custom input:** None
   - **Rationale:** This prevents a false green matrix. The plan can still avoid scope creep by allowing honest `partial` and `export-gap` rows.

2. **[Architecture]** Export warning contract nên hiển thị cho user ở đâu?
   - Options: Modal + report (Recommended) | Toast only | Report only
   - **Answer:** Modal + report (Recommended)
   - **Custom input:** None
   - **Rationale:** Export gaps must be visible to users and machine-checkable by tests/docs.

3. **[Security]** Security scope cho HTML/media/SVG trong plan này nên dừng ở mức nào?
   - Options: Policy + tests (Recommended) | Runtime harden | Docs only
   - **Answer:** Policy + tests (Recommended)
   - **Custom input:** None
   - **Rationale:** This preserves the product's trusted-author model while adding warnings, URL/SVG negative tests, and docs without broad sandbox/CSP/runtime redesign.

#### Confirmed Decisions

- Phase 01 gate: full expected-control inventory and full 19-element matrix rows are required before implementation starts.
- Export warnings: use a user-visible export result modal/panel plus machine-readable report.
- Security scope: keep trusted-author behavior; add policy, warnings, negative tests, and docs; no broad runtime hardening in this plan.

#### Action Items

- [x] Update Phase 01 with full inventory gate strictness.
- [x] Update Phase 03/04/05 security scope notes.
- [x] Update Phase 07 export warning delivery contract.
- [x] Update Phase 08 final verification expectations.

#### Impact on Phases

- Phase 01: must reject skeleton/incomplete coverage; `partial` and `export-gap` statuses remain allowed when evidence-backed.
- Phase 03: media URL policy remains policy/test-focused unless a current implementation violates the accepted policy.
- Phase 04: trusted HTML scope remains warning/test/doc focused; no sandbox/CSP redesign in this plan.
- Phase 05: SVG work focuses on sanitizer policy and adversarial fixtures, not broad renderer redesign.
- Phase 07: export warnings need both UI delivery and machine-readable report contract.
- Phase 08: final verification must check the warning surface, report schema, docs, and security redaction.

## Cook Handoff

Use after review:

```bash
/ck:cook C:/Work/NavSlidesEditor/plans/260617-0739-element-control-audit-matrix-tdd/plan.md
```

## Unresolved Questions

- None after validation session 1.

Resolved decisions:
- `videoUrl` is retained as legacy read fallback only when canonical `src` is absent; migration must be idempotent and must not delete valid legacy data until `src` is safely populated.
- Table merge/unmerge authoring is out of scope for this plan; imported/read-only merge fidelity remains `partial` unless a separate table-editing plan is opened.
- Image border authoring is not added only for audit completeness; mark authoring `partial` unless an existing visible control is a no-op.
- Phase 01 requires full expected-control inventory and full 19-element matrix rows before control fixes begin; evidence-backed `partial` and `export-gap` statuses are allowed.
- Export warnings must be user-visible through an export result modal/panel and emitted in a machine-readable report.
- HTML/media/SVG security work in this plan is policy, warnings, negative tests, and docs; broad sandbox/CSP/runtime hardening is out of scope unless required to enforce an existing accepted policy.
