# Phase 1: Parallax Presentations Repo Analysis

**Date:** 2026-05-16
**Source:** https://github.com/jbirky/parallax-presentations
**Target:** NavSlidesEditor (current project)

---

## 1. Executive Summary

`parallax-presentations` is a **fork/sibling** of NavSlidesEditor — same reveal.js WYSIWYG editor concept, same monorepo structure (`client/` + `server/` + `electron/`). The repo has **50 commits** (all since Jan 2025) with significant new features and bug fixes. It diverges in auth (Clerk), storage (PostgreSQL + R2), and billing (Stripe), but shares the core editor DNA.

**Port feasibility: HIGH** — core editor code is structurally identical. Features can be cherry-picked.

---

## 2. Architecture Comparison

| Aspect | NavSlidesEditor | parallax-presentations |
|--------|----------------|----------------------|
| **Monorepo** | npm workspaces (client, server, shared) | npm workspaces (client, server) — no `shared/` |
| **Client** | React + Vite + Zustand | React + Vite (no Zustand — state in components) |
| **Server** | Express, file-based JSON storage | Express, PostgreSQL + R2/S3 storage |
| **Auth** | None (self-hosted) | Clerk (cloud mode) + self-hosted mode |
| **Billing** | None | Stripe |
| **Desktop** | Electron | Electron |
| **License** | Not specified | AGPL-3.0 |
| **Docs** | External docs | Built-in DocsPage component + VitePress docs |

### Key Architectural Differences

1. **Storage abstraction** — parallax has `StorageInterface` + `PgStorage` + `FileStorage`. NavSlidesEditor uses direct file I/O.
2. **Auth middleware** — parallax has `middleware/auth.js` with Clerk integration. NavSlidesEditor has no auth.
3. **Plugin system** — parallax has full plugin architecture. NavSlidesEditor has none.
4. **State management** — NavSlidesEditor uses Zustand stores. parallax keeps state in React components.

---

## 3. New Features in parallax-presentations (not in NavSlidesEditor)

### 3.1 Element Types (NEW)

| Feature | Description | Port Effort |
|---------|-------------|-------------|
| **Timeline element** | Date range, events, images, configurable tick spacing, negative years (BCE), click-to-expand events, 45° tick labels | **Medium** — self-contained component |
| **Math Grid** | Parametric surface plots (Cartesian, Polar, Wave Mesh, Spiral, etc.) with 10 presets | **Low** — standalone modal |
| **Kinetic Text** | 10 animation templates (Typewriter, Word Reveal, Revolve, Wave, Split-Flap, Glitch, Bounce, etc.) | **Low** — standalone modal |
| **Anime.js animations** | 12 templates (Scatter Dots, Stagger Grid, Path Morph, Orbit, Wave Bars, Particle Burst, Fireworks, etc.) | **Low** — standalone modal |
| **Three.js 3D scenes** | 9 templates (Rotating Cube, Wireframe Sphere, Particle Cloud, Torus Knot, Wave Plane, Galaxy, Terrain, etc.) | **Low** — standalone modal |
| **Manim animations** | Python Manim → video rendering, embed on slides | **Medium** — needs server endpoint |
| **Line-arrow shape** | Stroke-only arrow with no fill | **Trivial** |

### 3.2 Plugin System (NEW)

| Component | File | Description |
|-----------|------|-------------|
| **PluginRegistry** | `client/src/plugins/PluginRegistry.js` | Central registry for element types, toolbar items, property panels, export hooks, data processors, commands |
| **PluginLoader** | `client/src/plugins/PluginLoader.js` | Fetches plugins from API, imports main modules, activates with context |
| **PluginContext** | `client/src/plugins/PluginContext.js` | Creates sandboxed context for plugin activation |
| **PluginSandbox** | `client/src/plugins/PluginSandbox.jsx` | Iframe-based sandbox for plugin rendering |
| **Server routes** | `server/index.js` | `/api/plugins`, `/api/plugins/:slug/install`, plugin assets serving |
| **Storage interface** | `server/storage/interface.js` | `listPlugins()`, `installPlugin()`, `getPluginStorage()`, etc. |
| **Bundled plugins** | `plugins/animated-counter/`, `plugins/manim/` | Two example plugins with `parallax-plugin.json` manifests |

### 3.3 Editor Features (NEW)

