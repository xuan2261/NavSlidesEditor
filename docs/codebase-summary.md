# Codebase Summary - NavSlides Editor

## Snapshot

NavSlides Editor is a self-hostable presentation editor built as a monorepo with
`client/`, `server/`, `shared/`, and `electron/` runtimes. Current release is
`v1.12.0`. The repo also carries `docs/`, `plans/`, `scripts/`, `tests/`, and
checked-in corpus / report artifacts used for verification. The editor shell
uses the tab-based ribbon as the default controls surface.

## Repository Layout

```text
navslides-editor/
├── client/        # React + Vite SPA
├── server/        # Express API + Socket.IO + file persistence
├── shared/        # Shared HTML/export/render helpers
├── electron/      # Desktop wrapper
├── docs/          # Project docs
├── plans/         # Plans, reports, archived notes
├── scripts/       # Build / maintenance scripts
└── tests/         # Playwright, Vitest, k6, corpus checks
```

## Client Runtime

| Area | Key Files | Notes |
| --- | --- | --- |
| App shell | `client/src/App.jsx` | `BrowserRouter` + `Routes`; `MainLayout` wraps app chrome; live/game routes stay outside the editor shell |
| Pages | `client/src/pages/` | Route-level pages for home, editor, settings, explore, live, remote, speaker, and game player join |
| Editor canvas | `client/src/components/SlideCanvas.jsx`, `client/src/components/canvas/*` | Drag / resize / rotate / snap surface split into focused chrome, renderer, and interaction modules |
| Ribbon shell | `client/src/components/ribbon/*`, `client/src/stores/ui-store.js` | `RibbonHeaderBar` and `RibbonPanel` are the default editor controls; active tab persists to localStorage and syncs through `ui-store.activeTab`; Home/View canvas controls share grid-size persistence |
| Element renderers | `client/src/components/canvas/element-renderers/` | Registry-based renderers for callout, icon, qrcode, drawing, svg, markdown, chart, latex, table, shape, line, and game |
| Properties panels | `client/src/components/properties/` | Type-specific property editors, including game Content/Display/Scoring tabs |
| Hooks | `client/src/hooks/` | Autosave, clipboard, keyboard, annotation sync, live timer, swipe/pinch/touch, game socket, and slide operations; `use-keyboard-contract.test.js` guards registry→hook forwarding |
| Stores | `client/src/stores/` | Zustand stores for editor, presentation, and UI state |
| Utilities | `client/src/utils/` | API wrapper, content safety, export helpers, project archive helpers, PPTX import/export helpers |

### Editor Model

- `EditorPage.jsx` composes the editor shell, overlays, menus, toolbars, and
  modal surfaces. Shared dialogs now flow through `ModalShell`; dense panel
  sections use disclosure semantics in `CollapsibleSection`. After the
  `260529-2256` hardening refactor it is a thinner orchestrator (~1356 LOC, down
  from 2071): boolean modal-visibility flags live in `ui-store` (not local
  `useState`), the modal-mount JSX is lifted into `EditorModals.jsx` +
  `editor-modals-secondary.jsx`, and element-creation / export / AI handlers are
  extracted into `use-element-creation`, `use-export-actions`, and
  `use-ai-actions` hooks. The editor body (SlidePanel / RibbonPanel / SlideCanvas
  / PropertiesPanel) stays inline.
- Vertical (child) slides are first-class: `client/src/utils/active-slide-mapper.js`
  resolves the active edit target (parent or selected child, tracked by parent
  `id`) and `mapActiveSlide` routes EVERY element write path — element callbacks,
  clipboard paste/cut/duplicate, inline duplicate, media insert, and slide-ops
  group/align — to that target so writes never land on the wrong slide. The
  `{parentId, child}` editor model bridges to the flat socket/export
  `verticalIndex` convention via `toFlatVerticalIndex`.
- AI slide generation builds locally from the outline via
  `client/src/utils/build-slides-from-outline.js` (no network round-trip; every
  field escaped). `shared/src/types/ai-slide-contract.js` (`validateAiSlides`)
  is the runtime-validated seam for a future server-supplied element payload —
  schema check + safe-`type` allowlist (excludes html/code/svg) + content
  sanitization.
- `EditorPage.jsx` composes `RibbonHeaderBar` and `RibbonPanel` directly. The
  old `EditorMenuBar`, `Toolbar`, and `InsertMenu` surfaces have been removed.
  Tab selection is stored in `ui-store.activeTab`, validated on load, and
  persisted in localStorage.
- `QuickAccessToolbar` surfaces save progress, visible save failures, and an
  explicit retry action so autosave errors remain recoverable after the menu
  bar removal.
- Editor chrome a11y is tightened: toolbar state toggles and active rich-text
  commands expose `aria-pressed`, slide background swatches are keyboard
  reachable and labelled, the highlight palette uses `listbox` / `option`
  semantics, and `PropertiesPanel` is exposed as `role="complementary"` with
  the accessible name `Properties panel`.
- Common property lock/layer actions now use Lucide icons instead of structural
  emoji or arrow glyphs.
