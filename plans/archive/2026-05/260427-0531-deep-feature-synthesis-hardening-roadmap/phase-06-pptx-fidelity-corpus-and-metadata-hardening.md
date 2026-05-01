---
phase: 6
title: "PPTX Fidelity Corpus And Metadata Hardening"
status: pending
priority: P1
effort: "5-8d"
dependencies: [1]
---

# Phase 6: PPTX Fidelity Corpus And Metadata Hardening

## Context Links

- Audit correction: charts are mapped; diagram flattening exists; do not rebuild chart import from scratch.
- Docs: `docs/pptx-import-fidelity-report.md`
- Code: `server/services/pptx-import/`, `server/routes/pptx-import.js`
- Tests: `server/services/pptx-import/*.test.js`, `tests/e2e/pptx-import-fidelity.spec.js`

## Overview

Harden PPTX Phase E as corpus, gates, metadata, and unsupported-object strategy.
Do not add a JSZip/XLSX parser until chart-heavy evidence proves `pptxtojson`
misses required data.

## Key Insights

- Current strict corpus: 4 files, 97.0% semantic, 99.0% round-trip.
- `mapChart()` already maps chart type and data for supported pptxtojson output.
- `flattenDiagramElement()` converts diagram nodes to shapes up to 50 nodes.
- Remaining gaps: chart legend/axis/style metadata, complex SmartArt hierarchy, OLE/equation fallback, small corpus.
- Strict per-type generated fixture gates exist, but real corpus per-type gates are not yet hard fail.

## Requirements

- Functional: add chart-heavy, SmartArt/diagram, OLE/equation, and large-deck corpus coverage.
- Functional: enforce per-type corpus targets where data exists.
- Functional: preserve and expose chart metadata when available: legend, axis titles, grouping, styles.
- Functional: unsupported OLE/equation objects become clear locked placeholders with warnings.
- Non-functional: no parser rewrite without failing fixture evidence.
- Non-functional: import remains isolated in worker with ZIP/package budget guards.

## Architecture

```text
PPTX corpus fixtures
  -> pptxtojson/importer
  -> mapper/chart mapper/diagram flattener
  -> semantic + round-trip harness
  -> per-type gates + diagnostics
  -> import summary warnings
```

Decision gate:

```text
If pptxtojson exposes chart data -> improve mapper metadata.
If pptxtojson does not expose embedded workbook data on real deck -> create separate parser spike plan.
```

## Related Code Files

- Modify: `server/services/pptx-import/chart-output-to-navslides-mapper.js`
- Modify: `server/services/pptx-import/mapper.js`
- Modify: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
- Modify: `server/services/pptx-import/diagnostics.js`
- Modify: `client/src/utils/pptx-import-summary.js`
- Modify: `client/src/utils/pptx-import-summary.test.js`
- Modify: `docs/pptx-import-fidelity-report.md`
- Add corpus files: `server/data/test-corpus/*.pptx` only if acceptable for repo size, otherwise document external corpus path.
- Modify/Create tests under `server/services/pptx-import/`.
- Modify: `tests/e2e/pptx-import-fidelity.spec.js`
- Delete: none.

## Implementation Steps

1. Add or identify real chart-heavy decks with bar, line, pie/doughnut, scatter, multi-series, legends, axis titles.
2. Add or identify SmartArt/diagram decks with simple, nested, and >50 node cases.
3. Add OLE/equation fixtures or generated fixtures that prove fallback behavior.
4. Extend harness output with real corpus per-type hard gates, not only generated-fixture gates.
5. Add tests that fail on missing chart legend/axis metadata when source provides it.
6. Extend chart mapper only for source fields proven present by fixtures.
7. Add clear diagnostics for unsupported OLE/equation: severity, placeholder type, user-facing warning.
8. Update import summary UI tests for new warning categories.
9. Run strict corpus and record per-type breakdown in docs.
10. Decide whether a separate JSZip/XLSX parser spike is justified. Default: no.

## Todo List

- [ ] Real chart-heavy corpus decision made.
- [ ] Per-type real corpus gates added.
- [ ] Chart metadata tests added before mapper changes.
- [ ] OLE/equation fallback warnings standardized.
- [ ] Strict corpus result documented.
- [ ] Parser rewrite decision recorded.

## Verification & Tests

```bash
npm run test -- server/services/pptx-import
npm run test -- client/src/utils/pptx-import-summary.test.js client/src/components/properties/import-fidelity-properties.test.jsx
npm run test:corpus
npx playwright test tests/e2e/pptx-import-fidelity.spec.js
npm run lint
npm run build
```

Manual smoke:

- Import chart-heavy deck and inspect editable chart data in the editor.
- Import SmartArt deck and inspect flattened nodes vs placeholders.
- Import OLE/equation deck and inspect warnings.

## Success Criteria

- [ ] Corpus contains or references chart-heavy real decks.
- [ ] Strict mode fails when per-type targets regress.
- [ ] Chart metadata improves only where source data exists.
- [ ] Unsupported object fallbacks are explicit and non-crashing.
- [ ] No greenfield chart parser added without evidence.

## Risk Assessment

- Risk: binary corpus bloats repo.
- Mitigation: use small generated fixtures in git and document external real corpus path if needed.
- Risk: per-type gates are flaky across parser output.
- Mitigation: start with diagnostic thresholds, then hard fail after stable baseline.

## Security Considerations

- Keep ZIP bomb/package budget guards.
- Validate MIME/extension and never execute embedded OLE content.
- Treat imported HTML/text content through existing targeted sanitizers.

## Next Steps

If chart data is missing from real decks, create a separate narrow parser spike.

## Unresolved Questions

- Where should real chart-heavy decks live if they are large or copyrighted?
- Does `pptxtojson` expose embedded workbook data for target user decks?
