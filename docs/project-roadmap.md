# Project Roadmap - NavSlides Editor

## Current Status: v1.14.3 — Coverage governance, CI stabilization, release-confidence verification, design-token theming, FX backgrounds, Design Ideas, ribbon polish, and EditorPage hardening

Core editing, export, live presentation, game presenter/player, and PPTX import flows are operational. The ribbon UI has replaced the old toolbar/menu system and now has clipping-safe portal popups. The design-token system (39 presets, 8 FX backgrounds, Design Ideas panel) landed in v1.13.0-v1.14.0. EditorPage hardening (vertical slides first-class, ~1356 LOC) and ribbon polish (contextual Format tab, RibbonBigButton, zoom slider, view switcher) completed in v1.14.0. v1.14.1 adds release-confidence verification docs, critical journey coverage, and CI gate contracts. The 2026-06-12 remediation pass closes the 2026-06-11 monorepo review findings across game sockets, server trust boundaries, import/export hardening, live room cleanup, and editor UI controls. v1.14.3 completes the 2026-06-15 coverage expansion pass: warn-first `depth:*` assertion-depth governance, Phase 3 behavior evidence for all 19 canonical element rows, focused Phase 4 browser-depth workflows, Phase 5 external-boundary coverage, Phase 6 visual/a11y/k6 lane ownership, Phase 7 manual-smoke disposition/final validation reporting, and a green full GitHub CI matrix with E2E shards, visual regression, mobile, live, PPTX corpus, feature coverage, and k6 lanes. The current docs baseline reflects Node.js 20+, the route-based shell, ribbon architecture, in-memory live room state with cleanup, and the hybrid PPTX export/import pipeline.

### What Works

| Area                                               | Status                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| WYSIWYG editing (core element set, including game) | Done                                                                                                      |
| Undo/redo (50-step)                                | Done                                                                                                      |
| Auto-save (debounced)                              | Done                                                                                                      |
| Smart guides + snapping                            | Done                                                                                                      |
| Fragment animations + timeline                     | Done                                                                                                      |
| Animation Preview modal                            | Done (accessible dialog, narrow viewport checked)                                                         |
| Slide templates (20+ layouts)                      | Done                                                                                                      |
| Interactive and quiz templates                     | Done                                                                                                      |
| Footer system (basic + sequence)                   | Done                                                                                                      |
| Present mode (reveal.js)                           | Done                                                                                                      |
| Export HTML                                        | Done (CDN-backed deck)                                                                                    |
| Export PDF                                         | Done                                                                                                      |
| Export PPTX                                        | Done (hybrid native + high-res raster fallback, structured export-gap warnings/report)                    |
| Project export/import (.navslides)                 | Done (manifest v1.1, partial media skip warnings)                                                         |
| Import PPTX                                        | Done (editable best-effort projection through the pptxtojson-only runtime; parser metrics and browser audit are separate from currently blocked native importer qualification) |
| Offline HTML export                                | Done (self-contained)                                                                                     |
| Shareable links (with password option)             | Done                                                                                                      |
| GitHub push integration                            | Done                                                                                                      |
| rclone cloud sync                                  | Done                                                                                                      |
| Version history (snapshots)                        | Done                                                                                                      |
| Docker deployment                                  | Done                                                                                                      |
| Electron desktop (Linux/macOS/Windows)             | Done                                                                                                      |
| Dark/light editor theme                            | Done                                                                                                      |
| AI copywriting + translation                       | Done                                                                                                      |
| Media library (Unsplash, Giphy)                    | Done                                                                                                      |
| Gamification Game Controls (10 game types)         | Done                                                                                                      |
| Game socket remediation                             | Done (dedicated `/games` namespace, stable player identity, host authz, duplicate-answer guard, room cleanup) |
| Ribbon UI migration                                 | Done (replaced Toolbar.jsx, InsertMenu.jsx, EditorMenuBar.jsx with tab-based ribbon; Advanced direct actions and portal popup overlay hardening complete) |
| Parallax feature port                               | Done (font-weight, line-height, timeline element, video controls, LaTeX improvements)                    |
| Upstream selective port                             | Done (merged 2026-05-14; copy URL context menu, typography/export consistency)                            |
| Local plugin runtime Phase 1                        | Done (bundled plugin discovery, sandbox canvas runtime, Animated Counter sample, export fallback)         |
| Design-token system (themes/FX/Design Ideas)        | Done (39 token presets × 7 categories, 8 FX backgrounds, Design Ideas panel, 35-layout library)          |
| Ribbon UI polish                                    | Done (contextual Format tab, RibbonBigButton hierarchy, zoom slider, view switcher)                       |
| EditorPage hardening + vertical slides              | Done (~1356 LOC, EditorModals extracted, use-element-creation/use-export-actions/use-ai-actions hooks, vertical slides first-class) |
| Feature-coverage traceability matrix                | Done (100 editor-core capabilities, 100 PASS / 0 ALLOWED, extended domain inventory, CI warn-first gate, `[cap:<id>]` annotation convention, warn-first `depth:*` assertion-depth labels)    |
| Monorepo review remediation                         | Done (8 TDD phases, 2474 Vitest tests passed, lint/build green, PPTX corpus/browser-audit gates passed for import/export phases) |

