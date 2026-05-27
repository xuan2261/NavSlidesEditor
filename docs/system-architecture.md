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
- `animation-preview-helpers.js` and `find-replace-helpers.js` keep
  animation preview and find-replace logic isolated from the page component.

### Editor Composition

- `EditorPage.jsx` composes `EditorMenuBar`, `QuickAccessToolbar`,
  `SlideSorterView`, `InsertMenu`, `MiniToolbar`, `SelectionPane`,
  `PromptPopover`, `ProductTour`, `SlidePanel`, `Toolbar`, `SlideCanvas`,
  `PropertiesPanel`, `FindReplaceBar`, `AnimationTimeline`,
  `AnimationPreviewModal`, and modal surfaces.
- Editor save lifecycle status is explicit in the shell (`saving` / `saved` /
  `error`) with non-destructive autosave failure handling and retry action.
- `SlideCanvas.jsx` owns the core drag, resize, rotate, and snap
  interaction model.
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
    └── game-element-placeholder-renderer.jsx  # game element (Phase 3 full render deferred)

Constants:
- `client/src/constants/` holds typed constants and factory functions. Each
  element group gets its own file (`*-element-*-constants.js`).
- `game-element-types-constants.js` exports `GAME_TYPES` (7 game types), `DEFAULT_GAME_COLORS`,
  `createGameElement()`, `createQuestion()`, and `createTeam()`.
```

Text, image, media (video/audio), HTML embed, and code renderers remain inline in `canvas-element-wrapper.jsx` due to TipTap editor coupling. Each extracted renderer stays under ~150 LOC.

### Command Layer Architecture

Clipboard and keyboard commands are unified through a callback-only interface. `SlideCanvas` no longer owns keyboard listeners or clipboard state.

```
use-clipboard.js         # performCopy/Cut/Paste/Duplicate — owns clipboard semantics
use-keyboard.js          # createKeyboardHandler — dispatches from registry to callbacks
SlideCanvas.jsx          # Receives onCopy/onCut/onPaste/onDuplicate as props; no inline clipboard
EditorPage.jsx           # Wires useKeyboard + useClipboard; passes callbacks to SlideCanvas
Context menu             # Calls same command callbacks as keyboard shortcuts
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
| `live-rooms.js` | In-memory room state and role tracking |
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
- Room annotations and timers live in memory; a restart clears live room state even though presentation JSON persists.

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
| `presenter-disconnected` | server → room | — (room survives, presenterId = null) |

Annotations are stored per `slideIndex` in room state. `presenter-disconnected` replaces the previous `presenter-left` event; the room is preserved rather than deleted.

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
| `element-renderers.js` | Shared element rendering helpers |
| `slideNotes.js` | Canonical notes normalization helpers |
| `shapeUtils.js` | SVG shape/path helpers |
| `shared-toolbar-text-bg-color-palette-gradient-presets-config.js` | Color palette, gradient presets, and `isLightColor()` helper |
| `presenterTools.js` | Presenter UI controls and scripts |
| `types/presentation.js` | JSDoc data model for presentation objects |

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
- `downloadHTML()` produces the standard CDN-backed HTML export, while
  `generateOfflineHTML(generateRevealHTML(...))` produces the fully inlined
  offline HTML export.
- `server/services/pptx-exporter.js` uses a hybrid strategy: stable primitives render as native PPT
  objects, while complex DOM-backed content and gradient backgrounds fall back
  to rasterized assets so exported slides keep visual fidelity instead of
  dropping elements.
- `server/routes/pptx-import.js` exposes `POST /api/pptx/import`, which
  parses `.pptx` files via `pptxtojson` (primary) with `pptx2json` fallback,
  applies ZIP/package budget guards, and maps text/images/shapes/tables to
  NavSlides element types via shared geometry normalization; charts/equations/SmartArt become locked placeholders.
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
- Corpus strict validation now includes by-type geometry drift and property
  coverage metrics from the PPTX fidelity harness, with generated-fixture
  per-type hard gates layered on top of existing global strict thresholds.
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
  The current base type set includes 20 types: text, image, shape, code, video, audio, html, latex,
  icon, qrcode, drawing, svg, markdown, chart, table, line, divider, callout, timeline, and game.
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
- Live presenter takeover is blocked by `presenterToken` validation in
  `join-room`.
- AI custom endpoints are restricted to public `http/https` targets and block
  localhost/private/link-local ranges.
- Share links use server-side tokens and optional passwords.
- `ErrorBoundary` guards the React app against render crashes.
- Electron sandbox hardening remains a tracked follow-up; no sandbox change was
  applied in this hardening pass.

## Operational Notes

- The web app, Node server, and Electron wrapper all share the same render and
  persistence helpers.
- The live room contract and the export pipeline share the same notes
  normalization logic.
- File-backed persistence is intentional; there is still no database layer.
