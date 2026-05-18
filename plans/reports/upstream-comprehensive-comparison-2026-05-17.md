# Phân Tích Toàn Diện: NavSlidesEditor vs parallax-presentations

**Ngày**: 2026-05-17
**Local**: NavSlidesEditor v1.7.1 (https://github.com/xuan2261/NavSlidesEditor)
**Upstream**: Parallax v1.0.0 (https://github.com/jbirky/parallax-presentations)
**Remote**: `upstream -> https://github.com/jbirky/parallax-presentations.git`

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [So Sánh Cấu Trúc File & Directory](#2-so-sánh-cấu-trúc-file--directory)
3. [So Sánh Dependencies & Config](#3-so-sánh-dependencies--config)
4. [So Sánh Từng File Chính](#4-so-sánh-từng-file-chính)
5. [Phân Tích Từng Commit Upstream](#5-phân-tích-từng-commit-upstream)
6. [Danh Mục Element Types](#6-danh-mục-element-types)
7. [CSS Evolution Chain](#7-css-evolution-chain)
8. [Rủi Ro & Conflict Assessment](#8-rủi-ro--conflict-assessment)
9. [Chiến Lược Port](#9-chiến-lược-port)
10. [Thứ Tự Thực Hiện](#10-thứ-tự-thực-hiện)

---

## 1. Tổng Quan Kiến Trúc

### 1.1 Khác Biệt Cốt Lõi

| Khía cạnh | NavSlidesEditor (Local) | Parallax (Upstream) |
|-----------|------------------------|---------------------|
| **Tên package** | `navslides-editor` v1.7.1 | `revealjs-editor` v1.0.0 |
| **Workspaces** | `["server", "client", "shared"]` | `["server", "client"]` |
| **Shared module** | Có (`shared/src/`) — 14 files | **KHÔNG CÓ** — code inline trong client |
| **HTML Generation** | `shared/src/htmlGenerator.js` (584 LOC, CommonJS) | `client/src/utils/generateHTML.js` (1,141 LOC, ES module) |
| **State Management** | Zustand stores (3 stores) | useState/useCallback trong EditorPage |
| **Routing** | react-router-dom v7 | Manual page routing qua state |
| **Real-time** | Socket.IO (live presentation, remote control, speaker view) | **KHÔNG CÓ** Socket.IO |
| **Auth** | Không có | Clerk auth (`@clerk/clerk-react`, `@clerk/express`) |
| **Database** | JSON files | PostgreSQL (`pg`) + file storage |
| **Payments** | Không có | Stripe |
| **Storage** | Local filesystem | R2/S3 (`@aws-sdk/client-s3`) + local |
| **CSS Framework** | Tailwind CSS 3 | Inline styles (không có Tailwind) |
| **Test Infrastructure** | Vitest, Playwright, k6, ESLint, Prettier | **KHÔNG CÓ** test |
| **CI/CD** | ci.yml (lint+test+build+e2e) + release.yml (Windows) | release.yml (3 platforms) + docs.yml |
| **Plugin System** | Không có | Có (`plugins/`, `client/src/plugins/`) |
| **Docs Site** | Không có | VitePress docs site |

### 1.2 Thống Kê Kích Thước

| File | Local (LOC) | Upstream (LOC) | Chênh lệch |
|------|-------------|----------------|-----------|
| `client/src/utils/generateHTML.js` | 9 | 1,141 | +1,132 |
| `shared/src/htmlGenerator.js` | 584 | 0 (deleted) | -584 |
| `shared/src/element-renderers.js` | 564 | 0 (deleted) | -564 |
| `shared/src/shapeUtils.js` | 108 | 0 (deleted) | -108 |
| `shared/src/presenterTools.js` | 322 | 0 (deleted) | -322 |
| `client/src/components/Toolbar.jsx` | 1,294 | 1,379 | +85 |
| `client/src/components/PropertiesPanel.jsx` | 472 | 1,948 | +1,476 |
| `client/src/components/SlideCanvas.jsx` | 628 | 2,245 | +1,617 |
| `client/src/pages/EditorPage.jsx` | 1,952 | 3,489 | +1,537 |
| `server/index.js` | 323 | 2,038 | +1,715 |

---

## 2. So Sánh Cấu Trúc File & Directory

### 2.1 Top-Level Directories

| Directory | Local | Upstream | Ghi chú |
|-----------|-------|----------|---------|
| `.github/` | ✅ | ✅ | Khác workflows |
| `PPTX/` | ✅ | ❌ | Local-only (test data) |
| `build/` | ✅ | ❌ | Local-only (icons) |
| `client/` | ✅ | ✅ | Cấu trúc con khác nhau |
| `docs/` | ✅ | ✅ | Local: project docs. Upstream: VitePress site |
| `electron/` | ✅ | ✅ | |
| `guides/` | ✅ | ❌ | Local-only |
| `node_modules/` | ❌ (gitignored) | ✅ (tracked!) | Upstream track node_modules |
| `plans/` | ✅ | ❌ | Local-only |
| `plugins/` | ❌ | ✅ | Upstream-only |
| `scripts/` | ✅ | ✅ | |
| `server/` | ✅ | ✅ | Cấu trúc con khác nhau |
| `sessions/` | ✅ | ❌ | Local-only |
| `shared/` | ✅ | ❌ | **LOCAL-ONLY** — kiến trúc cốt lõi |
| `slides.com/` | ✅ | ❌ | Local-only |
| `tests/` | ✅ | ❌ | Local-only |

### 2.2 client/src/ Subdirectories

| Directory | Local | Upstream | Ghi chú |
|-----------|-------|----------|---------|
| `components/` | ✅ (100+ files) | ✅ (12 files) | Upstream xóa ~90% components |
| `components/canvas/` | ✅ (34 files) | ❌ | Local-only |
| `components/properties/` | ✅ (14 files) | ❌ | Local-only |
| `components/ui/` | ✅ (6 files) | ❌ | Local-only |
| `components/layout/` | ✅ (2 files) | ❌ | Local-only |
| `components/dashboard/` | ✅ (2 files) | ❌ | Local-only |
| `constants/` | ✅ | ❌ | |
| `contexts/` | ✅ | ❌ | |
| `data/` | ✅ | ❌ | Upstream inline vào EditorPage |
| `extensions/` | ✅ | ✅ | |
| `hooks/` | ✅ (31 files) | ❌ (empty) | Upstream xóa hết hooks |
| `lib/` | ✅ | ❌ | |
| `pages/` | ✅ (8 files) | ✅ (3 files) | Upstream chỉ có Editor, Home, Landing |
| `plugins/` | ❌ | ✅ (5 files) | Upstream-only |
| `services/` | ✅ | ❌ | |
| `stores/` | ✅ (6 files) | ❌ | Upstream dùng useState |
| `utils/` | ✅ (58 files) | ✅ (8 files) | Upstream gọn hơn nhiều |

### 2.3 server/ Subdirectories

| Directory | Local | Upstream | Ghi chú |
|-----------|-------|----------|---------|
| `data/` | ✅ | ✅ | |
| `middleware/` | ✅ (3 files) | ✅ (1 file) | |
| `migrations/` | ❌ | ✅ (6 files) | Upstream-only (PostgreSQL) |
| `routes/` | ✅ (26 files) | ❌ | Upstream inline vào index.js |
| `scripts/` | ✅ | ❌ | |
| `services/` | ✅ (38 files) | ✅ (3 files) | Upstream chỉ có r2, stripe, upload |
| `storage/` | ❌ | ✅ (4 files) | Upstream-only (storage abstraction) |
| `uploads/` | ✅ | ✅ | |
| `utils/` | ✅ | ❌ | |

### 2.4 Files Local Có Mà Upstream KHÔNG Có (bị xóa)

**Components bị xóa (42+ files):**
- `AICopywriterModal.jsx`, `AIGeneratorModal.jsx`, `AITranslateModal.jsx`
- `AnalyticsModal.jsx`, `AnimationPreviewModal.jsx`
- `CSSEditorModal.jsx`, `CodeEditorModal.jsx`
- `CollapsibleSection.jsx`, `DropdownMenu.jsx`, `EditorMenuBar.jsx`
- `ErrorBoundary.jsx`, `GitHubPushModal.jsx`, `HistoryModal.jsx`
- `HtmlEditorModal.jsx`, `InsertMenu.jsx`, `LatexEditorModal.jsx`
- `LivePresentationModal.jsx`, `MediaLibraryModal.jsx`
- `MiniToolbar.jsx`, `PresentationTouchOverlay.jsx`
- `ProductTour.jsx`, `PromptPopover.jsx`
- `QuickAccessToolbar.jsx`, `SelectionPane.jsx`, `ShareModal.jsx`
- `SlideSorterView.jsx`, `SlideThumbnail.jsx`
- `SyncModal.jsx`, `TemplatePickerModal.jsx`
- `command-palette.jsx`, `laser-pointer.jsx`
- `annotation-canvas.jsx`, `annotation-toolbar.jsx`
- `black-screen-overlay.jsx`, `game-hud-overlay.jsx`, `game-leaderboard-overlay.jsx`
- `timeline-element.jsx`, `timeline-expanded-details.jsx`
- `file-browser-modal-to-select-and-insert-media.jsx`

**Hooks bị xóa (29 files):**
- `use-autosave.js`, `use-keyboard.js`, `use-clipboard.js`, `use-slide-operations.js`
- `use-live-presentation.js`, `use-live-timer.js`, `use-live-timer-sync.js`
- `use-reveal-preview-frame.js`, `use-pinch-zoom.js`, `use-touch-gestures.js`
- `use-swipe-navigation.js`, `use-annotation-sync.js`
- `use-element-cycle-through-slide-elements-hook.js`
- `use-game-player.js`, `use-game-socket.js`
- Tất cả test files

**Stores bị xóa (3 files):**
- `editor-store.js`, `presentation-store.js`, `ui-store.js`

**Pages bị xóa (5 files):**
- `ExplorePage.jsx`, `LiveViewPage.jsx`, `RemoteControlPage.jsx`
- `SettingsPage.jsx`, `SpeakerViewPage.jsx`, `game-player-join-page.jsx`

**Server routes bị xóa (26 files):**
- Toàn bộ `server/routes/` directory

### 2.5 Files Upstream Có Mà Local KHÔNG Có (thêm mới)

- `client/src/components/AnimeModal.jsx`, `DocsPage.jsx`, `KineticTextModal.jsx`, `MathGridModal.jsx`, `ThreeModal.jsx`
- `client/src/extensions/FontWeight.js`, `LineHeight.js`
- `client/src/plugins/` (5 files)
- `client/src/utils/drawingUtils.js`, `latexRenderer.js`, `shapeUtils.js`
- `plugins/animated-counter/`, `plugins/manim/`
- `server/middleware/auth.js`
- `server/migrations/` (6 files)
- `server/storage/` (4 files)
- `server/services/r2.js`, `stripe.js`, `upload-service.js`
- `client/src/pages/LandingPage.jsx`

---

## 3. So Sánh Dependencies & Config

### 3.1 Root package.json

| Aspect | Local | Upstream |
|--------|-------|----------|
| **name** | `navslides-editor` | `revealjs-editor` |
| **version** | `1.7.1` | `1.0.0` |
| **workspaces** | `["server", "client", "shared"]` | `["server", "client"]` |
| **scripts: vendor** | `node scripts/copy-vendor.js` | ❌ |
| **scripts: postinstall** | `npm run vendor` | ❌ |
| **scripts: format** | `prettier --write .` | ❌ |
| **scripts: lint** | `eslint .` | ❌ |
| **scripts: test** | `vitest run` | ❌ |
| **scripts: test:e2e** | `playwright test` | ❌ |
| **scripts: test:load:ws** | `k6 run tests/load/websocket-load.js` | ❌ |
| **scripts: test:load:api** | `k6 run tests/load/api-load.js` | ❌ |

### 3.2 client/package.json

**Local có, upstream KHÔNG có:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@clerk/clerk-react` | ❌ (local) | Upstream: auth |
| `autoprefixer` | `^10.5.0` | CSS processing |
| `canvas-confetti` | `^1.9.4` | Gamification |
| `clsx` | `^2.1.1` | Class names |
| `marked` | `^18.0.0` | Markdown |
| `pdfjs-dist` | `^5.6.205` | PDF import |
| `postcss` | `^8.5.10` | CSS processing |
| `qrcode` | `^1.5.4` | QR code generation |
| `react-joyride` | `^3.0.2` | Product tour |
| `react-router-dom` | `^7.14.1` | Routing |
| `revealjs-shared` | `*` (workspace) | Shared module |
| `socket.io-client` | `^4.8.3` | Real-time |
| `tailwind-merge` | `^3.5.0` | Tailwind utils |
| `tailwindcss` | `^3.4.19` | CSS framework |
| `zustand` | `^5.0.12` | State management |

### 3.3 server/package.json

**Local có, upstream KHÔNG có:**
| Package | Purpose |
|---------|---------|
| `@drgrice1/tikzjax` | TikZ rendering |
| `bcryptjs` | Password hashing |
| `dompurify` | HTML sanitization |
| `express-rate-limit` | Rate limiting |
| `file-type` | File type detection |
| `jsdom` | Server-side DOM |
| `jszip` | ZIP handling |
| `playwright` | Server-side rendering |
| `pptxgenjs`, `pptx2json`, `pptxtojson` | PPTX import/export |
| `revealjs-shared` | Shared module |
| `socket.io` | WebSocket server |
| `zod` | Schema validation |

**Upstream có, local KHÔNG có:**
| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-s3`, `@aws-sdk/lib-storage` | R2/S3 storage |
| `@clerk/express` | Auth middleware |
| `dotenv` | Environment config |
| `pg` | PostgreSQL |
| `stripe` | Payments |

### 3.4 Dockerfile

| Aspect | Local | Upstream |
|--------|-------|----------|
| **Prod base image** | `mcr.microsoft.com/playwright:v1.59.1-noble` | `node:20-alpine` |
| **Copies shared/** | ✅ (4 COPY lines) | ❌ |
| **Runs vendor** | ✅ (`npm run vendor`) | ❌ |
| **VITE args** | ❌ | `VITE_PARALLAX_MODE`, `VITE_CLERK_PUBLISHABLE_KEY` |
| **Prod packages** | rclone only | rclone + ffmpeg + libreoffice + poppler-utils |
| **Copies docs/** | ❌ | ✅ |
| **Copies plugins/** | ❌ | ✅ |

### 3.5 docker-compose.yml

| Aspect | Local | Upstream |
|--------|-------|----------|
| **Services** | 1 (`revealjs-editor`) | 3 (`parallax-stable`, `parallax-dev`, `cloudflared`) |
| **Build context** | `.` (local) | GitHub URLs |
| **Env vars** | ❌ | `PARALLAX_MODE=cloud`, `PARALLAX_DB=postgres`, `PARALLAX_STORAGE=r2` |
| **Cloudflare tunnel** | ❌ | ✅ |

### 3.6 electron-builder.yml

| Aspect | Local | Upstream |
|--------|-------|----------|
| **appId** | `com.navslides-editor.app` | `com.parallax.app` |
| **productName** | `NavSlides Editor` | `Parallax` |
| **Mac target** | `zip` only | `dmg` + `zip` |
| **Win target** | `nsis` + `portable` | `nsis` only |
| **NSIS config** | Full config | ❌ |

### 3.7 CI/CD Workflows

| Workflow | Local | Upstream |
|----------|-------|----------|
| **ci.yml** | ✅ (lint, vitest, build, playwright) | ❌ |
| **release.yml** | ✅ (Windows only) | ✅ (Linux + Mac + Windows) |
| **docs.yml** | ❌ | ✅ (VitePress deploy) |

---

## 4. So Sánh Từng File Chính

### 4.1 HTML Generation

**Local architecture:**
```
client/src/utils/generateHTML.js (9 lines — thin re-export wrapper)
    ↓ import * as shared from 'revealjs-shared'
shared/src/htmlGenerator.js (584 lines — CommonJS)
    ↓ require('./element-renderers.js')
shared/src/element-renderers.js (564 lines — CommonJS)
    ↓ require('./shapeUtils.js')
shared/src/shapeUtils.js (108 lines — CommonJS)
    ↓ require('./slideNotes.js')
shared/src/slideNotes.js (38 lines — CommonJS)
    ↓ require('./presenterTools.js')
shared/src/presenterTools.js (322 lines — CommonJS)
```

**Upstream architecture:**
```
client/src/utils/generateHTML.js (1,141 lines — ES module, ALL inline)
    ↓ import from './shapeUtils'
client/src/utils/shapeUtils.js (77 lines — ES module)
    ↓ import from './drawingUtils'
client/src/utils/drawingUtils.js (NEW — Catmull-Rom splines)
```

**Key differences in generateHTML.js:**

| Feature | Local | Upstream |
|---------|-------|---------|
| CSS variables (`:root`) | ❌ | ✅ |
| Section font-size | `calc(16px * var(--font-zoom, 1))` | `42px` |
| Section line-height | ❌ | `1.4 !important` |
| Section overflow | `overflow:hidden` | `overflow:hidden !important` |
| Heading text-shadow reset | ❌ | ✅ |
| Code/pre/blockquote styles | ❌ | ✅ |
| Fragment visibility forcing | ❌ | ✅ |
| Custom fragment animations | ❌ | ✅ (slide/flip) |
| GSAP entry animations | ❌ | ✅ (12 presets) |
| Custom transitions | ❌ | ✅ (differential-rotation) |
| Image popup/expand | ❌ | ✅ |
| Citation styles | ❌ | ✅ |
| Fullscreen button | ❌ | ✅ |
| Time widget | ❌ | ✅ |
| 2D slide navigation | ❌ | ✅ (columns) |
| Slide groups | ❌ | ✅ (shared page numbers) |
| Side citations | ❌ | ✅ |
| CDN links | ❌ (`/vendor/` local) | ✅ (cdn.jsdelivr.net) |
| Google Fonts loading | ❌ | ✅ (50+ fonts) |
| PDF export | Basic | Fragment expansion |
| `downloadSlideHTML()` | ❌ | ✅ |
| `previewSlideInWindow()` | ❌ | ✅ |

### 4.2 Element Renderers

**Local (`shared/src/element-renderers.js`, 564 lines):**
- 18 renderers: text, image, shape, code, html, markdown, chart, callout, icon, latex, video, audio, table, drawing, line, svg, qrcode, timeline
- Separated into individual functions
- CommonJS exports

**Upstream (inline in `generateHTML.js`):**
- 25+ element types: text, image, shape, html, p5, code, markdown, chart, timeline, callout, icon, latex (3 sub-types: katex, tikz, table), video (with trim/speed), manim, audio, table, textpath, drawing, d3, modular-grid, kinetic-text, anime, three, math-grid, plugin:*
- All inline in one massive function
- No separation

### 4.3 Shape Utils

**Local (`shared/src/shapeUtils.js`, 108 lines):**
```
rect, rounded-rect, circle, triangle, diamond, arrow-right, star, line,
hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket
```
(15 shapes)

**Upstream (`client/src/utils/shapeUtils.js`, 77 lines):**
```
rect, rounded-rect, circle, triangle, diamond, arrow-right, star, line, line-arrow
```
(9 shapes)

**Local có mà upstream không có:** hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket (7 shapes)
**Upstream có mà local không có:** line-arrow (1 shape)

### 4.4 PropertiesPanel.jsx

| Aspect | Local (472 LOC) | Upstream (1,948 LOC) |
|--------|-----------------|---------------------|
| **Architecture** | Router → sub-panels (ShapeProperties, ImageProperties, etc.) | All inline trong 1 file |
| **Sub-panels** | 14 files trong `properties/` | Inline |
| **Timeline props** | Separate `timeline-properties.jsx` | Inline |
| **Game props** | Separate `game-properties.jsx` | ❌ |
| **Video trim/speed** | ❌ | ✅ |
| **LaTeX font size/color** | ❌ | ✅ |
| **Citation font settings** | ❌ | ✅ |
| **Fragment animations** | Basic | Extended (slide/flip/strike) |

### 4.5 Toolbar.jsx

| Aspect | Local (1,294 LOC) | Upstream (1,379 LOC) |
|--------|-------------------|---------------------|
| **Insert menu** | Dropdown with all element types | Similar but fewer types |
| **Video from URL** | ❌ | ✅ |
| **Ctrl+K link modal** | ❌ (uses PromptPopover) | ✅ (proper modal) |
| **Game insert** | ✅ | ❌ |
| **Annotation tools** | ✅ | ❌ |
| **Laser pointer** | ✅ | ❌ |
| **File browser** | ❌ | ✅ |
| **Plugins dropdown** | ❌ | ✅ |

### 4.6 SlideCanvas.jsx

| Aspect | Local (628 LOC) | Upstream (2,245 LOC) |
|--------|-----------------|---------------------|
| **Architecture** | Delegates to canvas/ sub-components (34 files) | All inline |
| **Element renderers** | 16 files trong `canvas/element-renderers/` | Inline switch |
| **Timeline renderer** | Separate file | Inline |
| **Game renderer** | 5 interactive game renderers | ❌ |
| **Image crop overlay** | Separate file | Inline |
| **Grid overlay** | Separate file | Inline |
| **Rulers** | Separate file | Inline |
| **Context menu** | Separate file | Inline |
| **Smart guides** | Separate file | Inline |

### 4.7 EditorPage.jsx

| Aspect | Local (1,952 LOC) | Upstream (3,489 LOC) |
|--------|-------------------|---------------------|
| **State management** | Zustand stores | All useState/useCallback |
| **Routing** | react-router-dom | Manual state |
| **Socket.IO** | ✅ (live rooms) | ❌ |
| **Game engine** | ✅ | ❌ |
| **Annotation** | ✅ | ❌ |
| **Command palette** | ✅ | ❌ |
| **Product tour** | ✅ | ❌ |
| **AI features** | ✅ | ❌ |
| **File browser** | ❌ | ✅ |
| **Plugin system** | ❌ | ✅ |
| **Slide templates** | Inline in data/ | Inline in EditorPage |
| **Element defaults** | Separate data/element-defaults.js | Inline |

### 4.8 server/index.js

| Aspect | Local (323 LOC) | Upstream (2,038 LOC) |
|--------|-----------------|---------------------|
| **Architecture** | Modular routes (26 files) | Monolithic |
| **Socket.IO** | ✅ | ❌ |
| **Auth** | ❌ | ✅ (Clerk) |
| **PostgreSQL** | ❌ | ✅ |
| **Stripe** | ❌ | ✅ |
| **R2/S3** | ❌ | ✅ |
| **PPTX import** | ✅ (dedicated service) | ❌ |
| **AI provider** | ✅ | ❌ |
| **Game engine** | ✅ | ❌ |
| **Rate limiting** | ✅ | ❌ |

---

## 5. Phân Tích Từng Commit Upstream

### 5.1 Thống Kê Diff

```
client/src/:  273 files changed, 14,312 insertions, 42,288 deletions
server/:      102 files changed,  3,340 insertions, 44,288 deletions
shared/:       23 files changed,          0 insertions,  7,209 deletions (XÓA HẲN)
electron/:      2 files changed,         29 insertions,    115 deletions
```

### 5.2 CSS Evolution Chain (apply theo thứ tự này)

Present mode CSS evolves through 11 commits chronologically:

1. **87bd4dff** — Add `overflow: hidden; contain: paint;`
2. **40c3687b** — Remove wildcard letter-spacing, heading sizes 2em/1.5em/1.17em
3. **af600bd8** — Heading sizes → 2.5em/1.6em/1.3em, add margins
4. **53173592** — em margins → px
5. **d800052a** — Remove `contain: paint`, add `section > * { overflow: hidden }`
6. **975bca4a** — Add `line-height: normal`, p/li/span inherit
7. **6ffa85ce** — Complete rewrite with CSS variables + `!important`
8. **1d6e1117** — Remove `!important` from p line-height
9. **fc2d1c7c** — Add `!important` to section line-height, remove p line-height
10. **6c3ef006** — font-size 42px → 16px
11. **f5e6dcaa** — font-size 16px → 42px (FINAL), line-height 1.4

**FINAL CSS state:**
```css
:root { --r-main-font-size: 42px; --r-block-margin: 0px; --r-heading-margin: 0 0 0.4em 0; --r-heading-text-transform: none; --r-heading-letter-spacing: normal; }
.reveal .slides section { padding: 0 !important; text-align: left !important; overflow: hidden !important; font-family: -apple-system, ...; line-height: 1.4 !important; text-transform: none; letter-spacing: normal; }
.reveal .slides section > * { overflow: hidden; }
.reveal p { margin: 0 0 0.4em !important; }
.reveal h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; }
.reveal h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; }
.reveal h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; }
.reveal h4 { font-size: 1em; font-weight: bold; line-height: 1.2; }
.reveal img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
.reveal pre { margin: 0 0 0.4em !important; width: auto !important; box-shadow: none !important; }
.reveal blockquote { margin: 0 0 0.4em !important; width: auto !important; box-shadow: none !important; font-style: normal; }
.reveal .slides section .fragment:not(.visible):not(.current-fragment) { opacity: 0 !important; visibility: hidden !important; }
```

### 5.3 Feature Commits Chi Tiết

#### LOW RISK (clean additions, dễ port):

| Commit | Feature | Files | Thay đổi |
|--------|---------|-------|----------|
| `ce548c53` | Line-arrow shape | SlideCanvas, EditorPage, shapeUtils | +shape type, +SVG renderer |
| `efcf2632` | Cropped images fix | SlideCanvas | +`position: 'relative'` vào clip div |
| `31d8ffbe` | Video from URL | Toolbar | +button trong Media dropdown |
| `fc2d1c7c` | Dense text spacing | generateHTML | +`!important` line-height |
| `69c8195b` | Phantom image timeline | generateHTML | Nested wrapper div |
| `1d6e1117` | Title slide spacing | generateHTML | Remove `!important` |
| `975bca4a` | Font spacing density | generateHTML | +line-height rules |
| `a8bc9ad6` | Fragments hidden | generateHTML | +CSS rule |
| `d800052a` | Overview mode fix | generateHTML | Remove `contain: paint` |
| `87bd4dff` | Cross-slide bleed | generateHTML | +overflow hidden |
| `5055f3ec` | Auto-animate leaking | generateHTML | +`data-auto-animate-unmatched` |
| `53173592` | px vs em margins | generateHTML | CSS value changes |
| `6d971eb0` | LaTeX font color | PropertiesPanel, SlideCanvas, generateHTML | +color parameter |
| `856d206b` | Citation font color | PropertiesPanel, SlideCanvas, generateHTML | +citationColor |
| `93816b88` | Copy URL context menu | SlideCanvas | +button trong context menu |
| `f7a3a351` | Video speed control | PropertiesPanel, SlideCanvas, generateHTML | +playbackRate |

#### MEDIUM RISK (modifies existing code):

| Commit | Feature | Files | Thay đổi |
|--------|---------|-------|----------|
| `5a844115` | JSXGraph SVG fix | generateHTML, server | Sửa `buildHtmlEmbed` |
| `77f6b74b` | Iframes on animated slides | generateHTML, server | Wrap iframes trong div |
| `916a63df` | File browser | EditorPage, api, server | +API endpoint, +modal UI |
| `cde1b2e9` | HTML embed data URLs | generateHTML, server | Thay blob → data URL |
| `2913f7a6` | Ctrl+K link modal | Toolbar | +modal, +keyboard shortcut |
| `315eee97` | LaTeX font size | PropertiesPanel, SlideCanvas, generateHTML, latexRenderer | +scale transform |
| `0e7196b6` | Citation font settings | EditorPage, SlideCanvas, generateHTML | +global settings |
| `a388d35b` | Video trimming | PropertiesPanel, SlideCanvas, generateHTML | +start/end time |
| `8050b08a` | Fragment animations | AnimationTimeline, PropertiesPanel, generateHTML | +new animation types |
| `fe5deaae` | Timeline click-to-expand | PropertiesPanel, SlideCanvas, generateHTML | +expand functionality |
| `778a7646` | BCE dates | PropertiesPanel, SlideCanvas, generateHTML | +negative year support |

#### HIGH RISK (large changes, nhiều conflict):

| Commit | Feature | Files | Thay đổi |
|--------|---------|-------|----------|
| `6ffa85ce` | Comprehensive theme override | generateHTML, server | Large CSS block replacement |
| `f5e6dcaa` | Font-size 42px | generateHTML, index.css, server | CSS variable + section style |
| `edfc1ba5` | LaTeX KaTeX direct render | generateHTML, server | Major LaTeX pipeline change |
| `9d3288ea` | Timeline element | PropertiesPanel, SlideCanvas, Toolbar, EditorPage, generateHTML, server | Large new feature |

---

## 6. Danh Mục Element Types

### 6.1 Element Types Comparison

| Element Type | Local | Upstream | Ghi chú |
|-------------|-------|----------|---------|
| `text` | ✅ | ✅ | |
| `image` | ✅ | ✅ | |
| `shape` | ✅ | ✅ | |
| `code` | ✅ | ✅ | |
| `latex` | ✅ | ✅ | Upstream có 3 sub-types |
| `html` | ✅ | ✅ | |
| `markdown` | ✅ | ✅ | |
| `chart` | ✅ | ✅ | |
| `video` | ✅ | ✅ | Upstream có trim/speed |
| `audio` | ✅ | ✅ | |
| `table` | ✅ | ✅ | |
| `icon` | ✅ | ✅ | |
| `callout` | ✅ | ✅ | |
| `qrcode` | ✅ | ✅ | |
| `drawing` | ✅ | ✅ | |
| `line` | ✅ | ✅ | |
| `svg` | ✅ | ✅ | |
| `timeline` | ✅ | ✅ | |
| `game` | ✅ (7 sub-types) | ❌ | Local-only |
| `textpath` | ❌ | ✅ | Upstream-only |
| `p5` | ❌ | ✅ | Upstream-only |
| `d3` | ❌ | ✅ | Upstream-only |
| `manim` | ❌ | ✅ | Upstream-only |
| `modular-grid` | ❌ | ✅ | Upstream-only |
| `kinetic-text` | ❌ | ✅ | Upstream-only |
| `anime` | ❌ | ✅ | Upstream-only |
| `three` | ❌ | ✅ | Upstream-only |
| `math-grid` | ❌ | ✅ | Upstream-only |
| `plugin:*` | ❌ | ✅ | Upstream-only |

### 6.2 Shape Types Comparison

| Shape | Local | Upstream |
|-------|-------|----------|
| rect | ✅ | ✅ |
| rounded-rect | ✅ | ✅ |
| circle | ✅ | ✅ |
| triangle | ✅ | ✅ |
| diamond | ✅ | ✅ |
| arrow-right | ✅ | ✅ |
| star | ✅ | ✅ |
| line | ✅ | ✅ |
| line-arrow | ❌ | ✅ |
| hexagon | ✅ | ❌ |
| pentagon | ✅ | ❌ |
| cloud | ✅ | ❌ |
| cylinder | ✅ | ❌ |
| parallelogram | ✅ | ❌ |
| trapezoid | ✅ | ❌ |
| bracket | ✅ | ❌ |

---

## 7. CSS Evolution Chain

### 7.1 Present Mode CSS — Final State

```css
/* CSS Variables */
:root {
  --r-main-font-size: 42px;
  --r-block-margin: 0px;
  --r-heading-margin: 0 0 0.4em 0;
  --r-heading-text-transform: none;
  --r-heading-letter-spacing: normal;
}

/* Section base */
.reveal .slides section {
  padding: 0 !important;
  text-align: left !important;
  overflow: hidden !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.4 !important;
  text-transform: none;
  letter-spacing: normal;
}
.reveal .slides section > * { overflow: hidden; }

/* Typography */
.reveal p { margin: 0 0 0.4em !important; }
.reveal h1, .reveal h2, .reveal h3, .reveal h4, .reveal h5, .reveal h6 {
  margin: 0 0 0.4em !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  text-shadow: none !important;
}
.reveal h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; }
.reveal h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; }
.reveal h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; }
.reveal h4 { font-size: 1em; font-weight: bold; line-height: 1.2; }
.reveal ul, .reveal ol { padding-left: 1.5em; margin: 0 0 0.4em; }
.reveal li { margin-bottom: 0.2em; line-height: inherit; }
.reveal span { line-height: inherit; }
.reveal a { text-decoration: underline; }

/* Media */
.reveal img {
  margin: 0 !important; border: none !important;
  background: none !important; box-shadow: none !important;
  max-width: none !important; max-height: none !important;
}

/* Code */
.reveal code { background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 3px; }
.reveal pre {
  background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 6px;
  margin: 0 0 0.4em !important; overflow: auto;
  width: auto !important; box-shadow: none !important;
}
.reveal pre code { background: none; padding: 0; }
.reveal blockquote {
  border-left: 3px solid rgba(255,255,255,0.3); padding-left: 16px; opacity: 0.8;
  margin: 0 0 0.4em !important; width: auto !important;
  box-shadow: none !important; font-style: normal;
}

/* Fragment visibility */
.reveal .slides section .fragment:not(.visible):not(.current-fragment) {
  opacity: 0 !important; visibility: hidden !important;
}

/* Custom fragment animations */
.fragment.slide-up { transform: translateY(40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-down { transform: translateY(-40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-left { transform: translateX(40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-right { transform: translateX(-40px); transition: transform 0.5s ease, opacity 0.5s ease; }
.fragment.slide-up, .fragment.slide-down, .fragment.slide-left, .fragment.slide-right { opacity: 0; }
.fragment.slide-up.visible, .fragment.slide-down.visible, .fragment.slide-left.visible, .fragment.slide-right.visible { transform: none; opacity: 1; }
.fragment.flip-up { transform: perspective(600px) rotateX(90deg); opacity: 0; transition: transform 0.6s ease, opacity 0.3s ease; }
.fragment.flip-down { transform: perspective(600px) rotateX(-90deg); opacity: 0; transition: transform 0.6s ease, opacity 0.3s ease; }
.fragment.flip-up.visible, .fragment.flip-down.visible { transform: none; opacity: 1; }
```

---

## 8. Rủi Ro & Conflict Assessment

### 8.1 Rủi Ro Kiến Trúc

| Rủi ro | Mức độ | Chi tiết | Mitigation |
|--------|--------|----------|-----------|
| **Shared module xóa** | CAO | Upstream xóa toàn bộ `shared/`. Không thể cherry-pick. | Port logic vào shared, không xóa |
| **CSS oscillation** | CAO | 11 commits sửa cùng CSS block, có commit đảo ngược commit trước | Chỉ áp dụng FINAL state |
| **LaTeX pipeline change** | CAO | edfc1ba5 thay đổi hoàn toàn cách render LaTeX | Áp dụng thủ công, test kỹ |
| **Timeline feature** | CAO | 200+ dòng code mới, 6 commit fix bug | Làm cuối, test kỹ |
| **EditorPage bloat** | TB | Upstream EditorPage 3,489 LOC (vi phạm 200 LOC guideline) | Giữ kiến trúc modular của local |
| **No tests upstream** | TB | Upstream xóa hết test files | Giữ nguyên test infrastructure |
| **CDN vs Local** | TB | Upstream dùng CDN, local dùng /vendor/ | Dùng hybrid |
| **GSAP dependency** | TB | Upstream dùng GSAP, local không có | Chỉ dùng trong export HTML |
| **Font loading** | THẤP | Upstream load 50+ Google Fonts | Load thông minh |

### 8.2 Conflict Matrix

| File | Số commit sửa | Conflict risk | Ghi chú |
|------|--------------|---------------|---------|
| `generateHTML.js` / `htmlGenerator.js` | 20+ | CAO | CSS evolution chain |
| `SlideCanvas.jsx` | 15+ | CAO | Element renderers inline |
| `PropertiesPanel.jsx` | 10+ | TB | New properties |
| `Toolbar.jsx` | 5+ | TB | New buttons |
| `EditorPage.jsx` | 5+ | TB | State changes |
| `server/index.js` | 10+ | CAO | Monolithic |
| `shapeUtils.js` | 2 | THẤP | Clean addition |
| `element-renderers.js` | 0 | THẤP | Không có trong upstream |

---

## 9. Chiến Lược Port

### 9.1 Nguyên Tắc

1. **GIỮ nguyên kiến trúc shared module** — Không migrate sang client-only
2. **GIỮ nguyên test infrastructure** — Không xóa tests
3. **GIỮ nguyên modular server** — Không inline routes vào index.js
4. **GIỮ nguyên Tailwind CSS** — Không chuyển sang inline styles
5. **GIỮ nguyên Zustand stores** — Không chuyển sang useState
6. **GIữ nguyên Socket.IO** — Không xóa live presentation
7. **Port logic, không port architecture** — Lấy features, giữ design patterns

### 9.2 Mapping File

| Upstream file | → Local file(s) | Ghi chú |
|--------------|-----------------|---------|
| `client/src/utils/generateHTML.js` (CSS) | `shared/src/htmlGenerator.js` | Port CSS vào `<style>` block |
| `client/src/utils/generateHTML.js` (element renderers) | `shared/src/element-renderers.js` | Port per-type renderers |
| `client/src/utils/shapeUtils.js` | `shared/src/shapeUtils.js` | Add `line-arrow` |
| `client/src/components/SlideCanvas.jsx` (timeline) | `client/src/components/canvas/element-renderers/timeline-element-renderer.jsx` | Already exists |
| `client/src/components/SlideCanvas.jsx` (video) | `client/src/components/canvas/element-renderers/` | Update existing |
| `client/src/components/PropertiesPanel.jsx` | `client/src/components/properties/` sub-panels | Update existing |
| `client/src/components/Toolbar.jsx` | Same file | Add buttons |
| `client/src/pages/EditorPage.jsx` | Same file | Add callbacks |
| `server/index.js` | `server/routes/` + `server/services/` | Modular |

---

## 10. Thứ Tự Thực Hiện

### Phase 1: CSS Overrides (1-2 giờ)
```
Files: shared/src/htmlGenerator.js
Risk: THẤP (chỉ thêm CSS rules)

- Thêm CSS variables (:root)
- Thêm section overflow + line-height
- Thêm heading text-shadow reset
- Thêm code/pre/blockquote styles
- Thêm fragment visibility forcing
- Thêm img reset
```

### Phase 2: Shape + Fragment Animations (1 giờ)
```
Files: shared/src/shapeUtils.js, shared/src/htmlGenerator.js
Risk: THẤP

- Thêm line-arrow shape
- Thêm custom fragment animations (slide/flip)
```

### Phase 3: Present Mode Fixes (2-3 giờ)
```
Files: shared/src/element-renderers.js, shared/src/htmlGenerator.js
Risk: TB

- HTML embed data URLs (thay blob/srcdoc)
- LaTeX KaTeX direct render
- Auto-animate unmatched fix
- Iframe wrapper divs fix
```

### Phase 4: Video + LaTeX + Citation (3-4 giờ)
```
Files: shared/src/element-renderers.js, client/src/components/properties/*.jsx, Toolbar.jsx
Risk: TB

- Video from URL + trim + speed
- LaTeX font size + color
- Citation font settings + color
- Copy URL context menu
```

### Phase 5: GSAP + Interactions + Time Widget (2-3 giờ)
```
Files: shared/src/htmlGenerator.js, shared/src/element-renderers.js
Risk: TB

- GSAP entry animations (CDN trong export)
- Image popup/expand interactions
- Time widget (clock/timer)
- Fullscreen button
```

### Phase 6: PDF Export + Misc (2-3 giờ)
```
Files: client/src/utils/generateHTML.js, shared/src/htmlGenerator.js
Risk: TB

- PDF export fragment expansion
- downloadSlideHTML()
- previewSlideInWindow()
- Ctrl+K link modal
```

### Phase 7: Timeline (8-12 giờ)
```
Files: Multiple (SlideCanvas, PropertiesPanel, Toolbar, EditorPage, element-renderers)
Risk: CAO

- Timeline renderer (SVG)
- Timeline properties panel
- Timeline HTML export
- Click-to-expand
- BCE dates
- Tick spacing
```

### Command Reference

```bash
# Fetch latest upstream
git fetch upstream

# Xem file thay đổi
git diff --name-only HEAD..upstream/main -- <path>

# Xem diff cho file cụ thể
git show upstream/main:<filepath>

# Xem diff cho commit cụ thể
git show <sha>

# Xem diff stats
git diff --stat HEAD..upstream/main -- <path>

# Kiểm tra sau mỗi thay đổi
npm run build && npm run test
```

---

## Appendix: Danh Sách Đầy Đủ Commit Upstream

```
ce548c53 add line-arrow shape: stroke-only arrow with no fill
efcf2632 fix cropped images showing full image in editor by adding position:relative to clip div
31d8ffbe add video from URL option and gitignore large media files
5a844115 fix JSXGraph lines not rendering: SVG fit script was overriding library-managed SVGs
77f6b74b fix iframes not rendering on animated slides by wrapping in container divs
f5e6dcaa fix present mode text density and callout alignment by matching editor font-size
fc2d1c7c fix dense text spacing: force line-height:normal on section with !important
69c8195b fix phantom image from timeline: position:relative was overriding position:absolute
4e225d27 add SHA-256 deduplication for file uploads
916a63df add file browser to browse uploaded files in the editor
1d6e1117 fix title slide spacing: remove !important from p line-height override
6ffa85ce comprehensive reveal.js theme override to match editor exactly
975bca4a fix font spacing density and callout position in present mode
a8bc9ad6 force fragments hidden with !important until reveal.js triggers them
d800052a fix overview mode: remove contain:paint that broke reveal.js overview
af600bd8 match export CSS exactly to editor CSS for text spacing consistency
40c3687b fix edit vs present mode dimension/position mismatches
87bd4dff fix cross-slide image bleed: add overflow hidden and contain paint to sections
72368382 add interactive hint text below demo slide on landing page
5055f3ec fix auto-animate elements leaking to non-auto-animate slides
6c3ef006 fix text spacing mismatch: change section font-size from 42px to 16px
2e280692 timeline top items: reorder to label/description/date, remove text-image gap
56067fde timeline: put text above image for top-side items so image connects to line
cde1b2e9 fix HTML embeds in present mode: use data URLs instead of blob URLs
b69202d8 fix cropped image showing overflow when citation text is present
3471ab66 add per-event connector length offset for timeline items
2ba20cd3 fix React not defined: extract timeline into proper component
fe5deaae timeline: click-to-expand events, detailed description, 45° tick labels
778a7646 support negative years in timeline (BCE dates)
93816b88 add Copy URL to right-click context menu for image and video elements
347d6ad8 fix HTML embeds not showing in present mode: use blob URLs instead of srcdoc
53173592 fix editor vs present mode position mismatch: use px instead of em for margins
edfc1ba5 fix LaTeX blocks in present mode: render directly with KaTeX instead of srcdoc iframe
315eee97 add font size control for LaTeX/TikZ elements
0e7196b6 add global citation font size and font family settings
2913f7a6 add Ctrl+K link modal for embedding links in text
515b607c fix citation text clipped in editor by overflow hidden
6d971eb0 add font color picker for LaTeX elements
a6f42a8b timeline start/end date selects match tick spacing intervals
856d206b add citation font color picker for image elements
78b62e53 add configurable timeline tick spacing with year-only labels for long ranges
5177e11b fix missing Clock import in Toolbar
9d3288ea add timeline element with date range, events, images, and export
a388d35b add video start/end time trimming controls
f7a3a351 add .ogv video support and playback speed control
8050b08a add slide/flip/strike fragment animations to properties panel and export
```
