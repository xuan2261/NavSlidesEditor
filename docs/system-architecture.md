# System Architecture - NavSlides Editor

## Overview

NavSlides Editor is a route-based React application backed by an Express API,
Socket.IO live transport, and file-backed JSON persistence. The same codebase
ships as a web app, a Node server, and an Electron desktop wrapper.

```text
Browser / Electron
  -> React Router SPA in client/
  -> Express REST API + Socket.IO in server/
  -> shared render/export helpers
  -> JSON files + uploads on disk
  -> GitHub / rclone / CDN services
```

## Client Architecture

### App Shell

- `client/src/App.jsx` uses `BrowserRouter`, `Routes`, and `Route`.
- `MainLayout.jsx` wraps the route tree and renders `StatusBar.jsx`.
- The root app stores the editor theme in `localStorage` and mirrors it to
  `document.documentElement.dataset.theme`.
- Live routes (`/live/:roomCode`, `/remote/:roomCode`, `/speaker/:roomCode`) and the game player route (`/player/:slideId/:elementId`) are separate top-level routes, not nested inside the editor shell.

### Route Map

| Path | Page |
| --- | --- |
| `/` | `HomePage` |
| `/editor/:id` | `EditorPage` |
| `/template/:id` | `EditorPage` in template mode |
| `/settings` | `SettingsPage` |
| `/explore` | `ExplorePage` |
| `/live/:roomCode` | `LiveViewPage` |
| `/remote/:roomCode` | `RemoteControlPage` |
| `/speaker/:roomCode` | `SpeakerViewPage` |
| `/player/:slideId/:elementId` | `game-player-join-page.jsx` |

### State And Hooks

- Editor state is split into three Zustand stores: editor, presentation, and UI.
- Logic extracted from `EditorPage` lives in hooks such as
  `use-autosave.js`, `use-clipboard.js`,
  `use-keyboard.js`, `use-live-presentation.js`, `use-slide-operations.js`,
  and `use-reveal-preview-frame.js`.
- Page-level orchestration is divided among focused hooks in
  `hooks/editor-controller/`: active slide, element operations, history,
  keyboard, persistence/save, preview styles, rich text, and selection.
  `use-editor-command-model.js` supplies the shared command-palette actions.
- `animation-preview-helpers.js` and `find-replace-helpers.js` keep
  animation preview and find-replace logic isolated from the page component.

### Editor Composition

- `EditorPage.jsx` composes `QuickAccessToolbar`,
  `SlideSorterView`, `SelectionPane`,
  `PromptPopover`, `ProductTour`, `SlidePanel`, `SlideCanvas`,
  `PropertiesPanel`, `FindReplaceBar`, `AnimationTimeline`,
  `AnimationPreviewModal`, `EditorModals`, `editor-modals-secondary`, and modal surfaces.
- Modal-visibility flags live in `ui-store` (not local `useState`). Modal-mount JSX is
  lifted into `EditorModals.jsx` + `editor-modals-secondary.jsx`. Element-creation,
  export, and AI handlers are extracted into `use-element-creation`, `use-export-actions`,
  and `use-ai-actions` hooks. `EditorPage` remains the composition root and passes
  controller results into the extracted editor shell, ribbon, workspace, and modal
  surfaces.
- **Ribbon polish**: contextual Format tab driven by `ui-store.formatContext`
  (`{ hasSelection, elementType }`). `RibbonBigButton` promotes primary tab actions.
  `RibbonDensityProvider` measures the ribbon container and uses wide, condensed, or
  compact density. Lower-frequency groups move into a named `More` menu rather than
  depending on an invisible horizontal scrollbar.
- **Responsive workspace**: compact (`<1024`), standard (`1024-1279`), and wide
  (`>=1280`) tiers are derived from editor workspace width. The navigator docks in
  standard and wide tiers. Properties and Design Ideas share one inspector host,
  which docks only in the wide tier; narrower tiers open navigator and inspector
  overlays without shrinking the canvas.
- `StatusBar` zoom, ribbon/canvas controls, keyboard shortcuts, and command palette
  all read and update `ui-store.zoom`. Manual zoom sets `userZoomMode`; auto-fit uses
  `setAutoFitZoom` so a resize does not overwrite a user's chosen zoom. The view
  switcher toggles `editor-store.viewMode` (Normal / Slide Sorter / Present) via
  `ui-store.presentHandler`.
