# Code Standards - NavSlides Editor

## Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Frontend framework | React | 18 |
| Routing | React Router DOM | 7.14.1 |
| Build tool | Vite | 5 |
| Styling | Tailwind CSS | 3.4.19 |
| State management | Zustand | 5.0.12 |
| Rich text | TipTap | 2 |
| Presentation engine | reveal.js | 5.1.0 (CDN) |
| Math rendering | KaTeX | CDN |
| Diagrams | TikZJax | CDN |
| Charts | Chart.js | 4 (CDN) |
| Syntax highlighting | highlight.js | 11 (CDN) |
| Markdown | marked.js | CDN |
| PowerPoint export | pptxgenjs | bundled |
| Icons (editor UI) | Lucide | bundled |
| Backend | Express | 4 |
| Request validation | Zod | 3 |
| Runtime | Node.js | 18+ |
| Desktop | Electron | 33 |
| Cloud sync | rclone | system / Docker |
| Storage | JSON files + filesystem | - |
| Testing | Vitest, Playwright | - |
| Linting and formatting | ESLint, Prettier | - |

## File Naming

| Type | Convention | Example |
| --- | --- | --- |
| React components | PascalCase `.jsx` | `SlideCanvas.jsx`, `PropertiesPanel.jsx` |
| Custom hooks | kebab-case `.js` | `use-autosave.js`, `use-clipboard.js` |
| Zustand stores | kebab-case `.js` | `editor-store.js`, `presentation-store.js` |
| Utility modules | kebab-case `.js` | `element-factory.js`, `smart-guides.js` |
| TipTap extensions | PascalCase `.js` | `MathExtension.js`, `FontSize.js` |
| Server routes | kebab-case `.js` | `presentations.js`, `share.js` |
| Server services | kebab-case `.js` | `socket-handler.js`, `live-rooms.js` |
| CSS files | kebab-case `.css` | `editor-page.css`, `properties-panel.css` |
| Type definitions | kebab-case `.js` | `presentation.js` (with JSDoc) |
| Server entry | lowercase `.js` | `server/index.js` |
| Electron entry | lowercase `.js` | `electron/main.js` |

## State Management

### Zustand Stores (3 stores)

Editor state is managed via Zustand stores instead of a god component.

| Store | File | Owns |
| --- | --- | --- |
| `editor-store` | `stores/editor-store.js` | Selection, editing element, clipboard, UI flags |
| `presentation-store` | `stores/presentation-store.js` | Presentation data, current slide index, slide operations |
| `ui-store` | `stores/ui-store.js` | Theme preference, panel visibility, toolbar state |

**Access pattern:** components subscribe with selectors.

```jsx
const selectedElements = useEditorStore((s) => s.selectedElements)
```

### Routing

- `App.jsx` uses `BrowserRouter`, `Routes`, and `Route`.
- Shared app chrome lives in `MainLayout`; live routes render outside that
  layout.
- Route-aware pages live in `client/src/pages/`, not in a global page-state
  switch.

### Custom Hooks

Logic extracted from `EditorPage` lives in `hooks/`.

| Hook | File | Purpose |
| --- | --- | --- |
| `useAutosave` | `use-autosave.js` | Debounced auto-save (1500ms) |
| `useClipboard` | `use-clipboard.js` | Copy/cut/paste/duplicate elements |
| `useHistory` | `use-history.js` | Undo/redo (50-step circular buffer) |
| `useKeyboard` | `use-keyboard.js` | Keyboard shortcut dispatch |
| `useLivePresentation` | `use-live-presentation.js` | Socket.IO live mode |
| `useSlideOperations` | `use-slide-operations.js` | Slide CRUD + element manipulation |

Rule: new editor logic goes into a hook or store. `EditorPage` handles
composition.

## Component Patterns

- Functional components only. `ErrorBoundary` is the sole class component.
- Use Zustand selectors for shared state; avoid prop drilling for editor state.
- Callback props use the `on` prefix: `onUpdate`, `onSelect`, `onDelete`,
  `onGoHome`.
- Modals stay in separate component files, not inline JSX.
- `PropertiesPanel` routes to type-specific sub-editors in
  `components/properties/`.
- `element-factory.js` creates typed elements and replaces inline callbacks.
- Canvas coordinates stay in logical px at 960 x 540; scaling is CSS-only.
- `MainLayout` owns the shared shell, while live routes stay outside it.

## Type System (JSDoc)

JSDoc type definitions live in `shared/src/types/presentation.js`.

```javascript
/** @typedef {'text'|'image'|'shape'|...|'divider'} ElementType */
/** @typedef {Object} BaseElement */
/** @typedef {BaseElement & { content: string }} TextElement */
/** @typedef {TextElement|ImageElement|...|DividerElement} SlideElement */
/** @typedef {Object} Slide */
/** @typedef {Object} Presentation */
```

No full TypeScript migration. JSDoc provides IntelliSense and type checking via
`jsconfig.json`.

Annotated files include `element-factory.js`, `presentation-store.js`, and
`element-renderers.js`.

## API Patterns

### Client-side (`client/src/utils/api.js`)

Thin fetch wrapper. Functions return parsed JSON or throw on non-OK responses.

Base URL: `/api` (Vite dev proxy -> Express; same origin in production).

### Server REST conventions

