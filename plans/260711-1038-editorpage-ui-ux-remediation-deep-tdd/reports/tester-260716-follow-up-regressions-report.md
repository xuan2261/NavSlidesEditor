# Phase 9 Follow-up Regression Report

**Date:** 2026-07-16
**Scope:** Test-first fixes identified during the Phase 9 remediation review.

## RED/GREEN fixes

- Stale-generation conflict resolution now clears the rejected failed entry before Use Remote or Keep Local dispatches a replacement.
- Redo now restores the dirty-state flag used by the Quick Access Save affordance.
- Navigator and Inspector wrappers stop propagation only for overlay Escape; docked Escape and Ctrl/Cmd+S remain reachable from focused panel controls.
- Compact Navigator/Inspector overlays now close through a pointer-activated backdrop and Escape at the workspace boundary; keyboard activation followed by immediate Escape is covered.
- First-load rich-text clearing retains its caller-owned marker while autosave uses a separate route-load skip marker.
- Save entries carry a route epoch so a rejected request from a departed route cannot resurrect into the next deck's failed queue; successor handling also requires the same route epoch, preventing a same-ID A→B→A request from poisoning the reloaded A state.
- Route changes now derive a loading state from the active route key, hide the outgoing deck while the incoming request is pending, reset interaction/rich-text state before replacement, disable stale-route keyboard/manual-save callbacks, publish the disabled keyboard options in a layout-synchronous effect, clear stale presentation state on load failure, and invalidate the marker on A→B→A bounces; the loaded snapshot remains the only autosave-suppressed object.
- Conflict-resolution continuations are load-epoch and conflict-identity guarded on both success and failure paths, so an old/canceled A response cannot clear a newer conflict, replace B state, or annotate B with a stale error.
- Conflict resolution is serialized per load epoch, so duplicate Use Remote/Keep Local activations cannot race each other into contradictory state or duplicate PUTs.
- Use Remote marks the exact remote snapshot as loaded, reseeds history, and resets interaction state, so resolving a conflict does not issue an unnecessary unchanged autosave or leave stale undo/editing context; later edits still use normal object-identity suppression semantics.
- Keep Local reads the latest same-route presentation after the remote generation check, preserving edits made before or during the lookup.
- Conflict dialogs now auto-focus Cancel, close on Escape, and disable editor shortcuts/legacy commands while unresolved so hidden canvas state cannot mutate behind the modal.
- Route reset clears stale saving/status/error UI while invalidating the old save attempt.
- The autosave characterization coverage was split into files below the repository 200-line guidance.

## Focused validation

```text
npx vitest run client/src/hooks/editor-controller/use-editor-persistence-controller.test.jsx client/src/hooks/editor-controller/use-editor-save-controller.test.jsx client/src/pages/__tests__/editor-page-autosave.characterization.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/components/editor/editor-panel-keyboard-propagation.test.jsx client/src/components/editor/editor-workspace-overlay.test.jsx client/src/hooks/use-keyboard.test.js client/src/components/editor/editor-shell.test.jsx
```

Result: **8 files passed, 30 tests passed** for the original follow-up slice.

Latest post-follow-up source validation:

```text
npx vitest run client/src/hooks/editor-controller/ client/src/components/editor/editor-panel-keyboard-propagation.test.jsx client/src/components/editor/editor-workspace-overlay.test.jsx client/src/components/editor/editor-shell.test.jsx client/src/hooks/use-keyboard.test.js client/src/components/editor/save-conflict-dialog.test.jsx client/src/pages/__tests__/editor-page-autosave.characterization.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/pages/editor-autosave-lifecycle.test.jsx client/src/pages/__tests__/editor-page-composition-root.test.js
```

Result: **12 files passed, 56 tests passed**. This adds stale conflict failure fencing, same-ID route-epoch successor protection, per-epoch conflict-action serialization, queued-successor discard on Use Remote, unchanged Use Remote autosave suppression, latest-edit Keep Local preservation, Use Remote history reseeding, interaction reset extraction, layout-synchronous keyboard disabling, conflict-dialog Escape/focus isolation, history-save timing stabilization, and the EditorPage composition-size guard after moving the interaction reset into its controller. The deferred A-to-B lifecycle test remains **1/1**; the controlled keyboard-open/immediate-Escape regression also passed, with no focus-transfer patch needed because the workspace boundary owns launcher Escape.

The P0 unload-recovery extension then passed **14 focused files / 66 tests**, including durable oversized-draft storage, explicit remote-first reconciliation, interrupted in-flight save retention, matching-identity cleanup, queued-successor draft fencing, history-test storage isolation, and the new recovery dialog.

