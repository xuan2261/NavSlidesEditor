---
phase: 4
title: "PPTX Archive Preflight and Bounded CRC"
status: completed
priority: P1
effort: "3-4 engineer-days"
dependencies: []
---

# Phase 4: PPTX Archive Preflight and Bounded CRC

## Context Links

- [Plan overview](./plan.md)
- [PPTX reliability research](./research/pptx-reliability-research.md)
- [Debug baseline](./reports/debug-verification-baseline.md)
- `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md`
- `C:\Work\NavSlidesEditor\docs\pptx-import-fidelity-report.md`

## Overview

Move archive structure/count/declared-size checks ahead of JSZip inflation and
calculate CRC inside the existing bounded stream. Preserve fail-closed package
integrity, public errors, worker containment, and parser compatibility.

## Requirements

### Functional

- Reject file-size, signature, unsafe raw ZIP structure, entry-count, and declared
  decompression limits before entry inflation begins.
- Load JSZip with `checkCRC32:false`; never invoke its eager all-entry CRC path.
- Stream each non-directory entry once, enforcing per-entry and aggregate actual
  byte budgets while calculating CRC32 incrementally.
- Collect XML bytes only where XML inspection needs them; measure other entries
  without retaining their decompressed content.
- Return stable `zip-crc-mismatch` for an in-budget CRC mismatch.
- Budget overflow takes precedence over CRC mismatch for the same stream.
- Cancellation destroys the active entry stream and propagates a stable cancelled
  import outcome.
- Parent archive reload receives the import signal and uses the same safe validator.
- Parser-worker cancellation sends a child abort message for active validation,
  then retains the existing bounded force-termination fallback for parser code
  that cannot cooperate.

### Non-functional

- Preserve `validatePptxPackage()` return shape and `loadPptxArchive()` behavior.
- Preserve 100 MiB compressed, 5,000 entries, 500 MiB decompressed, XML safety,
  worker heap and worker timeout contracts.
- Add no archive dependency unless current raw ZIP + JSZip seams prove insufficient.
- Do not broaden changes to export preflight, nested package guard or OPC inventory.

## Architecture

```text
abort/extension/stat/signature
  -> read compressed bytes under file cap
  -> parseSafeRawEntries(bytes)
  -> entry-count + declared-byte budget
  -> JSZip.loadAsync(bytes, { checkCRC32: false })
  -> required PPTX index entries
  -> for each raw entry:
       bounded inflate stream
       actual-byte charge
       incremental CRC32
       optional XML byte collection + safety inspect
       compare expected CRC
  -> existing return shape
```

Use an internal detailed bounded stream result:

```js
streamBoundedZipEntryDetailed(entry, {
  perEntryCap,
  remainingBudget,
  expectedCrc32,
  signal,
  overflowError
}, collect) -> Promise<{ byteLength, crc32, bytes? }>
```

Implement a small dependency-free incremental CRC owner. Compare unsigned
32-bit values from raw central-directory metadata. Preserve public wrapper
contracts exactly:

```js
readBoundedZipEntry(...) -> Promise<Buffer>
measureBoundedZipEntry(...) -> Promise<number>
```

## File Inventory

| Action | File | Planned change | Test impact |
|---|---|---|---|
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\crc32.js` | Incremental CRC32 | New unit tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\crc32.test.js` | Known vectors/chunk boundaries | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\pptx-guards.js` | Reorder preflight/load/stream and CRC | Guard tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\importer.js` | Pass signal to parent reload | Importer tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\parse-worker.js` | Child AbortController and abort IPC | Worker tests |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\worker-runner.js` | Send abort then bounded force terminate | Worker tests |
| Verify/extend | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\raw-zip.js` | Expose validated expected CRC/metadata only if missing | Raw ZIP tests |
| Create/modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\raw-zip.test.js` | Truncated/forged structure cases | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\pptx-guards.test.js` | Ordering/CRC/abort/error precedence | Focused gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\zip-bomb-guard.test.js` | Prove no eager inflation | Security gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\pptx-import-adversarial-suite.js` | Add ordering fixtures | Adversarial gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\pptx-import-adversarial-suite.test.js` | Assert stable outcomes | Adversarial gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\opc-inventory.js` | Preserve Buffer wrapper consumer | OPC regression tests |
| Create | `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\opc-inventory.test.js` | Valid package inventory through new stream | Store gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\worker-runner.test.js` | Abort IPC/force-kill behavior | Worker gate |
| Modify | `C:\Work\NavSlidesEditor\server\services\pptx-import\perf\stage-timers.test.js` | Guard-stage cost regression | Perf diagnostic |
| Modify | `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md` | Bounded CRC policy | Docs gate |
| Modify | `C:\Work\NavSlidesEditor\docs\system-architecture.md` | Validation order/limits | Docs gate |

## Function and Interface Checklist

- [x] Verify every `validatePptxPackage` and `loadPptxArchive` caller.
- [x] Preserve `IMPORT_CRC_POLICY.errorCode` and public status/type shape.
- [x] Preserve `PackageSafetyError` and XML budget error codes.
- [x] Normalize raw unsigned CRC and reject unsupported/encrypted structures.
- [x] Confirm directory entries do not consume actual-byte/CRC work.
- [x] Preserve `readBoundedZipEntry` Buffer and `measureBoundedZipEntry` number
  contracts for OPC inventory and any external tests.
