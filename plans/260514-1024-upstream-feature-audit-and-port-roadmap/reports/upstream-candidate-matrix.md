# Upstream Candidate Matrix

Date: 2026-05-14

## Scope

- Primary source: `upstream/main` at `6c3ef0063f5b7e8730e4d1e80ef1b88165ef25d7`.
- Read-only scans:
  - `upstream/dev`: no unique commits over `upstream/main`.
  - `upstream/feature/grid-and-axis-tools`: no unique commits over `upstream/main`.
- Skipped by default: SaaS, auth, billing, Stripe, Clerk, landing/pricing.

## Matrix

| Commit | Topic | Upstream files | Local matching files | Decision | Risk | Test gate |
| --- | --- | --- | --- | --- | --- | --- |
| `cde1b2e9` | HTML embed present reliability, data URLs after blob URL attempt | `client/src/utils/generateHTML.js`, `server/index.js` | `shared/src/element-renderers.js`, `shared/src/htmlGenerator.js`, `shared/tests/element-renderers.test.js`, `shared/tests/htmlGenerator.test.js` | `already-aligned` pending Phase 03 tests | Low | `npm run test -- shared/tests/element-renderers.test.js shared/tests/htmlGenerator.test.js`; manual present/export smoke |
| `347d6ad8` | HTML embed present reliability, blob URLs instead of `srcdoc` | `client/src/utils/generateHTML.js`, `server/index.js` | `shared/src/element-renderers.js`, `shared/src/htmlGenerator.js` | `already-aligned` pending Phase 03 tests | Low | Same as HTML embed gate |
| `53173592` | Editor vs present position mismatch from `em` margins | `client/src/utils/generateHTML.js`, `server/index.js` | `shared/src/htmlGenerator.js`, `shared/src/element-renderers.js`, `shared/tests/htmlGenerator.test.js` | `already-aligned` | Low | Assert section font size is `16px * var(--font-zoom, 1)` and element coordinates use px |
| `edfc1ba5` | LaTeX present path renders directly with KaTeX instead of iframe for non-TikZ | `client/src/utils/generateHTML.js`, `server/index.js` | `shared/src/element-renderers.js`, `client/src/components/canvas/element-renderers/latex-element-renderer.jsx` | `adapt` for future LaTeX polish, not Phase 03 unless tests prove present failure | Medium | Shared renderer + visual smoke for non-TikZ and TikZ |
| `315eee97` | LaTeX/TikZ font size control | `PropertiesPanel.jsx`, `SlideCanvas.jsx`, `generateHTML.js`, `latexRenderer.js`, `server/index.js` | `client/src/components/LatexEditorModal.jsx`, `client/src/components/canvas/element-renderers/latex-element-renderer.jsx`, `shared/src/element-renderers.js` | `adapt` in later editor UX batch | Medium | LaTeX property/editor/export tests |
| `6d971eb0` | LaTeX font color picker | `PropertiesPanel.jsx`, `SlideCanvas.jsx`, `generateHTML.js`, `latexRenderer.js`, `server/index.js` | Same LaTeX local files | `adapt` in later editor UX batch | Low-Medium | LaTeX color editor/export tests |
| `8050b08a` | Slide/flip/strike fragment animations | `AnimationTimeline.jsx`, `PropertiesPanel.jsx`, `generateHTML.js`, `server/index.js` | `client/src/components/AnimationTimeline.jsx`, `client/src/components/properties/common-element-controls.jsx`, `shared/src/element-renderers.js` | `already-aligned` enough for current scope | Low | Animation timeline + export snapshot |
| `a388d35b` | Video start/end trimming controls | `PropertiesPanel.jsx`, `SlideCanvas.jsx`, `generateHTML.js`, `server/index.js` | `client/src/components/properties/media-properties.jsx`, `client/src/components/canvas/canvas-element-wrapper.jsx`, `shared/src/element-renderers.js` | `adapt` in media polish batch | Medium | Media renderer/export tests + browser smoke |
| `f7a3a351` | `.ogv` support and playback speed control | Same video files | Same media local files, `server/routes/media.js` | `adapt` in media polish batch | Medium-High | Playback matrix for mp4/webm/ogv and export smoke |
| `93816b88` | Copy URL context menu for image/video | `client/src/components/SlideCanvas.jsx` | `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`, `SlideCanvas.jsx` | `already-aligned` from prior selective port branch if present; otherwise small future port | Low | Context menu E2E |
| `0e7196b6` | Global citation font size/family | `SlideCanvas.jsx`, `EditorPage.jsx`, `generateHTML.js`, `server/index.js` | Local image/citation render paths | `defer` | Medium | Image citation editor/export tests |
| `9d3288ea` | Timeline element | `PropertiesPanel.jsx`, `SlideCanvas.jsx`, `Toolbar.jsx`, `EditorPage.jsx`, `generateHTML.js`, `server/index.js` | No direct local element architecture slot yet; would touch constants, toolbar, properties, shared renderer | `defer` | High | New element create/edit/export E2E |
| `278739b4` | Plugin loader and sample Animated Counter | `Dockerfile`, `Toolbar.jsx`, `EditorPage.jsx`, `client/src/plugins/*`, `plugins/*`, `server/index.js`, storage files | No local plugin runtime | `defer` | High | Plugin sandbox/load/package/Electron smoke |
| `b6fda989` | Move Manim to plugin | `SlideCanvas.jsx`, `Toolbar.jsx`, `EditorPage.jsx`, `plugins/manim/*` | No local plugin runtime | `defer` | High | Requires plugin epic first |
| `231135f2` | Storage abstraction | `server/index.js`, `server/storage/*` | `server/services/storage.js`, route modules | `already-aligned` | Low | Storage tests |
| `709bd117` | Stripe billing | Home/API/auth/Stripe server files | Product mismatch | `skip` | Low for skip | None |
| `84e52e6b` | Auth middleware cleanup for plugin routes | `server/index.js` | Product mismatch unless plugin epic approved | `skip` | Low for skip | None |
| `2a6e0077` | Remove build artifacts/update gitignore | Build artifact housekeeping | Existing `.gitignore` and repo hygiene | `skip` | Low | None |

## Accepted Batches

- Batch A, Phase 03: export/html/embed reliability checks only. Expected outcome may be `already-aligned` with tests, not necessarily code patch.
- Batch B, Phase 04: LaTeX controls and editor UX micro ports after Phase 03.
- Batch C, Phase 05: video playback/trimming audit after Phase 04.

## Deferred Epics

- Timeline element stays behind Phase 06 feasibility gate.
- Plugin architecture and Manim stay behind Phase 07 feasibility gate.

## Unresolved Questions

- Whether deferred timeline/plugin items become P1 epics after this roadmap.
