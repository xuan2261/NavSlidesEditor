# Plan: Port Features from parallax-presentations

**Source:** https://github.com/jbirky/parallax-presentations
**Target:** NavSlidesEditor (current project)
**Date:** 2026-05-16
**Analysis:** `plans/reports/phase1-parallax-repo-analysis.md`

---

## Phases Overview

| # | Phase | Priority | Effort | Files Created | Files Modified | Status |
|---|-------|----------|--------|---------------|----------------|--------|
| 01 | [TipTap Extensions (FontWeight + LineHeight)](phase-01-tiptap-font-weight-line-height-extensions.md) | P1 | Low | 2 | 3 | Pending |
| 02 | [Video Enhancements (URL, Trim, Speed)](phase-02-video-enhancements-url-trim-speed.md) | P1 | Low | 0 | 5 | Pending |
| 03 | [Editor UX (Ctrl+K, LaTeX, Citations, Context Menu)](phase-03-editor-ux-ctrl-k-latex-citations-context-menu.md) | P1 | Low | 1 | 4 | Pending |
| 04 | [Present Mode CSS Fixes](phase-04-present-mode-css-fixes.md) | P1 | Medium | 1 | 3 | Complete |
| 05 | [Timeline Element](phase-05-timeline-element.md) | P2 | Medium | 1 | 6 | Pending |
| 06 | [Kinetic Text + Math Grid + Anime + Three.js](phase-06-kinetic-text-math-grid-anime-threejs-elements.md) | P2 | Medium | 4 | 3 | Pending |
| 07 | [Bug Fixes from parallax commits](phase-07-bug-fixes-from-parallax-commits.md) | P2 | Low | 0 | 4 | Pending |
| 08 | [Upload Deduplication + File Browser](phase-08-upload-deduplication-file-browser.md) | P2 | Medium | 1 | 3 | Pending |
| 09 | [Integration Testing + Verification](phase-09-integration-testing-verification.md) | All | Medium | 1 | 0 | Complete |

**Total new files:** 11 | **Total modified files:** ~15 unique

---

## Dependencies

```
Phase 01 ─┐
Phase 02 ─┤
Phase 03 ─┼── Phase 04 ── Phase 09
Phase 05 ─┤
Phase 06 ─┤
Phase 07 ─┤
Phase 08 ─┘
```

Phases 01-08 are independent and can be executed in any order or parallelized.
Phase 09 (Integration Testing) depends on all prior phases being complete.

---

## Key Files Reference

### Client
| File | Role |
|------|------|
| `client/src/extensions/` | TipTap extensions (FontFamily, FontSize, MathExtension) |
| `client/src/components/` | UI components (Toolbar, PropertiesPanel, SlideCanvas, etc.) |
| `client/src/pages/EditorPage.jsx` | Main editor — state management, element handlers |
| `client/src/pages/HomePage.jsx` | Dashboard — CRUD presentations |
| `client/src/stores/` | Zustand stores (editor-store, presentation-store, ui-store) |

### Server
| File | Role |
|------|------|
| `server/index.js` | Express server, all REST routes |
| `server/routes/` | Route handlers (upload, share, presentations, etc.) |
| `server/services/` | Business logic (live-rooms, etc.) |

### Shared
| File | Role |
|------|------|
| `shared/src/htmlGenerator.js` | JSON presentation → reveal.js HTML string |
| `shared/src/element-renderers.js` | Per-element-type HTML renderers |
| `shared/src/shapeUtils.js` | SVG shape generation |

---

## Scope Decisions

### Included (Port)
- All editor features: FontWeight, LineHeight, Ctrl+K, LaTeX controls, citation settings
- All element types: Timeline, Kinetic Text, Math Grid, Anime.js, Three.js
- All bug fixes: CSS mismatches, iframe rendering, position conflicts, overflow
- Infrastructure: Upload deduplication, file browser, present mode CSS overrides

### Excluded (Skip)
- **Clerk auth** — NavSlidesEditor is self-hosted, no auth needed
- **Stripe billing** — No payment system needed
- **PostgreSQL storage** — Keep file-based JSON storage
- **R2/S3 storage** — Keep local file uploads
- **Landing page** — Cloud-specific marketing page
- **DocsPage** — Cloud-specific documentation viewer
- **Plugin system** — Major architectural change, defer to future phase
- **Storage abstraction** — Defer to future if PostgreSQL support needed

---

## Execution Order (Recommended)

### Sprint 1: Quick Wins (Phases 01-03)
Low effort, high value — immediate UX improvements.

### Sprint 2: CSS & Fixes (Phases 04, 07)
Present mode consistency and bug fixes.

### Sprint 3: New Elements (Phases 05-06)
New element types — the biggest feature additions.

### Sprint 4: Infrastructure (Phase 08)
Upload dedup and file browser.

### Sprint 5: Verification (Phase 09)
Full integration testing and regression checks.

---

## Estimated Total Effort

| Sprint | Phases | Estimated LOC | Estimated Time |
|--------|--------|---------------|----------------|
| Sprint 1 | 01-03 | ~300 new, ~200 modified | 2-3 hours |
| Sprint 2 | 04, 07 | ~100 new, ~300 modified | 2-3 hours |
| Sprint 3 | 05-06 | ~1500 new, ~200 modified | 4-6 hours |
| Sprint 4 | 08 | ~300 new, ~100 modified | 2-3 hours |
| Sprint 5 | 09 | ~200 new (tests) | 2-3 hours |
| **Total** | **01-09** | **~2400 new, ~800 modified** | **12-18 hours** |
