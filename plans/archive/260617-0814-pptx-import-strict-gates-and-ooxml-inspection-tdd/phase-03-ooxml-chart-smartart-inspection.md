# Phase 03 OOXML Chart SmartArt Inspection

## Overview

Priority: Medium  
Status: Superseded  
Goal: surface native chart and SmartArt evidence from the PPTX ZIP without rewriting the parser.

## Requirements

- Add a focused helper under `server/services/pptx-import/`.
- Count native chart entries and SmartArt/diagram data entries.
- Add additive stats and warnings only; no existing response contract breaks.
- Do not implement a full OOXML parser.

## Related Files

- `server/services/pptx-import/ooxml-inspection.js`
- `server/services/pptx-import/ooxml-inspection.test.js`
- `server/services/pptx-import/mapper/map-presentation.js`
- `server/services/pptx-import/importer.js`

## Steps

1. Add JSZip-based tests for chart and SmartArt entry detection.
2. Add integration-style mapper test for additive stats/warnings.
3. Implement helper and map/import integration.

## Success Criteria

- Stats include OOXML counts.
- Warnings appear only when OOXML native objects exist but mapped native chart/diagram support is absent.
