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
- **Audio/video are not embedded as playable media.** PPTX export uses poster,
  raster, or placeholder fallbacks with warnings rather than pretending to
  preserve browser playback controls.
- **Editable parity is not promised for DOM-generated elements.** Markdown,
  LaTeX/TikZ, raw HTML, QR code, icons, drawings, SVG, timelines, games, and
  unsupported chart variants may export through raster/placeholder fallbacks.
  The visual placeholder is intentional when editable native fidelity would be
  misleading.

### Live-only element types

- **Game elements** are live/player-socket content. Reveal HTML export emits a
  static whitelist-only placeholder containing public title/type labels, not raw
  game config, answers, scoring, presenter/admin/session data, or player/admin
  controls. PPTX export emits a placeholder and warning.
- **HTML iframe embeds** are interactive/live-only. They render in the editor and
  live presentation but have no native editable representation in a pptx export.

## PPTX export warning contract

PPTX export returns the existing string warning list for backward-compatible UI
alerts. The same list also carries a non-enumerable `exportReport` object for
machine checks:

| Field | Meaning |
|-------|---------|
| `elementId` | Source element id when present |
| `elementType` | Source element type |
| `control` | Element-control audit control id |
| `surface` | Always `pptx-export` |
| `matrixRowId` | Audit matrix row, e.g. `game.game-subtype-live-policy.pptx-export` |
| `severity` | `warning` for expected fallback, `error` for failed native path |
| `message` | User-visible warning text |
| `fallback` | Fallback class: `server-raster`, `client-raster`, `media-cover`, `placeholder`, `background-color`, or `export-error` |

The editor export action stores the most recent report on
`globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__` and shows warnings through
the browser export-result modal (`alert`) so fallback gaps are not console-only.

## Element-control export-gap classification

| Matrix row | Classification |
|------------|----------------|
| `audio.audio-source-playback.pptx-export` | `fallback-warning`: media cover or placeholder; playable audio is an accepted format limit |
| `chart.chart-data-options.pptx-export` | `fallback-warning`: native chart types stay editable; unsupported variants such as polarArea use raster/placeholder fallback and structured warnings |
| `code.code-content-language.pptx-export` | `accepted-limit`: plain editable monospace text; syntax theme fidelity is not native |
| `drawing.drawing-path-style.pptx-export` | `fallback-warning`: raster/placeholder for editable path parity |
| `game.game-subtype-live-policy.pptx-export` | `fallback-warning`: live-only static placeholder, no private config |
| `html.trusted-html-content.pptx-export` | `fallback-warning`: server raster when available; active scripts remain trusted HTML-only |
| `icon.icon-name-style.pptx-export` | `fallback-warning`: raster/placeholder for icon glyph parity |
| `image.media-source-and-fit.pptx-export` | `accepted-limit`: source/crop/fit/opacity/flip/border map; CSS filters and rounded corners remain native limits |
| `latex.latex-content-style.pptx-export` | `fallback-warning`: server raster when available; editable equation parity is out of scope |
| `markdown.markdown-content-style.pptx-export` | `fallback-warning`: raster/placeholder for authored Markdown structure |
| `qrcode.qr-data-style.pptx-export` | `fallback-warning`: raster/placeholder for generated QR output |
| `svg.svg-content-overrides.pptx-export` | `fallback-warning`: sanitizer-covered HTML/canvas path, PPTX fallback for editable SVG parity |
| `timeline.timeline-events-style.pptx-export` | `fallback-warning`: raster/placeholder for timeline geometry |
| `video.video-source-playback.pptx-export` | `fallback-warning`: poster or placeholder; playable video is an accepted format limit |

## Export security limits

NavSlides keeps the trusted-author model for HTML, SVG, Markdown, and media
content. Exports must not be treated as untrusted sanitization boundaries:

- Raw HTML/iframe/script content is preserved for reveal.js HTML where authored.
  Host exported decks behind the same trust boundary as the editor content.
- PPTX fallbacks may rasterize trusted active content; they do not sandbox or
  rewrite the original project data.
- External network URLs can still load in HTML exports according to browser and
  hosting policy. Local private paths are not a portability feature and should
  be avoided in shared decks.
- URL and SVG negative tests cover blocked `javascript:`/unsafe media schemes,
  event attributes, external references, and unsafe SVG constructs where the
  renderer consumes those fields.

## Resolver note

Merged-cell resolution lives in one place — `shared/src/table-merge-resolver.js`
(`resolveMergedCells`) — and is consumed by the canvas, reveal, and pptx table
renderers so the three never drift.
