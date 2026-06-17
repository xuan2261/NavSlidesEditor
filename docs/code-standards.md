# Code Standards - NavSlides Editor

## Tech Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Frontend framework | React | 18 |
| Routing | React Router DOM | 7.14.1 |
| Build tool | Vite | 5 |
| Styling | Tailwind CSS | 3.4.19 |
| State management | Zustand | 5.0.12 |
| Rich text | TipTap | 2.6.6 |
| Presentation engine | reveal.js | 5.1.0 (CDN) |
| Math rendering | KaTeX | 0.16.40 (local npm) |
| Diagrams | TikZJax | CDN |
| Charts | Chart.js | 4.5.1 (local npm) |
| Syntax highlighting | highlight.js | 11.11.1 (local npm) |
| Markdown | marked.js | 18.0.0 (local npm) |
| PowerPoint export | pptxgenjs | 4.0.1 (local npm) |
| Icons (editor UI) | Lucide | 0.441.0 (local npm) |
| Backend | Express | 4 |
| Request validation | Zod | 4.3.6 |
| Runtime | Node.js | 20+ |
| Desktop | Electron | 33 |
| Cloud sync | rclone | system / Docker |
| Storage | JSON files + filesystem | - |
| Testing | Vitest, Playwright | - |
| Linting and formatting | ESLint, Prettier | - |

## E2E Selector Contract

Use `data-testid` as the stable selector contract for E2E tests that touch editor
controls, canvas handles, repeated controls, or layout instrumentation. User-facing
queries (`getByRole`, `getByLabel`, `getByText`) are allowed for accessibility
assertions and simple navigation smoke tests. CSS selectors are legacy fallback only
and should not be introduced for new editor behavior.

E2E structure conventions:

- Create and clean presentations through `testPresentation` from `tests/e2e/fixtures/test-fixtures.js`.
- Page-object helper files live in `tests/e2e/pages/` and use kebab-case filenames.
- Wait with `expect.poll`, locator assertions with explicit timeouts, and `waitForResponse`; do not add `waitForTimeout`.
- Keep E2E spec files at or below 200 LOC. Split by concern when a file grows past that cap.
- PPTX import layout regressions must use the real-browser audit commands:
  `npm run test:pptx:browser-audit` for strict smoke and
  `npm run test:pptx:browser-audit:full` for release signoff. Use
  `npm run test:pptx:browser-audit:headed` when manual visual inspection is
  needed. `npm run test:pptx:strict` is intentionally corpus plus strict smoke,
  not the full release audit. The strict corpus gate documents average semantic >= 98%
  and average production round-trip floor >= 50% as the active global thresholds.
  Audit artifacts stay under ignored
  `plans/reports/pptx-import-real-browser-audit-runs/`.

Canvas selector IDs are stable and must not be renamed:

- `slide-element-*`
- `resize-handle-*`
- `rotation-handle`
- `top-ruler`
- `left-ruler`
- `persistent-guide-*`
- `smart-guide-*`

Property controls use `prop-*` IDs and should stay stable once adopted in tests.

Ribbon layout metrics use a dedicated DOM contract instead of Tailwind-class or
DOM-shape queries:

- `data-ribbon-content-row`: active tab command row and horizontal scroll owner.
- `data-ribbon-section`: command group container.
- `data-ribbon-section-label`: visible group label.
- `data-ribbon-popup`: popup surface rendered through `RibbonFloatingOverlay`.

Tests should measure the active `tabpanel` and its `data-ribbon-content-row`.
The outer `.tour-step-ribbon` is the fixed shell, not the scroll owner.
Popup geometry tests should target `data-ribbon-popup` instead of relying on
portal DOM position or Tailwind placement classes. Ribbon popups must be anchored
to the trigger, escape ribbon clipping via body portal, clamp inside the viewport,
close on Escape/outside click, and restore focus to the invoking trigger.

## File Size Budget

- Keep new code files under 200 LOC where practical.
- Legacy files that exceed that target are refactor candidates, not automatic violations.
- Split behavior into hooks, stores, or focused components before adding more logic to a large file.

