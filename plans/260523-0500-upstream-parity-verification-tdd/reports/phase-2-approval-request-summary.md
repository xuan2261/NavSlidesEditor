---
title: "Phase 2 Approval Request Summary"
date: 2026-05-23
status: approval-request
phase: 2
---

# Phase 2 Approval Request Summary

## Request

Approve Path B + Path C from
`upstream-build-failure-phase-2-decision-record.md`:

- Path B: create `docs/upstream-parity-matrix.md` with affected upstream
  automation rows marked `Blocked`.
- Path C: allow manual oracle capture for selected rows using
  `manual-oracle-capture-protocol.md`.
- Path D: allow only explicit row-level waivers with the full waiver contract.

This request does not ask to mark any row `Pass`.

## Why Approval Is Needed

The upstream oracle is approved, but the approved upstream build fails on the
local Windows/npm/Node environment. The failure reproduced in a clean worktree.

Without this Phase 2 decision, creating `docs/upstream-parity-matrix.md` would
be ambiguous because upstream automation evidence is unavailable.

## Evidence

| Evidence | Status |
|---|---|
| `upstream-oracle-approval-record.md` | Approved oracle |
| `upstream-baseline-report.md` | Current baseline passes; upstream baseline failed |
| `upstream-adapter-harness-design.md` | Adapter/failure decision recorded |
| `pre-approval-matrix-row-seeds.md` | 18 seeds, 0 `Pass`, 18 `Blocked` |
| `manual-oracle-capture-protocol.md` | Row-scoped manual evidence protocol ready |
| `post-approval-matrix-creation-runbook.md` | Matrix creation guardrails ready |
| `future-matrix-audit-report-template.md` | Audit report template ready |

## Recommended Approval Text

```text
I approve creating docs/upstream-parity-matrix.md while approved upstream
automation is unavailable. Rows affected by unavailable upstream automation must
be marked Blocked unless they have complete manual oracle evidence or a signed
waiver. No failed upstream build log may be used as Pass evidence.

Decision path: B + C where feasible; D only by explicit row-level waiver
Approved by: Xuan
Approver role: Project owner
Approval date: 2026-05-23
Approval evidence: approval in this chat
Manual oracle owner: Xuan
MVP P0 waiver policy: MVP P0 waivers are not allowed by default; each waiver
requires explicit row-level approval with owner, approved by, approval date,
expiry, rationale, user impact, rollback decision, and follow-up issue.
```

## Impact If Approved

- `upstream-build-failure-phase-2-decision-record.md` can move to
  `status: approved`.
- `docs/upstream-parity-matrix.md` can be created as `draft-blocked` or
  `report-only`.
- Rows affected by unavailable upstream automation start as `Blocked`.
- No MVP P0 row becomes release-ready without complete upstream/manual oracle
  evidence or a valid waiver.
- Failed upstream build logs remain blocker evidence only.

## Impact If Not Approved

- Phase 2 remains pending.
- `docs/upstream-parity-matrix.md` should not be created.
- Phase 3-7 remain blocked behind the matrix gate.

## Unresolved Questions

- Should the initial matrix status be `draft-blocked` or `report-only`?
- Should manual oracle reviewer be different from the manual oracle owner?
