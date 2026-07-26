---
phase: 7
title: "Qualification Evidence And Provenance Refresh"
status: pending
priority: P1
effort: "4-7d plus test-run time"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Qualification Evidence And Provenance Refresh

## Overview

Rerun each evidence lane after software remediation, preserve historical artifacts, and publish a corrected readiness record with actual run provenance. Separate best-effort regression health from strict/native, browser, performance, package-first, and PowerPoint claim readiness.

## Requirements

- Functional: corpus metrics state exact corpus/manifest digest, 11-deck scope, parser-relative names, and current results.
- Functional: strict qualification records mapped/unmapped/placeholder totals and structured blockers without fallback corpus substitution.
- Functional: adversarial lane remains isolated from averages and records all cases/exit states.
- Functional: browser audit captures executable/version, manifest digest, UTC run ID, viewport, and artifact pointer; it remains heuristic.
- Functional: tiny and full performance lanes run or record structured `SKIPPED_ENV`/`SKIPPED_RESOURCE`, never silent pass. Full matrix uses real validate → parse → map → package commit where available, repeated samples, p50/p95, peak RSS, timeout stage, and source/config/environment hashes.
- Functional: oracle integrity rejects missing, stale, placeholder, unbounded, or untrusted evidence before comparison; the active sibling local G5 contract remains the owner authority.
- Functional: the selected Phase-3 job-control authority is propagated to oracle/evidence callers for POST admission, SSE/poll GET, authoritative presentation GET, DELETE, and fixture-teardown reconcile; missing/invalid capability or principal is a blocked result, never bypassed.
- Functional: every private run manifest uses one bounded `runProvenance` schema containing run ID, command, source/manifest hashes, code revision, tool/runtime versions, configuration identity without secret values, UTC start/end, exit status or structured skip reason, and artifact pointers.
- Functional: current report corrects `STTre_Duc` wording, 63% metric wording, historical placeholder claims, P1-P3 status, and package-first sequencing.
- Functional: private evidence manifests/reports are separated from publishable aggregate reports; forbidden identifiers/secrets are scanned before publication.
- Functional: candidate G5 output is a typed non-authoritative observation with `authority: observation`, `nonAuthoritative: true`, `sourcePlan`, `ownerGate`, `ownerSubjectHash`, `observedAt`, `freshness`, `outcome`, and `doesNotCloseGates: [G0,G1,G2,G3,G4,G5]`.
- Non-functional: preserve `xuatN26th7` and historical reports unless a separately approved narrow patch is requested.

## Architecture

```text
actual run ID + manifest digest
  -> corpus/parser-relative lane
  -> strict qualification lane
  -> adversarial/security lane
  -> browser structural lane
  -> tiny/full performance lane
  -> oracle integrity/status lane
  -> private manifest + redacted aggregate readiness report
```

No result is promoted across lanes. A red truth gate is a valid blocked result only when its blocker report is structured, bounded, provenance-bound, and safe to retain/share.

## Related Code Files

| Action | File/area | Change |
|---|---|---|
| Create | `plans/reports/pptx-import-readiness-remediation-<actual-run-id>.md` | Corrected dated report; actual run ID, not plan date |
| Create/consume | `EVIDENCE_PRIVATE_DIR/<run-scope>/<actual-run-id>/` | Operator-controlled private manifests and bounded run outputs outside tracked reports |
| Read/modify narrowly | `server/services/pptx-import/oracle/job-lifecycle.js`, `server/services/pptx-import/oracle/package-backed-actuals.js` | Propagate Phase-3 capability/principal authority to every request; classify POST reconcile as fixture teardown only |
| Test/create | Oracle lifecycle/actuals adapter tests and direct-caller fixtures | Missing/invalid authority fails closed; no product timeout-recovery interpretation |
| Run/modify minimally | Corpus/qualification/browser/perf/oracle scripts | Provenance/metric output only when a verified gap exists |
| Read/link | P0/P1/package-first plan references | Cross-link evidence; do not rewrite history or owner gate state |
| Create | Publishable aggregate evidence summary | Alias identifiers; no job/presentation/revision/head IDs |

## Implementation Steps

1. Freeze corpus and manifest hashes; reject missing/extra/duplicate decks.
2. Generate an actual UTC run ID and manifest digest. Do not name evidence from the plan creation date.
3. Run focused unit/adversarial gates first; retain exit codes and bounded output.
4. Run `npm run test:pptx:corpus-metrics`; report semantic metric and reconstructed round-trip stability as separate values.
5. Run strict qualification; record per-deck blockers, aggregate unmapped leaves, placeholders, source hashes, and finite results.
6. Run browser audit with executable/version/provenance capture; retain heuristic wording only.
7. Run both `npm run test:pptx:perf` and `npm run test:pptx:perf:full`. Full lane must measure the real pipeline or emit structured skip with reason; no near-limit readiness is inferred from a skip.
8. Split oracle timeout observation from fixture cleanup in `server/services/pptx-import/oracle/job-lifecycle.js` and `server/services/pptx-import/oracle/package-backed-actuals.js`: `waitForCompletedJob` uses GET-only status inspection and returns typed timeout/unknown; destructive POST `/reconcile` is callable only by an explicit teardown helper after capture. Propagate the Phase-3 capability/principal context through POST admission, job wait GET/SSE, presentation GET, DELETE, and teardown. Add regressions proving authority propagation and that wait timeout never invokes teardown.
9. Run `npm run test:pptx:oracle:integrity` without a bundle when none is supplied; record missing-candidate-bundle/owner-envelope status, not a placeholder conclusion.
10. Quarantine private evidence, reject symlinks/reparse points, cap manifest/receipt/artifact count and bytes, and scan public reports for forbidden fields/secrets before any sharing.
11. Produce the report and proposed stale-wording patch list for `xuatN26th7`; do not overwrite the user-owned report without explicit approval.
12. Reconcile plan references/status text with the fresh evidence and mark optional package-first/G5 rows as open/blocked, not failed best-effort.

