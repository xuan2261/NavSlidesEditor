# Phase 1: Corpus Ground Truth Inventory

## Context Links

- Plan: [plan.md](./plan.md)
- Corpus: `PPTX/Bai_2_1.pptx`, `PPTX/Bai_2_2.pptx`, `PPTX/Bai_2_5.pptx`, `PPTX/STTre_Duc.pptx`
- NavSlides model: `shared/src/types/presentation.js`
- Import references: `client/src/utils/pdf-import.js`, `client/src/pages/HomePage.jsx`

## Overview

Priority: P0  
Status: Complete  
Goal: create a parser-independent baseline so every candidate is judged against the same facts.

## Key Insights

- The corpus has 145 slides total.
- Existing samples include tables, grouped shapes, connectors, OLE references, WMF/EMF media, math content, notes, layout/master inheritance.
- Ground truth does not mean pixel-perfect PowerPoint rendering. It means objective package inventory plus manual QA notes.

## Requirements

- Count slides, slide layouts, slide masters, notes, images, embedded objects, tables, charts, connectors, groups, placeholders, math nodes.
- Save raw inventory as JSON and markdown.
- Do not mutate sample `.pptx` files.
- Keep benchmark artifacts plan-scoped, not in repo root.

## Architecture

```text
PPTX file
  -> JSZip package scan
  -> XML regex/structured count
  -> baseline JSON per file
  -> corpus summary markdown
```

## Related Code Files

- Created: `scripts/benchmark-pptx-inventory.js`
- Created: `plans/20260424-1508-pptx-parser-benchmark-hard/research/corpus-inventory/*.json`
- Created: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/corpus-ground-truth.md`

## Implementation Steps

1. Add a Node script that scans `.pptx` ZIP entries using `jszip`.
2. For each file, collect package-level counts:
   - `ppt/slides/slide*.xml`
   - `ppt/slideLayouts/slideLayout*.xml`
   - `ppt/slideMasters/slideMaster*.xml`
   - `ppt/notesSlides/*.xml`
   - `ppt/media/*`
   - `ppt/charts/*`
   - `ppt/embeddings/*`
3. For each slide XML, count object markers:
   - `p:sp`, `p:pic`, `p:graphicFrame`, `p:grpSp`, `p:cxnSp`
   - `a:tbl`, `c:chart`, `p:ph`, `a:hlinkClick`, `m:oMath`
4. Capture media extensions and content types.
5. Save one JSON per deck and one aggregate summary.
6. Manually inspect 3 representative slides per deck and add QA notes:
   - one text-heavy slide
   - one table-heavy slide
   - one image/OLE-heavy slide

## Todo List

- [x] Create inventory script spec.
- [x] Generate per-file inventory JSON.
- [x] Generate aggregate markdown report.
- [x] Add manual QA notes for 12 representative slides.
- [x] Mark known hard objects for fallback policy.

## Success Criteria

- Counts are reproducible by rerunning the script.
- Aggregate totals match known corpus shape: 4 decks, 145 slides.
- Report identifies at least 10 high-risk fixture slides for later mapper tests.

## Risk Assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Regex counts misclassify nested XML | Medium | Use counts only as benchmark baseline, not as final parser truth |
| Manual QA too subjective | Medium | Record slide number, visible objects, expected fallback |
| Large artifacts bloat repo | Low | Keep raw parser output in plan research folder; prune before commit if needed |

## Security Considerations

- Treat `.pptx` files as untrusted ZIP/XML. Do not execute embedded scripts or OLE content.
- Do not extract files outside the artifact folder.

## Next Steps

- Phase 2 designs isolated parser runners using this inventory as ground truth.
