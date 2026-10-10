# Export Fidelity and Known Limitations

How element properties map across the three export targets — reveal.js HTML
(share link, offline bundle, PDF print) and PowerPoint (`.pptx`) — and which
properties cannot be represented by a given format.

## Three export modes and portability contract

NavSlides provides three distinct export and interchange targets for presentations:

1. **Portable `.navslides.json` (Project Archive)**
   - Complete project encapsulation including slides, elements, metadata, design tokens, and local assets.
   - Authority fields, server-specific credentials, and internal state are stripped cleanly (`shared/src/project-export-value.js`) to guarantee safe portability across environments without privilege escalation.
   - Restored projects preserve layout/asset integrity while binding to fresh local ownership.
   - Package-backed replacement selects trusted import styling from the active Original lineage. Retained templates/history keep their own Original-bound metadata; an old retained sidecar cannot become authority for the replacement package.

2. **Immutable Original PPTX**
   - Available for package-backed presentations originally imported from PowerPoint (`.pptx`).
   - Preserves bit-for-bit identity against the committed package store digest (`server/services/package-backed-presentation-read.js`).
   - Never reconstructed or re-serialized by editor saves; always delivered with exact byte-identical fidelity.

3. **Validated Edited PPTX**
   - Available only when presentation edits pass strict server-side OOXML validation rules.
   - Edits are restricted to supported text, structure, and validated styling. Unsupported modifications, macros, ActiveX, or schema inconsistencies are rejected with explicit status rather than falling back to lossy approximations.
   - Never advertised as "universal lossless roundtrip"; fidelity limits and warning reports (`exportReport`) explicitly identify all fallbacks and constraints.
   - A genuinely byte-identical no-op reconciles the saved projection without creating a binary revision. Reopen and portable replay retain the selected committed package journal, while Original bytes remain immutable. Changed-package exports still require the existing validator gates.

## Reveal.js runtime contract

- The canonical Reveal.js pin and runtime asset paths are owned by
  [`REVEAL_RUNTIME_VERSION` in `reveal-runtime-assets.js`](../shared/src/reveal-runtime-assets.js).
  A source pin is not evidence that every delivery surface has been qualified.
- Vendor publication and portable dependency closure are owned by
  [`copy-vendor.js`](../scripts/copy-vendor.js) and
  [`offlineExport.js`](../client/src/utils/offlineExport.js), respectively.
- Bundled-plugin browser integration is exercised by
  [`generated-plugin-boundaries.spec.js`](../tests/e2e/education/generated-plugin-boundaries.spec.js).
  Those focused journeys do not qualify the whole education release. User-supplied
  plugins remain responsible for their compatibility; NavSlides does not rewrite
  third-party plugin APIs.
- Generated audio/video controllers reattach when Reveal replaces slide DOM during
  responsive scroll-view switches. The authored speed and trim-loop boundary are
  preserved; teardown disposes removed players and all remaining controllers on
  page hide. Real Chromium smoke retained speed 1.5 and a 0.2–0.8-second segment
  through a 1280→390→1280 viewport round-trip. This is focused playback evidence,
  not full browser, offline, or packaged-runtime qualification.
- Native TikZ uses the real pinned compiler, not a canned SVG. The publication
  contract in [`tikz-runtime-contract.js`](../shared/src/tikz-runtime-contract.js)
  verifies the package, patched entry/worker and finite resource inventory.
  [`portable-tikz-adapter.js`](../client/src/utils/portable-tikz-adapter.js) closes
  those resources into a local worker; unavailable or changed resources fail
  instead of falling back to network fetches. Disabled caching never accesses
  IndexedDB in opaque compiler frames.
- A portable generated root gains `wasm-unsafe-eval` only after a native compiler
  frame closes successfully; that compiler frame gains its own validated
  permission. Authored HTML, Mermaid, Markdown, chart and QR siblings and their
  descendants remain Wasm-denied, regardless of traversal order. Compiler-free
  decks deny Wasm at root and every child. `unsafe-eval`, same-origin frame access
  and outbound connections are not enabled. Root inline scripts remain allowed;
  this is not a hash-protected root.
- Focused Chromium journeys compile the authored blue closed triangle on canvas
  and a normal UI-downloaded network-blocked `file://` deck, with zero disabled-cache
  IndexedDB access. Separate real execution probes verify compiler/root allowance,
  sibling/descendant denial and compiler-free denial. These are bounded working-tree
  observations, not complete education, Electron or Windows-package qualification.
