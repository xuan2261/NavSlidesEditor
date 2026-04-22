# Code Standards — NavSlides Editor

## Tech Stack

| Layer                | Technology              | Version         |
| -------------------- | ----------------------- | --------------- |
| Frontend framework   | React                   | 18              |
| Build tool           | Vite                    | 5               |
| State management     | Zustand                 | 5               |
| Rich text            | TipTap                  | 2               |
| Presentation engine  | reveal.js               | 5.1.0 (CDN)     |
| Math rendering       | KaTeX                   | CDN             |
| Diagrams             | TikZJax                 | CDN             |
| Charts               | Chart.js                | 4 (CDN)         |
| Syntax highlighting  | highlight.js            | 11 (CDN)        |
| Markdown             | marked.js               | CDN             |
| PowerPoint export    | pptxgenjs               | bundled         |
| Icons (editor UI)    | Lucide                  | bundled         |
| Backend              | Express                 | 4               |
| Request validation   | Zod                     | 3               |
| Runtime              | Node.js                 | 18+             |
| Desktop              | Electron                | 33              |
| Cloud sync           | rclone                  | system / Docker |
| Storage              | JSON files + filesystem | —               |
| Testing              | Vitest, Playwright      |                 |
| Linting & Formatting | ESLint, Prettier        |                 |

## File Naming

| Type              | Convention        | Example                                    |
| ----------------- | ----------------- | ------------------------------------------ |
| React components  | PascalCase `.jsx` | `SlideCanvas.jsx`, `PropertiesPanel.jsx`   |
| Custom hooks      | kebab-case `.js`  | `use-autosave.js`, `use-clipboard.js`      |
| Zustand stores    | kebab-case `.js`  | `editor-store.js`, `presentation-store.js` |
| Utility modules   | kebab-case `.js`  | `element-factory.js`, `smart-guides.js`    |
| TipTap extensions | PascalCase `.js`  | `MathExtension.js`, `FontSize.js`          |
| Server routes     | kebab-case `.js`  | `presentations.js`, `share.js`             |
| Server services   | kebab-case `.js`  | `socket-handler.js`, `live-rooms.js`       |
| CSS files         | kebab-case `.css` | `editor-page.css`, `properties-panel.css`  |
| Type definitions  | kebab-case `.js`  | `presentation.js` (with JSDoc)             |
| Server entry      | lowercase `.js`   | `server/index.js`                          |
| Electron entry    | lowercase `.js`   | `electron/main.js`                         |

## State Management

### Zustand Stores (3 stores)

Editor state is managed via Zustand stores, replacing the god-component pattern:

| Store                | File                           | Owns                                                     |
| -------------------- | ------------------------------ | -------------------------------------------------------- |
| `editor-store`       | `stores/editor-store.js`       | Selection, editing element, clipboard, UI flags          |
| `presentation-store` | `stores/presentation-store.js` | Presentation data, current slide index, slide operations |
| `ui-store`           | `stores/ui-store.js`           | Theme preference, panel visibility, toolbar state        |

**Access pattern**: Components subscribe to stores via Zustand's selector pattern:

```jsx
const selectedElements = useEditorStore((s) => s.selectedElements)
```

### Custom Hooks

Logic extracted from EditorPage into `hooks/`:

| Hook                  | File                       | Purpose                             |
| --------------------- | -------------------------- | ----------------------------------- |
| `useAutosave`         | `use-autosave.js`          | Debounced auto-save (1500ms)        |
| `useClipboard`        | `use-clipboard.js`         | Copy/cut/paste/duplicate elements   |
| `useHistory`          | `use-history.js`           | Undo/redo (50-step circular buffer) |
| `useKeyboard`         | `use-keyboard.js`          | Keyboard shortcut dispatch          |
| `useLivePresentation` | `use-live-presentation.js` | Socket.IO live mode                 |
| `useSlideOperations`  | `use-slide-operations.js`  | Slide CRUD + element manipulation   |

Rule: new editor logic goes into a hook or store. EditorPage only handles composition.

## Component Patterns

- **Functional components only** — `ErrorBoundary` is the sole class component (React limitation)
- **Zustand for state** — no prop drilling for shared state; components subscribe to stores directly
- **Callback prop naming** — `on` prefix: `onUpdate`, `onSelect`, `onDelete`, `onGoHome`
- **Modals extracted** — each modal is a separate component file, not inline JSX
- **PropertiesPanel routing** — routes to type-specific sub-editors in `components/properties/`
- **Element factory** — `element-factory.js` creates typed elements (replaces inline callbacks)
- **Canvas coordinates** — element x/y/width/height in logical px at 960×540; scaling is CSS-only

## Type System (JSDoc)

JSDoc type definitions in `shared/src/types/presentation.js`:

```javascript
/** @typedef {'text'|'image'|'shape'|...|'divider'} ElementType */
/** @typedef {Object} BaseElement */
/** @typedef {BaseElement & { content: string }} TextElement */
/** @typedef {TextElement|ImageElement|...|DividerElement} SlideElement */
/** @typedef {Object} Slide */
/** @typedef {Object} Presentation */
```

No full TypeScript migration. JSDoc provides IDE IntelliSense and type checking via `jsconfig.json`.

Annotated files: `element-factory.js`, `presentation-store.js`, `element-renderers.js`.

## API Patterns

### Client-side (`client/src/utils/api.js`)

Thin fetch wrapper. Functions return parsed JSON or throw on non-OK response.

Base URL: `/api` (Vite dev proxy → Express; same origin in production).

