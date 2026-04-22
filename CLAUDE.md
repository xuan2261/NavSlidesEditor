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
revealjs_gui/
├── client/           # React SPA (Vite). Exports to client/dist/ for production
├── server/           # Express REST API + WebSocket (Socket.IO). Single index.js
├── shared/           # Pure Node.js utilities shared between client export & server.
│   └── src/
│       ├── shapeUtils.js     # SVG shape generation (rect, circle, arrow, etc.)
│       └── htmlGenerator.js  # JSON presentation → reveal.js HTML string
└── electron/         # Desktop Electron shell, embeds the server
```

`shared` is consumed by both `client` (during Vite build/export) and `server` (at runtime) via npm workspace symlinks.

### Client Architecture (React)

- **Routing** (`App.jsx`): `react-router-dom` v7. Routes: `/` (Home), `/editor/:id`, `/template/:id`, `/settings`, `/explore`, `/live/:roomCode`, `/remote/:roomCode`, `/speaker/:roomCode`.
- **State**: Zustand stores in `client/src/stores/`:
  - `editor-store.js` — selection, clipboard, grid/guides, timeline, find-replace
  - `presentation-store.js` — presentation data (loaded/saved via REST)
  - `ui-store.js` — UI state
- **Pages** (`client/src/pages/`):
  - `EditorPage.jsx` — god component, owns all editor state (large; keep focused)
  - `HomePage.jsx` — dashboard, CRUD, templates
  - `LiveViewPage.jsx`, `RemoteControlPage.jsx`, `SpeakerViewPage.jsx` — live presentation pages using Socket.IO
- **Components** (`client/src/components/`): SlideCanvas (interaction), Toolbar (insert/format), PropertiesPanel (inspector), SlidePanel (thumbnails), FindReplaceBar, AnimationTimeline, TransitionPreview, ShareModal.
- **Extensions** (`client/src/extensions/`): Custom TipTap extensions for KaTeX math, font-size, font-family marks.
- **Vite proxy**: `/api`, `/uploads`, `/vendor`, `/ws` are proxied to `localhost:3002` in dev.

### Server Architecture (Express)

Single `server/index.js` file (~800 LOC) with all REST routes and Socket.IO setup:

- `GET/POST/PUT/DELETE /api/presentations` — CRUD
- `GET/POST/DELETE /api/templates`
- `POST /api/share/:id` — generate/revoke share tokens
- `POST /api/upload` — file upload via multer
- `POST /api/github/push` — push to GitHub
- `POST /api/sync` — rclone cloud sync
- `GET/POST/DELETE /api/history/:id`
- `Socket.IO` `/live` namespace — live presentation room management

File storage: `server/data/*.json` (presentations, templates, share tokens, github config) + `server/data/history/` (snapshots) + `server/uploads/` (media).

### HTML Generation (shared/src/htmlGenerator.js)

The core export pipeline: `presentation JSON → reveal.js HTML string`. Used by:

1. Client: offline export, PPTX export (reads HTML)
2. Server: shareable link serving, GitHub push

### Live Presentation (Socket.IO)

`server/routes/live.js` + `server/services/live-rooms.js` manage real-time rooms:

- `presenter-join` / `viewer-join` events
- `slide-change` broadcast to viewers
- `navigate` (remote control), `sync-state`, `end-presentation`
  Client hook `use-live-presentation.js` handles Socket.IO connection in LiveViewPage.

### Workflows

- **Primary workflow**: See `%USERPROFILE%/.claude/workflows/primary-workflow.md`
- **Orchestration protocols**: See `%USERPROFILE%/.claude/workflows/orchestration-protocol.md`
- **Documentation**: All project docs live in `./docs/` — update after feature implementation.

## Key Constraints

- **File size**: Keep individual code files under 200 LOC; split large components.
- **No secrets**: Never commit `.env`, credentials, or tokens to git.
- **YAGNI / KISS / DRY**: Do not over-engineer; prefer composition over inheritance.
- **Shared code lives in `shared/`**: Any logic used by both client and server belongs in `shared/src/`, not duplicated.
