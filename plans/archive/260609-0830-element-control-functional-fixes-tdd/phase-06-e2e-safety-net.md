---
phase: 6
title: "E2E Safety Net"
status: completed
priority: P1
effort: "1d"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: E2E Safety Net

## Overview
Add real-browser (Playwright) coverage for the previously-shipped interaction
fixes that jsdom unit tests cannot exercise (Stream B found 7 GAP, 4 PARTIAL).
The autosave-flush-on-leave (data-loss) gap is the top priority — `beforeunload`
+ keepalive are physically untestable in jsdom.

## Defects Addressed (coverage gaps, not code bugs)
- **P0-AUTOSAVE-E2E** — no browser test for autosave flush on unmount/nav/tab-close.
- Multi-select fan-out (apply-to-selection) — zero E2E.
- Marquee excl hidden/locked + z-order swap + synchronous drag-selection — real pointer coords.
- Undo-disabled-on-fresh-load + TipTap undo reconcile — real Selection API / aria-state.
- Clipboard groupId remap on paste + Ctrl+D no-clobber — ungapped parts.

## Requirements
- Functional: each spec FAILS if its fix regresses. Specs run in the existing
  Playwright harness (`tests/e2e/`). Autosave spec proves a pre-unload edit lands
  server-side.
- Non-functional: stable (no flakes) — avoid intercepting keepalive requests
  directly; assert via observable end state.

## Architecture
- **autosave-flush-on-leave.spec.js (new):** edit an element, navigate away (or
  trigger unload) BEFORE the debounce window elapses, then poll the API
  (`GET /api/presentations/:id`) and assert the edit landed. Design note (Stream
  B): do NOT assert on the keepalive request itself — `page.route` interception of
  beforeunload-fired keepalive is unreliable in Playwright. Assert the landed edit.
  Covers autosave flush + A→B nav drain.
- **canvas/apply-to-selection.spec.js (new):** select 3 elements, change fill →
  all 3 change; set X → all shift by same delta; set W → all same width;
  rotation wraps. Type-gated: fontSize on mixed selection only hits text.
- **canvas/marquee-and-zorder.spec.js (new):** real mousedown/move marquee that
  excludes hidden+locked; bring-forward swaps with neighbor; grab unselected
  element drags THAT element (synchronous selection).
- **undo-redo.spec.js (extend):** fresh load → Undo disabled (aria-state); after
  edit → enabled; undo past an element removes it from selection; TipTap content
  reset.
- **canvas/clipboard.spec.js (extend):** paste a copied group → copies get a new
  shared groupId (not merged with source); Ctrl+C → Ctrl+D → Ctrl+V pastes the
  copied element (clipboard intact).

## Related Code Files
- Create: `tests/e2e/autosave-flush-on-leave.spec.js`
- Create: `tests/e2e/canvas/apply-to-selection.spec.js`
- Create: `tests/e2e/canvas/marquee-and-zorder.spec.js`
- Modify: `tests/e2e/undo-redo.spec.js` (or create if absent)
- Modify: `tests/e2e/canvas/clipboard.spec.js`

## Implementation Steps (TDD-ish for E2E)
1. Confirm Playwright harness runs locally (`npm run test:e2e` smoke). Identify
   the existing fixtures/helpers for opening the editor with a known presentation.
2. **autosave first:** write the flush-on-leave spec; run → it must PASS against
   the already-shipped fix (this is a regression net, the fix exists). If it FAILS,
   that's a real bug in the shipped fix — investigate before proceeding.
3. apply-to-selection spec; run.
4. marquee-and-zorder spec; run.
5. undo-redo spec extension; run.
6. clipboard spec extension; run.
7. Full `npm run test:e2e` (or targeted) green; `npm run lint`.

## Success Criteria
- [ ] autosave-flush-on-leave spec passes (edit lands after navigate-away)
- [ ] apply-to-selection, marquee+zorder, undo-redo, clipboard specs added + green
- [ ] All specs are stable (no flake on 3 consecutive runs)
- [ ] lint clean

## Risk Assessment
- **Risk:** beforeunload/keepalive E2E flakiness. **Mitigation:** assert landed
  server state via API poll, not request interception (Stream B design note).
- **Risk:** a new spec reveals the shipped fix actually regresses in-browser
  (jsdom gave false confidence). **Mitigation:** that's the POINT — treat a red
  spec as a real bug, fix before closing (HARD-GATE: don't weaken the test to pass).
- **Risk:** Playwright pointer coords differ from jsdom assumptions. **Mitigation:**
  use real canvas-relative coordinates from the rendered element rects.