### Server REST conventions

| Pattern          | Convention                                                     |
| ---------------- | -------------------------------------------------------------- |
| Resource URL     | `/api/presentations/:id`                                       |
| Collection URL   | `/api/presentations`                                           |
| Action URL       | `/api/presentations/:id/duplicate`                             |
| Share viewer     | `/share/:token` (no `/api` prefix)                             |
| Request body     | JSON (`Content-Type: application/json`)                        |
| **Validation**   | **Zod schemas via `validate()` middleware on mutation routes** |
| File upload      | `multipart/form-data` via multer (100MB limit, UUID filenames) |
| Success response | resource object or `{ success: true, ...data }`                |
| Error response   | `{ error: 'message' }` with HTTP 4xx/5xx                       |
| Validation error | `{ error: 'Validation failed', details: [...] }` with HTTP 400 |

### Zod Validation

All mutation endpoints (POST, PUT) validate `req.body` via Zod schemas:

```javascript
const { validate } = require('../middleware/validate')
const { createPresentationSchema } = require('../middleware/schemas')

router.post('/', validate(createPresentationSchema), async (req, res) => {
  // req.body is validated and parsed
})
```

Schemas use `.passthrough()` to allow type-specific fields on elements and slides.

### File-based persistence

Server reads/writes JSON files via `fs-extra`. Initialized at startup if missing:

| File                 | Initial value                        |
| -------------------- | ------------------------------------ |
| `presentations.json` | `[]`                                 |
| `templates.json`     | `[]`                                 |
| `share-tokens.json`  | `{}`                                 |
| `github-config.json` | `{ token: '', owner: '', repo: '' }` |

No transactions, no file locking. Single-user assumption.

## CSS Conventions

- **Split CSS architecture** — global tokens in `index.css`, component styles in `styles/*.css`
- **No CSS-in-JS** — plain `.css` files only (not CSS Modules)
- **CSS custom properties** for theming — `data-theme` attribute selects dark (default) or light
- **Design tokens** — colors, surfaces, borders, shadows, radii, transitions defined in `:root`
- **Flexbox** for layout — 3-column editor: SlidePanel | SlideCanvas | PropertiesPanel
- **Never change canvas base size** — 960×540 is a hard constraint; export fidelity depends on it

Theme switching: `App.jsx` sets `document.documentElement.setAttribute('data-theme', theme)` and persists to `localStorage('editor-theme')`.

CSS files:
| File | Scope |
|------|-------|
| `index.css` | Global: design tokens, resets, button utilities |
| `styles/editor-page.css` | EditorPage layout |
| `styles/home-page.css` | HomePage + dashboard |
| `styles/slide-panel.css` | SlidePanel styles |
| `styles/canvas-toolbar.css` | Canvas toolbar |
| `styles/properties-panel.css` | Properties panel |
| `styles/modals.css` | Shared modal styles |
| `styles/components.css` | Miscellaneous components |

## TipTap Extensions

Custom extensions in `client/src/extensions/`, following TipTap Node/Mark class pattern:

| Extension          | Type | Purpose                                     |
| ------------------ | ---- | ------------------------------------------- |
| `MathExtension.js` | Node | Inline KaTeX rendering within text elements |
| `FontSize.js`      | Mark | Custom `font-size` mark                     |
| `FontFamily.js`    | Mark | Custom `font-family` mark                   |

One `Editor` instance is created in `EditorPage` and reused. When a text element is selected, the editor's content is swapped to that element's HTML.

## Export Utilities

| File               | Function signature                                   | Notes                                        |
| ------------------ | ---------------------------------------------------- | -------------------------------------------- |
| `generateHTML.js`  | `generateRevealHTML(presentation) → string`          | Pure, CDN-dependent (re-exports from shared) |
| `exportPptx.js`    | async, reads presentation, triggers browser download | skips chart/html/latex/video/audio/icon      |
| `offlineExport.js` | async, calls generateRevealHTML then inlines CDN     | Improved coverage of CDN resources           |

CDN URLs hardcoded in `shared/htmlGenerator.js`: reveal.js 5.1.0, highlight.js 11, KaTeX, Chart.js 4, marked.js, TikZJax.

## Error Handling

- **ErrorBoundary**: React class component wrapping App children — catches rendering errors, shows recovery UI with "Try Again" and "Reload" buttons
- **Server middleware**: centralized `error-handler.js` for consistent error responses
- **Zod validation**: structured 400 errors with field-level details
- **Server routes**: try/catch around file I/O → `{ error: message }` with HTTP 500/404
- **Client api.js**: throws on non-OK HTTP; callers should try/catch

## Security Measures

| Measure             | Implementation                                |
| ------------------- | --------------------------------------------- |
| Request validation  | Zod schemas on all POST/PUT endpoints         |
| HTML sanitization   | DOMPurify for embedded HTML content           |
| MIME validation     | File upload type checking                     |
| Rate limiting       | Applied to upload + sensitive endpoints       |
| Credential security | Electron safeStorage for GitHub tokens        |
| Error boundaries    | React ErrorBoundary prevents crash exposure   |
| Share passwords     | Optional password protection for shared links |

## What Does Not Exist

| Item            | Status                                   |
| --------------- | ---------------------------------------- |
| Full TypeScript | JSDoc types only (no .ts/.tsx migration) |
| React Router    | Not used (useState-based routing)        |
| Database        | None (file-based only)                   |
| Authentication  | None (single-user design)                |
| CSS Modules     | Not used (split CSS files instead)       |

These are intentional design decisions, not oversights.
