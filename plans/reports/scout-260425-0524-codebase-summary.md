# Scout Report — Codebase Summary Update

**Agent:** scout
**Date:** 2026-04-25
**Scope:** Full codebase — client, server, shared, electron, tests, scripts, docs

---

## Summary

Scouted toàn bộ codebase NavSlides Editor (v1.6.1). Docs `docs/codebase-summary.md` đã được cập nhật với thông tin mới. Dưới đây là tổng hợp các phát hiện chính.

---

## Repository Layout

- **npm workspace** root `navslides-editor` v1.6.1, 4 packages: `client`, `server`, `shared`, `electron`.
- Tooling: Vite 5, ESLint 9 flat config, Prettier, Vitest 4, Playwright 1.59, Electron 33, electron-builder 25.
- No TypeScript (JSDoc only). No database (pure JSON file storage). No session/JWT auth.

## Client (~115 files, ~20–25K LOC)

| Area | Chi tiết |
|------|----------|
| Routing | React Router v7 (`BrowserRouter`). Layout routes + standalone live routes. `EditorRoute` factory. |
| State | 3 Zustand stores: `useEditorStore`, `usePresentationStore`, `useUIStore`. |
| Components | ~60 components trong `src/components/`. Key: `SlideCanvas.jsx` (2421 LOC — đã planned tách Phase C). `InsertMenu.jsx`, `PropertiesPanel.jsx` với type-specific sub-panels. |
| Utils | Export (PPTX/raster/HTML), import (PDF/PPTX/markdown), AI, smart guides. |
| Extensions | TipTap: FontFamily, FontSize, MathExtension (KaTeX). |
| Dependencies | Reveal.js, Socket.io-client, Tailwind CSS, KaTeX, pdfjs-dist, pptxgenjs. |
| Services | Giphy, Unsplash integrations. |

## Server (~19 route files, ~800 LOC index.js)

| Area | Chi tiết |
|------|----------|
| REST Routes | presentations, templates, share, history, upload, github, sync, live, settings, explore, analytics, marketplace, media, ai, **pptx-import** (đang phát triển). |
| Socket.IO | Namespace `/`, path `/ws`. Events: join-room, navigate, control-navigate, cursor-move, annotation, laser, viewer-count, sync-state. |
| Services | `storage.js` (JSON + per-file lock), `pptx-exporter.js`, `pptx-import/` (service mới), `socket-handler.js`, `live-rooms.js`. |
| Middleware | Zod schemas, error-handler, validate. |
| Data | `server/data/*.json`, `server/data/history/`, `server/uploads/`, `server/vendor/` (bundled 3rd-party). |

## Shared (`revealjs-shared` package)

| Export | Chi tiết |
|--------|----------|
| `generateRevealHTML` | Reveal.js HTML với live nav, Socket.IO sync, presenter toolbar. |
| `generatePrintHTML` | Print-ready HTML với fragment expansion. |
| `shapeSvgString` | 15 shapes: rect, rounded-rect, circle, triangle, diamond, arrow-right, star, line, hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket. |
| Color config | `TEXT_COLORS`, `BG_COLORS`, `GRADIENT_PRESETS`, `isLightColor()`. |
| Icon paths | 1000+ Lucide icon SVG paths trong `data/icon-paths.json`. |

## Electron

- `main.js`: No sandbox, embedded Express port 3002, 1400×900 window.
- `preload.js`: `window.electronAPI` với 4 credential methods (safeStorage + file fallback).

## Tests

- **Vitest**: unit tests cho shared, server, client utils.
- **Playwright**: ~24 spec files, 7 page objects, smoke tests.
- **k6**: API + WebSocket load tests.
- **PPTX benchmark suite**: 4 runners, corpus validator, inventory runner.

## Docs (hiện có)

Đã có đầy đủ: `codebase-summary.md`, `system-architecture.md`, `project-overview-pdr.md`, `project-roadmap.md`, `deployment-guide.md`, `project-changelog.md`, `code-standards.md`, `design-guidelines.md`, 8 journals. Chưa có: README gốc, API reference, contributor guide, troubleshooting guide.

## Unresolved Questions

- `SlideCanvas.jsx` 2421 LOC cần tách — chưa có kế hoạch chi tiết cho Phase C decomposition.
- PPTX import Phase 1 đã xong — tiến độ Phase 2+ chưa rõ.
- `pptx-import-summary.js` và `pptx-import-summary.test.js` trong `client/src/utils/` — cần xác nhận đây là placeholder hay implementation mới.
