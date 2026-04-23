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
- Live routes (`/live/:roomCode`, `/remote/:roomCode`, `/speaker/:roomCode`)
  are separate top-level routes, not nested inside the editor shell.

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

### State And Hooks

- Editor state is split into three Zustand stores: editor, presentation, and UI.
- Logic extracted from `EditorPage` lives in hooks such as
  `use-autosave.js`, `use-clipboard.js`, `use-history.js`,
  `use-keyboard.js`, `use-live-presentation.js`, `use-slide-operations.js`,
  and `use-reveal-preview-frame.js`.
- `slide-operation-helpers.js` keeps slide duplication and deletion logic
  isolated from the page component.

### Editor Composition

- `EditorPage.jsx` composes `SlidePanel`, `Toolbar`, `SlideCanvas`,
  `PropertiesPanel`, `FindReplaceBar`, `AnimationTimeline`, and modal surfaces.
- `SlideCanvas.jsx` still owns the core drag, resize, rotate, and snap
  interaction model.
- `PropertiesPanel.jsx` routes to type-specific editors in
  `components/properties/`.

## Server Architecture

### Express Entry

- `server/index.js` starts Express and mounts Socket.IO.
- Route modules are grouped by concern:
  - presentations and templates
  - sharing and GitHub push
  - AI generation and translation
  - live view
  - settings and explore
  - analytics and marketplace
  - upload, media, sync, and history

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
| `presentation-finder.js` | Presentation lookup utility |
| `ai-provider.js` | AI service integration |

### Live Protocol

- Room roles are `presenter`, `controller`, and `viewer`.
- Remote control and speaker surfaces join as `controller`, not `presenter`.
- `control-navigate` is sent from a controller to the presenter, then the
  presenter broadcasts `navigate` and `sync-state` to other clients.
- Live state is `{ slideIndex, verticalIndex, fragmentIndex }`.
- `presentation-meta` carries slide labels, slide count, and notes for the
  controller UI.
- Viewer count excludes controllers.

### Storage Layout

```text
server/data/
├── presentations.json
├── templates.json
├── share-tokens.json
├── github-config.json
├── settings.json
├── history/
└── sync-export/

server/uploads/
└── {uuid}.{ext}
```

- `storage.js` uses an in-memory lock queue per file to avoid concurrent JSON
  write/read races.
- `initDataFiles()` creates the data directories and default JSON files on
  first run.

## Shared Runtime Contract

### Shared Modules

| Module | Purpose |
| --- | --- |
| `htmlGenerator.js` | Reveal.js HTML and print HTML generation |
| `element-renderers.js` | Shared element rendering helpers |
| `slideNotes.js` | Canonical notes normalization helpers |
| `shapeUtils.js` | SVG shape/path helpers |
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
- `offlineExport.js` inlines CDN assets for offline HTML export.
- `exportPptx.js` reuses `getSlideNotes()` so speaker notes stay aligned across
  HTML and PPTX exports.
- `presentInWindow()` uses the server `/api/presentations/:id/present` route
  when a saved presentation ID is available.

## Data Model

- `shared/src/types/presentation.js` defines the JSDoc model used by client and
  server.
- Element types are kept in sync with the editor, export pipeline, and Zod
  schemas.
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
- DOMPurify sanitizes embedded HTML before render.
- Upload routes enforce MIME validation and rate limiting.
- Share links use server-side tokens and optional passwords.
- `ErrorBoundary` guards the React app against render crashes.

## Operational Notes

- The web app, Node server, and Electron wrapper all share the same render and
  persistence helpers.
- The live room contract and the export pipeline share the same notes
  normalization logic.
- File-backed persistence is intentional; there is still no database layer.