### What's New in v1.5.x / v1.6.x (Security & Architecture Refactor)

| Area                                                                      | Status |
| ------------------------------------------------------------------------- | ------ |
| Zod request validation on all mutation APIs                               | Done   |
| CSS modularization (57KB -> split files)                                  | Done   |
| Zustand state management (3 stores)                                       | Done   |
| Custom hooks (7 hooks extracted)                                          | Done   |
| PropertiesPanel decomposition (8 sub-editors)                             | Done   |
| Element factory (centralized creation)                                    | Done   |
| ErrorBoundary (crash recovery UI)                                         | Done   |
| JSDoc type definitions (shared/types)                                     | Done   |
| Electron safeStorage (credential encryption)                              | Done   |
| DOMPurify sanitization (XSS prevention)                                   | Done   |
| MIME-type validation (upload security)                                    | Done   |
| Rate limiting (sensitive endpoints)                                       | Done   |
| DRY rendering pipeline (element-renderers.js)                             | Done   |
| Socket.IO modularization (socket-handler.js)                              | Done   |
| EditorPage reduction (3400 -> 1475 LOC)                                   | Done   |
| Tailwind token hardening, route shell, live sync, and persistence locking | Done   |

## Known Limitations

### Export Limitations

- PPTX export rasterizes complex DOM-backed elements and unsupported chart
  variants for fidelity, so those exported objects are not always editable in
  PowerPoint. HTML and LaTeX raster fallbacks use local vendor assets where
  possible to avoid placeholder-only output.
- Present mode and standard HTML export still depend on CDN resources at
  runtime.
- `pptxtojson` is the only runtime parser; `pptx2json` remains in the isolated
  parser benchmark sandbox, not as a runtime fallback. `npm run test:pptx:corpus-metrics`
  keeps parser-relative semantic, per-deck, element-class, and production round-trip
  regression floors; `npm run test:corpus` is its compatibility alias. `npm run test:pptx:best-effort`
  adds the browser smoke without qualifying the importer. The separate, fail-closed
  11-deck importer qualification binds exact manifest names and SHA-256 values,
  captures best-effort native evidence, then requests a strict importer decision.
  `npm run test:pptx:strict` is its deprecated alias. Known EMF and native-node
  gaps can keep that truth gate blocked rather than presenting a false green result.
  Imported PPTX media uses SHA256 dedup, extension allowlisting, magic-byte
  checks, external media URL gating, worker startup ACK handling, `/api/pptx`
  upload rate limiting, a split mapper module tree under
  `server/services/pptx-import/mapper/`, and async import jobs with SSE
  progress/cancel support.

### Future Backlog

- Timeline as a first-class element: deferred to a separate P2 plan; current
  timeline slide template and fragment animation timeline remain unchanged.
- Plugin runtime Phase 1 is shipped for local/self-hosted bundled plugins:
  read-only discovery API, sandboxed canvas rendering, Insert ribbon entry,
  persisted `plugin:*` elements, and static export fallback. Marketplace,
  install ZIP, billing/auth, plugin KV storage, and offline sandbox inlining
  remain deferred.

