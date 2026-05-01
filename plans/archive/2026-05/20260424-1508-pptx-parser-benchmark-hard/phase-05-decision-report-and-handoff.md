# Phase 5: Decision Report And Handoff

## Context Links

- Plan: [plan.md](./plan.md)
- Execution matrix: [phase-03-parser-execution-matrix.md](./phase-03-parser-execution-matrix.md)
- Mapper feasibility: [phase-04-navslides-mapping-feasibility.md](./phase-04-navslides-mapping-feasibility.md)

## Overview

Priority: P1  
Status: Complete  
Goal: produce a final benchmark decision and a clean next-plan handoff for `.pptx` editable import.

## Key Insights

- This plan does not implement the importer.
- It selects parser strategy and defines implementation scope.
- The likely architecture is hybrid: semantic parser primary, raw OOXML parser fallback.

## Requirements

- Final report must choose one of:
  - `pptxtojson` primary + `pptx2json` fallback
  - `ppt-parser` primary + raw fallback
  - raw-only strategy
  - stop/no-go if none are viable
- Report must include rejected parser reasons.
- Report must include next implementation phases.

## Architecture Decision Template

```text
Decision:
  Primary parser:
  Fallback parser:
  Runtime:
  Supported Phase 1 objects:
  Fallback objects:
  Explicit non-goals:

Evidence:
  Corpus:
  Parser matrix:
  Mapper score:
  Security notes:

Next plan:
  Import UI:
  Parser adapter:
  Mapper:
  Placeholder handling:
  Tests:
```

## Related Code Files

- Created: `plans/20260424-1508-pptx-parser-benchmark-hard/reports/final-parser-decision.md`
- Future: follow-up plan folder for implementation, if approved.

## Implementation Steps

1. Summarize benchmark results.
2. Choose primary parser and fallback strategy.
3. Document exact Phase 1 import scope:
   - editable: text, image, shape, table
   - placeholder: chart, equation, OLE, SmartArt, uncertain/grouped complex objects
4. Create TODO backlog for later editability expansion:
   - charts editable
   - equations to LaTeX
   - group editing
   - connectors with endpoints
   - theme/master fidelity
5. Define implementation plan skeleton:
   - parser adapter module
   - intermediate model
   - mapper modules
   - import UI
   - tests and benchmark regression
6. Define go/no-go threshold.

## Go/No-Go Threshold

Proceed to implementation only if one strategy meets all:

- Parses all 4 sample decks or has documented recoverable failures.
- Preserves exact slide count.
- Extracts usable text from at least 90% of slides.
- Extracts images/media refs from at least 80% of image-bearing slides.
- Gives enough geometry for text/image/shape/table mapping.
- Does not require LibreOffice, Java, Python, PowerPoint, or network service.

## Todo List

- [x] Write final parser decision report.
- [x] Record rejected candidates.
- [x] Define implementation scope and non-goals.
- [x] Draft follow-up implementation plan.
- [x] Update roadmap/changelog only if benchmark leads to accepted feature plan.

## Success Criteria

- User can approve one parser strategy without re-reading raw outputs.
- Next implementation plan can start from the decision report.
- Unsupported objects are intentionally scoped, not forgotten.

## Risk Assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| No parser reaches threshold | High | Stop and reassess; do not build weak importer |
| Parser winner is unmaintained | Medium | Prefer hybrid and isolate adapter |
| Benchmark overfits 4 decks | Medium | Add more fixture decks before production rollout |

## Security Considerations

- Final decision must state whether raw sample outputs are safe to commit.
- Any follow-up implementation must sanitize imported rich HTML.

## Next Steps

- If approved, create implementation plan for `.pptx` editable import using the selected parser strategy.
