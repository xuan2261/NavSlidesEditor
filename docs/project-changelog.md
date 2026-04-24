# Project Changelog

## 2026-04-25

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
