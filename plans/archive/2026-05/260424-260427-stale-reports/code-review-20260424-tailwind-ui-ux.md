# Code Review - Tailwind UI/UX Migration

Date: 2026-04-24
Scope: current worktree after Tailwind/UI restructure, with focus on changed files, new files, UI controls, accessibility, export/import regressions.

## Verification

- `npm run build`: pass.
- `npm run test`: pass, 21 files / 92 tests.
- `npm run lint`: pass with warnings only; 228 warnings remain.
- `git diff --check`: pass; only LF -> CRLF notices.
- `npx playwright test tests/e2e/smoke.spec.js tests/e2e/export.spec.js`: pass, 4 tests.

## Findings

### Medium - secondary Button borders are visually disabled

`client/src/components/ui/Button.jsx:6` - base class includes `border-none`.
`client/src/components/ui/Button.jsx:11` - `secondary` tries to render `border border-border`.

Tailwind emits `border-none` as `border-style: none`; `border` only changes width. Any `Button variant="secondary"` can lose its border, including modal controls and dashboard actions.

Fix: remove `border-none` from base. Put `border border-transparent` on primary/danger/ghost/icon and `border border-border` on secondary.

### Medium - AnimationPreviewModal missing dialog/accessibility behavior

`client/src/components/AnimationPreviewModal.jsx:49` - overlay has no `role="dialog"` / `aria-modal`.
`client/src/components/AnimationPreviewModal.jsx:49` - no Escape key close, focus trap, or focus return.
`client/src/components/AnimationPreviewModal.jsx:116` - icon-only close button uses `title`, no `aria-label`.

Keyboard and screen reader users can land behind the modal or miss the close control semantics.

Fix: add dialog semantics, labelled heading, Escape handling, initial focus, focus return, and `aria-label="Close preview"`.

### Medium - AnimationPreviewModal controls can overflow on small screens

`client/src/components/AnimationPreviewModal.jsx:54` - modal shell has `overflow-hidden`.
`client/src/components/AnimationPreviewModal.jsx:55` - header is one row.
`client/src/components/AnimationPreviewModal.jsx:63` - five controls are `ml-auto flex` with no wrap/responsive fallback.
`client/src/components/AnimationPreviewModal.jsx:64`-`116` - buttons include text labels.

At narrow widths the controls can clip or force horizontal overflow. This is likely on mobile/tablet and small desktop side-by-side windows.

Fix: move preview controls to a footer or use `flex-wrap`, responsive icon-only labels, and `min-w-0`.

### Medium - project export fails all media on one missing asset

`client/src/utils/export-project.js:65` - ZIP media collection uses `Promise.all`.
`client/src/utils/export-project.js:22` - `fetchProjectMediaBlob` throws on any non-OK fetch.

One stale `/uploads/*` reference or transient fetch failure aborts the whole `.navslides` export. Previous behavior used settled media fetching and still exported the project.

Fix: use `Promise.allSettled`, include successful media, and surface warnings for missing assets. Add a unit test for one 404 media URL.

### Low - motion utilities violate current UI guideline

Representative lines:

- `client/src/components/ui/Button.jsx:6`
- `client/src/pages/HomePage.jsx:868`
- `client/src/components/SlidePanel.jsx:168`
- `client/src/components/TemplatePickerModal.jsx:126`

`transition-all` is widespread. Current Web Interface Guidelines flag it; use property-specific transitions (`transition-colors`, `transition-transform`, `transition-shadow`) and add reduced-motion variants where movement is decorative.

### Low - icon-only buttons rely on `title`, not `aria-label`

Representative lines:

- `client/src/pages/HomePage.jsx:616`
- `client/src/pages/HomePage.jsx:622`
- `client/src/pages/HomePage.jsx:836`
- `client/src/pages/HomePage.jsx:967`
- `client/src/components/AnimationPreviewModal.jsx:116`