## Element Constants and Factory Functions

Typed element constants and factory functions live in `client/src/constants/`. Each
element type group gets its own file following the pattern
`*-element-*-constants.js`.

```js
// client/src/constants/game-element-types-constants.js
export const GAME_TYPES = {
  'name-picker': 'name-picker',
  'hot-potato': 'hot-potato',
  // ...
}
GAME_TYPES.all = Object.values(GAME_TYPES)

export const DEFAULT_GAME_COLORS = { ... }

export function createGameElement(gameType = 'name-picker', overrides = {}) {
  return { type: 'game', gameType, ...overrides }
}

export function createQuestion(overrides = {}) { ... }
export function createTeam(overrides = {}) { ... }
```

Factory functions:
- Accept an `overrides` object as the last argument and spread it last so callers
  can override any field.
- Generate IDs with `Date.now()` + random suffix; no `crypto.randomUUID()` for
  user-facing objects.
- Keep deterministic sequences local to the module when needed; prefer explicit
  test setup/teardown over undocumented reset helpers.

Plugin element factories live in `client/src/plugins/plugin-loader.js` because
`plugin:*` types are discovered at runtime and must not be added to
`ELEMENT_DEFAULTS`. Plugin elements must persist `pluginId`, `pluginSlug`,
`pluginData`, and `pluginRuntime`.

| Type | Convention | Example |
| --- | --- | --- |
| React components | PascalCase `.jsx` | `SlideCanvas.jsx`, `PropertiesPanel.jsx` |
| Custom hooks | kebab-case `.js` | `use-autosave.js`, `use-clipboard.js` |
| Zustand stores | kebab-case `.js` | `editor-store.js`, `presentation-store.js` |
| Utility modules | kebab-case `.js` | `element-factory.js`, `smart-guides.js` |
| TipTap extensions | PascalCase `.js` | `MathExtension.js`, `FontSize.js` |
| Server routes | kebab-case `.js` | `presentations.js`, `share.js` |
| Server services | kebab-case `.js` | `socket-handler.js`, `live-rooms.js` |
| CSS files | Single file | All CSS lives in `client/src/index.css` |
| Type definitions | kebab-case `.js` | `presentation.js` (with JSDoc) |
| Server entry | lowercase `.js` | `server/index.js` |
| Electron entry | lowercase `.js` | `electron/main.js` |
| Test files | `*.test.js` or `*.test.jsx` | `api.test.js`, `pptx-import.test.js` |

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
- Shared app chrome lives in `MainLayout`; live routes render outside that layout.
- Current route map:
  - `/` → `HomePage`
  - `/editor/:id` → `EditorPage`
  - `/template/:id` → `EditorPage` template mode
  - `/settings` → `SettingsPage`
  - `/explore` → `ExplorePage`
  - `/live/:roomCode` → `LiveViewPage`
  - `/remote/:roomCode` → `RemoteControlPage`
  - `/speaker/:roomCode` → `SpeakerViewPage`
  - `/player/:slideId/:elementId` → `game-player-join-page.jsx`
- Route-aware pages live in `client/src/pages/`, not in a global page-state switch.

### Custom Hooks

Logic extracted from `EditorPage` lives in `hooks/`.

