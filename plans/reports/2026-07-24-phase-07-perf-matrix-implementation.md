# Phase 7 Implementation Report — Perf Matrix / Archive Reuse / Sandbox Eval

**Status:** DONE  
**Plan:** `plans/260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd`  
**Date:** 2026-07-24

## Summary

Always-on stage timers + synthetic ladder harness; heavy ladder gated by
`PPTX_PERF=1` with structured skip JSON; archive reuse **deferred** with
decision note; sandbox eval defers OS isolation to package-first G1.

## Files Created

| Path | Role | LOC (approx) |
| --- | --- | --- |
| `server/services/pptx-import/perf/stage-timers.js` | Stage timer + p50/p95 | 64 |
| `server/services/pptx-import/perf/stage-timers.test.js` | P1 always-on | 93 |
| `server/services/pptx-import/perf/synthetic-package.js` | Tiny/size/entry builders | 88 |
| `server/services/pptx-import/perf/report-schema.js` | Report + skip schema | 82 |
| `server/services/pptx-import/perf/report-schema.test.js` | Schema unit tests | 52 |
| `server/services/pptx-import/perf/matrix-summary.js` | Digests + finalize | ~70 |
| `server/services/pptx-import/perf/run-matrix.js` | Tiny/full runner | ~190 |
| `server/services/pptx-import/perf/run-matrix.test.js` | Skip + tiny schema | 53 |
| `scripts/pptx-import-perf-matrix.js` | CLI | 92 |
| `plans/reports/2026-07-24-pptx-import-sandbox-eval.md` | Sandbox eval | — |
| `plans/reports/2026-07-24-pptx-import-archive-reuse-decision.md` | Reuse deferral | — |
| `plans/reports/2026-07-24-pptx-import-perf-matrix.json` | Tiny run artifact | — |
| `plans/reports/2026-07-24-pptx-import-perf-matrix-full.json` | Structured skip | — |

## Files Modified

| Path | Change |
| --- | --- |
| `package.json` | `test:pptx:perf`, `test:pptx:perf:full` |
| phase-07 + plan.md | status completed |

**Not touched:** `MAX_CONCURRENT_RUNNING`, client lifecycle, crash suite, Job Objects/seccomp, inventory-cache production wire-up.

## Archive reuse decision

**Deferred.** Tiny double-pass residual is real but absolute cost low; no
sustained ceiling win proven. Preferred future key:
`(sha256(packageBytes), limitsDigest)`. Residual cost: worker + host full
`validatePptxPackage`.

## Sandbox eval recommendation

- Single-user: accept process+budget+env-allowlist residual.
- Higher claims: block on package-first G1.

## Tests

| Command | Result |
| --- | --- |
| `npx vitest run …/perf/stage-timers.test.js` | 5/5 pass |
| `npx vitest run …/perf/report-schema.test.js` | 3/3 pass |
| `npx vitest run …/perf/run-matrix.test.js` | 3/3 pass |
| `node scripts/pptx-import-perf-matrix.js --tiny` | ok, report written |
| `node scripts/pptx-import-perf-matrix.js --full` (no env) | `SKIPPED_ENV` JSON, exit 0 |
| `npm run test:pptx:perf` | ok |

## Concerns

1. Size ladder points 50/100 MiB intentionally `SKIPPED_RESOURCE` inside full mode
   unless pad cap raised offline (avoids CI OOM).
2. `map` stage in harness is host byte re-read prep, not full `mapPptxOutput`
   (keeps always-on CI cheap; full semantic map still available via corpus lanes).
3. EMF converter still inherits full env when enabled — noted in sandbox eval.

## Unresolved Questions

None.
