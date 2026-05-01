# Phase 2: Benchmark Harness Design

## Context Links

- Plan: [plan.md](./plan.md)
- Phase 1 baseline: [phase-01-corpus-ground-truth-inventory.md](./phase-01-corpus-ground-truth-inventory.md)
- Current package manager: root `package.json`, `package-lock.json`

## Overview

Priority: P0  
Status: Complete  
Goal: design an isolated benchmark harness for 4 parser candidates without polluting production code.

## Key Insights

- This is a spike. Parser dependencies should stay isolated until a winner is chosen.
- Browser-only packages may fail under Node. The harness must record environment compatibility, not hide it.
- Parser output schemas differ: semantic JSON vs raw OOXML package JSON.

## Requirements

- Benchmark candidates:
  - `pptxtojson`
  - `pptx2json`
  - `ppt-parser`
  - `pptx-compose`
- Do not wire parser packages into the app UI during benchmark.
- Capture stdout/stderr, runtime, memory, output size, and structured summary per parser/deck.
- Use real `.pptx` files from `PPTX/`.

## Architecture

```text
scripts/pptx-parser-benchmark/
  package sandbox or dev-only runner
  runners/
    pptxtojson-runner.js
    pptx2json-runner.js
    ppt-parser-runner.js
    pptx-compose-runner.js
  normalize-parser-output.js
  summarize-parser-output.js
  run-all.js

outputs:
  plans/.../research/parser-raw/{parser}/{deck}.json
  plans/.../research/parser-summary/{parser}/{deck}.json
  plans/.../reports/parser-execution-matrix.md
```

## Related Code Files

- Created: `scripts/pptx-parser-benchmark/run-all.js`
- Created: `scripts/pptx-parser-benchmark/runners/*.js`
- Created: `scripts/pptx-parser-benchmark/summarize-parser-output.js`
- Do not modify: `client/src/pages/HomePage.jsx`
- Do not modify: `client/src/utils/exportPptx.js`

## Implementation Steps

1. Decide dependency isolation:
   - Preferred: install as dev dependencies only during spike.
   - Alternative: create a temporary benchmark workspace under `scratch/`.
2. Define common runner contract:
   ```js
   export async function runParser({ inputPath, outputDir }) {
     return {
       parser: 'pptxtojson',
       inputPath,
       ok: true,
       durationMs,
       peakMemoryMb,
       rawOutputPath,
       summary,
       warnings: [],
       error: null,
     }
   }
   ```
3. Define common summary fields:
   - `slideCount`
   - `size.width`, `size.height`
   - `textCount`, `imageCount`, `shapeCount`, `tableCount`, `chartCount`
   - `groupCount`, `connectorCount`, `placeholderCount`
   - `noteCount`, `mediaCount`
   - `hasThemeColors`, `hasFontInfo`, `hasLayoutElements`
   - `unsupportedObjects`
4. Define failure taxonomy:
   - `install-failed`
   - `import-failed`
   - `parse-failed`
   - `output-empty`
   - `schema-unusable`
   - `browser-only`
5. Keep runner output deterministic:
   - sort object keys where possible
   - strip volatile absolute paths
   - include parser version and npm modified date

## Todo List

- [x] Choose dependency isolation method.
- [x] Define runner result JSON schema.
- [x] Define output folder structure.
- [x] Define command list for repeatable runs.
- [x] Define parser failure taxonomy.

## Success Criteria

- One command can run all 4 parsers against all 4 decks.
- Any parser failure produces a structured report, not a crashed benchmark.
- Harness output can be reviewed without opening raw huge JSON first.

## Risk Assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Parser packages conflict with repo deps | Medium | Isolate in `scratch/` or dev-only branch |
| Browser-only parser fails in Node | Medium | Record as environment failure; optionally test browser runner later |
| Raw output too large | Low | Store summaries first; raw JSON optional/compressed |

## Security Considerations

- No execution of embedded OLE/media.
- Limit output path to plan research directory.
- Avoid committing proprietary sample-derived raw media if sensitive.

## Next Steps

- Phase 3 executes the harness and fills the result matrix.
