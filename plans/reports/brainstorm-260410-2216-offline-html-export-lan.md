# Brainstorm Report: Offline HTML Export & LAN Rendering Fix

**Date:** 2026-04-10  
**Context:** D:\NCKH_2025\revealjs_gui  
**Trigger file:** "Fixing Offline HTML Export Rendering.md"

---

## Problem Statement

Project chạy trong mạng LAN không internet. 4 điểm thất bại:

| Điểm thất bại | Nguyên nhân | Mức độ |
|---|---|---|
| Export offline HTML | `srcdoc` iframe không inline CDN libs | Critical |
| Present mode (`/api/present`) | HTML template dùng CDN URLs | Critical |
| KaTeX fonts | 28 woff2 files không được bundle | High |
| Computer Modern / Google Fonts | External font links | Medium |

**CDN libs cần xử lý:**
- reveal.js@5.1.0 (CSS + JS + plugins)
- KaTeX@0.16.11 (CSS + JS + 28 woff2 fonts ~1.2MB)
- Chart.js@4 (JS)
- highlight.js (CSS themes)
- D3.js@7 (JS)
- marked.js (JS)
- TikZJax (JS + WASM + TeX fonts ~1.9MB)
- Computer Modern fonts
- Google Fonts → loại bỏ hoàn toàn

---

## Approaches Evaluated

### Phương Án A — Local `/vendor` Express Route
Cài npm packages, copy `/dist` vào `server/vendor/`, thêm static route.

- **Pros:** Sạch kiến trúc, browser cache, KaTeX fonts tự nhiên, effort thấp
- **Cons:** Cần server chạy, không standalone

### Phương Án B — Vite Build-time Bundle
`vite-plugin-static-copy` copy vendor vào `client/dist/vendor/`, env var switch CDN/local.

- **Pros:** No server needed cho dev mode, CI-friendly
- **Cons:** +2.2MB client bundle, phức tạp Vite config

### Phương Án C — Pre-inline vào Export Template
Build-time generate `offline-vendor-bundle.js` với all libs là string constants.

- **Pros:** Export HTML file standalone 100%, không cần server
- **Cons:** File export ~3–5MB, build time tăng, KaTeX fonts base64 phình to

---

## Final Decision: A + C (Hybrid)

**Rationale:**
- **Present mode** dùng Phương Án A (server `/vendor` route) — browser load qua HTTP, cache tốt
- **Export offline HTML** dùng Phương Án C approach — `offlineExport.js` fetch từ `localhost/vendor/` thay CDN internet → file export vẫn self-contained sau khi inline

**TikZJax:** Self-host (WASM + TeX fonts) vì project yêu cầu đầy đủ chức năng LaTeX.

---

## Architecture

```
server/
  vendor/                           ← npm packages' /dist copied here
    reveal.js/dist/                 ← reveal.js core + plugins
    katex/dist/                     ← CSS + JS + fonts/
    chart.js/dist/
    highlight.js/
    d3/dist/
    marked/                         ← marked.min.js
    tikzjax/                        ← self-hosted WASM + fonts

shared/src/htmlGenerator.js         ← change CDN URLs → /vendor/* URLs
client/src/utils/offlineExport.js   ← fetch from localhost/vendor/ (or bundled path)
server/index.js                     ← add app.use('/vendor', express.static(...))
```

**Flow sau khi fix:**

```
User clicks "Export Offline"
    ↓
offlineExport.js (updated)
    ├─ Step 1-4: fetch from localhost/vendor/* (not CDN)
    ├─ Step 5: remove Google Fonts, Computer Modern external links
    └─ Step 6: inline CDN inside iframe srcdoc
              (D3, Chart.js, marked, KaTeX all from localhost/vendor/)
    ↓
Self-contained HTML file (no internet needed to open)

User clicks "Present"
    ↓
/api/present endpoint → htmlGenerator.js
    ↓ (uses /vendor/* paths)
Browser loads assets from Express /vendor route
    → No internet needed
```

---

