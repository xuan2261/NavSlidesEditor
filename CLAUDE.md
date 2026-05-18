# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working on code in this repository.

## Project Overview

**NavSlides Editor** — a self-hostable WYSIWYG presentation editor powered by reveal.js. Built as an npm workspace monorepo with 4 packages: `client` (React/Vite), `server` (Express), `shared` (pure Node.js utilities), and `electron` (desktop shell).

## Commands

### Development

```bash
npm run dev          # Start Vite dev server (5173) + Express API (3002) concurrently
npm run build        # Compile React → client/dist/
npm start            # Serve built client + API on port 3002 (production)
```

### Testing

```bash
npm run test                   # Unit tests (Vitest)
npm run test:e2e               # E2E tests (Playwright)
npm run test:load:api          # k6 load test: REST API
npm run test:load:ws           # k6 load test: WebSocket/Socket.IO
npm run test:corpus            # PPTX import semantic & roundtrip fidelity test
```

### Linting & Formatting

```bash
npm run lint     # ESLint
npm run format   # Prettier
```

### Electron Desktop App

```bash
npm run electron:dev        # Run Electron in dev mode (no package)
npm run electron:build:win   # Build Windows .exe installer
npm run electron:build:linux # Build Linux .AppImage + .deb
npm run electron:build:mac   # Build macOS .zip
```

### Docker

```bash
docker compose up -d          # Start server on port 3002 with persistent volumes
docker compose logs -f         # Tail logs
docker compose down -v        # Stop + delete volumes
```

### Single Test

```bash
npx vitest run server/routes/share.test.js
npx vitest run shared/tests/
npx playwright test tests/smoke.spec.js
```

## Architecture

### Monorepo Structure

```
NavSlidesEditor/
├── client/           # React SPA (Vite). Exports to client/dist/ for production
│   └── src/
│       ├── pages/           # EditorPage, HomePage, LiveViewPage, SpeakerViewPage, etc.
│       ├── components/      # SlideCanvas, PropertiesPanel, SlidePanel, ribbon/, etc.
│       ├── stores/          # editor-store, presentation-store, ui-store (Zustand)
│       ├── hooks/           # use-keyboard, use-clipboard, use-live-presentation, etc.
│       └── extensions/      # TipTap: FontSize, FontFamily, MathExtension, etc.
├── server/           # Express REST API + WebSocket (Socket.IO)
│   ├── index.js            # Main server (323 LOC) — imports modular routes
│   ├── routes/             # presentations, templates, share, upload, github, sync, 
│   │                       # history, settings, media, live, pptx-import, games, ai, etc.
│   ├── services/           # storage, socket-handler, live-rooms, pptx-exporter, etc.
│   └── middleware/         # error-handler, etc.
├── shared/           # Pure Node.js utilities shared between client & server
│   └── src/
│       ├── htmlGenerator.js      # JSON presentation → reveal.js HTML
│       ├── element-renderers.js  # Element-specific HTML rendering
│       ├── shapeUtils.js         # SVG shape generation
│       ├── presenterTools.js     # Presenter mode utilities
│       ├── content-safety.js     # Content validation
│       └── shared-*.js           # PPTX, color, text utilities
└── electron/         # Desktop Electron shell, embeds the server
```

`shared` is consumed by both `client` (during Vite build/export) and `server` (at runtime) via npm workspace symlinks.

### Client Architecture (React)

- **Routing** (`App.jsx`): `react-router-dom` v7. Routes: `/` (Home), `/editor/:id`, `/template/:id`, `/settings`, `/explore`, `/live/:roomCode`, `/remote/:roomCode`, `/speaker/:roomCode`, `/game/join`.
- **State**: Zustand stores in `client/src/stores/`:
  - `editor-store.js` — selection, clipboard, grid/guides, timeline, find-replace
  - `presentation-store.js` — presentation data (loaded/saved via REST)
  - `ui-store.js` — UI state (includes ribbon state)
- **Pages** (`client/src/pages/`):
  - `EditorPage.jsx` — main editor (77k LOC; large file)
  - `HomePage.jsx` — dashboard, CRUD, templates (68k LOC)
  - `LiveViewPage.jsx`, `RemoteControlPage.jsx`, `SpeakerViewPage.jsx` — live presentation
  - `SettingsPage.jsx`, `ExplorePage.jsx`, `game-player-join-page.jsx`
