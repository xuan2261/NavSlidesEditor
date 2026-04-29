# Phase 04: Update htmlGenerator.js — Local Vendor URLs

## Context

- Plan: [plan.md](./plan.md)
- Requires: Phase 03 (Express `/vendor` route must be live)
- Related file: `shared/src/htmlGenerator.js`

## Overview

- **Priority:** Critical
- **Status:** Pending

Thay thế tất cả CDN URLs trong `htmlGenerator.js` bằng `/vendor/*` paths.
Đây là fix cho **Present mode** và **HTML download** (non-offline export).

## Affected File

`shared/src/htmlGenerator.js`

## All CDN URLs to Replace

### `generateRevealHTML()` — `<head>` section (lines 254–265)

| Current CDN URL                                                                    | Replacement                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| `https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css`                      | `/vendor/reveal.js/dist/reset.css`                 |
| `https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css`                     | `/vendor/reveal.js/dist/reveal.css`                |
| `https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${theme}.css`             | `/vendor/reveal.js/dist/theme/${theme}.css`        |
| `https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${codeTheme}.min.css`         | `/vendor/highlight.js/styles/${codeTheme}.min.css` |
| `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css`                    | `/vendor/katex/dist/katex.min.css`                 |
| `https://fonts.googleapis.com/css2?...`                                            | **REMOVE** (see Phase 06)                          |
| `https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css` | **REMOVE** (see Phase 06)                          |
| `https://cdn.jsdelivr.net/npm/lm-web-fonts@0.1.0/fonts/lm-roman10-*.woff2`         | **REMOVE** @font-face blocks (see Phase 06)        |

### `generateRevealHTML()` — `<body>` scripts (lines 306–309)

| Current CDN URL                                                              | Replacement                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js`                | `/vendor/reveal.js/dist/reveal.js`                |
| `https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js`         | `/vendor/reveal.js/plugin/notes/notes.js`         |
| `https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js` | `/vendor/reveal.js/plugin/highlight/highlight.js` |
| `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js`               | `/vendor/katex/dist/katex.min.js`                 |

### `latex` element srcdoc (lines 152–153, 160)

| Current CDN URL                                                 | Replacement                        |
| --------------------------------------------------------------- | ---------------------------------- |
| `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css` | `/vendor/katex/dist/katex.min.css` |
| `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js`  | `/vendor/katex/dist/katex.min.js`  |
| `https://tikzjax.com/v1/fonts.css`                              | `/vendor/tikzjax/fonts.css`        |
| `https://tikzjax.com/v1/tikzjax.js`                             | `/vendor/tikzjax/tikzjax.js`       |

### `chart` element srcdoc (line 122)

| Current CDN URL                           | Replacement                          |
| ----------------------------------------- | ------------------------------------ |
| `https://cdn.jsdelivr.net/npm/chart.js@4` | `/vendor/chart.js/dist/chart.umd.js` |

> Note: `chart.js@4` là bare specifier không có path. Cần dùng explicit UMD build path.

### `markdown` element srcdoc (line 101)

| Current CDN URL                                     | Replacement                    |
| --------------------------------------------------- | ------------------------------ |
| `https://cdn.jsdelivr.net/npm/marked/marked.min.js` | `/vendor/marked/marked.min.js` |

### `generatePrintHTML()` — `<head>` section (lines 537–540)

| Current CDN URL                                                                    | Replacement                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- |
| `https://fonts.googleapis.com/css2?...`                                            | **REMOVE**                                         |
| `https://cdn.jsdelivr.net/gh/dreampulse/computer-modern-web-font@master/fonts.css` | **REMOVE**                                         |
| `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css`                    | `/vendor/katex/dist/katex.min.css`                 |
| `https://cdn.jsdelivr.net/npm/highlight.js@11/styles/${codeTheme}.min.css`         | `/vendor/highlight.js/styles/${codeTheme}.min.css` |

### `generatePrintHTML()` — scripts (lines 587–588)

