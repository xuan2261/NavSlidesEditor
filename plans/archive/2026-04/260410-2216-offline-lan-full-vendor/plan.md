---
title: 'Offline LAN Full Vendor — Complete CDN Independence'
status: completed
date: 2026-04-10
blockedBy: []
blocks: []
supersedes: plans/20260410-2144-fix-offline-iframe-export
---

# Offline LAN Full Vendor — Complete CDN Independence

## Overview

- **Priority:** High
- **Status:** Completed
- **Brainstorm:** [brainstorm-260410-2216-offline-html-export-lan.md](../reports/brainstorm-260410-2216-offline-html-export-lan.md)
- **Approach:** Hybrid A+C — Express `/vendor` static route (present mode + offlineExport fetch source) + self-contained export HTML

## Problem

Project chạy trong mạng LAN không internet. 4 điểm thất bại:

| Failure point                  | Root cause                                                 |
| ------------------------------ | ---------------------------------------------------------- |
| Export offline HTML            | `offlineExport.js` fetch từ CDN internet → timeout/fail    |
| Present mode (`/api/present`)  | `htmlGenerator.js` dùng CDN URLs → browser không load được |
| KaTeX fonts (28 woff2)         | CDN-hosted, không có trong offline export                  |
| Computer Modern / Google Fonts | External links bị remove nhưng không có fallback           |

## Current State

- `offlineExport.js` đã có Step 6 (srcdoc inline logic) — code đúng nhưng fetch source vẫn là CDN
- `htmlGenerator.js` hardcode CDN URLs (`cdn.jsdelivr.net`) cho reveal.js, KaTeX, Chart.js, D3, etc.
- Plan `20260410-2144-fix-offline-iframe-export` (status: ready) xử lý srcdoc — **superseded bởi plan này** (scope rộng hơn)

## Phases

| Phase    | File                                                                             | Priority | Status    |
| -------- | -------------------------------------------------------------------------------- | -------- | --------- |
| Phase 01 | [phase-01-vendor-assets-setup.md](./phase-01-vendor-assets-setup.md)             | Critical | Completed |
| Phase 02 | [phase-02-tikzjax-self-host.md](./phase-02-tikzjax-self-host.md)                 | High     | Completed |
| Phase 03 | [phase-03-express-vendor-route.md](./phase-03-express-vendor-route.md)           | Critical | Completed |
| Phase 04 | [phase-04-htmlgenerator-local-urls.md](./phase-04-htmlgenerator-local-urls.md)   | Critical | Completed |
| Phase 05 | [phase-05-offlineexport-local-fetch.md](./phase-05-offlineexport-local-fetch.md) | Critical | Completed |
| Phase 06 | [phase-06-fonts-cleanup.md](./phase-06-fonts-cleanup.md)                         | Medium   | Completed |

## Key Dependencies

```
Phase 01 (vendor assets) ──► Phase 03 (Express route)
Phase 02 (TikZJax)        ──► Phase 03
Phase 03                  ──► Phase 04 (htmlGenerator uses /vendor paths)
Phase 03                  ──► Phase 05 (offlineExport fetches from /vendor)
Phase 04 + Phase 05       ──► Phase 06 (fonts cleanup)
```

## Architecture After Fix

```
server/
  vendor/                     ← npm packages' dist + tikzjax WASM
    reveal.js/dist/
    katex/dist/               ← includes fonts/ subdirectory
    chart.js/dist/
    highlight.js/styles/
    d3/dist/
    marked/                   ← marked.min.js
    tikzjax/                  ← WASM + TeX fonts

server/index.js               ← app.use('/vendor', express.static(...))
shared/src/htmlGenerator.js   ← CDN URLs → /vendor/* paths
client/src/utils/offlineExport.js  ← fetch from window.location.origin/vendor/
```

## Success Criteria

- [ ] Present mode works in LAN without internet
- [ ] Export offline HTML opens in browser without internet
- [ ] D3 visualizations render in exported HTML
- [ ] Chart.js charts render in exported HTML
- [ ] KaTeX math renders with correct fonts
- [ ] TikZJax LaTeX diagrams render (WASM)
- [ ] No Google Fonts / external font requests in exported HTML

## Estimated Asset Sizes

| Asset                  | Uncompressed | Gzipped     |
| ---------------------- | ------------ | ----------- |
| reveal.js              | ~280 KB      | ~90 KB      |
| KaTeX (CSS+JS+fonts)   | ~1.4 MB      | ~600 KB     |
| Chart.js               | ~220 KB      | ~70 KB      |
| highlight.js           | ~50 KB       | ~15 KB      |
| D3.js                  | ~280 KB      | ~90 KB      |
| marked.js              | ~60 KB       | ~20 KB      |
| TikZJax + WASM + fonts | ~1.9 MB      | ~600 KB     |
| **Total**              | **~4.2 MB**  | **~1.5 MB** |
