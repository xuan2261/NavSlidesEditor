# Project Changelog

## v1.7.x

## 2026-05-17

- Completed Phase 04 parallax present-mode fixes: generated reveal HTML now links `reveal-overrides.css`, resets section line-height/overflow, present HTML embeds use `data:text/html` iframes with app-origin `<base>` instead of `srcdoc`, and regular LaTeX present rendering uses direct `data-math-latex` hooks while print/TikZ iframe paths remain intact.
- Added/updated regression tests for reveal overrides, trusted HTML data URL embeds, local asset resolution in embeds, direct KaTeX present rendering, offline override inlining, and parallax export decoding. Verification passed: focused Vitest renderer/offline sweep, `npm run lint`, `npm run build`, and targeted parallax Playwright E2E.
- Fixed parallax feature port review blockers from `plans/parallax-features-port/port-features-from-parallax-presentations-plan.md`: wired TipTap font weight/line height extensions into the editor toolbar, made URL video playback use `videoUrl` in canvas and export, and added timeline compatibility for both plan schema (`timelineStart`/`timelineEnd`/`events`) and existing implementation schema (`startDate`/`endDate`/`items`).
- Hardened upload/file browser flow: SHA-256 dedup hash writes now use the existing storage file lock, file browser lists both hash-indexed and presentation-referenced uploads, and uploaded files can be deleted from the browser with hash-index cleanup.
- Completed missing modal template coverage for Kinetic Text, Math Grid, Anime.js, and Three.js selectors to match planned template counts.
- Added regression coverage for URL video canvas rendering, timeline plan-schema export, file browser deletion, and modal template options.
- Verification passed: targeted Vitest (9 files / 60 tests), file browser focused Vitest (1 file / 9 tests), `npm run lint`, and `npm run build`.
- Closed remaining parallax test gaps: made the parallax E2E/UI assertions mandatory instead of conditional, added full reveal export/persistence coverage for font weight, line height, URL video trim/speed, timeline, and image citations, and replaced upload dedup simulation with route-level tests.
- Fixed two runtime integration blockers found by stricter E2E: `timeline` is now accepted by API validation and has editor element defaults, so Insert menu creation and save/load both work.
- Full verification passed: `npm run lint`, `npm run build`, `npm run test` (118 files / 1030 tests), `npm run test:e2e` (169 tests), and `npm run test:corpus` (4 PPTX files). Load tests not run because `k6` is not installed in local PATH.

## 2026-05-14

- Implemented scoped upstream-inspired ports from `plans/260514-1024-upstream-feature-audit-and-port-roadmap/`: reveal/print text spacing now uses fixed px spacing, HTML embed print output keeps trusted author content through `data-pdf-iframe`, LaTeX/TikZ elements expose font size/color controls with canvas/export parity, reveal-supported `strike` fragment option is selectable, video elements support start/end trim and playback speed in canvas/export, and `.ogv` uploads are accepted/listed as video media.
- Deferred upstream timeline element and plugin/Manim architecture to separate go/no-go epics; neither was implemented in the sync branch.
- Fixed the PPTX corpus semantic fidelity harness for flattened grouped source elements. Strict corpus now passes at 98.0% semantic fidelity and 99.0% round-trip stability.
- Verification passed for the upstream port branch: targeted Vitest (4 files / 22 tests), corpus harness regression test, `npm run lint`, `npm run build`, full Vitest (106 files / 935 tests), targeted Playwright (9 tests), full Playwright (155 tests), and strict corpus.
- Completed selective upstream port plan `plans/260514-1045-upstream-main-selective-port-workflow/`: avoided unrelated-history merge and ported only the Copy URL context menu feature from upstream concept `93816b88`.
- Added `Copy URL` to image/video right-click context menu. Copies `http(s)`, `blob:`, `data:`, protocol-relative, and browser-relative media URLs after safe normalization; blocks executable/unsupported schemes.
- Hardened clipboard behavior so synchronous clipboard failures and rejected clipboard promises do not crash or leave the menu stuck open.
- Stabilized Vitest file execution for storage-backed server route tests by disabling file-level parallelism; this removes the shared `server/data` race seen in full-suite runs.
- Verification passed on `master`: `npm run lint`, `npm run build`, `npm run test` (105 files / 922 tests passed), and targeted Playwright regression sweep (31 passed on sync branch).

