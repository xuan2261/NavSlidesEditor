---
phase: 1
title: "Baseline Contracts And Evidence Inventory"
status: completed
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 1: Baseline Contracts And Evidence Inventory

## Overview

Freeze the current claim ceiling, reproduce confirmed residuals with green characterization tests, and create the ownership ledger that later phases must satisfy. This phase changes no production behavior and must not leave ordinary CI with intentional red tests.

## Requirements

- Functional: record current best-effort, exact-original, Contract B, cancellation, report, resource, security, retention, and evidence semantics with source/test ownership.
- Functional: characterize H2, ghost-row/ack, H3 environment, parser error loss, external-media policy, media/snapshot budgets, report export exposure, retention physical storage, progress, and release-DAG gaps.
- Functional: each future behavior has one implementation phase and one activation test; current behavior assertions are clearly labelled characterization.
- Non-functional: preserve historical artifacts; do not relabel truth-gate failures as success.
- Non-functional: no application source or public contract changes in this phase.

## Architecture

Use a contract ledger, not a new runtime service:

```text
source + current test -> green characterization -> desired invariant -> owner phase -> acceptance gate
```

The ledger distinguishes parser-relative corpus, strict importer, adversarial/security, browser heuristic, performance, package-first, and PowerPoint evidence lanes. It also records whether a finding is confirmed, stale, historical, conditional, or externally blocked.

## Related Code Files

| Action | File/area | Purpose |
|---|---|---|
| Read/characterize | `server/routes/pptx-import.js`, `client/src/utils/pptx-job-wait.js`, `client/src/pages/HomePage.jsx` | Admission, wait, cancel, status and visibility flow |
| Read/characterize | `server/services/pptx-import/package-store-runtime.js`, `server/services/pptx-import/package-store/import-commit.js`, `server/services/pptx-import/compatibility-outbox.js`, `server/services/pptx-import/compatibility-view.js`, `server/services/package-backed-presentation-read.js` | Outbox/authority ordering and ghost-row seam |
| Read/characterize | `server/routes/presentations.js`, `server/routes/explore.js`, `server/routes/sync.js` | Shared-reader consumers and response contracts |
| Read/characterize | Worker/importer/media/mapper/snapshot/converter/diagnostics files | Resource, security, report and cancellation boundaries |
| Read/characterize | `server/services/pptx-import/package-store/state-store.js`, `server/services/pptx-import/package-store/collector.js`, `server/services/pptx-import/original-package.js` | Durable lifecycle and physical-retention constraints |
| Create | `plans/reports/pptx-import-baseline-260726.md` | Immutable baseline summary with bounded metadata only |
| Test only | Existing focused suites and plan-local future-test manifest | Green characterization and deferred desired cases |

## Implementation Steps

1. Re-read current source, README, related plans, and dirty-worktree boundary; record exact source-backed facts.
2. Add or update **green** characterization assertions for:
   - SSE deadline skips final GET and fallback can receive a fresh budget;
   - direct wait callers and Home cleanup ownership;
   - destructive POST reconcile behavior;
   - apply/ack failure and missing-head list-wide 422 behavior;
   - durable DELETE visibility omission;
   - parser `output-empty` type loss;
   - post-202 async failure status loss;
   - converter full-environment inheritance and PATH lookup;
   - loopback background URL allowance and aggregate-budget bypass;
   - worker-close/media cleanup settlement;
   - snapshot limits and report/export exposure;
   - unbounded durable StateStore history;
   - non-monotonic progress;
   - missing/duplicate performance and oracle provenance.
3. Put desired behavior not yet implemented in `it.todo`/skipped cases or a non-CI manifest; do not make normal Vitest gates intentionally red.
4. Create a dependency ledger assigning every finding to one phase and one file owner. Flag shared `import-commit.js` as Phase 3-only.
5. Record policy gates separately from deterministic code corrections: job capability/principal, quarantine mode, durable media manifest, retention, external URLs, and G5 trust.
6. Capture command exit codes and bounded summaries; do not include environment values, credentials, raw logs, imported content, or private paths.

