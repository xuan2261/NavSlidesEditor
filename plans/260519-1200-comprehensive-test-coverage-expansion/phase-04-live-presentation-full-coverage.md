---
phase: 4
title: "Live Presentation Full Coverage"
status: completed
priority: P0
effort: "5-7d"
dependencies: [0]
tdd: true
---

<!-- Updated: completed 2026-05-19 — adapted to current server capabilities (no live timer for non-game elements; B/W is viewer-local; presenter URL is top-level not iframed) -->

# Phase 4 — Live Presentation Full

## Status (completed 2026-05-19)
- 5 spec files in `tests/e2e/live/`:
  - `annotation-sync-and-persistence.spec.js` — 4 tests (add/remove/clear + rejoin restoration)
  - `black-and-white-screen-overlay-viewer-keyboard.spec.js` — 3 tests (B/W keyboard toggle + click dismiss)
  - `live-timer-broadcast-via-game-timer-socket-events.spec.js` — 4 tests (game-timer-start/pause/stop + late-joiner hydration)
  - `present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js` — 4 tests (Reveal.next/prev/slide(N)/last)
  - `presenter-disconnect-cleanup-and-viewer-count-tracking.spec.js` — 4 tests (presenter-left overlay, waiting state, viewer count, unknown room 404)
- 1 helper: `tests/e2e/helpers/playwright-tolerant-poll-wait-helpers-for-live-presentation-e2e.js` — `waitWithLastSample` poll wrapper
- **19/19 passing** in ~40s wall (workers=1)
- New playwright project `chromium-live` with `workers: 1` (R-04 mitigation); main `chromium` project ignores `tests/e2e/live/**`

## Deviations from original plan
- **Black/white screen is viewer-local, NOT broadcast.** Investigation showed `LiveViewPage` handles B/W keys directly via `getShortcuts()`; no socket event for screen-blackout exists. Spec validates the viewer-local UX path instead of presenter→viewer broadcast.
- **No generic presenter timer** — only `game-timer-*` events for game element timers. Spec uses `game-timer-start/pause/stop` directly. Schema rejects unknown element types (`four-corners` not in zod whitelist), so timer test seeds a `text` element and references its id.
- **Presenter page is top-level, not iframed.** `/api/presentations/:id/present?live=...` returns reveal HTML directly; `window.Reveal` is on the page itself. Used `presenter.evaluate(() => window.Reveal.next())` instead of `iframe.contentFrame()`.
- **Live timer triggered via socket emit, not UI.** No presenter UI exists for `game-timer-start` outside game element renderers; emitting socket events directly is the contract under test.

## Overview
Phủ flow live presentation chưa cover: annotation tools sync + persistence per-slide, B/W screen overlay (viewer-local), live timer broadcast via game-timer socket events, present-mode keyboard navigation, presenter-disconnect cleanup.

## Red-team patches incorporated
- Patch-07: effort 3-4d → 5-7d (multi-page socket testing historically flaky); tolerant polls (5s window, last-sample <2s); pin `workers: 1` for live suite

## Requirements

### Functional
- Annotation strokes sync presenter → viewer **within 5s window** (last sample observed <2s); poll-based assertion, NOT tight 500ms.
- Rejoin viewer → previous-slide annotations restored within 5s.
- B/W key on viewer → overlay visible within 2s; click/Escape dismiss works.
- Live timer broadcasts elapsed via `timer:sync`; viewer hydrates `window.__timerStates` within 5s; late-joiner gets running state.
- Present-mode Reveal API: `next()`, `prev()`, `slide(N)`, `slide(total-1)`.
- Presenter disconnect → viewer sees ended state within 5s; viewer count tracks join/leave.

### Non-functional
- Tests run with multi-page context (presenter socket + viewer page).
- Use socket events directly in test setup where mouse-draw flaky.
- **`workers: 1` for live suite** — prevent multi-page socket race contention; accept longer wall-clock for stability.
- **Tolerant polls only** — `expect.poll(fn, { timeout: 5000, intervals: [200, 500, 1000, 2000] })`; record last sample for debug; never assert tight ms thresholds in live e2e.

## Architecture
- `waitWithLastSample` helper centralizes tolerant-poll pattern.
- Each spec is self-contained: presenter socket connects via `socket.io-client`, joins room with token, emits domain events.

### Tolerant poll pattern
```js
async function waitWithLastSample(label, fn, { timeout = 5000, intervals = [200, 500, 1000, 2000] } = {}) {
  let last
  await expect.poll(async () => { last = await fn(); return last }, {
    timeout, intervals,
    message: `${label} not converged within ${timeout}ms; last sample: ${JSON.stringify(last)}`
  }).toBeTruthy()
  return last
}
```

### Project config (Phase 4 added `chromium-live`)
```js
// playwright.config.js
{ name: 'chromium', testIgnore: /tests\/e2e\/live\/.*\.spec\.js/, ... },
{ name: 'chromium-live', testMatch: /tests\/e2e\/live\/.*\.spec\.js/, workers: 1, ... },
```

## Related Code Files
- **Created:** 5 specs in `tests/e2e/live/` + `tests/e2e/helpers/playwright-tolerant-poll-wait-helpers-for-live-presentation-e2e.js`
- **Modified:** `playwright.config.js` (added `chromium-live` project, `chromium` ignores live)
- **Read-only used:** `server/services/socket-handler.js`, `server/services/live-rooms.js`, `client/src/hooks/use-annotation-sync.js`, `use-live-timer-sync.js`, `client/src/pages/LiveViewPage.jsx`

## Success Criteria
- [x] 5 specs, 19 tests, 0 fail / 0 flaky on `chromium-live` project.
- [x] Live suite uses `workers: 1`, completes < 1 min wall (40s observed).
- [x] All assertions use tolerant polls; no tight ms thresholds.

## Risk Assessment (resolved)
- **R-01**: Multi-page socket events out-of-order → flaky. Resolved via `waitWithLastSample` 5s timeout; observed convergence <2s.
- **R-02**: Annotation drawing via mouse non-deterministic. Resolved by emitting socket events directly.
- **R-03**: Presenter token bootstrap via `window.name`. Reused existing pattern from `live.spec.js`.
- **R-04**: `workers: 1` makes Phase 4 wall longer. Resolved — actual wall 40s, well under 8 min budget.
- **R-05**: 5s timeout still flakes on overloaded CI. Resolved — last-sample logging documented in helper for debug.
- **R-06 (NEW, resolved)**: Schema rejects non-whitelisted element types (`four-corners`). Resolved by using `text` element id as timer reference.
