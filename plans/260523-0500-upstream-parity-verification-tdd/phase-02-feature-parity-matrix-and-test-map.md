---
phase: 2
title: "Feature Parity Matrix And Test Map"
status: pending
priority: P0
effort: "2-3d"
dependencies: [1]
---

# Phase 2: Feature Parity Matrix And Test Map

## Context Links

- [Overview](./plan.md)
- [Pre-approval feature inventory notes](./reports/pre-approval-feature-inventory-notes.md)
- [Pre-approval parity matrix schema](./reports/pre-approval-parity-matrix-schema.md)
- [Pre-approval matrix audit checklist](./reports/pre-approval-matrix-audit-checklist.md)
- [Pre-approval matrix row seeds](./reports/pre-approval-matrix-row-seeds.md)
- [Upstream build failure Phase 2 decision record](./reports/upstream-build-failure-phase-2-decision-record.md)
- [Phase 2 approval request summary](./reports/phase-2-approval-request-summary.md)
- [Manual oracle capture protocol](./reports/manual-oracle-capture-protocol.md)
- [Post-approval matrix creation runbook](./reports/post-approval-matrix-creation-runbook.md)
- [Future matrix audit report template](./reports/future-matrix-audit-report-template.md)
- `README.md`
- `docs/project-roadmap.md`
- `docs/code-standards.md`

## Overview

Create the single source of truth for all features, elements, controls, logic, and flows. Every row gets upstream expected behavior, current status, automated coverage, manual coverage, and risk.

Oracle approval is complete, but approved upstream automation is unavailable
because the upstream build fails in both the primary and clean verification
worktrees. Phase 2 execution and `docs/upstream-parity-matrix.md` remain pending
until `upstream-build-failure-phase-2-decision-record.md` is approved or the
upstream build blocker is resolved.

## Requirements

<!-- Updated: Validation Session 1 - MVP P0 release gate scope confirmed -->

**Functional:**
- Create `docs/upstream-parity-matrix.md`.
- Cover README feature areas: editing, 20 element types, slides, live, games, AI, themes/templates, export/share, cloud sync, version history.
- Split rows into `MVP P0`, `Extended P1/P2`, and `Optional audit` so release readiness is not all-or-nothing.
- Treat only MVP P0 rows as release-blocking by default. Keep P1/P2 rows visible as backlog/report-only unless explicitly promoted.
- For every MVP P0 row, include behavior contract: precondition, action, expected visible result, expected state/persistence/export impact, upstream evidence link, and edge cases.
- Add security invariant rows that are independent of upstream behavior: authz, token revocation, import sandboxing, path traversal, SSRF, secret redaction, artifact leakage.
- Link existing tests where available.
- Mark one allowed schema status: `Pass`, `Fail`, `Partial`, `Unknown`, `Blocked`, or `Waived`.
- Mark rows that depend on unavailable upstream automation as `Blocked` unless
  complete manual oracle evidence or a signed waiver exists.

**Non-functional:**
- Matrix must be concise enough to maintain.
- No fake pass status without test/report link.
- `Fail with ticket` is not release-ready for MVP P0. Use `Blocked` unless a signed waiver exists.
- Failed upstream build logs are not `Pass` evidence.

## Architecture

```text
README feature inventory -> parity matrix -> tests/manual checklist -> release gate
```

## Related Code Files

**Read:**
- `README.md`
- `tests/e2e/**/*.spec.js`
- `client/src/**/*.test.*`
- `server/**/*.test.js`
- `shared/tests/*.test.js`

**Create:**
- `docs/upstream-parity-matrix.md`

## Implementation Steps

1. Extract feature inventory from README.
2. Map existing tests with `rg --files`.
3. Build matrix sections:
   - Editor core
   - Ribbon controls
   - Element types
   - Slide flows
   - Export/import
   - Present/live/share
   - Games
   - AI/media/cloud/desktop
4. Add risk tier: P0 user flow, P1 important, P2 secondary.
5. Add MVP cut:
   - create/edit/save/reload
   - representative text/image/shape/code/table/chart/media elements
   - present navigation
   - export HTML/PDF
   - import `.navslides`
   - share basic password/revoke
6. Add missing-test backlog for extended rows without blocking MVP release.
7. Add security invariant rows that must fail the gate even if upstream matches an insecure behavior.

## TDD / Tests

- Red: create or identify one executable MVP P0 parity test that currently lacks an assertion.
- Green: fill required matrix fields and link the executable test/report.
- Refactor: dedupe repeated test links and keep row names stable.

## Todo List

- [x] Draft pre-approval feature inventory notes without parity status.
- [x] Draft pre-approval matrix schema without parity status.
- [x] Draft pre-approval matrix audit checklist without parity status.
- [x] Draft pre-approval matrix row seeds without `Pass` status.
- [x] Draft upstream build failure Phase 2 decision record.
- [x] Add ready-to-sign approval fields/checklist to Phase 2 decision record.
- [x] Draft manual oracle capture protocol for Path C.
- [x] Draft post-approval matrix creation runbook.
- [x] Draft future matrix audit report template.
- [x] Draft Phase 2 approval request summary.
- [ ] Approve Phase 2 path for unavailable upstream automation.
- [ ] Create matrix doc.
- [ ] Add required sections.
- [ ] Map existing tests.
- [ ] Mark unknowns honestly.
- [ ] Add executable MVP parity/report audit for matrix gaps.

## Success Criteria

- 100% README feature areas represented as MVP, Extended, or Optional audit rows.
- Every MVP P0 row has local evidence plus approved upstream automation evidence
  or manual oracle evidence; otherwise it is `Blocked` or covered by a signed
  release waiver.
- No MVP P0 row is counted release-ready as `Fail with ticket`.
- Extended P1/P2 unknowns are visible and do not masquerade as MVP readiness.
- Unknown count is visible.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Matrix becomes stale | High | Add report audit and docs update rule |
| Too granular to maintain | Medium | Group low-risk controls under shared rows |
| README row lacks behavior semantics | High | Require behavior contract and upstream evidence for MVP P0 rows |
| P0 failure gets ticketed through release | Critical | Require pass or signed waiver with owner, approved by, approval date, expiry, rationale, user impact, rollback decision, and follow-up issue |
| Failed upstream build gets treated as parity evidence | Critical | Require `Blocked` status unless manual oracle evidence or signed waiver exists |

## Security Considerations

- AI/cloud/GitHub rows must avoid secrets in fixtures.
- Security invariant rows override parity status; an upstream-equivalent vulnerability remains a blocker.

## Red Team Adjustment

- Matrix is no longer just a README inventory. MVP P0 rows need executable behavior contracts, upstream evidence, and strict pass/waiver release semantics.
- Docs-shape contract tests are de-emphasized; gating should come from executable product/security checks.

## Next Steps

- Use matrix gaps to drive Phase 3-5 tests.

## Unresolved Questions

- Whether Vietnamese manual checklist mirror is required in this plan.
- Whether Path B/C/D in `upstream-build-failure-phase-2-decision-record.md` is approved.
