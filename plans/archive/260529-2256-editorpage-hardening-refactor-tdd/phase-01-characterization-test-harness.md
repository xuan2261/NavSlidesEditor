---
phase: 1
title: "Characterization Test Harness"
status: pending
priority: P1
effort: "1-1.5d"
dependencies: []
---

# Phase 1: Characterization Test Harness

> **SPIKE RESOLVED (2026-05-30) — render mode: UNMOCKED (real tree).** `render(<EditorPage/>)` mounts clean in jsdom with ONLY `../../utils/api`, global `fetch`, and `LiveSocketContext` provider value mocked. The predicted jsdom crashers (TipTap `useEditor`, 10 highlight.js `?raw` CSS imports, KaTeX) all load fine. The ONLY blocker was `ResizeObserver is not defined` (SlideCanvas.jsx:177) — fixed with a no-op polyfill added to the shared setup `vitest-setup-jsdom-pointer-event-polyfills-for-radix-ui.js` (NOT a child stub). **No child components stubbed.** Therefore: the net exercises the REAL component tree (canvas/keyboard/selection/TipTap), and the **Phase 4-5 guarantee STANDS** ("characterization tests are the contract") — NO downgrade to mandatory browser smoke. Spike test: `client/src/pages/__tests__/editor-page-renderability-spike.test.jsx`.

## Overview

Build a behavior-locking test net around `EditorPage` BEFORE any change, so Phases 2-6 are regression-safe without depending on the P0 parity plan. Characterization tests are written to pass against *current* behavior, then act as the contract for the refactor.

> **Red Team #4 (Critical), #10 (High), #15-part (Medium) — applied.** (#4) NO EditorPage test has ever rendered it (glob of `client/src/pages/**/*.test.{js,jsx}` is empty); it inits TipTap `useEditor` (`:395`), imports 10 highlight.js themes via Vite `?raw` (`:65-74`), and KaTeX — all classic jsdom crashers. The "pure-extraction, tests-are-the-contract" guarantee for Phases 4-5 is only as strong as this net's ability to render the REAL tree. A **renderability spike is now step 0**, and if heavy child-stubbing is required the Phase 4-5 guarantee is explicitly downgraded. (#10) The autosave path is async (`processSaveQueue` awaits `persistPresentation`, re-drains in `finally`), so `advanceTimersByTime` alone won't flush it — tests must use `vi.runAllTimersAsync()`/`flushPromises`. (#15) `onCreatePresentation` calls raw `fetch` (`:1769`), NOT `api`, so mocking `../utils/api` leaves the AI path uncovered — stub global `fetch` too.

## Requirements

- Functional: capture observable EditorPage behavior — element add/update/delete, selection/multi-select, group/ungroup, z-order, undo/redo, auto-save scheduling (incl. async queue dedup), slide CRUD, keyboard dispatch, and the AI-generate path (raw `fetch`).
- Non-functional: tests must be fast (Vitest jsdom), deterministic (no real timers — use fake timers + async flush for debounce), and isolated (mock `api`, `liveSocket`, AND global `fetch`).

## Architecture

- **Step 0 — renderability spike (gate before writing any characterization test).** Attempt `render(<EditorPage/>)` in jsdom with only `../utils/api`, `LiveSocketContext`, and global `fetch` mocked — nothing else. Record the outcome:
  - **If it mounts clean:** the net exercises the real tree (TipTap/canvas/keyboard/selection). Proceed; Phases 4-5 keep the "tests are the contract" guarantee.
  - **If it crashes** (TipTap `useEditor` init, `?raw` CSS resolution, KaTeX, ProseMirror `getClientRects`): stub the minimum offending children via `vi.mock` (e.g. `RibbonPanel`, `SlideCanvas`, the TipTap editor), and **record exactly what was stubbed**. Stubbing the canvas/keyboard hollows the net for the surface Phases 4-6 mutate → in that case Phase 4-5 success criteria DOWNGRADE from "characterization tests are the contract" to "characterization tests + MANDATORY per-extraction browser smoke" (propagate this note to phase-04/05/07). The spike's stub list is a plan artifact, not an implementation detail.
