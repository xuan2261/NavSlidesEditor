# Codebase Summary - NavSlides Editor

## Snapshot

NavSlides Editor là trình soạn thảo presentation tự host, chia thành 4 vùng runtime:
`client/`, `server/`, `shared/`, và `electron/`. Docs, tests, và planning artifacts
sống cùng code trong repository. Phiên bản v1.6.1, ~141 file trong `client/src`.

## Repository Layout

```text
navslides-editor/              # npm workspace root (navslides-editor v1.6.1)
├── client/                   # React 18 SPA (Vite, React Router v7, Tailwind)
│   └── src/
│       ├── App.jsx           # BrowserRouter + Routes + ErrorBoundary
│       ├── main.jsx         # Vite entry, StrictMode
│       ├── index.html
│       ├── pages/            # 8 route-level components
│       ├── components/       # ~60 components
│       │   ├── layout/       # MainLayout, StatusBar
│       │   ├── ui/           # Button, Input, Select, ColorPicker primitives
│       │   ├── dashboard/    # TemplateGallery, TemplatePreview
│       │   └── properties/   # Per-element-type panels (shape, image, table…)
│       ├── stores/           # Zustand: editor-store, presentation-store, ui-store
│       ├── hooks/            # use-autosave, use-clipboard, use-keyboard, use-live-presentation, use-slide-operations, use-reveal-preview-frame, slide-operation-helpers…
│       ├── utils/            # api, export (PPTX/raster/HTML), import (PDF/PPTX/markdown)
│       ├── extensions/       # TipTap: FontFamily, FontSize, MathExtension
│       ├── services/        # Giphy, Unsplash integrations
│       ├── data/             # Slide templates, constants, icon paths
│       └── lib/utils.js      # cn(), backdrop, Escape helpers
├── server/                   # Express + Socket.IO (revealjs-editor-server v1.6.1)
│   ├── index.js             # Entry: app, HTTP server, route mounts
│   ├── routes/              # 23 files total (15 runtime routes + 8 route tests)
│   ├── services/            # storage, socket-handler, live-rooms, ai-endpoint-guard, pptx-exporter…
│   ├── middleware/          # validate, schemas, error-handler
│   ├── scripts/             # Template generators
│   ├── data/                # JSON persistence (presentations, share-tokens…)
│   ├── uploads/             # User-uploaded media
│   └── vendor/              # Bundled 3rd-party: reveal.js, highlight, chart, katex…
├── shared/                   # revealjs-shared npm package (v1.0.0)
│   └── src/
│       ├── index.js         # Barrel: re-exports everything
│       ├── htmlGenerator.js # generateRevealHTML, generatePrintHTML, downloadHTML…
│       ├── element-renderers.js
│       ├── shapeUtils.js    # 16 shapes: rect, circle, triangle, star, arrow…
│       ├── slideNotes.js
│       ├── presenterTools.js
│       ├── shared-toolbar-text-bg-color-palette-gradient-presets-config.js  # Toolbar color palettes + gradient presets
│       ├── shared-color-utils.js / content-safety.js / shared-html-parser.js / shared-pptx-core.js / shared-text-runs.js
│       ├── types/presentation.js
│       └── data/icon-paths.json  # 1000+ Lucide icon SVG paths
├── vitest.workspace.ts       # Vitest workspace config
├── vitest.config.mjs         # Vitest test runner config
├── electron/                 # Desktop shell
│   ├── main.js             # Main process, --no-sandbox, 1400×900 window
│   └── preload.js           # safeStorage credential bridge
├── scripts/                 # Build & content utilities
│   └── pptx-parser-benchmark/  # PPTX import benchmark suite
├── tests/                   # Playwright E2E + Vitest + k6 load
└── plans/, docs/           # Planning artifacts & documentation
```

## Client App

- **React Router v7** (`BrowserRouter`). Hai nhóm routes:
  - Layout routes (wrapped by `MainLayout`/`Outlet`): `/`, `/editor/:id`, `/template/:id`, `/settings`, `/explore`
  - Standalone routes: `/live/:roomCode`, `/remote/:roomCode`, `/speaker/:roomCode`
- **EditorRoute** factory component đọc `:id` param và truyền `isTemplate` flag.
- **State: 3 Zustand stores:**
  - `useEditorStore` — editor UI: selection, clipboard, canvas controls
  - `usePresentationStore` — presentation data: slides, elements, CRUD actions
  - `useUIStore` — modal visibility, theme, panel open/closed state