- Authored rich-text paragraph line-height takes precedence over generated fallback
  typography. The actual link-authoring journey retains line-height 2 and rich marks
  after save/reload and Present; fresh generated paragraph/list defaults remain 1.5.
  Canvas SVG root viewports fit the element-owned rectangle without clipping selected
  artwork or changing persisted viewBox and paint. These are focused surface checks,
  not full browser/export qualification.
- Generated and printed Markdown uses generation-time parsing plus the shared
  parsed-markup sanitizer. Authored active frames and internal print-loader markers
  are not promoted into root execution. Genuine HTML and TikZ print frames retain
  their owned sandboxed loading path. Actual Markdown semantic/typography and forged
  frame-denial journeys passed; this does not qualify every export format.
- The parsed-markup policy retains a single validated `language-*` token only on
  code nodes so authored fenced-code language controls print highlighting.
  Other classes and active/runtime attributes remain excluded. Current-source
  print smoke distinguishes JavaScript keyword paint from plaintext and
  preserves literal markup and blank lines; this is not full export qualification.
- An imported deck may remain editable/readable when an education mutation is not
  eligible for native edited PPTX. Package bytes, head and ownership remain
  authoritative; invalid declaration removal cannot alter the saved projection.
  A real imported-package save/read smoke retained generation 2 and original bytes
  while the unsupported edited export remained explicitly denied.
- Live DOM mounting follows implemented runtime capability. Name-picker keeps its
  existing server broadcast and read-only spectators; its planning classification
  remains distinct from multiplayer answer protocols. Disconnected/waiting live
  audiences cannot switch to a local picker. Authenticated host/two-learner journeys
  passed for eligible educational games and all seven quiz kinds; final frozen
  browser, desktop and packaged-release qualification remains separate.
- Generated documents record the pinned Reveal.js 6.0.2 version in the
  `navslides-reveal-version` metadata tag; `server/package.json` pins the only
  supported workspace version.
- Publication and startup fail closed if a required asset is absent, its manifest
  version or hash differs, or a legacy `reveal.js/plugin/` path reappears. Portable
  export likewise aborts on missing required Reveal.js, KaTeX or Highlight.js
  assets rather than emitting a partially portable document.

These source pins do not establish runtime or plugin compatibility qualification.

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

Imported `mergedCells` metadata is preserved and rendered, but remains read-only in the
current table properties surface: merge/unmerge authoring controls are intentionally
out of scope.

## Inherent format limitations (not fixable)

These are ceilings of the target format, not bugs. They are documented rather
than worked around.

### PowerPoint (`.pptx`)

- **No box-shadow.** OOXML shape effects do not map to the CSS shadow model used
  on canvas/reveal; drop shadows are not exported.
- **Image effects are visual-raster only.** Ordinary images remain editable
  native PPTX images. A data image or validated local `/uploads/` image with a
  non-default CSS filter or non-zero corner radius is rasterized within its
  element bounds and emits a fallback warning; frame rotation, opacity, and
  alt text are retained. External image URLs are not admitted to the server
  raster path, so they remain native images with an accepted-limit warning
  rather than a visual-effects claim.
- **No table rotation.** Tables remain editable native table frames, but pptx
  cannot rotate them. A non-zero table rotation emits a structured accepted-limit
  warning and exports the unrotated native table.
- **No chart rotation.** `pptxgenjs` `IChartOpts` has no `rotate` field — charts
  are placed as graphicFrames, which pptx cannot rotate. Writing a `rotate` opt
  would silently no-op, so it is intentionally not attempted.
- **Text-level transparency is glyph-only.** pptx text `transparency` fades the
  glyph fill (the text color), not a whole-element background. Whole-element
  opacity is therefore mapped only where the semantic is correct (shape fill,
  image), not for text blocks.
- **Validated local audio/video can be embedded.** PPTX export embeds only
  upload-root sources whose extension and MIME agree with the supported set:
  MP3/WAV/M4A/AAC for audio and MP4/MOV for video. Server export verifies the
  bytes inside the configured uploads root (including real-path containment);
  browser export fetches only a validated same-origin `/uploads/` path and checks
  its response MIME and file signature. External URLs, arbitrary paths,
  traversal, MIME mismatches,
  and unsupported codecs are never passed to `addMedia`; they remain poster or
  placeholder fallbacks. A validated local PNG may be used as the embedded
  video cover. Other validated local image posters remain available for static
  fallback.