| Feature | Description | Port Effort |
|---------|-------------|-------------|
| **Font Weight control** | TipTap extension for `font-weight` (100-900) | **Trivial** |
| **Line Height control** | TipTap extension for `line-height` on paragraphs/headings/lists | **Trivial** |
| **Ctrl+K link modal** | Keyboard shortcut for embedding links in text | **Low** |
| **Font color for LaTeX** | Color picker for LaTeX/TikZ elements | **Low** |
| **Font size for LaTeX** | Font size control for LaTeX/TikZ elements | **Low** |
| **Citation font settings** | Global citation font size + font family + color picker | **Low** |
| **Video URL option** | Add video from URL (not just upload) | **Low** |
| **Video trimming** | Start/end time controls for video elements | **Low** |
| **Video playback speed** | Speed control for video playback | **Low** |
| **.ogv video support** | Additional video format support | **Trivial** |
| **Copy URL context menu** | Right-click → Copy URL for image/video elements | **Trivial** |
| **File browser** | Browse uploaded files in the editor | **Low** |
| **SHA-256 deduplication** | File upload dedup using content hash | **Low** |
| **Landing page** | Marketing landing page with features, plans, docs | **Low** |
| **DocsPage** | Built-in documentation viewer with markdown rendering | **Medium** |

### 3.4 Present Mode Fixes

| Fix | Commit | Description |
|-----|--------|-------------|
| Text density mismatch | `f5e6dca`, `fc2d1c7`, `975bca4`, `6c3ef00` | Force `line-height:normal`, match editor font-size |
| Callout alignment | `f5e6dca` | Match callout position in present mode |
| Fragment visibility | `a8bc9ad` | Force fragments hidden with `!important` until reveal.js triggers |
| Overview mode | `d800052` | Remove `contain:paint` that broke reveal.js overview |
| Auto-animate leak | `5055f3e` | Fix elements leaking to non-auto-animate slides |
| HTML embeds | `cde1b2e`, `347d6ad` | Use data URLs instead of blob URLs/srcdoc |
| LaTeX blocks | `edfc1ba` | Render directly with KaTeX instead of srcdoc iframe |
| Position mismatch | `40c3687`, `5317359` | Use px instead of em, fix edit vs present mode dimensions |
| Cross-slide bleed | `87bd4df` | Add overflow hidden and contain paint to sections |
| CSS consistency | `af600bd` | Match export CSS exactly to editor CSS |
| Theme override | `6ffa85c` | Comprehensive reveal.js theme override to match editor |

### 3.5 Timeline Element Details

The timeline element is the most complex new feature:
- Date range with configurable tick spacing
- Events with images, descriptions, click-to-expand
- Negative year support (BCE dates)
- 45° tick labels for long ranges
- Per-event connector length offset
- Text-above-image layout for top-side items
- Export support

### 3.6 Animation Timeline Enhancements

The `AnimationTimeline.jsx` component exists in both repos but parallax has:
- More animation types (23 vs fewer)
- Element color coding
- Better drag-and-drop reordering

---

## 4. Bug Fixes in parallax-presentations (potentially applicable)

| Fix | Commit | Applicable to NavSlidesEditor? |
|-----|--------|-------------------------------|
| Cropped images showing full | `efcf263` | **Yes** — add `position:relative` to clip div |
| JSXGraph lines not rendering | `5a84411` | **Maybe** — if JSXGraph is used |
| Iframes not rendering on animated slides | `77f6b74` | **Yes** — wrap in container divs |
| Phantom image from timeline | `69c8195` | **Yes** — position:relative vs absolute conflict |
| Title slide spacing | `1d6e111` | **Yes** — remove `!important` from p line-height |
| Dense text spacing | `fc2d1c7` | **Yes** — force line-height:normal |
| Cropped image overflow | `b69202d` | **Yes** — overflow hidden for citation text |
| Missing Clock import | `5177e11` | **Yes** — if same Toolbar structure |
| React not defined in timeline | `2ba20cd` | **Yes** — extract into proper component |

---

## 5. Server-Side Differences

### Routes in parallax NOT in NavSlidesEditor

| Route | Purpose |
|-------|---------|
| `GET /api/docs/sidebar` | Documentation sidebar structure |
| `GET /api/docs/:section/:page` | Documentation content |
| `GET/POST /api/plugins` | Plugin management |
| `POST /api/plugins/:slug/install` | Install plugin |
| `DELETE /api/plugins/:slug/install` | Uninstall plugin |
| `GET /api/me/plugins` | User's installed plugins |
| `GET/POST/DELETE /api/presentations/:id/plugins` | Per-presentation plugin management |
| `POST /api/billing/*` | Stripe billing endpoints |
| `GET /api/me` | Current user info |
| `POST /api/render-manim` | Manim video rendering |
| `POST /api/presentations/:id/import-pptx` | PPTX import (server-side) |
| `GET /api/presentations/:id/uploads` | List uploads for presentation |
| `GET /api/presentations/:id/github/history` | GitHub commit history |
| `GET /api/presentations/:id/github/version/:sha` | Get specific GitHub version |

### Storage Layer

parallax has a proper storage abstraction:
- `StorageInterface` — abstract base class
- `file-storage.js` — file-based JSON (like NavSlidesEditor)
- `pg-storage.js` — PostgreSQL-based
- `server/storage/index.js` — factory that selects based on `DATABASE_URL`

