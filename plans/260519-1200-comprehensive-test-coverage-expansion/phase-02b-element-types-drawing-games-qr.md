---
phase: 2
title: "Phase 2b — Element Types Drawing/Games/QR/Icon/Callout/Divider"
status: completed
priority: P1
effort: "3-4d"
dependencies: [0]
tdd: true
---

<!-- Updated: Validation Session 1 — split from Phase 2 monolithic to enable parallel lanes -->

# Phase 2b — Element Types Drawing/Games/QR Coverage

## Status (completed 2026-05-19)
- 2 new spec files in `tests/e2e/elements/`:
  - `drawing-and-svg-element-rendering-with-paths-and-vector-graphics.spec.js` — 5 tests (path render, empty placeholder, SVG content, multi-coexist, stroke update)
  - `qr-icon-callout-divider-element-rendering-and-property-persistence.spec.js` — 8 tests (QR data + update, icon names, callout numbers, divider line type, callout color update)
- **13/13 passing** in ~19s wall (workers=2)
- Per-game-type smoke (7 types) + canvas rendering already covered in pre-existing `tests/e2e/games/game-elements.spec.js` — no duplication needed
- Drawing seeded via `apiUpdatePresentation` (mouse-draw deferred per R-01)
- Live game leaderboard rendering deferred to Phase 4 (requires Socket.IO room fixture)

## Overview
Phủ e2e cho 4 element types còn lại + 7 game types: drawing (API seed only), QR/icon/callout/divider, games per-type smoke + leaderboard. Mỗi spec ≤ 200 LOC. **Phase 2a phải xong trước HOẶC chạy song song với Phase 2a (different files, no overlap).**

## Red-team patches incorporated
- Patch-06: split from Phase 2 monolithic per validation answer.

## Element backlog (Phase 2b only)
- Divider (no e2e at all)
- QR content update
- Icon picker
- Callout style
- Drawing strokes (API seed)
- Line/Arrow style
- Game per-type smoke (7 types) + leaderboard

## Requirements

### Functional
- Each of 4 element types + 7 game types has ≥ 1 spec verifying insert + render + persist.
- Game leaderboard render verified.
- Drawing strokes verify via API seed (no UI mouse-draw).
- 0 flaky.

### Non-functional
- Each spec ≤ 200 LOC.
- Per-test execution < 30s.
- Drawing seeded via `apiUpdatePresentation`; mouse-draw spec marked `test.fixme` if unstable.

## Architecture
Spec layout:
- `tests/e2e/elements/qr-icon-callout-divider.spec.js`
- `tests/e2e/elements/drawing-and-svg.spec.js` (API seed)
- `tests/e2e/games/per-game-type-smoke.spec.js` (extend existing)
- `tests/e2e/games/leaderboard-rendering.spec.js`

## Related Code Files
- **Create:** 4 specs above + helpers if needed
- **Modify:** `tests/e2e/pages/RibbonInsertHelper.js` (extend with QR/icon/callout/divider/drawing entries), `tests/e2e/pages/GameHelper.js`
- **Read-only:** `client/src/components/canvas/element-renderers/**`, `server/services/game-socket-handler.js`, `server/services/game-room-manager-singleton-service.js`
- **NOT in this phase:** core element types (Phase 2a owns)

## Implementation Steps (TDD)

### Step 1 — Read first
- Read existing `tests/e2e/games/game-elements.spec.js` to reuse fixture patterns.
- Read `RibbonInsertHelper.js` to ensure QR/icon/callout entries exist; if absent, file follow-up.

### Step 2 — Red
- 4 skeleton specs with one failing assertion each. All fail initially.

### Step 3 — Green: QR/icon/callout/divider
- Insert via Insert tab; verify render + API persist.
- QR content update via property panel.
- Callout style picker exercise.
- Divider — minimal smoke (insert + render).

### Step 4 — Green: drawing (API seed)
- Seed `drawingStrokes: [...]` via `apiUpdatePresentation`.
- Render verify only; mouse-draw not in scope.

### Step 5 — Green: games per-type
- For each of 7 game types: create game from template → verify type-specific UI elements.
- Piggyback on existing socket fixture.

### Step 6 — Green: leaderboard
- Seed multiple players via socket helper; verify leaderboard sort order.

### Step 7 — Refactor
- Extract game-creation helper if duplication ≥ 3x.
- Each spec ≤ 200 LOC.

### Step 8 — Verify
- Full e2e green for these specs.
- Coverage `element-renderers/**` raised to ≥ 90% (combined with 2a).

## Success Criteria
- [ ] 4 new spec files, ~14 tests, 0 fail / 0 flaky.
- [ ] 4 element types + 7 game types covered.
- [ ] Combined with 2a: `element-renderers/**` ≥ 90%.
- [ ] All specs ≤ 200 LOC.

## Risk Assessment
- **R-01**: Drawing canvas mouse events flaky. Mitigation: API seed only this phase; mouse-draw deferred.
- **R-02**: 7 game types socket setup tedious. Mitigation: piggyback on `games/game-elements.spec.js` fixtures.
- **R-03**: Leaderboard sort order non-deterministic if scores tied. Mitigation: seed unique scores in fixture.
- **R-04**: Phase 2a + 2b parallel agents both touch `RibbonInsertHelper.js`. Mitigation: 2a adds core entries, 2b adds aux entries via `addInsertEntry` helper; merge cleanly via append-only pattern.