## Tests Before

| Scenario | Expected current characterization |
|---|---|
| SSE completion at deadline | Final durable read is absent or outcome is unknown under current code |
| POST reconcile on a completed job | Destructive rollback behavior is captured and labelled unsafe for automatic timeout use |
| Ack after compatibility apply | Potential projection/head inconsistency is captured |
| Missing package head in list | Current whole-list HTTP 422 is captured; literal 500 is not asserted |
| Durable DELETE with non-listable projection | Contract-B visibility bypass is captured |
| Empty parser output | Explicit `output-empty` is currently reduced to parse failure |
| Background data URL | Per-URL allow/block exists; aggregate reservation is absent |
| Report export | Editor report may flow into external DTOs under current behavior |
| Progress 80 → 70 | Current finite progress can regress |
| Physical retention | Index/WAL/root history is not compacted by job-array changes |

## Tests After

- Baseline tests remain green and distinguish characterization from desired behavior.
- Every deferred desired test has exactly one later owner and activation condition.
- Baseline report contains current status, source references, command results, and no secrets/private raw data.

## Function / Interface Checklist

- [x] Admission deadline, child transport signal, cancel control signal, final GET, and destructive repair callers are enumerated separately.
- [x] `listable` is recorded as a current row-existence predicate, not treated as authoritative openability.
- [x] Shared reader callers in presentations, explore, bulk sync, and single sync are enumerated.
- [x] `import-commit.js` has one owner: Phase 3.
- [x] Async terminal errors are distinguished from synchronous HTTP admission statuses.
- [x] Media, background, snapshot, converter, report, StateStore/WAL and evidence trust boundaries are recorded.
- [x] All named commands and test paths exist or are marked as planned new tests.

## Test Scenario Matrix

| Risk | Characterization | Desired owner |
|---|---|---|
| H2 wait race/authority misuse | SSE deadline, fresh fallback, destructive reconcile | 2 |
| Contract B/ghost | Ack after apply, missing-head 422, DELETE visibility | 3 |
| Resource/security | Converter env/path, URL policy, media/snapshot/abort | 4 |
| UX/diagnostics | Report navigation/export, category mapping, cancel/countdown | 5 |
| Durable operations | Lifecycle, tombstone, physical StateStore/WAL retention | 6 |
| Evidence | Provenance, perf, redaction, trust/root status | 7 |
| Package-first | Non-mutating G0-G5 handoff only | 8-10 |
| Release | Independent best-effort terminal gate | 11 |

## Regression Gate

```bash
npx vitest run client/src/utils/pptx-job-wait.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx server/routes/pptx-import-crash-points.test.js server/services/pptx-import/compatibility-outbox.test.js
npm run test:pptx:adversarial
```

The gate passes when current characterization is green, the baseline report is written, every desired case has an owner, and no claim is promoted.

## Success Criteria

- [x] Baseline report contains exact current evidence and historical/stale labels.
- [x] No ordinary CI gate depends on an intentional red test.
- [x] Every recommendation maps to one implementation/qualification phase.
- [x] No duplicate production file ownership remains across Phases 2-6.
- [x] Security and evidence reports contain no secrets, raw logs, source content, or private identifiers.

## Risk Assessment

- Risk: characterization encodes a bug as desired behavior. Mitigation: separate labels and later activation tests.
- Risk: source paths/statuses drift. Mitigation: re-check source before each implementation phase and record run date.
- Risk: dirty user files are overwritten. Mitigation: write only plan/report-owned artifacts after explicit inspection.

## Security Considerations

Imported files are untrusted package input even in the trusted-author single-user model. Do not expose job capabilities, environment values, credentials, raw diagnostics, or authority identifiers in the baseline.

## Next Steps

Phase 3 owns the server consistency/error DTO contract. Phase 2 and Phase 4 may scout in parallel but close only after consuming that contract. Phase 7 refreshes evidence after software phases.