| Hook | File | Purpose |
| --- | --- | --- |
| `useAutosave` | `use-autosave.js` | Debounced auto-save (1500ms) |
| `useClipboard` | `use-clipboard.js` | Copy/cut/paste/duplicate elements |
| `useKeyboard` | `use-keyboard.js` | Keyboard shortcut dispatch |
| `useLivePresentation` | `use-live-presentation.js` | Socket.IO live mode |
| `useLiveTimer` | `use-live-timer.js` | Presenter timer UI state |
| `useLiveTimerSync` | `use-live-timer-sync.js` | Socket timer sync |
| `useSlideOperations` | `use-slide-operations.js` | Slide CRUD + element manipulation |
| `useRevealPreviewFrame` | `use-reveal-preview-frame.js` | Reveal iframe management for present mode |
| `useAnnotationSync` | `use-annotation-sync.js` | Presenter annotation sync |
| `useGameSocket` | `use-game-socket.js` | Game player Socket.IO join/updates |
| `useTouchGestures` | `use-touch-gestures.js` | Touch gesture normalization |
| `useSwipeNavigation` | `use-swipe-navigation.js` | Swipe navigation |
| `usePinchZoom` | `use-pinch-zoom.js` | Pinch zoom |
| `useCanvasPointerInteraction` | `use-canvas-pointer-interaction.js` | Canvas drag/resize/rotate routing |
| `useCanvasResizeRotate` | `use-canvas-resize-rotate.js` | Resize math + rotation snap |
| `useCanvasSnappingHelpers` | `use-canvas-snapping-helpers-for-grid-and-smart-guides.js` | Snap + smart guide math |
| `useCanvasRubberBandDrag` | `use-canvas-rubber-band-drag-selection.js` | Rubber-band selection |
| `useElementCreation` | `use-element-creation.js` | Element insertion handlers (extracted from EditorPage) |
| `useExportActions` | `use-export-actions.js` | Export handlers (HTML/PDF/PPTX/offline) |
| `useAiActions` | `use-ai-actions.js` | AI copywriter/translate/generate handlers |

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
- Game elements are first-class `type: 'game'` elements with 7 game types and a dedicated presenter/player flow; they are not collaborative slide-editing primitives.
- **Ribbon UI**: `EditorPage` composes `RibbonHeaderBar` and `RibbonPanel`. Active tab state lives in `ui-store.activeTab` and persists to localStorage. The old `Toolbar.jsx`, `InsertMenu.jsx`, and `EditorMenuBar.jsx` components have been removed in favor of the tab-based ribbon.
- **Ribbon layout primitive**: tab content should render through `RibbonTabContentRow` when it participates in the classic ribbon command-row contract. Keep horizontal scrolling on that row only; do not add nested scroll owners inside individual groups.
- **RibbonBigButton**: primary tab actions use `RibbonBigButton` (icon ~22px over an 11px label, ~52px tall) for PowerPoint-style visual hierarchy. Applied to Home→Paste and Insert→Text Box + Picture. Accepts explicit `aria-label` so the visible label can differ from the accessible name used by tests.
- **Contextual Format tab**: driven by `ui-store.formatContext` (`{ hasSelection, elementType }`). Hidden when nothing is selected; relabelled by type via `formatTabLabel`. Auto-activates on first selection; falls back to Home when selection clears. Both `RibbonPanel` and `RibbonHeaderBar` use an `effectiveTab` guard to coerce a persisted `activeTab='format'` to `home` when `!hasSelection`.
- **EditorModals**: boolean modal-visibility flags live in `ui-store` (not local `useState`). Modal-mount JSX is lifted into `EditorModals.jsx` + `editor-modals-secondary.jsx`. Element-creation, export, and AI handlers are extracted into `use-element-creation`, `use-export-actions`, and `use-ai-actions` hooks.

### Canvas Extraction Patterns

New element renderers go into `client/src/components/canvas/element-renderers/` and register via the `elementRendererRegistry` in `registry.js`. Keep each renderer under 150 LOC. Text/image/media/html/code renderers may stay inline in `canvas-element-wrapper.jsx` if they have TipTap or DOM coupling.

Canvas chrome components (`GridOverlay`, `Rulers`, `ZoomControls`, `FooterOverlay`, `ContextMenu`) live directly in `canvas/` and receive explicit props, not store subscriptions.

Interaction logic goes into `use-canvas-*.js` hooks that return `{ getSnapOffset, guides, ... }` or event handlers. Keep hooks focused — split `use-canvas-pointer-interaction.js` further if it exceeds ~300 LOC.

### Shortcut Registry Convention

All editor keyboard shortcuts are defined in `default-keyboard-shortcut-definitions-registry.js`. The registry is the **single source of truth** for default key chords and labels. Toolbar/menu components must read shortcut bindings from the registry, not hardcode strings like `"Ctrl+C"`.

