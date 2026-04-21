# Project Roadmap — NavSlides Editor

## Current Status: v1.4.3 — Security & Architecture Refactor

All core features operational. Security patches applied. Architecture refactored for maintainability. Deployable via Docker, Node.js, or Electron.

### What Works

| Area                                     | Status                  |
| ---------------------------------------- | ----------------------- |
| WYSIWYG editing (15+ element types)      | Done                    |
| Undo/redo (50-step)                      | Done                    |
| Auto-save (debounced)                    | Done                    |
| Smart guides + snapping                  | Done                    |
| Fragment animations + timeline           | Done                    |
| Slide templates (20+ layouts)            | Done                    |
| Interactive & Quiz templates             | Done                    |
| Footer system (basic + sequence)         | Done                    |
| Present mode (reveal.js)                 | Done                    |
| Export HTML                              | Done                    |
| Export PDF                               | Done                    |
| Export PPTX                              | Done (with limitations) |
| Project Export/Import (.navslides)        | Done                    |
| Offline HTML export                      | Partial                 |
| Shareable links (with password option)   | Done                    |
| GitHub push integration                  | Done                    |
| rclone cloud sync                        | Done                    |
| Version history (snapshots)              | Done                    |
| Docker deployment                        | Done                    |
| Electron desktop (Linux/macOS/Windows)   | Done                    |
| Dark/light editor theme                  | Done                    |
| AI copywriting + translation             | Done                    |
| Media library (Unsplash, Giphy)          | Done                    |

### What's New in v1.4.x (Security & Architecture Refactor)

| Area                                     | Status   |
| ---------------------------------------- | -------- |
| **Zod request validation** on all mutation APIs | ✅ Done |
| **CSS modularization** (57KB → split files)      | ✅ Done |
| **Zustand state management** (3 stores)          | ✅ Done |
| **Custom hooks** (6 hooks extracted)             | ✅ Done |
| **PropertiesPanel decomposition** (8 sub-editors)| ✅ Done |
| **Element factory** (centralized creation)       | ✅ Done |
| **ErrorBoundary** (crash recovery UI)            | ✅ Done |
| **JSDoc type definitions** (shared/types)        | ✅ Done |
| **Electron safeStorage** (credential encryption) | ✅ Done |
| **DOMPurify sanitization** (XSS prevention)      | ✅ Done |
| **MIME-type validation** (upload security)        | ✅ Done |
| **Rate limiting** (sensitive endpoints)           | ✅ Done |
| **DRY rendering pipeline** (element-renderers.js) | ✅ Done |
| **Socket.IO modularization** (socket-handler.js)  | ✅ Done |
| **EditorPage reduction** (3400 → 1475 LOC)       | ✅ Done |

## Known Limitations

### Export Limitations

- **Offline HTML export incomplete** — some CDN resources may not be fully inlined
- **PPTX export limited** — shapes all render as rectangles; chart, html, latex, video, audio, icon elements skipped
- **CDN dependency at runtime** — present mode and HTML export depend on CDN availability

### Code Quality

- **No full TypeScript** — JSDoc types provide IDE support but not compile-time enforcement across all files

### CI/CD

- GitHub Actions builds for Windows only

## Completed Phases

### Phase 1 — Controls UX: Critical Fixes (✅ Complete — 2026-04-16)

PowerPoint-parity keyboard shortcuts and Selection Pane.

**Plan:** `plans/260416-1750-powerpoint-parity-controls/`

### Phase 2 — Security Architecture Refactor (✅ Complete — 2026-04-18)

4-phase comprehensive refactor from adversarial code review findings.

**Sub-phases:**
1. ✅ **Security Patches** — XSS prevention, DOMPurify, MIME validation, rate limiting, POST migration
2. ✅ **DRY Cleanup** — Element factory, Socket.IO extraction, rendering pipeline unification
3. ✅ **Component Decomposition** — EditorPage modals extracted, Zustand stores, custom hooks, PropertiesPanel sub-editors
4. ✅ **Infrastructure** — Zod validation, CSS split, JSDoc types, Electron safeStorage, ErrorBoundary

**Plan:** `plans/260418-1056-security-architecture-refactor/`

## Future Improvement Phases

### Phase 3 — Testing & CI Quality Gate (✅ Complete)

Established test coverage for critical paths and introduced linting/formatting.

**Tasks Completed:**
- Unit tests for `htmlGenerator.js`
- Vitest workspace configuration
- Playwright E2E suite (`tests/e2e/`)
- ESLint + Prettier configuration

### Phase 4 — Export Completeness & Templates Expansion (✅ Complete)

Fixed offline export rendering and expanded template gallery.

**Tasks Completed:**
- Robust offline HTML export with protocol-agnostic iframe initialization
- Fix PDF printing rendering for embedded HTML
- Added Interactive & Quiz templates, and rich built-in template gallery (26,000+ lines in `built-in-templates.json`)

### Phase C — SlideCanvas Decomposition (Medium Priority)

Break down the remaining large component.

**Tasks:**

- Extract drag/resize logic → `use-drag-resize` hook
- Extract selection logic → `use-selection` hook
- Extract context menu → `CanvasContextMenu` component
- Extract ruler/guides → `RulerOverlay` component
- Extract crop mode → `CropOverlay` component

**Success criteria:** SlideCanvas ≤ 1200 LOC; all interaction logic in hooks.

### Phase D — CI/CD (Lower Priority)

**Tasks:**

- Add Linux and macOS build targets to GitHub Actions
- Add test step to CI before build
- Publish release artifacts to GitHub Releases automatically on tag push
- Add Docker image publish to GitHub Container Registry (ghcr.io)

## Non-Roadmap Items

These are explicitly out of scope:

- Real-time multi-user collaboration
- Cloud-hosted SaaS version
- Mobile / tablet editing interface
- Plugin / extension marketplace
