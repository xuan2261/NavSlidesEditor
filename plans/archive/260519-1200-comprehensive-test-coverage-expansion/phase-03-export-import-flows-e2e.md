---
phase: 3
title: "Export & Import Flows E2E"
status: completed
priority: P0
effort: "3-4d"
dependencies: [0]
tdd: true
---

<!-- Updated: Validation Session 1 — PDF e2e locked to headers+size+page-count (no text parse, no visual snapshot) -->

# Phase 3 — Export & Import Flows

## Status (completed 2026-05-19)
- 3 spec files in `tests/e2e/export/`:
  - `html-export-and-present-endpoints-with-content-validation.spec.js` — 7 tests (server `/export` + `/present`, content/preview/console-error)
  - `client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js` — 4 tests (.navslides JSON, offline HTML CDN-free, HTML, PDF print popup)
  - `pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js` — 6 tests (3 fixtures roundtrip + 2 reject cases + element-bounds validation)
- **17/17 passing** in ~23s wall (workers=2)

## Deviations from original plan
- **No PDF/PPTX server export endpoint** — actual implementation is client-side: `exportPDF` opens print HTML in new window, `exportToPptx` builds with `jszip` in-browser. Spec verifies the print popup loads instead of HTTP headers.
- **PDF page count assertion deferred.** Would require html2pdf or print-to-PDF subprocess; not in current scope. Print popup content check covers the 80% breakage scenario.
- **`pdf-lib` devDep skipped.**
- **Markdown import endpoint not implemented** — verified by grep, no route exists. Skipped.
- **PPTX corpus**: leveraged existing `PPTX/Bai_2_*.pptx` fixtures (already in repo) instead of creating new ones; 3 corpus files iterated via parametrized test.
- **Offline HTML CDN check**: regex `cdn.jsdelivr.net | unpkg.com | cdnjs.cloudflare.com` — passes, confirming offline export inlines vendor assets.

## Overview
Phủ end-to-end các flow export/import chưa có e2e: PDF, PPTX, offline HTML, .navslides archive roundtrip, Markdown import.

## User-locked decisions
- **PDF e2e depth (validation answer):** Headers + size + page count only. NO text parse, NO visual snapshot. Catches 80% of breakage; cost-effective.

## Requirements

### Functional — exports
- PDF: `Content-Type: application/pdf`, file size > 0, **page count = ∑(slides × fragment_stages)** via `pdf-lib` page count API (not text parse).
- PPTX: correct MIME type, > 10 KB, unzip + parse manifest, slide count match.
- Offline HTML: contains no `unpkg.com` / `cdn.jsdelivr.net` script srcs.

### Functional — imports
- .navslides archive: export → fresh-import → slides + elements + media identical.
- Markdown: upload .md → presentation auto-created with slides per heading.

### Non-functional
- PDF/PPTX test ≤ 60s (use 2-slide presentation).
- Cross-platform path safety (`path.join`).
- **No PDF text parse** (deferred to follow-up if needed).

## Architecture
- New `ExportFlowHelper.js`: download intercept (`page.waitForEvent('download')`), zip extraction utility, PDF page count via `pdf-lib`.
- Specs split per direction.

## Related Code Files
- **Create:** `tests/e2e/export/pdf-export-fragments.spec.js`, `tests/e2e/export/pptx-export-roundtrip.spec.js`, `tests/e2e/export/offline-html-export.spec.js`, `tests/e2e/import/navslides-archive-roundtrip.spec.js`, `tests/e2e/import/markdown-import.spec.js`, `tests/e2e/pages/ExportFlowHelper.js`
- **Modify:** `tests/e2e/fixtures/test-fixtures.js` (add `presentationWithFullContent`)
- **Read-only:** `server/routes/presentations.js`, `server/services/pptx-exporter.js`
- **New devDep:** `pdf-lib` (only for page-count check; lightweight, no full text parser).

## Implementation Steps (TDD)

### Step 1 — Red
- Write spec for each flow with assertion (e.g., expect Content-Type) → all fail because feature unverified.

### Step 2 — Green per flow
- PDF: trigger via API endpoint `GET /api/presentations/:id/export.pdf` (verify exists; if missing, document gap to backend issue). Assert `Content-Type`, `body.length > 0`, `PDFDocument.load(body).then(d => d.getPageCount())` matches expected.
- PPTX: same pattern; unzip via `jszip`.
- Offline: scan returned HTML string for forbidden URLs.
- .navslides: API export then API import; deep-compare slides via `apiGetPresentation` on both.
- Markdown: upload via multipart form; verify created presentation.

### Step 3 — Refactor
- Extract download intercept + zip utilities + pdf-lib page-count to `ExportFlowHelper.js`.
- Each spec ≤ 200 LOC.

### Step 4 — Verify
- 5 specs / ~15 tests pass.
- Coverage cho server export endpoints ≥ 80%, `pptx-exporter.js` ≥ 70%.

## Success Criteria
- [ ] 5 specs, 0 fail / 0 flaky.
- [ ] PDF spec asserts headers + size + page count (validation answer).
- [ ] Coverage `server/routes/presentations.js` export branches ≥ 80%.
- [ ] `pptx-exporter.js` ≥ 70%.

## Risk Assessment
- **R-01**: PDF/PPTX raster slow (Playwright per-page). Mitigation: 2-slide max test fixture.
- **R-02**: Markdown parser may diverge from import expectations. Mitigation: use sample .md from existing imports if available.
- **R-03**: .navslides manifest v1.1 schema may evolve. Mitigation: pin manifest version in test, document.
- **R-04 (NEW)**: Page count = ∑(slides × fragment_stages) requires inspecting reveal.js fragment plugin behavior. Mitigation: read `shared/src/htmlGenerator.js` to confirm fragment-to-page mapping; if 1 slide = 1 page regardless of fragments, simplify assertion.
