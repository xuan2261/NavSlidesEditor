---
title: "Pre-Approval Matrix Audit Checklist"
date: 2026-05-23
status: pre-approval-checklist
phase: 2
---

# Pre-Approval Matrix Audit Checklist

## Scope Guard

This checklist audits the future `docs/upstream-parity-matrix.md`. It is not the
matrix, does not contain row results, and is never release evidence by itself.
Only a completed future audit report against `docs/upstream-parity-matrix.md`
may become release evidence after Phase 1 approval, upstream baseline evidence,
and the Phase 2 blocker decision are complete when upstream automation is
unavailable.

## Audit Inputs

| Input | Required before audit |
|---|---|
| `upstream-oracle-approval-record.md` | Complete and signed |
| `upstream-baseline-report.md` | References approved SHA and upstream run logs |
| `upstream-adapter-harness-design.md` | Adapter path selected and run logs linked |
| `upstream-build-failure-phase-2-decision-record.md` | Approved if upstream automation is unavailable |
| `manual-oracle-capture-protocol.md` | Required if manual oracle evidence is used |
| `pre-approval-feature-inventory-notes.md` | Converted into candidate rows |
| `pre-approval-matrix-row-seeds.md` | Reviewed before conversion |
| `post-approval-matrix-creation-runbook.md` | Followed after gate approval |
| `future-matrix-audit-report-template.md` | Used for completed matrix audit report |
| `pre-approval-parity-matrix-schema.md` | Applied to every row |

## Metadata Gate

- [ ] Matrix contains approved upstream remote URL.
- [ ] Matrix contains approved immutable SHA.
- [ ] Matrix contains approver name and approval date.
- [ ] Matrix contains adapter harness log links.
- [ ] Matrix contains upstream baseline status and blocker summary.
- [ ] Matrix links the Phase 2 blocker decision if upstream automation is unavailable.
- [ ] Matrix links manual oracle protocol if manual evidence is used.
- [ ] Matrix generated date is recorded.
- [ ] Matrix row ids preserve reviewed seed ids where applicable.
- [ ] Matrix was created only after Phase 2 blocker decision approval or upstream build blocker resolution.
- [ ] Completed audit report is created from `future-matrix-audit-report-template.md`.
- [ ] Unknown count, MVP P0 blocker count, and waiver count are recorded.

## Row Shape Gate

- [ ] Every row has `id`.
- [ ] Every row has `area`.
- [ ] Every row has `tier`.
- [ ] Every row has `securityInvariant`.
- [ ] Every MVP P0 row has `behaviorContract`.
- [ ] Every MVP P0 row has `edgeCases`.
- [ ] Every MVP P0 row has `upstreamEvidence` or signed waiver.
- [ ] Every MVP P0 row has `localEvidence` or signed waiver.
- [ ] Every MVP P0 row has one allowed `status`.

## Release Semantics Gate

- [ ] No MVP P0 row is release-ready with `Fail`.
- [ ] No MVP P0 row is release-ready with `Partial` unless signed waiver exists.
- [ ] No MVP P0 row is release-ready with `Unknown` unless signed waiver exists.
- [ ] No MVP P0 row is release-ready with `Blocked`.
- [ ] No `Fail with ticket` wording appears.
- [ ] Every `Waived` row has owner, approved by, approval date, expiry, rationale, user impact, rollback decision, and follow-up issue.
- [ ] Waiver expiry dates are in the future.

## Security Invariant Gate

- [ ] Security invariant rows are marked `securityInvariant = yes`.
- [ ] Security invariant rows do not depend on upstream passing the same behavior.
- [ ] Presenter token, share token, password leak, SSRF, import/upload safety, path traversal, secret redaction, and artifact leakage are represented or explicitly deferred with rationale.
- [ ] Any security invariant failure blocks release unless signed waiver exists.

## Evidence Gate

- [ ] Upstream evidence points to approved SHA logs, screenshots, or manual oracle notes.
- [ ] Local evidence points to tests, reports, or manual checklist artifacts that actually cover the behavior contract.
- [ ] Evidence scope matches row scope; narrow tests do not support broad claims.
- [ ] Non-automation uncertainty is recorded as `Unknown`; unavailable upstream automation is recorded as `Blocked` unless complete manual oracle evidence or signed waiver exists.
- [ ] Failed upstream build logs are not used as `Pass` evidence.
- [ ] Rows depending on unavailable upstream automation are `Blocked` unless manual oracle evidence or signed waiver exists.
- [ ] Manual oracle evidence follows `manual-oracle-capture-protocol.md`.
- [ ] No row seed with `defaultStatus = Blocked` is converted to `Pass` without row-scoped upstream/manual oracle evidence and passing local evidence.

## Counter Gate

- [ ] README feature area count matches inventory notes.
- [ ] MVP P0 row count is recorded.
- [ ] Extended P1/P2 row count is recorded.
- [ ] Optional audit row count is recorded.
- [ ] Unknown count is recorded.
- [ ] Blocker count is recorded.
- [ ] Waiver count is recorded.

## Audit Output Template

```markdown
## Matrix Audit Result

- Audit date:
- Auditor:
- Approved SHA:
- Matrix path:
- MVP P0 rows:
- Pass:
- Fail:
- Partial:
- Unknown:
- Blocked:
- Waived:
- Release-ready: yes/no
- Blocking rows:
- Waivers expiring before release:
- Unresolved questions:
```

## Unresolved Questions

- Who owns the final matrix audit?
- Should release readiness require a second reviewer for waived MVP P0 rows?
- Who approves Phase 2 matrix creation while upstream automation is unavailable?