## 2026-05-13

### UI/UX Warm Editorial Overhaul Slice

- Added shared `ModalShell` with ARIA dialog semantics, Escape/backdrop close, focus entry/trap/restore, and viewport-safe sizing.
- Migrated `SyncModal`, `HistoryModal`, Home create modal, and Home confirm dialog to the shared shell.
- Migrated AI generator, AI copywriter, AI translate, share, media library, and template picker modals to `ModalShell`; added wide shell sizing and alert/status semantics for migrated async feedback.
- Replaced Share/Media modal async `alert()` / console-only error paths with inline alert/status feedback.
- Updated HomePage and Explore dashboard surfaces to warm tokenized branding, removed layout-shifting hover in touched card paths, and added keyboard activation plus import alert/status feedback.
- Refined DropdownMenu, InsertMenu, FindReplaceBar, CollapsibleSection, SlidePanel, and SelectionPane surfaces for better focus/label feedback without changing command logic.
- Tightened editor chrome a11y: stateful toolbar toggles and active rich-text commands now expose `aria-pressed`, slide background swatches are keyboard reachable and labelled, the highlight palette uses `listbox`/`option` semantics, `PropertiesPanel` is labelled as `role="complementary"`, and shared property lock/layer actions now use Lucide icons instead of structural emoji/glyph arrows.
- Added `ModalShell` and `CollapsibleSection` unit tests, including Escape-close coverage after modal rerenders.
- Fixed a shared Escape-close regression in `useEscapeClose` where async modal rerenders could briefly detach the document listener.
- Verification passed: targeted Vitest, `npm run lint` (existing warnings in `tests/e2e/games/game-elements.spec.js`), `npm run build` (existing bundle size warning), dashboard e2e 11/11, visual regression 1/1, and responsive/keyboard Playwright gate 10/10.

## 2026-04-30

### PowerPoint-Style Controls & Game Presenter Shortcuts

**Phase 1 - Slideshow Controls:**
Added 9 PowerPoint-style slideshow shortcuts: F5/Shift+F5 (start), ArrowLeft/Right, Home/End (navigate), B/W (black/white overlay), Escape (end). Extended `createKeyboardHandler` with scope system (`editor`/`presentation`), standalone key support, and scope-based dispatch. Created `BlackScreenOverlay` component. Fixed broken import path in `name-picker-interactive-game-renderer.jsx`.

**Phase 2 - Game Presenter Shortcuts:**
Added 12 game presenter shortcuts with scope `presentation-game`: G (HUD), Space (timer), Enter (next phase), R (reveal), L (leaderboard), P (pause), +/- (timer adjust), 1-4 (team select). Created `game-shortcut-config.js` with per-game-type shortcut mapping. Created `GameHudOverlay` and `GameLeaderboardOverlay` components.

