# Phase 3: Parser Execution Matrix

## Context Links

- Plan: [plan.md](./plan.md)
- Harness: [phase-02-benchmark-harness-design.md](./phase-02-benchmark-harness-design.md)
- Corpus baseline: [phase-01-corpus-ground-truth-inventory.md](./phase-01-corpus-ground-truth-inventory.md)

## Overview

Priority: P0  
Status: Complete  
Goal: run the 4 parser candidates against all sample decks and produce hard data.

## Key Insights

- Parser success is not enough. Output must be useful for NavSlides mapping.
- `pptxtojson` is expected to produce the closest semantic schema.
- `pptx2json` and `pptx-compose` are expected to preserve raw OOXML but require heavier mapping.
- `ppt-parser` may be useful if its schema is cleaner than `pptxtojson`.

## Requirements

- Run every parser/deck pair.
- Measure performance and schema coverage.
- Compare parser output against Phase 1 ground truth.
- Record exact parser versions from `npm view`.

## Architecture

```text
4 parsers x 4 decks = 16 runs
  -> run result JSON
  -> normalized summary JSON
  -> matrix markdown
  -> fail/pass decision per parser
```

## Related Code Files

- Created: `plans/20260424-1508-pptx-parser-benchmark-hard/research/parser-summary/*.json`
- Created: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/parser-execution-matrix.md`

## Implementation Steps

1. Install or isolate parser dependencies.
2. Run matrix:
   ```powershell
   node scripts/pptx-parser-benchmark/run-all.js `
     --input PPTX `
     --out plans/20260424-1508-pptx-parser-benchmark-hard/research
   ```
3. For each run, collect:
   - `ok`
   - `durationMs`
   - `peakMemoryMb`
   - `rawOutputSizeMb`
   - `slideCount`
   - element counts by type
   - media extraction count
   - notes extraction count
   - warnings/errors
4. Compare with ground truth:
   - slide count exact match
   - text/shape/table/image count approximate match
   - detect missing layouts/notes/media
5. Produce matrix:
   | Parser | Deck | Parse | Slides | Text | Images | Shapes | Tables | Media | Notes | Time | Memory | Verdict |
6. Add failure details below the matrix, one section per failed candidate.

## Todo List

- [x] Run all 16 parser/deck combinations.
- [x] Record exact package versions.
- [x] Save normalized summaries.
- [x] Save raw output only when useful and safe.
- [x] Produce execution matrix.
- [x] Flag the top 2 parser candidates for Phase 4.

## Success Criteria

- Matrix includes all 16 runs.
- At least one semantic parser and one raw parser are evaluated fully.
- Failures are actionable, not vague.

## Risk Assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Parser chokes on WMF/EMF/OLE | Medium | Mark as fallback area; do not block text/image/shape/table decision |
| Counts differ because parsers classify objects differently | Medium | Compare usefulness, not only raw count equality |
| Browser-only parser needs DOM APIs | Low | Add optional browser harness if candidate looks promising |

## Security Considerations

- Do not open extracted media in unsafe viewers from automation.
- Do not include sensitive slide content in public reports unless approved.

## Next Steps

- Phase 4 evaluates whether outputs can map to NavSlides cleanly.
