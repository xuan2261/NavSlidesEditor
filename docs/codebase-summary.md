# Codebase Summary - NavSlides Editor

## Snapshot

NavSlides Editor is a self-hosted presentation editor split across four runtime areas:
`client/`, `server/`, `shared/`, and `electron/`. Supporting docs, tests, and planning
artifacts live alongside the app code in the repository.

## Repository Layout

```text
revealjs_gui/
├── client/                  # React 18 SPA (Vite, React Router, Tailwind)
│   └── src/
│       ├── App.jsx          # Route shell + theme persistence
│       ├── components/
│       │   ├── layout/MainLayout.jsx
│       │   ├── layout/StatusBar.jsx
│       │   ├── SlideCanvas.jsx
│       │   ├── Toolbar.jsx
│       │   ├── PropertiesPanel.jsx
│       │   ├── SlidePanel.jsx
│       │   ├── FindReplaceBar.jsx
│       │   ├── AnimationTimeline.jsx
│       │   └── ...
│       ├── pages/
│       │   ├── HomePage.jsx
│       │   ├── EditorPage.jsx
│       │   ├── LiveViewPage.jsx
│       │   ├── RemoteControlPage.jsx
│       │   ├── SpeakerViewPage.jsx
│       │   ├── ExplorePage.jsx
│       │   └── SettingsPage.jsx
│       ├── hooks/
│       │   ├── use-autosave.js
│       │   ├── use-clipboard.js
│       │   ├── use-history.js
│       │   ├── use-keyboard.js
│       │   ├── use-live-presentation.js
│       │   ├── use-slide-operations.js
│       │   ├── use-reveal-preview-frame.js
│       │   └── slide-operation-helpers.js
│       ├── utils/
│       │   ├── api.js
│       │   ├── slide-notes.js
│       │   ├── exportPptx.js
│       │   ├── offlineExport.js
│       │   └── ...
│       ├── lib/utils.js     # cn, backdrop, Escape helpers
│       ├── index.css        # Tailwind directives + CSS variables
│       └── tailwind.config.js
├── server/
│   ├── index.js             # Express entry + Socket.IO bootstrap
│   ├── routes/
│   │   ├── presentations.js
│   │   ├── templates.js
│   │   ├── share.js
│   │   ├── github.js
│   │   ├── ai.js
│   │   ├── live.js
│   │   ├── settings.js
│   │   ├── explore.js
│   │   ├── analytics.js
│   │   ├── marketplace.js
│   │   ├── upload.js
│   │   ├── media.js
│   │   ├── sync.js
│   │   └── history.js
│   ├── middleware/
│   │   ├── validate.js
│   │   ├── schemas.js
│   │   └── error-handler.js
│   └── services/
│       ├── storage.js
│       ├── socket-handler.js
│       ├── live-rooms.js
│       ├── presentation-finder.js
│       └── ai-provider.js
├── shared/
│   └── src/
│       ├── htmlGenerator.js
│       ├── element-renderers.js
│       ├── slideNotes.js
│       ├── presenterTools.js
│       ├── shapeUtils.js
│       └── types/presentation.js
├── electron/
│   ├── main.js
│   └── preload.js
├── tests/e2e/
├── docs/
└── plans/
```

## Client App

- `App.jsx` uses `BrowserRouter` and `Routes`, not ad-hoc page state.
- `MainLayout.jsx` wraps the routed app shell and renders `StatusBar.jsx`.
- Route map:
  - `/` -> `HomePage`
  - `/editor/:id` -> `EditorPage`
  - `/template/:id` -> `EditorPage` in template mode
  - `/settings` -> `SettingsPage`
  - `/explore` -> `ExplorePage`
  - `/live/:roomCode` -> `LiveViewPage`
  - `/remote/:roomCode` -> `RemoteControlPage`
  - `/speaker/:roomCode` -> `SpeakerViewPage`
- `App.jsx` persists the editor theme in `localStorage` and mirrors it to
  `document.documentElement.dataset.theme`.
- Shared UI state lives in Zustand stores; editor logic is split into hooks and
  helper modules instead of one large page component.

## Editor Surface

- `EditorPage.jsx` composes `SlidePanel`, `Toolbar`, `SlideCanvas`,
  `PropertiesPanel`, search/replace, animation timeline, and modal surfaces.
- `SlideCanvas.jsx` remains the core interaction surface for drag, resize,
  rotate, snap, and selection logic.
- `PropertiesPanel.jsx` routes to type-specific editors under
  `components/properties/`.
- `AnimationPreviewModal.jsx` now handles current-slide fragment preview for the
  timeline without opening full presentation mode.
- `animation-preview-helpers.js`, `find-replace-helpers.js`,
  `slide-operation-helpers.js`, and `use-reveal-preview-frame.js` keep the
  editor page thin.

## Server API

- `server/index.js` boots Express, installs middleware, and wires Socket.IO.
- Route groups are split by concern:
  - presentation CRUD and exports
  - templates
  - sharing and GitHub push
  - AI generation and translation
  - live view
  - settings and explore
  - analytics and marketplace
  - uploads, media, sync, and history
- `middleware/schemas.js` provides Zod request validation for mutation routes.
- `services/storage.js` owns JSON persistence and serializes file access with
  per-file locks.
- `services/socket-handler.js` and `services/live-rooms.js` implement live room
  coordination.

## Shared Runtime Contract

- `shared/src/htmlGenerator.js` generates reveal.js HTML and print HTML.
- `shared/src/element-renderers.js` keeps export rendering DRY across pipelines.
- `shared/src/slideNotes.js` normalizes speaker notes and strips legacy aliases.
- `shared/src/types/presentation.js` documents the data model with JSDoc.
- `shared/src/index.js` re-exports the shared helpers for client and server use.

## Electron Wrapper

- `electron/main.js` starts the embedded server and creates the desktop window.
- `electron/preload.js` exposes the credential bridge to the renderer.
- GitHub credentials use `safeStorage` when available and fall back to file
  storage when they cannot be encrypted.

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
- `exportPptx.js` and `htmlGenerator.js` both consume the canonical notes
  helper so HTML, print, and PPTX exports stay aligned.
- `offlineExport.js` inlines CDN assets for offline HTML export.

## Test Surface

- Vitest covers shared helpers, storage/service logic, and client utility
  helpers.
- Playwright exercises editor, dashboard, export, live, sharing, media,
  templates, settings, and keyboard flows.
- New regression helpers live next to the code they protect, such as
  `tailwind-inline-style-audit.test.js` and `slide-operation-helpers.test.js`.

## Behavior Notes

- `Slide.notes` is canonical.
- `speakerNotes` remains a legacy input alias and is normalized away before
  export and save.
- Live room state is `{ slideIndex, verticalIndex, fragmentIndex }`.
- Controllers are separate from viewers; viewer counts exclude controllers.
- Live controllers receive `presentation-meta` plus `control-navigate` routing.

## Repository Notes

- Large generated assets are still present in the repo, including built-in
  template data and icon-path tables.
- Historical execution reports and plan artifacts live under `plans/`.
