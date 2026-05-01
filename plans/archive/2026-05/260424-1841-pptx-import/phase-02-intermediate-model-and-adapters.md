---
phase: 2
title: Intermediate Model And Adapters
status: completed
effort: M
---

# Phase 2: Intermediate Model And Adapters

## Context Links

- Benchmark matrix: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/parser-execution-matrix.md`
- Parser decision: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/final-parser-decision.md`

## Overview

Convert parser output into a small internal import model. Use `pptxtojson` as primary and `pptx2json` as fallback inspector only when primary output lacks object evidence.

## Requirements

- Install server deps: `pptxtojson@2.0.2`, `pptx2json@0.0.10`, `jszip@3.10.1`.
- Model deck size, slides, text/image/shape/table/placeholder elements, notes, warnings, stats.
- Build ZIP media index for `ppt/media/*`.
- Validate image MIME before writing to uploads.
- Do not write raw parser outputs outside temp/debug paths.

## Related Code Files

- Create: `server/services/pptx-import/importer.js`
- Create: `server/services/pptx-import/media.js`
- Modify: `server/package.json`
- Modify: `package-lock.json`

## Implementation Steps

1. Add production parser deps only to server workspace.
2. Parse with `pptxtojson` in worker.
3. Invoke `pptx2json` inspector only for missing/empty primary evidence.
4. Create media index from ZIP entries.
5. Persist valid image files to uploads.
6. Normalize warnings and stats.

## Todo List

- [x] Server dependency install
- [x] Primary parser adapter
- [x] Fallback inspector condition
- [x] Media index and MIME validation
- [x] Import orchestration

## Tests

- Adapter returns exact slide count for fixture/corpus.
- Media index rejects non-image payload.
- Fallback inspector is not called when primary output has evidence.
- Import/package failure returns taxonomy.
- No raw output files created by importer.

## Success Criteria

- Valid corpus parses without process crash.
- Images are persisted only after MIME validation.
- Stats identify parser and fallback usage.

## Risk Assessment

- `pptx2json` fallback can be expensive. Mitigation: call only on missing primary evidence.
- Media payloads can be malformed. Mitigation: file-type detection and skip warning.

## Security Considerations

- Validate MIME from bytes.
- Do not persist SVG/imported active content.
- Keep parser output in memory only.

## Next Steps

- Map intermediate model into NavSlides slide schema.