- Render `EditorPage` with a seeded presentation via React Testing Library; mock `../utils/api` (`getPresentation`, `updatePresentation`, `uploadFile`), `LiveSocketContext`, and **global `fetch`** (so `onCreatePresentation`'s `/api/ai/generate-slides` POST at `:1769` is intercepted and asserted, not a real network call).
- Use `vi.useFakeTimers()` to assert the 1500ms auto-save debounce (`EditorPage.jsx:473`) and 500ms history push (`:496`). **The save path is async** — `processSaveQueue` (`:314-327`) is `async`, `await`s `persistPresentation`, and re-drains the queue in a `finally`. Fake-timer assertions MUST use `await vi.runAllTimersAsync()` (or `advanceTimersByTime` + explicit `await flushPromises()`) so the in-flight promise resolves and the `saveInFlightRef`/`queuedSaveRef` coalescing/re-drain actually runs before asserting. A bare `advanceTimersByTime(1500)` will NOT flush these microtasks.
- Split into focused files (each < 200 LOC) under `client/src/pages/__tests__/`.
- Lean on existing hook contract tests (`use-keyboard-contract.test.js`, `game-presenter-keyboard-shortcut-handler.test.js`) — do NOT duplicate; only add EditorPage-integration-level coverage they lack.

## Related Code Files

- Create: `client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx` (add/update/delete/select/group/z-order)
- Create: `client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx` (undo/redo, debounced save, save-queue dedup)
- Create: `client/src/pages/__tests__/editor-page-slide-ops.characterization.test.jsx` (add/delete/duplicate/move slide)
- Read for context: `client/src/pages/EditorPage.jsx`, `client/src/hooks/use-slide-operations.js`, `client/src/hooks/use-keyboard.js`, `client/src/stores/editor-store.js`

## Implementation Steps

0. **Renderability spike (GATE).** Attempt `render(<EditorPage/>)` with only `../utils/api`, `LiveSocketContext`, and global `fetch` mocked. If it mounts, proceed unmocked. If it crashes, stub the minimum offending children (`RibbonPanel`/`SlideCanvas`/TipTap editor) and RECORD the stub list in this phase file + propagate the Phase 4-5 guarantee downgrade (tests + mandatory browser smoke) to phase-04/05/07. Do not write characterization tests until the render mode is settled.
1. Add a `renderEditor(seed)` test helper: mocks `api`, global `fetch`, wraps in `LiveSocketContext.Provider`, returns RTL utils + access to the editor store. Encode whatever child stubs the spike required.
2. **Element ops**: assert `addElement` appends with defaults from `ELEMENT_DEFAULTS`; `updateElement` patches only target on current slide; `deleteElement` skips `locked` (`:542`); multi-select delete respects locked subset (`use-slide-operations.js:62-68`); group sets shared `groupId`; `bringToFront`/`sendToBack` reindex zIndex.
3. **History/autosave (async-correct)**: with fake timers, mutate → `await vi.runAllTimersAsync()` → assert `api.updatePresentation` called once with normalized notes. Then assert the async queue behavior explicitly: fire a second mutation while the first save promise is in-flight → after flush, assert it coalesced via `queuedSaveRef`/`saveInFlightRef` and the queue drained exactly once more (not N times). Undo restores prior snapshot and clamps `currentSlideIndex` (`:993`). Treat the `saveInFlightRef`/`queuedSaveRef` interleaving as its own named test case, not a one-liner.
4. **AI-generate path (raw fetch)**: invoke `onCreatePresentation(outline)`; assert the stubbed global `fetch` was called with `/api/ai/generate-slides` and that slides were appended per current behavior (slides built only when `data.slides` truthy). This locks the pre-change behavior so Phase 3's fetch removal becomes a test-visible, deliberate change.
5. **Slide ops**: add (inherits background `:255`), delete (guards last slide `:276`), duplicate (new ids), move (clamps bounds).
6. Snapshot the rendered top-level structure (header + body regions) as a coarse layout guard — coarse enough to survive cosmetic change, tight enough to catch removed regions.
7. Run suite; all GREEN against current code (characterization baseline), stable across 3 runs.

## Success Criteria

- [ ] **Renderability spike resolved**: render mode documented (unmocked, or the exact child-stub list). If stubbed, Phase 4-5 guarantee-downgrade note propagated to phase-04/05/07.
- [ ] 3-4 new characterization test files, each < 200 LOC, all passing against unchanged EditorPage.
- [ ] Coverage includes: element CRUD, selection/group, z-order, undo/redo, debounced save + **async queue dedup**, slide CRUD, **AI-generate raw-`fetch` path**.
- [ ] Autosave assertions use `vi.runAllTimersAsync()`/`flushPromises` (NOT bare `advanceTimersByTime`) and cover the `saveInFlightRef`/`queuedSaveRef` re-drain; deterministic (no flakiness across 3 runs).
- [ ] Global `fetch` stubbed; `onCreatePresentation` behavior locked before Phase 3 changes it.
- [ ] `npm run test -- editor-page` green; documented as the regression gate for Phases 2-6.

## Risk Assessment

- **Risk (Critical, now gated):** EditorPage may not render in jsdom at all (TipTap/`?raw` CSS/KaTeX). **Mitigation:** step-0 spike resolves render mode before any test is written; if stubbing is needed the net's reduced coverage is documented and Phase 4-5 lean on mandatory browser smoke instead of claiming "tests are the contract".
- **Risk (High, now mitigated):** Async save queue assertions flake or silently pass because fake timers don't flush microtasks. **Mitigation:** mandate `runAllTimersAsync`/`flushPromises`; the queue-dedup case is an explicit named test.
- **Risk:** Over-tight snapshots break on cosmetic refactor → false failures. **Mitigation:** snapshot only region presence/roles, not class strings.
- **Risk:** Hidden behavior not captured → silent regression in extraction. **Mitigation:** Phase 7 browser smoke as backstop; note any deliberately-uncovered area (and any spike-stubbed surface) in plan.
