# Codebase Summary — NavSlides Editor

## Project Structure

npm workspace monorepo with 4 packages (post-refactor, 04/2026):

```
revealjs_gui/
├── client/                    # React SPA (Vite 5)
│   └── src/
│       ├── App.jsx            # Router + theme toggle + ErrorBoundary (62 LOC)
│       ├── main.jsx           # React entry point (11 LOC)
│       ├── index.css          # Global design tokens + resets (270 LOC)
│       ├── styles/            # Split CSS per component area
│       │   ├── editor-page.css
│       │   ├── home-page.css
│       │   ├── slide-panel.css
│       │   ├── canvas-toolbar.css
│       │   ├── properties-panel.css
│       │   ├── modals.css
│       │   └── components.css
│       ├── pages/
│       │   ├── EditorPage.jsx # Refactored editor page (1475 LOC)
│       │   └── HomePage.jsx   # Dashboard + templates (1275 LOC)
│       ├── components/
│       │   ├── SlideCanvas.jsx       # Canvas interaction (2421 LOC)
│       │   ├── Toolbar.jsx           # Insert + formatting (1229 LOC)
│       │   ├── PropertiesPanel.jsx   # Property router (437 LOC)
│       │   ├── SlidePanel.jsx        # Slide thumbnails (584 LOC)
│       │   ├── ErrorBoundary.jsx     # Error recovery UI (73 LOC)
│       │   ├── InsertMenu.jsx        # Element insertion UI
│       │   ├── EditorMenuBar.jsx     # Menu bar actions
│       │   ├── properties/           # Per-type property editors
│       │   │   ├── common-element-controls.jsx
│       │   │   ├── shape-properties.jsx
│       │   │   ├── image-properties.jsx
│       │   │   ├── chart-properties.jsx
│       │   │   ├── code-properties.jsx
│       │   │   ├── table-properties.jsx
│       │   │   ├── media-properties.jsx
│       │   │   └── misc-properties.jsx
│       │   ├── dashboard/            # Dashboard subcomponents
│       │   ├── layout/              # Layout subcomponents
│       │   └── ... (30+ component files)
│       ├── hooks/
│       │   ├── use-autosave.js       # Debounced auto-save logic
│       │   ├── use-clipboard.js      # Copy/cut/paste/duplicate
│       │   ├── use-history.js        # Undo/redo (50-step buffer)
│       │   ├── use-keyboard.js       # Keyboard shortcut handler
│       │   ├── use-live-presentation.js # Socket.IO live mode
│       │   └── use-slide-operations.js  # Slide CRUD + element ops
│       ├── stores/
│       │   ├── editor-store.js       # Zustand: UI + editor state
│       │   ├── presentation-store.js # Zustand: presentation data
│       │   └── ui-store.js           # Zustand: UI preferences
│       ├── data/
│       │   ├── element-defaults.js   # Default props per element type
│       │   ├── slide-constants.js    # Canvas size constants
│       │   └── slide-templates.js    # Template definitions
│       ├── extensions/
│       │   ├── MathExtension.js      # TipTap inline KaTeX node
│       │   ├── FontSize.js           # TipTap FontSize mark
│       │   └── FontFamily.js         # TipTap FontFamily mark
│       ├── services/
│       │   ├── unsplash.js           # Unsplash image API
│       │   └── giphy.js              # Giphy GIF API
│       └── utils/
│           ├── element-factory.js    # Centralized element creation (JSDoc typed)
│           ├── api.js                # Fetch wrapper for REST API
│           ├── generateHTML.js       # Re-exports from shared
│           ├── exportPptx.js         # PPTX via pptxgenjs
│           ├── offlineExport.js      # Inline CDN into HTML
│           ├── smartGuides.js        # Snap alignment logic
│           ├── export-project.js     # .navslides export
│           ├── import-project.js     # .navslides import
│           ├── pdf-import.js         # PDF slide import
│           └── markdown-import.js    # Markdown import
├── server/
│   ├── index.js               # Express server entry
│   ├── routes/                # 16 route files
│   │   ├── presentations.js   # CRUD + Zod validation
│   │   ├── share.js           # Share tokens + Zod validation
│   │   ├── github.js          # GitHub push + Zod validation
│   │   ├── ai.js              # AI endpoints + Zod validation
│   │   └── ... (12 more route files)
│   ├── middleware/
│   │   ├── validate.js        # Zod validation middleware
│   │   ├── schemas.js         # All Zod schemas
│   │   └── error-handler.js   # Centralized error handler
│   └── services/
│       ├── storage.js         # File I/O abstraction
│       ├── socket-handler.js  # Socket.IO event handling
│       ├── live-rooms.js      # Live presentation rooms
│       ├── ai-provider.js     # AI service integration
│       └── presentation-finder.js
├── shared/
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── htmlGenerator.js   # HTML export engine
│   │   ├── element-renderers.js # Shared element rendering
│   │   ├── shapeUtils.js      # SVG path rendering
│   │   ├── presenterTools.js  # Presenter tools
│   │   └── types/
│   │       └── presentation.js # JSDoc type definitions
│   └── tests/                 # Vitest unit tests
├── tests/
│   └── e2e/                   # Playwright E2E testing suite
├── electron/
│   ├── main.js                # Electron entry + safeStorage IPC (140 LOC)
│   └── preload.js             # Context bridge for credentials
├── package.json               # Root workspace + Electron scripts
├── eslint.config.mjs          # ESLint Flat Config
├── playwright.config.js       # Playwright E2E Config
├── vitest.config.mjs          # Vitest testing config
├── vitest.workspace.ts        # Vitest workspace definition
├── Dockerfile                 # Multi-stage build (Node 20 alpine)
└── docker-compose.yml         # Single service + 2 named volumes
```

