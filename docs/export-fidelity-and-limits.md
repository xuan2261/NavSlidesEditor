# Export Fidelity and Known Limitations

How element properties map across the three export targets — reveal.js HTML
(share link, offline bundle, PDF print) and PowerPoint (`.pptx`) — and which
properties cannot be represented by a given format.

## Fixed mapping gaps (resolved)

These were render-support gaps where one target dropped a property the others
honored. Now corrected:

| Property                             | Target that dropped it                   | Status                                                                                  |
| ------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Element opacity                      | canvas + reveal + pptx (all but `shape`) | Mapped: canvas content-layer, reveal `buildBaseStyle`, pptx image `transparency`        |
| Code border-radius                   | canvas inner `<pre>`                     | Reads `element.borderRadius`                                                            |
| Image flip (`flipH`/`flipV`)         | canvas + reveal                          | Emitted as `scaleX(-1)`/`scaleY(-1)` on the `<img>`                                     |
| Image border (color/width)           | reveal HTML                              | Emitted as a CSS border on the wrapper                                                  |
| Table merged cells (colspan/rowspan) | reveal HTML                              | Emitted via the shared `resolveMergedCells` resolver (canvas + reveal + pptx now agree) |

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

### Imported PPTX package contract

This section applies to decks imported from `.pptx`; it does not limit charts
created directly in NavSlides.

- **Recovery is separate from editing.** When an immutable original package is
  verified by its authoritative package head, **Download Original** returns those
  original bytes. It is the recovery path for source-backed and original-only
  content, not evidence of native editing or visual parity. The current
  `/pptx-original` resolves the immutable original revision from the authoritative
  package head and allows recovery when an intact R0 outlives a missing successor;
  its route-specific resolver remains separate from the shared editable projection
  reader. The route
  is owned by [`server/routes/presentations.js`](../server/routes/presentations.js), and the
  immutable-revision resolver is
  [`server/services/pptx-import/package-revision-resolver.js`](../server/services/pptx-import/package-revision-resolver.js).
- **Imported charts remain preserve-only until qualified.** A display mapping is
  not edit qualification. Canonical `_pptxChartMeta` marks an imported chart
  preserve-only while adapter, transaction, and level-4 evidence are incomplete;
  the Chart properties surface makes that chart read-only. The policy and UI
  owners are
  [`chart-support-matrix.js`](../server/services/pptx-import/chart-support-matrix.js)
  and
  [`chart-properties.jsx`](../client/src/components/properties/chart-properties.jsx).
- **Validated edited export fails closed, with one narrow reconciliation
  exception.** The guarded
  [`POST /api/presentations/:id/pptx-edited`](../server/routes/pptx-edited-export.js)
  path never falls back to a reconstructed or hybrid download when current
  package authority is absent. An edited package also requires qualified
  validators. The exception is a server-proven, pending **no-op**: it can reconcile
  to the existing package head without external validators, but it neither
  validates nor publishes an edit. The availability owner and its focused contract
  test are [`validated-edited-export.js`](../server/services/validated-edited-export.js)
  and
  [`validated-edited-export.test.js`](../server/services/validated-edited-export.test.js).
  Package-backed saves and guarded edited exports are generation-bound and require
  an idempotency key; replay is scoped to the named mutation operation and a
  durable replay is resolved before a fresh validator-availability probe. Returned
  availability denials and transaction outcomes (blocked, conflict, cancellation)
  expose canonical `reasonCode`/`reasonCodes` metadata and a versioned authority
  subject. A successful edited-package response includes a positive
  `X-Pptx-Generation` successor header; the client rejects the response when that
  generation is missing or malformed so later saves cannot use a stale
  predecessor. Request-validation and unexpected execution errors remain generic
  responses; they are not reason-code-authorized. The request and authority owners
  are [`generation-safe-save.js`](../server/services/generation-safe-save.js),
  [`mutation-operation-scope.js`](../server/services/pptx-import/mutation-operation-scope.js),
  and
  [`reason-code-contract.js`](../server/services/pptx-import/reason-code-contract.js).

#### Package-state software contract

- **A normal package save is pending state, not R1.** The server owns the pending
  projection and journal. For an eligible constrained journal, the guarded
  transaction materializes exactly one successor `R1`; same-key replay returns
  that revision rather than creating another. It rejects mixed or non-text edits
  rather than silently widening the contract. The executable owners and focused
  materialization tests are
  [`generation-safe-save.js`](../server/services/generation-safe-save.js),
  [`validated-edited-export-context.js`](../server/services/pptx-import/validated-edited-export-context.js),
  [`mutation-transaction-execution.js`](../server/services/pptx-import/mutation-transaction-execution.js),
  and
  [`validated-edited-export-materialization.test.js`](../server/services/validated-edited-export-materialization.test.js).
