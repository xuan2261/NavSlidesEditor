# Journal: PPTX charts E2 + SmartArt model cook

**Date:** 2026-07-09  
**Plan:** `260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`

## Landed

- Corpus chart tests T5.2–T5.5: `chart-bars-lines` + `chart-pie-scatter` → native charts, gap 0
- `ooxml-diagram-parser` + inject SmartArt nodes with shared `_pptxDiagram` model
- Flatten path stamps `_pptxDiagram` for parser diagram elements
- Worker ready ack default 15s (Windows cold start)

## Note

`diagram-process-flow.pptx` contains **no** `ppt/diagrams/*` parts — E3 cannot be proven on that deck until fixture updated.

## Remaining

- Real LO goldens; EMF; full roundtrip; true layout from drawing.xml for SmartArt
