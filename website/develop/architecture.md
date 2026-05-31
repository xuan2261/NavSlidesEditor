# Architecture

A high-level map of how NavSlides Editor is put together. For the full internal reference, see [`docs/system-architecture.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/system-architecture.md) in the repository.

## Monorepo at a glance

NavSlides Editor is an npm-workspace monorepo with four packages:

| Workspace | Role |
|---|---|
| `client` | React + Vite single-page app; the editor UI. Builds to `client/dist/` for production. |
| `server` | Express REST API + Socket.IO; serves the built client and persists data as JSON files. |
| `shared` | Pure Node.js utilities used by **both** client and server (HTML generation, shapes, color/text helpers). |
| `electron` | Desktop shell that embeds the server for a no-Docker, offline app. |

`shared` is consumed by `client` (at Vite build time) and `server` (at runtime) through npm-workspace symlinks, so the same logic never gets duplicated.

## Core data flow

The export pipeline is the heart of the app:

```
presentation JSON  →  shared/src/htmlGenerator.js  →  reveal.js HTML
```

`htmlGenerator.js` walks the presentation's slides and elements and delegates per-element markup to `shared/src/element-renderers.js`. The same generator powers offline export, PPTX export, shareable-link serving, and GitHub push — one source of truth for "JSON → HTML".

## Live presentation

Real-time presenting runs over Socket.IO. `server/services/socket-handler.js` plus `server/services/live-rooms.js` manage in-memory rooms: presenter/viewer join, slide-change broadcast, remote control, annotation sync, and a shared timer. Game Mode uses a separate `game-socket-handler.js` and room manager.

## Where to go next

- [Monorepo Structure](/develop/monorepo-structure) — where each kind of code lives
- [Building from Source](/develop/building-from-source) — run it locally
- [`docs/system-architecture.md`](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/system-architecture.md) — the deep reference