### Code Quality

- No full TypeScript migration. JSDoc types provide editor support, but not
  compile-time enforcement across the entire app.

### CI/CD

- GitHub Actions builds for Windows only; local electron-builder scripts cover Linux/macOS too.
- Vitest/Playwright suites remain the main regression gates.

## Completed Phases

### Gamification Game Controls (Complete - 2026-04-29)

11-phase implementation of interactive game elements for presentations.

**Sub-phases:**

1. Phase 1: Game element types foundation — 10 game types (name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, scattergories, poll, word-cloud, matching), `createGameElement`/`createQuestion`/`createTeam` factories, placeholder renderer, 68 unit tests added
2. Phase 2: Backend game engine — Socket.IO room management (`server/services/game-room-manager-singleton-service.js`, `server/routes/games-rest-api-handler.js`), random picker, leaderboard, scoring, team management, timer/question lifecycle
3. Phase 3: Canvas renderer — SVG previews for all 10 game types (wheel, bomb, Jeopardy board, corner grid, relay baton, trophy, letter grid, poll, word cloud, matching) with `GameElementRenderer.jsx`
4. Phase 4: Game properties panel — Content/Display/Scoring tabs with team config, question list, timer, difficulty, colors, scoring rules, bonus/penalty settings
5. Phase 5: Toolbar integration — InsertMenu "Games" category with icon grid for all 10 types, `createGameElement` wired to EditorPage insert handler
6. Phase 6: Player join page — `/player/:slideId/:elementId` route, `game-player-join-page.jsx`, `useGameSocket` hook, Socket.IO connection, team assignment, spectator mode
7. Phase 7: Interactive wheel spin, confetti burst, hot-potato bomb animation, timer ring countdown
8. Phase 8: Jeopardy board — 5 categories, 5 questions each, dollar values 100-500, reveal animation, double-jeopardy + final round
9. Phase 9: Four-corners room picker, scattergories letter generator with timer, suspense selection effects
10. Phase 10: Relay race timer, trivia podium leaderboard, streak bonuses, penalty system
11. Phase 11: Integration tests — room lifecycle, Socket.IO events, leaderboard, scoring, timer, team management, player join/leave, SVG rendering, properties panel

**Files created:** `client/src/constants/game-element-types-constants.js`, `client/src/components/canvas/element-renderers/game-element-placeholder-renderer.jsx`, `client/src/components/canvas/element-renderers/game-element-renderer.jsx`, `client/src/components/properties/game-properties.jsx`, `client/src/pages/game-player-join-page.jsx`, `client/src/hooks/use-game-socket.js`, `server/services/game-room-manager-singleton-service.js`, `server/routes/games-rest-api-handler.js`

**Files modified:** `client/src/data/element-defaults.js`, `client/src/components/canvas/element-renderers/registry.js`, `client/src/components/InsertMenu.jsx`, `client/src/components/EditorMenuBar.jsx`, `client/src/App.jsx`, `client/src/stores/editor-store.js`, `server/index.js`

**Status:** Complete — 2026-04-29

### Phase 1 - Controls UX: Critical Fixes (Complete - 2026-04-16)

PowerPoint-parity keyboard shortcuts and Selection Pane.

**Plan:** `plans/260416-1750-powerpoint-parity-controls/`

### Phase 2 - Security Architecture Refactor (Complete - 2026-04-18)

Four-part refactor driven by adversarial review findings.

**Sub-phases:**

1. Security patches - XSS prevention, DOMPurify, MIME validation, rate limiting, POST migration
2. DRY cleanup - Element factory, Socket.IO extraction, rendering pipeline unification
3. Component decomposition - EditorPage modals extracted, Zustand stores, custom hooks, PropertiesPanel sub-editors
4. Infrastructure - Zod validation, CSS split, JSDoc types, Electron safeStorage, ErrorBoundary

**Plan:** `plans/260418-1056-security-architecture-refactor/`

### Phase 7 - Tailwind Refactor Hardening Verification (Complete - 2026-04-23)

