# Plugin Architecture Analysis: parallax-presentations vs NavSlidesEditor

Generated: 2026-05-19
Mode: `--compare` (deep-dive on plugin subsystem, no implementation plan)
Scope: only the plugin subsystem; for full project comparison see `xia-compare-260519-parallax-presentations.md`.

## Source Manifest

| Field | Value |
|---|---|
| Repo | `jbirky/parallax-presentations` |
| Branch / SHA | `main` @ `ce548c535abc7701ac45cc3164560caba121adce` |
| Files read | `client/src/plugins/{PluginLoader,PluginRegistry,PluginContext,PluginSandbox,index}.js`, `server/index.js` (lines 145–225, 1940–2010), `server/storage/file-storage.js` (Plugins section), `plugins/animated-counter/parallax-plugin.json`, `plugins/manim/parallax-plugin.json`, `client/src/components/PropertiesPanel.jsx` (grep), `plugins/animated-counter/dist/{sandbox.html,plugin.js}` (via WebFetch — summary only, 125-char verbatim limit; behavior verified) , `plugins/manim/dist/{sandbox.html,plugin.js}` (same) |
| Files NOT read | `pg-storage.js` plugin section, `migrations/004_plugin_storage.sql` (cloud-only); `dist/*` exact bytes (summaries via WebFetch were sufficient for contract verification) |

## TL;DR

Parallax's plugin architecture is a **directory-scanned manifest+module loader with per-element iframe sandbox**, designed primarily as a SaaS marketplace foundation. For NavSlides (self-hosted, single user, content-trusted) it solves a problem NavSlides does not have, while breaking five things NavSlides already does well: shared/ render pipeline, multi-select / group / align, animation timeline, offline export, server-side raster fallback. **Update after second pass:** 4 of 5 declared contribution surfaces are spec-stubs with zero consumers in source — the architecture under-delivers on its own promises, and even the sample plugins' export hooks run in dead code. License compatibility (AGPL-3.0 ↔ AGPL-3.0) confirmed. Recommendation: **reject the plugin loader; cherry-pick the 2 actual sample plugins as plain element types** under existing `shared/src/element-renderers.js`.

## Source Anatomy (plugin subsystem)

```
parallax-presentations/
  client/src/plugins/
    PluginRegistry.js     4955  Singleton registry: _plugins, _elementTypes (prefix `plugin:`),
                                _propertyPanels, _exportHooks, _dataProcessors, _commands, listeners.
    PluginLoader.js       2197  fetch('/api/plugins') → register manifests → dynamic import the
                                module bundle (`/api/plugins/<slug>/assets/<main>`) → call
                                mod.activate(context). Tracks loaded set by slug.
    PluginContext.js      3770  Frozen API object passed to activate(): element.{getData,
                                updateData,getLayout,updateLayout,onDataChanged}, presentation.{id,
                                title,slideWidth,slideHeight,slideCount,getPluginElements},
                                ui.{registerCommand,showToast}, exports.registerExportHook,
                                data.registerProcessor, log.{info,warn,error}.
    PluginSandbox.jsx     5218  <iframe srcDoc sandbox="allow-scripts">; injects a `window.parallax`
                                bridge script + reset CSS into the plugin's sandbox HTML; postMessage
                                protocol namespaced parallax-host / parallax-sandbox.
    index.js               271  Re-exports.
  server/
    index.js (excerpts)         Public routes: GET /api/plugins, /api/plugins/:slug,
                                /api/plugins/:slug/manifest, static /api/plugins/:slug/assets/*.
                                Per-pres routes: GET/POST/DELETE /api/presentations/:id/plugins
                                (no requireUser wrapper). Cloud-only routes: POST/DELETE
                                /api/plugins/:slug/install, GET /api/me/plugins (requireUser).
    storage/file-storage.js     _pluginsDir = data/plugins/ (user uploads); _bundledPluginsDir =
                                ../plugins/ (repo-root). _scanPluginDir reads parallax-plugin.json
                                in each subfolder. listPlugins merges user-overrides-bundled by slug.
                                Per-presentation enable/disable JSON file. Per-(user,plugin,key)
                                storage JSON file. install/uninstall are no-ops in self-hosted.
  plugins/
    animated-counter/parallax-plugin.json (1369 bytes)
    manim/parallax-plugin.json            (1098 bytes)
```