- [x] Remove JSZip eager CRC without weakening integrity.
- [x] Pass AbortSignal through parser worker and parent revalidation.
- [x] Send abort IPC before bounded child termination; never wait indefinitely
  for `pptxtojson` cooperation.
- [x] Keep performance instrumentation names stable or update all consumers.

## Dependency Map

```text
raw ZIP metadata -> declared safety gate
                 -> JSZip index without eager CRC
                 -> bounded stream + CRC helper
                 -> XML inspection / packageInfo
                 -> parser worker and parent importer
```

No prerequisite phase. Phase 5 depends on this phase to establish a clean,
independently verified PPTX safety baseline before package lifecycle changes.

## Tests Before (RED)

| Scenario | Expected |
|---|---|
| Declared bytes over cap with valid CRC | 413 before any `getContentWorker` call |
| Entries over count cap | 413 before any inflation |
| Highly compressed actual bytes exceed cap | bounded stream stops at cap |
| Bad CRC under all budgets | `zip-crc-mismatch` |
| Bad CRC plus actual overflow | 413 budget error wins |
| Chunked CRC across arbitrary boundaries | equals known whole-buffer vector |
| Abort before read/load/while stream | cancellation, stream destroyed |
| Abort while child validates | child stream aborts or worker is force-terminated within bound |
| Truncated EOCD/local header/name collision | unsafe structure before inflation |
| Missing required PPTX parts | 400 without all-entry inflation |
| Valid corpus archive | same entry/decompressed/file metrics |
| OPC inventory reads XML/nested package | receives Buffer, package publication remains valid |

Instrumentation must assert operation order, not only eventual rejection.

## Implementation Steps

1. Add CRC known-vector tests and minimal helper.
2. Add raw-preflight-before-inflation RED tests using spies/instrumentation.
3. Add OPC wrapper compatibility and worker-abort RED tests.
4. Reorder `validatePptxPackage` while preserving public return/error contracts.
5. Integrate CRC calculation into the internal detailed stream and unwrap public helpers.
6. Add parent signal propagation plus child abort IPC/force-termination fallback.
7. Add malformed/forged/adversarial fixtures and performance assertions.
8. Run focused, adversarial, corpus, lint and docs gates.

## Refactor

- Keep one streaming decompression path.
- Do not create separate CRC and measurement inflations.
- Do not replace JSZip unless required ZIP features fail explicit compatibility tests.
- Keep raw ZIP expansion limited to metadata needed for safe preflight.

## Tests After (GREEN)

- Existing valid and bad-CRC tests remain semantically green.
- Existing import corpus statistics remain stable.
- Parser worker heap/timeout protections remain active.
- Adversarial suite classifies new cases deterministically.
- Peak work is bounded by accepted limits, not rejected declared totals.

## Regression Gate

```powershell
npx vitest run server/services/pptx-import/crc32.test.js server/services/pptx-import/package-store/raw-zip.test.js server/services/pptx-import/pptx-guards.test.js server/services/pptx-import/zip-bomb-guard.test.js server/services/pptx-import/pptx-import-adversarial-suite.test.js server/services/pptx-import/package-store/opc-inventory.test.js server/services/pptx-import/worker-runner.test.js
npm run test:pptx:adversarial
npm run test:pptx:perf
npm run test:corpus
npm run lint
```

`test:corpus` may report truthful importer qualification blockers. The regression
gate requires command integrity and no new guard/corpus regression, not fabricated
native fidelity success. If its native runtime is unavailable, record the named
deferred CI lane under the plan-wide validation policy.

## Success Criteria

- [x] Entry count and declared budget reject before inflation.
- [x] Actual-byte and XML budgets remain bounded during inflation.
- [x] CRC integrity remains fail-closed with stable code.
- [x] Cancellation interrupts the active stream.
- [x] Public bounded-reader wrappers and OPC package publication remain compatible.
- [x] Valid corpus behavior and metrics remain stable when the lane runs.
- [x] Focused, adversarial, perf and lint gates pass; corpus passes locally or has
  named deferred CI evidence.

## Risk Assessment

| Risk / assumption | Observable signal | Pre-decided response |
|---|---|---|
| Raw metadata lacks safe CRC/bounds | direct raw tests cannot verify record | Extend only validated metadata; replan if ZIP64 requires library change |
| Error precedence changes clients | route test expects old diagnostic class | Preserve stable public codes; document intentional 413 precedence |
| CRC implementation is wrong | known vector/chunk tests diverge | Stop; compare against Node/JSZip test oracle, never disable CRC |
| Parent repeats expensive validation | perf stage remains doubled | Keep correctness; record optimization separately unless SLA fails |
| Abort does not stop inflater | worker remains active after signal | Fix stream teardown before proceeding to Phase 5 |

## Security Considerations

- Resource caps are security controls and must be checked before expensive work.
- CRC remains integrity validation, not authenticity.
- Single-job rate limiting/worker heap are defense-in-depth, not substitutes for ordering.

## Todo

- [x] Write RED ordering, CRC and abort tests.
- [x] Implement incremental CRC helper.
- [x] Reorder archive validation and integrate bounded CRC.
- [x] Add parent signal propagation and hostile fixtures.
- [x] Run all phase gates and update docs.