- **Embedded media does not preserve browser playback policy.** Start/end trim,
  playback speed, autoplay, loop, and muted settings have no qualified OOXML
  mapping and emit truthful warnings when authored. Package tests prove embedded
  parts and relationships, but this is not yet a PowerPoint/Office playback
  compatibility claim.
- **Editable parity is not promised for DOM-generated elements.** Markdown,
  LaTeX/TikZ, raw HTML, QR code, icons, drawings, SVG, timelines, games, and
  unsupported chart variants may export through raster/placeholder fallbacks.
  The visual placeholder is intentional when editable native fidelity would be
  misleading.

### Imported PPTX package contract

This section applies to decks imported from `.pptx`; it does not limit charts
created directly in NavSlides.

- **Import ZIP CRC is fail-closed.** `validatePptxPackage` /
  `loadPptxArchive` perform raw ZIP structure and declared-size preflight, then
  validate each bounded inflated entry against its declared CRC32. JSZip
  indexing uses `checkCRC32: false` because integrity is enforced by the
  bounded reader before package mapping. A mismatch rejects with stable code
  `zip-crc-mismatch` (`PackageSafetyError`). There is **no** default silent
  warn-only success path for CRC failures. Policy constant: `IMPORT_CRC_POLICY`
  in [`pptx-guards.js`](../server/services/pptx-import/pptx-guards.js).
  Regression: intentional CRC-mismatch fixture in `pptx-guards.test.js` and the
  isolated adversarial lane (`npm run test:pptx:adversarial`).
- **Adversarial fixtures are a separate lane.** Synthetic edge packages live under
  `server/data/test-corpus/adversarial/` and are **not** included in
  `test:pptx:corpus-metrics` averages. Use `npm run test:pptx:adversarial` for
  expected reject/map outcomes (bad CRC, nested depth, malformed XML, external
  rel no-fetch, EMF/SmartArt/macro stubs, RTL/CJK smoke).
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
  Package-native whole-image/media replacement remains fail-closed as a non-seed
  operation. In particular, MIME-changing replacement is rejected until a
  transaction updates and validates the media part, relationships, and
  `[Content_Types].xml` atomically.

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
- **Editor readability is independent of edited-PPTX eligibility.** Consecutive
  projection saves advance the aggregate generation without materializing a new
  package revision. The reader retains the committed base package authority and
  serves the current server-owned projection, including slide additions, reorder
  and deletion. Non-text edits still make validated edited export unavailable
  with `CANONICAL_TEXT_JOURNAL_INVALID`; immutable Original bytes are unchanged.
  [HTTP boundary evidence](../plans/261009-0901-navslides-full-reliability-deep-tdd/reports/projection-read-export-http-smoke.json)
  exercises sequential saves and structural edits on disposable data, not release
  or Office qualification.
- **Fidelity generation comes from the package store.** For a package-backed
  deck, the fidelity route reads the aggregate generation from the package-store
  head rather than trusting the compatibility JSON projection. See
  [`presentations.js`](../server/routes/presentations.js) and
  [`fidelity-contract.test.js`](../server/services/pptx-import/fidelity-contract.test.js).
- **Compatibility JSON is a projection, not package authority.** On the
  package-backed import path, the compatibility outbox is the **sole** writer to
  `presentations.json` (no direct `presentations.push` after package publish).
  Import stamps the projection (`stampImportedPresentationFields`), queues it on
  publish, then **awaits** outbox drain before the client-openable job terminal.
  Durable job GET uses contract B: a completed package receipt is not openable
  (`pending-visibility`, no `presentationId`) until the presentation row is
  listable. Outbox merge retains server-owned metadata and tombstones, keeps
  creation/deletion timestamps, and applies the package write's server-generated
  `updatedAt` timestamp. See
  [`pptx-import.js`](../server/routes/pptx-import.js),
  [`create-imported-presentation.js`](../server/services/pptx-import/create-imported-presentation.js),
  [`compatibility-view.js`](../server/services/pptx-import/compatibility-view.js),
  and
  [`compatibility-outbox.test.js`](../server/services/pptx-import/compatibility-outbox.test.js).
