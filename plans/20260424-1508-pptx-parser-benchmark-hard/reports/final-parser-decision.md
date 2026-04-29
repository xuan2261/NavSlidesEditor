# Final Parser Decision

## Decision

- Primary parser: pptxtojson
- Fallback parser: pptx2json
- Runtime: Node benchmark first; browser harness deferred unless needed.
- Supported Phase 1 objects: text, image, shape, table.
- Fallback objects: chart, equation, OLE, SmartArt, grouped complex objects, uncertain objects.
- Explicit non-goals: no `.ppt`, no LibreOffice, no Java, no Python, no import UI in this benchmark.

## Go/No-Go

- Result: go for follow-up editable import implementation planning.
- Primary parsed 4/4 decks with exact slide-count preservation.
- Primary exposed 858 text, 88 image, 966 shape, and 38 table candidates.
- Raw full-content outputs are not approved for git; `parser-raw` is ignored and should be treated as sensitive local-only debug data.

## Evidence

- Corpus: 4 decks, 145 slides, 156 media entries, 73 embeddings/OLE package entries.
- pptxtojson: 94/100 mapper feasibility score.
- ppt-parser: 86/100 mapper feasibility score.
- pptx2json: 68/100 mapper feasibility score.
- pptx-compose: 68/100 mapper feasibility score.

## Rejected Strategies

- `ppt-parser` primary: parses all decks, but loses notes/theme/layout evidence compared with `pptxtojson`.
- `pptx-compose` fallback: same raw-style role as `pptx2json`, older package, no advantage in matrix.
- Raw-only import: rejected because mapper complexity is higher and Phase 1 wants editable text/image/shape/table quickly.
- Stop/no-go: rejected because the primary plus raw fallback met benchmark viability thresholds.

## Security Notes

- Treat `.pptx` as untrusted ZIP/XML; benchmark scripts do not execute OLE or embedded content.
- Benchmark runners preflight PPTX size, ZIP entry count, and decompressed size before parser execution.
- Each parser/deck run executes in a child process with a 60s timeout plus forced-kill grace; future production import should keep this boundary.
- Parser stdout/stderr and exception diagnostics are capped and redacted before summary/report output.
- `pptx-compose` is benchmark-only and not eligible for production import due to older transitive `jszip`/`xml2js` audit exposure.
- Future importer must sanitize rich HTML before TipTap/render and validate media MIME before persistence.

## Next Plan Skeleton

- Add parser adapter and intermediate model only after this benchmark is approved.
- Map editable text/image/shape/table first; locked placeholders for fallback objects.
- Sanitize imported rich HTML before TipTap/render.