- `SlideCanvas.jsx` owns core canvas interaction; clipboard and keyboard logic
  are pushed into hooks.
- `game-player-join-page.jsx` is the standalone player route for interactive
  game elements.
- `use-annotation-sync.js`, `use-live-timer-sync.js`, and `use-live-presentation.js`
  keep presenter-side live state in sync with Socket.IO.

## Server Runtime

| Area | Key Files | Notes |
| --- | --- | --- |
| Entry | `server/index.js` | Mounts REST routes, static `/uploads` and `/vendor`, and Socket.IO at `/ws` |
| Storage | `server/services/storage.js` | File-backed JSON persistence with per-file locks |
| Live rooms | `server/services/live-rooms.js` | In-memory room state, presenter tokens, annotations, and timer state |
| Game engine | `server/services/game-room-manager-singleton-service.js`, `server/services/game-socket-handler.js` | Game room lifecycle, scoring, timers, leaderboard, player join flow |
| PPTX import | `server/routes/pptx-import.js`, `server/services/pptx-import/*` | `.pptx` upload route, parser isolation, geometry normalization, fidelity harness |
| REST routes | `server/routes/*.js` | Presentations, templates, share, history, upload, GitHub, sync, settings, media, live, games, explore, analytics, marketplace, AI |

### Live Model

- Presenter join requires a server-issued `presenterToken`.
- Remote and speaker routes connect as controller surfaces, not as presenters.
- Viewer count excludes controllers.
- Live annotations and timers are in memory; restart clears live room state.
- There is no real-time collaborative slide editing.

## Shared Runtime

| Module | Purpose |
| --- | --- |
| `shared/src/htmlGenerator.js` | Reveal.js HTML, print HTML, offline HTML, and present-mode generation |
| `shared/src/element-renderers.js` | Shared render helpers for export and preview |
| `shared/src/slideNotes.js` | Canonical notes normalization |
| `shared/src/shapeUtils.js` | SVG shape/path helpers |
| `shared/src/presenterTools.js` | Presenter overlay tools |
| `shared/src/types/presentation.js` | JSDoc data model used by client and server |

### Export and Import

- Standard HTML export is CDN-backed.
- Offline HTML inlines runtime assets.
- PPTX export is hybrid: stable primitives stay editable, while complex DOM-backed
  content and unsupported cases fall back to raster assets.
- PPTX import uses `pptxtojson` as the primary parser with `pptx2json` fallback
  inspection and a checked-in fidelity corpus.

## Electron Wrapper

- `electron/main.js` starts the embedded server on port `3002`, sets
  `SLIDES_DATA_DIR` and `SLIDES_UPLOADS_DIR` under Electron `userData`, and
  launches the desktop window.
- Sandbox is disabled for the current desktop build path.
- `electron/preload.js` exposes credential helpers backed by `safeStorage`
  when the OS supports it.

## Data and Persistence

| Path | Purpose |
| --- | --- |
| `server/data/presentations.json` | Presentation data |
| `server/data/templates.json` | Custom templates |
| `server/data/share-tokens.json` | Share links and passwords |
| `server/data/github-config.json` | GitHub integration config |
| `server/data/settings.json` | App settings and AI API key |
| `server/data/analytics.json` | Share-view analytics |
| `server/data/media.json` | Uploaded media metadata |
| `server/data/history/` | Version snapshots |
| `server/data/rclone.conf` | rclone config |
| `server/data/sync-export/` | Sync staging |
| `server/data/tmp-pptx-imports/` | Temporary PPTX import uploads |
| `server/uploads/` | Uploaded media files |

- `storage.js` initializes the data folders on first run.
- File writes are serialized with per-file locks.
- All JSON state files in `server/data/` are written through `writeJsonAtomic`
  (temp file + rename) to guarantee crash safety under concurrent reads,
  `node --watch` restarts, or process termination mid-write. Direct calls to
  `fs.writeJson` for persistent state are forbidden — extend the helper if a
  new file is added.
- File-backed settings may contain sensitive values and must not be committed
  or deployed publicly.

## Testing Surface

- Vitest covers client utilities, stores, hooks, server routes, and PPTX helpers.
- Playwright covers editor flows, live flows, game flows, import/export, and
  visual regression.
- `k6` load tests target REST and WebSocket paths.
- The PPTX corpus harness validates semantic fidelity and round-trip stability.

## Behavior Notes

- `slide.notes` is canonical; `speakerNotes` is a legacy alias.
- `client/src/index.css` is the single global stylesheet.
- New code should stay under the 200 LOC guideline where practical; legacy
  oversize files are refactor targets, not automatic violations.
- Game elements are first-class slide elements with dedicated presenter/player
  flows and 7 game types.

## Repo Notes

- Root package version is `1.12.0`.
- Runtime baseline is Node.js 20+.
- There is no database layer; persistence is file-based by design.
- There is no full TypeScript migration; JSDoc is the type system.
- The repo includes large generated artifacts such as template assets, icon
  path data, plans, and report archives.