## Manifest Schema (`parallax-plugin.json`)

Real example (animated-counter):

```json
{
  "id": "com.parallax.animated-counter",
  "name": "Animated Counter",
  "version": "1.0.0",
  "parallaxEngine": ">=1.0.0",
  "author": { "name": "Parallax", "url": "https://parallax-presentations.com" },
  "license": "AGPL-3.0",
  "description": "...",
  "main": "./plugin.js",
  "sandbox": "./sandbox.html",
  "contributes": {
    "elementTypes": [{ "type": "counter", "label": "...", "defaultSize": {...},
                       "defaultData": {...}, "toolbar": { "menu": "embed", "position": "after:html" } }],
    "propertyPanels": [{ "id": "counter-settings", "elementType": "counter", "label": "..." }],
    "exportHooks": [{ "id": "counter-static", "formats": ["html"], "description": "..." }]
  },
  "permissions": []
}
```

Element type ends up registered as `plugin:counter` (registry adds `PLUGIN_TYPE_PREFIX = 'plugin:'`).

## Lifecycle (verified by source read)

```
1. Editor mount  →  PluginLoader.loadPlugins({getPresentation, updateElement, showToast})
2. Loader        →  fetch GET /api/plugins                                      (public)
3. Server        →  storage.listPlugins() = scan data/plugins/ + ../plugins/    (file-system)
4. Loader        →  registry.register(manifest, slug)                           (host page)
5. Loader        →  await import('/api/plugins/<slug>/assets/<main>')           (DYNAMIC, host page)
6. Loader        →  mod.activate(context)                                       (host page, NOT sandboxed)
7. Plugin        →  context.exports.registerExportHook(...) etc.
8. User inserts  →  createPluginElement('plugin:counter')
                    {id, type:'plugin:counter', pluginId, x, y, w, h, zIndex, pluginData}
9. SlideCanvas   →  if isPluginType: render <PluginSandbox sandboxUrl="...sandbox.html"
                    pluginData width height isSelected onDataUpdate />
10. Sandbox      →  iframe srcDoc=fetchedHtml + injected bridge; sandbox="allow-scripts"
                    (no allow-same-origin → opaque origin)
11. Bridge ↔ Host postMessage:
                    sandbox→host: ready, update-data, error, snapshot-result
                    host→sandbox: init, data-changed, resize, capture-snapshot
```

## Security Model (red-team read)

| # | Surface | Source design | Real exposure |
|---|---|---|---|
| 1 | Plugin **module** (`main`) load | Dynamic `import()` into host page from `/api/plugins/.../assets/main.js` | Runs **unsandboxed** in host origin. Has `window.fetch`, `localStorage`, full DOM. The `context` it receives is locked, but `mod.activate(context)` is itself host-page JS — `context` is a polite façade, not a security boundary. |
| 2 | Plugin **widget** (`sandbox` HTML) | iframe `sandbox="allow-scripts"`, srcdoc, no `allow-same-origin` → opaque origin → CORS-blocked outbound | Real boundary. Can't read host cookies/localStorage. Can fetch (will be CORS-blocked for credentialed endpoints). |
| 3 | Static asset path traversal | `/api/plugins/:slug/assets` → `path.normalize(slug).replace(/\.\./g, '')` then `express.static(dir)` | Single-pass `replace` does not iterate — `....//` collapses to `..//`. Slug should be whitelist-validated (e.g. `/^[a-z0-9._-]+$/`). |
| 4 | `/api/plugins*` discovery | Public, before auth | Intentional (sandbox iframes need it). OK in self-hosted. In cloud it leaks all installed-plugin manifests to anonymous. |
| 5 | `/api/presentations/:id/plugins` POST/DELETE | NO `requireUser` wrapper (verified in `server/index.js:~1980`) | Anonymous can enable/disable plugins on any presentation. Likely a bug in source, not by design. |
| 6 | Manifest declares `permissions: []` | Field is parsed but never enforced anywhere | Spec stub. No capability gating exists. |
| 7 | `onDataChanged` uses 200ms `setInterval` polling on JSON.stringify diff | Functional but wasteful | Per-element overhead × N plugin elements × every editor session. |
| 8 | `PluginSandbox` injects bridge via regex on `<head>`/`<html>` | Fragile HTML parse | Won't break for benign plugins, can be defeated by hostile manifest combined with item 1 anyway. |

