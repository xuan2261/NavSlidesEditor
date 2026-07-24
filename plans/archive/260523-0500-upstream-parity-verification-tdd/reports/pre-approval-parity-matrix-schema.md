---
title: "Pre-Approval Parity Matrix Schema"
date: 2026-05-23
status: pre-approval-schema
phase: 2
---

# Pre-Approval Parity Matrix Schema

## Scope Guard

This schema prepares the future `docs/upstream-parity-matrix.md` only. It is not
the matrix, does not contain live parity status, and must not be used for release
readiness. The upstream oracle approval record is complete, but the approved
upstream baseline currently fails; affected rows must not become release-ready
without complete manual oracle evidence or a signed waiver.

Audit reference for the future matrix: `pre-approval-matrix-audit-checklist.md`.
Candidate row seeds: `pre-approval-matrix-row-seeds.md`.
Creation runbook: `post-approval-matrix-creation-runbook.md`.

## Required Matrix Metadata

| Field | Required value |
|---|---|
| Approved upstream remote | From `upstream-oracle-approval-record.md` |
| Approved upstream SHA | From `upstream-oracle-approval-record.md` |
| Approver | From `upstream-oracle-approval-record.md` |
| Matrix generated date | ISO date |
| Adapter harness | Link to `upstream-adapter-harness-design.md` and actual run logs |
| Upstream baseline status | Link to `upstream-baseline-report.md`; record pass/fail/blocker summary |
| Phase 2 blocker decision | Link to `upstream-build-failure-phase-2-decision-record.md` when upstream automation is unavailable |
| Manual oracle protocol | Link to `manual-oracle-capture-protocol.md` when manual evidence is used |
| Unknown count | Integer |
| MVP P0 blocker count | Integer |
| Waiver count | Integer |

## Required Row Fields

| Column | Meaning | Required for MVP P0 |
|---|---|---|
| `id` | Stable row id, e.g. `editor-create-save-reload` | Yes |
| `area` | Feature area from README inventory | Yes |
| `tier` | `MVP P0`, `Extended P1`, `Extended P2`, or `Optional audit` | Yes |
| `securityInvariant` | `yes` / `no`; `yes` overrides upstream parity | Yes |
| `behaviorContract` | Precondition, action, visible result, state/persistence/export impact | Yes |
| `edgeCases` | Required edge cases and negative paths for the behavior | Yes |
| `upstreamEvidence` | Approved SHA link/log/screenshot/manual oracle note; failed build logs prove only blocked automation, not pass behavior | Yes unless approved waiver |
| `localEvidence` | Automated test/report/manual checklist link | Yes unless approved waiver |
| `status` | One allowed status from status table below | Yes |
| `waiver` | Owner, approved by, approval date, expiry, rationale, user impact, rollback decision, follow-up issue | Required when status is waived |
| `notes` | Short constraints / risk notes | Optional |

## Allowed Status Values

| Status | Release meaning |
|---|---|
| `Pass` | Release-ready for this row |
| `Fail` | Not release-ready |
| `Partial` | Not release-ready for MVP P0 unless waived |
| `Unknown` | Not release-ready for MVP P0 unless waived |
| `Blocked` | Not release-ready; dependency, failed upstream automation, or missing evidence |
| `Waived` | Release-ready only if waiver fields are complete and unexpired |

`Fail with ticket` is not an allowed release-ready state.

## MVP P0 Row Template

```markdown
| id | area | tier | securityInvariant | behaviorContract | edgeCases | upstreamEvidence | localEvidence | status | waiver | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| editor-create-save-reload | Editing core | MVP P0 | no | Precondition: approved oracle app and current app both loaded. Action: create deck, edit text, save/reload. Expected: edited text persists and remains editable. State/export impact: presentation JSON contains edited element content. | Save failure, reload after navigation, empty title/content | TBD after approved oracle baseline | `tests/e2e/editor.spec.js`; `tests/e2e/element-lifecycle.spec.js` | Unknown | n/a | Convert after approval |
```

## Security Invariant Row Template

```markdown
| id | area | tier | securityInvariant | behaviorContract | edgeCases | upstreamEvidence | localEvidence | status | waiver | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| security-presenter-token-cross-room | Live presentation | MVP P0 | yes | Precondition: two rooms with different presenter tokens. Action: reuse token across room. Expected: join/navigation rejected; no viewer state changes. State/export impact: no cross-room authority. | Missing token, malformed token, valid token for another room | Upstream parity is not sufficient; invariant must hold locally | `tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js` | Unknown | n/a | Security invariant overrides upstream |
```

## Waiver Template

```markdown
Waiver:
- Row id:
- Owner:
- Approved by:
- Approval date:
- Expiry date:
- Rationale:
- User impact:
- Rollback decision:
- Follow-up issue:
```

## Transition Checklist

- [x] Approval record complete.
- [ ] Approved upstream SHA copied into matrix metadata.
- [ ] Adapter harness run logs linked.
- [ ] Upstream baseline status copied into matrix metadata.
- [ ] Phase 2 blocker decision linked if upstream automation is unavailable.
- [ ] Manual oracle protocol linked if manual evidence is used.
- [ ] Pre-approval row seeds reviewed before conversion.
- [ ] Post-approval creation runbook followed after gate approval.
- [ ] Pre-approval inventory rows converted into matrix rows.
- [ ] Every MVP P0 row has upstream evidence or waiver.
- [ ] Every MVP P0 row has local evidence or waiver.
- [ ] Every MVP P0 row has explicit edge cases.
- [ ] Security invariant rows added and marked as upstream-independent.
- [ ] Unknown count, blocker count, and waiver count computed.
- [ ] No `Fail with ticket` wording appears in the matrix.
- [ ] `pre-approval-matrix-audit-checklist.md` passes after the matrix is created.

## Unresolved Questions

- Whether Path B/C/D in `upstream-build-failure-phase-2-decision-record.md` is approved.
- Whether waiver approvals need the same approver as the upstream oracle.
