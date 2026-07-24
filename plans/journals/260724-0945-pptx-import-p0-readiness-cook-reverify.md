# PPTX Import P0 Readiness — Cook Re-Verify, Still Blocked on Goldens

**Date**: 2026-07-24 09:45
**Severity**: Medium
**Component**: PPTX import P0 readiness (`plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/`)
**Status**: Blocked (software complete; truth gates + human receipts open)

## What Happened

Invoked `/ak:cook plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/plan.md --auto --tdd`. Phases 1–3 already complete; Phase 4 software contracts already landed in prior sessions. This cook shipped **no new application implementation**.

Re-verified software gates only:

| Suite | Result |
|-------|--------|
| Tester slice | **22 files / 224 Vitest pass** |
| Oracle contracts | **104** |
| Phases 1–3 | **140** |

Truth gates intentionally non-zero:

- **importer-qualification** — native unmapped / placeholder / EMF still fail qualification
- **oracle integrity** — `missing-evidence-manifest`

Code review: **8.5/10**, 0 critical → software completion auto-approved.

Docs footgun fixed: `docs/pptx-visual-evidence-runbook.md` no longer documents forbidden `--actual-manifest-out`.

PM report: [`plans/reports/pm-2026-07-24-pptx-import-p0-readiness-cook.md`](../reports/pm-2026-07-24-pptx-import-p0-readiness-cook.md)

## The Brutal Truth

We cooked a plan that was already done on the software side and spent the session proving green tests we already had. That is not failure — it is honesty — but it is also a reminder that **P0 readiness is not a Vitest problem anymore**. The remaining wall is trusted Microsoft PowerPoint goldens, a local evidence envelope, and three role receipts. Until those land, calling this "ready" would be marketing, not engineering.

No visual-fidelity claim. No 1:1 claim. Authorized or not, we do not have the evidence envelope to say either.

## Technical Details

- Software: green at 224 + 104 + 140 Vitest counts above.
- Truth: importer-qualification still surfaces native unmapped/placeholder/EMF gaps; oracle integrity reports `missing-evidence-manifest`.
- Runbook: removed documentation of `--actual-manifest-out` (forbidden path that would have guided operators into an invalid evidence write).
- Plan status remains **blocked** solely on:
  1. trusted Microsoft PowerPoint goldens
  2. local evidence envelope
  3. 3 role receipts

## What We Tried

- Full cook with `--auto --tdd` → correctly found software already complete; no code churn needed.
- Re-ran software gates → all green.
- Did not force truth gates green → would have required fake goldens or claim inflation.

## Root Cause Analysis

Blocker is **process/evidence**, not missing parser features for this cook's scope. Prior sessions finished phases 1–4 software contracts; P0 release still requires external PowerPoint-rendered goldens and signed role receipts. Software green ≠ product claim authorized.

## Lessons Learned

- Re-verify cooks are valuable when the plan is multi-session and claim-gated: they stop someone from "finishing" by shipping tests without goldens.
- Documenting a forbidden CLI flag is worse than omitting it — operators will copy paste the bad path.
- Keep truth gates red when evidence is missing. Green-washing `missing-evidence-manifest` would destroy the only honest signal left.

## Next Steps

1. **Human / release owner**: obtain trusted Microsoft PowerPoint goldens + local evidence envelope.
2. **Role owners**: collect 3 role receipts required by Phase 4 release gate.
3. **Do not** authorize visual-fidelity or 1:1 claims until evidence envelope + receipts exist.
4. **Maintainers**: keep software gates green; do not reopen phases 1–3 without a regression.

AgentWiki publish: **skipped** — `agentwiki` CLI not on PATH; no AgentWiki MCP tools exposed this session. Local journal is source of truth.