**Net:** the iframe sandbox is real for the widget, but the **plugin module** (`main`) is fully privileged in the host page. Treating "plugin" as untrusted is wrong; the architecture only gates the *visual surface*, not the code that talks to the registry/host.

## Real Capability Surface vs Stated Surface

Verified by `gh search code` for each registry getter (callers outside the registry itself):

| Promised by manifest schema | Registry getter | Consumer found in repo? | Verdict |
|---|---|---|---|
| `contributes.elementTypes` | `getAllElementTypes` (via `getInsertablePluginTypes`) | **YES** — `client/src/pages/EditorPage.jsx` (insertion menu) + `SlideCanvas.jsx` (`getElementType`, `getPlugin`) | Implemented |
| `contributes.propertyPanels` | `getPropertyPanel(elementType)` | **NO** — only definition in `PluginRegistry.js`; `PropertiesPanel.jsx` does not import the registry | Spec-stub |
| `contributes.exportHooks` | `getExportHandler(elementType)` | **NO** — only definition; both sample plugins call `context.exports.registerExportHook(...)` but **nothing reads back** | Spec-stub (more on this below) |
| `contributes.dataProcessors` | `getDataProcessorsForFile(filename)` | **NO** — only definition | Spec-stub |
| `contributes.toolbarItems` | `getToolbarItems()` | **NO** — only definition | Spec-stub |
| `permissions` | n/a | Parsed, never read by any code path | Spec-stub |
| `parallaxEngine` semver | n/a | Parsed, never read | Spec-stub |
| Per-(user,plugin,key) storage | `getPluginStorage` etc. on storage layer | `PluginContext` does not expose `storage.*`; no client API to call it | Server stub |

**5 of 7 declared contribution points have no consumer in source.** Only `elementTypes` actually drives behavior. The architecture is closer to a published-RFC than a shipping plugin system.

### Confirmed Implication for Offline Export

Both sample plugins call `context.exports.registerExportHook({ handler })`:

- `animated-counter/dist/plugin.js`: handler returns a centered flexbox `<div>` with formatted number + label (verified via WebFetch summary).
- `manim/dist/plugin.js`: handler returns `<video>` if `rendered` set, else placeholder `<div>` (verified via WebFetch summary).

Both are wired into the registry via `_exportHooks`. **No code path in source ever calls `registry.getExportHandler(elementType)`**, so these handlers run in dead code at runtime. The plugin author's expectation (static HTML in offline export) is unfulfilled even in source. NavSlides porting this contract would have to **build** the consumer that source forgot to build.

## NavSlides Local Extension Surface (mapped before adoption)

| Surface | Today | Plugin-model impact |
|---|---|---|
| `shared/src/element-renderers.js` `RENDERERS` map | 18 keys (text, image, shape, code, html, markdown, chart, callout, icon, latex, video, audio, table, drawing, line, svg, qrcode, timeline) | Plugin elements bypass this. Renders only in editor (iframe), are **invisible** in offline export, share-link, GitHub push, raster fallback, live viewer — unless every consumer learns to fall back to a server-side render hook the plugin must also provide (parallax does not). |
| `client/src/utils/generateHTML.js` (offline export) | Static dispatch on `el.type` | Same as above. Plugin element → empty box in exported HTML. |
| `server/services/pptx-exporter.js` (PPTX) | Hybrid: pptxgenjs + Playwright raster | Raster path can capture iframe IF Chromium reaches it; pptxgenjs path can't reproduce plugin without a static fallback hook. |
| `server/services/socket-handler.js` (live presentation) | Broadcasts slide data; viewer renders via same shared/ pipeline | Plugin element renders empty for viewers/remote/speaker unless live viewer also runs PluginLoader (cost: every viewer downloads plugin assets). |
| `client/src/components/SlideCanvas.jsx` selection / drag / resize / multi-select / group / align / smart-guides / rulers / rotation | Native React DOM elements, hit-testable | iframe per plugin element breaks pointer events when not selected (parallax sets `pointerEvents: isSelected ? 'auto' : 'none'`). Multi-select across iframes is awkward; group/ungroup mixed-type containers untested in source. |
| `client/src/extensions/` (TipTap) | Compile-time static imports | Plugin model would need parallel "TipTap extension contribution" — parallax does not contribute TipTap extensions, only element types. |
| `client/src/components/ribbon/` | Static tab config in `ribbon-tabs-config.js` | Plugin "toolbarItems" target a flat toolbar; mapping into ribbon insert tab requires a translation layer. |
| `client/src/stores/editor-store.js` | Zustand, static slices | No registry pattern. Plugin commands would need a new slice. |

