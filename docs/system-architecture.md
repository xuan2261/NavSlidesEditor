# System Architecture — NavSlides Editor

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Deployment Modes                        │
│  ┌───────────┐    ┌──────────────┐    ┌───────────────────┐ │
│  │  Docker   │    │  Node.js dev │    │ Electron Desktop  │ │
│  │ :3002     │    │  :5173/:3002 │    │ embeds server     │ │
│  └───────────┘    └──────────────┘    └───────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express Server (:3002)                      │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │  REST API   │  │  Static  │  │   HTML Generation    │   │
│  │  /api/*     │  │  /uploads│  │  present / export    │   │
│  └─────────────┘  └──────────┘  └──────────────────────┘   │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │  Share view │  │  GitHub  │  │   Cloud Sync         │   │
│  │  /share/:t  │  │  API     │  │   (rclone)           │   │
│  └─────────────┘  └──────────┘  └──────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware: Zod validation, error handler, multer   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Socket.IO: live presentations (socket-handler.js)   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌──────────────────┐                ┌─────────────────────┐
│  JSON File Store │                │  External Services  │
│  presentations   │                │  GitHub Git Data API│
│  templates       │                │  rclone (cloud)     │
│  share-tokens    │                │  AI provider API    │
│  github-config   │                │  CDN (reveal.js,    │
│  history/        │                │   KaTeX, Chart.js,  │
│  uploads/        │                │   highlight.js)     │
└──────────────────┘                └─────────────────────┘
```

## Client Architecture

### React SPA (Vite 5)

Entry: `client/src/main.jsx` → `App.jsx` → `ErrorBoundary` → `HomePage` or `EditorPage`

`App.jsx` manages page routing via `useState('page')` — no React Router. Also manages editor theme (dark/light) persisted in `localStorage`. Wraps children in `ErrorBoundary` for graceful crash recovery.

### State Management — Zustand Stores

**Three Zustand stores** replaced the god-component pattern:

| Store | File | Purpose |
|-------|------|---------|
| `editor-store` | `stores/editor-store.js` | Selection, editing state, clipboard, UI flags |
| `presentation-store` | `stores/presentation-store.js` | Presentation data, current slide index, slide ops |
| `ui-store` | `stores/ui-store.js` | Theme, panel visibility, toolbar state |

### Custom Hooks

Logic extracted from EditorPage into reusable hooks:

| Hook | File | Purpose |
|------|------|---------|
| `useAutosave` | `hooks/use-autosave.js` | Debounced auto-save (1500ms) |
| `useClipboard` | `hooks/use-clipboard.js` | Copy/cut/paste/duplicate elements |
| `useHistory` | `hooks/use-history.js` | Undo/redo (50-step circular buffer) |
| `useKeyboard` | `hooks/use-keyboard.js` | Keyboard shortcut dispatch |
| `useLivePresentation` | `hooks/use-live-presentation.js` | Socket.IO live mode |
| `useSlideOperations` | `hooks/use-slide-operations.js` | Slide CRUD + element manipulation |

### EditorPage — Refactored (1475 LOC)

Reduced from 3400+ LOC. EditorPage now primarily handles:
- Component composition and layout
- Modal state management
- TipTap editor lifecycle
- Coordination between hooks and stores

### Component Responsibilities

| Component           | LOC  | Role                                                                   |
| ------------------- | ---- | ---------------------------------------------------------------------- |
| `SlideCanvas`       | 2421 | Renders elements at 960×540, drag/resize/rotate, smart guides, crop    |
| `Toolbar`           | 1229 | Insert elements, TipTap formatting commands, background picker         |
| `PropertiesPanel`   | 437  | Routes to type-specific property editor subcomponents                  |
| `SlidePanel`        | 584  | Slide thumbnails, drag-to-reorder, add/delete slides                   |
| `InsertMenu`        | —    | Element insertion UI with categorized types                            |
| `EditorMenuBar`     | —    | File, edit, view menu actions                                          |
| `ErrorBoundary`     | 73   | Catches render errors, shows recovery UI                               |
| `FindReplaceBar`    | —    | Cross-slide text search + replace overlay                              |
| `AnimationTimeline` | —    | Visual sequencer for fragment animations                               |

### PropertiesPanel Decomposition

PropertiesPanel (437 LOC) routes to 8 type-specific sub-editors in `components/properties/`:

| File | Handles |
|------|---------|
| `common-element-controls.jsx` | Position, size, rotation, z-order (all types) |
| `shape-properties.jsx` | Fill, stroke, opacity, corner radius |
| `image-properties.jsx` | Crop, filters, object-fit |
| `chart-properties.jsx` | Chart type, data, colors |
| `code-properties.jsx` | Language, theme selection |
| `table-properties.jsx` | Row/column management, header row |
| `media-properties.jsx` | Autoplay, loop, muted |
| `misc-properties.jsx` | LaTeX, HTML, QR, callout, icon, divider |

### Element Factory

`client/src/utils/element-factory.js` — centralized element creation replacing 17 inline callbacks. JSDoc-typed. Creates properly defaulted elements for all 15+ types.

### TipTap Integration

One `Editor` instance per editor session. Custom extensions:

- `MathExtension` — inline KaTeX node
- `FontSize` — mark extension
- `FontFamily` — mark extension

When user enters text-edit mode on a text element, `EditorPage` loads that element's HTML into the TipTap editor. On blur, updated HTML is written back to the element state.

## Server Architecture

### Express Server (`server/index.js`)

Entry point requiring modular route files and middleware. Started by `node server/index.js` or via Electron's `startServer()` export.

Environment variables:
| Variable | Default | Purpose |
|----------|---------|------------|
| `PORT` | `3002` | HTTP listen port |
| `SLIDES_DATA_DIR` | `server/data/` | JSON data directory |
| `SLIDES_UPLOADS_DIR` | `server/uploads/` | Uploaded file directory |

### Route Modules (16 files in `server/routes/`)

| Module | Endpoints | Zod Validation |
|--------|-----------|----------------|
| `presentations.js` | CRUD, duplicate, export, present | ✅ create + update |
| `share.js` | Create/revoke share, verify password | ✅ share + verify |
| `github.js` | Config + push | ✅ config + push |
| `ai.js` | Generate, rewrite, translate | ✅ all endpoints |
| `upload.js` | File upload (multer, 100MB) | — (multer handles) |
| `history.js` | Snapshots CRUD | — |
| `templates.js` | Template CRUD | — |
| `sync.js` | rclone sync operations | — |
| `media.js` | Media management | — |
| Others | Analytics, explore, marketplace, settings, live | — |

### Middleware Stack

| Middleware | File | Purpose |
|-----------|------|---------|
| `validate` | `middleware/validate.js` | Zod schema validation for req.body |
| `schemas` | `middleware/schemas.js` | All Zod schema definitions |
| `error-handler` | `middleware/error-handler.js` | Centralized error response formatting |

### Services Layer

| Service | File | Purpose |
|---------|------|---------|
| `storage` | `services/storage.js` | File I/O abstraction for JSON data |
| `socket-handler` | `services/socket-handler.js` | Socket.IO event handling (extracted from index.js) |
| `live-rooms` | `services/live-rooms.js` | Live presentation room management |
| `ai-provider` | `services/ai-provider.js` | AI service integration |
| `presentation-finder` | `services/presentation-finder.js` | Presentation lookup utility |

### File Storage Layout

```
server/data/
├── presentations.json    ← array of all presentations
├── templates.json        ← array of custom templates
├── share-tokens.json     ← map: token → presentationId
├── github-config.json    ← { token, owner, repo } (encrypted in Electron)
├── rclone.conf           ← rclone configuration file
├── sync-export/          ← temp files during rclone sync
└── history/
    └── {presentationId}/
        └── {snapshotId}.json

server/uploads/
└── {uuid}.{ext}          ← uploaded images, video, audio
```

## Shared Package

`shared/src/` — code shared between client and server:

| File | Purpose |
|------|---------|
| `htmlGenerator.js` | Core HTML export engine (reveal.js generation) |
| `element-renderers.js` | DRY element rendering shared between export pipelines |
| `shapeUtils.js` | SVG path rendering for shape types |
| `presenterTools.js` | Presenter tools (timer, notes, navigation) |
| `types/presentation.js` | JSDoc type definitions (ElementType, Slide, Presentation) |

## Electron Architecture

`electron/main.js` (140 LOC):

1. Sets `SLIDES_DATA_DIR` and `SLIDES_UPLOADS_DIR` to `app.getPath('userData')/data` and `.../uploads`
2. Calls `startServer(PORT)` by requiring the Express server
3. Creates a `BrowserWindow` (1400×900, min 1000×600)
4. Loads `http://localhost:3002`
5. **safeStorage IPC handlers** for secure credential management:
   - `save-credential` — encrypts string via OS keychain
   - `get-credential` — decrypts stored credential
   - Falls back to file-based storage if encryption unavailable
6. External links open in OS default browser; localhost links open new Electron windows

`electron/preload.js` — context bridge exposing credential API to renderer.

Data paths per platform:
| Platform | Path |
|----------|------|
| Linux | `~/.config/NavSlides Editor/` |
| macOS | `~/Library/Application Support/NavSlides Editor/` |
| Windows | `%APPDATA%/NavSlides Editor/` |

## Data Schema

### Type Definitions (`shared/src/types/presentation.js`)

Full JSDoc type definitions for all data models, including:
- `ElementType` — union of 18 element type strings
- `BaseElement` — common fields (id, type, x, y, width, height, rotation, etc.)
- 15 type-specific element typedefs (TextElement, ImageElement, ShapeElement, etc.)
- `SlideElement` — discriminated union of all element types
- `Slide` — slide with elements array, background, notes, animations
- `Presentation` — top-level with slides, theme, transition, footer config

### Zod Validation Schemas (`server/middleware/schemas.js`)

Runtime validation for API endpoints:
- `createPresentationSchema` / `updatePresentationSchema`
- `elementSchema` (with `.passthrough()` for type-specific fields)
- `slideSchema`
- `createShareSchema` / `verifyShareSchema`
- `aiGenerateSchema` / `aiCopywriteSchema` / `aiTranslateSchema`

## CSS Architecture

### Split CSS Strategy

Post-refactor CSS architecture (replaced monolithic 57KB `index.css`):

| File | Purpose | Approx Lines |
|------|---------|-------------|
| `index.css` | Design tokens, resets, buttons (global) | 270 |
| `styles/editor-page.css` | Editor layout, toolbar areas | ~250 |
| `styles/home-page.css` | Dashboard, presentation cards | ~250 |
| `styles/slide-panel.css` | Slide thumbnails, slide list | ~120 |
| `styles/canvas-toolbar.css` | Canvas toolbar controls | ~150 |
| `styles/properties-panel.css` | Properties panel layout | ~120 |
| `styles/modals.css` | Shared modal styles | ~60 |
| `styles/components.css` | Miscellaneous component styles | ~400 |

Theme switching: `App.jsx` sets `document.documentElement.setAttribute('data-theme', theme)` with `[data-theme='light']` CSS overrides.

## Export Pipeline

```
Zustand presentation store
    │
    ▼
generateRevealHTML(presentation)     ← shared/htmlGenerator.js
    │  Uses element-renderers.js for DRY rendering
    │  Loads CDN: reveal.js, KaTeX, Chart.js, highlight.js, TikZJax
    │
    ├──── HTML download     → Blob → <a download>
    ├──── Present mode      → GET /api/presentations/:id/present → served by Express
    ├──── Offline export    → offlineExport.js → fetch CDN → inline → Blob download
    └──── PDF               → window.print() on present URL
    │
    └──── PPTX export       → exportPptx.js (reads presentation object directly)
                               pptxgenjs → Blob download
                               Limitations: shapes→rectangles, skips chart/html/latex/video/audio/icon
```

## External Integrations

### GitHub (Git Data API)

- Stores config in `github-config.json` (plaintext for Docker; encrypted via safeStorage for Electron)
- Push flow: generate HTML → create blobs → build tree → create commit
- Output: `{repo}/{presentation-slug}/presentation.html` + `.json` + auto `README.md`
- **Zod-validated** config and push request bodies

### rclone (Cloud Sync)

- Writes `rclone.conf` to data directory
- Runs `rclone copy` as child process
- Exports HTML + JSON to `sync-export/` then syncs that directory
- Requires rclone on PATH (pre-installed in Docker image)

### AI Integration

- Configurable AI provider via `services/ai-provider.js`
- Endpoints: outline generation, slide generation, copywriting, translation
- All request bodies **Zod-validated**

## Security Model

- **No authentication** — single-user, self-hosted design
- **CORS**: open (all origins accepted) — intentional for self-hosted LAN use
- **Request validation**: Zod schemas on all mutation endpoints (POST, PUT)
- **DOMPurify sanitization**: HTML embed content sanitized before rendering
- **MIME-type validation**: File uploads validated for allowed types
- **Rate limiting**: Applied to upload and sensitive endpoints
- **Share tokens**: UUID v4, stored server-side; password-protected option available
- **Credential security**: Electron uses `safeStorage` (OS keychain); Docker uses file-based storage
- **ErrorBoundary**: Prevents white screen of death from rendering errors
- **Not suitable** for multi-tenant hosting or public internet exposure without a reverse proxy and additional hardening