- **Fidelity generation comes from the package store.** For a package-backed
  deck, the fidelity route reads the aggregate generation from the package-store
  head rather than trusting the compatibility JSON projection. See
  [`presentations.js`](../server/routes/presentations.js) and
  [`fidelity-contract.test.js`](../server/services/pptx-import/fidelity-contract.test.js).
- **Compatibility JSON is a projection, not package authority.** The package
  outbox is its sole package-backed writer. Its merge retains server-owned
  metadata and tombstones, keeps creation/deletion timestamps, and applies the
  package write's server-generated `updatedAt` timestamp. See
  [`compatibility-view.js`](../server/services/pptx-import/compatibility-view.js)
  and
  [`compatibility-outbox.test.js`](../server/services/pptx-import/compatibility-outbox.test.js).
- **Lifecycle moves rebind authority.** When committed authority exists,
  duplicate and restore operations rebind its projection/source-map authority to
  the destination identity and current generation; they do not promote
  editability. Duplicate authority follows the destination editor projection,
  including title changes. Pending package projections are not silently dropped:
  duplicate and restore fail closed with `PACKAGE_PENDING_PROJECTION`. Lifecycle
  publication also checks the live source/retained head before committing. An
  explicitly generated source-map generation is retained even when the map has no
  entries, so an empty map can still match its package generation. See
  [`lifecycle.js`](../server/services/pptx-import/package-store/lifecycle.js),
  [`lifecycle.test.js`](../server/services/pptx-import/package-store/lifecycle.test.js),
  [`source-map.js`](../server/services/pptx-import/source-map.js), and
  [`source-map.test.js`](../server/services/pptx-import/source-map.test.js).
- **Package-backed reads are authority-consistent for covered paths.** Presentation
  GET/detail and summary responses plus other package-backed sinks resolve the
  editable projection and aggregate generation from one package-store snapshot,
  then merge only trusted compatibility metadata. Bulk summary and sync reads
  reuse that one snapshot rather than reopening the store per deck. Export,
  present, live presentation, save-as-template, history snapshot/restore,
  public-share, GitHub, cloud sync, and explore/fork use the shared authority
  resolver. Missing package heads and malformed original-only state fail closed
  instead of falling back to stale compatibility JSON. External fork/GitHub/sync
  JSON crosses the editor DTO boundary without package authority fields, and
  history restore responds from restored package authority on covered paths. Restore
  and delete now share the per-presentation history lock, while legacy restore checks
  a source fingerprint before replacement; broader package/JSON interleavings still
  require validation. `/pptx-original` uses the package head's immutable original
  revision resolver, including degraded recovery when an intact R0 outlives a missing
  successor. A pending package projection can
  currently be retained by save-as-template while later template instantiation
  rejects it; template create/delete rollback, outbox acknowledgement, and
  destination cleanup also remain open. These are not completed fail-closed
  lifecycle contracts. Snapshot/duplicate/fork race closure, explore rollback,
  retain/quarantine fencing, stale-retry cleanup, and broader outbox interleavings
  remain open. Sync produces a staged manifest/blob bundle, not a restorable
  package-authority archive; its remote-wide destination serialization and path checks
  have focused coverage pending the skipped sync-suite rerun. DTO/package-generation
  alignment, expected-head fencing between projection and bundle export, bounded
  resource use, and complete referenced-media traversal remain unfinished. Portable
  import now rejects missing/conflicting revisions/blobs, clears stale destination
  outbox records, and rejects cross-presentation revision bytes without an owner
  record; focused portable coverage passes, but the full authority archive contract
  remains open. None of these edges is qualification evidence. The shared reader is
  [`package-backed-presentation-read.js`](../server/services/package-backed-presentation-read.js).
- **Native re-import remains an application validator, not provenance or
  collateral proof.** It now binds the requested package identity and isolates
  validation media state from the ordinary-import upload index. Those focused
  software contracts do not establish strict real-package re-import or rule out
  forged source identity and collateral package changes. The executable owners are
  [`native-reimport-validator.js`](../server/services/pptx-import/native-reimport-validator.js),
  [`source-map.js`](../server/services/pptx-import/source-map.js), and
  [`media-dedup.js`](../server/services/pptx-import/media-dedup.js).