- Editor save lifecycle status is explicit in the shell (`saving` / `saved` /
  `error`). Autosave and every manual-save surface call the same persistence
  controller; transient retry preserves its failed snapshot and idempotency key,
  while stale-generation conflicts use the dedicated conflict flow.
- Pending saves also write a route-scoped browser draft before the network request.
  The synchronous `localStorage` receipt covers the supported Chromium/Electron
  path, with IndexedDB as a quota/availability fallback. A reload loads the
  remote deck first and then requires an explicit `Recover Local Draft` or `Use
  Remote` choice; no draft replaces remote content automatically. Drafts are
  removed only after a matching committed response or explicit remote choice.
  Storage-disabled/private-browsing modes and a hard kill before an asynchronous
  IndexedDB fallback commits remain documented durability limits.
- `SlidePanel.jsx` is a semantic slide navigator. It uses list/listitem roles,
  stable slide IDs for selection, keyboard-focusable thumbnails, named controls,
  and a menu surface for reorder, duplicate, vertical-slide, and delete actions.
- `SlideCanvas.jsx` owns the core drag, resize, rotate, crop, and snap interaction
  model. Mouse, pen, and touch use Pointer Events with pointer capture and
  cancellation rollback; `use-pinch-zoom.js` handles two-contact zoom and its touch
  fallback.
- `PropertiesPanel.jsx` routes to type-specific editors in
  `components/properties/`.
- Layout sub-components live in `components/layout/` (`MainLayout`,
  `StatusBar`); shared UI primitives live in `components/ui/`
  (`Button`, `Select`, `Input`, `ColorPicker`).
- Game elements render through `client/src/components/canvas/element-renderers/game-element-renderer.jsx` with a placeholder fallback while presenter/player flows use dedicated sockets and overlays.

### Canvas Decomposition

`SlideCanvas.jsx` was decomposed from ~2759 LOC down to ~841 LOC. All renderers and chrome components live under `client/src/components/canvas/`:

```
client/src/components/canvas/
├── canvas-element-wrapper.jsx              # Selection/rotation handles + dispatch
├── canvas-crop-overlay-with-handles.jsx   # Image crop overlay + CROP_HANDLES
├── canvas-grid-overlay.jsx                # Grid background overlay
├── canvas-rulers.jsx                      # Horizontal + vertical rulers
├── canvas-floating-zoom-in-out-fit-controls.jsx  # Zoom in/out/fit controls
├── canvas-footer-overlay-with-section-and-page-number.jsx  # Page number + section
├── canvas-right-click-context-menu-for-slide-elements.jsx  # Context menu
├── use-canvas-pointer-interaction.js     # Drag/resize/rotate pointer routing
├── use-canvas-resize-rotate.js           # Resize math + 15-degree rotation snap
├── use-canvas-snapping-helpers-for-grid-and-smart-guides.js  # Snap + smart guide math
├── use-canvas-rubber-band-drag-selection.js  # Rubber-band selection
└── element-renderers/
    ├── registry.js                        # elementRendererRegistry + getElementRenderer
    ├── callout-element-renderer.jsx
    ├── icon-element-renderer.jsx
    ├── qrcode-element-renderer.jsx
    ├── drawing-element-renderer.jsx
    ├── svg-element-renderer.jsx
    ├── markdown-element-renderer.jsx
    ├── chart-element-renderer.jsx
    ├── latex-element-renderer.jsx
    ├── table-element-renderer.jsx
    ├── shape-element-renderer.jsx
    ├── line-element-renderer.jsx
    ├── game-element-renderer.jsx          # game element (full SVG renderer, active)

Constants:
- `client/src/constants/` holds typed constants and factory functions. Each
  element group gets its own file (`*-element-*-constants.js`).
- `game-element-types-constants.js` exports `GAME_TYPES` (10 game types), `DEFAULT_GAME_COLORS`,
  `createGameElement()`, `createQuestion()`, and `createTeam()`.
```

Text, image, media (video/audio), HTML embed, and code renderers remain inline in `canvas-element-wrapper.jsx` due to TipTap editor coupling. Each extracted renderer stays under ~150 LOC.

### Command Layer Architecture

