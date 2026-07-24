---
phase: 6
title: "Preview Error and Offline Runtime Parity"
status: completed
priority: P1
dependencies: [1]
---

# Phase 06: Preview Error and Offline Runtime Parity

## Overview

Fix QR preview stale-state behavior and make Chart/LaTeX/TikZ editor previews use local vendor runtimes instead of external CDN URLs.

## Requirements

- Functional: QR preview clears stale data and exposes a fallback when generation fails.
- Functional: Chart and LaTeX/TikZ canvas preview srcDoc uses local `/vendor` assets.
- Functional: generated preview HTML safely embeds user-controlled chart labels, dataset labels, and LaTeX/TikZ content without script-breakout.
- Non-functional: preserve iframe sandboxing and existing render output for valid data.

## Architecture

Keep QR state local to `QrCodeRenderer`, but add explicit error handling and latest-request-wins guards. For Chart/LaTeX, replace external runtime URLs with the same exact local vendor paths already used by shared/export renderers where possible, and escape user-controlled values embedded in `srcDoc` scripts.

## Related Code Files

- Modify: `client/src/components/canvas/element-renderers/qrcode-element-renderer.jsx`
- Create: `client/src/components/canvas/element-renderers/qrcode-element-renderer.test.jsx`
- Modify: `client/src/components/canvas/element-renderers/chart-element-renderer.jsx`
- Create or modify: `client/src/components/canvas/element-renderers/chart-element-renderer.test.jsx`
- Modify: `client/src/components/canvas/element-renderers/latex-element-renderer.jsx`
- Modify: `client/src/components/canvas/element-renderers/latex-element-renderer.test.jsx`
- Review: `scripts/copy-vendor.js`
- Review: `server/index.js` or vendor static route setup if needed

## Implementation Steps

1. Confirm Phase 01 D5 and D6 tests fail.
2. Record D5 and D6 red evidence in `reports/implementation-evidence.md`: command, failing assertion, old-bug reason, and setup-noise exclusion.
3. QR:
   - Track `error` alongside `dataUrl`.
   - Clear `dataUrl` before generation starts or in the `catch` path.
   - Add a generation token or cancellation flag so only the latest request can update `dataUrl` or `error`.
   - Render a small accessible fallback, e.g. `Unable to render QR code`, when error exists.
   - Avoid logging noisy errors in normal test path unless existing project pattern requires it.
4. Chart:
   - Replace `https://cdn.jsdelivr.net/npm/chart.js@4` with `/vendor/chart.js/dist/chart.umd.js`, matching shared renderer.
   - Keep chart config serialization unchanged.
   - Escape serialized script data so labels such as `</script><script>window.__pwned=1</script>` cannot break out.
5. LaTeX/TikZ:
   - Replace KaTeX CDN CSS/JS with exact local `/vendor/katex/dist/katex.min.css` and `/vendor/katex/dist/katex.min.js` paths if vendor assets exist.
   - Replace TikZJax CDN paths with `/vendor/tikzjax/fonts.css` and `/vendor/tikzjax/tikzjax.js`, matching shared renderer.
   - Escape TikZ content embedded in `<script type="text/tikz">` or move it to a safer data container before runtime consumption.
   - Verify `scripts/copy-vendor.js` already installs these assets; if not, add the missing copy entry with tests/checks.
   - Verify iframe sandbox remains `allow-scripts` and does not add `allow-same-origin`.
6. Tests:
   - QR resolve then reject sequence clears image and shows fallback.
   - QR subsequent valid input after an error can render again.
   - QR out-of-order promises are latest-request-wins.
   - Chart srcDoc contains exact local vendor path and no `cdn.jsdelivr`.
   - Chart label and dataset label script-breakout payloads are escaped.
   - LaTeX math srcDoc contains exact local KaTeX paths and no `cdn.jsdelivr`.
   - LaTeX content containing `</script><script>window.__pwned=1</script>` is escaped or safely contained.
   - TikZ srcDoc contains local TikZJax paths and no `tikzjax.com`.
   - TikZ script-breakout payloads are escaped or safely contained.
   - Vendor path tests assert the exact copied asset paths from `scripts/copy-vendor.js`.
7. Run canvas renderer targeted tests.
8. Add or run `npx vitest run server/vendor-assets.test.js` or equivalent server route test proving `/vendor/chart.js/dist/chart.umd.js`, `/vendor/katex/dist/katex.min.css`, `/vendor/katex/dist/katex.min.js`, `/vendor/tikzjax/fonts.css`, and `/vendor/tikzjax/tikzjax.js` are served locally.
9. Add or run `npx playwright test tests/e2e/element-preview-offline-runtime.spec.js` proving Chart, LaTeX, and TikZ previews do not request `cdn.jsdelivr.net` or `tikzjax.com`.
10. Record D5/D6 green evidence in `reports/implementation-evidence.md`.

## Success Criteria

- [x] QR stale image is cleared on generation rejection.
- [x] QR stale out-of-order promise results cannot overwrite newer state.
- [x] QR error/fallback is user-visible and testable.
- [x] Chart preview no longer requires external CDN.
- [x] LaTeX and TikZ previews no longer require jsDelivr or tikzjax.com.
- [x] Chart/LaTeX/TikZ `srcDoc` is safe against `</script>` breakout payloads in user-controlled content.
- [x] Exact vendor asset paths exist and are served by the app.
- [x] Browser/offline runtime smoke passes for Chart, LaTeX, and TikZ previews.
- [x] Existing Chart/LaTeX valid preview behavior remains intact.
- [x] D5/D6 red/green evidence is recorded in `reports/implementation-evidence.md`.

## Risk Assessment

Risk: local vendor file paths differ from shared renderer assumptions. Mitigation: inspect `scripts/copy-vendor.js` and shared renderer paths, then use the existing route contract instead of inventing paths.