- **Bounded import report is server-owned projection metadata.** Import attaches
  `_pptxImportReport` (schemaVersion 1) on the stamped compatibility projection:
  full `byType` counts, capped diagnostics (≤100 entries, ≤64 KiB JSON), and
  `omittedCount`. The report is allowlisted through the editor DTO and preserved
  on package-backed merge; client PUT cannot inject or enlarge it. Durable job
  GET returns `result.presentationId` + thin `result.reportSummary` (not unbounded
  warnings); after Map TTL the summary is recovered from the presentation when
  listable. Owners:
  [`import-report.js`](../server/services/pptx-import/import-report.js),
  [`authority-sanitizer.js`](../server/services/pptx-import/authority-sanitizer.js),
  [`dto.js`](../server/services/pptx-import/package-store/dto.js).
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
  resource use, and complete referenced-media traversal remain unfinished for sync.
  Portable archive admission and replacement are owned by
  [`portable.js`](../server/services/pptx-import/package-store/portable.js) and
  [`portable-authority.js`](../server/services/pptx-import/package-store/portable-authority.js),
  with regressions in
  [`portable.test.js`](../server/services/pptx-import/package-store/portable.test.js) and
  [`portable-retained-authority.test.js`](../server/services/pptx-import/package-store/portable-retained-authority.test.js).
  None of these edges is qualification evidence. The shared reader is
  [`package-backed-presentation-read.js`](../server/services/package-backed-presentation-read.js).
- **Replacement is not revocation of retained authority.** A template or snapshot
  represents an earlier retained package subject, not the replacement's current
  head. Historical authority must survive replacement so these retained subjects
  remain restorable. Source authority must be admitted before destination
  rebinding: normalization must not turn a malformed or foreign source map into
  apparently valid destination authority. The portable owners and regression
  tests linked above are the executable contract; minimal-ZIP lifecycle evidence
  is not parser, Office or complete browser qualification.
- **Full projects and projection-only exports are different portability boundaries.**
  A projection alone cannot carry the authority needed to restore an imported
  package. The native full-project archive owner is
  [`project-export.js`](../server/routes/project-export.js); session publication
  and recovery are owned by
  [`project-import-package-session.js`](../server/services/project-import-package-session.js).
  The client save/export boundary is
  [`use-export-actions.js`](../client/src/hooks/use-export-actions.js) with
  [`export-project.js`](../client/src/utils/export-project.js).
  Original-bound styling metadata has a separate owner in
  [`trusted-import-metadata.js`](../server/services/pptx-import/trusted-import-metadata.js)
  and coverage in
  [`pptx-import-metadata-roundtrip.test.js`](../server/routes/pptx-import-metadata-roundtrip.test.js).
  Carrying importer styling is not accepting client-supplied package authority.
  The existing native-edit, validation and recovery limits still apply; these
  paths do not establish offline-media decoding or Office fidelity.
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

The separate manifest-bound strict importer qualification currently passes all 11
checked-in corpus decks with exact source hashes, zero unmapped scene-graph nodes,
zero permanent placeholders, and zero blockers. That result is application
importer-corpus evidence only and is separate from edited-package validation.

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

### Interactive education and static export boundaries

Game runtime capability ownership is in
[`game-registry.js`](../shared/src/education/game-registry.js); generated game and
print rendering are owned by [`element-renderers.js`](../shared/src/element-renderers.js),
with static answer-view decisions in
[`static-snapshot.js`](../shared/src/education/static-snapshot.js). Neither a
capability declaration nor a static export is interactive or platform qualification.

Portable classroom play does not promise offline multiplayer or secret answer
keys. Native editable media discovery is owned by
[`game-media-references.js`](../shared/src/education/game-media-references.js), with
archive media integration in
[`project-media-utils.js`](../client/src/utils/project-media-utils.js) and portable
resource constraints in
[`portable-resource-contract.js`](../shared/src/education/portable-resource-contract.js).
These executable owners avoid a separate prose inventory of nested media paths.