Override flow:
1. `shortcut-local-storage-persistence.js` reads/writes user overrides to `localStorage`.
2. `getShortcuts(overrides)` merges defaults with overrides at runtime.
3. `use-keyboard.js` resolves the active chord and dispatches to `on{capitalize(id)}` callbacks.

Settings UI (`SettingsPage.jsx`) provides record/conflict-warn/reset per shortcut. Conflict detection via `detectConflict()`. Reserved browser chords are blocked by `isReservedChord()`.

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

### Plugin Runtime Conventions

- Bundled plugins live under `plugins/<slug>/`; optional user plugins live under
  `server/data/plugins/<slug>/`.
- Plugin slugs must match `/^[a-z0-9][a-z0-9-]{0,63}$/`.
- Manifests are named `parallax-plugin.json` and must include `id`, `name`,
  `version`, and `contributes.elements`.
- Server routes are read-only: no install/write endpoint in Phase 1.
- Asset serving is limited to each plugin `dist/` directory through
  `/api/plugins/:slug/assets/*`; reject traversal and unsafe slugs.
- Plugin canvas rendering must use an iframe with `sandbox="allow-scripts"`
  only. Do not add `allow-same-origin`.
- Parent/sandbox message handlers must include a source marker and verify
  `event.source` before applying data patches.

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
| `analytics.json` | `{}` |
| `media.json` | `[]` |

`storage.js` wraps each file in an in-memory lock queue so concurrent requests
do not race. There is still no database layer and no cross-file transaction
support.

## Styling Conventions

- Tailwind utilities are the primary source for app chrome styling.
- `client/src/index.css` is the single global stylesheet; it contains the Tailwind directives, design tokens, resets, and shared component rules.
- There is no `client/src/styles/` directory in the current codebase.
- `client/tailwind.config.js` maps colors, radii, and animations to CSS variables.
- Use CSS custom properties for theme tokens; `data-theme` selects dark (default) or light surfaces.
- Keep CSS Modules out of the app; split `.css` files and Tailwind utilities are the standard.
- Use `cn()` from `client/src/lib/utils.js` when class merging is needed.
- `App.jsx` sets `document.documentElement.dataset.theme` and persists
  `localStorage('editor-theme')`.

CSS files:

All CSS lives in `client/src/index.css`. It contains Tailwind directives,
design token CSS custom properties, resets, button utilities, and all
shared component styles. There is no `client/src/styles/` directory.

## TipTap Extensions

Custom extensions in `client/src/extensions/` follow the TipTap Node/Mark class
pattern.

| Extension | Type | Purpose |
| --- | --- | --- |
| `MathExtension.js` | Node | Inline KaTeX rendering within text elements |
| `FontSize.js` | Mark | Custom `font-size` mark |
| `FontFamily.js` | Mark | Custom `font-family` mark |
| `tiptap-font-weight-extension.js` | Mark | Custom `font-weight` mark |
| `tiptap-line-height-extension.js` | Mark | Custom `line-height` mark |
| `@tiptap/extension-color` | Mark | Text color |
| `@tiptap/extension-highlight` | Mark | Text highlighting |
| `@tiptap/extension-image` | Node | Image elements |
| `@tiptap/extension-link` | Mark | Hyperlinks |
| `@tiptap/extension-placeholder` | Node | Editor placeholder text |
| `@tiptap/extension-table-*` | Node | Table support (table, table-row, table-cell, table-header) |
| `@tiptap/extension-text-align` | Mark | Text alignment |
| `@tiptap/extension-text-style` | Mark | Inline text styles |
| `@tiptap/extension-underline` | Mark | Underline formatting |

One `Editor` instance is created in `EditorPage` and reused. When a text element
is selected, the editor content is swapped to that element's HTML.

## Design Token Conventions

Design tokens are defined in `shared/src/design-tokens.js` and consumed by both render paths (shared string renderers and React editor canvas) so the `'auto'` → `var(--ns-*)` mapping never diverges.

