---
phase: 7
title: "Perf Matrix Archive Reuse And Sandbox Eval"
status: completed
priority: P2
effort: "3-5d"
dependencies: [5]
---

# Phase 7: Perf Matrix, Archive Reuse, Sandbox Eval

## Overview

Produce evidence for import resource ceilings (sizes/entries, p50/p95, peak RSS, stage timings); evaluate hash-bound archive inventory reuse without dropping safety revalidation; write residual OS/container sandbox eval for parser/converters. Closes audit P2.1, P2.2, P2.7.

## Context Links

- Ceilings: `constants.js` (100 MiB file, 5000 entries, 500 MiB decompress, 60s parser, 120s import)
- Double pass: worker `validatePptxPackage` + host `loadPptxArchive`
- k6 load tests cover presentations/API/socket only — not PPTX import
- Package-first owns full OfficeCLI Job Object containment

## Requirements

### Functional

**Perf matrix**

- Benchmark harness (script or vitest-perf opt-in) generating packages or using synthetic zip ladders:

| Dimension | Points |
| --- | --- |
| Compressed size | ~1 / 10 / 50 / 100 MiB (100 MiB may assert reject-at-cap or pass-near-cap) |
| Entry count | ~50 / 500 / 5000 |
| Metrics | wall p50/p95, peak RSS if available, stage: parse / revalidate / map / package-commit |

- Output artifact under `plans/reports/` or `server/data/...` **not** required green for every CI agent if resources insufficient — support `PPTX_PERF=1` opt-in; unit-level stage timer contracts always run with tiny fixtures.
- Do **not** raise `MAX_CONCURRENT_RUNNING` as “perf fix”.

**Archive reuse**

- Only if measurable win on matrix:
  - Cache inventory keyed by `(sha256(packageBytes), limitsDigest)`.
  - Reuse only after hash bind; still open bytes for mapping/media as needed.
  - Invalidation tests: different bytes same name → miss; limit change → miss.
- If reuse deferred: write decision note with residual cost (double decompress) — phase still complete for eval path.

**Sandbox eval**

- Written report: what self-hosted Windows Electron + Linux Docker can achieve **without** OfficeCLI G1:
  - env allowlist (phase 5) status
  - network egress residual
  - process isolation residual
  - recommendation: accept risk for single-user **or** block on package-first G1 for higher claims
- No implementation of Job Objects / seccomp in this phase.

### Non-functional

- Harness must not OOM the default CI job; gate heavy ladder behind env flag.
- Keep revalidation safety invariant unless hash-bound reuse proven.

## Architecture

```text
synthetic package builder
  -> importPptxFile / runImport DI
  -> stage timers
  -> JSON report

optional InventoryCache(sha256, limitsDigest) -> opc inventory
```

## File Inventory

| Path | Action |
| --- | --- |
| `server/services/pptx-import/perf/` or `scripts/pptx-import-perf-matrix.js` | Create harness |
| `inventory-cache.js` (optional) | Create if reuse ships |
| tests for cache | Create if reuse ships |
| `plans/reports/…-pptx-import-sandbox-eval.md` | Create |
| package.json script | Optional `test:pptx:perf` |

## Dependency Map

- Soft after phase 5 (env allowlist exists for sandbox narrative).
- Independent of phase 6.

## Tests Before (TDD)

1. Tiny fixture stage timer returns parse/map durations ≥ 0.
2. Inventory cache (if built): hit/miss/invalidation.
3. Near-limit entry count fixture rejects or completes under budget (unit-sized).

## Refactor / Implementation Steps

1. Stage timing hooks (lightweight).
2. Perf harness + opt-in ladder.
3. Measure double-pass cost; decide reuse.
4. Implement reuse only with tests, or document deferral.
5. Write sandbox eval report.

## Tests After

- Default CI: tiny timer + any cache unit tests.
- Manual/opt-in: full ladder artifact attached to plan reports.

## Regression Gate (named now — no phantom globs)

```bash
npx vitest run server/services/pptx-import/perf/stage-timers.test.js
# if inventory cache ships:
npx vitest run server/services/pptx-import/perf/inventory-cache.test.js
node scripts/pptx-import-perf-matrix.js --tiny
# heavy ladder optional:
# PPTX_PERF=1 node scripts/pptx-import-perf-matrix.js --full
```

Always-on: `stage-timers.test.js` must exist and pass. Full ladder may emit structured `{ skipped: true, reason }` JSON — not swallowed shell errors.

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| P1 | Tiny stage timers | Critical |
| P2 | Cache hit/miss (if shipped) | High |
| P3 | Opt-in ladder produces report schema | High |
| P4 | Sandbox eval doc exists | Critical (doc) |

## Function / Interface Checklist

- [x] Stage timer API or instrumentation
- [x] Perf report schema
- [x] Optional inventory cache — **deferred** (decision note)
- [x] Sandbox eval markdown

## Success Criteria

- [x] Always-on unit coverage for timers (+ cache if present)
- [x] Perf report schema stable; at least one opt-in run documented or skip reason recorded
- [x] Sandbox eval explicitly defers OS sandbox to package-first

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| CI OOM | Env-flag heavy ladder |
| Unsafe reuse | Hash + limits digest mandatory |
| Scope into OfficeCLI | Hard non-goal |

## Security Considerations

- Perf work must not disable ZIP/XML guards.
- Sandbox eval must not claim isolation that does not exist.

## Todo

- [x] Timer + tiny tests
- [x] Harness + schema
- [x] Reuse decision + optional impl
- [x] Sandbox eval report
- [x] Regression gate

## Implementation notes (2026-07-24)

- Harness: `server/services/pptx-import/perf/*` + `scripts/pptx-import-perf-matrix.js`
- Scripts: `npm run test:pptx:perf` (tiny), `test:pptx:perf:full` (needs `PPTX_PERF=1`)
- Archive reuse: deferred — `plans/reports/2026-07-24-pptx-import-archive-reuse-decision.md`
- Sandbox: `plans/reports/2026-07-24-pptx-import-sandbox-eval.md`
- Tiny artifact: `plans/reports/2026-07-24-pptx-import-perf-matrix.json`
- Full without env: structured `SKIPPED_ENV` → `…-perf-matrix-full.json`
