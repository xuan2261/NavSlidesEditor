# Project Roadmap - NavSlides Editor

## Current Status: UI/UX Tailwind Hard Mode Remediation completed

All core features are operational. The token-backed Tailwind layer, route-based
shell, live controller/viewer contract, notes normalization, persistence
locking, and E2E gates were verified on 2026-04-23. UI/UX Tailwind Hard
Mode remediation completed on 2026-04-25 with 19 fixes across 5 phases (C-02,
C-04, H-01..H-05, M-01..M-08, T-01, T-04, A-02, A-03). The `.pptx` parser
benchmark completed on 2026-04-24 and selected `pptxtojson` primary with
`pptx2json` fallback inspector. Editable PPTX import Phase 1 is implemented
with server-side parser isolation, ZIP budget guards, text/image/shape/table
mapping, and locked placeholders for unsupported objects.

### What Works

| Area | Status |
| --- | --- |
| WYSIWYG editing (15+ element types) | Done |
| Undo/redo (50-step) | Done |
| Auto-save (debounced) | Done |
| Smart guides + snapping | Done |
| Fragment animations + timeline | Done |
| Animation Preview modal | Done (accessible dialog, narrow viewport checked) |
| Slide templates (20+ layouts) | Done |
| Interactive and quiz templates | Done |
| Footer system (basic + sequence) | Done |
| Present mode (reveal.js) | Done |
| Export HTML | Done (CDN-backed deck) |
| Export PDF | Done |
| Export PPTX | Done (hybrid native + high-res raster fallback, split helpers) |
| Project export/import (.navslides) | Done (manifest v1.1, partial media skip warnings) |
| Import PPTX | Done (Phase 1 editable text/image/shape/table with placeholders) |
| Offline HTML export | Done (self-contained) |
| Shareable links (with password option) | Done |
| GitHub push integration | Done |
| rclone cloud sync | Done |
| Version history (snapshots) | Done |
| Docker deployment | Done |
| Electron desktop (Linux/macOS/Windows) | Done |
| Dark/light editor theme | Done |
| AI copywriting + translation | Done |
| Media library (Unsplash, Giphy) | Done |

### What'"'"'s New in v1.4.x (Security & Architecture Refactor)

| Area | Status |
| --- | --- |
| Zod request validation on all mutation APIs | Done |
| CSS modularization (57KB -> split files) | Done |
| Zustand state management (3 stores) | Done |
| Custom hooks (6 hooks extracted) | Done |
| PropertiesPanel decomposition (8 sub-editors) | Done |
| Element factory (centralized creation) | Done |
| ErrorBoundary (crash recovery UI) | Done |
| JSDoc type definitions (shared/types) | Done |
| Electron safeStorage (credential encryption) | Done |
| DOMPurify sanitization (XSS prevention) | Done |
| MIME-type validation (upload security) | Done |
| Rate limiting (sensitive endpoints) | Done |
| DRY rendering pipeline (element-renderers.js) | Done |
| Socket.IO modularization (socket-handler.js) | Done |
| EditorPage reduction (3400 -> 1475 LOC) | Done |
| Tailwind token hardening, route shell, live sync, and persistence locking | Done |

## Known Limitations

### Export Limitations

- PPTX export rasterizes complex DOM-backed elements and unsupported chart
  variants for fidelity, so those exported objects are not always editable in
  PowerPoint. HTML and LaTeX raster fallbacks use local vendor assets where
  possible to avoid placeholder-only output.
- Present mode and standard HTML export still depend on CDN resources at
  runtime.

### Code Quality

- No full TypeScript migration. JSDoc types provide editor support, but not
  compile-time enforcement across the entire app.

### CI/CD

- GitHub Actions builds for Windows only.

## Completed Phases

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

### Phase 8 - UI/UX Tailwind Hard Mode Remediation (Complete - 2026-04-25)

19 fixes across 5 phases: slide index badge visibility (C-02), shared color
config module (C-04), sidebar layout/vertical scale/popup overflow/onClick/emoji
(H-01..H-05), ghost active state/search clear/undo-redo/swatch border/date
locale/delete disabled/modal z-index (M-01..M-08), placeholder color/scrollbar
light theme/ARIA palette/context menu keyboard nav (T-01, T-04, A-02, A-03).
All 130 tests pass, production build succeeds.

**Plan:** `plans/260425-0455-ui-ux-tailwind-fix-hard/`

### Phase 8 - Tailwind UI/UX Review Remediation (Complete - 2026-04-24)

Closed accepted Medium findings from the Tailwind UI/UX review and fixed touched/global Low-risk control accessibility items.

**Plan:** `plans/20260424-0619-tailwind-ui-ux-review-remediation/`

### Phase 9 - PPTX Parser Benchmark (Complete - 2026-04-24)

Benchmarked 4 JavaScript `.pptx` parser candidates against 4 real decks / 145 slides. Result: go for follow-up editable import planning with `pptxtojson` primary and `pptx2json` raw fallback.

**Plan:** `plans/20260424-1508-pptx-parser-benchmark-hard/`

### Phase 10 - Editable PPTX Import Phase 1 (Complete - 2026-04-24)

Shipped server-side editable `.pptx` import using `pptxtojson@2.0.2`, with
`pptx2json@0.0.10` as metadata fallback inspector only. Supports text, images,
basic shapes/lines, and tables; charts, equations, OLE, SmartArt, and complex
groups become locked placeholders with warnings.

**Plan:** `plans/260424-1841-pptx-import/`

## Future Improvement Phases

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

### Phase C - SlideCanvas Decomposition (Medium Priority)

Break down the remaining large component.

**Tasks:**

- Extract drag/resize logic -> `use-drag-resize` hook
- Extract selection logic -> `use-selection` hook
- Extract context menu -> `CanvasContextMenu` component
- Extract ruler/guides -> `RulerOverlay` component
- Extract crop mode -> `CropOverlay` component

**Success criteria:** SlideCanvas <= 1200 LOC; all interaction logic in hooks.

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

## Non-Roadmap Items

These are explicitly out of scope:

- Real-time multi-user collaboration
- Cloud-hosted SaaS version
- Mobile / tablet editing interface
- Plugin / extension marketplace
