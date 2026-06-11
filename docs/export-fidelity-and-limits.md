# Export Fidelity and Known Limitations

How element properties map across the three export targets — reveal.js HTML
(share link, offline bundle, PDF print) and PowerPoint (`.pptx`) — and which
properties cannot be represented by a given format.

## Fixed mapping gaps (resolved)

These were render-support gaps where one target dropped a property the others
honored. Now corrected:

| Property | Target that dropped it | Status |
|----------|------------------------|--------|
| Element opacity | canvas + reveal + pptx (all but `shape`) | Mapped: canvas content-layer, reveal `buildBaseStyle`, pptx image `transparency` |
| Code border-radius | canvas inner `<pre>` | Reads `element.borderRadius` |
| Image flip (`flipH`/`flipV`) | canvas + reveal | Emitted as `scaleX(-1)`/`scaleY(-1)` on the `<img>` |
| Image border (color/width) | reveal HTML | Emitted as a CSS border on the wrapper |
| Table merged cells (colspan/rowspan) | reveal HTML | Emitted via the shared `resolveMergedCells` resolver (canvas + reveal + pptx now agree) |

## Inherent format limitations (not fixable)

These are ceilings of the target format, not bugs. They are documented rather
than worked around.

### PowerPoint (`.pptx`)

- **No box-shadow.** OOXML shape effects do not map to the CSS shadow model used
  on canvas/reveal; drop shadows are not exported.
- **No image corner-radius.** `pptxgenjs` image placement has no corner-radius
  option; rounded images export square.
- **No CSS filters.** `brightness`/`contrast`/`grayscale`/`saturate` are CSS
  filter functions with no pptx equivalent; images export unfiltered.
- **No table rotation.** Tables are placed as native table frames that pptx
  cannot rotate.
- **No chart rotation.** `pptxgenjs` `IChartOpts` has no `rotate` field — charts
  are placed as graphicFrames, which pptx cannot rotate. Writing a `rotate` opt
  would silently no-op, so it is intentionally not attempted.
- **Text-level transparency is glyph-only.** pptx text `transparency` fades the
  glyph fill (the text color), not a whole-element background. Whole-element
  opacity is therefore mapped only where the semantic is correct (shape fill,
  image), not for text blocks.

### Live-only element types

- **Game elements** and **HTML iframe embeds** are interactive/live-only. They
  render in the editor and live presentation but have no static representation
  in a pptx export.

## Resolver note

Merged-cell resolution lives in one place — `shared/src/table-merge-resolver.js`
(`resolveMergedCells`) — and is consumed by the canvas, reveal, and pptx table
renderers so the three never drift.
