---
title: 'PPTX Parser Benchmark Validation Questions'
date: '2026-04-24'
status: complete
---

# PPTX Parser Benchmark Validation Questions

## Confirmed User Decisions

- Only `.pptx` is in scope.
- Fidelity first.
- Text, image, shape, table should be editable first.
- Chart, equation, OLE, SmartArt, and uncertain objects may become placeholder/snapshot.
- "Make more objects editable" becomes TODO after parser choice.
- Benchmark 4 parser candidates in hard mode before implementation.

## Validation Questions For Future Approval

1. Is it acceptable to store benchmark raw outputs in git if they contain extracted slide text?
2. Should unsupported placeholders preserve object name/source id for future remapping?
3. Should fallback placeholder be a locked image, locked SVG, or labeled unsupported box?
4. Should import create a new presentation only, or also allow replacing slides in current presentation?
5. Should parser benchmark run in Node only first, or include browser harness for browser-first libraries?

## Recommended Defaults

- Do not commit raw full-content parser outputs unless user approves.
- Preserve `sourceRef` on every imported/fallback element.
- Use locked image/SVG placeholder when preview exists; labeled box when preview does not.
- Start with create-new-presentation import only.
- Run Node benchmark first; add browser benchmark only if a strong candidate needs it.

## Unresolved Questions

- User approval needed for committing raw benchmark artifacts containing slide content.

