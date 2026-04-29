# Phase 05: Update offlineExport.js — Fetch from Local Vendor

## Context

- Plan: [plan.md](./plan.md)
- Requires: Phase 03 (Express `/vendor` route must be live)
- Related file: `client/src/utils/offlineExport.js`

## Overview

- **Priority:** Critical
- **Status:** Pending

Cập nhật `offlineExport.js` để fetch assets từ `localhost/vendor/` thay vì CDN internet.
File export HTML vẫn self-contained (all assets inlined) sau khi process.

## Current State Analysis

`offlineExport.js` hiện tại (159 lines) đã có logic hoàn chỉnh gồm 6 steps:

- Steps 1–4: fetch CDN CSS/JS + inline
- Step 5: remove Google Fonts + Computer Modern links
- Step 6: scan srcdoc attributes + inline CDNs bên trong

**Vấn đề duy nhất:** `CDN_RESOURCES` constant và fetch URLs trong Steps 1–6 vẫn dùng `cdn.jsdelivr.net` và `tikzjax.com`.

## Changes Required

### 1. Thêm `getVendorBase()` helper

```javascript
// Detect server base URL for fetching vendor assets
// In browser: use window.location.origin (e.g., http://192.168.1.5:3000)
// Fallback: localhost:3000
function getVendorBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin !== 'null') {
    return window.location.origin
  }
  return 'http://localhost:3000'
}
```

> `window.location.origin` là `'null'` khi chạy từ `file://` — nhưng Electron dùng Express server nên sẽ có valid origin.

### 2. Update `CDN_RESOURCES` constant

**Before:**

```javascript
const CDN_RESOURCES = {
  css: [
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css',
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
  ],
  js: [
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js',
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js',
    'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
  ],
}
```

**After:**

```javascript
// Build vendor resource URLs from local server
// Called inside generateOfflineHTML() after getVendorBase() is available
function getVendorResources(base) {
  return {
    css: [
      `${base}/vendor/reveal.js/dist/reset.css`,
      `${base}/vendor/reveal.js/dist/reveal.css`,
      `${base}/vendor/katex/dist/katex.min.css`,
    ],
    js: [
      `${base}/vendor/reveal.js/dist/reveal.js`,
      `${base}/vendor/reveal.js/plugin/notes/notes.js`,
      `${base}/vendor/reveal.js/plugin/highlight/highlight.js`,
      `${base}/vendor/katex/dist/katex.min.js`,
    ],
  }
}
```

### 3. Update `generateOfflineHTML()` function signature

```javascript
export async function generateOfflineHTML(html) {
  const vendorBase = getVendorBase()
  const VENDOR_RESOURCES = getVendorResources(vendorBase)
  let result = html

  // ── 1. Inline known vendor CSS ──────────────────────────────────────────
  for (const url of VENDOR_RESOURCES.css) {
    // ... same logic but url now points to /vendor/
  }
  // ... rest of steps
```

### 4. Update Steps 2 & 3 — Dynamic theme/code-theme CSS

Step 2 hiện tại match CDN URL pattern `cdn.jsdelivr.net/npm/reveal.js@.../theme/`:

```javascript
// Before (Step 2):
const themeMatch = result.match(
  /<link[^>]*href=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/reveal\.js@[^"']*\/dist\/theme\/[^"']+\.css)["'][^>]*\/?>/
)

// After (Step 2): match /vendor/ path instead
const themeMatch = result.match(
  /<link[^>]*href=["']([^"']*\/vendor\/reveal\.js\/dist\/theme\/[^"']+\.css)["'][^>]*\/?>/
)
```

Step 3 (code-highlight theme) similarly:

```javascript
// Before (Step 3):
const codeThemeMatch = result.match(
  /<link[^>]*href=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/highlight\.js@[^"']+)["'][^>]*\/?>/
)

// After (Step 3): match /vendor/ path
const codeThemeMatch = result.match(
  /<link[^>]*href=["']([^"']*\/vendor\/highlight\.js\/styles\/[^"']+)["'][^>]*\/?>/
)
```

### 5. Step 6 — srcdoc CDN scanning (already correct logic, URL source changes)