### Token Shape

```js
// presentation.designTokens / slide.designTokens
{
  colors: { bg, surface, accent, accent2, text, muted },
  fonts:  { heading, body },
  radius, spacingScale
}
```

- `DEFAULT_TOKENS` mirrors historical hardcoded hex values — token-free decks render byte-identical.
- `AUTO_FIELD_MAP` maps element color field names to their token key.
- `resolveAutoColor(value, tokens)` — call this for any color field; returns `var(--ns-<token>)` when `value === 'auto'`, otherwise returns the value unchanged.
- `resolveColorField(element, fieldName, tokens)` — convenience wrapper.
- `tokensToCssVars(tokens)` / `tokensToStyleObject(tokens)` — used by `htmlGenerator` and `SlideCanvas` respectively.
- `mergeTokens(base, override)` — shallow merge; used for per-slide token overrides.
- `presentationUsesTokens(presentation)` — returns `true` if any deck/slide token is set; `htmlGenerator` only injects `:root{--ns-*}` blocks when this is true (frozen-hex decks are untouched).

### 'auto' Sentinel Rule

Element color fields (fill, stroke, text color, etc.) may be set to the string `'auto'`. This resolves to `var(--ns-<token>)` at render time. Built-in element defaults and built-in templates use `'auto'`; saved user decks are never auto-migrated.

SVG paints must route token vars through the `style` attribute, not SVG presentation attributes (which cannot resolve CSS custom properties). `safeCssColor` whitelists the `var(--ns-<name>)` shape.

### Background FX Type

Slide backgrounds support `type: 'fx'` with shape `{ name, params, fallbackColor }`. The `shared/src/fx/` registry (`getFxModule`, `listFx`, `buildFxRuntimeScript`) powers both the editor canvas (`slide-background-fx-canvas.jsx`) and the `htmlGenerator`-inlined browser runtime. `fallbackColor` is used for print/PDF paths.

### Theme Presets

`shared/src/theme-presets.js` exports `THEME_PRESETS` (39 presets) and `getThemePreset(id)`. Each preset: `{ id, label, category, revealTheme, tokens }`. All re-exported via `revealjs-shared` package (`import { THEME_PRESETS, getFxModule, tokensToCssVars } from 'revealjs-shared'`).

## Feature-Coverage Matrix

The feature-coverage traceability matrix is maintained by a pipeline in `scripts/feature-inventory/`:

| Script | Purpose |
| --- | --- |
| `build-inventory.mjs` | Builds capability inventory from `feature-manifest.json` |
| `extract-tags.mjs` | Scans test files for `[cap:<id>]` annotations |
| `join-run-status.mjs` | Joins coverage tags with Vitest/Playwright run results |
| `build-matrix.mjs` | Produces `docs/feature-coverage-matrix.md` + JSON report |
| `check-coverage-gate.mjs` | Fails if uncovered capabilities exceed the allowlist |
| `check-manifest-completeness.mjs` | Checks manifest vs. codebase drift |

### Test Annotation Convention

Tag test cases with `[cap:<id>]` in the test description to link them to a capability in `feature-manifest.json`:

```js
it('moves element with arrow keys [cap:canvas-nudge]', () => { ... })
```

- Capability IDs are defined in `scripts/feature-inventory/feature-manifest.json`.
- Optional `depth:*` labels add assertion-depth evidence to a passing capability
  tag. Use inline depth for one capability, for example
  `[cap:control.format.position depth:behavior]`, or standalone
  `[depth:persistence]` when the evidence applies to every cap in the title.
  Allowed labels are enforced by the tag parser and mirrored with evidence
  definitions in `scripts/feature-inventory/coverage-depth-policy.json`.
- Acknowledged gaps live in `scripts/feature-inventory/coverage-gate-allowlist.json` with a `debtAllowedUntil` date.
- `docs/feature-coverage-matrix.md` is **auto-generated** by `npm run matrix` — do not hand-edit it.
- Run `npm run matrix:gate` to check the gate locally. CI job `feature-coverage-gate` runs this as a non-required warn-first check.
- Extended non-editor-core domains are reported separately by `npm run matrix:extended-report`; contract-only rows must not be promoted to full executable verification without hermetic adapters or real CI credentials.

