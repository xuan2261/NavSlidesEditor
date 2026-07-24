# PPTX Import Archive Reuse Decision

**Date:** 2026-07-24  
**Phase:** 7 — Perf Matrix, Archive Reuse, Sandbox Eval  
**Status:** **DEFERRED** (hash-bound inventory cache not shipped)

## Context

Import performs a double package pass today:

1. **Worker** — `parse-worker.js` → `validatePptxPackage` (CRC, entry/size budgets, XML safety)
2. **Host** — `importer.js` → `loadPptxArchive` → full `validatePptxPackage` again

Optional third path: package-store `buildOpcInventory` also decompresses for OPC inventory.

## Measurement (tiny matrix)

Harness: `server/services/pptx-import/perf/run-matrix.js` stages `parse` / `revalidate` / `map`.

| Observation | Evidence |
| --- | --- |
| Stage timers always ≥ 0 | `perf/stage-timers.test.js` (CI always-on) |
| Double-pass residual cost | Report field `doublePass.residualCost` + `meanRatio` on tiny runs |
| Sustained win at ceiling sizes | Not proven without `PPTX_PERF=1` heavy ladder on agent hardware |

Tiny absolute revalidate cost is small; unsafe skip of revalidation is high risk relative to gain.

## Decision

**Do not ship inventory/archive reuse in this phase.**

Preferred future key if re-opened:

```text
cacheKey = (sha256(packageBytes), limitsDigest)
limitsDigest = sha256({ maxFileBytes, maxZipEntries, maxDecompressedBytes, …xml budgets })
```

Reuse contract (non-negotiable if implemented later):

- Bind only after full hash of package bytes (not path/name).
- Invalidate on limits digest change.
- Still open source bytes for mapping/media extraction.
- Never skip CRC / entry / decompress / XML safety on first admission of unknown bytes.
- Hit/miss/invalidation unit tests required before wiring into importer.

## Residual cost accepted

- Full decompress + CRC + budget walk **twice** per import (worker + host).
- Additional inventory path when package-store commit runs.

## Explicit non-goals this phase

- No production `inventory-cache.js` wired into importer.
- No raise of `MAX_CONCURRENT_RUNNING`.
- No dropping host revalidation “for speed.”

## Revisit trigger

Ship hash-bound cache only when `PPTX_PERF=1` full ladder shows revalidate dominates wall time near 50–100 MiB / 5k entries **and** safety contract tests pass.