Validation pass for the token-backed Tailwind UI, route shell, notes
normalization, live socket contract, storage locking, and E2E stability.

**Plan:** `plans/20260423-2151-tailwind-refactor-hardening-verification/`

### Phase 8b - UI/UX Tailwind Hard Mode Remediation (Complete - 2026-04-25)

19 fixes across 5 phases: slide index badge visibility (C-02), shared color
config module (C-04), sidebar layout/vertical scale/popup overflow/onClick/emoji
(H-01..H-05), ghost active state/search clear/undo-redo/swatch border/date
locale/delete disabled/modal z-index (M-01..M-08), placeholder color/scrollbar
light theme/ARIA palette/context menu keyboard nav (T-01, T-04, A-02, A-03).
All 130 tests pass, production build succeeds.

**Plan:** `plans/260425-0455-ui-ux-tailwind-fix-hard/`

### Phase 8a - Tailwind UI/UX Review Remediation (Complete - 2026-04-24)

Closed accepted Medium findings from the Tailwind UI/UX review and fixed touched/global Low-risk control accessibility items.

**Plan:** `plans/20260424-0619-tailwind-ui-ux-review-remediation/`

### Phase 9 - PPTX Parser Benchmark (Complete - 2026-04-24)

Benchmarked 4 JavaScript `.pptx` parser candidates against 4 real decks / 145 slides. Result: go for follow-up editable import planning with `pptxtojson` primary and `pptx2json` raw fallback.

**Plan:** `plans/20260424-1508-pptx-parser-benchmark-hard/`

### Phase 10 - Editable PPTX Import Phase 1 (Complete - 2026-04-24)

Shipped server-side editable `.pptx` import using `pptxtojson@2.0.2`, with
`pptx2json@0.0.10` as metadata fallback inspector only. Current mapper support
includes text, images, basic shapes/lines, tables, native chart output when the
parser exposes chart data, and flattened SmartArt/diagram data. Unsupported
equations, OLE, and complex objects degrade to placeholders or warnings.

**Plan:** `plans/260424-1841-pptx-import/`

### PPTX Round-trip Harness Unification (Complete - 2026-04-25)

Unified the round-trip harness with the production export pipeline. At the time,
strict mode required production export and used a ≥95 semantic / ≥98 round-trip
gate; latest 4-deck corpus result: 97.0% semantic fidelity, 99.0% round-trip
stability. Current strict thresholds are documented in the active export
limitations section above.

**Plan:** `plans/260425-1802-unify-roundtrip-harness/`

### Trusted Hardening Without HTML Embed Regression (Complete - 2026-04-26)

Completed hardening plan focused on correctness/privacy/security issues while
preserving HTML embed as trusted programmable content.

**Delivered:**

- analytics share-token gate and storage-locking updates
- live presenter anti-hijack via `presenterToken`
- AI custom endpoint SSRF guard + outline schema checks
- client finite-number + settings/live fetch guardrails
- import/export warning + cache-finalizer reliability fixes
- targeted text/markdown/svg/shape-text safety with no blanket HTML embed sanitize
- cross-phase E2E regressions for analytics, live takeover rejection, and trusted embed execution

**Verification:** `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build` passed.
`k6` load tests were prepared but not run because `k6` is not installed.

**Plan:** `plans/260426-1129-trusted-hardening-without-html-embed-regression/`

### E2E Testing Hardening With Stable Selectors (Complete - 2026-04-26)

Completed full E2E hardening plan for selector stability, lifecycle/failure
coverage, POM maintainability, and CI-friendly visual regression.

**Delivered:**

- selector contract in `docs/code-standards.md` (semantic selectors first,
  targeted `data-testid`, frozen canvas IDs)
- stable property control test IDs across common/shape/image/chart/code/table/misc panels
- new API-backed E2E suites for property persistence and lifecycle/error paths
- autosave error state (`Save failed`) plus explicit `Retry` UX path
- EditorPage POM split into helper modules with preserved public methods
- deterministic Playwright screenshot baseline test and snapshot asset
- E2E suite baseline is now 127 tests in 27 files (`npx playwright test --list`)
- full gates green: lint, unit, targeted E2E, full E2E, and repeat-each flake pass

