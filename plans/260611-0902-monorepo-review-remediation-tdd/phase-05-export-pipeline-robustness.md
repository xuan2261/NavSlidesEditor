---
phase: 5
title: "Export Pipeline Robustness"
status: complete
priority: P2
effort: "1.5d"
dependencies: [4]
---

# Phase 5: Export Pipeline Robustness

## Overview
The client-facing PPTX raster route crashes the whole export when one element
fails, two raster engines have diverged (the worse one serves clients), image
opacity is lost server-side, and timeline/game throw in strict mode. Consolidate
on one resilient engine and stop the deck-killing throws (now safe — Phase 4
ships their renderers).

## Findings Covered
- **I-R3.1** — client raster route lacks per-element try/catch → one failure 500s the whole export.
- **I-R3.2** — server drops image opacity (client applies transparency).
- **I-R3.3** — timeline/game not in rasterizable switch → strict mode throws, crashes deck export.
- **I-R3.4** — two near-duplicate raster engines diverge; worse one serves clients (naive origin check, vendor route leak when `!baseUrl`).
- **M-R3×4** — per-miss Chromium relaunch; launch-fail generic 500; global `rasterCache` race; offline HTML doesn't inline external/CDN images.

## Requirements
- Functional: a single failing element degrades to placeholder, never fails the
  whole export; image opacity preserved; timeline/game export as static (no throw);
  offline export truly offline.
- Non-functional: one raster engine; per-element isolation; bounded Chromium launches.

## Architecture

### I-R3.4 + I-R3.1 — consolidate engines
`server/services/pptx-exporter.js:124-137` is the client-facing engine (called by
`exportPptx.js:45`) and is the WORSE one: only `{html,latex}`, no cache, no
per-element isolation, naive `startsWith` origin check, `installVendorRoute`
returns early when `!baseUrl` (leaks all network). The resilient engine lives at
`server-raster.js:182-196` (`getServerRasters`). **Action:** make the client path
use `getServerRasters`; delete/forward the duplicate. Per-element try/catch →
failed element becomes gray placeholder, export continues.

### I-R3.2 — image opacity
`server/utils/server-basic-renderers.js:42-98` `addImageElement` ignores opacity;
client applies `transparency` at `export-pptx-basic-renderers.js:52-54`. Add the
same transparency mapping server-side.

### I-R3.3 — stop the throw (depends on Phase 4)
`server/utils/server-fallback.js:49-71`: timeline/game now have shared renderers
(Phase 4). Route them to raster (or the static renderer) instead of throwing in
strict mode. Strict mode must not crash a whole deck for one unsupported type.

### Mediums
- M1: reuse one Chromium/page across elements (`server-export.js:43`,
  `server-fallback.js:52`) instead of N launches.
- M2: launch-fail → actionable error ("run `npx playwright install`") not generic 500.
- M3: `rasterCache` global + `clearRasterCache()` at function end races across
  concurrent exports — scope cache per-export or key safely.
- M4: offline HTML (`offlineExport.js:447-463`) inlines only `/uploads/`; also
  inline external/CDN images (fetch + base64) or document the limit clearly.

## Related Code Files
- Modify: `server/services/pptx-exporter.js`, `server/utils/server-raster.js`, `server/utils/server-fallback.js`, `server/utils/server-basic-renderers.js`, `server/utils/server-export.js`
- Modify: client `exportPptx.js`, `export-pptx-basic-renderers.js`, `offlineExport.js` (paths via Glob)
- Reference (read): `server/routes/pptx-export.test.js`, Phase 4 shared renderers
- Create: `server/services/raster-resilience.test.js`, `server/utils/image-opacity-export.test.js`

## TDD — Tests First
1. **I-R3.1**: export a deck where one element rasterization throws → export
   succeeds, that element is placeholder, others intact (red today — 500).
2. **I-R3.2**: image with opacity 0.5 → exported pptx image carries transparency (red).
3. **I-R3.3**: strict-mode export of timeline/game → no throw, static output (red).
4. **I-R3.4**: client path and server path produce identical rasters for same input
   (engine consolidation regression guard).

## Implementation Steps
1. Confirm Phase 4 shared renderers landed (dependency).
2. Write failing tests 1–4.
3. Point client path at `getServerRasters` + per-element try/catch → tests 1,4.
4. Server image opacity → test 2.
5. Stop-throw for timeline/game → test 3.
6. Mediums M1–M4.

## Success Criteria
- [x] Tests 1–4 green.
- [x] One raster engine; no naive `startsWith` origin check; vendor route never leaks on `!baseUrl`.
- [x] `npm run test:corpus` + `npm run test:pptx:browser-audit` green.

## Red-Team Amendments (2026-06-11)

- **Phase 5→4 dependency is NOT test-enforced (High).** Test 3 ("strict-mode
  export of timeline/game → no throw") passes via the placeholder branch
  (`server-fallback.js:14-35`) even WITHOUT Phase 4's renderers → timeline/game
  silently become gray boxes while the test stays green. **Required:** add an
  assertion that the output contains the Phase-4 static content (timeline image
  href present; game label/badge present), not merely "no throw". Also note the
  subsystem gap: Phase 4 ships HTML-string renderers (`element-renderers.js`)
  while `server-fallback.js:63-70` throws in the RASTER/screenshot path — specify
  the concrete handoff (route timeline/game to the HTML renderer, or to a static
  raster of it), don't assume the HTML renderer auto-fixes the raster throw.

- **Fix rasterCache race (M3) BEFORE consolidation (High).** `clearRasterCache()`
  is global (`server-export.js:79`) and wipes a concurrently-running export's
  cache; the interactive route (`presentations.js:240`) never clears the global
  cache (`server-raster.js:20`). Consolidating engines first makes this worse.
  **Reorder:** scope/key the cache per-export FIRST, then consolidate.

- **Test 4 (client==server raster equality) is a phantom after consolidation
  (Medium).** Once both paths use `getServerRasters`, test 4 compares the engine
  to itself — can never fail. **Replace** with a golden-fixture pin: assert the
  consolidated engine's raster output matches a committed reference for a sample
  element (catches real fidelity drift).


  test 4 pins client==server; corpus + browser-audit catch fidelity drift.
- **Risk:** shared Chromium page state bleeds between elements. *Mitigation:*
  reset page content per element; isolate via fresh context if cheap.
- **Risk:** inlining external images in offline export hits CORS/timeouts.
  *Mitigation:* timeout + fallback to documented limit; don't fail the export.
