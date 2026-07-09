# Journal: PPTX import cook — OOXML charts + primitives

**Date:** 2026-07-09  
**Plan:** `260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Mode:** `/ck:cook --auto --tdd`

## Landed

- `ooxml-chart-parser.js`: parse bar/line/pie/… series from chart XML caches
- `injectChartsFromSceneGraph`: create native chart elements for graph chart nodes
- map-presentation wires inject + chart support matrix under strict
- attach prefers `sourceId` / `name` before sequential kind match
- Phase 04 primitive ban unit coverage (`table-unusable`)

## Verify

- 36 focused chart/primitive tests green
- Mapper golden + scene-graph regression re-run

## Remaining

- Full corpus E2=0 when worker import path verified in CI
- Real LO goldens; SmartArt; EMF; roundtrip Phase 08