- **Staging cleanup fails closed but is not durable remediation.** Cleanup
  uncertainty blocks edited publication, while an earlier validation failure stays
  primary. Local quarantine and containment cover the bounded software path, but a
  cleanup-and-quarantine double failure still has no durable owner or sweeper. The
  path checks are not race-proof OS-handle isolation or OfficeCLI containment. See
  [`native-reimport-workspace.js`](../server/services/pptx-import/native-reimport-workspace.js)
  and
  [`native-reimport-containment.test.js`](../server/services/pptx-import/native-reimport-containment.test.js).
  Candidate cleanup ownership and loser compensation remain required before any
  publication-safety claim.

These are application software-contract assertions only. They are not evidence of
OfficeCLI or PowerPoint validation, Electron or Docker or provider runtime behavior,
non-Windows support, or real-package native re-import.

#### Evidence boundary

The application-side strict importer used by the transaction is not an
Office/PowerPoint oracle. There is no recorded successful OfficeCLI
qualification, PowerPoint oracle result, provider validation, or real-package
strict native re-import of a validated edited package. The G0–G5 gates remain open,
including G1, as recorded in the
[OfficeCLI evidence journal](journals/260715-0215-officecli-containment-contract-open-native-gates.md).
The canonical matrix has no promoted level-4 row, and the fidelity DTO holds
level 5 unavailable. Therefore this document does not claim editable
imported-chart fidelity, a level-4/5 promotion, or PowerPoint compatibility or
visual fidelity.

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

| Field         | Meaning                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `elementId`   | Source element id when present                                                                                        |
| `elementType` | Source element type                                                                                                   |
| `control`     | Element-control audit control id                                                                                      |
| `surface`     | Always `pptx-export`                                                                                                  |
| `matrixRowId` | Audit matrix row, e.g. `game.game-subtype-live-policy.pptx-export`                                                    |
| `severity`    | `warning` for expected fallback, `error` for failed native path                                                       |
| `message`     | User-visible warning text                                                                                             |
| `fallback`    | Fallback class: `server-raster`, `client-raster`, `media-cover`, `placeholder`, `background-color`, or `export-error` |

The editor export action stores the most recent report on
`globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__` and shows warnings through
the browser export-result modal (`alert`) so fallback gaps are not console-only.

## Element-control export-gap classification

| Matrix row                                    | Classification                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio.audio-source-playback.pptx-export`     | `fallback-warning`: media cover or placeholder; playable audio is an accepted format limit                                                           |
| `chart.chart-data-options.pptx-export`        | `fallback-warning`: native chart types stay editable; unsupported variants such as polarArea use raster/placeholder fallback and structured warnings |
| `code.code-content-language.pptx-export`      | `accepted-limit`: plain editable monospace text; syntax theme fidelity is not native                                                                 |
| `drawing.drawing-path-style.pptx-export`      | `fallback-warning`: raster/placeholder for editable path parity                                                                                      |
| `game.game-subtype-live-policy.pptx-export`   | `fallback-warning`: live-only static placeholder, no private config                                                                                  |
| `html.trusted-html-content.pptx-export`       | `fallback-warning`: server raster when available; active scripts remain trusted HTML-only                                                            |
| `icon.icon-name-style.pptx-export`            | `fallback-warning`: raster/placeholder for icon glyph parity                                                                                         |
| `image.media-source-and-fit.pptx-export`      | `accepted-limit`: source/crop/fit/opacity/flip/border map; CSS filters and rounded corners remain native limits                                      |
| `latex.latex-content-style.pptx-export`       | `fallback-warning`: server raster when available; editable equation parity is out of scope                                                           |
| `markdown.markdown-content-style.pptx-export` | `fallback-warning`: raster/placeholder for authored Markdown structure                                                                               |
| `qrcode.qr-data-style.pptx-export`            | `fallback-warning`: raster/placeholder for generated QR output                                                                                       |
| `svg.svg-content-overrides.pptx-export`       | `fallback-warning`: sanitizer-covered HTML/canvas path, PPTX fallback for editable SVG parity                                                        |
| `timeline.timeline-events-style.pptx-export`  | `fallback-warning`: raster/placeholder for timeline geometry                                                                                         |
| `video.video-source-playback.pptx-export`     | `fallback-warning`: poster or placeholder; playable video is an accepted format limit                                                                |

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