Clipboard, save, zoom, and keyboard commands are unified through callback-only
interfaces. `SlideCanvas` no longer owns keyboard listeners or clipboard state.

```
use-clipboard.js         # performCopy/Cut/Paste/Duplicate — owns clipboard semantics
use-keyboard.js          # createKeyboardHandler — dispatches from registry to callbacks
use-editor-command-model.js       # command palette entries reuse canonical callbacks
use-editor-persistence-controller.js  # autosave + immediate manual save entry point
use-editor-save-controller.js     # serialized generation-aware save queue and retry
ui-store.js              # canonical zoom value, manual zoom actions, and auto-fit action
SlideCanvas.jsx          # Receives onCopy/onCut/onPaste/onDuplicate as props; no inline clipboard
EditorPage.jsx           # Wires useKeyboard + useClipboard; passes callbacks to SlideCanvas
Ribbon/File/status UI    # Calls the same save and zoom callbacks as keyboard commands
Context menu             # Calls the same clipboard callbacks as keyboard shortcuts
```

`createDuplicateOperation` is synchronous (uses `crypto.randomUUID()`) with a +20/+20 offset; includes locked-element guard. `useKeyboard` uses a registry-based dispatch: `shortcut.id → on{capitalize(id)}` callback.

### Shortcut Registry

User-defined keyboard shortcut overrides are stored in `localStorage` and merged with defaults at runtime.

| Module | File | Purpose |
| --- | --- | --- |
| Definitions | `default-keyboard-shortcut-definitions-registry.js` | DEFAULT_SHORTCUTS (40+ shortcuts across 6 categories), scope-gated dispatch, getShortcuts(), getShortcutById() |
| Normalization | `shortcut-normalizer.js` | normalizeKey(), isReservedChord(), isModifierKey() |
| Persistence | `shortcut-local-storage-persistence.js` | loadOverrides(), saveOverride(), resetOverride(), resetAll(), detectConflict() |
| UI | `SettingsPage.jsx` | Shortcut manager with record/conflict-warn/reset per shortcut |

Registry schema: `{ id, label, category, defaultKey, scopes, guard? }`. Scopes: `'editor'` (default), `'presentation'` (slideshow controls), `'presentation-game'` (game presenter). Shortcuts are grouped by category (clipboard, navigation, slideshow, game, annotation, editing, view) in the Settings UI.

## Server Architecture

### Express Entry

- `server/index.js` starts Express and mounts Socket.IO.
- Routes are split into individual files in `server/routes/`:
  - `presentations.js` - presentation CRUD
  - `templates.js` - template management
  - `share.js` - shareable links
  - `github.js` - GitHub push integration
  - `ai.js` - AI generation and translation
  - `live.js` - live presentation rooms
  - `games-rest-api-handler.js` - game REST endpoints
  - `plugins.js` - local plugin discovery and asset API
  - `settings.js` - app settings
  - `explore.js` - explore/discover
  - `analytics.js` - share analytics
  - `marketplace.js` - marketplace integration
  - `upload.js` - file upload with SHA256 dedup
  - `media.js` - media library
  - `sync.js` - rclone sync
  - `history.js` - version snapshots
  - `pptx-import.js` - PPTX import

### Middleware

| Middleware | Purpose |
| --- | --- |
| `validate.js` | Zod schema validation for mutation requests |
| `schemas.js` | Shared Zod schema definitions |
| `error-handler.js` | Centralized JSON error formatting |

### Services

| Service | Purpose |
| --- | --- |
| `storage.js` | File I/O abstraction with per-file locking |
| `socket-handler.js` | Socket.IO event wiring |
| `live-rooms.js` | In-memory room state, role tracking, and orphan-room cleanup |
| `game-socket-handler.js` | Game Socket.IO wiring |
| `plugin-runtime.js` | Bundled/user plugin manifest discovery and safe asset path resolution |
| `presentation-finder.js` | Presentation lookup utility |
| `ai-provider.js` | AI service integration |
| `services/pptx-import/geometry.js` | Nullish-safe geometry normalization + affine transform helpers for PPTX import |

### Live Protocol