**Plan:** `plans/260426-1708-e2e-testing-hardening-stable-selectors/`

### PPTX Import Coordinate Fidelity Hardening (Complete - 2026-04-27)

Completed full execution plan `260426-2128-pptx-import-coordinate-fidelity-hardening`.

**Delivered:**

- new pure geometry helper module (`server/services/pptx-import/geometry.js`)
- drift-focused unit suites (`geometry.test.js`, `geometry-drift.test.js`)
- property hardening coverage (`property-mapping.test.js`)
- matrix-based group/line transform coverage (`group-transform.test.js`)
- corpus harness by-type drift/property/count metrics + generated-fixture gates
- import summary severity buckets (`exact/approximated/placeholder/failed`)
- focused e2e import fidelity verification (`tests/e2e/pptx-import-fidelity.spec.js`)

**Verification:** lint, targeted/import suites, strict corpus run, targeted Playwright import flow, and production build passed.

**Plan:** `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/`

### Design-Token System, Theme Gallery, FX Backgrounds, Design Ideas (Complete - 2026-05-31)

Full design-system layer from `plans/260530-2219-html-ppt-skill-native-integration`.

**Delivered:**
- `shared/src/design-tokens.js`: `DEFAULT_TOKENS`, `AUTO_FIELD_MAP`, `resolveAutoColor`, `tokensToCssVars`, `tokensToStyleObject`, `mergeTokens`, `presentationUsesTokens`
- `shared/src/theme-presets.js`: 39 token presets across 7 categories
- `shared/src/fx/`: 8 animated canvas FX modules + registry (`buildFxRuntimeScript`)
- Layout library expanded to 35 layouts across 6 category modules
- Design Ideas engine: `analyze-slide.js` + `suggest.js` + `design-ideas-panel.jsx`
- Design ribbon tab: Themes, Background (color/gradient/image/fx/none), Slide Size, Footer, Navigation

**Plan:** `plans/260530-2219-html-ppt-skill-native-integration/`

### Ribbon UI Polish (Complete - 2026-05-30)

PowerPoint familiar-feel gaps closed from `plans/260530-1647-editor-powerpoint-familiar-feel-ui-polish-tdd`.

**Delivered:**
- Contextual Format tab via `ui-store.formatContext`; `effectiveTab` guard prevents empty-panel flash
- `RibbonBigButton` component for icon-over-label primary actions
- `StatusBar` zoom range slider bound to `ui-store.zoom`; view switcher via `editor-store.viewMode`
- Responsive `StatusBar.jsx` (hidden sm:inline-flex attribution, min-w-0 truncate)

**Plan:** `plans/260530-1647-editor-powerpoint-familiar-feel-ui-polish-tdd/`

### EditorPage Hardening Refactor (Complete - 2026-05-29)

TDD refactor from `plans/260529-2256-editorpage-hardening-refactor-tdd`.

**Delivered:**
- EditorPage: 2071 → ~1356 LOC; modal flags centralized in `ui-store`
- `EditorModals.jsx` + `editor-modals-secondary.jsx` extracted
- `use-element-creation`, `use-export-actions`, `use-ai-actions` hooks extracted
- `active-slide-mapper.js`: vertical (child) slides first-class across all write paths
- AI slide generation replaced with local `buildSlidesFromOutline` + `ai-slide-contract.js`

**Plan:** `plans/260529-2256-editorpage-hardening-refactor-tdd/`

### E2E Cleanup and Coverage (Complete - 2026-05-24)

8-phase E2E hardening from `plans/260524-0959-e2e-cleanup-and-coverage-tdd`.

**Delivered:** Removed all `waitForTimeout` calls, full `data-testid` selector catalog, state-based waits, coverage specs for smart guides/clipboard/Selection Pane, PPTX export/Markdown import/rclone E2E, game shortcut coverage, visual matrix, kebab-case page objects, 200-LOC spec guard.

**Plan:** `plans/260524-0959-e2e-cleanup-and-coverage-tdd/`