Five render paths (editor / offline export / live viewer / share-link / PPTX raster) all currently route through `shared/src/element-renderers.js`. Source has **none** of these problems because source has no `shared/` package and no live presentation, no PPTX raster fallback, no share-link, no offline-export-with-rich-elements story.

## Dependency Matrix (source → local)

| Source component | Local equivalent | Status | Effort to adopt |
|---|---|---|---|
| `client/src/plugins/PluginRegistry.js` | none | NEW | Low (~5KB drop-in) |
| `client/src/plugins/PluginLoader.js` | none | NEW | Low (~2KB) |
| `client/src/plugins/PluginContext.js` | none | NEW | Low |
| `client/src/plugins/PluginSandbox.jsx` | none | NEW | Low — but conflicts with selection/drag/multi-select |
| `plugin:` element-type prefix | `RENDERERS` map plain keys | CONFLICT | Medium — every consumer of `el.type` (~20+ files) needs prefix awareness |
| `/api/plugins*` REST routes | none | NEW | Low |
| `_pluginsDir` + `_bundledPluginsDir` scan | `services/storage.js` (no plugin concept) | NEW | Low |
| Per-presentation enable/disable file | none | NEW | Low |
| Per-(user,plugin,key) storage file | none (single user → trivially `{plugin,key}`) | NEW | Low |
| Manifest contribution: `propertyPanels` | `client/src/components/PropertiesPanel.jsx` (static per type) | CONFLICT | Medium — requires registry-driven panel rendering |
| Manifest contribution: `exportHooks` | `shared/src/element-renderers.js` static map | CONFLICT | **High** — every export consumer must accept runtime hook handlers, but hooks defined client-side cannot run inside `shared/` (which is sync, no DOM). |
| Manifest contribution: `dataProcessors` | none | NEW (unused in source anyway) | — |
| Manifest contribution: `toolbarItems` | `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` | CONFLICT | Medium — ribbon is tab+panel, not flat toolbar |
| `animated-counter` plugin | none | NEW (cherry-pick candidate as plain element type) | Low |
| `manim` plugin | TikZJax + KaTeX cover most math; manim adds animation video | NEW (cherry-pick rejected: needs Python + ffmpeg in server image) | High |

## Challenge Framework