- Room roles are `presenter`, `controller`, and `viewer`.
- Presenter join requires a server-issued `presenterToken` tied to the room.
- Remote control and speaker surfaces join as `controller`, not `presenter`.
- `control-navigate` is sent from a controller to the presenter, then the
  presenter broadcasts `navigate` and `sync-state` to other clients.
- Live state is `{ slideIndex, verticalIndex, fragmentIndex }`.
- `presentation-meta` carries slide labels, slide count, and notes for the
  controller UI.
- Viewer count excludes controllers.
- Asynchronous presentation payloads are fenced by room object identity, a
  monotonic presentation generation, the expected deck ID, and the active
  presenter before they are emitted. A delayed lookup cannot overwrite a newer
  deck intent or a recreated room with the same code.
- Room annotations and timers live in memory; a restart clears live room state even though presentation JSON persists. Orphaned rooms are cleaned up after presenter teardown so idle live sessions do not grow without bound.

### Game Authority

- Game rooms are created through `POST /api/games`; a newly created room returns
  a private room-scoped host capability. The server stores only its hash; the
  raw capability is not part of room state, socket broadcasts, or leaderboard
  rows. Retries can recover a pending capability while the unclaimed room is
  inside its bounded TTL; that TTL is independent of empty-room reconnect
  grace, and ordinary player joins cannot cancel it. Joining as host claims the
  room and removes the pending raw value. A capability-authorized host
  reconnect can rotate a lost player session without exposing the capability.
- Host mutations require the capability plus the active player session and
  socket binding. Player mutations, including answers and leave, require the
  server-issued player session and active socket; stale sockets are rejected.
  Socket memberships use a room-generation-specific internal channel; cleanup
  emits an expiry event and evicts old members before a reused game ID can
  receive new broadcasts.
  The generic `POST /api/games` create route intentionally remains a local
  single-user bootstrap boundary, not user authentication. Multi-user or
  internet-facing deployments must put it behind the external authentication
  layer described in the security model; host and player mutations remain
  capability/session guarded after creation.
- Observers join read-only and remain outside the player map. Public leaderboard
  rows intentionally contain only `{ playerId, name, score }` for stable rank
  matching; they never contain session or host authority values.
- The generated Present page waits for the authenticated presenter room to commit
  its deck identity, then calls `POST /api/presentations/:id/present/game-bootstrap`.
  The server reloads the authoritative presentation, extracts supported game
  elements, creates or reuses rooms, and returns private host capabilities with
  `Cache-Control: no-store`. Browser-supplied game options are not authoritative.
  Presenter-created rooms are scoped to the presentation and live-room identity;
  an occupied or unclaimed room from another live scope is rejected instead of
  reusing the wrong room. A disconnected claimed room with no connected players
  may be reclaimed only when the new bootstrap belongs to the same presentation
  (a restarted live-room scope); a different presentation remains isolated. A
  reconnect may advance the generation within the same scope. The generated
  runtime uses a random per-session host player identity and rotates persisted
  legacy deterministic identities before reconnecting, joins each returned room through
  `/games` as a host, retains only session-scoped reconnect state, retries
  bounded room-readiness failures, reboots a host room after cleanup expiry or
  `room-not-found`, and disconnects game sockets on unload. Static share, export,
  and print paths do not execute this live bootstrap branch.

### Socket.IO Events

**Navigation and state:**
`navigate` | `sync-state` | `control-navigate` | `presentation-meta` | `viewer-count`

**Annotation events:**
| Event | Direction | Payload |
| --- | --- | --- |
| `annotation:add` | presenter → server | `{ id, slideIndex, points, color, width, tool }` |
| `annotation:remove` | presenter → server | `{ id, slideIndex }` |
| `annotation:clear` | presenter → server | `{ slideIndex }` |
| `annotation:removed` | server → room | `{ id, slideIndex }` |
| `annotation:cleared` | server → room | `{ slideIndex }` |
| `annotations:sync` | server → client | `{ slideIndex, annotations[] }` |
| `presenter-disconnected` | server → room | — (bounded reconnect grace, presenterId = null) |
| `presenter-left` | server → room | — (terminal presenter departure after grace) |

Annotations are stored per `slideIndex` in room state and re-synced for the active slide on navigation/rejoin. `presenter-disconnected` marks the bounded reconnect window; only a presenter rejoin cancels it. If the presenter does not return before grace expires, the server emits `presenter-left` and removes the live room and socket mappings.