### Full Feature Verification Gap Closure (Complete - 2026-05-31)

Release-confidence plan for editor-core and high-risk extended domains.

**Delivered:** Baseline gap reporting with deterministic JSON/Markdown evidence; editor-core matrix tightened to 100/100 PASS with 0 ALLOWED entries and 0 orphan tags; critical Playwright journeys for create/edit/persist/export HTML, share password/revoke, live reconnect/authz, and PPTX import/edit/export artifact inspection; extended domain capability inventory for export/import/live/share/AI/game/sync/history; CI gate verification report, k6 loopback destructive preflight, release-confidence lane docs, and manual smoke checklist.

**Plan:** `plans/260531-0511-full-feature-verification-gap-closure-tdd/`

### PPTX Import Unit Conversion and Scale Fixes (Complete - 2026-05-25)

7-phase PPTX fidelity from `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes`.

**Delivered:** `ptToCanvasPx` helper, CSS unit normalization, image filter fractions, gradient stop fixes, grouped-element AABB fix, stacked/area chart rendering, EMF/WMF placeholders, table font/border fidelity, shape `foreignObject` text, text inset conversion.

**Plan:** `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/`

### PPTX Import Review (Complete - 2026-05-24)

9-phase review from `plans/260524-1729-pptx-import-review`.

**Delivered:** Async import jobs with SSE progress/cancel, mapper split into `server/services/pptx-import/mapper/` submodules, SHA256 media dedup via `upload-hashes.json`, table border preservation, 10-deck strict corpus (`n=10`, 100.0% semantic, 99.0% round-trip).

**Plan:** `plans/260524-1729-pptx-import-review/`

### Phase 3 - Testing & CI Quality Gate (Complete)

Established test coverage for critical paths and introduced linting/formatting.

**Tasks Completed:**

- Unit tests for `htmlGenerator.js`
- Vitest workspace configuration
- Playwright E2E suite (`tests/e2e/`)
- ESLint + Prettier configuration

### Phase 4 - Export Completeness & Templates Expansion (Complete)

Fixed offline export rendering and expanded the template gallery.

**Tasks Completed:**

- Robust offline HTML export with protocol-agnostic iframe initialization
- Fixed PDF printing rendering for embedded HTML
- Added interactive and quiz templates, plus a larger built-in template gallery

### Phase 5 - Pro Features Integration (Complete)

Integrated professional-grade features based on competitive analysis.

**Tasks Completed:**

- Interactive product tour via React-Joyride
- Native line and arrow drawing tools on canvas
- Global presentation settings management pane
- Upgraded Markdown import with advanced slide attributes
- Full-deck template gallery on the homepage

### Phase 6 - Progressive Tailwind Migration (Complete)

Transitioned the application from legacy vanilla CSS to a TailwindCSS
foundation.

**Tasks Completed:**

- Configured the project-wide design system in Tailwind.
- Refactored `SlideCanvas` to keep the presentation surface visually isolated
  while supporting light and dark app chrome.
- Standardized typography and UI elements.
- Executed via a zero-regression, TDD-driven approach.

### Phase G - Command Layer Unification (Complete - 2026-04-28)

Refactored clipboard operations (copy/cut/paste/duplicate) to pure functions in `use-clipboard.js`. `SlideCanvas` no longer owns keyboard listeners or clipboard state. `handleUndo`/`handleRedo` wrapped in `useCallback`. Deprecated `use-history.js` removed (logic inlined into `EditorPage`). Unit test added in `use-clipboard.test.js`. SlideCanvas reduced by 79 LOC.

**Commit:** `3107731`

### Phase H - Anime.js Integration for UI & Live Overlays (Partial - 2026-05-17)

Added Anime.js template selector modal for animation presets. Core Anime.js runtime integration for UI and live overlays deferred.

**Delivered:**
- `anime-js-animation-template-selector-modal.jsx` component for animation template selection

**Deferred (future enhancement):**
- UI editor animations (modal entrance/exit, toolbar stagger, timeline feedback)
- Live overlay animations (cursor dot spring physics, laser pointer glow, annotation drawing)
- No changes to reveal.js, fragment system, or HTML generation pipeline