## Component Hierarchy

```
App
├── ErrorBoundary              ← catches rendering errors
├── HomePage
│   └── (presentation list, template manager, 6 preset themes)
└── EditorPage
    ├── SlidePanel              ← left: thumbnails, drag-to-reorder
    ├── Toolbar                 ← top: insert elements, TipTap commands
    ├── SlideCanvas             ← center: 960×540 canvas, interaction
    ├── PropertiesPanel         ← right: routes to type-specific editors
    │   └── properties/*        ← shape, image, chart, code, table, media, misc
    ├── FindReplaceBar          ← overlay (Ctrl+F)
    ├── AnimationTimeline       ← bottom overlay (fragment sequencing)
    ├── TransitionPreview       ← modal (iframe + CDN reveal.js)
    └── Extracted modals:
        ├── HTML/Code/LaTeX/CSS editors
        ├── TemplatePickerModal
        ├── GitHubPushModal
        ├── ShareModal / SyncModal
        ├── HistoryModal
        ├── MediaLibraryModal
        ├── AIGeneratorModal / AICopywriterModal / AITranslateModal
        └── LivePresentationModal
```

## Data Flow

```
User action
    │
    ▼
Zustand Stores
    ├── editor-store.js    (selection, editing, clipboard, UI flags)
    ├── presentation-store.js (presentation data, current slide)
    └── ui-store.js        (theme, panel visibility)
    │
    ├──── subscribed ────► SlideCanvas  (render + interaction)
    ├──── subscribed ────► Toolbar      (commands → store actions)
    ├──── subscribed ────► PropertiesPanel (per-element edits)
    ├──── subscribed ────► SlidePanel   (slide CRUD)
    │
Custom Hooks
    ├── use-autosave   → debounced PUT to server
    ├── use-clipboard  → copy/cut/paste/duplicate
    ├── use-history    → undo/redo (50-step circular buffer)
    ├── use-keyboard   → keyboard shortcut dispatch
    └── use-slide-operations → slide CRUD + element manipulation
    │
    ▼
PUT /api/presentations/:id          ← Express + Zod validation
    │
    ▼
server/data/presentations.json      ← file-based JSON storage
```

## Key Architectural Patterns

| Pattern                 | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| Zustand stores          | 3 stores: editor, presentation, UI — replaced god-component state     |
| Custom hooks            | 6 hooks extracted from EditorPage for logic reuse                     |
| Element factory         | Centralized `element-factory.js` for creating typed elements          |
| Component decomposition | PropertiesPanel routes to 8 type-specific sub-editors                 |
| Modular CSS             | `index.css` (global tokens) + 7 split CSS files in `styles/`          |
| Zod validation          | All mutation API endpoints validate request body via middleware       |
| ErrorBoundary           | React class component wrapping App children — prevents white screen   |
| JSDoc type definitions  | `shared/src/types/presentation.js` — typed element union, Slide, etc. |
| safeStorage (Electron)  | OS keychain for GitHub tokens via IPC; file fallback for Docker       |
| Element renderers       | Shared `element-renderers.js` for DRY HTML generation                 |
| Socket.IO service       | `socket-handler.js` modularized from server entry                     |
| Single TipTap instance  | One `Editor` created in EditorPage, reused across all text elements   |
| File-based storage      | All data in JSON files; no database                                   |
| useState routing        | `App.jsx` switches pages via `useState('page')` — no React Router     |
| Debounced autosave      | `use-autosave` hook, 1500ms after last change                         |
| Fixed canvas            | Renders at 960×540, scales via ResizeObserver CSS transform           |
| CDN-at-runtime          | Present mode and HTML export load reveal.js, KaTeX, Chart.js from CDN |