The broader browser and PPTX results below remain evidence from the preceding integrated run; the latest lint, build, and focused matrices were rerun after the queued-successor and P0 unload-recovery hardening, while audit and load smoke were rerun after the preceding route/conflict hardening. The two focused Chromium lifecycle checks were rerun after the P0 implementation. Coverage was rerun without concurrent Vitest interference and remains blocked by the documented package-validation failure.

## Additional validation

- Responsive and accessibility Chromium gate: **13/13 passed**.
- Desktop Chromium editor regression gate: **20/20 passed**.
- Mandatory tablet-touch project: **7/7 passed**.
- Audit suite: **8 files / 36 tests passed** after the final route/conflict hardening.
- `npm run lint`: **0 errors, 25 warnings** (existing warning set), passed after the final route/conflict/modal/reset and queued-successor changes.
- `npm run build`: **passed**, with 2,293 modules transformed after the final route/conflict/modal/reset and queued-successor changes.
- Targeted ESLint for the changed route/persistence files: **passed**.
- P0 oversized unload recovery: **1/1 Chromium test passed**, with a snapshot above the keepalive ceiling, a durable local draft receipt, remote-first reload, and explicit `Use Remote` reconciliation.
- Existing small-payload autosave flush-on-leave contract: **1/1 Chromium test passed** after the P0 changes.
- PPTX strict gate: **11 corpus tests and 3 strict smoke browser tests passed** in the preceding integrated run.
- Full PPTX browser audit: **6 strict full-scope tests passed** in the preceding integrated run.
- Full coverage: **exit 1**, 463 files passed / 1 skipped / 1 failed (465 total); 3,618 tests passed / 1 failed / 3 skipped. The corpus opaque-relationship-closure test timed out at 60 seconds; no coverage percentage summary was emitted. A preceding full run also reported a canonical feature-matrix adapter-binding failure, while the standalone canonical capability test passed.
- API load smoke: **threshold fail**, 100% successful requests but p95 `http_req_duration=4.58s` against `<2s`; `iteration_duration` p95 was 5.6s against `<5s`.
- WebSocket load smoke: **passed**, 100% room joins, p95 connect 3.14ms, 6 messages received.
- Historical full Playwright E2E: **505 passed, 21 intentional skips, 2 flaky results** across 528 scheduled tests; the exact rerun with trace passed both live black/white overlay tests.

## Remaining release blockers

- The P0 oversized unload persistence/reconciliation implementation is focused/browser-green, but its full release gate remains open and continues to block Phase 9 release completion.
- Full coverage remains blocked by the corpus opaque-relationship-closure 60-second timeout. A preceding full run also exposed a canonical feature-matrix adapter-binding failure and an earlier shared coverage-directory race from a stale concurrent Vitest process; the standalone canonical capability test passed and the stale process was stopped before the final clean rerun.
- API load smoke exceeded both its `http_req_duration` and `iteration_duration` p95 thresholds; WebSocket smoke passed.
- The latest focused, audit, lint, and build gates are green. The preceding PPTX and full E2E evidence remains historical, without threshold or snapshot changes; the E2E overlay flakiness was resolved by the exact trace rerun policy for that run.

No thresholds, snapshots, secrets, or user-owned dirty files were weakened or discarded.

## Historical superseding validation (2026-07-18)

The blockers listed above were resolved for the stable-source 2026-07-18 release rerun recorded in Phase 9: full coverage, strict/full PPTX audits, API/WS smoke, P0 lifecycle tests, and exact flaky E2E reruns all passed. That result remains historical evidence and does not supersede the current release decision.

## Current release-gate status (2026-07-20)

**Current release-gate status: BLOCKED (2026-07-20).** The Playwright harness now publishes `PLAYWRIGHT_API_BASE_URL` to test workers. A serialized isolated `npm run test:e2e` exited 1 after 6.1 minutes: **530 total, 508 passed, 1 failed, and 21 skipped**. The sole failure is the `chromium-live` white-overlay behavior after `W`; it remains a product gate blocker.

Focused P0 unload-durability evidence remains green, but P0 full release verification and parent Phase 9 are incomplete. API-base propagation is verified but partial: the configuration guard passed 9/9 and the no-env four-worker candidate probe passed 68/68; helper API calls go direct while some raw Playwright requests still route through Vite. A separate concurrent-build `ENOENT` invocation is invalid infrastructure-interference evidence and is excluded from pass/fail assessment.