The accepted education scope is implemented in the working tree. Browser/live,
Electron-development and newly built Windows-package qualification are evaluated
independently for every frozen subject. [Plan progress](../plans/261001-0639-interactive-html-education-deep-tdd/plan.md#execution-progress)
keeps bounded observations separate from acceptance; the
[`education-release-gate.mjs`](../scripts/feature-inventory/education-release-gate.mjs)
owns exact-subject qualification. Preliminary runs and focused plugin/media or
evidence-integrity checks are not release-ready evidence. HTML iframe content has
no native editable PPTX representation; see the sandbox owner in
[`html-sandbox-policy.js`](../shared/src/education/html-sandbox-policy.js).

## PPTX export warning contract

PPTX export returns the existing string warning list for backward-compatible UI
alerts. The same list also carries a non-enumerable `exportReport` object for
machine checks:

| Field         | Meaning                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elementId`   | Source element id when present                                                                                                                                                                                        |
| `elementType` | Source element type                                                                                                                                                                                                   |
| `control`     | Element-control audit control id                                                                                                                                                                                      |
| `surface`     | Always `pptx-export`                                                                                                                                                                                                  |
| `matrixRowId` | Audit matrix row, e.g. `game.game-subtype-live-policy.pptx-export`                                                                                                                                                    |
| `severity`    | `warning` for expected fallback, `error` for failed native path                                                                                                                                                       |
| `message`     | User-visible warning text                                                                                                                                                                                             |
| `fallback`    | Fallback class, including `server-raster`, `client-raster`, `media-cover`, `placeholder`, `static-media`, `browser-only-media-semantics`, `default-media-cover`, `static-code`, `background-color`, or `export-error` |

The editor export action stores the most recent report on
`globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__` and surfaces warnings through
the application feedback channel/export-result UI (`showNotice` and the
`app-feedback` event), so fallback gaps are not console-only.

## Element-control export-gap classification

| Matrix row                                    | Classification                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio.audio-source-playback.pptx-export`     | `native-with-warning`: validated upload-root audio embeds; external/unsupported sources stay static, and browser-only playback semantics warn                                                 |
| `chart.chart-data-options.pptx-export`        | `fallback-warning`: native chart types stay editable; unsupported variants such as polarArea use raster/placeholder fallback and structured warnings                                          |
| `code.code-content-language.pptx-export`      | `accepted-limit`: plain editable monospace text; syntax theme fidelity is not native                                                                                                          |
| `drawing.drawing-path-style.pptx-export`      | `fallback-warning`: raster/placeholder for editable path parity                                                                                                                               |
| `game.game-subtype-live-policy.pptx-export`   | `fallback-warning`: live-only static placeholder, no private config                                                                                                                           |
| `html.trusted-html-content.pptx-export`       | `fallback-warning`: server raster when available; active scripts remain trusted HTML-only                                                                                                     |
| `icon.icon-name-style.pptx-export`            | `fallback-warning`: raster/placeholder for icon glyph parity                                                                                                                                  |
| `image.media-source-and-fit.pptx-export`      | `fallback-warning`: ordinary images remain editable; safe data/local filtered or rounded images rasterize with frame metadata, while external URLs stay native with an accepted-limit warning |
| `latex.latex-content-style.pptx-export`       | `fallback-warning`: server raster when available; editable equation parity is out of scope                                                                                                    |
| `markdown.markdown-content-style.pptx-export` | `fallback-warning`: raster/placeholder for authored Markdown structure                                                                                                                        |
| `qrcode.qr-data-style.pptx-export`            | `fallback-warning`: raster/placeholder for generated QR output                                                                                                                                |
| `svg.svg-content-overrides.pptx-export`       | `fallback-warning`: sanitizer-covered HTML/canvas path, PPTX fallback for editable SVG parity                                                                                                 |
| `table.table-layout-rotation.pptx-export`     | `accepted-limit`: rotated tables remain editable native tables; rotation is omitted with a structured warning                                                                                 |
| `timeline.timeline-events-style.pptx-export`  | `fallback-warning`: raster/placeholder for timeline geometry                                                                                                                                  |
| `video.video-source-playback.pptx-export`     | `native-with-warning`: validated upload-root video embeds with an optional validated PNG cover; external/unsupported sources stay poster/placeholder, and browser-only semantics warn         |

## Export security limits

NavSlides keeps the trusted-author model for HTML, SVG, Markdown, and media
content. Exports must not be treated as untrusted sanitization boundaries:

- Raw HTML/iframe/script content is preserved for reveal.js HTML where authored.
  Host exported decks behind the same trust boundary as the editor content.
- PPTX fallbacks may rasterize trusted active content; they do not sandbox or
  rewrite the original project data.
- PPTX media embedding never resolves external URLs or author-supplied filesystem
  paths. Only validated upload-root sources are read; traversal, MIME-changing
  content, unsupported codecs, and non-local posters fail to a static path.
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