## Tests Before

- Existing wording conflates the source-backed `STTre_Duc=174 unmapped native leaf nodes` result with an unsupported total/mapped split and historical placeholder generalizations.
- The inherited 5/11, 378, and 13 strict figures have no current repository manifest/report source; they remain unverified until this phase binds or removes them.
- Browser artifacts have weak/absent provenance.
- Performance full matrix can be `SKIPPED_ENV` and prior gates did not require both tiny/full commands.
- Oracle timeout observation currently reaches a destructive reconcile helper instead of a GET-only unknown result.
- Oracle integrity fails before supplied-bundle inspection.
- Evidence reports may retain live operational identifiers.

## Tests After

- Every artifact has actual run ID, manifest digest, command/config, exit status, and bounded summaries.
- Every oracle/evidence request carries the selected capability/principal authority; missing/invalid authority is recorded as a blocked result and no secret is persisted.
- Oracle wait timeout produces GET-only typed unknown status; only explicit teardown can invoke destructive reconcile.
- Current report says `174 unmapped native leaf nodes` for `STTre_Duc` when that remains fresh; it does not state a total/mapped split without a fresh manifest.
- The aggregate unmapped count is either source-bound to a fresh manifest (including 378 only if reproduced) or the inherited number is removed/updated.
- Metric wording distinguishes semantic fidelity from reconstructed round-trip stability.
- Tiny/full performance results are measured or structured-skipped with no silent qualification.
- Oracle remains blocked without a candidate bundle and active local owner envelope; self-hashed receipts remain integrity evidence only; placeholder evidence is rejected.
- Private reports retain necessary identifiers only in `EVIDENCE_PRIVATE_DIR`; public reports use aliases/aggregates and a non-authoritative observation envelope.
- Forbidden-field scan passes before report publication.

## Function / Interface Checklist

- [ ] Corpus selection is manifest-bound with no fallback/substitution.
- [ ] Metric labels are parser-relative and stable.
- [ ] Strict output retains finite best-effort evidence while strict blocks.
- [ ] Browser report records version/provenance.
- [ ] Tiny/full performance paths and structured skip are recorded.
- [ ] Oracle distinguishes missing candidate bundle/owner envelope, invalid evidence, and visual comparison failure.
- [ ] Oracle wait timeout is GET-only; destructive reconcile is explicit teardown with authority propagation.
- [ ] Evidence ingestion rejects reparse/symlink paths and oversized manifests/artifacts.
- [ ] Publishable summary omits job/presentation/revision/head IDs and secrets.
- [ ] Dated report links exact commands, actual run ID, and plan gates.

## Test Scenario Matrix

| Lane | Pass/blocked meaning |
|---|---|
| Corpus metrics | Parser-relative best-effort regression only |
| Strict qualification | Native mapping/placeholder gate; non-zero is structured blocker |
| Adversarial | Guard/security behavior; isolated from averages |
| Browser audit | Structural/heuristic layout health only |
| Tiny/full perf | Measured pipeline or explicit environment/resource skip |
| Oracle integrity | Evidence trust/boundary prerequisite |
| Oracle caller authority | Missing/invalid capability or principal blocks POST/GET/DELETE/teardown; no bypass |
| Oracle qualification | Candidate observation only; any PowerPoint claim remains subject to the active sibling local owner contract |
| Redaction scan | No forbidden operational identifiers/secrets in publishable report |

## Regression Gate

```bash
npm run test:pptx:adversarial
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:perf
npm run test:pptx:perf:full
npm run test:pptx:oracle:integrity
```

Add the Phase-7 oracle adapter/authority suite before closing this gate; it is a planned new test surface, not a current command. Expected non-zero strict/oracle gates and structured performance skips are retained with reason codes. Run `npm run lint` and `npm run build` after script/report contract changes.

## Success Criteria

- [ ] Corrected actual-run readiness report exists under `plans/reports`.
- [ ] Historical claims are labelled, not silently rewritten.
- [ ] Current metric/evidence wording is claim-safe.
- [ ] Tiny/full performance provenance and skip state are visible.
- [ ] Private/public evidence boundary and forbidden-field scan are enforced.
- [ ] Cross-plan status/dependency text has no stale contradiction.

## Risk Assessment

- Risk: fresh numbers change. Mitigation: tie every number to actual run/manifest/command.
- Risk: reports become release authority accidentally. Mitigation: reports are evidence records; manifests/exit codes remain machine authority.
- Risk: private IDs leak through review artifacts. Mitigation: alias-only aggregate report and forbidden-field scan.
- Risk: full performance lane is unavailable. Mitigation: structured skip blocks only near-limit claim, not best-effort lane.

## Security Considerations

Treat evidence bundles, receipts and package paths as sensitive. Quarantine before parsing, bound all inputs, reject reparse paths, keep private manifests separate, and never publish credentials, environment values, raw logs, live IDs, or raw imported content.

## Next Steps

Phase 8-10 consume/link evidence status only. Phase 11 uses this phase as the required best-effort evidence input; optional package-first/G5 rows remain separately open.
