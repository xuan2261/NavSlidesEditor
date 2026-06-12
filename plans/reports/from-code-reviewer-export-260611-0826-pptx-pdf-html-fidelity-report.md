# R3 Export Pipeline Review — PPTX / PDF / HTML Fidelity

Date: 2026-06-11
Scope: PPTX (server hybrid + client hybrid), PDF print HTML, offline HTML, project export.
Mode: READ-ONLY. Findings only.

## Files reviewed
- server/services/pptx-exporter.js (client-facing `/raster-elements` engine)
- server/utils/server-export.js, server-renderers.js, server-basic-renderers.js, server-fallback.js, server-background.js, server-background-raster.js, server-raster.js, server-image-source.js
- server/routes/presentations.js (`/raster-elements` route), pptx-export.test.js
- client/src/utils/exportPptx.js, export-pptx-core.js, export-pptx-renderers.js, export-pptx-basic-renderers.js, export-pptx-fallback-renderer.js, export-pptx-raster.js, offlineExport.js, generateHTML.js
- shared/src/htmlGenerator.js (generatePrintHTML / exportPDF), shared-pptx-core.js (toPptFontSize)

## Severity counts
- Critical: 0
- High (Important): 4
- Medium: 4
- Low: 3

---

## HIGH

### H1. Client-facing raster route aborts the WHOLE export on a single element failure
File: `server/services/pptx-exporter.js:124-137`
The `/raster-elements` engine (the one the browser client actually calls — `client/src/utils/exportPptx.js:45`) loops over targets with **no per-element try/catch**:
```
for (const target of targets) {
  const element = slidePage.locator(`[data-export-element-id="${target.id}"]`).first()
  await element.waitFor({ state: 'visible', timeout: 5000 })   // throws -> rejects whole route
  const buffer = await element.screenshot(...)
  ...
}
```
If one HTML/LaTeX element fails to render or paint within 5s, `waitFor` throws, the route returns 500, and `exportToPptx` fails entirely — every other (valid) raster is discarded. Contrast `server/utils/server-raster.js:182-196`, which wraps each target in try/catch and degrades gracefully. The resilient implementation is NOT the one wired to the client.
Impact: one slow/broken embed = total client PPTX export failure with a generic alert.
Fix: wrap per-target capture in try/catch (mirror server-raster.js); let the client-side `getServerOnlyElementIds` missing-check decide strictness.

### H2. Image opacity is silently dropped in the server export path
File: `server/utils/server-basic-renderers.js:42-98` (addImageElement)
The client renderer applies image transparency (`client/src/utils/export-pptx-basic-renderers.js:52-54`):
```
if (element.opacity != null && element.opacity !== 1)
  imageOptions.transparency = Math.round((1 - element.opacity) * 100)
```
The server `addImageElement` has **no equivalent** — it never sets `transparency`. A semi-transparent image exports fully opaque through the server path (PPTX-import roundtrip / server-export.js). There is even a dedicated client test (`export-pptx-image-opacity.test.js`) but no server counterpart.
Impact: fidelity divergence between the two export paths; faded/overlay images render wrong on server export.
Fix: port the opacity→transparency mapping into server addImageElement.

### H3. `timeline` and `game` elements have no PPTX representation and HARD-CRASH strict server export
Files: `server/utils/server-fallback.js:49-71`, `client/src/utils/export-pptx-fallback-renderer.js:30-49`, type list `client/src/data/element-defaults.js` (timeline, game)
`timeline` and `game` are real element types (in ELEMENT_DEFAULTS) but are not in any export switch and are not in `STATIC_VISUAL_TYPES`/`isRasterizable`. Behavior diverges and is broken both ways:
- Server strict (`strictRaster=true, allowFallback=false`, the default): falls through to `addFallbackElement` → not rasterizable, not media → **throws** `"Strict export disallows placeholder fallback for timeline"`, which propagates out of `exportToFile` and aborts the entire deck export (server-fallback.js:68-71).
- Client: silently becomes a grey placeholder (renderElementFallbackDataUri returns null → addPlaceholder).
Impact: a legitimate deck containing a timeline/game cannot be server-exported in strict mode (hard fail); on the client it is reduced to a placeholder with no fidelity.
Fix: add explicit raster handling for timeline/game (they are DOM-renderable, so adding them to the static-visual raster set would let getServerRasters capture them), or at minimum treat them as allowed-placeholder in strict mode rather than throwing.

### H4. Two divergent server raster engines (DRY + behavioral drift)
Files: `server/services/pptx-exporter.js` vs `server/utils/server-raster.js`
Near-identical engines with subtle, consequential differences:
- RASTER_TYPES: pptx-exporter = `{html, latex}`; server-raster DEFAULT = `{html, latex, icon, drawing, markdown, qrcode, svg}` + non-native chart.
- Origin gating: pptx-exporter `canPassThroughRequest` uses naive `raw.startsWith(\`${baseUrl}/\`)` (pptx-exporter.js:40); server-raster uses a proper `isSameOrigin` URL parse (server-raster.js:42-53). The naive prefix check is both over- and under-permissive (e.g. `http://127.0.0.1:3002.evil.com/` matches the prefix only if it literally starts with baseUrl+`/`, and query/fragment variants differ).
- pptx-exporter `installVendorRoute` returns early when `!baseUrl` (pptx-exporter.js:62), leaving **all** network requests un-intercepted (HTML embeds can fetch arbitrary external URLs during server-side render). server-raster always installs the route and blocks non-vendor/non-same-origin (server-raster.js:121-124).
- pptx-exporter has no result cache and no per-element error isolation (see H1).
Impact: the worse implementation is the client-facing one; two copies drift and must be patched twice.
Fix: collapse onto `server-raster.js::getServerRasters` and delete `rasterizeComplexElements`, or have the route call getServerRasters with `rasterTypes: ['html','latex']`.

