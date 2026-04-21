# Project Overview & PDR — NavSlides Editor

## Product Vision

**NavSlides Editor** is a self-hostable, WYSIWYG presentation editor powered by reveal.js. Users build, edit, and present slides entirely in the browser — no account, no cloud, no tracking. Available as a web app (Docker / Node.js) and a standalone desktop app via Electron.

## Problem Statement

Existing tools (Google Slides, PowerPoint) require cloud accounts or lack developer-friendly features (LaTeX, code, TikZ). NavSlides Editor bridges the gap with a **privacy-first, self-hosted** alternative offering rich element support and multiple export formats.

## Target Users

| Persona                    | Need                                                         |
| -------------------------- | ------------------------------------------------------------ |
| Academics / Researchers    | LaTeX math, TikZ diagrams, code blocks                       |
| Developers / Tech speakers | Syntax highlighting, HTML embeds, self-contained HTML export |
| Privacy-conscious users    | No tracking, data stays local, self-hosted                   |
| Students                   | Free, lightweight, runs offline via Electron                 |

## Core Value Propositions

1. **Privacy-first** — All data in local JSON files + filesystem. Zero telemetry.
2. **Rich elements** — 15+ element types: text, image, shape, html, code, latex, markdown, chart, callout, icon, video, audio, table, qr, divider.
3. **WYSIWYG editing** — Direct on-canvas editing via TipTap, smart guides, snapping, rulers.
4. **Multiple deployment models** — Docker, Node.js, Electron desktop app.
5. **Export flexibility** — HTML, offline HTML, PDF, PPTX, shareable links, GitHub push.
6. **Cloud sync** — rclone-based sync to Proton Drive or any supported provider.

## Feature Categories

### Editing

- WYSIWYG click-to-edit with TipTap rich text
- Multi-select, group/ungroup, align/distribute
- Drag, resize (with aspect-ratio lock), rotate elements
- Smart guides with 6px snap threshold
- Rulers and persistent drag-from-ruler guide lines
- Undo/redo (50-step history via historyRef)
- Find & replace across all slides (Ctrl+F)
- Auto-save with 1500ms debounce
- Copy/cut/paste/duplicate elements

### Elements (14 types)

| Type     | Description                                            |
| -------- | ------------------------------------------------------ |
| text     | TipTap rich HTML content                               |
| image    | Upload or URL, crop, pan, filters, round corners       |
| shape    | Rectangle, circle, triangle, arrow, star, line         |
| html     | Arbitrary HTML/CSS/JS in iframe                        |
| code     | Syntax-highlighted, 10 themes, 25+ languages           |
| latex    | Full LaTeX math + TikZ via KaTeX / TikZJax             |
| markdown | Raw Markdown rendered to HTML                          |
| chart    | Bar, line, pie, doughnut, radar, polar area (Chart.js) |
| callout  | Numbered annotation circles                            |
| icon     | 60+ Lucide-style SVG icons                             |
| video    | URL or upload, autoplay/loop/muted                     |
| audio    | URL or upload with playback controls                   |
| table    | Drag/resize table with inline cell editing             |
| qr       | QR Code generator for URLs or text                     |
| divider  | Visual dividing line with adjustable thickness/color   |

### Slides

- 8 slide templates: blank, title, two-column, three-column, image+text, section header, comparison, big number
- Advanced Interactive templates: interactive simulations, comparative analysis, and quizzes
- Per-slide background: solid color, CSS gradient, or image
- Fragment animations with visual timeline editor
- Per-slide page numbers toggle, hidden slide support
- Footer system: basic (label + page number) or sequence mode (section titles)

### Themes & Transitions

- 11 reveal.js themes (black, white, league, beige, sky, night, serif, simple, solarized, moon, dracula)
- 6 transitions: none, fade, slide, convex, concave, zoom
- 6 preset design themes: Minimal Dark, Minimal Light, Academic, Gradient, Corporate, Neon
- Custom templates: create, edit, manage, start new presentations from templates
- Editor UI dark/light theme toggle (persisted in localStorage)

### Export & Sharing

| Format              | Notes                                             |
| ------------------- | ------------------------------------------------- |
| Present mode        | Full-screen reveal.js with speaker notes (S key)  |
| Export HTML         | Self-contained HTML file (CDN dependent)          |
| Export offline HTML | Inlines CDN resources for true offline support    |
| Export PDF          | Print layout, one page per slide                  |
| Export PPTX         | Via pptxgenjs (shape/media limitations)           |
| Shareable link      | UUID token, view-only public URL                  |
| GitHub push         | Git Data API, auto-generated README               |

### Cloud Sync

- rclone integration (Proton Drive, Google Drive, S3, etc.)
- Configure credentials in-app, sync single or all presentations
- Docker image includes rclone pre-installed

### Version History

- Named snapshots saved to `server/data/history/`
- Restore any snapshot, delete individual snapshots

## Deployment Models

| Model                | Use Case                              |
| -------------------- | ------------------------------------- |
| Docker (recommended) | Server deployment, persistent volumes |
| Node.js from source  | Development or lightweight server     |
| Electron desktop     | Standalone single-user desktop app    |

## Non-Goals

- No multi-user authentication or authorization
- No real-time collaboration
- No cloud-hosted SaaS version
- No mobile app
- No plugin/extension marketplace

## Acceptance Criteria (MVP)

- [ ] User can create, edit, and delete presentations
- [ ] All 14 element types render correctly in editor and export
- [ ] Present mode works with fragment animations and transitions
- [ ] Export HTML generates valid reveal.js presentation
- [ ] Docker deployment starts cleanly and data persists across restarts
- [ ] Electron desktop app works on Linux, macOS, Windows
- [ ] GitHub push creates correct repo structure
- [ ] Shareable links serve presentation without editor

## Known Limitations (Post-Refactor)

- `SlideCanvas.jsx` is 2421 LOC — complex canvas interaction, difficult to decompose further
- JSDoc types only (no full TypeScript migration)
- PPTX export skips chart, html, latex, video, audio, icon elements
- PPTX shapes all render as rectangles
- No auth — not suitable for multi-tenant hosting
- CDN dependency at runtime for standard HTML export and present mode

## Completed Refactoring (v1.4.x)

- ✅ EditorPage reduced from 3400 → 1475 LOC
- ✅ Zustand state management (3 stores)
- ✅ 6 custom hooks extracted
- ✅ PropertiesPanel decomposed into 8 sub-editors
- ✅ Zod request validation on all mutation endpoints
- ✅ CSS split from monolithic 57KB into modular files
- ✅ JSDoc type definitions for all data models
- ✅ Electron safeStorage for credential encryption
- ✅ ErrorBoundary for crash recovery
- ✅ DOMPurify + MIME validation + rate limiting
