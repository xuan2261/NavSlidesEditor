# PPTX Full Fidelity Plan Complete

**Date**: 2026-04-25 16:37
**Severity**: Medium
**Component**: pptx-import pipeline
**Status**: Resolved

## What Happened

The `260425-1026-pptx-full-fidelity` plan wrapped up — all 8 phases (0-7) delivered across a single long session. Phase 0-6 handled the heavy lifting: sanitizer, HTML extraction, shapes, tables, charts, slide metadata, and groups. Phase 7 added the testing infrastructure and fidelity report.

## The Brutal Truth

This feels like shipping a foundation with no house on it. We built the entire import pipeline — sanitizer, shape transformers, table layout engine, chart extraction — but the test corpus sits empty. 103 tests pass on synthetic fixtures, which means almost nothing. The moment someone drops a real Fortune 500 pitch deck into `server/data/test-corpus/`, we'll discover gaps the unit tests never caught. The SmartArt gap is the most honest admission: complex hierarchies silently flatten. We documented it but didn't fix it.

## Technical Details

- **103 unit/integration tests** passing across pptx-import suite
- **New artifacts**:
  - `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` — dual-metric CLI tester (semantic + roundtrip)
  - `server/services/pptx-import/pptx-import-e2e-flow.test.js` — 5 integration tests
  - `server/data/test-corpus/` — empty directory, ready
  - `docs/pptx-import-fidelity-report.md` — fidelity targets + known gaps
  - `npm run test:corpus` script added to `package.json`
- **Phase 7 bug**: `buildNested(12)` for depth test was using 11 in an earlier attempt — off-by-one killed the depth boundary test. Worker `child.send({ filePath })` call was missing entirely — the import pipeline silently no-op'd on real files until caught.

## Root Cause Analysis

The plan was scoped as "full fidelity" but the word "fidelity" was never operationalized until Phase 7. We built first, measured later. The fidelity report exists because we finally asked "how good is good enough?" — which should have been the first question. SmartArt lossy flattening is a known architectural constraint: the zip/xml parsing handles groups but doesn't reconstruct the visual hierarchy tree.

## Lessons Learned

- **Measure fidelity upfront**: Define semantic/roundtrip metrics before writing a single transformer. "Full fidelity" is meaningless without numbers.
- **Empty corpus is a red flag**: A test suite with no real-world inputs is a suite that passes trivially. The `test:corpus` script is useless without `.pptx` files.
- **Off-by-one in test fixtures is a discipline failure**: If we had written the depth test before implementing `buildNested`, the 12-vs-11 mistake would have been obvious from the spec, not caught after the fact.
- **Worker IPC is fragile**: `child.send({ filePath })` silently failing is the kind of bug that costs hours. Needs an acknowledgement handshake or error propagation path.

## Next Steps

1. **Populate the corpus**: source 5-10 diverse `.pptx` files (corporate deck, academic slides, heavily styled template, chart-heavy report, SmartArt-heavy) and run `npm run test:corpus`
2. **Address SmartArt gap**: either document as unsupported feature with user warning, or implement a hierarchy reconstruction pass
3. **Playwright roundtrip tests**: fidelity report explicitly calls this out — HTML → PPTX roundtrip stability not yet automated
4. **Chart legend/axis metadata**: partial implementation; needs spec alignment with reveal.js rendering expectations
5. **Table border styles**: limited support; scope which border types (double, dashed, etc.) are actually used in the wild before expanding