- **Components** (`client/src/components/`): SlideCanvas, PropertiesPanel, SlidePanel, QuickAccessToolbar, AnimationTimeline, FindReplaceBar, ShareModal, ribbon/ (new UI), various modals (AI, media, templates, etc.).
- **Hooks** (`client/src/hooks/`): use-keyboard, use-clipboard, use-slide-operations, use-live-presentation, use-game-socket, use-annotation-sync, etc.
- **Extensions** (`client/src/extensions/`): TipTap extensions — FontSize, FontFamily, MathExtension (KaTeX), font-weight, line-height.
- **Vite proxy**: `/api`, `/uploads`, `/vendor`, `/ws` → `localhost:3002` in dev.

### Server Architecture (Express)

Main `server/index.js` (323 LOC) imports modular routes from `server/routes/`:

- **Routes** (`server/routes/`):
  - `presentations.js` — GET/POST/PUT/DELETE /api/presentations
  - `templates.js` — GET/POST/DELETE /api/templates
  - `share.js` — POST /api/share/:id (generate/revoke share tokens)
  - `upload.js` — POST /api/upload (file upload via multer, SHA256 deduplication)
  - `github.js` — POST /api/github/push
  - `sync.js` — POST /api/sync (rclone cloud sync)
  - `history.js` — GET/POST/DELETE /api/history/:id
  - `media.js` — media library endpoints
  - `live.js` — live presentation REST endpoints
  - `pptx-import.js` — PPTX import
  - `games-rest-api-handler.js` — game mode REST API
  - `ai.js` — AI generation endpoints
  - `analytics.js`, `settings.js`, `explore.js`, `marketplace.js`
- **Services** (`server/services/`):
  - `storage.js` — file-based JSON storage
  - `socket-handler.js` — Socket.IO live presentation logic
  - `game-socket-handler.js` — game mode Socket.IO
  - `live-rooms.js` — room state management
  - `pptx-exporter.js` — PPTX export
  - `pptx-import/` — PPTX import pipeline
  - `ai-provider.js`, `ai-endpoint-guard.js` — AI integration
  - `presentation-finder.js`, `game-room-manager-singleton-service.js`

File storage: `server/data/*.json` (presentations, templates, share tokens, github config) + `server/data/history/` (snapshots) + `server/uploads/` (media).

### HTML Generation (shared/src/htmlGenerator.js)

Core export pipeline: `presentation JSON → reveal.js HTML string`. Uses `element-renderers.js` for element-specific rendering. Used by:

1. Client: offline export, PPTX export (reads HTML)
2. Server: shareable link serving, GitHub push

Related files: `shared/src/element-renderers.js`, `shared/src/presenterTools.js`, `shared/src/content-safety.js`.

### Live Presentation (Socket.IO)

`server/services/socket-handler.js` + `server/services/live-rooms.js` manage real-time rooms:

- `presenter-join` / `viewer-join` events
- `slide-change` broadcast to viewers
- `navigate` (remote control), `sync-state`, `end-presentation`
- Annotation sync, timer sync

Client hooks: `use-live-presentation.js`, `use-annotation-sync.js`, `use-live-timer-sync.js` handle Socket.IO connections.

Game mode uses separate `game-socket-handler.js` + `game-room-manager-singleton-service.js`.

### Workflows

- **Primary workflow**: See `%USERPROFILE%/.claude/workflows/primary-workflow.md`
- **Orchestration protocols**: See `%USERPROFILE%/.claude/workflows/orchestration-protocol.md`
- **Documentation**: All project docs live in `./docs/` — update after feature implementation.

## Key Constraints

- **File size**: Keep individual code files under 200 LOC; split large components.
- **No secrets**: Never commit `.env`, credentials, or tokens to git.
- **YAGNI / KISS / DRY**: Do not over-engineer; prefer composition over inheritance.
- **Shared code lives in `shared/`**: Any logic used by both client and server belongs in `shared/src/`, not duplicated.