Step 6 scan tất cả `https://` URLs trong srcdoc — sau Phase 04, các URLs trong srcdoc đã là `http://localhost/vendor/...` (absolute URLs với `getAssetOrigin()`).

Step 6 regex hiện tại:

```javascript
const scriptMatches = [
  ...inner.matchAll(/<script\s+src=["'](https?:\/\/[^"']+)["'][^>]*><\\?\/script>/gi),
]
```

Pattern `https?://` đã match cả `http://localhost` — **không cần thay đổi regex**.
Các URLs này trỏ về `/vendor/` trên local server → `cachedFetchText()` fetch thành công offline LAN.

### 6. KaTeX fonts trong inlined CSS

Khi inline `katex.min.css`, nó chứa `url(fonts/KaTeX_Main-Regular.woff2)` — relative paths.
Sau khi inline vào `<style>`, relative paths này sẽ resolve từ document URL, không từ `/vendor/katex/dist/`.

**Fix:** Sau khi fetch `katex.min.css`, rewrite font paths thành absolute:

```javascript
// In Step 1, sau khi fetch katex.min.css:
let css = await cachedFetchText(url)
if (url.includes('katex') && url.endsWith('.css')) {
  // Rewrite relative font paths to absolute vendor paths
  const katexFontsBase = `${vendorBase}/vendor/katex/dist/fonts`
  css = css.replace(/url\(fonts\//g, `url(${katexFontsBase}/`)
  css = css.replace(/url\("fonts\//g, `url("${katexFontsBase}/`)
  css = css.replace(/url\('fonts\//g, `url('${katexFontsBase}/`)
}
result = result.replace(re, () => `<style>/* ${url} */\n${css}\n</style>`)
```

> **Tại sao cần:** KaTeX CSS dùng `url(fonts/KaTeX_Main-Regular.woff2)` — relative path. Khi CSS được inline vào HTML export file, relative path resolve từ `file://` location → font không load. Cần rewrite thành absolute URL để browser fetch từ server.

> **Alternative:** Fetch và base64-inline tất cả fonts — nhưng 28 fonts × ~45KB = ~1.3MB base64 → quá nặng.

## Files to Modify

- `client/src/utils/offlineExport.js`

## Todo

- [ ] Add `getVendorBase()` helper function
- [ ] Replace `CDN_RESOURCES` const với `getVendorResources(base)` function
- [ ] Update `generateOfflineHTML()` to call `getVendorBase()` + `getVendorResources()`
- [ ] Update Step 2 regex để match `/vendor/reveal.js/dist/theme/` path
- [ ] Update Step 3 regex để match `/vendor/highlight.js/styles/` path
- [ ] Add KaTeX font path rewrite after fetching `katex.min.css`
- [ ] Verify Step 6 srcdoc scanning works with `http://localhost` URLs (should work without changes)
- [ ] Test: export offline HTML khi server đang chạy LAN → mở file offline → tất cả elements render

## Risk

| Risk                                                        | Mitigation                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `window.location.origin` = `'null'` khi Electron sai config | Fallback `http://localhost:3000`; verify Electron port config             |
| KaTeX font paths không rewrite đúng                         | Unit test regex với sample katex.min.css content                          |
| Step 2/3 regex không match sau Phase 04 URL change          | Test locally: generate HTML → verify theme CSS inline                     |
| File export size too large (KaTeX fonts not inlined)        | Documented trade-off; fonts served from server when viewing exported file |

## Note: Exported HTML File Behavior

Sau khi export, file `.html` chứa:

- reveal.js, KaTeX JS, Chart.js, etc. → **fully inlined** (self-contained)
- KaTeX fonts (woff2) → **NOT inlined**, reference absolute URL `http://server:PORT/vendor/katex/dist/fonts/`

**Implication:** Khi mở file export trên máy khác, cần server đang chạy để load KaTeX fonts.
**Acceptable trade-off:** Use case chính là LAN server — server luôn chạy.

Nếu muốn 100% standalone (không cần server), cần base64-inline fonts vào CSS → Phase 06 có thể address.
