---
phase: 11
title: "Final Release Documentation And Rollback Gate"
status: pending
priority: P1
effort: "3-5d"
dependencies: [7]
---

# Phase 11: Final Release Documentation And Rollback Gate

## Overview

Consolidate implementation and evidence into an executable release decision with independent best-effort, strict/native, package-first, and PowerPoint rows. This phase can close the bounded best-effort lane while G0-G5 remain optional open/blocked inputs. It also verifies rollback, redaction, physical-retention safety, and documentation accuracy.

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

- Best-effort decision is explicit and independent of G5.
- Focused tests/full unit/build/lint/serial E2E results are current.
- Tiny/full performance result is measured or structured-skipped.
- Release matrix has no contradictory status or claim promotion.
- README/docs match actual wait/cancel/report/visibility/recovery/security behavior.
- Rollback runbook covers durable saga, outbox, missing-head, startup, retention and media boundaries.
- Publishable reports pass forbidden-field scan.
- Dirty-worktree review proves unrelated user changes were preserved.

## Function / Interface Checklist

- [ ] Every core phase checklist maps to evidence or a named blocker.
- [ ] Public API/client wording matches GET-only timeout recovery and Contract B.
- [ ] Resource/status/report/security claims match actual source/tests.
- [ ] Best-effort and strict/native labels are separate.
- [ ] Package-first owner plan remains authoritative for G0-G5.
- [ ] G5 is accepted by the active owner contract or explicitly blocked; Phase 11 does not create a new trust authority.
- [ ] Rollback/repair actions are identity-safe and tested.
- [ ] Retention is policy-approved and physically safe, or remains dry-run.
- [ ] Publishable artifacts contain no forbidden identifiers/secrets.

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

The full-unit command excludes only the documented unrelated baseline failure at `client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx`; retain that failure as a separate baseline and do not call the exclusion a fix. Expected truth-gate failures and structured skips must be listed, not suppressed. Full best-effort closure requires no unresolved core implementation contradiction, not closure of optional G5.

## Success Criteria

- [ ] Final matrix is evidence-backed and claim-separated.
- [ ] Best-effort release has an executable independent decision.
- [ ] User-visible docs match actual behavior and security boundaries.
- [ ] Rollback/runbook covers all high-risk seams and policy-limited claims.
- [ ] Private/public evidence handling is safe.
- [ ] No unrelated dirty files or secrets are changed/committed.

## Risk Assessment

- Risk: documentation says completed while an optional gate is blocked. Mitigation: separate phase status from claim-gate status.
- Risk: full suite exposes unrelated failures. Mitigation: record baseline/diff without hiding failures.
- Risk: rollback runbook is untested. Mitigation: injected-failure/dry-run rehearsal before release decision.
- Risk: best-effort wording overstates media/native/security. Mitigation: matrix rows are contract-specific and claim ceiling remains explicit.

## Security Considerations

Do not publish private PowerPoint evidence, credentials, environment values, capabilities, raw logs, raw imported content, live identifiers, or local-only paths. Preserve the single-user/trusted-proxy statement and warn against public/multi-user deployment without external auth. Destructive repair must remain authority-bound.

## Next Steps

After this phase and plan validation, implementation may begin with the cook command in `plan.md`. Commit, push, and release are separate user-authorized actions.