| Pattern | Convention |
| --- | --- |
| Resource URL | `/api/presentations/:id` |
| Collection URL | `/api/presentations` |
| Action URL | `/api/presentations/:id/duplicate` |
| Share viewer | `/share/:token` (no `/api` prefix) |
| Request body | JSON (`Content-Type: application/json`) |
| Validation | Zod schemas via `validate()` middleware on mutation routes |
| File upload | `multipart/form-data` via multer (100MB limit, UUID filenames) |
| Success response | Resource object or `{ success: true, ...data }` |
| Error response | `{ error: 'message' }` with HTTP 4xx/5xx |
| Validation error | `{ error: 'Validation failed', details: [...] }` with HTTP 400 |

### Zod Validation

All mutation endpoints (POST, PUT) validate `req.body` via Zod schemas.

```javascript
const { validate } = require('../middleware/validate')
const { createPresentationSchema } = require('../middleware/schemas')

router.post('/', validate(createPresentationSchema), async (req, res) => {
  // req.body is validated and parsed
})
```

Schemas use `.passthrough()` to allow type-specific fields on elements and
slides.

### File-Based Persistence

Server reads and writes JSON files via `fs-extra`.

| File | Initial value |
| --- | --- |
| `presentations.json` | `[]` |
| `templates.json` | `[]` |
| `share-tokens.json` | `{}` |
| `github-config.json` | `{ token: '', owner: '', repo: '' }` |
| `settings.json` | `{ aiApiKey: '', defaultTheme: 'black', defaultTransition: 'slide' }` |

`storage.js` wraps each file in an in-memory lock queue so concurrent requests
do not race. There is still no database layer and no cross-file transaction
support.

## Styling Conventions

- Tailwind utilities are the primary source for app chrome styling.
- `client/src/index.css` contains the Tailwind directives and design tokens.
- `client/tailwind.config.js` maps colors, radii, and animations to CSS
  variables.
- Use CSS custom properties for theme tokens; `data-theme` selects dark
  (default) or light surfaces.
- Keep CSS Modules out of the app; split `.css` files and Tailwind utilities are
  the standard.
- Use `cn()` from `client/src/lib/utils.js` when class merging is needed.
- `App.jsx` sets `document.documentElement.dataset.theme` and persists
  `localStorage('editor-theme')`.

CSS files:

| File | Scope |
| --- | --- |
| `index.css` | Global tokens, Tailwind directives, resets, button utilities |
| `styles/editor-page.css` | EditorPage layout |
| `styles/home-page.css` | HomePage and dashboard |
| `styles/slide-panel.css` | SlidePanel styles |
| `styles/canvas-toolbar.css` | Canvas toolbar |
| `styles/properties-panel.css` | Properties panel |
| `styles/modals.css` | Shared modal styles |
| `styles/components.css` | Miscellaneous components |

## TipTap Extensions

Custom extensions in `client/src/extensions/` follow the TipTap Node/Mark class
pattern.

| Extension | Type | Purpose |
| --- | --- | --- |
| `MathExtension.js` | Node | Inline KaTeX rendering within text elements |
| `FontSize.js` | Mark | Custom `font-size` mark |
| `FontFamily.js` | Mark | Custom `font-family` mark |

One `Editor` instance is created in `EditorPage` and reused. When a text element
is selected, the editor content is swapped to that element's HTML.

## Export Utilities

| File | Function signature | Notes |
| --- | --- | --- |
| `generateHTML.js` | `generateRevealHTML(presentation) -> string` | Pure, CDN-dependent re-export from shared |
| `exportPptx.js` | async, reads presentation, triggers browser download | Uses `getSlideNotes()` and skips unsupported element types |
| `offlineExport.js` | async, calls `generateRevealHTML()` then inlines CDN | Offline HTML export helper |

CDN URLs are hardcoded in `shared/htmlGenerator.js` for reveal.js 5.1.0,
highlight.js 11, KaTeX, Chart.js 4, marked.js, and TikZJax.

## Error Handling

- `ErrorBoundary` wraps the app and shows recovery UI with "Try Again" and
  "Reload" actions.
- Server middleware centralizes JSON error formatting in `error-handler.js`.
- Zod validation returns structured 400 errors with field-level details.
- Route handlers use `try/catch` around file I/O and return `{ error: message }`
  with HTTP 500/404 where appropriate.
- `client/src/utils/api.js` throws on non-OK HTTP responses; callers should
  `try/catch`.

## Security Measures

| Measure | Implementation |
| --- | --- |
| Request validation | Zod schemas on all POST/PUT endpoints |
| HTML sanitization | DOMPurify for embedded HTML content |
| MIME validation | File upload type checking |
| Rate limiting | Applied to upload and sensitive endpoints |
| Credential security | Electron `safeStorage` for GitHub tokens |
| Error boundaries | React `ErrorBoundary` prevents crash exposure |
| Share passwords | Optional password protection for shared links |

## What Does Not Exist

| Item | Status |
| --- | --- |
| Full TypeScript | JSDoc types only, no `.ts` / `.tsx` migration |
| Database | None; persistence is file-based only |
| CSS Modules | Not used; split CSS files and Tailwind utilities are used instead |
| Authentication | None; single-user self-hosted design |

These are intentional design decisions, not oversights.