Fix in `Button` or call sites: if `variant="icon"` and no text child, require or derive `aria-label`.

### Low - new PPTX modules exceed repo file-size rule

- `client/src/utils/export-pptx-raster.js:535`
- `client/src/utils/export-pptx-core.js:475`
- `client/src/utils/exportPptx.js:354`

This violates the repo rule to keep files under 200 LOC. Not a runtime bug, but it makes the new export path harder to review and test.

Fix: split parser/color/layout helpers, raster capture helpers, and per-element PPTX renderers.

## File-by-file Review Notes

### Changed files

- `client/src/components/EditorMenuBar.jsx`: pass. Label update only.
- `client/src/components/layout/StatusBar.jsx`: pass. Text update only.
- `client/src/pages/EditorPage.jsx`: pass with caveat. Wiring is coherent; preview modal needs fixes in its own file.
- `client/src/pages/HomePage.jsx`: issue. Icon-only buttons need aria labels; project import path ok.
- `client/src/utils/export-project.js`: issue. Media export should tolerate partial failures.
- `client/src/utils/exportPptx.js`: pass with maintainability concern. Tests cover only limited element path.
- `client/src/utils/import-project.js`: pass. Legacy and v1.1 media mapping looks coherent.
- `client/src/utils/media-detector.js`: pass. Background/poster detection covered.
- `client/src/utils/*.test.js`: pass. Add missing failed-media export test.
- `docs/*.md`: pass. No correctness issue found in docs updates.

### New files

- `client/src/components/AnimationPreviewModal.jsx`: issue. Dialog semantics, keyboard close, focus behavior, responsive controls.
- `client/src/components/AnimationPreviewModal.test.jsx`: pass for smoke, but does not cover accessibility or responsive controls.
- `client/src/components/animation-preview-helpers.js`: pass. Sparse fragment step logic is simple and tested.
- `client/src/components/animation-preview-helpers.test.js`: pass.
- `client/src/utils/export-pptx-core.js`: pass with size concern.
- `client/src/utils/export-pptx-core.test.js`: pass, but color/HTML parser coverage is still thin.
- `client/src/utils/export-pptx-raster.js`: pass with size/security-review concern due executing sandboxed user HTML for capture.
- `client/src/utils/export-pptx-raster.test.js`: pass. Good iframe capture regression coverage.
- `client/src/utils/exportPptx.test.js`: pass. Needs image/chart/fallback/background tests.
- `client/src/utils/project-media-utils.js`: pass. Deterministic archive paths and URL rewrite are good.
- `client/src/utils/project-media-utils.test.js`: pass.
- `plans/20260424-0342-animation-timeline-preview-modal/*`: pass as plan docs.

## Global Tailwind/UI Scan

- Only app CSS file left under `client/src` is `index.css`; this matches the token/reset approach in `docs/code-standards.md`.
- No legacy page/component CSS imports found, except `index.css`, KaTeX CSS, and raw highlight.js theme CSS.
- Dynamic `style={...}` remains heavily in canvas/export preview code. This is justified for coordinate rendering; not vanilla CSS migration debt by itself.
- Many source files remain over 200 LOC. This is pre-existing in large editor modules, but new PPTX files add to the problem.

## Adversarial Review

Accepted findings:

- Secondary button border conflict can silently degrade controls across many surfaces.
- Modal accessibility gaps block keyboard/screen-reader quality.
- One missing media asset can abort full project export.

Rejected findings:

- PptxGenJS `path` usage is not rejected here; official docs state `path` can be a relative or full URL like an image `src`.

Deferred:

- Bundle size warnings from Vite are real but outside this migration review unless performance target says otherwise.

## Sources

- Web Interface Guidelines fetched 2026-04-24: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- PptxGenJS Images docs: https://gitbrent.github.io/PptxGenJS/docs/api-images.html

## Unresolved Questions

- Is mobile/narrow-screen editor support required for desktop-only acceptable.
