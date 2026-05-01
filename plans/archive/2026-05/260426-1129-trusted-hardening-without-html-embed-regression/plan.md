---
title: "Trusted Hardening Without HTML Embed Regression"
description: "Fix confirmed server/client correctness and targeted safety issues while preserving HTML embed as trusted programmable content."
status: completed
priority: P1
effort: 42h
branch: "master"
tags: [hardening, backend, frontend, tests, trusted-content]
blockedBy: []
blocks: []
created: "2026-04-26"
createdBy: "ck:plan"
source: skill
mode: hard
---

# Trusted Hardening Without HTML Embed Regression

## Overview

Hardening plan from `plans/reports/code-review-master-260426-full-codebase.md` validation, filtered by project decision: **do not apply generic security that breaks HTML embed, custom simulation, or interactive export**.

Core invariant: HTML embed remains trusted programmable content. Fix server/data/live/AI/client correctness, targeted text/markdown/svg safety, tests, and docs.

## Scope Guard

### In Scope
- Share token cascade, analytics access/write races, media JSON lock, Explore trash filter.
- Live presenter hijack prevention with backward-compatible room/session flow.
- AI custom endpoint SSRF guard, AI output validation, generic client errors.
- Client guardrails: live API `res.ok`, settings null guard, numeric input NaN prevention.
- Import/export reliability: markdown href validation, partial media/PDF failure reporting, cache cleanup.
- Targeted content safety for text/markdown/svg only.
- Test/load/E2E fixes and final docs.

### Not In Scope
- No global DOMPurify over full presentation.
- No script stripping for HTML embed.
- No blanket removal of `allow-scripts`.
- No removal of custom CSS.
- No auth system or database migration.
- No Electron sandbox removal without dedicated packaging validation.

## Phases

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 1 | [Scope Guard And Baseline](./phase-01-scope-guard-and-baseline.md) | P1 | 2h | Completed |
| 2 | [Server Data And Share Correctness](./phase-02-server-data-and-share-correctness.md) | P1 | 6h | Completed |
| 3 | [Live Room Presenter Hardening](./phase-03-live-room-presenter-hardening.md) | P1 | 6h | Completed |
| 4 | [AI Provider Hardening](./phase-04-ai-provider-hardening.md) | P1 | 5h | Completed |
| 5 | [Client Correctness Guardrails](./phase-05-client-correctness-guardrails.md) | P1 | 4h | Completed |
| 6 | [Import Export Reliability](./phase-06-import-export-reliability.md) | P2 | 5h | Completed |
| 7 | [Targeted Content Safety Without HTML Embed Regression](./phase-07-targeted-content-safety-without-html-embed-regression.md) | P2 | 5h | Completed |
| 8 | [Tests And Load Harness Repair](./phase-08-tests-and-load-harness-repair.md) | P1 | 5h | Completed |
| 9 | [Tech Debt Docs And Final Verification](./phase-09-tech-debt-docs-and-final-verification.md) | P2 | 4h | Completed |

## Dependencies

- Source validation: [debug validation report](../reports/debug-260426-code-review-master-validation.md)
- Plan-scoped analysis: [scope analysis](./reports/scope-analysis.md)
- Plan-scoped review: [red-team review](./reports/red-team-review.md)
- Plan-scoped validation: [validation checklist](./reports/validation-checklist.md)

## Execution Order

1. Phase 1 locks policy and regression baseline.
2. Phases 2-7 implement fix groups. Can run partly parallel only with strict file ownership.
3. Phase 8 repairs test harness and adds cross-phase regression tests.
4. Phase 9 updates docs and runs final verification.

## Cook Command

`/ck:cook D:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/plans/260426-1129-trusted-hardening-without-html-embed-regression/plan.md`

## Verification Summary

- Passed: `npm run lint`
- Passed: `npm run test`
- Passed: `npm run test:e2e` (110 tests)
- Passed: `npm run build`
- `k6` load tests not run: `k6` is not installed in this environment.

## Unresolved Questions

- None.
