---
phase: 11
title: "Final Release Documentation And Rollback Gate"
status: completed
priority: P1
effort: "3-5d"
dependencies: [7]
---

# Phase 11: Final Release Documentation And Rollback Gate

## Overview

Consolidate implementation and evidence into an executable release decision with independent best-effort, strict/native, browser heuristic, performance, package-first, and G5 rows. This phase is complete at the bounded best-effort software claim ceiling: 69 focused client tests, full lint (0 errors / 27 existing warnings), production build, adversarial, corpus, a critical browser journey (1/1 in 38.7s), and the fresh final-source full-unit gate are recorded. Optional lanes remain blocked, owner-open, skipped, or separately residual; none is promoted into a best-effort pass.

> **Reconciliation note — 2026-07-28:** The original detailed matrices remain execution context. The completion checklist and residuals below are the authoritative closeout record.

## Requirements

- Functional: final matrix reports best-effort, exact-original recovery, strict/native, browser heuristic, tiny/full performance, package-first G0-G4, and G5 statuses separately.
- Functional: best-effort gate depends only on completed core remediation and required evidence; blocked G0-G5 does not deadlock Phase 11.
- Functional: README/docs describe actual wait/cancel/report/visibility/recovery behavior, external-media/security model, and claim ceiling.
- Functional: rollback runbook covers durable saga states, outbox ack failure, missing-head isolation, poisoned startup records, media policy, retention dry-run/compaction restore, and client unknown/cancel races.
- Functional: final command set runs focused tests, full unit, lint, build, serial critical E2E, tiny/full performance and applicable evidence lanes with truthful exit/skip states.
- Functional: private evidence/report scan rejects secrets, raw logs, raw imported content, capabilities, job/authority IDs, private paths and live machine data before publication.
- Non-functional: no commit/push/release is performed by this plan phase; implementation handoff remains explicit.

## Architecture

```text
focused regression -> full unit/lint/build -> serial E2E -> evidence lanes
        -> release matrix
           ├─ best-effort release (core lane; executable without G5)
           ├─ exact-original recovery
           ├─ strict/native blocked/open
           ├─ package-first G0-G4 optional owner-plan status
           └─ G5 PowerPoint optional owner-bound observation/status
```

Machine-owned manifests/test artifacts remain evidence authority. The human-readable matrix reports status and claim scope. Optional package-first/G5 rows are consumed from the sibling owner plan and non-authoritative local observations; they are not Phase 11 dependencies.

## Related Code Files

| Action | File/area | Change |
|---|---|---|
| Modify narrowly | `README.md`, smallest relevant `docs/` surface | User-visible behavior/claim/security updates after implementation |
| Create | `plans/reports/pptx-import-release-readiness-<actual-run-id>.md` | Final matrix with actual run ID and redacted summaries |
| Create | `plans/reports/pptx-import-rollback-runbook-<actual-run-id>.md` | Operational rollback/recovery steps |
| Read/link | Existing P0/P1/package-first plans | Evidence-backed status synchronization; no duplicate gate ownership |
| Verify | `package.json` scripts and CI workflows | Commands remain executable/named accurately |

## Implementation Steps

1. Re-read every phase checklist, owner-plan status, open policy decision and evidence manifest; record completed/blocked/deferred states.
2. Run focused reliability/security/report/retention tests, then full unit/lint/build, then serial critical E2E.
3. Run `npm run test:pptx:adversarial`, corpus, strict, browser, tiny/full performance and oracle integrity lanes; retain expected non-zero/structured skip states.
4. Build a release matrix with separate rows for best-effort, original recovery, async error/visibility/cancel, strict/native, chart/SmartArt, G0-G4 owner-plan status, and G5 owner-bound local evidence/visual status.
5. Verify best-effort terminal state is decidable when G5 is missing and package-first is open. Do not wait indefinitely on optional candidate evidence.
6. Rehearse identity-safe rollback/repair, startup poisoned-record recovery, retention dry-run/restore, and media claim boundary. If durable media manifest is absent, record the narrower claim.
7. Run forbidden-field/redaction scan on every publishable report; keep private full manifests outside normal repository/report publication.
8. Update README/docs only for verified user-visible behavior and durable claim/security changes; do not copy generated metrics into evergreen docs.
9. Run `git diff --check`, inspect changed-file scope and dirty-worktree boundary, and stop before commit/push unless separately requested.
10. If release criteria fail, list exact blockers and preserve any independently shippable best-effort decision; never weaken tests or close a gate by wording.

## Tests Before

- Existing plans disagree on historical metrics/status wording.
- P0/G5 may remain blocked and package-first G0-G5 may remain open.
- Previous Phase 11 dependency graph made optional external gates mandatory.
- Reports may retain private identifiers or raw operational diagnostics.

## Tests After