**Phase 3 - Editor Enhancements:**
Added 11 editor shortcuts: Ctrl+M (insert slide), Ctrl+G/Ctrl+Shift+G (group/ungroup), Ctrl+]/[ (z-order), Tab/Shift+Tab (cycle selection), Ctrl+0/+/- (zoom), Ctrl+K (command palette). Added zoom state/actions to `editor-store.js`. Created `use-element-cycle.js` and `CommandPalette.jsx` component.

**Phase 4 - Touch Gesture Layer:**
Created `use-touch-gestures.js` (tap, double-tap, long-press, drag via Pointer Events), `use-swipe-navigation.js` (swipe left/right/down), `use-pinch-zoom.js` (2-finger pinch zoom [0.25-4.0]), `PresentationTouchOverlay.jsx` (3-zone touch overlay). 20 tests pass.

**Phase 5 - Annotation Tools:**
Created annotation system for presenter mode: `AnnotationCanvas.jsx` (SVG-based freehand drawing), `LaserPointer.jsx` (animated cursor), `AnnotationToolbar.jsx` (pen/laser/highlighter/eraser selector), `annotation-colors.js`. Added 4 annotation shortcuts to registry (Ctrl+P/Ctrl+I/Y/E).

### Annotation Persistence (Phase 1)

**Annotation real-time sync:** Annotations drawn by presenter in `SpeakerViewPage` now sync to all viewers in `LiveViewPage` in real-time via Socket.IO. Per-slide annotation storage (keyed by `slideIndex`) ensures each slide retains its own annotation layer.

**Room survival on presenter disconnect:** `leaveRoom` sets `presenterId = null` instead of deleting the room, preserving all annotations and timer state. Viewers remain connected during presenter rejoin.

**Socket.IO events:**

- `annotation:add` / `annotation:remove` / `annotation:clear` (presenter emits)
- `annotation:removed` / `annotation:cleared` (server broadcasts to room)
- `annotations:sync` (full slide annotations sent on viewer join)
- `presenter-disconnected` (replaces `presenter-left`)

**REST endpoint:** `GET /api/live/room/:code/annotations?token=PRESENTER_TOKEN` allows presenter rejoin to fetch persisted annotations.

**New hook:** `useAnnotationSync` consumes annotation events in React components, filtering by current slide index. Viewers render annotations as an SVG overlay; presenters emit events from the annotation canvas toolbar.

**Files created:** `useAnnotationSync` hook, `annotation-colors.js`, `AnnotationCanvas.jsx`, `AnnotationToolbar.jsx`, `LaserPointer.jsx`.

### Server-Authoritative Timer Sync (Phase 2)

**Server-authoritative model:** Game timers store `endedAt` timestamp on the server. Clients compute remaining time locally via `computeTimerRemaining(endedAt)`, eliminating clock drift.

**Timer lifecycle events:** `game-timer-start`, `game-timer-pause`, `game-timer-resume`, `game-timer-adjust`, `game-timer-stop`.

**Socket.IO events:** `timer:sync` (full state broadcast on join/change), `timer:ended` (server emits when a timer reaches zero).

**Iframe bridge:** `window.__timerStates` exposes timer state to game renderers running inside the reveal.js iframe, enabling game UI to reflect live timer values without a direct socket connection.

**Context architecture:** `TimerContext` + `LiveSocketContext` share timer and socket state across the presenter surface. Keyboard shortcuts (`+`/`-` for adjust, `Space` for start) are wired through `LiveSocketContext`.

**Input validation:** Timer delta capped at ±3600s, duration validated 1-7200s, elementId validated by regex + length check.

### Command Palette Scope (Phase 3)

CommandPalette is editor-only. It renders only inside `EditorPage`. `LiveViewPage` does not mount the palette. Presentation-mode palette was considered but deferred (YAGNI).

**Files modified:** updated `useAnnotationSync` tests, REST route tests, socket-handler tests, and live-rooms tests.

## v1.6.x

## 2026-04-29

- Completed Gamification Game Controls feature (Phases 1-11):

  **Phase 1 - Game Element Types Foundation:**
  Added `game` element type with 7 game types (name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, scattergories). Created `game-element-types-constants.js` with `GAME_TYPES`, `DEFAULT_GAME_COLORS`, `createGameElement`/`createQuestion`/`createTeam` factories. Created placeholder renderer `game-element-placeholder-renderer.jsx`. Registered renderer in `registry.js`. Added `ELEMENT_DEFAULTS.game` and `DEFAULT_POSITIONS.game` in `element-defaults.js`.

  **Phase 2 - Backend Game Engine:**
  Added Socket.IO room management for game sessions (`server/services/game-room-manager-singleton-service.js`, `server/routes/games-rest-api-handler.js`), random picker with weights, leaderboard generation, scoring, team management, timer/question lifecycle, and game state persistence. REST endpoints: `POST/GET/DELETE /api/games/:sessionId`, `POST /api/games/:sessionId/join`, `POST /api/games/:sessionId/action`, `GET /api/games/:sessionId/leaderboard`, `DELETE /api/games/:sessionId/leave`.

  **Phase 3 - Canvas Renderer with Static SVG Previews:**
  Added `GameElementRenderer.jsx` with SVG previews for all 7 game types: spinning wheel (name-picker), ticking bomb (hot-potato), Jeopardy board (jeopardy), corner grid (four-corners), relay baton (relay-race), trophy (trivia-champ), letter grid (scattergories). Integrated into canvas element registry. Element defaults and positions updated.

  **Phase 4 - Game Properties Panel:**
  Added Content/Display/Scoring tabbed properties panel for game elements. Content tab: game type selector, team count/names, question list with add/edit/delete, timer duration, difficulty, topic tags, auto-advance toggle. Display tab: primary/secondary/accent colors, background, font, show answers toggle, custom rules text. Scoring tab: points per difficulty, bonus multipliers, streak bonus, penalty settings, tiebreaker rules. Backed by `game-properties.jsx`.

  **Phase 5 - Toolbar Integration:**
  Integrated game element insertion via `InsertMenu.jsx`. Added "Games" category with icon grid for all 7 game types. `createGameElement` factory wired to `EditorPage` insert handler. Default element sizes set per game type.

  **Phase 6 - Player Join Page:**
  Added `/player/:slideId/:elementId` route with `game-player-join-page.jsx`. `useGameSocket` hook manages Socket.IO connection, join flow (name + optional team selection), connection status, and session state. Team assignment, spectator mode, and game element ID validation implemented.

  **Phase 7-10 - Interactive Renderers:**
  - Phase 7: Wheel spin animation (CSS keyframes + SVG, pointer-based landing), confetti burst on selection, player list with avatars, timer ring countdown, hot-potato bomb SVG with fuse animation
  - Phase 8: Jeopardy board with 5 categories, 5 questions each, dollar values 100-500, reveal animation, double-jeopardy round support, final round with wagers
  - Phase 9: Four-corners room picker with corner icons, countdown timer, random selection animation with suspense effects, scattergories letter generator with timer, category display grid
  - Phase 10: Relay race timer with baton handoff animation, trivia champion leaderboard with podium display, score tracking with streak bonuses, penalty system

  **Phase 11 - Integration Tests:**
  Test suites cover: game engine room lifecycle, Socket.IO event handling, leaderboard generation, scoring calculations, timer behavior, team management, player join/leave flows, SVG preview rendering, properties panel interactions, and element creation factories.

- Files created (key): `client/src/constants/game-element-types-constants.js`, `client/src/components/canvas/element-renderers/game-element-placeholder-renderer.jsx`, `client/src/components/canvas/element-renderers/game-element-renderer.jsx`, `client/src/components/properties/game-properties.jsx`, `client/src/pages/game-player-join-page.jsx`, `client/src/hooks/use-game-socket.js`, `server/services/game-room-manager-singleton-service.js`, `server/routes/games-rest-api-handler.js`, game element test suites.
- Files modified: `client/src/data/element-defaults.js`, `client/src/components/canvas/element-renderers/registry.js`, `client/src/components/InsertMenu.jsx`, `client/src/components/EditorMenuBar.jsx`, `client/src/App.jsx`, `client/src/stores/editor-store.js` (game element insert handler), server `index.js` (game routes wired).

## 2026-04-29 (continued)

- Completed Phase 1 of Gamification Feature (Phase 1-11 total): Added `game` element type with 7 game types (name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, scattergories). Created `game-element-types-constants.js` with `GAME_TYPES`, `DEFAULT_GAME_COLORS`, `createGameElement`/`createQuestion`/`createTeam` factories. Created placeholder renderer `game-element-placeholder-renderer.jsx` (full rendering deferred to Phase 3). Registered renderer in `registry.js`. Added `ELEMENT_DEFAULTS.game` and `DEFAULT_POSITIONS.game` in `element-defaults.js`. 68 unit tests added (592 total tests passing).
- Files created: `client/src/constants/game-element-types-constants.js`, `client/src/components/canvas/element-renderers/game-element-placeholder-renderer.jsx`, `client/src/hooks/game-element-foundation.test.js`.
- Files modified: `client/src/data/element-defaults.js`, `client/src/components/canvas/element-renderers/registry.js`, `client/src/utils/tailwind-inline-style-audit.test.js`.

## 2026-04-28

- Completed Phase 1 command layer unification: clipboard operations (copy/cut/paste/duplicate) refactored to pure functions in `use-clipboard.js` (`createCopyOperation`, `createPasteOperation`, `createCutOperation`, `createDuplicateOperation`). `SlideCanvas` no longer owns keyboard listeners or clipboard state. `handleUndo`/`handleRedo` wrapped in `useCallback`. Deprecated `use-history.js` removed (history logic inlined into `EditorPage`). Unit test added in `use-clipboard.test.js`. SlideCanvas reduced by 79 LOC.
- Updated changelog with recent features and fixes covering AnimationPreviewModal, presenterToken hardening, command layer, PPTX export hardening, and UI/UX Tailwind remediation.

## 2026-04-27

- Completed command layer unification (Phase 1): `SlideCanvas` no longer owns clipboard/keyboard. `use-keyboard.js` refactored to `createKeyboardHandler` + registry-based dispatch.
- Completed canvas render decomposition (Phase 2): `SlideCanvas` reduced from 2759 → 841 LOC. Extracted 11 element renderers to `canvas/element-renderers/`, `CanvasElement` wrapper, `CropOverlay`, chrome components, and interaction hooks. Text/image/media/html/code renderers remain inline in `canvas-element-wrapper.jsx` due to TipTap/DOM coupling.
- Completed canvas chrome & interaction extraction (Phase 3): Grid, rulers, zoom, footer, context menu extracted to `canvas/` components. Pointer, resize, rotate, selection, snapping hooks created.
- Added custom shortcut registry (Phase 4): `shortcut-registry.js` (10 default shortcuts), `shortcut-storage.js` (localStorage persistence), `shortcut-normalizer.js` (key chord normalization). `use-keyboard.js` now resolves from registry with localStorage override support. Conflict detection prevents ambiguous bindings. SettingsPage now includes a Keyboard Shortcuts manager section with per-shortcut record/reset and conflict warning UI.
- Completed PPTX import fidelity hardening (Phase 5): Fixed SmartArt node positioning bug (`readCoord(node.left, node.x)` instead of array index), added connector preservation warning, extended `chart-output-to-navslides-mapper.js` with legend, axis titles, combo chart, 3D metadata. Added 20-unit chart metadata test suite.
- Added `AnimationPreviewModal` feature for slide transition and animation preview with `animation-preview-helpers.js` supporting fragment timing extraction and easing curve normalization.
- Hardened live presentation security: `POST /api/live/room` returns `presenterToken`; presenter socket join requires `presenterToken` and rejects takeover attempts.
- Improved command layer in `use-keyboard.js`: refactored to `createKeyboardHandler` + `useMemo` pattern for better memoization. Added locked-element guards to prevent cut/duplicate of locked elements. Added paste-on-empty-selection support for post-slide-change paste scenarios. Fixed stale closure bugs with `slideRef` and `clipboardRef`.
- Refactored `use-clipboard.js`: `performDuplicate` now uses `crypto.randomUUID()` for fresh IDs with +20/+20 offset. Added locked-element guard. Fixed null guards for slide elements.
- Completed PPTX export hardening (12 files, ~1781 lines): added `export-pptx-basic-renderers.js` (shape/text/image/line), `export-pptx-color-utils.js`, `export-pptx-fallback-renderer.js`, `export-pptx-html-parser.js`, `export-pptx-raster-capture.js`, `export-pptx-raster.js`, comprehensive test suites (`export-pptx-core.test.js`, `export-pptx-raster.test.js`, `exportPptx.test.js` with 257 lines).
- Removed deprecated `use-history.js` hook (history logic inlined into `EditorPage` as `handleUndo`/`handleRedo` callbacks).
- Applied UI/UX Tailwind hard mode remediation across 31 component files (19 fixes): consistent `data-testid` attributes, accessible labels, hover/focus states, spinner elements, modal title visibility, and form accessibility.
- Completed PPTX coordinate fidelity hardening plan `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/` in tests-first flow across all 7 phases.
- Added geometry normalization module `server/services/pptx-import/geometry.js` with nullish-safe numeric reads, line endpoint mode detection, clamp helpers, and affine transform utilities.
- Refactored `server/services/pptx-import/mapper.js` to consume shared geometry helpers, preserve `left/top = 0`, normalize absolute line endpoints into local wrapper coordinates, and switch imported image crop to canonical editor-native model (`imageW/imageH/imageOffsetX/imageOffsetY`) with `_pptxImportMeta.cropData` sidecar.
- Hardened grouped transform fidelity by replacing inline ad hoc math with matrix-based flattening and corner-bounds mapping; added grouped line endpoint transformation coverage.
- Added new PPTX import fidelity test suites:
  - `geometry.test.js`
  - `geometry-drift.test.js`
  - `property-mapping.test.js`
  - `group-transform.test.js`
  - `generated-fixtures.test.js`
- Extended corpus harness output contract with by-type metrics:
  - `geometryDrift.maxPx|medianPx|byType`
  - `propertyCoverage.overall|byType`
  - `elementCount.sourceByType|navByType`
- Added strict per-type gate logic for generated fixture decks (geometry drift thresholds + table/chart property coverage thresholds) while preserving existing strict global gates.
- Updated import warning summary to severity buckets (`exact`, `approximated`, `placeholder`, `failed`) without breaking existing Home import UX integration.
- Added focused Playwright import-fidelity flow `tests/e2e/pptx-import-fidelity.spec.js` covering real API import, canvas bbox sanity audit, property edit, autosave, and reload persistence.
- Verification passed:
  - `npm run lint`
  - `npm run test -- server/services/pptx-import client/src/components/properties/import-fidelity-properties.test.jsx`
  - `npm run test:corpus`
  - `npx playwright test tests/e2e/pptx-import-fidelity.spec.js`
  - `npm run build`

## 2026-04-26

- Completed trusted hardening plan `plans/260426-1129-trusted-hardening-without-html-embed-regression/` with explicit invariant: HTML embed remains trusted programmable content (no blanket sanitizer/script stripping).
- Hardened server correctness/privacy flows: analytics endpoint now requires a valid matching share token, share-token permanent-delete cascade handles both legacy-string and object tokens, Explore excludes trashed decks, and file-locked helpers now cover analytics/media mutation paths.
- Hardened live session ownership: `POST /api/live/room` now returns `roomCode` + `presenterToken`; presenter socket join requires `presenterToken` and rejects takeover with `join-error` (`invalid-presenter-token`).
- Hardened AI custom provider calls with SSRF guardrails (public `http/https` only, private/local/link-local blocked), plus stricter outline schema validation and generic client-safe provider failure messages.
- Added client guardrails and reliability fixes: finite numeric parsing/clamping to avoid persisted `NaN`, safer live/settings error handling, markdown URL safety, import partial-failure warnings, and export cache cleanup in `finally` paths.
- Applied targeted content safety only to text/markdown/svg/shape-text surfaces while preserving trusted HTML embed behavior for editor/present/export/share.
- Repaired test harness and regressions: k6 scripts now use current defaults/routes, tautological E2E assertions were replaced, and added cross-phase regression E2E in `tests/e2e/hardening-regression.spec.js` (analytics gate, live hijack rejection, trusted HTML embed execution).
- Final verification passed: `npm run lint`, `npm run test`, `npm run test:e2e` (110 tests), and `npm run build`. Load tests remain unexecuted because `k6` is not installed on this machine.
- Recorded Electron sandbox as a follow-up hardening decision only (no implementation in this run).
- Hardened PPTX parser worker startup for dev/Electron runtimes: parser children ignore Node watch-mode IPC messages, strip inherited `--watch*` exec flags, run in Electron Node mode when packaged, resolve both `server/node_modules` and root `node_modules`, and Electron packaging verifies `pptxtojson`/`pptx2json` before release.
- Completed E2E hardening plan `plans/260426-1708-e2e-testing-hardening-stable-selectors/` with stable property-panel selectors (`prop-*`) and explicit selector contract: role/label/text first, `data-testid` only for ambiguous controls, and no canvas ID renames.
- Added new API-backed E2E coverage files: `element-properties.spec.js`, `element-interactions.spec.js`, `element-lifecycle.spec.js`, and deterministic `visual-regression.spec.js` with Playwright `toHaveScreenshot()` baseline (`editor-canvas-basic-chromium-win32.png`).
- Hardened save lifecycle semantics: editor save status now includes `error`, exposes visible `Save failed` state, preserves optimistic local edits on failed autosave, and provides explicit `Retry` action.
- Refactored E2E page object structure by splitting `tests/e2e/pages/EditorPage.js` responsibilities into helper modules (`CanvasHelper`, `InsertMenuHelper`, `SlidePanelHelper`, `PropertiesPanelHelper`) while preserving existing `EditorPage` public API.
- Added bounded undo/redo stress coverage (10 add, 10 undo, 10 redo), cross-slide copy/paste persistence checks, locked-element delete/duplicate guard coverage, and autosave failure/retry persistence checks.
- Verification evidence for this hardening run:
  - `npx playwright test --list` => 127 tests in 27 files.
  - `npx playwright test --reporter=list` => 127/127 passed.
  - Full E2E runtime measurement: ~74.92 seconds (`Measure-Command`).
  - `npm run lint`, `npm test` (62 files / 358 tests), and `npm run build` passed.

## 2026-04-25

- Completed round-trip harness unification (plan `260425-1802-unify-roundtrip-harness`): the fidelity tester now uses the production export pipeline, `--strict` enforces production-only export with the ≥95 semantic / ≥98 round-trip gate, and the latest 4-deck corpus run landed at 97.0% semantic fidelity and 99.0% round-trip stability.
- Fixed PPTX full-fidelity review issues from plan `260425-1026-pptx-full-fidelity`: hardened CSS `url()` sanitization, routed grouped children through normal mappers, preserved custom SVG paths, line dash/arrow markers, image alt/crop/flip/borders, gradient backgrounds, per-slide transitions, merged/per-cell table styles, multi-series chart editing, and PPTX hyperlink export via `hyperlink.url`.
- Added regression coverage for PPTX import/export fidelity gaps and property panels; verification passed `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm run test:corpus` against 4 real decks with 97.0% average semantic fidelity and 99.0% round-trip stability.
- Improved PPTX fidelity harness so the default empty corpus falls back to the checked-in `PPTX/` corpus and `--roundtrip` performs a real temporary PPTX export/re-import structural check. Current round-trip stability remains low (1-7%) because the harness exporter is intentionally minimal and diagnostic, not the full client exporter.
- Completed UI/UX Tailwind Hard Mode remediation (plan `260425-0455-ui-ux-tailwind-fix-hard`): 19 fixes across 5 phases.
  - Phase 1 (Critical): Fixed slide index badge visibility on light backgrounds (C-02); centralized hardcoded color palette into `shared/src/colorConfig.js` with `TEXT_COLORS`, `BG_COLORS`, `GRADIENT_PRESETS`, `isLightColor()` helper (C-04).
  - Phase 2 (High): Fixed sidebar import progress layout with `mt-auto` sticky (H-01); removed `scale-[0.85]` from vertical children thumbnails (H-02); added `id` + `max-h-[80vh]` to BG popup for viewport overflow (H-03); refactored list view onClick to title-only (H-04); replaced `📌` emoji with `MousePointer2` Lucide icon in PropertiesPanel (H-05).
  - Phase 3 (Medium): Added `active:bg-active` to ghost button variant (M-01); added clear `X` button to search inputs (M-03); wired `onUndo`/`onRedo` props directly in QuickAccessToolbar, removed `dispatchEvent` hack (M-04); replaced hardcoded white hex check with `isLightColor()` helper for color swatch borders (M-05); replaced `en-US` locale with `navigator.language` for date formatting (M-06); added `disabled` attr + visual disabled state to delete button (M-07); extracted modal `z-index` to `--z-modal` / `--z-modal-overlay` CSS vars (M-08).
  - Phase 4 (A11y/Tailwind): Added `placeholder:text-text-muted` to Input base class (T-01); added light theme scrollbar override with `rgba(0,0,0,0.15)` (T-04); added `role="listbox"`, `aria-expanded`, `role="option"`, `aria-selected` to color palette (A-02); added `role="menu"`, `role="menuitem"`, `tabIndex`, keyboard navigation (↑↓ Esc) to slide context menu (A-03).
  - Phase 5 (Verification): All 130 tests pass, production build succeeds.
  - Fixed pre-existing `InsertMenu.jsx` inline-style budget entry in `tailwind-inline-style-audit.test.js`.

## 2026-04-24

- Implemented editable `.pptx` import Phase 1: added `POST /api/pptx/import`, server-side `pptxtojson@2.0.2` child process parsing with ZIP/package budget guards, `pptx2json@0.0.10` fallback inspection, DOMPurify sanitization, image MIME validation, NavSlides mapping for text/images/shapes/tables, locked placeholders for unsupported objects, HomePage `Import PPTX`, optional local corpus validator, and focused route/service/client tests. Local corpus validation passed 4 decks / 145 slides.
- Completed the `.pptx` parser benchmark against 4 real decks / 145 slides: selected `pptxtojson` as primary and `pptx2json` as raw fallback, kept parser dependencies in a plan-scoped sandbox, ignored sensitive raw parser output, and added script tests for summary, scoring, redaction, and guard behavior.
- Fixed PPTX export fidelity without sacrificing editability: HTML embeds and LaTeX now rasterize through a server-side Playwright element capture endpoint, while normal text, images, shapes, tables, code, and native charts still export as editable PPTX objects.
- Completed ESLint cleanup: removed obsolete tracked helper scripts, added flat-config globals for tool configs/scripts, resolved React hook dependency warnings, unused variables, stale disable comments, and unnecessary escape sequences; verification passed with `npm run lint` at 0 warnings, `npm test` 22 files / 97 tests, `npm run build`, and `npm run test:e2e` 102 tests.
- Closed Tailwind UI/UX review remediation: Button variants now keep explicit border policies, icon-only buttons have accessible names, Animation Preview is a keyboard-safe responsive dialog, stale local media no longer aborts `.navslides` export, and PPTX export helpers are split into focused renderer/core/raster modules.
- Added regression coverage for secondary button borders, icon label fallback, Animation Preview dialog semantics, partial media export ZIP manifests, PPTX image/chart/placeholder/background paths, and a narrow-viewport Playwright check for the Animation Preview modal.
- Replaced Animation Timeline's misleading `Preview` shortcut to full present mode with a real in-editor preview modal that renders only the active slide in an iframe, supports previous/next/replay controls, and auto-plays fragment steps without leaving the editor.
- Added regression coverage for animation preview step mapping and single-slide preview rendering in `client/src/components/animation-preview-helpers.test.js` and `client/src/components/AnimationPreviewModal.test.jsx`.
- Reworked `Export PPTX` into a hybrid exporter: text/image/shape/line/callout/table/code/native charts stay as editable PPT objects where stable, while markdown/html/latex/icon/qrcode/drawing/svg/unsupported charts and gradient backgrounds fall back to rasterized assets instead of silently disappearing; export now preserves slide aspect ratio, z-order, and speaker notes, and surfaces warnings when fallback or placeholders are used.
- Fixed PPTX raster fallback for HTML and LaTeX: capture runtime now initializes before embed scripts, known CDN dependencies resolve through local `/vendor` assets, and LaTeX/TikZ exports use PDF-style rendering with higher-resolution PNG output.
- Restored the split between `Export HTML` and `Export Offline HTML`: standard HTML now follows the CDN-backed `downloadHTML()` path, while offline HTML continues to inline runtime assets.
- Fixed project export/import archive integrity for local uploads by canonicalizing slide background images to `background.image`, keeping legacy `background.src` read support, archiving `src`/`poster`/background assets via manifest-backed `.navslides` media entries (`version: 1.1`), rewriting absolute old-host `/uploads/...` URLs on import, and preventing duplicate filename collisions inside project archives.

## 2026-04-23

- Completed Tailwind refactor hardening verification: token-backed UI layer, route-based shell, canonical `notes` normalization with `speakerNotes` alias support, shared export helpers, live controller/viewer semantics, file-locked JSON writes, and E2E hardening. Verification gates passed for diff check, lint, build, unit tests, Playwright, and `npm run test:e2e`; `k6` load tests were skipped because `k6` is not installed.
- Fixed post-Tailwind live-presenting regressions: remote/speaker routes now use controller role, vertical slide sync keeps `verticalIndex`, and viewer count excludes controllers.
- Standardized speaker notes on canonical `Slide.notes`; legacy `speakerNotes` is normalized away on load/save/export.
- Added regression coverage for multi-select slide batch actions, empty-string replace, live controller navigation, speaker view, and vertical live sync.
- Fixed `ProductTour` onboarding flow to use a continuous Joyride sequence with explicit placements.
- Removed the manual `close => next` step hack, which was causing confusing navigation behavior.
- Added regression coverage for the tour contract in `client/src/components/ProductTour.test.js`.
- Fixed Tailwind review regressions across editor and dashboard flows: Sync/History modal crashes, TemplatePicker click containment, Joyride test drift, and unsupported dashboard animation classes.
- Standardized fullscreen dialog behavior across editor overlays: `Escape` close, backdrop click containment, and accessible dialog/close-button semantics.
- Hardened `HistoryModal` against snapshot API failures with inline error UI, retry flow, and pending-state guards for save/restore/delete actions.
- Fixed template gallery state integrity by avoiding in-place sorting mutation, removing the orphaned dashboard preview artifact, tightening the Tailwind inline-style audit, and adding end-to-end regressions for modal closure and template ordering.
- Fixed All Presentations editor navigation when Vite serves a stale optimized shared module; client notes normalization now has local fallbacks and regression coverage verifies existing presentations open into the editor.