- **TipTap** cho rich text editing trong `SlideCanvas`.
- **Key dependencies**: Reveal.js, Socket.io-client, Tailwind CSS, KaTeX, pdfjs-dist, pptxgenjs.
- `SlideCanvas.jsx` hiện ~841 LOC (đã tách Phase C: 11 renderer, CanvasElement wrapper, CropOverlay, chrome components, interaction hooks).

## Editor Surface

- `EditorPage.jsx` là god component, chứa presentation state (useState) + TipTap editor instance + auto-save debounce (1500ms) + undo/redo history (max 50 entries). Hiện ~1700 LOC.
- `SlideCanvas.jsx` (~841 LOC) là core interaction surface: drag, resize, rotate, snap, rubber-band selection, context menu, crop mode, grid/ruler overlays, smart guides.
- `PropertiesPanel.jsx` route đến type-specific editors: `properties/shape.jsx`, `properties/image.jsx`, `properties/table.jsx`, `properties/media.jsx`, `properties/chart.jsx`, `properties/code.jsx`, `properties/misc.jsx`.
- `InsertMenu.jsx` — insert shapes (15 loại), text, image, chart, code, table, media.
- `Toolbar.jsx` — format toolbar với color pickers sử dụng `SHAPES`, `TEXT_COLORS`, `BG_COLORS`, `GRADIENT_PRESETS` từ `shared/`.
- `AnimationPreviewModal.jsx` — preview fragment cho timeline mà không mở full presentation.
- Helpers: `animation-preview-helpers.js`, `find-replace-helpers.js`.

## Server API

- `server/index.js`: Express app, HTTP server, Socket.IO attach, tất cả route mounts.
- **15 runtime REST route files (+8 route tests):**
  - `presentations.js` — CRUD, duplicate, save-as-template, pptx-export, present mode
  - `templates.js`, `share.js`, `history.js`, `upload.js`, `github.js`, `sync.js`
  - `live.js`, `settings.js`, `explore.js`, `analytics.js`, `marketplace.js`
  - `media.js`, `ai.js`, `pptx-import.js` — import PPTX files
  - Inline: `DELETE /api/shares/:token`, `POST /api/presentations/:id/github/push`, `GET/POST /share/:token`
- **AI routes** (`server/routes/ai.js`): `/rewrite`, `/generate-outline`, `/generate-slides`, `/translate` — pluggable provider (OpenAI/Gemini/custom), SSRF guard enforced.
- **Socket.IO** (path: `/ws`, namespace `/`): `join-room`, `navigate`, `control-navigate`, `cursor-move`, `annotation`, `laser`, `viewer-count`, `sync-state`. Presenter join requires `presenterToken` (anti-hijack hardening).
- `middleware/schemas.js` — Zod validation cho mutation routes.
- `services/storage.js` — JSON file persistence với promise-chain locking (`withFileLock`).
- `services/live-rooms.js` (~52 LOC) — in-memory room state và role tracking.
- `services/presentation-finder.js` — unified lookup across presentations/templates/built-in-templates.
- `services/pptx-exporter.js` — export presentation sang PPTX.
- `services/pptx-import/` — PPTX import service (Phase 1 + fidelity hardening).
  - `geometry.js` — canonical import geometry normalizer + affine transform helpers.

## Shared Runtime Contract

- **`shared/` (package: `revealjs-shared`)** — consumed bởi cả client (Vite build) và server (runtime).
- `src/index.js` — barrel export tất cả.
- `src/htmlGenerator.js`:
  - `generateRevealHTML(presentation)` → Reveal.js HTML (live nav, Socket.IO sync, presenter toolbar)
  - `generatePrintHTML(presentation, options)` → print-ready HTML với fragment expansion
  - `downloadHTML(presentation)`, `exportPDF(presentation)`, `presentInWindow(presentation)`
- `src/shapeUtils.js` — 15 shapes: rect, rounded-rect, circle, triangle, diamond, arrow-right, star, line, hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket.
- `src/element-renderers.js` — per-element-type HTML renderers (text, image, shape, code, latex, chart).
- `src/slideNotes.js` — `getSlideNotes`, `normalizeSlideNotes`, `normalizePresentationNotes`.
- `src/shared-toolbar-text-bg-color-palette-gradient-presets-config.js` — color palette + `isLightColor`.
- `src/data/icon-paths.json` — 1000+ Lucide icon SVG paths.
- Client: `Toolbar.jsx`, `InsertMenu.jsx`, `generateHTML.js` import từ `shared/`.
- Server: `routes/presentations.js`, `pptx-exporter.js`, `socket-handler.js` import từ `shared/`.

## Electron Wrapper