---

## 6. Dependency Differences

### parallax has but NavSlidesEditor doesn't

| Package | Purpose |
|---------|---------|
| `@clerk/clerk-react` | Auth (client) |
| `@clerk/express` | Auth (server) |
| `@aws-sdk/client-s3` | R2/S3 storage |
| `@aws-sdk/lib-storage` | R2/S3 upload |
| `pg` | PostgreSQL |
| `stripe` | Billing |
| `react-router-dom` | NOT used — parallax uses manual routing |

### NavSlidesEditor has but parallax doesn't

| Package | Purpose |
|---------|---------|
| `zustand` | State management |
| `socket.io` / `socket.io-client` | Real-time collaboration |
| `react-router-dom` | Client routing |
| `react-joyride` | Onboarding |
| `rclone` integration | Cloud sync |

---

## 7. Recommended Port Strategy

### Priority 1: High Value, Low Effort (do first)

1. **FontWeight + LineHeight extensions** — 2 small files, immediate UX improvement
2. **Video URL + trimming + speed controls** — enhance existing video element
3. **Ctrl+K link modal** — better link editing UX
4. **Copy URL context menu** — trivial right-click addition
5. **LaTeX font size/color** — small property panel additions
6. **Citation font settings** — small PropertiesPanel additions
7. **Present mode CSS fixes** — apply CSS patches from commits

### Priority 2: Medium Value, Medium Effort

8. **Timeline element** — new element type, self-contained
9. **SHA-256 upload deduplication** — server-side optimization
10. **File browser** — browse uploaded files
11. **Bug fixes** — cropped images, iframe rendering, spacing

### Priority 3: High Value, Higher Effort

12. **Kinetic Text modal** — new element type with 10 templates
13. **Math Grid modal** — parametric surface plots
14. **Anime.js modal** — 12 animation templates
15. **Three.js modal** — 9 3D scene templates
16. **Landing page** — marketing page
17. **DocsPage** — built-in documentation

### Priority 4: Architecture Changes (evaluate carefully)

18. **Plugin system** — major architectural addition, requires careful integration
19. **Storage abstraction** — useful for future PostgreSQL support
20. **Manim integration** — needs server endpoint + Python dependency

---

## 8. Files to Port (by component)

### Client Extensions (new)
- `client/src/extensions/FontWeight.js`
- `client/src/extensions/LineHeight.js`

### Client Components (new)
- `client/src/components/KineticTextModal.jsx`
- `client/src/components/MathGridModal.jsx`
- `client/src/components/AnimeModal.jsx`
- `client/src/components/ThreeModal.jsx`
- `client/src/components/DocsPage.jsx`
- `client/src/pages/LandingPage.jsx`

### Client Plugins (new)
- `client/src/plugins/PluginRegistry.js`
- `client/src/plugins/PluginLoader.js`
- `client/src/plugins/PluginContext.js`
- `client/src/plugins/PluginSandbox.jsx`
- `client/src/plugins/index.js`

### Server (new)
- `server/storage/interface.js`
- `server/storage/pg-storage.js`
- `server/storage/file-storage.js`
- `server/storage/index.js`
- `server/middleware/auth.js`
- `server/services/r2.js`
- `server/services/stripe.js`
- `server/services/upload-service.js`
- `server/migrations/run.js`

### Plugins (new)
- `plugins/animated-counter/`
- `plugins/manim/`

### Docs (new)
- `docs/` — VitePress documentation

---

## 9. Unresolved Questions

1. **License compatibility** — parallax is AGPL-3.0. NavSlidesEditor's license is not specified. Need to verify compatibility before porting.
2. **Clerk dependency** — parallax uses Clerk for auth. Should we port the auth system or skip it?
3. **PostgreSQL dependency** — parallax supports PostgreSQL. Should we add this or keep file-based storage?
4. **Stripe dependency** — parallax has billing. Should we port this?
5. **R2/S3 dependency** — parallax supports cloud storage. Should we port this?
6. **Plugin system scope** — Full plugin system is a major architectural change. Should we port it or just the individual element types?
7. **State management divergence** — parallax doesn't use Zustand. Porting components may require adaptation.
8. **shared/ module** — NavSlidesEditor has `shared/` package. parallax doesn't. How to handle `htmlGenerator.js` and `shapeUtils.js`?

---

## 10. Next Steps

1. **Verify license compatibility** — check AGPL-3.0 vs NavSlidesEditor license
2. **Prioritize features** — confirm with user which features to port
3. **Create implementation plan** — detailed phases with file-by-file port instructions
4. **Start with Priority 1** — low-hanging fruit (extensions, video controls, CSS fixes)
5. **Test after each feature** — ensure nothing breaks