---

## MEDIUM

### M1. Fallback rasterization launches a fresh Chromium per missed element
Files: `server/utils/server-export.js:43`, `server/utils/server-fallback.js:52` → `server-background-raster.js:138-160` → `getServerRasters` (`server-raster.js:170`)
`getServerRasters` is called once for the whole deck, but every element it MISSES then routes through `addFallbackElement` → `rasterizeStaticVisualElement` → `getServerRasters` again, each launching a **new browser** (chromium.launch) for a single element. A deck with several un-captured static-visual elements spawns N sequential browser launches.
Impact: slow exports, transient high resource use under load.
Fix: reuse a single browser/context for the whole export; pass already-captured rasters and only re-capture the residual set in one batch.

### M2. Chromium launch failure surfaces as an opaque error
Files: `server/utils/server-raster.js:170`, `server-background-raster.js:106`, `server/routes/presentations.js:240-245`
If the Playwright browser binary is missing/unlaunchable, `chromium.launch()` rejects and the rejection propagates raw to the route, returning a generic 500. No detection or actionable message ("run `npx playwright install chromium`"). Background gradient rasterization has the same exposure (server-background.js:38-47 only catches after launch, not launch itself in strict mode).
Impact: confusing failure for self-hosters without the browser installed.
Fix: detect launch failure and return a specific, actionable error; consider a one-time capability probe.

### M3. Module-global rasterCache races across concurrent exports
File: `server/utils/server-raster.js:20,203,207` + `server/utils/server-export.js:79`
`rasterCache` is a process-wide `Map`. `exportToFile` calls `clearRasterCache()` in its tail (server-export.js:79), so two concurrent `exportToFile` runs will have one wipe the other's cache mid-flight. Results stay correct (each recomputes) but caching benefit is lost and the intent is unclear.
Impact: no correctness bug, but wasted work and a foot-gun if cache is later trusted.
Fix: scope the cache per-export (pass it through) instead of a shared module global, or key+ref-count.

### M4. Offline HTML only inlines `/uploads/` images
File: `client/src/utils/offlineExport.js:447-463`
Image inlining regex matches only `/uploads/...`. External/CDN `<img src="https://...">`, `data-background-image` pointing at remote URLs, and video posters are not inlined.
Impact: "offline" export still breaks for any remotely-hosted image/background when opened without network.
Fix: also inline absolute http(s) image/background sources (or document the limitation explicitly).

---

## LOW

### L1. Line elements pointing up/left produce negative w/h
Files: `server/utils/server-basic-renderers.js:152-175`, `client/src/utils/export-pptx-basic-renderers.js:158-181`
`w: x2 - x1`, `h: y2 - y1` can be negative for upward/leftward lines. pptxgenjs may clamp/misrender negative-size line shapes (no flip handling). Same logic on both paths.
Fix: normalize to positive w/h with begin/end swap, or set flipV/flipH.

### L2. Offline CSS inline replaces only first occurrence
File: `client/src/utils/offlineExport.js:222,233`
`result.replace(match[0], () => ...)` replaces only the first match; a vendor CSS linked twice leaves the second `<link>` un-inlined. (The JS-inline loop correctly uses split/join.)
Fix: use `split(match[0]).join(...)` for consistency.

### L3. Cache key hashes entire slide JSON per export
File: `server/utils/server-raster.js:90-108`
`getCacheKey` SHA1s `JSON.stringify` of all slides on every call; for large decks this is non-trivial and runs even when only one element is being rastered (fallback path).
Fix: hash only the raster-relevant subset, or cache the hash on the presentation object.

---

## Verified-correct (calibration)
- PDF `@page { size: <W>px <H>px }` + fixed `.slide-page` dimensions preserve aspect ratio; px page size is honored by Chrome print (htmlGenerator.js:581-591).
- PDF fragment expansion: one page per unique `fragmentIndex` plus an initial page; page-number counter only increments on `countPageNumber` pages (htmlGenerator.js:489-525). Correct. No vertical/child-slide concept exists in this data model (flat `slides[]`), so "child slide" handling is N/A.
- `toPptFontSize` px→pt = `*0.75` (96→72dpi) is correct (shared-pptx-core.js:13-17).
- `normalizeServerImageSource` properly constrains `/uploads/` and absolute paths to the uploads dir (path traversal guarded) (server-image-source.js:4-31).
- Strict export does not write a partial file: errors propagate before `pptx.writeFile` (server-export.js:78), so no truncated .pptx is emitted.
- Layout uses `_pptxMeta.originalSize` to preserve legacy 4:3 deck dimensions on roundtrip (export-pptx-core.js:25-30, server-export.js:17-23); covered by server-export.test.js.

## Unresolved questions
1. Is the `/raster-elements` route (`rasterizeComplexElements`) intentionally limited to html/latex while the client renders icon/drawing/markdown/qrcode/svg/chart locally? If so, the two engines should still be unified to avoid the H1/H4 drift.
2. Are `timeline` and `game` expected to export at all, or is placeholder acceptable? That decides whether H3 is "add renderer" or "stop throwing".
3. Is server `exportToFile` ever invoked for arbitrary user decks at runtime, or only by the PPTX import fidelity tester? (Only the tester wires it today — bounds the blast radius of H2/H3 to roundtrip tests + any future server-export route.)