**Timer events:**
| Event | Direction | Payload |
| --- | --- | --- |
| `game-timer-start` | presenter → server | `{ elementId, endedAt }` |
| `game-timer-pause` | presenter → server | `{ elementId, pausedAt }` |
| `game-timer-resume` | presenter → server | `{ elementId }` |
| `game-timer-adjust` | presenter → server | `{ elementId, delta }` |
| `game-timer-stop` | presenter → server | `{ elementId }` |
| `timer:sync` | server → room | `{ timers: { elementId, endedAt, pausedAt, duration } }` |
| `timer:ended` | server → room | `{ elementId }` |

Timer state is server-authoritative: server stores `endedAt` / `pausedAt`, clients compute remaining via `computeTimerRemaining(endedAt)`. `window.__timerStates` bridges timer state into reveal.js iframes. Input validation: delta capped at ±3600s, duration 1-7200s, elementId validated by regex + length check.

### Storage Layout

```text
server/data/
├── presentations.json
├── templates.json
├── share-tokens.json
├── github-config.json
├── analytics.json
├── media.json
├── settings.json
├── rclone.conf
├── history/
├── sync-export/
├── plugins/
└── tmp-pptx-imports/

server/uploads/
└── {uuid}.{ext}
```

- `storage.js` uses an in-memory lock queue per file to avoid concurrent JSON
  write/read races.
- `initDataFiles()` creates the data directories and default JSON files on
  first run.
- `tmp-pptx-imports/` is a temporary workspace for PPTX import uploads and is cleaned after each import.
- `pptx-originals/{uuid}.pptx` stores the zero-loss original package for each successful PPTX import (lifecycle = presentation lifetime). Metadata on the presentation is `pptxOriginal: { id, sha256, byteLength, uploadedAt }` only — no client filesystem paths. Download via `GET /api/presentations/:id/pptx-original`. Import jobs complete with `{ presentationId, stats, warnings }` after server-side create.
- PPTX import builds an OOXML **scene graph** (`ooxml-scene-graph/`) as inventory truth alongside `pptxtojson` mapping; mapped elements receive `_pptxSource.nodeId` for reconcile. Visual oracle tooling lives under `pptx-import/oracle/` (`npm run test:pptx:oracle`, `test:pptx:oracle:capture` for present-mode actuals).
- Optional user plugins live under `server/data/plugins/<slug>/`; bundled
  plugins live under top-level `plugins/<slug>/`.

## Plugin Runtime

Phase 1 supports local trusted plugin packages only. The server scans
`plugins/<slug>/parallax-plugin.json` and
`server/data/plugins/<slug>/parallax-plugin.json`, normalizes contributed
element metadata, and exposes read-only routes:

| Route | Purpose |
| --- | --- |
| `GET /api/plugins` | List normalized plugin manifests |
| `GET /api/plugins/:slug` | Read one normalized plugin |
| `GET /api/plugins/:slug/manifest` | Read one manifest |
| `GET /api/plugins/:slug/assets/*` | Serve files from plugin `dist/` only |

Client registry modules in `client/src/plugins/` register contributed element
types as `plugin:<type>`. `EditorPage` loads the registry once, the Insert
ribbon exposes loaded plugin actions, and `canvas-element-wrapper.jsx` renders
plugin elements through `PluginSandbox`.

The sandbox runtime fetches plugin HTML from the asset route, injects a minimal
`window.navslides.updateData()` bridge, and renders it in an iframe with
`sandbox="allow-scripts"` only. Parent message handling checks
`event.source === iframe.contentWindow` before merging data patches into
`element.pluginData`.

Shared export rendering treats plugin elements as dynamic types. Reveal/share
HTML uses the stored plugin asset path when safe; print/PDF/offline paths render
a static escaped fallback. Marketplace, install ZIP, plugin KV storage, auth,
billing, and offline sandbox inlining are not part of Phase 1.

## Shared Runtime Contract

### Shared Modules