### Element-Control Audit Matrix

The element-control audit matrix is a separate, finer-grained harness layered on top of the feature-coverage matrix. It lives under `scripts/feature-inventory/` as:

- `element-control-expected-controls.json`
- `element-control-audit-matrix.json`
- `validate-element-control-audit-matrix.mjs`
- `validate-element-control-audit-matrix.test.mjs`

Use `npm run matrix:element-control` to run it directly. `npm run matrix:gate` already includes this validator, so the gate now covers both capability coverage and element/control/surface audit rows.

The harness verifies all 19 canonical element types, enforces one row per `element/control/surface`, allows only `works`, `partial`, `broken`, and `export-gap`, and requires evidence, testCoverage, and security fields for content-bearing controls. The generated report lives at `plans/260617-0739-element-control-audit-matrix-tdd/reports/element-control-audit-matrix-current.md`.

| File | Function signature | Notes |
| --- | --- | --- |
| `generateHTML.js` | `generateRevealHTML(presentation) -> string` | Pure, CDN-dependent re-export from shared |
| `export-pptx-*.js` (8 files) | async, runs in client | Hybrid PPTX export: native objects for stable types, Playwright raster for complex DOM elements |
| `server/services/pptx-exporter.js` | server-side | Playwright-based element rasterization endpoint |
| `server/routes/pptx-import.js` | `POST /api/pptx/import` | Parses `.pptx` via `pptxtojson`, maps to NavSlides elements |
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

### Trusted Programmable Content Policy

NavSlides Editor intentionally supports author-controlled executable presentation content:

- HTML embeds can contain HTML, CSS, and JavaScript.
- Custom presentation CSS can affect exported and presented slides.
- Inline SVG, Markdown output, reveal.js exports, and iframe-based renderers are part of the authoring surface.

Do not treat trusted author-controlled HTML/CSS/JS execution as an automatic blocking XSS finding. This is product scope, not a bug, for the single-user self-hosted model.

Security reviews should still block issues that cross trust boundaries:

- untrusted import/upload content executing outside the author's intent
- share/viewer routes gaining editor/admin capabilities
- one user's stored content affecting another user
- credential exposure, SSRF, path traversal, command injection, or data loss
- public deployment without an external auth boundary

If deployment is internet-facing or multi-user, require external authentication and document the content trust boundary before release.

| Measure | Implementation |
| --- | --- |
| Request validation | Zod schemas on all POST/PUT endpoints |
| Targeted content safety | Sanitize only text/markdown/svg/shape-text render paths |
| Trusted HTML embeds | Keep HTML embed content programmable (no blanket script stripping) |
| MIME validation | File upload type checking |
| Rate limiting | Applied to upload and sensitive endpoints |
| Analytics access guard | `/api/analytics/:id` requires valid share token for that presentation |
| Live presenter auth | `presenterToken` required for presenter `join-room` |
| AI custom endpoint guard | Public `http/https` only, localhost/private/link-local blocked |
| Credential security | Electron `safeStorage` for GitHub tokens |
| Error boundaries | React `ErrorBoundary` prevents crash exposure |
| Share passwords | Optional password protection for shared links |

SVG authored content remains trusted presentation content, but SVG render sinks
must strip active nodes (`script`, `foreignObject`, `iframe`, `object`, `embed`),
event attributes, unsafe `href` / `xlink:href` / `src` values, and external SVG
references. Fragment references and `data:image/*;base64` references are the
allowed SVG reference forms.

## What Does Not Exist

| Item | Status |
| --- | --- |
| Full TypeScript | JSDoc types only, no `.ts` / `.tsx` migration |
| Database | None; persistence is file-based only |
| CSS Modules | Not used; split CSS files and Tailwind utilities are used instead |
| Authentication | None; single-user self-hosted design |

These are intentional design decisions, not oversights.
