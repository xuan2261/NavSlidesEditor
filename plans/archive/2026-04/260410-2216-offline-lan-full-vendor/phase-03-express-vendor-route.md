# Phase 03: Express `/vendor` Static Route

## Context

- Plan: [plan.md](./plan.md)
- Requires: Phase 01 (vendor assets), Phase 02 (TikZJax)
- Blocks: Phase 04 (htmlGenerator), Phase 05 (offlineExport)

## Overview

- **Priority:** Critical
- **Status:** Pending

Thêm static file route `/vendor` vào Express server để serve tất cả vendor assets.
Route phải hỗ trợ WASM MIME type và CORS cho Electron context.

## Affected Files

- `server/index.js` — add vendor static route

## Current server/index.js structure

File hiện tại serve:

- `/uploads` — static user-uploaded files
- `/api/*` — REST endpoints
- `*` — serve React app (SPA fallback)

## Implementation

### Vị trí thêm route (BEFORE SPA fallback)

```javascript
// server/index.js — thêm SAU app.use('/uploads', ...) và TRƯỚC SPA fallback

const vendorDir = path.join(__dirname, 'vendor')

// Serve vendor assets (offline/LAN support)
// Explicit MIME type for WASM to satisfy browser security requirements
app.use(
  '/vendor',
  (req, res, next) => {
    if (req.path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm')
    }
    next()
  },
  express.static(vendorDir, {
    // Cache for 1 hour in LAN (assets are versioned by directory)
    maxAge: '1h',
    // Don't list directory contents
    index: false,
  })
)
```

### Kiểm tra vendor dir tồn tại khi startup

```javascript
// Warn nếu vendor chưa được setup (không crash server)
if (!fs.existsSync(vendorDir)) {
  console.warn('[vendor] WARNING: server/vendor/ not found.')
  console.warn('[vendor] Run: npm run vendor to populate vendor assets.')
  console.warn('[vendor] Present mode and offline export will use CDN fallback.')
}
```

### CORS cho Electron

Electron chạy với `file://` origin. Express default không cho phép cross-origin requests từ `file://`.
Cần thêm CORS header cho `/vendor` route:

```javascript
app.use(
  '/vendor',
  (req, res, next) => {
    // Allow Electron (file://) and any LAN origin to access vendor assets
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm')
    }
    next()
  },
  express.static(vendorDir, { maxAge: '1h', index: false })
)
```

## Verification Endpoints

Sau khi implement, test:

```
GET /vendor/reveal.js/dist/reveal.js       → 200 OK, Content-Type: application/javascript
GET /vendor/katex/dist/katex.min.css       → 200 OK, Content-Type: text/css
GET /vendor/katex/dist/fonts/KaTeX_Main-Regular.woff2  → 200 OK
GET /vendor/tikzjax/tikzjax.wasm           → 200 OK, Content-Type: application/wasm
GET /vendor/chart.js/dist/chart.umd.js    → 200 OK
GET /vendor/d3/dist/d3.min.js              → 200 OK
GET /vendor/marked/marked.min.js           → 200 OK
```

## Files to Modify

- `server/index.js` — add `/vendor` static route with WASM MIME type + CORS

## Todo

- [ ] Locate correct position in `server/index.js` (after `/uploads`, before SPA fallback)
- [ ] Add vendor static route with WASM MIME type middleware
- [ ] Add startup warning if `server/vendor/` missing
- [ ] Test all 7 verification endpoints return 200

## Risk

| Risk                                      | Mitigation                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Route order conflict với API routes       | Add `/vendor` BEFORE `app.use('*', ...)` SPA fallback, AFTER `/api` routes |
| `server/vendor/` not in git → CI/CD fails | `postinstall` script trong Phase 01 tự populate                            |
| Electron `file://` CORS block             | `Access-Control-Allow-Origin: *` trên `/vendor` route                      |
