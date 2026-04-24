# Project Changelog

## 2026-04-24

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