| Module | Purpose |
| --- | --- |
| `htmlGenerator.js` | Reveal.js HTML and print HTML generation |
| `live-presenter-runtime.js` | Generated live presenter navigation and live-room runtime |
| `live-presenter-game-runtime.js` | Generated presenter game bootstrap, host sockets, and bounded cleanup |
| `transition-settings.js` | Validated presentation/slide transition resolution shared by generation and preview |
| `element-renderers.js` | Shared element rendering helpers |
| `design-tokens.js` | `'auto'` → `var(--ns-*)` resolver shared by both render paths (`DEFAULT_TOKENS`, `AUTO_FIELD_MAP`, `resolveAutoColor`, `isTokenVar`) |
| `theme-presets.js` | 39 token presets (`THEME_PRESETS`), 7 categories |
| `fx/` | 8 canvas FX modules + registry; `buildFxRuntimeScript()` emits the inlined browser runtime |
| `slideNotes.js` | Canonical notes normalization helpers |
| `shapeUtils.js` | SVG shape/path helpers |
| `shared-toolbar-text-bg-color-palette-gradient-presets-config.js` | Color palette, gradient presets, and `isLightColor()` helper |
| `presenterTools.js` | Presenter UI controls and scripts |
| `types/presentation.js` | JSDoc data model for presentation objects |

### Design Token Render Path

The `'auto'` color sentinel resolves to a CSS custom property through ONE shared
resolver (`design-tokens.js`), consumed by both render paths so they cannot
diverge:

```text
'auto' color field
  ├─ shared string renderers (element-renderers.js / shapeUtils.js)  → resolveAutoColor()
  └─ React editor renderers (client canvas)                          → resolveAutoColor()
        => both emit var(--ns-<token>)
```

- Tokens apply at two scopes: deck (`presentation.designTokens`, merged over
  `DEFAULT_TOKENS`) and per-slide (`slide.designTokens`, merged over deck tokens).
- `htmlGenerator` injects `:root{--ns-*}` plus per-slide `[data-slide-idx]`
  override blocks ONLY when a deck uses tokens. A frozen-hex deck emits no token
  CSS and renders exactly as before (backward-compat contract). `DEFAULT_TOKENS`
  values equal the historical hardcoded hex, so token-free output is
  byte-identical at paint time.
- SVG paints route token vars through the `style` attribute, never the SVG
  presentation attribute, because SVG presentation attrs do not resolve CSS
  custom properties. `safeCssColor` whitelists the `var(--ns-<name>)` shape.

### Background FX Runtime

- A slide background of `type: 'fx'` stores `{name, params, fallbackColor}`.
- `shared/src/fx/index.js` is the registry; each FX module exports self-contained
  `initState`/`draw` functions so `buildFxRuntimeScript()` can serialize them into
  a single inlined `<script>` that powers present/export HTML, while the editor
  canvas imports the same modules directly. One source, two consumers.
- The inlined runtime starts the active slide's rAF loop on both Reveal `ready`
  and `slidechanged`, stops off-slide canvases, honors `prefers-reduced-motion`
  (single static frame), and uses `fallbackColor` for print/PDF.

### Design Ideas Engine

- `client/src/lib/design-ideas/` holds pure functions: `analyze-slide.js`
  distills a slide into a deterministic feature record; `suggest.js` returns 3-5
  ranked suggestions (layout re-fits from `slide-templates` + theme pairings from
  `THEME_PRESETS`). No AI; stable ordering by score then id.
- `design-ideas-panel.jsx` mounts in `EditorPage`, toggled from the View ribbon
  through `ui-store.showDesignIdeas`. Applying a suggestion is one undoable step.

### Notes Contract

- `Slide.notes` is the canonical field.
- `speakerNotes` is accepted as legacy input only.
- `normalizePresentationNotes()` rewrites slides and child slides so export and
  live paths see the same notes shape.
- `getSlideNotes()` is used by HTML export, print export, PPTX export, AI
  translation flows, and live controller metadata.

## Styling System

- Tailwind is the app chrome utility layer.
- `client/src/index.css` contains the Tailwind directives plus shared CSS
  variables for colors, surfaces, borders, radii, and typography.
- `client/tailwind.config.js` maps Tailwind utilities to those CSS variables,
  disables preflight, and scopes important styles to `#root`.
- Dark mode is driven by `data-theme="dark"` on the document element.
- `client/src/lib/utils.js` provides `cn()`, `isBackdropClick()`, and
  `useEscapeClose()` for shared component behavior.

## Export Pipeline

