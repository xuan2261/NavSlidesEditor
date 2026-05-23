---
title: "Upstream Build Failure Phase 2 Decision Record"
date: 2026-05-23
status: pending-decision
phase: 2
---

# Upstream Build Failure Phase 2 Decision Record

## Context

The upstream oracle is approved:

- Remote: `https://github.com/jbirky/parallax-presentations.git`
- SHA: `ce548c535abc7701ac45cc3164560caba121adce`
- Approver: `Xuan`, `Project owner`
- Approval date: `2026-05-23`

Current repo baseline passes. Approved upstream setup/build does not pass on the
local Windows/npm/Node environment.

Primary evidence:

- `upstream-oracle-approval-record.md`
- `upstream-baseline-report.md`
- `upstream-adapter-harness-design.md`
- `phase-2-approval-request-summary.md`
- `manual-oracle-capture-protocol.md`
- `reports/baseline-logs/20260523-101209-upstream-npm-run-build.log`
- `reports/baseline-logs/20260523-104503-upstream-clean-npm-run-build-after-include-optional.log`

## Finding

The approved upstream build failure reproduced in a clean worktree after
`npm ci --ignore-scripts --include=optional`.

The clean install exited 0 but did not materialize
`@rollup/rollup-win32-x64-msvc`. The following `npm run build` failed with the
same missing Rollup native package error.

A no-save diagnostic workaround installed the Rollup native package with
`--legacy-peer-deps`, but the build still failed because the installed upstream
TipTap dependency set is inconsistent:
`@tiptap/extension-highlight` imports `getStyleProperty` from `@tiptap/core`,
but the installed `@tiptap/core` does not export it.

## Decision Needed

Phase 2 cannot honestly mark MVP P0 parity rows as `Pass` from the current
upstream automation evidence.

Choose one path before creating `docs/upstream-parity-matrix.md`:

| Path | Effect | Release meaning |
|---|---|---|
| A. Keep Phase 2 blocked | Do not create matrix until upstream build is fixed or a different approved SHA is selected | Strictest evidence path |
| B. Create matrix with `Blocked` upstream automation rows | Matrix may be created, but affected MVP P0 rows are not release-ready | Best planning path without false parity |
| C. Use manual oracle capture for selected rows | Requires signed manual evidence per row; rows remain non-release-ready unless evidence is complete | Allows progress for visible behavior |
| D. Signed waiver for selected MVP P0 rows | Requires full waiver contract per row | Release-ready only for waived rows |

Recommended path: B plus C where manual capture is feasible. Do not use D unless
the project owner explicitly accepts the release risk for a specific row.

## Guardrails

- Do not patch upstream package manifests or lockfiles inside the oracle
  worktree.
- Do not create upstream-derived fixtures from failed build output.
- Do not mark any row `Pass` using failed upstream build logs.
- Use `Blocked` for rows whose upstream evidence depends on unavailable
  automation.
- Use `Waived` only when owner, approved by, approval date, expiry, rationale,
  user impact, rollback decision, and follow-up issue are complete.
- Security invariant rows remain current-repo obligations even when upstream
  automation is unavailable.
- Manual oracle evidence must follow `manual-oracle-capture-protocol.md`.

## Required Approval To Proceed With Path B/C/D

The statement below is ready for the project owner to approve. It is not active
until this record status changes to `approved`, approver metadata is filled, and
the approval evidence is recorded.

```text
I approve creating docs/upstream-parity-matrix.md while approved upstream
automation is unavailable. Rows affected by unavailable upstream automation must
be marked Blocked unless they have complete manual oracle evidence or a signed
waiver. No failed upstream build log may be used as Pass evidence.
```

## Approval Fields

| Required field | Value |
|---|---|
| Decision path | `B + C where feasible; D only by explicit row-level waiver` |
| Approved by | `TBD` |
| Approver role | `TBD` |
| Approval date | `TBD` |
| Approval evidence | `TBD` |
| Manual oracle owner | `TBD` |
| MVP P0 waiver policy | `TBD` |

## Approval Checklist

- [ ] Decision record status is changed from `pending-decision` to `approved`.
- [ ] Approver name and role are filled.
- [ ] Approval date is filled.
- [ ] Approval evidence is linked or summarized.
- [ ] Manual oracle owner is assigned if Path C is used.
- [ ] Manual oracle capture protocol is linked from matrix metadata if Path C is used.
- [ ] MVP P0 waiver policy is explicit.
- [ ] `docs/upstream-parity-matrix.md` metadata links this decision record.
- [ ] Rows affected by unavailable upstream automation default to `Blocked`.
- [ ] No failed upstream build log is used as `Pass` evidence.
- [ ] Any `Waived` row includes owner, approved by, approval date, expiry,
  rationale, user impact, rollback decision, and follow-up issue.

## Unresolved Questions

- Is Path B approved for Phase 2 planning?
- Who owns manual oracle capture if Path C is used?
- Are any MVP P0 waivers allowed, or should all MVP P0 rows remain blocked until
  upstream automation or manual evidence is complete?
