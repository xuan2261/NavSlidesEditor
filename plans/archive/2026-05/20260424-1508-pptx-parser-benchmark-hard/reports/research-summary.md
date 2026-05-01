---
title: 'PPTX Parser Benchmark Research Summary'
date: '2026-04-24'
status: complete
---

# PPTX Parser Benchmark Research Summary

## Summary

Scope changed to `.pptx` only. Best benchmark set is 4 JavaScript parser candidates: `pptxtojson`, `pptx2json`, `ppt-parser`, `pptx-compose`.

## Parser Notes

| Parser | Version checked | Fit |
| --- | --- | --- |
| `pptxtojson` | 2.0.2 | Best semantic candidate. Browser-first, readable JSON, used as PPTist import reference. |
| `pptx2json` | 0.0.10 | Best raw package fallback. Preserves OOXML tree and binary media. |
| `ppt-parser` | 0.0.8 | Secondary semantic candidate. Needs proof on real corpus. |
| `pptx-compose` | 1.0.0 | Older raw JSON baseline. Useful if `pptx2json` fails. |

## Excluded

- `PptxGenJS`: export/generation only for this use; import existing presentations/templates is not implemented.
- `python-pptx`: not needed for `.pptx`-only JS spike; adds runtime boundary.
- `libreoffice-convert`: rejected by user and not object-editable.
- `.ppt`: out of scope.

## Corpus Risk

The existing `PPTX/` samples are rich enough for hard benchmark:

| Deck | Slides | Notes |
| --- | ---: | --- |
| `Bai_2_1.pptx` | 41 | tables, OLE, WMF/EMF |
| `Bai_2_2.pptx` | 39 | many tables/groups/math/OLE |
| `Bai_2_5.pptx` | 45 | many tables/math/media/OLE |
| `STTre_Duc.pptx` | 20 | notes, images, OLE |

## Recommendation

Benchmark `pptxtojson` as primary and `pptx2json` as raw fallback first. Keep `ppt-parser` and `pptx-compose` as challenger/baseline. Do not implement UI until matrix and mapper feasibility report are complete.

## Unresolved Questions

- Need more decks with charts and SmartArt before production import.
- Need decide whether raw parser outputs with slide content can be committed.