- `electron/main.js`: Disable sandbox (`ELECTRON_DISABLE_SANDBOX=1`, `--no-sandbox` — deliberate trade-off for CI compatibility). Start embedded Express on port 3002 (production). Set `SLIDES_DATA_DIR` và `SLIDES_UPLOADS_DIR` đến `userData` subdirs. Create 1400×900 `BrowserWindow` (min 1000×600).
- `electron/preload.js`: Expose `window.electronAPI` với 4 methods: `saveCredential`, `getCredential`, `deleteCredential`, `isSecureStorageAvailable`. Dùng `safeStorage` (OS keychain) với file fallback.
- Không có auth — share tokens là cơ chế authorization duy nhất.

## Styling System

- Tailwind is the primary UI utility layer for app chrome.
- `client/tailwind.config.js` maps colors, radii, and animations to CSS
  variables defined in `client/src/index.css`.
- Dark mode follows `[data-theme="dark"]`; the editor still uses the same token
  names across dark and light surfaces.
- `client/src/lib/utils.js` provides `cn`, backdrop-click, and Escape-close
  helpers for shared component behavior.

## Persistence And Export

- Presentation data, templates, share tokens, GitHub config, settings, and
  snapshot history are stored in JSON files under `server/data/`.
- `storage.js` wraps reads and writes with a file lock to prevent concurrent
  JSON races.
- `server/services/pptx-exporter.js` and `htmlGenerator.js` both consume the canonical notes
  helper so HTML, print, and PPTX exports stay aligned. The hybrid PPTX exporter
  renders stable types as native PPTX objects and falls back to Playwright rasterization
  for complex DOM elements.
- `offlineExport.js` inlines CDN assets for offline HTML export.

## Test Surface

- **Vitest** (v4): 510 tests passing. shared helpers, server routes/services, client utils, PPTX guards & utils, clipboard unit tests (`use-clipboard.test.js`).
- **Playwright** (v1.59): 27 spec files — editor, slides, elements, animation-preview, keyboard-shortcuts, undo-redo, find-replace, export, live, sharing, media, templates, settings, dashboard, ai, explore, properties-panel, toolbar, slide-management, smoke, version-history, visual-regression, and hardening regression suites.
  - Includes focused PPTX import fidelity flow: `tests/e2e/pptx-import-fidelity.spec.js`.
  - Page Objects and helpers: `HomePage`, `ExplorePage`, `EditorPage`, `SettingsPage`, `LiveViewPage`, `RemoteControlPage`, `SpeakerViewPage`, `CanvasHelper`, `InsertMenuHelper`, `PropertiesPanelHelper`, `SlidePanelHelper`.
- **k6 load tests**: `tests/load/api-load.js`, `tests/load/websocket-load.js`.
- **PPTX benchmark**: `scripts/pptx-parser-benchmark/` với 4 runners (pptx2json, pptxtojson, ppt-parser, pptx-compose), corpus validator, và benchmark inventory.

## Behavior Notes

- `slide.notes` là canonical; `speakerNotes` là legacy alias và được normalize trước save/export.
- Clipboard commands (copy/cut/paste/duplicate) are pure functions in `use-clipboard.js`, owned by EditorPage, consumed by SlideCanvas via callback props and by the context menu.
- Live room state: `{ slideIndex, verticalIndex, fragmentIndex }`.
- Controllers tách biệt khỏi viewers; viewer count exclude controllers.
- Live controllers nhận `presentation-meta` + `control-navigate` routing.
- PPTX import Phase 1 đã hoàn thành (2026-04-24): `POST /api/pptx/import` dùng `pptxtojson` với `pptx2json` fallback, hỗ trợ text/image/shape/table; chart/equation/SmartArt thành locked placeholders.

## Repository Notes

- **npm workspaces**: root (`revealjs-editor` v1.6.1), `client` (revealjs-editor-client v1.6.1), `server` (revealjs-editor-server v1.6.1), `shared` (revealjs-shared v1.0.0).
- Tooling: Vite 5 (`client/vite.config.js`), ESLint 9 flat config, Prettier, Vitest 4, Playwright 1.59, Electron 33, electron-builder 25.
- Tailwind CSS 3.4.19 applied app-wide; 19 UI/UX fixes across 5 phases completed 2026-04-25 (data-testid, a11y, hover states, z-index, scrollbar, ARIA).
- No TypeScript (JSDoc only), no database (pure JSON file storage), no account/session auth (share token + live `presenterToken` only).
- Large generated assets trong repo: template data, `icon-paths.json`.
- Plans, reports, và journals sống trong `plans/`, `plans/reports/`, `docs/journals/`.
