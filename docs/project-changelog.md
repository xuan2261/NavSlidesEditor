# Project Changelog

## v1.6.x

## 2026-04-27

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
- Added regression coverage for PPTX import/export fidelity gaps and property panels; verification passed `npm run lint`, `npm test` (49 files / 302 tests), `npm run build`, `npm run test:e2e` (106 tests), and `npm run test:corpus` against 4 real decks with 95.0% average semantic fidelity.
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
