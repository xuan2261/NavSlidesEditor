---
title: "Post-Approval Matrix Creation Runbook"
date: 2026-05-23
status: pre-approval-runbook
phase: 2
---

# Post-Approval Matrix Creation Runbook

## Scope Guard

This runbook prepares the future creation of `docs/upstream-parity-matrix.md`.
It is not the matrix, is not release evidence, and does not approve Phase 2.

Do not execute this runbook until one of these conditions is true:

- `upstream-build-failure-phase-2-decision-record.md` is `status: approved`; or
- `upstream-baseline-report.md` is updated with a passing upstream build/setup
  baseline.

## Required Inputs

| Input | Required state |
|---|---|
| `upstream-oracle-approval-record.md` | `status: approved` |
| `upstream-baseline-report.md` | Approved SHA referenced; build pass or blocker documented |
| `upstream-build-failure-phase-2-decision-record.md` | `status: approved` if upstream automation remains unavailable |
| `pre-approval-parity-matrix-schema.md` | Current schema reviewed |
| `pre-approval-matrix-row-seeds.md` | Row seeds reviewed |
| `manual-oracle-capture-protocol.md` | Required if manual evidence is used |
| `pre-approval-matrix-audit-checklist.md` | Audit checklist ready |
| `future-matrix-audit-report-template.md` | Used to save completed audit result |

## Creation Steps

1. Confirm gate state:
   ```powershell
   Test-Path docs\upstream-parity-matrix.md
   rg -n "status:" plans\260523-0500-upstream-parity-verification-tdd\reports\upstream-build-failure-phase-2-decision-record.md
   rg -n "status:" plans\260523-0500-upstream-parity-verification-tdd\reports\upstream-baseline-report.md
   ```
2. Create `docs/upstream-parity-matrix.md` from
   `pre-approval-parity-matrix-schema.md` and
   `pre-approval-matrix-row-seeds.md`.
3. Copy metadata exactly:
   - approved upstream remote
   - approved upstream SHA
   - approver and approval date
   - upstream baseline status
   - Phase 2 blocker decision link
   - manual oracle protocol link if used
4. Convert row seeds:
   - preserve `id`
   - keep MVP P0 rows as `Blocked` unless row-scoped upstream/manual oracle
     evidence is complete
   - do not use failed upstream build logs as `Pass` evidence
   - do not use local tests alone as upstream parity evidence
5. Compute counters:
   - total rows
   - MVP P0 rows
   - `Pass`
   - `Fail`
   - `Partial`
   - `Unknown`
   - `Blocked`
   - `Waived`
6. Run the audit checklist manually against the created matrix and save a
   separate audit report under `reports/` using
   `future-matrix-audit-report-template.md`.

## Initial Matrix Metadata Template

```markdown
---
title: "Upstream Parity Matrix"
date: 2026-05-23
status: draft-blocked
---

# Upstream Parity Matrix

## Metadata

| Field | Value |
|---|---|
| Approved upstream remote | `https://github.com/jbirky/parallax-presentations.git` |
| Approved upstream SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Approver | `Xuan`, `Project owner`, `2026-05-23` |
| Upstream baseline status | `upstream-baseline-failed` |
| Phase 2 blocker decision | `upstream-build-failure-phase-2-decision-record.md` |
| Manual oracle protocol | `manual-oracle-capture-protocol.md` |
| Generated date | 2026-05-23 |
```

## Row Conversion Template

```markdown
| id | area | tier | securityInvariant | behaviorContract | edgeCases | upstreamEvidence | localEvidence | status | waiver | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| <seed-id> | <area> | <tier> | <yes/no> | <contract> | <edge cases> | Upstream automation unavailable; see upstream-baseline-report.md and manual oracle evidence if attached | <local evidence> | Blocked | n/a | Do not mark Pass without row-scoped upstream/manual oracle evidence |
```

## Audit Commands

```powershell
Test-Path docs\upstream-parity-matrix.md
rg -n "Fail with ticket|status.*Pass|failed upstream build.*Pass" docs\upstream-parity-matrix.md
rg -n "Blocked|Waived|manual oracle|upstream-baseline-failed" docs\upstream-parity-matrix.md
npm test -- tests/unit/electron-release-readiness-contract.test.js
```

## Stop Conditions

Stop matrix creation if any of these happen:

- Phase 2 decision record is still `pending-decision` while upstream automation
  is unavailable.
- A row would be marked `Pass` using failed upstream build logs.
- An MVP P0 row has local evidence but no upstream/manual oracle evidence and
  is not marked `Blocked` or `Waived`.
- A waiver is missing owner, approved by, approval date, expiry, rationale, user
  impact, rollback decision, or follow-up issue.
- Security invariant row depends on upstream behavior instead of local
  enforcement.

## Unresolved Questions

- Who performs the first matrix audit?
- Should the initial matrix be `draft-blocked` or `report-only` while upstream
  automation is unavailable?
