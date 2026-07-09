# Journal: PPTX import cook — nodeId + present capture

**Date:** 2026-07-09  
**Plan:** `260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Mode:** `/ck:cook --auto --tdd` (resume)

## Landed

- `_pptxSource.nodeId` attach (kind-preferring sequential) on map
- Reconcile uses nodeId coverage; `PPTX_SLA_STRICT_NODES` hard-fail
- Layout placeholder inject when slide has no text (T4.2)
- Present capture: Playwright screenshots of `generateRevealHTML` → actuals PNGs
- Scripts: `test:pptx:oracle:capture`

## Verify

- 39 focused unit tests + 139 mapper/oracle regression tests green
- Capture smoke: 1 corpus deck → actual PNG written

## Remaining for full SLA

- Real LO/PP multi-slide goldens at 960×540
- Full corpus node coverage / T3.9 snapshot
- Phase 04 permanent placeholder = 0 on core decks
- Charts / SmartArt / EMF / roundtrip phases