| # | Question | Source answer | Local answer | Risk if we adopt anyway |
|---|---|---|---|---|
| 1 | What problem does the plugin loader solve in NavSlides? | Marketplace + cloud monetization (license keys exist in `migrations/004_*`) | None of those exist locally. Single-user, self-hosted. | Build a marketplace-shaped abstraction with no marketplace. Pure YAGNI. |
| 2 | Are the 2 sample plugins worth shipping? | Counter (animated number), Manim (Python video) | Counter is 1 element type (~150 LOC equivalent). Manim requires Python+ffmpeg in container. | Counter trivially adds; Manim infra cost > value. |
| 3 | Does "plugin" provide isolation we don't have today? | Iframe sandbox for the widget. Module is **NOT** sandboxed. | Today every element renderer runs in host page. Same trust boundary as plugin `main`. | Adoption gives no real isolation; just a bigger attack surface and slower iframe widgets. |
| 4 | Will plugin elements render in offline HTML export? | Source ships none — no static export pipeline | NavSlides offline export goes through `shared/src/element-renderers.js`. Plugin elements would render empty. | Regression in offline export, share-link, GitHub push, live viewer. Five render paths break. |
| 5 | Will plugin elements render in PPTX export? | Source uses `pptxgenjs` only (client) | NavSlides has Playwright raster fallback (server). Raster sees iframe → may capture, may not (sandbox=allow-scripts iframe in headless Chromium often renders, but plugin module doesn't load → blank iframe). | Inconsistent PPTX output. |
| 6 | Will plugin elements participate in multi-select / group / align / rotate / smart-guides / rulers? | Source has none of these features at NavSlides' depth | NavSlides has all of them, all assume native DOM elements with pointer events. | Plugin elements become "second-class citizens" in editor — worse UX than today's element types. |
| 7 | Will plugin elements participate in animation timeline? | Source `AnimationTimeline.jsx` exists but unread; assume basic | NavSlides timeline targets element ids and CSS animations | Plugin element CSS animations work via outer wrapper; per-property keyframes inside iframe are unreachable. |
| 8 | Will plugin code be trusted? | Cloud: marketplace review (Stripe, license keys). Self-hosted: directory scan, you put it there. | Self-hosted, "trusted author content" model (`README:117-130`). | Same trust model as today's element-renderers — adopting a "plugin" framing implies untrusted, contradicts trust stance. |
| 9 | Maintenance cost? | ~13KB of loader code + manifest spec + per-element iframe + 5 contribution surfaces (3 of which are spec-stubs in source) | Adds permanent maintenance for spec-stubs nobody asked for | Carrying half-implemented surfaces (`permissions`, `dataProcessors`, `propertyPanels` driver) is a smell. |
| 10 | Is there a 3rd-party plugin author market? | Implied by cloud direction | Zero authors today. Only first-party content. | Premature platform. |

## Decision Matrix

| Decision | Source | Recommendation for NavSlides | Why |
|---|---|---|---|
| Adopt PluginRegistry + PluginLoader + PluginContext | Yes | **Reject** | YAGNI; no plugin authors; no isolation gain |
| Adopt PluginSandbox iframe-per-element | Yes | **Reject** | Breaks selection / multi-select / align / animations / 5 server-side render paths |
| Adopt `parallax-plugin.json` manifest schema | Yes | **Reject** | Half spec-stub; no enforcement of `permissions` or `parallaxEngine` |
| Adopt `/api/plugins/*` REST + directory scan | Yes | **Reject** | Self-hosted = redeploy is cheaper than runtime extensibility |
| Adopt `plugin:` type prefix in `el.type` | Yes | **Reject** | Touches 20+ files for zero user-visible benefit |
| Re-implement `animated-counter` as a plain `counter` element type in `shared/src/element-renderers.js` | (delivered as plugin) | **Cherry-pick (low priority)** | 1 new key in `RENDERERS`, ~80 LOC, gets free offline export + PPTX + live viewer + multi-select + animation-timeline support |
| Re-implement `manim` as element type | (delivered as plugin) | **Reject** | Python + ffmpeg + render queue in container is a sysadmin cost mismatch |
| Borrow PluginSandbox iframe pattern for **`html` element type** specifically | Different (parallax has separate `html`) | **Defer** | NavSlides already has `html` element via `srcdoc` in `element-renderers.js:174`; sandbox attrs could be hardened, but that's a 1-line change, not a port |
| Adopt per-(user,key) plugin storage JSON | Yes | **Reject** | NavSlides is single-user; just add fields to the presentation JSON |

## Risk Score

`--compare` mode: 0 / 5.

If a future port is authorized, scores by item:
- Plugin loader full adoption: **4 / 5** (5 render paths regress, 20+ files churn, no users)
- Plugin loader partial (registry only, no iframe): **3 / 5** (still spec-stub surface, still no users)
- Cherry-pick `counter` element type: **1 / 5** (low blast, normal element-renderer addition; AGPL-3.0 ↔ AGPL-3.0 already verified compatible — `LICENSE:1-2`)

## Recommendation

**Do not port the plugin architecture.**

Parallax's plugin loader is a marketplace foundation half-built on a SaaS product. Self-hosted parallax inherits the directory-scan version of it but does not gain the marketplace, license keys, or per-user install state — it just gains the iframe loader. NavSlides' editor has already moved past parallax on the things plugins **don't** help (multi-select / group / align / smart-guides / rotation / animation timeline / 5 render paths through `shared/`), and NavSlides has no marketplace to motivate plugins.

**If specific plugin functionality is desired:** add it as a regular element type. The renderer pattern in `shared/src/element-renderers.js` (RENDERERS map + `renderElement(el, slide, opts)`) already gives every new type free participation in offline export, share-link, GitHub push, live viewer, PPTX raster, multi-select, alignment, rotation, animation timeline, and undo. That is exactly what the plugin spec promises and exactly what the parallax implementation under-delivers.

**Concrete cherry-pick path (low priority, license already cleared — both sides AGPL-3.0):**

1. Add `counter` to `shared/src/element-renderers.js` `RENDERERS` map, ~80 LOC. Reads existing `defaultData` shape from `animated-counter` manifest. Animation done by `requestAnimationFrame` at runtime in editor; static `prefix + value + suffix` rendered in offline export. NOTE: do **not** copy `dist/plugin.js` verbatim — its `registerExportHook` handler runs in dead code in source. Re-implement against the NavSlides renderer contract instead.
2. Add ribbon insert button under `Insert › Embed` (matches source's `toolbar.menu: "embed"`).
3. Skip `manim`. Skip `kinetic-text`, `anime`, `three`, `math-grid` for now (not present as plugins; live in `client/src/components/*Modal.jsx` per prior comparison) — those are separate cherry-pick candidates as element types, evaluated individually.

## Unresolved Questions

1. ~~`dist/` outputs (`plugin.js`, `sandbox.html`) for both sample plugins were not read.~~ **RESOLVED** via WebFetch: see "Real Capability Surface vs Stated Surface" — both `dist/plugin.js` files register export hooks that no code path ever invokes. Both `dist/sandbox.html` are simple bridge widgets (counter ease-out animation; manim video placeholder). Exact bytes still not pulled (125-char verbatim limit on WebFetch), but contract verified.
2. ~~`client/src/components/PropertiesPanel.jsx` was not read; whether `propertyPanels` contribution is consumed (vs spec-stub) is inferred, not verified.~~ **RESOLVED**: `gh search code` for `getPropertyPanel`, `getExportHandler`, `getToolbarItems`, `getDataProcessorsForFile` across the entire repo returns only the definitions in `PluginRegistry.js` — zero callers. Confirmed: 4 of 5 contribution surfaces are spec-stubs.
3. `client/src/components/Toolbar.jsx` was partially seen; ribbon-equivalent bridging code (toolbar items menu position) not exercised. *Now also confirmed spec-stub via point 2.*
4. ~~NavSlides `LICENSE` file was not opened. Source is AGPL-3.0. Any literal code copy requires AGPL-compatible local license; verify before cherry-pick.~~ **RESOLVED**: `D:\NCKH_2025\NavSlidesEditor\LICENSE:1-2` is `GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007`. Same license. AGPL-3.0 → AGPL-3.0 cherry-pick is license-compatible. Verbatim copy must still preserve `// SPDX-License-Identifier: AGPL-3.0-or-later` and `// Copyright (c) 2026 Jessica Birky` headers, or rewrite from scratch using the manifest schema as a spec only.
5. PPTX raster fallback behavior on `<iframe sandbox="allow-scripts">` in headless Chromium during Playwright capture not empirically tested. Stated risk is qualitative.
6. The unauthenticated `POST/DELETE /api/presentations/:id/plugins` endpoints in source: not reported upstream as part of this analysis (out of scope), flagged here only as an architectural smell.

---

**Status:** DONE
**Summary:** Plugin loader is marketplace-shaped, half-implemented, and breaks 5 of NavSlides' render paths. Iframe gates only the widget, not the module — security is theater. Reject loader; cherry-pick `counter` as a plain element type if there's user demand.
**Concerns/Blockers:** None — analysis only.