**Status:** Template selector complete — runtime hooks deferred to P2

**Current animation system:** Reveal.js 5.1.0 powers all slide transitions (6 types) and fragment animations (12 built-in CSS classes). Client UI uses only Tailwind CSS transitions. Live presentation overlays use raw CSS `transition` properties. No Framer Motion, GSAP, or anime.js runtime integration yet.

**Anime.js context:** v4.3.6 (Feb 2026), ~67.5k GitHub stars, MIT. API: `import { animate, stagger } from 'animejs'`. Bundle: ESM/UMD/CJS/IIFE. Pros: tiny footprint, clean API, CSS/SVG/JS animation. Cons: fewer features than GSAP, smaller community.

**Status:** Template selector modal complete — runtime integration deferred

**Tasks — Hướng 1: UI Editor Enhancement:**

- Install `animejs` in `client/package.json` (npm workspace dev dependency)
- Create `client/src/hooks/use-anime-ui.js` — reusable hook for editor UI animations:
  - Modal entrance/exit (slide + fade, scale effects, replacing Tailwind `animate-zoom-in`/`animate-fade-in`)
  - Toolbar button hover stagger animations
  - `AnimationTimeline` drag feedback (element snap animation on drop)
  - RemoteControlPage button press feedback
- Replace `LiveViewPage.jsx` cursor dot CSS `transition: all 0.08s linear` with `animate()` + spring easing
- Replace `LiveViewPage.jsx` laser pointer CSS `transition: all 0.05s linear` with `animate()` + glow pulse
- No changes to reveal.js, fragment system, or HTML generation pipeline

**Tasks — Hướng 2: Live Presentation Overlay Enhancement:**

- Create `client/src/hooks/use-anime-overlays.js` — hook for live presentation overlay animations:
  - Cursor dot animation with spring physics (replacing CSS transitions)
  - Laser pointer with radial glow pulse effect
  - Annotation SVG path drawing animation (stroke-dasharray/dashoffset via anime.js)
  - Viewer count badge entrance/exit animations (join/leave)
  - Connection status transitions
- All overlays are viewer-side React components, completely isolated from reveal.js iframe
- Socket.IO data flow unchanged (only the visual presentation layer is enhanced)

**Files to modify:** `client/package.json`, create `client/src/hooks/use-anime-ui.js`, create `client/src/hooks/use-anime-overlays.js`, modify `LiveViewPage.jsx`, modify `RemoteControlPage.jsx`, modify modal components as needed.

**Files NOT modified (zero disruption):** `shared/src/htmlGenerator.js`, `shared/src/element-renderers.js`, `TransitionPreview.jsx`, `AnimationTimeline.jsx`, `AnimationPreviewModal`, reveal.js configuration.

**Estimated scope:** Low — isolated hooks, no shared state changes, no reveal.js modifications.

**Priority:** Enhancement only (Phase H does not block any other phase). Defer until after current active work.

**Status:** Planned — not started

### Phase C - SlideCanvas Decomposition (Complete - 2026-04-27)

Break down the remaining large component.

**Delivered:**

- SlideCanvas reduced from 2759 → 841 LOC (target was <=1200, exceeded)
- 15 element renderers extracted to `canvas/element-renderers/` (registry-based dispatch)
- `CanvasElement` wrapper (128 LOC) for selection/rotation/crop handles
- `CropOverlay` (139 LOC) extracted
- Chrome: grid, rulers (120 LOC), zoom controls, footer overlay
- Interaction hooks: snapping helpers, rubber-band drag, resize-rotate
- Phase 3: canvas pointer interaction (283 LOC)

**Plan:** `plans/260427-0900-deep-feature-hardening-master-plan/`

### Phase D - CI/CD (Lower Priority)

**Tasks:**

- Add Linux and macOS build targets to GitHub Actions
- Add test step to CI before build
- Publish release artifacts to GitHub Releases automatically on tag push
- Add Docker image publish to GitHub Container Registry (ghcr.io)

### Phase E - Advanced PPTX Import Fidelity (High Priority)

