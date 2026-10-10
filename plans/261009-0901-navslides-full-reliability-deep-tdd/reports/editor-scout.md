## Verified executable commands (not run)
- Focused unit: `npx vitest run client/src/hooks/editor-controller/use-editor-save-controller.test.jsx client/src/hooks/editor-controller/use-editor-persistence-controller.test.jsx client/src/hooks/editor-controller/use-editor-history-controller.test.js client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx`
- History routes: `npx vitest run server/routes/api-surface.test.js server/routes/history-package-integrity.test.js server/routes/history-package-lock-order.test.js server/routes/history-restore-snapshot.test.js server/routes/history-snapshot-delete-compensation.test.js`
- Rich text/master/selection/navigation: `npx vitest run client/src/hooks/editor-controller/use-editor-rich-text-controller.test.js client/src/hooks/editor-controller/use-editor-layout-controller.test.js client/src/hooks/editor-controller/use-editor-selection-controller.test.js client/src/components/SlidePanel.test.jsx client/src/components/SlideSorterView.test.jsx`
- Focused browser: `npx playwright test tests/e2e/slide-management.spec.js tests/e2e/slide-management-modal-and-multiselect.spec.js tests/e2e/autosave-oversized-recovery.spec.js --project=chromium`
- Keyboard/a11y: `npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium`
- Existing performance budget: `npm run test:ci-budget`; full unit `npm run test`; full browser `npm run test:e2e`. Do not run per assignment.

## Behavior scenarios to plan (26)
1) First loaded presentation seeds history without dirty state or autosave.
2) A real edit debounces history capture and autosave independently at their respective documented intervals.
3) Rapid edits coalesce to latest state; no stale intermediate snapshot becomes undo target.
4) Undo before history debounce commits pending edit and returns to prior snapshot.
5) Undo/redo roundtrip preserves content and availability boundaries.
6) New edit after undo invalidates redo immediately.
7) History cap remains bounded at 50 and oldest entries roll off.
8) Undo clearing a deleted text element safely clears TipTap content, including destroyed editor cases.
9) Rich text HTML formatting survives selection changes, undo/redo, save/reload.
10) Master rich-text edit targets master (not active slide); undo removes master safely and editing target reconciles.
11) Master fixed element lock is relaxed only in edit surface and persisted lock remains unchanged.
12) Master selection property batch updates only selected master elements.
13) Route A→B while A load is pending cannot install A, seed history, or save A into B.
14) A same-ID stale request from prior route cannot create conflict or successor state on current route.
15) Route reset cancels queued/awaiting export flush; old generation adoption is fenced.
16) Loaded identity suppression skips exactly loader-installed object, not an edit during route transition.
17) Autosave in-flight teardown writes recovery draft before request can outlive route/unmount.
18) Successful save clears only matching committed draft; newer pending draft survives.
19) Failed save remains visible/retryable; retry persists same intended snapshot/idempotency identity.
20) Remote conflict choice installs remote after dropping queued local save; local recovery requires explicit choice.
21) Manual save flushes immediately; beforeunload uses synchronous permitted flush path.
22) Snapshot creation/list/restore/delete happy path and named metadata.
23) Restore creates pre-restore snapshot and is reversible.
24) Stale package head during snapshot/restore fails closed without leaking owner or deleting target.
25) Snapshot cap pruning keeps newest 50 and preserves active restore target; owner release compensation retains recoverable file.
26) Settings overlapping PUTs do not lose disjoint updates; AI secret mask/omission remains preserved.

## Baseline measurement design for 50/100/300 slides (measure only; no virtualization assumption)
Use deterministic fixtures with stable unique horizontal slide IDs and fixed deck metadata, plus nested vertical children at representative density (e.g. 0/1/3 child variants), several text/image/chart-like elements, linked master with fixed elements, tokens, and equivalent content across sizes. Run production build/browser at fixed viewport/browser/runtime pins; warm once, then collect at least 5 repetitions each size in randomized order. Record cold editor ready, SlidePanel mount-to-interactive, React commit duration if profiler available, script/long-task duration, total node count, heap delta, thumbnail render/scroll frame latency, selection/change handler latency, and long task count. Keep dnd enabled and measure native drag start/drop reorder plus resulting stable IDs/order; test ctrl/meta multiselect, shift range, bulk duplicate/delete with index remapping; exercise vertical-child selection and parent/child labels; keyboard Arrow/Home/End/Enter, Shift+F10 context menu, focus restoration, role/name/pressed semantics, and axe/keyboard-only coverage. Include layouts/master and child preview in every size; verify no lost content/IDs, selection state remains ID-attached after reorder, children remain navigable, and scrolling reaches first/last entry. Report distributions (median/p95, range), environment and artifact; compare ratios and define thresholds only after an observed baseline. Do not auto-virtualize: first characterize costs and interaction invariants.

## Drift and prerequisites
- `README_vi.md` materially lags README/package/runtime: version v1.15.0 vs package 1.17.0 candidate and current changelog v1.17.0; Reveal 5 vs README’s Reveal 6 claim; old test commands omit current PPTX qualification lanes. README English runtime table says Node CI 22.22.0/container 22.23.3 and Reveal 6; `runtime-versions.json` owns canonical pins (Node 22.22.0, floor 22.13, container 22.23.3, Playwright 1.63.0, Chromium revision 1243, TipTap 3.31.3). README runtime table says TipTap 2, conflicting with runtime pin 3.31.3; reconcile against workspace manifests before changing docs.
- Baseline benchmark threshold is not evidenced in inspected files; establish measurements first, do not invent pass cutoffs.
- Settings race acceptance should specify atomic serialized update or revision/CAS contract before implementation; no tests run and no implementation proposed as accomplished.