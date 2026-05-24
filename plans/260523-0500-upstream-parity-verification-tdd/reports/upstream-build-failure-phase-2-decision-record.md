---
title: "Upstream Build Failure Phase 2 Decision Record"
date: 2026-05-23
status: approved
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

## Approved Decision

Phase 2 cannot honestly mark MVP P0 parity rows as `Pass` from the current
upstream automation evidence.

The project owner approved Path B plus Path C where feasible. Path D remains
available only by explicit row-level waiver.

| Path | Effect | Release meaning |
|---|---|---|
| A. Keep Phase 2 blocked | Not selected | Strictest evidence path |
| B. Create matrix with `Blocked` upstream automation rows | Approved and applied in `docs/upstream-parity-matrix.md` | Planning may proceed without false parity |
| C. Use manual oracle capture for selected rows | Approved where feasible; no row has evidence attached yet | Allows later progress for visible behavior |
| D. Signed waiver for selected MVP P0 rows | Not approved globally; requires explicit row-level waiver | Release-ready only for waived rows |

Result: `docs/upstream-parity-matrix.md` exists as `draft-blocked`. All rows
remain `Blocked`, with `Pass 0` and `Waived 0`.

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

## Approval Statement

The project owner approved the following statement on `2026-05-23`:

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
| Approved by | `Xuan` |
| Approver role | `Project owner` |
| Approval date | `2026-05-23` |
| Approval evidence | User confirmed the Phase 2 approval request in this chat with "xác nhận, /goal resume". |
| Manual oracle owner | `Xuan` |
| MVP P0 waiver policy | MVP P0 waivers are not allowed by default; each waiver requires explicit row-level approval with owner, approved by, approval date, expiry, rationale, user impact, rollback decision, and follow-up issue. |

## Approval Checklist

- [x] Decision record status is changed from `pending-decision` to `approved`.
- [x] Approver name and role are filled.
- [x] Approval date is filled.
- [x] Approval evidence is linked or summarized.
- [x] Manual oracle owner is assigned if Path C is used.
- [x] Manual oracle capture protocol is linked from matrix metadata if Path C is used.
- [x] MVP P0 waiver policy is explicit.
- [x] `docs/upstream-parity-matrix.md` metadata links this decision record.
- [x] Rows affected by unavailable upstream automation default to `Blocked`.
- [x] No failed upstream build log is used as `Pass` evidence.
- [x] Any `Waived` row includes owner, approved by, approval date, expiry,
  rationale, user impact, rollback decision, and follow-up issue. There are no
  waived rows in the current matrix.

## Unresolved Questions

- Which MVP P0 rows should receive manual oracle evidence first?
- Who reviews and signs off manual oracle evidence?
