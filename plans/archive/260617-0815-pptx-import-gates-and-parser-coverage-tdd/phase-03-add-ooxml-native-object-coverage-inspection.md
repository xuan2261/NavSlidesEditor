# Phase 03: Add OOXML Native Object Coverage Inspection

## Context Links

- Chart mapping only increments mapped native charts: `server/services/pptx-import/mapper/map-presentation.js:31-37`
- Diagram input is flattened to shapes/lines, never returned as native diagram output: `server/services/pptx-import/mapper/map-diagram.js:85-110`
- Current mapped stats shape: `server/services/pptx-import/mapper/map-presentation.js:149-187`
- Importer currently whitelists stats fields and will drop additive stats: `server/services/pptx-import/importer.js:36-57`
- Existing package/chart evidence precedent: `server/services/pptx-import/parse-worker.js:14-27`, `scripts/pptx-parser-benchmark/summarize-parser-output.js:34-39,78-103`

## Overview

- Priority: `P1`
- Status: `pending`
- Goal: detect native chart/SmartArt OOXML evidence and report coverage gaps additively when mapped output does not preserve a native `chart`/`diagram`.

## Key Insights

- Current stats can only tell what the mapper emitted, not what the package actually contained. That hides real parser degradation cases. Sources: `server/services/pptx-import/mapper/map-presentation.js:149-187`, `server/services/pptx-import/importer.js:36-57`.
- SmartArt is already intentionally flattened, so native SmartArt coverage will often be `0` by design; the missing piece is honest reporting, not native rendering in this plan. Source: `server/services/pptx-import/mapper/map-diagram.js:85-110`.
- JSZip is already available through validated package loading in `server/services/pptx-import/pptx-guards.js:65-137`; no second unzip path or new dependency is needed.

## Requirements

- Functional:
  1. Inspect OOXML slide/package evidence for native chart and SmartArt presence.
  2. Emit additive `stats` describing evidence counts, mapped native counts, and gap counts.
  3. Emit additive `warnings` when evidence exists on a slide but mapped output lacks a native `chart` or `diagram`.
- Non-functional:
  1. Keep importer API backward compatible; new fields must be additive.
  2. Do not rewrite parser selection, mapper strategy, or SmartArt rendering.
  3. Keep new helper files under the repo size guideline.

## Architecture

- Data flow:
  1. `validatePptxPackage()` returns validated `zip` in `server/services/pptx-import/pptx-guards.js:65-137`.
  2. A new read-only inspector scans `ppt/slides/_rels/slideN.xml.rels` and, if needed, `ppt/slides/slideN.xml` for chart and SmartArt relationship evidence.
  3. `mapPptxOutput()` compares OOXML evidence with mapped slide elements and accumulates additive coverage stats plus warnings.
  4. `importer.js` must forward the additive nested stats instead of dropping them.
- Recommended output shape:

```js
stats.nativeObjectCoverage = {
  chartEvidenceCount,
  smartArtEvidenceCount,
  mappedNativeChartCount,
  mappedNativeDiagramCount,
  chartCoverageGapCount,
  smartArtCoverageGapCount,
}
```

- Warning types:
  - `native-chart-evidence-unmapped`
  - `native-smartart-evidence-unmapped`

## Related Code Files

- Modify:
  - `server/services/pptx-import/mapper/map-presentation.js`
  - `server/services/pptx-import/importer.js`
  - `server/services/pptx-import/mapper/map-presentation.test.js`
  - `server/services/pptx-import/pptx-import-e2e-flow.test.js`
- Create:
  - `server/services/pptx-import/ooxml-native-object-inspector.js`
  - `server/services/pptx-import/ooxml-native-object-inspector.test.js`
- Delete:
  - None.
- Exclusive ownership this phase:
  - Only the files above.

## Implementation Steps

1. Red:
   Add inspector unit tests using synthetic JSZip slide rel/xml fixtures for chart evidence, SmartArt evidence, no evidence, and mapped/no-gap cases.
2. Red:
   Extend mapper/integration tests so additive `stats.nativeObjectCoverage` and warnings must appear in final import results.
3. Implement:
   Add a small read-only OOXML inspector helper; prefer regex/string evidence checks over full XML parsing.
4. Implement:
   Wire the helper into `mapPptxOutput()` and emit per-slide warnings plus aggregate additive stats.
5. Implement:
   Update `importer.js` to preserve the new additive stats instead of reconstructing a lossy whitelist-only `stats` object.
6. Verify:
   Run the new unit/integration tests, then rerun strict corpus to ensure warning/stat additions do not affect gate math.

## Todo List

- [x] Add OOXML inspector tests.
- [x] Add mapper/import integration assertions for additive stats/warnings.
- [x] Implement read-only package evidence inspection.
- [x] Preserve additive stats through `importer.js`.
- [x] Re-run targeted tests and strict corpus.

## Success Criteria

- Import results expose additive native-object coverage stats.
- A deck with OOXML chart/SmartArt evidence but no mapped native chart/diagram produces clear warnings.
- Existing fields (`slideCount`, `chartCount`, `warnings`, `presentation`) keep their shape.

## Risk Assessment

- High, medium impact:
  - SmartArt OOXML can have multiple relationship files per object, so naive counts can overstate exact object totals.
  - Mitigation: count evidence conservatively and name the field `*EvidenceCount`, not “exact object count.”
- Medium, high impact:
  - If `importer.js` is not updated, mapper tests can pass while API consumers never see the new fields.
  - Mitigation: add an integration assertion that inspects the final returned `stats`.
- Low, medium impact:
  - Extra zip reads add latency on large decks.
  - Mitigation: inspect only small slide rel/xml text already inside the validated zip; no media inflation, no second archive load.

## Security Considerations

- Only inspect text from already validated zip entries.
- No new external I/O, no new parser package, no execution of OOXML payloads.

## Rollback Plan

- Remove the inspector helper and additive stats/warnings together.
- Keep the current chart/diagram mapping behavior unchanged if rollback is needed.

## Next Steps

- Blocker to Phase 4: additive coverage stats survive the importer boundary and tests prove no contract break.
- Optional follow-up, explicitly out of this plan: native SmartArt rendering/editor support.