- `generateRevealHTML()` renders the live/present HTML deck.
- `generatePrintHTML()` expands fragments into print pages.
- `transition-settings.js` normalizes transition type, direction, duration, and
  speed. Destination-slide settings override presentation settings, with
  validated defaults shared by production generation and `TransitionPreview`.
- `TransitionPreview` builds a two-slide deck through `generateRevealHTML()`,
  uses the configured presentation resolution, local `/vendor/reveal.js` assets,
  and `generateOfflineHTML()` before loading the sandboxed iframe. Its replay
  hook disables automatic advancement while preserving the effective transition
  metadata.
- `downloadHTML()` produces the standard CDN-backed HTML export, while
  `generateOfflineHTML(generateRevealHTML(...))` produces the fully inlined
  offline HTML export.
- `server/services/pptx-exporter.js` uses a hybrid strategy: stable primitives render as native PPT
  objects, while complex DOM-backed content and gradient backgrounds fall back
  to rasterized assets so exported slides keep visual fidelity instead of
  dropping elements. Element-level render failures degrade to labelled
  placeholders and warnings instead of failing the whole export.
- `server/routes/pptx-import.js` exposes `POST /api/pptx/import`, which
  parses `.pptx` files through `pptxtojson` 2.0.2 only. `pptx2json` remains
  isolated to the parser benchmark sandbox, never a runtime fallback. The route
  applies ZIP/package budget guards with measured inflated-byte caps and worker heap
  limits, inspects OOXML slide relationships for native chart/SmartArt evidence,
  and maps text/images/shapes/tables to NavSlides element types via shared geometry
  normalization. Public stats preserve finite scene reconciliation counts without
  inferring missing evidence as zero. Unsupported chart/equation content degrades to
  labelled placeholders; SmartArt is flattened when parser data is available and
  native package gaps are surfaced through import warnings.
- Import unit convention: the canvas is 960×540 at 72 DPI, so 1pt = 1px before
  box scale. All length-bearing fields (font sizes, text insets, border/shadow
  widths) convert as `pt × scale` — not `pt × 96/72`. The shared helper
  `ptToCanvasPx` in `server/services/pptx-import/mapper/utils-text.js` encodes
  this rule. The generic 96-DPI converter in `shared/src/shared-html-parser.js`
  is intentionally unchanged; it serves browser/reveal.js layout, not the import
  canvas.
- EMF/WMF vector images are browser-unrenderable and import as labelled
  placeholders preserving the source box geometry; rasterization is deferred.
- Imported PPTX text carries `_pptxImportMeta` fit/wrap metadata that editor,
  shared HTML export, and PPTX export paths honor; user edits invalidate stale
  import-fit metadata.
- Imported PPTX image crop is represented as source-crop metadata plus
  editor-native image offsets. Real-browser audit reports source crop separately
  from unexpected clipping, and image wrappers are fitted within slide bounds.
- PPTX HTML/LaTeX rasterization uses an offscreen iframe capture path aligned
  with print export: embed content is wrapped as a full document, common CDN
  dependencies are resolved through local `/vendor` assets, and LaTeX/TikZ
  output is captured at higher pixel density before insertion into PowerPoint.
- `npm run test:pptx:corpus-metrics` (and compatibility alias
  `npm run test:corpus`) is the parser-relative regression lane. It retains
  semantic/round-trip scoring without importer strict options. `npm run test:pptx:best-effort`
  pairs a non-importer-strict corpus/round-trip run with the strict browser smoke;
  neither command qualifies the importer.
- `npm run test:pptx:importer-qualification` binds to the checked-in 11-deck
  `server/data/test-corpus/importer-qualification-manifest.json`, including its
  exact names, SHA-256 values, and manifest digest. It copies each verified
  source into one read-only, hash-checked temporary snapshot for both the
  best-effort evidence pass and `{ strict: true }` decision pass; each pass is
  rechecked afterward and the gate fails closed on invalid inventory or
  missing/invalid or non-zero native gaps.
  `npm run test:pptx:strict` is its deprecated alias, not a metrics or browser
  command; known EMF/native-node blockers can make it non-zero.
- PPTX layout regression protection has two browser gates: PR/runtime-sensitive
  strict smoke (`npm run test:pptx:browser-audit`) and release-blocking full
  strict audit (`npm run test:pptx:browser-audit:full`).