Improve beyond Phase 1 editable `.pptx` import. Production importer exists for
text, images, shapes, and tables; advanced PowerPoint object fidelity remains
future work.

**Tasks:**

- Improve grouped object handling without losing editability
- Add chart/SmartArt/OLE/equation strategies only after separate validation
- Expand rich text style mapping for fonts, bullets, and theme colors
- Add more fixture-driven visual regression coverage for imported decks

### Deep Feature Hardening Master Plan (Complete - 2026-04-27)

Full execution of `plans/260427-0900-deep-feature-hardening-master-plan/`.

**Delivered (Phases 0-5):**

- Phase 0: Baseline audit (SlideCanvas LOC count, command layer state, test inventory)
- Phase 1: Command layer cleanup (inline clipboard/keyboard removed from SlideCanvas)
- Phase 2: Canvas render decomposition (15 renderers extracted, registry dispatch, 841 LOC achieved)
- Phase 3: Canvas chrome + interaction extraction (hooks + chrome components isolated)
- Phase 4: Custom shortcut registry (`shortcut-registry.js`, `shortcut-storage.js`, `shortcut-normalizer.js`, 95 tests)
- Phase 5: PPTX import fidelity hardening (SmartArt fix, chart metadata, 20-unit test suite, 168 pptx-import tests)
- Phase 6: Slide Master — **Deferred** (20 slide layouts exist, `showMasterPanel` reserved but never wired, demand not validated)
- Phase 7: PDF editable spike — **Deferred** (P2, needs packaging decision)
- Phase 8: Analytics — **Deferred** (P2, needs privacy/retention rules decision)

**Verification:** 510 tests pass, lint clean, build succeeds.

**Plan:** `plans/260427-0900-deep-feature-hardening-master-plan/`

### Ribbon UI Migration (Complete - 2026-05-17)

Replaced legacy toolbar/menu system with tab-based ribbon interface.

**Delivered:**
- `RibbonHeaderBar` with 6 tabs: Home, Insert, Design, Transitions, Animations, View
- `RibbonPanel` with tab-specific controls
- Active tab state in `ui-store.activeTab` with localStorage persistence
- Removed: `Toolbar.jsx`, `InsertMenu.jsx`, `EditorMenuBar.jsx`
- Updated: `EditorPage.jsx`, `QuickAccessToolbar.jsx`, `ProductTour.jsx`

**Verification:** Lint, unit tests, E2E tests passed

### Parallax Feature Port (Complete - 2026-05-17/18)

Ported upstream parallax features and enhancements.

**Delivered:**
- TipTap extensions: `tiptap-font-weight-extension.js`, `tiptap-line-height-extension.js`
- Timeline element type with renderer
- Video URL/trim/speed controls
- LaTeX rendering improvements
- Fragment animation options expansion
- File browser modal
- Template selector modals: kinetic text, parametric math grid, Three.js 3D scene, Anime.js
- Server route extraction: `presentations.js` from `index.js`
- Upload deduplication via SHA256

**Files added:** Multiple new modals, extensions, and element renderers
**Files modified:** `element-renderers.js` (+150 LOC), shared package tests

**Verification:** Build, lint, unit tests passed

### Local Plugin Runtime Phase 1 (Complete - 2026-05-20)

Implemented scoped self-hosted plugin runtime from
`plans/260520-1430-port-plugin-runtime-from-parallax/`.

**Delivered:**

- Read-only `/api/plugins` API with bundled/user plugin discovery and safe
  `dist/` asset serving.
- Client plugin registry/loader for `plugin:*` element types.
- Sandboxed canvas iframe runtime with `allow-scripts` only and source-checked
  message bridge.
- Insert ribbon plugin action and bundled `Animated Counter` sample plugin.
- Shared reveal/print renderer fallback so plugin elements do not disappear in
  share/export/PDF paths.

**Deferred:** marketplace, install ZIP, billing/auth, plugin KV storage,
property panel extensions, and offline sandbox asset inlining.

## Non-Roadmap Items

These are explicitly out of scope:

- Real-time multi-user collaboration
- Cloud-hosted SaaS version
- Mobile / tablet editing interface
- Plugin / extension marketplace and install flow