| Current CDN URL                                                     | Replacement                                 |
| ------------------------------------------------------------------- | ------------------------------------------- |
| `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js`      | `/vendor/katex/dist/katex.min.js`           |
| `https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js` | `/vendor/highlight.js/lib/highlight.min.js` |

## Implementation Detail

**Không cần** thêm helper function hay environment variable — chỉ đơn giản thay string.
Lý do: project chạy luôn có Express server (Docker, Node.js, Electron đều dùng Express).

Nếu cần backward-compat CDN fallback trong tương lai, chỉ cần đổi prefix string.

## srcdoc paths — vấn đề relative URL

`srcdoc` iframe chạy trong `about:blank` context, **không có base URL**.
Relative paths như `/vendor/...` sẽ KHÔNG hoạt động trong srcdoc.

**Giải pháp:** Dùng absolute URL với `window.location.origin` — nhưng `htmlGenerator.js` là shared module chạy cả server-side (Node.js) lẫn client-side.

Với `generateRevealHTML()` chạy ở client (browser), `window` tồn tại → dùng:

```javascript
// Lấy asset base URL — absolute cho srcdoc iframes
function getAssetOrigin() {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin // e.g., http://localhost:3000
  }
  return '' // Server-side rendering: sẽ không dùng srcdoc
}
```

**Áp dụng vào srcdoc templates:**

```javascript
// chart element srcdoc
const assetOrigin = getAssetOrigin()
const chartSrc = `...
  <script src="${assetOrigin}/vendor/chart.js/dist/chart.umd.js"><\/script>
...`

// markdown element srcdoc
const srcdoc = `...
  <script src="${assetOrigin}/vendor/marked/marked.min.js"><\/script>
...`

// latex element srcdoc
const tikzScript = hasTikz
  ? `<link rel="stylesheet" href="${assetOrigin}/vendor/tikzjax/fonts.css">
     <script src="${assetOrigin}/vendor/tikzjax/tikzjax.js"><\/script>`
  : ''
const srcdoc = `...
  <link rel="stylesheet" href="${assetOrigin}/vendor/katex/dist/katex.min.css">
  <script src="${assetOrigin}/vendor/katex/dist/katex.min.js"><\/script>
...`
```

**Top-level `<link>` và `<script>` tags** (không trong srcdoc) dùng root-relative `/vendor/...` — browser resolve đúng từ server.

## Files to Modify

- `shared/src/htmlGenerator.js`

## Related Code Files (read-only context)

- `client/src/utils/offlineExport.js` — Phase 05 sẽ update để fetch từ vendor paths

## Todo

- [ ] Add `getAssetOrigin()` helper function ở đầu file (trước `generateRevealHTML`)
- [ ] Replace CDN URLs trong `<head>` của `generateRevealHTML()` (lines ~254–265)
- [ ] Replace CDN script tags trong `<body>` của `generateRevealHTML()` (lines ~306–309)
- [ ] Replace CDN URLs trong `latex` srcdoc template (lines ~152–162)
- [ ] Replace CDN URL trong `chart` srcdoc template (line ~122) — dùng `assetOrigin`
- [ ] Replace CDN URL trong `markdown` srcdoc template (line ~101) — dùng `assetOrigin`
- [ ] Replace CDN URLs trong `generatePrintHTML()` `<head>` (lines ~537–540)
- [ ] Replace CDN script tags trong `generatePrintHTML()` (lines ~587–588)
- [ ] Remove Google Fonts `<link>` từ cả 2 functions (Phase 06 handles)
- [ ] Run compile check sau khi modify

## Risk

| Risk                                         | Mitigation                                                |
| -------------------------------------------- | --------------------------------------------------------- |
| `window` undefined trong server-side context | `getAssetOrigin()` guard: `typeof window !== 'undefined'` |
| srcdoc iframe không resolve `/vendor/` path  | Dùng absolute URL với `getAssetOrigin()` prefix           |
| `chart.js@4` bare specifier vs UMD path      | Verify exact filename sau Phase 01: `chart.umd.js`        |
| highlight.js path structure khác             | Check `node_modules/highlight.js/lib/` sau install        |