## Implementation Plan (6 phases)

### Phase 1: Install & Copy Vendor Assets
- `npm install reveal.js katex chart.js highlight.js d3 marked` in server
- Create `server/vendor/` directory structure
- Write `scripts/copy-vendor.js` (Node.js) to copy `/dist` folders
- Add to `package.json` scripts: `"vendor": "node scripts/copy-vendor.js"`

### Phase 2: Self-host TikZJax
- Clone tikzjax repo, build or download pre-built WASM artifacts
- Copy to `server/vendor/tikzjax/`
- Configure WASM MIME type in Express

### Phase 3: Express `/vendor` Route
- `server/index.js`: add `app.use('/vendor', express.static(path.join(__dirname, 'vendor')))`
- Ensure CORS headers for Electron + browser contexts
- Add WASM MIME type: `express.static(..., { setHeaders: (res, path) => { if (path.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm') } })`

### Phase 4: Update htmlGenerator.js
- Replace all CDN URLs with `/vendor/*` paths
- Add `getAssetBase(options)` helper: returns `/vendor` (server mode) or configurable prefix
- Update srcdoc templates for: markdown, chart, latex, html elements

### Phase 5: Update offlineExport.js
- Replace CDN fetch URLs with `localhost:PORT/vendor/*` 
- Add `getServerBase()` helper to detect port from `window.location` or config
- Ensure Step 6 (srcdoc inline) also fetches from localhost instead of CDN
- Handle TikZJax WASM fetching + inlining

### Phase 6: Fonts & Cleanup
- Remove Google Fonts `<link>` from htmlGenerator.js template
- Remove Computer Modern CDN link
- Copy Computer Modern fonts to `server/vendor/fonts/` if needed
- Update KaTeX font path in CSS (already relative in npm package)

---

## Size Estimates

| Asset | Size (uncompressed) | Gzipped |
|---|---|---|
| reveal.js (full) | ~280 KB | ~90 KB |
| KaTeX (CSS+JS+fonts) | ~1.4 MB | ~600 KB |
| Chart.js | ~220 KB | ~70 KB |
| highlight.js | ~50 KB | ~15 KB |
| D3.js | ~280 KB | ~90 KB |
| marked.js | ~60 KB | ~20 KB |
| TikZJax + WASM + fonts | ~1.9 MB | ~600 KB |
| **Total** | **~4.2 MB** | **~1.5 MB** |

LAN delivery ≈ 50–200 ms initial load.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| TikZJax WASM MIME type blocked | Explicit `Content-Type: application/wasm` header |
| KaTeX font path mismatch in inlined CSS | Use postcss-url or manual path rewrite in copy script |
| Electron `file://` protocol vs `/vendor` paths | Use `app.use('/vendor', ...)` only when Express running; Electron uses same server |
| Port mismatch in offlineExport | Read `window.location.port` dynamically, fallback to 3000 |
| srcdoc re-encoding breaks after fetch | Keep existing HTML entity encode/decode logic, only change fetch source |

---

## Success Criteria

- [ ] Present mode works in LAN without internet access
- [ ] Export offline HTML opens correctly in browser without internet
- [ ] D3 visualizations render in exported HTML
- [ ] Chart.js charts render in exported HTML
- [ ] KaTeX math renders with correct fonts
- [ ] TikZJax LaTeX diagrams render (with WASM)
- [ ] No Google Fonts or external font requests in exported HTML
- [ ] Server startup time not significantly increased

---

## Unresolved Questions

1. TikZJax WASM artifacts — cần build từ source hay có pre-built binary cho download?
2. Computer Modern fonts — project có dùng không, hay chỉ TikZJax handle fonts riêng?
3. Electron mode — Express server port có cố định hay dynamic? (ảnh hưởng fetch URL trong offlineExport)
4. `offlineExport.js` hiện tại fetch từ browser context — khi Electron, `window.location.origin` có đúng không?
5. Chart.js trong srcdoc có dùng `chart.js@4` hay `chart.js@3`? (version lock cho vendor)
