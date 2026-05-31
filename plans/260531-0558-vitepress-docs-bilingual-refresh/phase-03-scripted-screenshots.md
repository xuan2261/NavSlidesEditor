---
phase: 3
title: "Scripted Screenshots"
status: completed
priority: P2
effort: "1-1.5d"
dependencies: [1]
---

# Phase 3: Scripted Screenshots

## Overview

Add a standalone, re-runnable Playwright script that boots against the running dev app, navigates to known UI states, and writes deterministic PNGs to `website/public/img/` for embedding in docs. Reproducible — no hand-captured rot. NOT part of the CI gate.

## Requirements

- Functional: `node scripts/capture-docs-screenshots.js` produces ~15-18 clean PNGs; re-running refreshes them. Markdown embeds via `/img/<name>.png`.
- Non-functional: deterministic (frozen animations, suppressed overlays, masked dynamic content); script invisible to `npx playwright test` CI gate; cleans up any presentations it creates.

## Architecture

- Raw `chromium.launch` imported from `@playwright/test` re-export (no new dependency, not picked up by the test runner / CI gate).
- Preflight: assume `npm run dev` already running; `fetch` check `:5173` + `:3002/api/presentations`, fail fast with clear message. Do NOT spawn the dev server (Windows process-group fragility — YAGNI).
- Reuse existing deterministic helper: `tests/e2e/pages/visual-snapshot-deterministic-freeze-and-helper.js` (freeze animations, suppress tutorial/product-tour overlays). Import or mirror its freeze logic.
- Seed slide content via REST (`POST` then `PUT /api/presentations/:id`) mirroring `tests/e2e/fixtures/test-fixtures.js`. **Verify accepted body shape against `server/routes/presentations.js` before relying on it** (researcher flagged this as unconfirmed).
- Viewport 1280×800, `deviceScaleFactor: 2` for crisp images; `locator.screenshot()` for element crops, `page.screenshot()` for full viewport; `mask` the autosave badge / any timestamp.
- `website/public/` does not exist yet — create `website/public/img/`. VitePress serves `public/` and auto-prepends `base` (`/NavSlidesEditor/`) for absolute `/img/...` refs in markdown (no manual base prefix).

## Related Code Files

- Create:
  - `scripts/capture-docs-screenshots.js` — the capture script (use skeleton in Implementation Steps).
  - `website/public/img/.gitkeep` — ensure dir tracked (images themselves committed too, per "screenshots in repo" decision).
  - `tests/unit/website-screenshot-assets-and-references.test.js` — guard: every `/img/*.png` referenced in `website/**/*.md` exists in `website/public/img/`, and the capture script exists + is not imported by any `tests/**` spec (so it stays out of the gate).
- Modify (embed images): refreshed EN pages from Phase 1 — `tutorials/first-presentation.md`, `images.md`, `shapes-drawing.md`, `charts-tables.md`, `presenting.md`; `features/overview.md` (hero shot). Add `![alt](/img/<name>.png)` at sensible points.
- Read (read-only): `tests/e2e/pages/visual-snapshot-deterministic-freeze-and-helper.js`, `tests/e2e/fixtures/test-fixtures.js`, `server/routes/presentations.js` (verify seed shape).

## Implementation Steps

1. Verify the REST seed contract: read `server/routes/presentations.js`; confirm `POST /api/presentations` create shape and whether `PUT /api/presentations/:id` accepts a full `slides`/`elements` array. Adjust seeding to the real contract. If a state can't be seeded via API, seed via UI actions with data-testid selectors instead.
2. Write `scripts/capture-docs-screenshots.js`:
   - preflight server check; `mkdir -p website/public/img`.
   - `chromium.launch()`, context at 1280×800 @2x.
   - helper `capture(page, name, {locator?})` → freeze + settle (`networkidle` + double-rAF) + screenshot.
   - capture set (reachable without a live Socket.IO room): `home-dashboard`, `editor-empty`, `editor-ribbon-insert`, `editor-ribbon-design`, `editor-properties-panel`, `editor-chart-element`, `editor-code-element`, `editor-latex-element`, `editor-shape-element`, `editor-table-element`, `share-modal`, `export-modal`, `settings-page`, `ai-authoring-modal`, `pptx-import-dialog`.
   - `finally`: delete created presentations (soft + permanent), close browser.
3. Run the script against a live `npm run dev`; eyeball output PNGs for cleanliness (no tour popovers, no caret, no half-loaded charts).
4. Embed key images into the Phase-1 EN pages listed above. Use VitePress sizing if retina images render too large: `![alt](/img/x.png)` with CSS `max-width:100%` (default theme handles this) — verify in `docs:build` preview.
5. Add guard test `website-screenshot-assets-and-references.test.js` (referenced-image existence + script-not-in-gate check).
6. `npm run docs:build` green; `npx vitest run tests/unit/website-*.test.js` green; confirm `npx playwright test --list` does NOT include the capture script.

## Success Criteria

- [ ] `node scripts/capture-docs-screenshots.js` produces the PNG set deterministically and is re-runnable.
- [ ] Script not part of the Playwright/CI gate (verified via `--list`).
- [ ] Images embedded in target EN pages; `docs:build` renders them (base path correct).
- [ ] Created presentations cleaned up; no test data leaks into `server/data/`.
- [ ] Guard test passes; existing `website-*` tests stay green.

## Risk Assessment

- **REST seed shape unconfirmed** → Step 1 verifies against `server/routes/presentations.js` before relying on it; fallback to UI-driven seeding.
- **Live/speaker/game shots need a Socket.IO room** (two-browser / room code) → OUT OF SCOPE v1; capture only states reachable from a single page. Document the gap.
- **Retina image weight** (2560×1600 PNGs) → acceptable for docs; if repo size is a concern, drop to `deviceScaleFactor:1.5` or run pngquant. Decide at implementation; not blocking.
- **Screenshots rot when UI changes** → mitigated by design (re-run script). Add a note in `develop/contributing.md` (Phase 2) to re-run after UI changes.
- **Script accidentally swept into CI** → guard test asserts no `tests/**` spec imports it; keep it under `scripts/`, not `tests/`.
