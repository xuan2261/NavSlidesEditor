---
title: "Phase 03: Reveal.js 6.0.1 Asset and Runtime Cutover"
status: completed
---

# Phase 03: Reveal.js 6.0.1 Asset and Runtime Cutover

## Goal

Upgrade every project-owned Reveal path from installed 5.2.1 to exactly 6.0.1 and prove the complete local/offline runtime closure before deleting version-5 asset assumptions.

## Dependencies

- Phase 01 generated HTML/offline/runtime fixtures.

## Canonical Files

- `server/package.json`, root `package-lock.json`
- `scripts/copy-vendor.js`, `scripts/verify-runtime-closure.js`, Electron preparation/lock scripts if their manifests enumerate Reveal assets
- `shared/src/htmlGenerator.js`
- `shared/src/presenterTools.js`
- `client/src/utils/offlineExport.js`
- `client/src/hooks/use-reveal-preview-frame.js`
- Present/share/raster/PDF route tests and generated HTML tests
- Optional plugin assets: reveal-menu, chalkboard, customcontrols

## Contract

- Pin `reveal.js` to exact `6.0.1` in the owning server workspace and regenerate the root lockfile intentionally.
- Publish built-in assets only from `reveal.js/dist`, including `dist/plugin/{notes,highlight,markdown,math,search,zoom}/*`. Remove all copies and URLs under `reveal.js/plugin/*`.
- Generated HTML, presenter tools, preview iframe, offline inliner, server raster routes, and Electron package consume the same vendor manifest.
- Preserve current themes, vertical slides, fragments, notes, syntax highlight, KaTeX, Mermaid, presenter tools, live navigation, and PDF/raster behavior.
- Reveal 6 postMessage blacklist includes `previewIframe`; project preview/live code must use direct same-origin deck APIs or allowed messages and must not rely on that command.
- Optional third-party plugins stay only after compatibility smoke; failure is explicit and actionable, never a silent missing control.

## RED

- [x] Assert the current dependency/version receipt is not 6.0.1.
- [x] Asset manifest test expects required `dist/plugin` files and rejects legacy `/vendor/reveal.js/plugin/` URLs.
- [x] Generated HTML test loads notes/highlight from the new paths and initializes plugins exactly once.
- [x] Offline export test recursively inlines new plugin paths, iframe `srcdoc`, themes, code highlight, and required fonts/assets with zero network fetches.
- [x] Preview test proves ready/navigation behavior for horizontal, vertical, and fragment indices under Reveal 6.
- [x] Browser smoke covers present, share, speaker notes, overview, scroll view, auto-slide/kiosk, theme, optional plugins, and print/PDF query modes.
- [x] Runtime closure/Electron test rejects missing Reveal 6 assets and stale version-5 copies.

## GREEN

- [x] Update dependency and lockfile; verify package metadata reports exactly 6.0.1.
- [x] Refactor `copy-vendor.js` to a declarative required-asset manifest rooted in `dist`; copy atomically and fail when a required path is absent.
- [x] Update `htmlGenerator`, presenter tools, offline path maps, and any CSP/allowlist references to new plugin URLs.
- [x] Adapt initialization/config differences only where tests demonstrate a Reveal 6 behavior change; do not rewrite stable presentation logic.
- [x] Keep preview iframe synchronization on `Reveal.isReady()/configure()/slide()` with guarded lifecycle cleanup.
- [x] Upgrade, adapt, or explicitly remove an incompatible optional plugin only through a recorded product decision and inventory update.

## REFACTOR

- [x] Delete legacy asset-path aliases and dual-version branches after all callers move.
- [x] Make runtime closure derive from the same manifest as vendor copy/offline inlining.
- [x] Keep one version receipt included in diagnostics/export metadata so support can identify the shipped runtime.

## Focused Verification

```bash
npm test -- shared/tests/htmlGenerator.test.js client/src/utils/offlineExport.test.js client/src/hooks/use-reveal-preview-frame.test.jsx
npm run vendor
npm run build
npm run runtime:verify
```

Then run the focused Playwright presentation/offline/print specs and inspect network requests for zero missing or remote required Reveal assets.

## Success Criteria

- [x] `node_modules/reveal.js/package.json` and lockfile resolve 6.0.1 exactly.
- [x] No source, generated HTML, client dist, or prepared Electron asset references `/vendor/reveal.js/plugin/*`.
- [x] Built-in and retained optional plugins initialize and expose their current controls.
- [x] Preview/live navigation has no postMessage blacklist violation or readiness race.
- [x] Offline HTML and Electron runtime work with network disabled.
- [x] Present/share/PDF/raster outputs preserve current slide/layout/render behavior.

## Risks / Rollback

- A dependency-only bump will break vendor copying because Reveal 6 removed the old package path. Treat dependency, paths, generated output, and packaging as one atomic change.
- Optional plugins may depend on Reveal 5 internals. Block release until adapted or deliberately removed with documented behavior change.
- Rollback is one atomic revert of dependency, lockfile, vendor manifest, generated-path code, and regenerated assets; never mix Reveal 5 code with Reveal 6 assets.