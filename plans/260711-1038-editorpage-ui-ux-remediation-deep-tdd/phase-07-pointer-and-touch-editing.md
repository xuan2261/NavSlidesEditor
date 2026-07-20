---
phase: 7
title: "Pointer And Touch Editing"
status: complete
priority: P0
effort: "4-6 dev-days"
dependencies: [2, 4, 5]
---

# Phase 7: Pointer And Touch Editing

## Overview

Replace mouse-only event transport with one Pointer Events interaction path for mouse, pen and touch. Integrate existing pinch/touch hooks into the real editor while preserving geometry, snapping, locks, keyboard access, history and autosave.

## Requirements

### Functional

- Mouse, touch and pen can select, move, resize, rotate, crop and manipulate guides.
- Tablet users can pinch zoom through the canonical zoom state.
- Canvas background supports pointer rubber-band selection.
- Touch supports tap selection, double-tap text editing and long-press context menu.
- `pointercancel`, lost capture, unmount and second-finger pinch clean up pending interactions.
- Cancellation is transactional: restore the captured start snapshot or discard buffered preview geometry, with no partial history/autosave commit.
- Locked slides/elements and group policies remain enforced.

### Non-functional

- One canvas interaction state machine owns `idle`, `pending`, `dragging`, `long-press`, `pinching` and `cancelled`. Gesture helpers are pure recognizers, not independently attached session owners.
- Existing slide-coordinate math remains authoritative.
- Touch targets reach 44×44 CSS px without enlarging visual handles.
- `touch-action` is scoped; editable/media controls retain native interaction.
- No duplicate compatibility click after touch.

## Architecture

```text
pointerdown
  -> pointer session {id, type, mode, origin, presentationId,
                      slideId, childId, elementIds, startSnapshot}
  -> existing move/resize/rotate/crop geometry
  -> capture + pointermove
  -> pointerup/cancel shared cleanup
  -> EditorPage mutation -> history/autosave

second touch
  -> transactionally cancel/rollback pending element session
  -> pinch controller
  -> canonical zoom + manual mode
```

## File Inventory

| Action | File | Planned impact |
|---|---|---:|
| Modify | `client/src/components/SlideCanvas.jsx` | Pointer canvas/rubber-band and pinch wiring |
| Modify | `client/src/components/canvas/use-canvas-pointer-interaction.js` | Pointer session/capture/cancel |
| Modify | `client/src/components/canvas/canvas-element-wrapper.jsx` | Pointer handlers and touch hit areas |
| Modify | Crop overlay and rulers | Pointer capture and ID isolation |
| Modify | `client/src/hooks/use-pinch-zoom.js` | Canonical integration and cancellation |
| Modify | `client/src/hooks/use-touch-gestures.js` | Convert to pure gesture recognizer and timer cleanup |
| Modify | Existing pointer/gesture tests | Mouse regression and cancellation cases |
| Create | `use-canvas-pointer-interaction.touch.test.jsx` | 150-190 LOC |
| Create | `canvas-element-wrapper.touch.test.jsx` | 120-160 LOC |
| Rewrite | Existing tablet touch Playwright spec | Real editing assertions |
| Create | `tests/e2e/helpers/cdp-multi-touch-driver.js` and unit contract | Stable multi-contact touch, pointer IDs and cancellation |
| Modify | Playwright config/package scripts | Add mandatory tablet-touch project/script, not environment-optional only |
| Delete | None | Existing geometry/hooks retained and integrated |

## Interfaces To Protect

- Full SlideCanvas callback contract.
- Exported geometry helpers and drag threshold.
- Selection resolver, grid snapping, smart guides, clamping, Shift aspect lock and Shift rotation.
- Locked/group mutation policy and blocked notices.
- Keyboard nudge/edit semantics.
- Embedded iframe/media interaction after selection.
- Canonical zoom range and manual-mode behavior.
- Mouse click, double-click, context menu, upload drop and autosave.
- Gesture target identity: double taps require the same element, pointer type and bounded coordinate distance.

## TDD Scenario Matrix

| Priority | Input/Scenario | Expected |
|---|---|---|
| Critical | Mouse drag after migration | Existing geometry and callbacks unchanged |
| Critical | Touch tap/drag | Select once; move within 2 slide px tolerance |
| Critical | Touch resize/rotate | Commit expected size/angle once |
| Critical | Pointer cancel/lost capture | Start geometry restored; no history/autosave commit |
| Critical | Multi-touch pinch | Active drag rolls back; zoom changes; element geometry does not |
| Critical | Locked element/slide | No mutation; notice shown |
| High | Double-tap text | Enter edit mode exactly once |
| High | Long press | Existing context menu opens at coordinates |
| High | Rubber-band | Same selected IDs as mouse |
| High | Crop/ruler | Persist expected crop/guide position |
| High | Pointer ID isolation | Unrelated pointer cannot finish session |
| High | Slide/route changes mid-gesture | Session cancels; captured target cannot mutate the new active slide |
| High | Double taps on different targets | Never combine into one edit gesture |
| Medium | Media/editable content | Native controls remain operable |
| Medium | Unmount mid-drag | All capture/listeners/timers cleaned |

