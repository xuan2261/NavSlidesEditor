# Journal: PPTX import cook resume — Phase 02–04

**Date:** 2026-07-09  
**Plan:** `plans/archive/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`
**Mode:** `/ck:cook --auto --tdd` (resume)

## Landed

- Phase 02 machinery **complete** (with visual debt):
  - PNG encode/decode + goldens compare
  - 11 corpus placeholder goldens + `baseline-ssim.json`
  - `npm run test:pptx:oracle` golden mode; `--require-lo` → exit 2
- Phase 03 harden:
  - graphicFrame ↔ rel by rId (no multi-frame smear)
  - reconcile: empty-mapped hard fail only under `PPTX_SLA_STRICT_COUNT`; count heuristic is warning
- Phase 04:
  - `table-unusable` in primitive placeholder ban list
  - PNG dim/inflate caps

## Verify

- 37 unit tests pass (1 LO skip)
- `test:pptx:oracle` exit 0 with `debt: true`, meanSsim 1 (self-compare)

## Not claimed

- Real present-mode SSIM vs LO/PP goldens
- Full primitive parity / charts / SmartArt / EMF / roundtrip SLA

## Next

1. Playwright present capture → `--actuals-dir`
2. Node-level scene-graph mapping (`_pptxSource.nodeId`)
3. Phase 04 placeholder ban on core corpus under strict primitives