- `exportPptx.js` reuses `getSlideNotes()` so speaker notes stay aligned across
  HTML and PPTX exports, and it preserves slide z-order by exporting sorted
  element stacks.
- `project-media-utils.js` centralizes project archive media detection,
  canonical `background.image` handling, `.navslides` manifest `1.1` media
  mapping, and import-time upload URL rewriting for local `/uploads/...`
  assets.
- `presentInWindow()` uses the server `/api/presentations/:id/present` route
  when a saved presentation ID is available.

## Data Model

- `shared/src/types/presentation.js` defines the JSDoc model used by client and
  server.
- Element types are kept in sync with the editor, export pipeline, and Zod schemas.
  The canonical base type set is **19 types**: text, image, shape, code, video, audio, html, latex,
  icon, qrcode, drawing, svg, markdown, chart, table, line, callout, timeline, and game.
  "divider" is a `line` preset, not a separate type. The canonical source is
  `Object.keys(ELEMENT_DEFAULTS)` in `client/src/data/element-defaults.js`.
  Plugin elements use dynamic `plugin:<contributed-type>` values with
  `pluginId`, `pluginSlug`, `pluginData`, and `pluginRuntime` metadata.
  Typed constants and factory functions live in `client/src/constants/` (e.g.
  `game-element-types-constants.js`).
- Runtime validation uses `server/middleware/schemas.js`; the schemas allow
  type-specific fields via `.passthrough()`.

## External Integrations

### GitHub

- GitHub push uses the Git Data API.
- Config is stored in `github-config.json`.
- Electron can encrypt credentials with `safeStorage`; Docker and Node use file
  storage.

### rclone

- Cloud sync uses `rclone` and writes a local `rclone.conf`.
- Docker includes `rclone` in the image; desktop installs rely on a system
  binary.

### CDN Dependencies

- Reveal.js, KaTeX, Chart.js, highlight.js, and TikZJax are loaded from CDN
  paths in the exported HTML.

## Security Model

- No authentication is built into the app.
- Zod validates all mutation requests.
- Content safety is targeted: text/markdown/svg/shape-text surfaces are
  sanitized or escaped.
- HTML embed remains trusted programmable content by product policy; script
  execution is intentionally preserved in editor/present/export/share paths.
- Upload routes enforce MIME validation and rate limiting.
- `/api/analytics/:id` requires a valid share token mapped to that
  presentation.
- Soft-deleted presentations are blocked from serve/share/export-derived paths
  through centralized serveable-presentation lookup.
- Live presenter takeover is blocked by `presenterToken` validation in
  `join-room`.
- AI custom endpoints are restricted to public `http/https` targets, block
  localhost/private/link-local ranges, and pin the outbound connection to the
  validated IP to avoid DNS rebinding between validation and fetch.
- Share links use server-side tokens and optional passwords.
- `ErrorBoundary` guards the React app against render crashes.
- Electron denies unexpected window-open/navigation targets outside the app
  origin and explicit safe external schemes.

## Operational Notes

- The web app, Node server, and Electron wrapper all share the same render and
  persistence helpers.
- The live room contract and the export pipeline share the same notes
  normalization logic.
- File-backed persistence is intentional; there is still no database layer.

### Feature-Coverage Matrix

The feature-coverage traceability matrix is maintained by `scripts/feature-inventory/`. The pipeline scans `[cap:<id>]` annotations in test files, joins them against `feature-manifest.json` (100 editor-core capabilities), and produces `docs/feature-coverage-matrix.md` (auto-generated — do not hand-edit) plus machine JSON at `scripts/feature-inventory/reports/feature-coverage-matrix.json`. Run via `npm run matrix` / `npm run matrix:gate`. CI job `feature-coverage-gate` runs the gate as a non-required warn-first check. Editor-core gaps are currently closed: `coverage-gate-allowlist.json` is empty and the matrix reports 100/100 PASS. Extended export/import/live/share/AI/game/sync/history coverage is reported separately by `npm run matrix:extended-report` with executable, mocked-e2e, and contract-only modes. Required CI jobs (blocking): lint, unit-coverage, build, e2e-chromium (4 shards), e2e-live, e2e-mobile, e2e-visual, pptx-corpus, load-smoke, required-checks fan-in.