## Device And Runtime Metrics

- Desktop Chrome 1440×900 mouse: current interactions unchanged.
- Tablet landscape 1024×768, touch enabled: select/move/resize/rotate/crop/pinch pass.
- Tablet portrait 768×1024: same core editing flows pass.
- Pixel 7 below breakpoint: guard visible; hidden editor not focusable.
- Geometry tolerance: ≤2 slide-coordinate px.
- Touch hit area: ≥44×44 CSS px.
- Zero geometry updates after `pointerup` or `pointercancel`.
- Cancelled gestures produce zero persisted geometry delta, zero history entry and zero autosave request.
- Zoom clamped to canonical range; no element mutation during pinch.
- Zero page/console errors.

## Tests Before

1. Preserve current mouse geometry tests unchanged.
2. Add RED touch selection, move, resize, rotate, crop and ruler tests.
3. Add pointer-ID, cancel, lost-capture and unmount tests.
4. Add second-finger pinch-versus-drag collision test.
5. Add RED route/active-slide change and double-tap target-identity cases.
6. Build a Chromium CDP multi-contact driver; reject mouse substitution in touch assertions.
7. Replace the current touch-availability E2E with a deterministic seeded editor fixture.
8. Add computed hit-area assertions in tablet mode.

## Refactor

1. Introduce one explicit canvas interaction state machine around existing geometry.
2. Replace document mouse listeners with captured pointer listeners and fallback cleanup.
3. Convert wrapper, handles, crop and rulers.
4. Convert pinch and tap helpers to pure recognizers feeding the same state machine.
5. Integrate pinch with canonical zoom and transactional drag rollback.
6. Integrate tap/double-tap/long-press with target/time/distance identity.
7. Scope `touch-action` by interaction region.
8. Remove unused duplicate transport/session owners only after all devices pass.

## Tests After

- Verify one mutation per gesture and no synthetic-click duplication.
- Verify resize/rotate handles remain visually compact but physically touchable.
- Verify touch and mouse produce equivalent selection and geometry.
- Verify reduced-motion and accessibility focus remain unaffected.
- Verify autosave queues one resulting snapshot, not every raw pointer event.
- Verify cancelled gestures create no history entry or save request.
- Verify CDP event logs show real touch pointer types and multi-contact pinch.

## Implementation Steps

1. Add RED unit/component touch matrix.
2. Add real tablet Playwright fixture and tests.
3. Convert core move/resize/rotate session.
4. Convert canvas rubber-band, crop and rulers.
5. Integrate pinch and gesture timing.
6. Add scoped touch-action/hit areas.
7. Run desktop regression before tablet gates.
8. Run full phase validators.

## Regression Gate

```powershell
npx vitest run client/src/hooks/touch-gestures.test.js client/src/hooks/pinch-zoom.test.js client/src/components/canvas/use-canvas-pointer-interaction.test.js client/src/components/canvas/use-canvas-pointer-interaction.touch.test.jsx client/src/components/canvas/canvas-element-wrapper.test.jsx client/src/components/canvas/canvas-element-wrapper.touch.test.jsx client/src/components/SlideCanvas.test.jsx
npm run test:e2e:touch
npx playwright test tests/e2e/coverage-gaps-resize-guides.spec.js tests/e2e/editor-element-interactions.spec.js --project=chromium
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] Mouse, pen and touch use the same interaction geometry path.
- [x] Tablet editing proves selection, drag, resize, rotate, crop and pinch.
- [x] Cancelled/interrupted gestures cannot mutate later.
- [x] Cancelled/interrupted gestures restore start state and create no history/autosave record.
- [x] Locks, snapping, clamping, history and autosave retain parity.
- [x] All touch targets meet the tablet policy.
- [x] Existing mobile guard remains correct below 768px.

## Completion Evidence

Completed 2026-07-13. Pointer capture, cancellation rollback, touch hit regions, crop/ruler transport, canonical pinch zoom, and the mandatory tablet-touch project are implemented and covered by focused unit and browser evidence.

## Risk Assessment

- **Synthetic duplicate click:** suppress only matching compatibility clicks.
- **Competing session owners:** one state machine owns pointer capture and interaction mode; recognizers cannot attach parallel handlers.
- **Pinch/drag collision:** second touch transactionally rolls back pending element interaction.
- **Iframe/media breakage:** never apply blanket `touch-action: none`.
- **Lost mouse parity:** geometry layer remains unchanged and desktop tests run first.
- **Autosave flood:** commit logical gesture outcomes, not raw moves.

## Security And Data Integrity

Pointer input must not bypass lock policies or apply mutations to a stale active slide. Keep pointer IDs and active-slide refs scoped to the initiating session.
Capture presentation/slide/child identity at pointerdown and cancel if the active target changes before commit.

## Rollback

Revert pointer transport file-by-file while retaining geometry tests and Phase 2 canonical zoom. Never restore the whole EditorPage working tree.

## Next Steps

Phase 8 extracts the now-stable orchestration into focused controllers.
