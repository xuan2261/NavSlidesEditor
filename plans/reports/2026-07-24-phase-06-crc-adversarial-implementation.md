# Phase 6 Implementation Report — CRC Policy + Adversarial Corpus

**Status:** DONE  
**Plan:** `plans/260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd`  
**Date:** 2026-07-24

## Summary

Fail-closed import CRC policy shipped after 0/11 corpus false positives.
Isolated adversarial suite (`npm run test:pptx:adversarial`) covers C1–C6 +
breadth stubs without polluting metrics averages.

## Files Modified / Created

| Path | Action |
| --- | --- |
| `server/services/pptx-import/pptx-guards.js` | CRC fail-closed + `IMPORT_CRC_POLICY` |
| `server/services/pptx-import/pptx-guards.test.js` | C1/C2 RED→GREEN tests |
| `server/services/pptx-import/pptx-import-adversarial-fixtures.js` | Synthetic fixture builders |
| `server/services/pptx-import/pptx-import-adversarial-suite.js` | Expected-outcome runner |
| `server/services/pptx-import/pptx-import-adversarial-suite.test.js` | Vitest coverage |
| `server/data/test-corpus/adversarial/*` | Materialized fixtures + README |
| `server/data/test-corpus/README.md` | Lanes + adversarial table + CRC policy |
| `docs/export-fidelity-and-limits.md` | Import CRC + adversarial lane docs |
| `package.json` | `test:pptx:adversarial` script |
| `plans/reports/2026-07-24-phase-06-crc-corpus-probe.md` | Probe evidence |
| phase-06 + plan.md | Status completed |

**Not touched (ownership):** `server/routes/pptx-import.js`, client wait/HomePage.

## Tests

| Command | Result |
| --- | --- |
| `npx vitest run server/services/pptx-import/pptx-guards.test.js` | 6/6 pass |
| `npx vitest run .../pptx-import-adversarial-suite.test.js` | 5/5 pass |
| `npx vitest run .../nested-package-guard.test.js` | 14/14 pass |
| `npx vitest run .../opc-xml-safety.test.js` | 10/10 pass |
| `npm run test:pptx:adversarial` | 10/10 pass |
| `npm run test:pptx:corpus-metrics` | 11/11 pass; avg semantic 100% |

## Policy

- Mode: **fail-closed**
- Code: `zip-crc-mismatch`
- Mechanism: JSZip `checkCRC32: true` on package load
- No silent warn-only path

## Concerns

1. `opc-inventory.js` and `nested-package-guard.js` still load with
   `checkCRC32: false`. Import entry gate is fail-closed; secondary paths may
   still accept CRC-corrupt nested containers if reached without prior
   `validatePptxPackage`. Follow-up optional if product wants full-path parity.
2. Adversarial EMF/macro/SmartArt stubs exercise **gate** paths only — not
   full semantic mapping fidelity claims.

## Unresolved Questions

None.