- Best-effort software-lane decision is explicit and independent of G5; the fresh full-unit gate passes with the residuals recorded below.
- Focused tests, lint, build, adversarial, corpus, critical browser journey, and full-unit evidence are current; optional lanes remain separately labelled.
- Full performance is structured-skipped without its opt-in; strict/native and oracle are recorded as blockers rather than passes.
- Release matrix has no cross-lane promotion or contradictory status.
- Evergreen documentation and user-facing unknown-outcome copy match separate-clock wait, non-destructive recovery, report, visibility, and media/security behavior.
- Rollback runbook covers durable saga, outbox, missing-head, startup, retention, media, and client race boundaries.
- Publishable reports contain only aggregate, non-sensitive information.
- Dirty-worktree review preserves unrelated user changes.

## Completion Checklist — reconciled 2026-07-28

- [x] Every core phase maps to evidence or an explicit residual/blocker.
- [x] Evergreen documentation and runtime unknown-outcome copy reflect separate bounded admission and terminal-wait clocks, admission ambiguity, non-timeout poll recovery, GET-only timeout recovery, current visibility behavior, and report/media boundaries.
- [x] Best-effort, strict/native, browser heuristic, performance, oracle, package-first G0-G4, and G5 have separate readiness rows.
- [x] The sibling package-first plan remains authoritative for G0-G5; G5 is explicitly blocked and no new trust authority is created.
- [x] The rollback runbook covers durable repair, outbox acknowledgement failure, missing-head isolation, poisoned startup records, media policy, retention dry-run/restore, and client unknown/cancel races.
- [x] Retention remains dry-run/default-off and publishable closeout artifacts are aggregate-only.
- [x] Fresh final-source full-unit result passed: 518 test files passed, 1 skipped; 4196 tests passed, 3 skipped; exit 0; duration 1227.75s.

## Test Scenario Matrix

| Release state | Decision |
|---|---|
| Core best-effort tests/evidence green, G5 unavailable | May ship bounded best-effort if product policy accepts; G5 remains blocked |
| Focused reliability/security regression red | Hold; do not ship |
| Strict qualification non-zero | Best-effort may remain; strict/native blocked |
| Browser heuristic pass only | Do not call PowerPoint visual pass |
| G0/G1 incomplete | Package-first claims remain open |
| G2/G4 partial | Promote only exact owner-plan rows with evidence |
| Candidate bundle lacks active owner envelope | G5 blocked; integrity is not owner authorization |
| Valid owner-bound local envelope but threshold fail | Finite G5 negative observation; no claim |
| Valid owner-bound local envelope and finite threshold pass | Candidate input only; sibling owner plan decides any scoped local PowerPoint claim |
| Retention policy not approved | Keep compactor dry-run/default-off |
| Durable media manifest absent | Exclude crash-safe media-consistency claim |

## Regression Gate

```bash
npm run test -- --exclude client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npm run lint
npm run build
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js tests/e2e/critical-pptx-journey.spec.js
npm run test:pptx:adversarial
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:perf
npm run test:pptx:perf:full
npm run test:pptx:oracle:integrity
git diff --check
```

The full-unit command excludes only the documented unrelated baseline failure; retain that failure separately and do not call the exclusion a fix. The fresh final-source full-unit result is **PASS**: 518 test files passed, 1 skipped; 4196 tests passed, 3 skipped; exit 0; duration 1227.75s. Focused client lifecycle evidence is 69 passed tests, lint is 0 errors / 27 existing warnings, the production build passed, and the critical browser journey passed 1/1 in 38.7s. Expected truth-gate failures and structured skips remain listed, not suppressed. The bounded best-effort software lane is therefore closed with explicit residuals; optional G5 and other qualification lanes remain independent.

## Success Criteria — reconciled 2026-07-28

- [x] The final matrix is evidence-backed, claim-separated, and names all known blockers/residuals.
- [x] User-visible docs and rollback instructions match the delivered behavior and policy limits.
- [x] Publishable closeout artifacts are aggregate-only; unrelated dirty files, source, and configuration are outside this closeout edit.
- [x] Final independent best-effort software-lane decision is PASS WITH RESIDUALS after the fresh full-unit completion; this is not a release authorization.
- [x] Strict/native, full browser heuristic, performance, package-first, and G5 readiness remain separate and unresolved as recorded; they are not release passes.

## Risk Assessment

- Risk: documentation says completed while an optional gate is blocked. Mitigation: separate phase status from claim-gate status.
- Risk: full suite exposes unrelated failures. Mitigation: record baseline/diff without hiding failures.
- Risk: rollback runbook is untested. Mitigation: injected-failure/dry-run rehearsal before release decision.
- Risk: best-effort wording overstates media/native/security. Mitigation: matrix rows are contract-specific and claim ceiling remains explicit.

## Security Considerations

Do not publish private PowerPoint evidence, credentials, environment values, capabilities, raw logs, raw imported content, live identifiers, or local-only paths. Preserve the single-user/trusted-proxy statement and warn against public/multi-user deployment without external auth. Destructive repair must remain authority-bound.

## Next Steps

This phase closes the documented best-effort software lane. Deferred residuals and optional qualification lanes remain tracked in the readiness record; commit, push, and release are separate user-authorized actions.
